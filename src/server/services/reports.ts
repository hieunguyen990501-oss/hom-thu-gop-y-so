// Báo cáo tổng hợp theo kỳ và xuất Excel. Mọi thao tác xuất đều ghi nhật ký kiểm toán.
import ExcelJS from "exceljs";
import { prisma } from "../db";
import { type Actor, assertCan } from "../rbac";
import { logAudit } from "../audit";
import { invalid } from "../errors";
import { loadRows, summarize, isOverdue, type Period } from "./stats";
import { buildListWhere, type ListFilters } from "./feedback-admin";
import {
  APP_NAME,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  UNIT_NAME,
} from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/dates";

export async function buildReport(actor: Actor, period: Required<Period>) {
  assertCan(actor, "REPORT_VIEW");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period.from) || !/^\d{4}-\d{2}-\d{2}$/.test(period.to) || period.from > period.to)
    throw invalid("Khoảng thời gian báo cáo không hợp lệ.");
  const now = new Date();
  const rows = await loadRows(actor, period);
  const summary = summarize(rows, now);
  const categories = await prisma.feedbackCategory.findMany({ select: { id: true, name: true }, orderBy: { sortOrder: "asc" } });

  const byType = FEEDBACK_TYPES.map((t) => ({ name: FEEDBACK_TYPE_LABELS[t], value: rows.filter((r) => r.type === t).length }));
  const byCategory = categories
    .map((c) => {
      const cr = rows.filter((r) => r.categoryId === c.id);
      return {
        name: c.name,
        value: cr.length,
        resolved: cr.filter((r) => r.status === "RESOLVED").length,
        overdue: cr.filter((r) => isOverdue(r, now)).length,
      };
    })
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

  return { period, summary, byType, byCategory, narrative: narrative(summary, byCategory, byType), generatedAt: now, generatedBy: actor.fullName };
}

// Nhận xét tự động ở mức số liệu tổng hợp (người lập báo cáo có thể chỉnh sửa trước khi in).
export function narrative(
  s: ReturnType<typeof summarize>,
  byCategory: { name: string; value: number; overdue: number }[],
  byType: { name: string; value: number }[],
): string[] {
  if (s.total === 0) return ["Trong kỳ báo cáo, hệ thống chưa tiếp nhận ý kiến góp ý nào."];
  const lines: string[] = [];
  lines.push(
    `Trong kỳ, hệ thống tiếp nhận ${s.total} ý kiến; đã giải quyết ${s.resolved}, đang xem xét, giải quyết ${s.inProgress + s.newCount}` +
      (s.closedNoAction ? `, kết thúc không xử lý ${s.closedNoAction}` : "") +
      (s.transferred ? `, chuyển cấp có thẩm quyền ${s.transferred}` : "") +
      ".",
  );
  if (s.resolutionRate !== null) lines.push(`Tỷ lệ giải quyết đạt ${s.resolutionRate}%${s.avgResolveDays !== null ? `; thời gian giải quyết trung bình ${s.avgResolveDays} ngày` : ""}.`);
  const topType = [...byType].sort((a, b) => b.value - a.value)[0];
  if (topType?.value) lines.push(`Loại ý kiến nhiều nhất: ${topType.name.toLowerCase()} (${topType.value} ý kiến, ${Math.round((topType.value / s.total) * 100)}%).`);
  const top = byCategory.slice(0, 3).filter((c) => c.value > 0);
  if (top.length) lines.push(`Các lĩnh vực có nhiều ý kiến: ${top.map((c) => `${c.name.toLowerCase()} (${c.value})`).join("; ")}. Đề nghị các cơ quan chức năng quan tâm rà soát nguyên nhân ở các lĩnh vực này.`);
  if (s.overdue > 0) {
    const od = byCategory.filter((c) => c.overdue > 0).map((c) => c.name.toLowerCase());
    lines.push(`Còn ${s.overdue} hồ sơ quá hạn xử lý${od.length ? ` (tập trung ở: ${od.join(", ")})` : ""}; đề nghị bộ phận được phân công khẩn trương giải quyết, báo cáo kết quả.`);
  } else lines.push("Không có hồ sơ quá hạn xử lý.");
  const rated = s.satisfaction.SATISFIED + s.satisfaction.NEUTRAL + s.satisfaction.UNSATISFIED;
  if (rated > 0) lines.push(`Có ${rated} lượt đánh giá sau giải quyết: hài lòng ${s.satisfaction.SATISFIED}, bình thường ${s.satisfaction.NEUTRAL}, chưa hài lòng ${s.satisfaction.UNSATISFIED}.`);
  return lines;
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7A1F1F" } };
    c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });
}

export async function reportToExcel(actor: Actor, period: Required<Period>): Promise<Buffer> {
  assertCan(actor, "REPORT_EXPORT");
  const r = await buildReport(actor, period);
  const wb = new ExcelJS.Workbook();
  wb.creator = APP_NAME;
  const ws = wb.addWorksheet("Báo cáo tổng hợp");
  ws.columns = [{ width: 6 }, { width: 46 }, { width: 16 }, { width: 16 }, { width: 16 }];
  ws.addRow([UNIT_NAME]).font = { bold: true };
  ws.addRow([`BÁO CÁO TỔNG HỢP ${APP_NAME}`]).font = { bold: true, size: 14 };
  ws.addRow([`Từ ngày ${formatDate(period.from + "T00:00:00+07:00")} đến ngày ${formatDate(period.to + "T00:00:00+07:00")}`]);
  ws.addRow([`Lập lúc ${formatDateTime(r.generatedAt)} – người lập: ${r.generatedBy}`]).font = { italic: true };
  ws.addRow([]);
  styleHeader(ws.addRow(["TT", "Chỉ tiêu", "Số lượng"]));
  const s = r.summary;
  const items: [string, string | number][] = [
    ["Tổng số ý kiến tiếp nhận", s.total],
    ["Đã giải quyết", s.resolved],
    ["Đang giải quyết (kể cả mới tiếp nhận)", s.inProgress + s.newCount],
    ["Kết thúc không xử lý", s.closedNoAction],
    ["Chuyển cấp có thẩm quyền", s.transferred],
    ["Quá hạn xử lý", s.overdue],
    ["Tỷ lệ giải quyết (%)", s.resolutionRate ?? "—"],
    ["Thời gian giải quyết trung bình (ngày)", s.avgResolveDays ?? "—"],
  ];
  items.forEach(([k, v], i) => ws.addRow([i + 1, k, v]));
  ws.addRow([]);
  styleHeader(ws.addRow(["TT", "Loại ý kiến", "Số lượng"]));
  r.byType.forEach((t, i) => ws.addRow([i + 1, t.name, t.value]));
  ws.addRow([]);
  styleHeader(ws.addRow(["TT", "Lĩnh vực", "Số ý kiến", "Đã giải quyết", "Quá hạn"]));
  r.byCategory.forEach((c, i) => ws.addRow([i + 1, c.name, c.value, c.resolved, c.overdue]));
  ws.addRow([]);
  ws.addRow(["", "NHẬN XÉT"]).font = { bold: true };
  r.narrative.forEach((l) => {
    const row = ws.addRow(["", l]);
    row.alignment = { wrapText: true, vertical: "top" };
  });
  ws.addRow([]);
  ws.addRow(["", "Ghi chú: Tỷ lệ giải quyết = số đã giải quyết / (tổng số − kết thúc không xử lý − chuyển cấp có thẩm quyền)."]).font = { italic: true, size: 9 };

  await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "export.report_excel", metadata: { from: period.from, to: period.to } });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Xuất danh sách hồ sơ theo bộ lọc. Không bao gồm nội dung chi tiết và thông tin người gửi.
export async function feedbackListToExcel(actor: Actor, filters: ListFilters): Promise<Buffer> {
  assertCan(actor, "REPORT_EXPORT");
  const where = await buildListWhere(actor, filters);
  const items = await prisma.feedback.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      code: true, createdAt: true, type: true, title: true, priority: true, status: true, dueAt: true, resolvedAt: true,
      category: { select: { name: true } }, assignedUnit: { select: { name: true } }, assignedUser: { select: { fullName: true } },
    },
  });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Danh sách hồ sơ");
  ws.columns = [
    { header: "Mã hồ sơ", width: 20 }, { header: "Thời gian gửi", width: 18 }, { header: "Loại ý kiến", width: 20 },
    { header: "Lĩnh vực", width: 28 }, { header: "Tiêu đề", width: 50 }, { header: "Mức ưu tiên", width: 14 },
    { header: "Trạng thái", width: 24 }, { header: "Phụ trách", width: 30 }, { header: "Hạn xử lý", width: 14 }, { header: "Ngày giải quyết", width: 14 },
  ];
  styleHeader(ws.getRow(1));
  for (const f of items) {
    ws.addRow([
      f.code, formatDateTime(f.createdAt), FEEDBACK_TYPE_LABELS[f.type], f.category.name, f.title, PRIORITY_LABELS[f.priority],
      STATUS_LABELS[f.status], [f.assignedUser?.fullName, f.assignedUnit?.name].filter(Boolean).join(" – "), formatDate(f.dueAt), formatDate(f.resolvedAt),
    ]);
  }
  await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "export.feedback_list", metadata: { count: items.length, filters: JSON.parse(JSON.stringify(filters)) } });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
