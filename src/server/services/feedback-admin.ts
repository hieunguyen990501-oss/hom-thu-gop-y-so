// Nghiệp vụ xử lý hồ sơ phía cán bộ. Mọi hàm đều nhận Actor, kiểm tra quyền và phạm vi tại server.
import type { FeedbackStatus, FeedbackType, Prisma, Priority } from "@prisma/client";
import { prisma } from "../db";
import { forbidden, invalid, notFound } from "../errors";
import { type Actor, assertCan, can, feedbackScopeWhere } from "../rbac";
import { logAudit } from "../audit";
import { decrypt } from "../auth/crypto";
import { getSetting } from "../settings";
import { computeDueAt } from "./sla";
import { eligibleRecipients, handlerRecipients, notify } from "./notifications";
import { similarity } from "./similarity";
import {
  FEEDBACK_TYPES,
  MANUAL_TRANSITIONS,
  OPEN_STATUSES,
  PRIORITIES,
  STATUSES,
  STATUS_LABELS,
  TERMINAL_STATUSES,
} from "@/lib/constants";
import { cleanText, noteText, optionalNote, reasonText, responseText, firstError } from "@/lib/validation";
import { endOfVnDay, startOfVnDay } from "@/lib/dates";

type Tx = Prisma.TransactionClient;

function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: import("zod").ZodError } }, v: unknown): T {
  const r = schema.safeParse(v);
  if (!r.success) throw invalid(firstError(r.error));
  return r.data;
}

async function scoped(actor: Actor) {
  return feedbackScopeWhere(actor, await getSetting("system.demoMode"));
}

// Lấy hồ sơ trong phạm vi được phép; không tồn tại và không có quyền trả về cùng một lỗi.
export async function getScopedFeedback(actor: Actor, id: string, tx: Tx = prisma) {
  if (typeof id !== "string" || id.length > 40) throw notFound();
  const fb = await tx.feedback.findFirst({ where: { AND: [{ id }, await scoped(actor)] } });
  if (!fb) throw notFound();
  return fb;
}

async function recordStatus(
  tx: Tx,
  actor: Actor,
  fb: { id: string; status: FeedbackStatus },
  to: FeedbackStatus,
  note: string | null,
  publicNote: string | null,
) {
  await tx.feedbackStatusHistory.create({
    data: { feedbackId: fb.id, fromStatus: fb.status, toStatus: to, actorType: "STAFF", actorId: actor.id, note, publicNote },
  });
}

// ───────────── Danh sách ─────────────

export interface ListFilters {
  q?: string;
  status?: string;
  type?: string;
  categoryId?: string;
  priority?: string;
  from?: string;
  to?: string;
  view?: string; // overdue | unassigned | mine | pending_approval | due_soon | leader_review
  sort?: string;
  dir?: string;
  page?: number;
  pageSize?: number;
}

const SORTS: Record<string, keyof Prisma.FeedbackOrderByWithRelationInput> = {
  createdAt: "createdAt",
  dueAt: "dueAt",
  priority: "priority",
  status: "status",
  code: "code",
};

export async function buildListWhere(actor: Actor, f: ListFilters): Promise<Prisma.FeedbackWhereInput> {
  const and: Prisma.FeedbackWhereInput[] = [await scoped(actor)];
  const q = cleanText(f.q ?? "").slice(0, 100);
  if (q) and.push({ OR: [{ code: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] });
  if (f.status && (STATUSES as string[]).includes(f.status)) and.push({ status: f.status as FeedbackStatus });
  if (f.status === "OPEN") and.push({ status: { in: OPEN_STATUSES } });
  if (f.type && (FEEDBACK_TYPES as string[]).includes(f.type)) and.push({ type: f.type as FeedbackType });
  if (f.priority && (PRIORITIES as string[]).includes(f.priority)) and.push({ priority: f.priority as Priority });
  if (f.categoryId) and.push({ categoryId: String(f.categoryId).slice(0, 40) });
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) and.push({ createdAt: { gte: startOfVnDay(f.from) } });
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) and.push({ createdAt: { lte: endOfVnDay(f.to) } });
  const now = new Date();
  const dueSoonDays = await getSetting("sla.dueSoonDays");
  switch (f.view) {
    case "overdue":
      and.push({ status: { in: OPEN_STATUSES }, dueAt: { lt: now } });
      break;
    case "due_soon":
      and.push({ status: { in: OPEN_STATUSES }, dueAt: { gte: now, lte: new Date(now.getTime() + dueSoonDays * 86_400_000) } });
      break;
    case "unassigned":
      and.push({ status: { in: ["NEW", "CLASSIFYING"] }, assignedUnitId: null, assignedUserId: null });
      break;
    case "mine":
      and.push({ OR: [{ assignedUserId: actor.id }, ...(actor.unitId ? [{ assignedUnitId: actor.unitId, assignedUserId: null }] : [])] });
      break;
    case "pending_approval":
      and.push({ status: "PENDING_APPROVAL" });
      break;
    case "leader_review":
      and.push({ needsLeaderReview: true, status: { in: OPEN_STATUSES } });
      break;
  }
  return { AND: and };
}

export async function listFeedback(actor: Actor, f: ListFilters) {
  const where = await buildListWhere(actor, f);
  const pageSize = Math.min(Math.max(Number(f.pageSize) || 20, 5), 100);
  const page = Math.max(Number(f.page) || 1, 1);
  const sortField = SORTS[f.sort ?? ""] ?? "createdAt";
  const dir: Prisma.SortOrder = f.dir === "asc" ? "asc" : "desc";
  const [total, items] = await Promise.all([
    prisma.feedback.count({ where }),
    prisma.feedback.findMany({
      where,
      orderBy: [
        (sortField === "dueAt" ? { dueAt: { sort: dir, nulls: "last" } } : { [sortField]: dir }) as Prisma.FeedbackOrderByWithRelationInput,
        { createdAt: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      // Không chọn bất kỳ trường định danh người gửi nào cho danh sách tổng hợp.
      select: {
        id: true,
        code: true,
        createdAt: true,
        type: true,
        title: true,
        priority: true,
        status: true,
        dueAt: true,
        isDemo: true,
        needsLeaderReview: true,
        category: { select: { name: true } },
        assignedUnit: { select: { name: true } },
        assignedUser: { select: { fullName: true, rank: true } },
      },
    }),
  ]);
  return { total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), items };
}

// ───────────── Chi tiết ─────────────

export async function getFeedbackDetail(actor: Actor, id: string) {
  const base = await getScopedFeedback(actor, id);
  const fb = await prisma.feedback.findUniqueOrThrow({
    where: { id: base.id },
    include: {
      category: true,
      suggestedCategory: { select: { id: true, name: true } },
      assignedUnit: { select: { id: true, name: true } },
      assignedUser: { select: { id: true, fullName: true, rank: true, position: true } },
      conclusionApprovedBy: { select: { fullName: true, rank: true } },
      history: { orderBy: { createdAt: "asc" }, include: { actor: { select: { fullName: true, rank: true } } } },
      responses: { orderBy: { createdAt: "asc" }, include: { author: { select: { fullName: true, rank: true } }, approvedBy: { select: { fullName: true, rank: true } } } },
      messages: { orderBy: { createdAt: "asc" } },
      assignments: { orderBy: { createdAt: "desc" }, include: { assignedUnit: { select: { name: true } }, assignedUser: { select: { fullName: true, rank: true } }, assignedBy: { select: { fullName: true } } } },
      notes: { where: can(actor, "FEEDBACK_NOTE") ? {} : { id: "__none__" }, orderBy: { createdAt: "asc" }, include: { author: { select: { fullName: true, rank: true } } } },
      restrictions: { where: can(actor, "FEEDBACK_RESTRICT") ? {} : { id: "__none__" }, include: { user: { select: { fullName: true, username: true } }, createdBy: { select: { fullName: true } } } },
      sender: { select: { id: true } },
    },
  });
  await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "feedback.viewed", entityType: "Feedback", entityId: fb.id, metadata: { code: fb.code } });
  const { secretHash: _s, lookupFailCount: _c, lookupLockedUntil: _l, sender, ...safe } = fb;
  void _s; void _c; void _l;
  return { ...safe, hasSenderInfo: !!sender };
}

export async function getSenderInfo(actor: Actor, id: string) {
  assertCan(actor, "FEEDBACK_VIEW_SENDER");
  const fb = await getScopedFeedback(actor, id);
  const sender = await prisma.feedbackSender.findUnique({ where: { feedbackId: fb.id }, include: { unit: { select: { name: true } } } });
  if (!sender) return null;
  await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "feedback.sender_viewed", entityType: "Feedback", entityId: fb.id, metadata: { code: fb.code } });
  return {
    fullName: sender.fullNameEnc ? decrypt(sender.fullNameEnc) : null,
    contact: sender.contactEnc ? decrypt(sender.contactEnc) : null,
    unitName: sender.unit?.name ?? null,
  };
}

export async function findSimilar(actor: Actor, id: string, limit = 5) {
  const fb = await getScopedFeedback(actor, id);
  const candidates = await prisma.feedback.findMany({
    where: { AND: [await scoped(actor), { id: { not: fb.id } }] },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { id: true, code: true, title: true, content: true, status: true, createdAt: true },
  });
  const text = `${fb.title} ${fb.content}`;
  return candidates
    .map((c) => ({ id: c.id, code: c.code, title: c.title, status: c.status, createdAt: c.createdAt, score: similarity(text, `${c.title} ${c.content}`) }))
    .filter((c) => c.score >= 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ───────────── Phân loại ─────────────

export async function classifyFeedback(
  actor: Actor,
  id: string,
  input: { categoryId: string; type: string; priority: string; needsLeaderReview?: boolean; note?: string },
) {
  assertCan(actor, "FEEDBACK_CLASSIFY");
  const fb = await getScopedFeedback(actor, id);
  if (TERMINAL_STATUSES.includes(fb.status)) throw invalid("Hồ sơ đã kết thúc, không thể phân loại lại.");
  if (!(FEEDBACK_TYPES as string[]).includes(input.type)) throw invalid("Loại ý kiến không hợp lệ.");
  if (!(PRIORITIES as string[]).includes(input.priority)) throw invalid("Mức ưu tiên không hợp lệ.");
  const category = await prisma.feedbackCategory.findFirst({ where: { id: input.categoryId, isActive: true } });
  if (!category) throw invalid("Lĩnh vực không hợp lệ.");
  if (actor.categoryScope.length && !actor.categoryScope.includes(category.id))
    throw forbidden("Lĩnh vực này nằm ngoài phạm vi được giao của đồng chí.");
  const note = parse(optionalNote, input.note);
  const priority = input.priority as Priority;
  const dueAt = priority !== fb.priority || category.id !== fb.categoryId ? await computeDueAt(fb.createdAt, priority, category.slaDays) : fb.dueAt;

  await prisma.$transaction(async (tx) => {
    const toStatus: FeedbackStatus = fb.status === "NEW" ? "CLASSIFYING" : fb.status;
    await tx.feedback.update({
      where: { id: fb.id },
      data: {
        categoryId: category.id,
        type: input.type as FeedbackType,
        priority,
        dueAt,
        needsLeaderReview: !!input.needsLeaderReview,
        status: toStatus,
        suggestedCategoryId: fb.suggestedCategoryId === category.id ? null : fb.suggestedCategoryId,
        ...(toStatus !== fb.status ? { publicUpdatedAt: new Date() } : {}),
      },
    });
    const changes = [
      fb.categoryId !== category.id && `lĩnh vực → ${category.name}`,
      fb.type !== input.type && `loại ý kiến`,
      fb.priority !== priority && `mức ưu tiên`,
    ].filter(Boolean);
    await recordStatus(tx, actor, fb, toStatus, `Phân loại hồ sơ${changes.length ? ` (${changes.join(", ")})` : ""}.${note ? " " + note : ""}`,
      toStatus !== fb.status ? "Ý kiến đang được xem xét, phân loại." : null);
    await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "feedback.classified", entityType: "Feedback", entityId: fb.id, metadata: { code: fb.code, categoryId: category.id, type: input.type, priority } }, tx);
    if (input.needsLeaderReview && !fb.needsLeaderReview) {
      const leaders = await eligibleRecipients({ ...fb, categoryId: category.id }, ["FEEDBACK_APPROVE"], tx);
      await notify(leaders, { type: "PENDING_APPROVAL", feedbackId: fb.id, title: `Hồ sơ ${fb.code} cần lãnh đạo xem xét`, message: "Cán bộ tiếp nhận đề nghị lãnh đạo, chỉ huy xem xét hồ sơ này." }, tx);
    }
  });
}

// ───────────── Phân công ─────────────

export async function assignFeedback(actor: Actor, id: string, input: { unitId?: string; userId?: string; dueDate?: string; note?: string }) {
  assertCan(actor, "FEEDBACK_ASSIGN");
  const fb = await getScopedFeedback(actor, id);
  if (TERMINAL_STATUSES.includes(fb.status) || fb.status === "PENDING_APPROVAL")
    throw invalid("Không thể phân công hồ sơ ở trạng thái hiện tại.");
  const note = parse(optionalNote, input.note);
  const unitId = input.unitId || null;
  const userId = input.userId || null;
  if (!unitId && !userId) throw invalid("Chọn bộ phận hoặc cán bộ được phân công.");

  let unitName: string | null = null;
  if (unitId) {
    const unit = await prisma.organizationalUnit.findFirst({ where: { id: unitId, isActive: true, isHandlingUnit: true } });
    if (!unit) throw invalid("Bộ phận xử lý không hợp lệ.");
    unitName = unit.name;
  }
  let assignee: { id: string; fullName: string; unitId: string | null } | null = null;
  if (userId) {
    assignee = await prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
        isDemo: fb.isDemo ? undefined : false,
        role: { permissions: { some: { permission: { code: { in: ["FEEDBACK_PROCESS", "FEEDBACK_VIEW_ALL"] } } } } },
      },
      select: { id: true, fullName: true, unitId: true },
    });
    if (!assignee) throw invalid("Cán bộ được phân công không hợp lệ.");
    const restricted = await prisma.feedbackAccessRestriction.findFirst({ where: { feedbackId: fb.id, userId } });
    if (restricted) throw invalid("Cán bộ này đã bị loại trừ khỏi hồ sơ (xung đột lợi ích), không thể phân công.");
  }

  let dueAt = fb.dueAt;
  if (input.dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw invalid("Hạn xử lý không hợp lệ.");
    dueAt = endOfVnDay(input.dueDate);
    if (dueAt < new Date()) throw invalid("Hạn xử lý phải từ hôm nay trở đi.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.feedbackAssignment.updateMany({ where: { feedbackId: fb.id, isActive: true }, data: { isActive: false } });
    await tx.feedbackAssignment.create({
      data: { feedbackId: fb.id, assignedUnitId: unitId, assignedUserId: userId, assignedById: actor.id, dueAt, note },
    });
    const toStatus: FeedbackStatus = ["NEW", "CLASSIFYING", "ASSIGNED"].includes(fb.status) ? "ASSIGNED" : fb.status;
    const updated = await tx.feedback.update({
      where: { id: fb.id },
      data: { assignedUnitId: unitId, assignedUserId: userId, dueAt, status: toStatus, publicUpdatedAt: toStatus !== fb.status ? new Date() : undefined },
    });
    const target = [assignee?.fullName, unitName].filter(Boolean).join(" – ");
    await recordStatus(tx, actor, fb, toStatus, `Phân công cho ${target}.${note ? " " + note : ""}`,
      toStatus !== fb.status ? "Ý kiến đã được chuyển đến bộ phận có trách nhiệm xem xét, giải quyết." : null);
    await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "feedback.assigned", entityType: "Feedback", entityId: fb.id, metadata: { code: fb.code, unitId, userId } }, tx);
    await notify(await handlerRecipients(updated, tx), {
      type: "ASSIGNED",
      feedbackId: fb.id,
      title: `Được phân công xử lý hồ sơ ${fb.code}`,
      message: `Hạn xử lý: ${dueAt ? dueAt.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "chưa đặt"}.`,
    }, tx);
  });
}

// ───────────── Chuyển trạng thái thủ công ─────────────

export async function changeStatus(actor: Actor, id: string, input: { to: string; note?: string }) {
  const fb = await getScopedFeedback(actor, id);
  const to = input.to as FeedbackStatus;
  const allowed = MANUAL_TRANSITIONS[fb.status] ?? [];
  if (!allowed.includes(to)) throw invalid(`Không thể chuyển từ "${STATUS_LABELS[fb.status]}" sang "${STATUS_LABELS[to] ?? to}".`);
  if (to === "CLASSIFYING") assertCan(actor, "FEEDBACK_CLASSIFY");
  if (to === "IN_PROGRESS" && !can(actor, "FEEDBACK_PROCESS") && !can(actor, "FEEDBACK_CLASSIFY")) throw forbidden();
  const note = parse(optionalNote, input.note);
  await prisma.$transaction(async (tx) => {
    await tx.feedback.update({ where: { id: fb.id }, data: { status: to, publicUpdatedAt: new Date() } });
    await recordStatus(tx, actor, fb, to, note ?? `Chuyển trạng thái: ${STATUS_LABELS[to]}.`,
      to === "IN_PROGRESS" ? "Ý kiến đang được bộ phận có trách nhiệm xem xét, giải quyết." : "Ý kiến đang được xem xét, phân loại.");
    await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "feedback.status_changed", entityType: "Feedback", entityId: fb.id, metadata: { code: fb.code, from: fb.status, to } }, tx);
  });
}

// ───────────── Yêu cầu bổ sung thông tin (phản hồi hai chiều) ─────────────

export async function requestMoreInfo(actor: Actor, id: string, input: { content: string }) {
  if (!can(actor, "FEEDBACK_PROCESS") && !can(actor, "FEEDBACK_CLASSIFY")) throw forbidden();
  const fb = await getScopedFeedback(actor, id);
  if (!["NEW", "CLASSIFYING", "ASSIGNED", "IN_PROGRESS"].includes(fb.status)) throw invalid("Không thể yêu cầu bổ sung ở trạng thái hiện tại.");
  if (!fb.allowSenderInteraction) throw invalid("Hồ sơ không cho phép tương tác với người gửi.");
  const content = parse(responseText, input.content);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.feedbackResponse.create({
      data: { feedbackId: fb.id, kind: "REQUEST_INFO", content, status: "PUBLISHED", authorId: actor.id, publishedAt: now, approvedById: actor.id, approvedAt: now },
    });
    await tx.feedback.update({ where: { id: fb.id }, data: { status: "WAITING_INFO", publicUpdatedAt: now } });
    await recordStatus(tx, actor, fb, "WAITING_INFO", "Gửi yêu cầu bổ sung thông tin cho người gửi.", "Đơn vị đề nghị đồng chí bổ sung thông tin (xem nội dung yêu cầu bên dưới).");
    await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "feedback.status_changed", entityType: "Feedback", entityId: fb.id, metadata: { code: fb.code, from: fb.status, to: "WAITING_INFO" } }, tx);
  });
}

// ───────────── Phản hồi, duyệt kết quả ─────────────

export async function submitResponse(actor: Actor, id: string, input: { content: string; conclusion: string }) {
  assertCan(actor, "FEEDBACK_PROCESS");
  const fb = await getScopedFeedback(actor, id);
  if (!["ASSIGNED", "IN_PROGRESS"].includes(fb.status)) throw invalid("Chỉ soạn kết quả khi hồ sơ đang được xử lý.");
  const content = parse(responseText, input.content);
  const conclusion = parse(noteText, input.conclusion);
  const requireApproval = await getSetting("workflow.requireApproval");
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (requireApproval) {
      await tx.feedbackResponse.create({ data: { feedbackId: fb.id, kind: "ANSWER", content, status: "PENDING_APPROVAL", authorId: actor.id } });
      await tx.feedback.update({ where: { id: fb.id }, data: { status: "PENDING_APPROVAL", conclusion } });
      await recordStatus(tx, actor, fb, "PENDING_APPROVAL", `Trình duyệt kết quả giải quyết. Kết luận đề xuất: ${conclusion}`, null);
      const approvers = await eligibleRecipients(fb, ["FEEDBACK_APPROVE"], tx);
      await notify(approvers.filter((u) => u !== actor.id), {
        type: "PENDING_APPROVAL",
        feedbackId: fb.id,
        title: `Hồ sơ ${fb.code} chờ duyệt kết quả`,
        message: "Cán bộ xử lý đã trình kết quả giải quyết và nội dung trả lời, đề nghị xem xét, phê duyệt.",
      }, tx);
    } else {
      await tx.feedbackResponse.create({ data: { feedbackId: fb.id, kind: "ANSWER", content, status: "PUBLISHED", authorId: actor.id, approvedById: actor.id, approvedAt: now, publishedAt: now } });
      await tx.feedback.update({ where: { id: fb.id }, data: { status: "RESOLVED", conclusion, resolvedAt: now, closedAt: now, conclusionApprovedById: actor.id, publicUpdatedAt: now } });
      await recordStatus(tx, actor, fb, "RESOLVED", `Kết luận: ${conclusion}`, "Đơn vị đã có kết quả giải quyết (xem nội dung trả lời bên dưới).");
    }
    await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "feedback.response_submitted", entityType: "Feedback", entityId: fb.id, metadata: { code: fb.code } }, tx);
  });
}

export async function reviewResponse(actor: Actor, id: string, input: { responseId: string; approve: boolean; content?: string; reason?: string }) {
  assertCan(actor, "FEEDBACK_APPROVE");
  const fb = await getScopedFeedback(actor, id);
  if (fb.status !== "PENDING_APPROVAL") throw invalid("Hồ sơ không ở trạng thái chờ duyệt.");
  const resp = await prisma.feedbackResponse.findFirst({ where: { id: input.responseId, feedbackId: fb.id, status: "PENDING_APPROVAL" } });
  if (!resp) throw notFound("Không tìm thấy nội dung chờ duyệt.");
  const now = new Date();

  if (input.approve) {
    const content = input.content ? parse(responseText, input.content) : resp.content;
    await prisma.$transaction(async (tx) => {
      await tx.feedbackResponse.update({ where: { id: resp.id }, data: { status: "PUBLISHED", content, approvedById: actor.id, approvedAt: now, publishedAt: now } });
      await tx.feedback.update({ where: { id: fb.id }, data: { status: "RESOLVED", resolvedAt: now, closedAt: now, conclusionApprovedById: actor.id, publicUpdatedAt: now, needsLeaderReview: false } });
      await recordStatus(tx, actor, fb, "RESOLVED", `Phê duyệt kết quả giải quyết${content !== resp.content ? " (có chỉnh sửa nội dung trả lời)" : ""}.`, "Đơn vị đã có kết quả giải quyết (xem nội dung trả lời bên dưới).");
      await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "feedback.response_approved", entityType: "Feedback", entityId: fb.id, metadata: { code: fb.code, edited: content !== resp.content } }, tx);
      await notify([resp.authorId], { type: "APPROVED", feedbackId: fb.id, title: `Kết quả hồ sơ ${fb.code} đã được duyệt`, message: "Nội dung trả lời đã được công bố cho người gửi." }, tx);
    });
  } else {
    const reason = parse(reasonText, input.reason);
    await prisma.$transaction(async (tx) => {
      await tx.feedbackResponse.update({ where: { id: resp.id }, data: { status: "REJECTED", rejectReason: reason, approvedById: actor.id, approvedAt: now } });
      await tx.feedback.update({ where: { id: fb.id }, data: { status: "IN_PROGRESS" } });
      await recordStatus(tx, actor, fb, "IN_PROGRESS", `Trả lại kết quả, yêu cầu xử lý tiếp. Lý do: ${reason}`, null);
      await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "feedback.response_rejected", entityType: "Feedback", entityId: fb.id, metadata: { code: fb.code } }, tx);
      await notify([resp.authorId], { type: "REJECTED", feedbackId: fb.id, title: `Kết quả hồ sơ ${fb.code} bị trả lại`, message: `Lý do: ${reason}` }, tx);
    });
  }
}

// ───────────── Kết thúc không xử lý, chuyển đầu mối, mở lại ─────────────

export async function closeWithoutAction(actor: Actor, id: string, input: { reason: string; publicNote?: string }) {
  assertCan(actor, "FEEDBACK_CLOSE");
  const fb = await getScopedFeedback(actor, id);
  if (TERMINAL_STATUSES.includes(fb.status)) throw invalid("Hồ sơ đã kết thúc.");
  const reason = parse(reasonText, input.reason);
  const publicNote = parse(optionalNote, input.publicNote) ?? "Hồ sơ đã kết thúc theo quy định.";
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.feedback.update({ where: { id: fb.id }, data: { status: "CLOSED_NO_ACTION", closeReason: reason, closedAt: now, publicUpdatedAt: now } });
    await recordStatus(tx, actor, fb, "CLOSED_NO_ACTION", `Kết thúc không xử lý. Lý do: ${reason}`, publicNote);
    await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "feedback.closed", entityType: "Feedback", entityId: fb.id, metadata: { code: fb.code } }, tx);
  });
}

export async function transferFeedback(actor: Actor, id: string, input: { reason: string; target: string }) {
  assertCan(actor, "FEEDBACK_TRANSFER");
  const fb = await getScopedFeedback(actor, id);
  if (TERMINAL_STATUSES.includes(fb.status)) throw invalid("Hồ sơ đã kết thúc.");
  const reason = parse(reasonText, input.reason);
  const target = parse(noteText, input.target);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.feedback.update({ where: { id: fb.id }, data: { status: "TRANSFERRED", closeReason: `Chuyển: ${target}. ${reason}`, closedAt: now, publicUpdatedAt: now } });
    await recordStatus(tx, actor, fb, "TRANSFERRED", `Chuyển đầu mối có thẩm quyền: ${target}. Lý do: ${reason}`, "Ý kiến đã được chuyển đến cấp có thẩm quyền xem xét, giải quyết theo quy định.");
    await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "feedback.transferred", entityType: "Feedback", entityId: fb.id, metadata: { code: fb.code } }, tx);
  });
}

export async function reopenFeedback(actor: Actor, id: string, input: { reason: string }) {
  assertCan(actor, "FEEDBACK_APPROVE");
  const fb = await getScopedFeedback(actor, id);
  if (fb.status !== "RESOLVED" && fb.status !== "CLOSED_NO_ACTION") throw invalid("Chỉ mở lại hồ sơ đã giải quyết hoặc đã kết thúc.");
  const reason = parse(reasonText, input.reason);
  await prisma.$transaction(async (tx) => {
    await tx.feedback.update({ where: { id: fb.id }, data: { status: "IN_PROGRESS", resolvedAt: null, closedAt: null, publicUpdatedAt: new Date() } });
    await recordStatus(tx, actor, fb, "IN_PROGRESS", `Lãnh đạo mở lại hồ sơ. Lý do: ${reason}`, "Đơn vị tiếp tục xem xét, giải quyết ý kiến.");
    await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "feedback.reopened", entityType: "Feedback", entityId: fb.id, metadata: { code: fb.code } }, tx);
    await notify(await handlerRecipients(fb, tx), { type: "ASSIGNED", feedbackId: fb.id, title: `Hồ sơ ${fb.code} được mở lại`, message: `Lý do: ${reason}` }, tx);
  });
}

// ───────────── Ghi chú nội bộ, loại trừ truy cập ─────────────

export async function addInternalNote(actor: Actor, id: string, input: { content: string }) {
  assertCan(actor, "FEEDBACK_NOTE");
  const fb = await getScopedFeedback(actor, id);
  const content = parse(noteText, input.content);
  await prisma.$transaction(async (tx) => {
    await tx.internalNote.create({ data: { feedbackId: fb.id, authorId: actor.id, content } });
    await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "feedback.note_added", entityType: "Feedback", entityId: fb.id, metadata: { code: fb.code } }, tx);
  });
}

export async function restrictAccess(actor: Actor, id: string, input: { userId: string; reason: string }) {
  assertCan(actor, "FEEDBACK_RESTRICT");
  const fb = await getScopedFeedback(actor, id);
  const reason = parse(reasonText, input.reason);
  const user = await prisma.user.findFirst({ where: { id: input.userId }, select: { id: true, fullName: true, username: true } });
  if (!user) throw invalid("Tài khoản không hợp lệ.");
  await prisma.$transaction(async (tx) => {
    await tx.feedbackAccessRestriction.upsert({
      where: { feedbackId_userId: { feedbackId: fb.id, userId: user.id } },
      create: { feedbackId: fb.id, userId: user.id, reason, createdById: actor.id },
      update: {},
    });
    // Nếu người bị loại trừ đang được giao xử lý thì thu hồi phân công.
    if (fb.assignedUserId === user.id) {
      await tx.feedbackAssignment.updateMany({ where: { feedbackId: fb.id, isActive: true }, data: { isActive: false } });
      const back: FeedbackStatus = OPEN_STATUSES.includes(fb.status) ? "CLASSIFYING" : fb.status;
      await tx.feedback.update({ where: { id: fb.id }, data: { assignedUserId: null, status: back } });
      await recordStatus(tx, actor, fb, back, "Thu hồi phân công do người được giao thuộc diện loại trừ (xung đột lợi ích). Cần phân công lại.", null);
    }
    await tx.notification.deleteMany({ where: { feedbackId: fb.id, userId: user.id } });
    await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "feedback.restricted", entityType: "Feedback", entityId: fb.id, metadata: { code: fb.code, userId: user.id } }, tx);
  });
}

// Danh sách lựa chọn cho các biểu mẫu xử lý
export async function processingOptions(actor: Actor) {
  const demo = await getSetting("system.demoMode");
  const [categories, units, handlers, users, templates] = await Promise.all([
    prisma.feedbackCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.organizationalUnit.findMany({ where: { isActive: true, isHandlingUnit: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { isActive: true, isDemo: demo ? undefined : false, role: { permissions: { some: { permission: { code: { in: ["FEEDBACK_PROCESS", "FEEDBACK_VIEW_ALL"] } } } } } },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, rank: true, position: true, isIndependentContact: true, unit: { select: { name: true } }, role: { select: { code: true } } },
    }),
    can(actor, "FEEDBACK_RESTRICT")
      ? prisma.user.findMany({ where: { isActive: true }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, username: true, rank: true } })
      : Promise.resolve([]),
    prisma.responseTemplate.findMany({ where: { isActive: true, isApproved: true }, orderBy: { title: "asc" }, select: { id: true, title: true, content: true } }),
  ]);
  return { categories, units, handlers, users, templates };
}
