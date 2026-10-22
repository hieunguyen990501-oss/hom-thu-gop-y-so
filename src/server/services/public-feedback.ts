// Nghiệp vụ phía người gửi: gửi góp ý, tra cứu, bổ sung thông tin, đánh giá mức độ hài lòng.
// Nguyên tắc ẩn danh: không lưu IP, thiết bị, tài khoản; thông tin người gửi (nếu tự nguyện cung cấp)
// được tách bảng riêng và mã hóa.
import type { Feedback } from "@prisma/client";
import { prisma } from "../db";
import { AppError, invalid } from "../errors";
import { encrypt, formatSecret, randomSecret } from "../auth/crypto";
import { dummyVerify, hashSecret, verifySecret } from "../auth/password";
import { getSetting } from "../settings";
import { rateLimit } from "../rate-limit";
import { lookupSchema, satisfactionSchema, senderMessageSchema, submitFeedbackSchema, firstError, fieldErrors } from "@/lib/validation";
import { FEEDBACK_TYPE_LABELS, PUBLIC_STATUS_LABELS, TERMINAL_STATUSES, SATISFACTION_LABELS } from "@/lib/constants";
import { vnYear } from "@/lib/dates";
import { computeDueAt } from "./sla";
import { suggestCategory } from "./similarity";
import { eligibleRecipients, handlerRecipients, notify } from "./notifications";

export class ValidationFailure extends AppError {
  constructor(message: string, public fields: Record<string, string>) {
    super(message, "INVALID");
  }
}

const LOOKUP_MAX_FAILS = 10;
const LOOKUP_LOCK_MS = 30 * 60_000;
const GENERIC_LOOKUP_ERROR = "Mã hồ sơ hoặc mã bí mật không đúng. Vui lòng kiểm tra lại.";

async function nextCode(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], demo: boolean, now: Date) {
  const scope = `${demo ? "DEMO-" : ""}GY-${vnYear(now)}`;
  const counter = await tx.feedbackCounter.upsert({
    where: { scope },
    create: { scope, lastSeq: 1 },
    update: { lastSeq: { increment: 1 } },
  });
  return `${scope}-${String(counter.lastSeq).padStart(6, "0")}`;
}

export interface SubmitResult {
  code: string;
  secret: string; // đã định dạng XXXX-XXXX-XXXX; chỉ trả về MỘT lần, không lưu dạng rõ
  createdAt: Date;
  publicStatus: string;
}

export async function submitFeedback(raw: unknown, opts: { clientKey?: string } = {}): Promise<SubmitResult> {
  if (!(await getSetting("public.submissionsOpen"))) throw invalid("Hệ thống tạm dừng tiếp nhận góp ý. Vui lòng sử dụng kênh trực tiếp theo quy định của đơn vị.");

  if (opts.clientKey) {
    const limit = await getSetting("public.rateLimitPerHour");
    if (!rateLimit("submit", opts.clientKey, limit, 3_600_000).ok)
      throw new AppError("Bạn đã gửi quá nhiều ý kiến trong thời gian ngắn. Vui lòng thử lại sau.", "RATE_LIMITED");
  }

  const parsed = submitFeedbackSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationFailure(firstError(parsed.error), fieldErrors(parsed.error));
  const d = parsed.data;

  if (!d.isAnonymous && !(await getSetting("public.allowIdentified"))) throw invalid("Hiện chỉ tiếp nhận góp ý ẩn danh.");

  const category = await prisma.feedbackCategory.findFirst({ where: { id: d.categoryId, isActive: true } });
  if (!category) throw new ValidationFailure("Lĩnh vực góp ý không hợp lệ.", { categoryId: "Lĩnh vực góp ý không hợp lệ." });

  if (d.senderUnitId) {
    const unit = await prisma.organizationalUnit.findFirst({ where: { id: d.senderUnitId, isActive: true, isSenderSelectable: true } });
    if (!unit) throw new ValidationFailure("Đơn vị không hợp lệ.", { senderUnitId: "Đơn vị không hợp lệ." });
  }

  const categories = await prisma.feedbackCategory.findMany({ where: { isActive: true }, select: { id: true, name: true, keywords: true } });
  const suggestion = suggestCategory(`${d.title} ${d.content}`, categories);

  const demo = await getSetting("system.demoMode");
  const secret = randomSecret(12);
  const secretHash = await hashSecret(secret);
  const now = new Date();
  const dueAt = await computeDueAt(now, "NORMAL", category.slaDays);

  const fb = await prisma.$transaction(async (tx) => {
    const code = await nextCode(tx, demo, now);
    const created = await tx.feedback.create({
      data: {
        code,
        type: d.type as Feedback["type"],
        categoryId: category.id,
        suggestedCategoryId: suggestion && suggestion.id !== category.id ? suggestion.id : null,
        title: d.title,
        content: d.content,
        proposal: d.proposal ?? null,
        isAnonymous: d.isAnonymous,
        secretHash,
        dueAt,
        isDemo: demo,
        createdAt: now,
        publicUpdatedAt: now,
      },
    });
    if (!d.isAnonymous && (d.fullName || d.contact || d.senderUnitId)) {
      await tx.feedbackSender.create({
        data: {
          feedbackId: created.id,
          fullNameEnc: d.fullName ? encrypt(d.fullName) : null,
          contactEnc: d.contact ? encrypt(d.contact) : null,
          unitId: d.senderUnitId ?? null,
        },
      });
    }
    await tx.feedbackStatusHistory.create({
      data: {
        feedbackId: created.id,
        toStatus: "NEW",
        actorType: "SYSTEM",
        note: "Hệ thống tiếp nhận ý kiến qua cổng góp ý.",
        publicNote: "Hệ thống đã tiếp nhận ý kiến của đồng chí.",
        createdAt: now,
      },
    });
    const recipients = await eligibleRecipients(created, ["FEEDBACK_CLASSIFY"], tx);
    await notify(recipients, {
      type: "NEW_FEEDBACK",
      feedbackId: created.id,
      title: `Góp ý mới ${code}`,
      message: `${FEEDBACK_TYPE_LABELS[created.type]} – lĩnh vực ${category.name}. Đề nghị tiếp nhận, phân loại.`,
    }, tx);
    return created;
  });

  return { code: fb.code, secret: formatSecret(secret), createdAt: fb.createdAt, publicStatus: PUBLIC_STATUS_LABELS.NEW };
}

// Xác thực cặp mã hồ sơ + mã bí mật. Thông báo lỗi không phân biệt "sai mã" hay "không tồn tại".
async function verifyLookup(raw: { code: unknown; secret: unknown }, clientKey?: string): Promise<Feedback> {
  if (clientKey && !rateLimit("lookup", clientKey, 20, 15 * 60_000).ok)
    throw new AppError("Bạn đã tra cứu quá nhiều lần. Vui lòng thử lại sau ít phút.", "RATE_LIMITED");

  const parsed = lookupSchema.safeParse(raw);
  if (!parsed.success) throw invalid(firstError(parsed.error));
  const { code, secret } = parsed.data;

  const fb = await prisma.feedback.findUnique({ where: { code } });
  if (!fb) {
    await dummyVerify(secret);
    throw invalid(GENERIC_LOOKUP_ERROR);
  }
  if (fb.lookupLockedUntil && fb.lookupLockedUntil > new Date())
    throw new AppError("Hồ sơ tạm khóa tra cứu do nhập sai mã bí mật nhiều lần. Vui lòng thử lại sau 30 phút.", "RATE_LIMITED");

  const ok = await verifySecret(fb.secretHash, secret);
  if (!ok) {
    const fails = fb.lookupFailCount + 1;
    await prisma.feedback.update({
      where: { id: fb.id },
      data: fails >= LOOKUP_MAX_FAILS
        ? { lookupFailCount: 0, lookupLockedUntil: new Date(Date.now() + LOOKUP_LOCK_MS) }
        : { lookupFailCount: fails },
    });
    throw invalid(GENERIC_LOOKUP_ERROR);
  }
  if (fb.lookupFailCount > 0) await prisma.feedback.update({ where: { id: fb.id }, data: { lookupFailCount: 0, lookupLockedUntil: null } });
  return fb;
}

export interface PublicFeedbackView {
  code: string;
  createdAt: Date;
  typeLabel: string;
  categoryName: string;
  title: string;
  content: string;
  proposal: string | null;
  isAnonymous: boolean;
  publicStatus: string;
  statusKey: string;
  updatedAt: Date;
  timeline: { at: Date; text: string; bySender: boolean }[];
  responses: { at: Date; kind: "REQUEST_INFO" | "ANSWER"; content: string }[];
  canAddInfo: boolean;
  needsInfo: boolean;
  canRate: boolean;
  satisfactionLabel: string | null;
  isDemo: boolean;
}

export async function lookupFeedback(raw: unknown, opts: { clientKey?: string } = {}): Promise<PublicFeedbackView> {
  const input = (raw ?? {}) as { code?: unknown; secret?: unknown };
  const fb = await verifyLookup({ code: input.code, secret: input.secret }, opts.clientKey);
  return buildPublicView(fb.id);
}

async function buildPublicView(id: string): Promise<PublicFeedbackView> {
  const fb = await prisma.feedback.findUniqueOrThrow({
    where: { id },
    include: {
      category: { select: { name: true } },
      // Chỉ lấy các mục có nội dung công khai; không lấy tên cán bộ, ghi chú nội bộ.
      history: { where: { publicNote: { not: null } }, orderBy: { createdAt: "asc" }, select: { createdAt: true, publicNote: true, actorType: true } },
      responses: { where: { status: "PUBLISHED" }, orderBy: { publishedAt: "asc" }, select: { publishedAt: true, kind: true, content: true } },
      messages: { orderBy: { createdAt: "asc" }, select: { createdAt: true, content: true } },
    },
  });
  const terminal = TERMINAL_STATUSES.includes(fb.status);
  const timeline = [
    ...fb.history.map((h) => ({ at: h.createdAt, text: h.publicNote!, bySender: h.actorType === "SENDER" })),
    ...fb.messages.map((m) => ({ at: m.createdAt, text: `Người gửi bổ sung: ${m.content}`, bySender: true })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  return {
    code: fb.code,
    createdAt: fb.createdAt,
    typeLabel: FEEDBACK_TYPE_LABELS[fb.type],
    categoryName: fb.category.name,
    title: fb.title,
    content: fb.content,
    proposal: fb.proposal,
    isAnonymous: fb.isAnonymous,
    publicStatus: PUBLIC_STATUS_LABELS[fb.status],
    statusKey: fb.status,
    updatedAt: fb.publicUpdatedAt,
    timeline,
    responses: fb.responses.map((r) => ({ at: r.publishedAt!, kind: r.kind, content: r.content })),
    canAddInfo: fb.allowSenderInteraction && !terminal,
    needsInfo: fb.status === "WAITING_INFO",
    canRate: fb.status === "RESOLVED" && !fb.satisfaction,
    satisfactionLabel: fb.satisfaction ? SATISFACTION_LABELS[fb.satisfaction] : null,
    isDemo: fb.isDemo,
  };
}

export async function addSenderMessage(raw: unknown, opts: { clientKey?: string } = {}): Promise<PublicFeedbackView> {
  if (opts.clientKey && !rateLimit("message", opts.clientKey, 10, 3_600_000).ok)
    throw new AppError("Bạn đã gửi bổ sung quá nhiều lần. Vui lòng thử lại sau.", "RATE_LIMITED");
  const parsed = senderMessageSchema.safeParse(raw);
  if (!parsed.success) throw invalid(firstError(parsed.error));
  const fb = await verifyLookup(parsed.data, opts.clientKey);
  if (!fb.allowSenderInteraction || TERMINAL_STATUSES.includes(fb.status))
    throw invalid("Hồ sơ đã kết thúc hoặc không còn tiếp nhận thông tin bổ sung.");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.feedbackMessage.create({ data: { feedbackId: fb.id, content: parsed.data.content, createdAt: now } });
    if (fb.status === "WAITING_INFO") {
      await tx.feedbackStatusHistory.create({
        data: {
          feedbackId: fb.id,
          fromStatus: "WAITING_INFO",
          toStatus: "IN_PROGRESS",
          actorType: "SENDER",
          note: "Người gửi đã bổ sung thông tin qua trang tra cứu.",
          publicNote: "Đơn vị đã nhận thông tin bổ sung và tiếp tục xem xét, giải quyết.",
          createdAt: now,
        },
      });
      await tx.feedback.update({ where: { id: fb.id }, data: { status: "IN_PROGRESS", publicUpdatedAt: now } });
    } else {
      await tx.feedback.update({ where: { id: fb.id }, data: { publicUpdatedAt: now } });
    }
    const recipients = [
      ...(await handlerRecipients(fb, tx)),
      ...(fb.assignedUserId || fb.assignedUnitId ? [] : await eligibleRecipients(fb, ["FEEDBACK_CLASSIFY"], tx)),
    ];
    await notify(recipients, {
      type: "SENDER_REPLIED",
      feedbackId: fb.id,
      title: `Người gửi bổ sung thông tin hồ sơ ${fb.code}`,
      message: "Có thông tin bổ sung mới từ người gửi, đề nghị xem xét.",
    }, tx);
  });
  return buildPublicView(fb.id);
}

export async function submitSatisfaction(raw: unknown, opts: { clientKey?: string } = {}): Promise<PublicFeedbackView> {
  const parsed = satisfactionSchema.safeParse(raw);
  if (!parsed.success) throw invalid(firstError(parsed.error));
  const fb = await verifyLookup(parsed.data, opts.clientKey);
  if (fb.status !== "RESOLVED") throw invalid("Chỉ đánh giá được khi hồ sơ đã có kết quả giải quyết.");
  if (fb.satisfaction) throw invalid("Đồng chí đã gửi đánh giá cho hồ sơ này.");
  await prisma.feedback.update({
    where: { id: fb.id },
    data: { satisfaction: parsed.data.satisfaction, satisfactionComment: parsed.data.comment ?? null, satisfactionAt: new Date() },
  });
  return buildPublicView(fb.id);
}

export async function publicFormOptions() {
  const [categories, units, allowIdentified, submissionsOpen, demoMode] = await Promise.all([
    prisma.feedbackCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.organizationalUnit.findMany({ where: { isActive: true, isSenderSelectable: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    getSetting("public.allowIdentified"),
    getSetting("public.submissionsOpen"),
    getSetting("system.demoMode"),
  ]);
  return { categories, units, allowIdentified, submissionsOpen, demoMode };
}
