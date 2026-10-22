// Thông báo nội bộ hệ thống (không gửi email/SMS ra bên ngoài).
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import type { PermissionCode } from "@/lib/permissions";
import { getSetting } from "../settings";
import { DAY_MS } from "@/lib/dates";
import { OPEN_STATUSES } from "@/lib/constants";
import type { Actor } from "../rbac";

type Tx = Prisma.TransactionClient;

interface FeedbackRef {
  id: string;
  code: string;
  categoryId: string;
  isDemo: boolean;
  assignedUserId?: string | null;
  assignedUnitId?: string | null;
}

// Người dùng đang hoạt động có quyền, có phạm vi lĩnh vực phù hợp và không bị loại trừ khỏi hồ sơ.
export async function eligibleRecipients(feedback: FeedbackRef, perms: PermissionCode[], tx: Tx = prisma): Promise<string[]> {
  const users = await tx.user.findMany({
    where: {
      isActive: true,
      isDemo: feedback.isDemo ? undefined : false,
      role: { permissions: { some: { permission: { code: { in: perms } } } } },
      OR: [{ categoryScopes: { none: {} } }, { categoryScopes: { some: { categoryId: feedback.categoryId } } }],
      restrictions: { none: { feedbackId: feedback.id } },
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

// Người xử lý của hồ sơ: người được giao, hoặc cán bộ xử lý thuộc bộ phận được giao.
export async function handlerRecipients(feedback: FeedbackRef, tx: Tx = prisma): Promise<string[]> {
  if (feedback.assignedUserId) {
    const restricted = await tx.feedbackAccessRestriction.findFirst({ where: { feedbackId: feedback.id, userId: feedback.assignedUserId } });
    return restricted ? [] : [feedback.assignedUserId];
  }
  if (!feedback.assignedUnitId) return [];
  const users = await tx.user.findMany({
    where: {
      isActive: true,
      unitId: feedback.assignedUnitId,
      role: { permissions: { some: { permission: { code: "FEEDBACK_PROCESS" } } } },
      restrictions: { none: { feedbackId: feedback.id } },
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function notify(
  userIds: string[],
  n: { type: string; title: string; message: string; feedbackId?: string; dedupeKey?: (userId: string) => string },
  tx: Tx = prisma,
) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  await tx.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      type: n.type,
      title: n.title,
      message: n.message,
      feedbackId: n.feedbackId,
      dedupeKey: n.dedupeKey?.(userId),
    })),
    skipDuplicates: true,
  });
}

// Quét hạn xử lý: tạo thông báo "sắp đến hạn" và "quá hạn" (mỗi mốc chỉ báo một lần).
export async function runDeadlineScan(now = new Date()): Promise<{ dueSoon: number; overdue: number }> {
  const dueSoonDays = await getSetting("sla.dueSoonDays");
  const open = await prisma.feedback.findMany({
    where: { status: { in: OPEN_STATUSES }, dueAt: { not: null, lte: new Date(now.getTime() + dueSoonDays * DAY_MS) } },
    select: { id: true, code: true, categoryId: true, isDemo: true, assignedUserId: true, assignedUnitId: true, dueAt: true },
  });
  let dueSoon = 0;
  let overdue = 0;
  for (const f of open) {
    const isOverdue = f.dueAt! < now;
    const handlers = await handlerRecipients(f);
    const supervisors = await eligibleRecipients(f, isOverdue ? ["FEEDBACK_ASSIGN", "FEEDBACK_APPROVE"] : ["FEEDBACK_ASSIGN"]);
    const type = isOverdue ? "OVERDUE" : "DUE_SOON";
    const stamp = f.dueAt!.toISOString();
    await notify([...handlers, ...supervisors], {
      type,
      feedbackId: f.id,
      title: isOverdue ? `Hồ sơ ${f.code} đã quá hạn xử lý` : `Hồ sơ ${f.code} sắp đến hạn xử lý`,
      message: isOverdue ? "Hồ sơ đã quá hạn, đề nghị kiểm tra và đôn đốc." : "Hồ sơ sắp đến hạn, đề nghị hoàn thành đúng thời hạn.",
      dedupeKey: (uid) => `${type}:${f.id}:${uid}:${stamp}`,
    });
    if (isOverdue) overdue++;
    else dueSoon++;
  }
  return { dueSoon, overdue };
}

export async function listNotifications(actor: Actor, opts: { unreadOnly?: boolean; take?: number } = {}) {
  return prisma.notification.findMany({
    where: { userId: actor.id, ...(opts.unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 50,
    include: { feedback: { select: { id: true, code: true } } },
  });
}

export function unreadCount(actor: Actor) {
  return prisma.notification.count({ where: { userId: actor.id, isRead: false } });
}

export async function markRead(actor: Actor, id?: string) {
  await prisma.notification.updateMany({
    where: { userId: actor.id, isRead: false, ...(id ? { id } : {}) },
    data: { isRead: true },
  });
}
