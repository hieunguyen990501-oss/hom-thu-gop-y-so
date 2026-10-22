// Kiểm thử 11–12: hồ sơ quá hạn, thống kê đúng dữ liệu; thông báo hạn xử lý; báo cáo, xuất Excel.
import { beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { prisma } from "@/server/db";
import * as svc from "@/server/services/feedback-admin";
import { attentionLists, dashboardData, summarize } from "@/server/services/stats";
import { buildReport, feedbackListToExcel, reportToExcel } from "@/server/services/reports";
import { runDeadlineScan } from "@/server/services/notifications";
import { periodRange, toVnIsoDate } from "@/lib/dates";
import { makeUser, resetDb, submitSample } from "./helpers";

beforeEach(resetDb);

const DAY = 86_400_000;

async function scenario() {
  const receiver = await makeUser("RECEIVER");
  const handler = await makeUser("HANDLER", { unitCode: "CQ_HCKT" });
  const leader = await makeUser("LEADER");
  const ids: string[] = [];
  for (let i = 0; i < 6; i++) ids.push((await submitSample({ categoryCode: i < 4 ? "HC_BD" : "VH_TT" })).id);
  // 0: NEW; 1: overdue đang xử lý; 2: resolved sau 4 ngày; 3: closed no action; 4: due soon; 5: transferred
  await svc.assignFeedback(receiver, ids[1], { userId: handler.id });
  await prisma.feedback.update({ where: { id: ids[1] }, data: { dueAt: new Date(Date.now() - 2 * DAY) } });
  await svc.assignFeedback(receiver, ids[2], { userId: handler.id });
  await svc.submitResponse(handler, ids[2], { content: "Đã giải quyết dứt điểm nội dung.", conclusion: "Xong" });
  const resp = await prisma.feedbackResponse.findFirstOrThrow({ where: { feedbackId: ids[2] } });
  await svc.reviewResponse(leader, ids[2], { responseId: resp.id, approve: true });
  const created2 = (await prisma.feedback.findUniqueOrThrow({ where: { id: ids[2] } })).createdAt;
  await prisma.feedback.update({ where: { id: ids[2] }, data: { resolvedAt: new Date(created2.getTime() + 4 * DAY) } });
  await svc.closeWithoutAction(receiver, ids[3], { reason: "Không thuộc phạm vi tiếp nhận của hệ thống" });
  await svc.assignFeedback(receiver, ids[4], { userId: handler.id });
  await prisma.feedback.update({ where: { id: ids[4] }, data: { dueAt: new Date(Date.now() + 1 * DAY) } });
  await svc.transferFeedback(receiver, ids[5], { target: "Cấp trên", reason: "Thuộc thẩm quyền cấp trên giải quyết" });
  return { receiver, handler, leader, ids };
}

describe("Thống kê", () => {
  it("[11][12] dashboard tính đúng tổng, quá hạn, tỷ lệ, thời gian trung bình", async () => {
    const { leader, ids } = await scenario();
    const d = await dashboardData(leader, {});
    expect(d.summary.total).toBe(6);
    expect(d.summary.newCount).toBe(1);
    expect(d.summary.resolved).toBe(1);
    expect(d.summary.closedNoAction).toBe(1);
    expect(d.summary.transferred).toBe(1);
    expect(d.summary.inProgress).toBe(2); // ids[1], ids[4]
    expect(d.summary.overdue).toBe(1);
    // Tỷ lệ = 1 / (6 - 1 - 1) = 25%
    expect(d.summary.resolutionRate).toBe(25);
    expect(d.summary.avgResolveDays).toBe(4);
    expect(d.byCategory.find((c) => c.name.startsWith("Hậu cần"))?.value).toBe(4);
    expect(d.byStatus.reduce((s, x) => s + x.value, 0)).toBe(6);
    expect(d.monthly.at(-1)!.received).toBe(6);

    const att = await attentionLists(leader);
    expect(att.overdue.map((x) => x.id)).toEqual([ids[1]]);
    expect(att.dueSoon.map((x) => x.id)).toEqual([ids[4]]);
    expect(att.unassigned.map((x) => x.id)).toEqual([ids[0]]);
    // Danh sách cần chú ý không trả nội dung chi tiết
    expect(JSON.stringify(att)).not.toContain("chia suất");
  });

  it("hàm tổng hợp thuần: không có dữ liệu thì tỷ lệ là null", () => {
    const s = summarize([]);
    expect(s.total).toBe(0);
    expect(s.resolutionRate).toBeNull();
    expect(s.avgResolveDays).toBeNull();
  });

  it("[11] quét hạn xử lý tạo thông báo sắp đến hạn/quá hạn, không lặp lại", async () => {
    const { handler, receiver, leader } = await scenario();
    const r1 = await runDeadlineScan();
    expect(r1).toEqual({ dueSoon: 1, overdue: 1 });
    expect(await prisma.notification.count({ where: { userId: handler.id, type: "OVERDUE" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: handler.id, type: "DUE_SOON" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: leader.id, type: "OVERDUE" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: receiver.id, type: "OVERDUE" } })).toBe(1);
    const before = await prisma.notification.count();
    await runDeadlineScan();
    expect(await prisma.notification.count()).toBe(before);
    // Lọc danh sách quá hạn
    expect((await svc.listFeedback(receiver, { view: "overdue" })).total).toBe(1);
  });
});

describe("Báo cáo", () => {
  it("báo cáo theo kỳ dùng dữ liệu thật, có nhận xét tổng hợp", async () => {
    const { leader } = await scenario();
    const p = periodRange("month");
    const r = await buildReport(leader, p);
    expect(r.summary.total).toBe(6);
    expect(r.byType.reduce((s, t) => s + t.value, 0)).toBe(6);
    expect(r.narrative.join(" ")).toContain("tiếp nhận 6 ý kiến");
    expect(r.narrative.join(" ")).toContain("quá hạn");
    // Kỳ không có dữ liệu
    const empty = await buildReport(leader, { from: "2020-01-01", to: "2020-01-31" });
    expect(empty.summary.total).toBe(0);
    await expect(buildReport(leader, { from: "2026-02-01", to: "2026-01-01" })).rejects.toThrow(/không hợp lệ/);
  });

  it("xuất Excel hợp lệ, có quyền mới xuất được và được ghi nhật ký", async () => {
    const { leader, handler } = await scenario();
    const p = periodRange("month");
    const buf = await reportToExcel(leader, p);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const values = ws.getSheetValues().flat().map(String).join("|");
    expect(values).toContain("Tổng số ý kiến tiếp nhận");
    expect(values).toContain("6");
    await expect(reportToExcel(handler, p)).rejects.toThrow(/không có quyền/);

    const list = await feedbackListToExcel(leader, {});
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(list as unknown as ArrayBuffer);
    expect(wb2.worksheets[0].rowCount).toBe(7);
    expect(await prisma.auditLog.count({ where: { action: { startsWith: "export." } } })).toBe(2);
    expect(toVnIsoDate(new Date())).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
