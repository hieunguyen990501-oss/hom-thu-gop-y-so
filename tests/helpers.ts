import { prisma } from "@/server/db";
import { seedCore } from "../prisma/seed-core";
import { hashSecret } from "@/server/auth/password";
import { loadActor, type Actor } from "@/server/rbac";
import { resetRateLimits } from "@/server/rate-limit";
import { submitFeedback } from "@/server/services/public-feedback";

export const TEST_PASSWORD = "Matkhau-Test-2026";
let pwHash: string | null = null;

// TRUNCATE không kích hoạt trigger theo dòng → dọn được cả bảng chỉ-ghi-thêm giữa các bài kiểm thử.
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "Notification","AuditLog","FeedbackAccessRestriction","InternalNote","FeedbackMessage","FeedbackResponse","FeedbackStatusHistory","FeedbackAssignment","FeedbackSender","Feedback","FeedbackCounter","Session","UserCategoryScope","User","SystemSetting","ResponseTemplate" CASCADE`,
  );
  await seedCore(prisma);
  resetRateLimits();
}

let n = 0;
export async function makeUser(roleCode: string, opts: { unitCode?: string; categoryCodes?: string[]; isDemo?: boolean; independent?: boolean } = {}): Promise<Actor> {
  pwHash ??= await hashSecret(TEST_PASSWORD);
  const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
  const unit = opts.unitCode ? await prisma.organizationalUnit.findUniqueOrThrow({ where: { code: opts.unitCode } }) : null;
  const cats = opts.categoryCodes ? await prisma.feedbackCategory.findMany({ where: { code: { in: opts.categoryCodes } } }) : [];
  n++;
  const u = await prisma.user.create({
    data: {
      username: `${roleCode.toLowerCase()}${n}`,
      fullName: `Cán bộ ${roleCode} ${n}`,
      roleId: role.id,
      unitId: unit?.id,
      passwordHash: pwHash,
      mustChangePassword: false,
      isDemo: !!opts.isDemo,
      isIndependentContact: !!opts.independent,
      categoryScopes: { create: cats.map((c) => ({ categoryId: c.id })) },
    },
  });
  return (await loadActor(u.id))!;
}

export async function category(code = "HC_BD") {
  return prisma.feedbackCategory.findUniqueOrThrow({ where: { code } });
}
export async function unit(code = "CQ_HCKT") {
  return prisma.organizationalUnit.findUniqueOrThrow({ where: { code } });
}

export async function submitSample(over: Record<string, unknown> = {}) {
  const cat = await category((over.categoryCode as string) ?? "HC_BD");
  const r = await submitFeedback({
    isAnonymous: true,
    type: "PHAN_ANH",
    categoryId: cat.id,
    title: "Bữa ăn sáng bị nguội",
    content: "Bữa ăn sáng thường bị nguội do chia suất quá sớm, đề nghị xem xét điều chỉnh thời gian.",
    acknowledge: true,
    ...over,
  });
  const fb = await prisma.feedback.findUniqueOrThrow({ where: { code: r.code } });
  return { ...r, id: fb.id };
}
