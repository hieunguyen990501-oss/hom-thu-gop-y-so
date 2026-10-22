import { requirePermission } from "@/server/session";
import { buildReport } from "@/server/services/reports";
import { logAudit } from "@/server/audit";
import { PrintButton } from "@/components/ui/client";
import { APP_NAME, UNIT_NAME } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/dates";
import { resolvePeriod } from "@/lib/report-period";

export const metadata = { title: "Bản in báo cáo" };

export default async function ReportPrintPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermission("REPORT_EXPORT");
  const p = resolvePeriod(await searchParams);
  const r = await buildReport(actor, { from: p.from, to: p.to });
  await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "export.report_print", metadata: { from: p.from, to: p.to } });
  const s = r.summary;
  const d = (x: string) => formatDate(x + "T12:00:00+07:00");
  return (
    <div className="mx-auto max-w-[800px] bg-white p-8 text-[14px] leading-relaxed text-black shadow-card print:p-0 print:shadow-none">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2 rounded-md border border-bronze-300 bg-bronze-50 p-3 text-sm">
        <span className="flex-1">Có thể bấm trực tiếp vào phần nhận xét để chỉnh sửa trước khi in. Chọn máy in “Lưu dưới dạng PDF” để xuất PDF.</span>
        <PrintButton />
      </div>
      <div className="grid grid-cols-2 text-center text-[13px]">
        <div>
          <p className="font-semibold uppercase">{UNIT_NAME.split("–")[0].trim()}</p>
          <p className="font-bold">{APP_NAME}</p>
        </div>
        <div>
          <p className="font-bold uppercase">Cộng hòa xã hội chủ nghĩa Việt Nam</p>
          <p className="font-semibold">Độc lập – Tự do – Hạnh phúc</p>
        </div>
      </div>
      <h1 className="mt-6 text-center text-lg font-bold uppercase">Báo cáo tổng hợp tình hình tiếp nhận, giải quyết ý kiến</h1>
      <p className="text-center italic">Từ ngày {d(p.from)} đến ngày {d(p.to)}</p>

      <h2 className="mt-5 font-bold">I. SỐ LIỆU TỔNG HỢP</h2>
      <table className="mt-2 w-full border-collapse text-[13px]">
        <tbody>
          {[
            ["1. Tổng số ý kiến tiếp nhận", s.total],
            ["4. Số đã giải quyết", s.resolved],
            ["5. Số đang giải quyết (kể cả mới tiếp nhận)", s.inProgress + s.newCount],
            ["6. Số quá hạn xử lý", s.overdue],
            ["7. Tỷ lệ giải quyết", s.resolutionRate === null ? "—" : `${s.resolutionRate}%`],
            ["Kết thúc không xử lý / chuyển cấp có thẩm quyền", `${s.closedNoAction} / ${s.transferred}`],
            ["Thời gian giải quyết trung bình", s.avgResolveDays === null ? "—" : `${s.avgResolveDays} ngày`],
          ].map(([k, v]) => (
            <tr key={String(k)}><td className="border border-black/40 px-2 py-1">{k}</td><td className="w-32 border border-black/40 px-2 py-1 text-right">{v}</td></tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-5 font-bold">2. Số ý kiến theo từng loại</h2>
      <table className="mt-2 w-full border-collapse text-[13px]">
        <tbody>{r.byType.map((t) => <tr key={t.name}><td className="border border-black/40 px-2 py-1">{t.name}</td><td className="w-32 border border-black/40 px-2 py-1 text-right">{t.value}</td></tr>)}</tbody>
      </table>

      <h2 className="mt-5 font-bold">3. Số ý kiến theo từng lĩnh vực</h2>
      <table className="mt-2 w-full border-collapse text-[13px]">
        <thead><tr><th className="border border-black/40 px-2 py-1 text-left">Lĩnh vực</th><th className="border border-black/40 px-2 py-1">Số ý kiến</th><th className="border border-black/40 px-2 py-1">Đã giải quyết</th><th className="border border-black/40 px-2 py-1">Quá hạn</th></tr></thead>
        <tbody>
          {r.byCategory.length === 0 && <tr><td colSpan={4} className="border border-black/40 px-2 py-1 text-center">Không có dữ liệu</td></tr>}
          {r.byCategory.map((c) => <tr key={c.name}><td className="border border-black/40 px-2 py-1">{c.name}</td><td className="border border-black/40 px-2 py-1 text-right">{c.value}</td><td className="border border-black/40 px-2 py-1 text-right">{c.resolved}</td><td className="border border-black/40 px-2 py-1 text-right">{c.overdue}</td></tr>)}
        </tbody>
      </table>

      <h2 className="mt-5 font-bold">II. NHẬN XÉT TÌNH HÌNH, VẤN ĐỀ NỔI BẬT</h2>
      <div contentEditable suppressContentEditableWarning className="mt-2 rounded outline-dashed outline-1 outline-bronze-300 print:outline-none">
        {r.narrative.map((l, i) => <p key={i} className="indent-8 text-justify">{l}</p>)}
      </div>

      <div className="mt-10 grid grid-cols-2 text-center">
        <div />
        <div>
          <p className="italic">........., ngày ..... tháng ..... năm .........</p>
          <p className="font-bold">NGƯỜI LẬP BÁO CÁO</p>
          <p className="mt-16 font-semibold">{r.generatedBy}</p>
        </div>
      </div>
      <p className="mt-8 text-[11px] italic text-black/60">Báo cáo lập tự động từ dữ liệu hệ thống lúc {formatDateTime(r.generatedAt)}. Không chứa nội dung chi tiết hay thông tin người gửi.</p>
    </div>
  );
}
