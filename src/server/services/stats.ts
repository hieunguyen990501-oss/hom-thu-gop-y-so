// Thống kê cho bảng điều hành và báo cáo. Tính trên dữ liệu thật trong phạm vi được phép của tài khoản.
// Chỉ trả về số liệu tổng hợp, không trả nội dung góp ý hay thông tin người gửi.
import type { FeedbackStatus, FeedbackType } from "@prisma/client";
import { prisma } from "../db";
import { type Actor, assertCan, feedbackScopeWhere } from "../rbac";
import { getSetting } from "../settings";
import { DAY_MS, endOfVnDay, monthKey, monthsBetween, startOfVnDay } from "@/lib/dates";
import { FEEDBACK_TYPES, FEEDBACK_TYPE_LABELS, OPEN_STATUSES, STATUSES, STATUS_LABELS } from "@/lib/constants";

export interface StatsRow {
  id: string;
  createdAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  dueAt: Date | null;
  status: FeedbackStatus;
  type: FeedbackType;
  categoryId: string;
  assignedUnitId: string | null;
  satisfaction: string | null;
}

export interface Summary {
  total: number;
  newCount: number;
  inProgress: number;
  resolved: number;
  closedNoAction: number;
  transferred: number;
  overdue: number;
  resolutionRate: number | null; // %
  avgResolveDays: number | null;
  satisfaction: { SATISFIED: number; NEUTRAL: number; UNSATISFIED: number };
}

// Hàm thuần: tính chỉ số từ danh sách bản ghi — dùng chung cho dashboard, báo cáo và kiểm thử.
export function summarize(rows: StatsRow[], now = new Date()): Summary {
  const by = (s: FeedbackStatus) => rows.filter((r) => r.status === s).length;
  const resolvedRows = rows.filter((r) => r.status === "RESOLVED" && r.resolvedAt);
  const resolved = by("RESOLVED");
  const closedNoAction = by("CLOSED_NO_ACTION");
  const transferred = by("TRANSFERRED");
  const denominator = rows.length - closedNoAction - transferred;
  const avg = resolvedRows.length
    ? resolvedRows.reduce((s, r) => s + (r.resolvedAt!.getTime() - r.createdAt.getTime()), 0) / resolvedRows.length / DAY_MS
    : null;
  const sat = { SATISFIED: 0, NEUTRAL: 0, UNSATISFIED: 0 };
  for (const r of rows) if (r.satisfaction && r.satisfaction in sat) sat[r.satisfaction as keyof typeof sat]++;
  return {
    total: rows.length,
    newCount: by("NEW"),
    inProgress: rows.filter((r) => OPEN_STATUSES.includes(r.status) && r.status !== "NEW").length,
    resolved,
    closedNoAction,
    transferred,
    overdue: rows.filter((r) => isOverdue(r, now)).length,
    resolutionRate: denominator > 0 ? Math.round((resolved / denominator) * 1000) / 10 : null,
    avgResolveDays: avg === null ? null : Math.round(avg * 10) / 10,
    satisfaction: sat,
  };
}

export function isOverdue(r: Pick<StatsRow, "status" | "dueAt">, now = new Date()): boolean {
  return OPEN_STATUSES.includes(r.status) && !!r.dueAt && r.dueAt < now;
}

export interface Period {
  from?: string; // YYYY-MM-DD
  to?: string;
}

async function loadRows(actor: Actor, period: Period): Promise<StatsRow[]> {
  const demo = await getSetting("system.demoMode");
  const and = [feedbackScopeWhere(actor, demo)] as object[];
  if (period.from) and.push({ createdAt: { gte: startOfVnDay(period.from) } });
  if (period.to) and.push({ createdAt: { lte: endOfVnDay(period.to) } });
  return prisma.feedback.findMany({
    where: { AND: and },
    select: { id: true, createdAt: true, resolvedAt: true, closedAt: true, dueAt: true, status: true, type: true, categoryId: true, assignedUnitId: true, satisfaction: true },
  });
}

export async function dashboardData(actor: Actor, period: Period) {
  assertCan(actor, "DASHBOARD_VIEW");
  const now = new Date();
  const rows = await loadRows(actor, period);
  const summary = summarize(rows, now);
  const [categories, units] = await Promise.all([
    prisma.feedbackCategory.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    prisma.organizationalUnit.findMany({ where: { isHandlingUnit: true }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  // Chuỗi theo tháng: nếu không chọn khoảng thời gian thì lấy 12 tháng gần nhất.
  const from = period.from ? startOfVnDay(period.from) : new Date(now.getTime() - 334 * DAY_MS);
  const to = period.to ? endOfVnDay(period.to) : now;
  const months = monthsBetween(from, to).slice(-24);
  const monthly = months.map((m) => ({
    month: m,
    received: rows.filter((r) => monthKey(r.createdAt) === m).length,
    resolved: rows.filter((r) => r.resolvedAt && r.status === "RESOLVED" && monthKey(r.resolvedAt) === m).length,
  }));

  const byCategory = categories
    .map((c) => ({ id: c.id, name: c.name, value: rows.filter((r) => r.categoryId === c.id).length }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  const byStatus = STATUSES.map((s) => ({ status: s, name: STATUS_LABELS[s], value: rows.filter((r) => r.status === s).length })).filter((s) => s.value > 0);
  const byType = FEEDBACK_TYPES.map((t) => ({ type: t, name: FEEDBACK_TYPE_LABELS[t], value: rows.filter((r) => r.type === t).length }));

  const byUnit = units
    .map((u) => {
      const ur = rows.filter((r) => r.assignedUnitId === u.id);
      return {
        name: u.name,
        total: ur.length,
        resolved: ur.filter((r) => r.status === "RESOLVED").length,
        processing: ur.filter((r) => OPEN_STATUSES.includes(r.status)).length,
        overdue: ur.filter((r) => isOverdue(r, now)).length,
      };
    })
    .filter((u) => u.total > 0);

  return { summary, monthly, byCategory, byStatus, byType, byUnit, generatedAt: now };
}

// Danh sách cần chú ý: chỉ trả mã, tiêu đề, hạn — không trả nội dung chi tiết.
export async function attentionLists(actor: Actor) {
  assertCan(actor, "DASHBOARD_VIEW");
  const demo = await getSetting("system.demoMode");
  const dueSoonDays = await getSetting("sla.dueSoonDays");
  const scope = feedbackScopeWhere(actor, demo);
  const now = new Date();
  const select = { id: true, code: true, title: true, dueAt: true, createdAt: true, status: true, priority: true } as const;
  const [unassigned, dueSoon, overdue, leader] = await Promise.all([
    prisma.feedback.findMany({ where: { AND: [scope, { status: { in: ["NEW", "CLASSIFYING"] }, assignedUnitId: null, assignedUserId: null }] }, orderBy: { createdAt: "asc" }, take: 8, select }),
    prisma.feedback.findMany({ where: { AND: [scope, { status: { in: OPEN_STATUSES }, dueAt: { gte: now, lte: new Date(now.getTime() + dueSoonDays * DAY_MS) } }] }, orderBy: { dueAt: "asc" }, take: 8, select }),
    prisma.feedback.findMany({ where: { AND: [scope, { status: { in: OPEN_STATUSES }, dueAt: { lt: now } }] }, orderBy: { dueAt: "asc" }, take: 8, select }),
    prisma.feedback.findMany({ where: { AND: [scope, { OR: [{ status: "PENDING_APPROVAL" }, { needsLeaderReview: true, status: { in: OPEN_STATUSES } }] }] }, orderBy: { createdAt: "asc" }, take: 8, select }),
  ]);
  return { unassigned, dueSoon, overdue, leader };
}

export { loadRows };
