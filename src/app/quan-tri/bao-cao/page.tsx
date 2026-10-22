import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { requirePermission } from "@/server/session";
import { can } from "@/server/rbac";
import { buildReport } from "@/server/services/reports";
import { Card, PageHeader, Stat, cx } from "@/components/ui";
import { type PeriodKind, formatDate } from "@/lib/dates";
import { PERIOD_KINDS as KINDS, resolvePeriod } from "@/lib/report-period";

export const metadata = { title: "Báo cáo" };

export default async function ReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermission("REPORT_VIEW");
  const sp = await searchParams;
  const p = resolvePeriod(sp);
  const r = await buildReport(actor, { from: p.from, to: p.to });
  const qs = new URLSearchParams({ ky: p.kind, from: p.from, to: p.to }).toString();
  const s = r.summary;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Báo cáo tổng hợp"
        subtitle={`Kỳ báo cáo: ${formatDate(p.from + "T12:00:00+07:00")} – ${formatDate(p.to + "T12:00:00+07:00")}. Số liệu thật, trong phạm vi được phân quyền.`}
        actions={can(actor, "REPORT_EXPORT") && (
          <>
            <a className="btn-outline btn-sm" href={`/api/bao-cao/excel?${qs}`}><Download className="h-4 w-4" aria-hidden /> Xuất Excel</a>
            <Link className="btn-primary btn-sm" href={`/quan-tri/bao-cao/in?${qs}`}><Printer className="h-4 w-4" aria-hidden /> Bản in / PDF</Link>
          </>
        )}
      />
      <Card>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kỳ báo cáo">
            {(Object.keys(KINDS) as PeriodKind[]).map((k) => (
              <label key={k} className={cx("cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium", p.kind === k ? "border-brand-700 bg-brand-700 text-white" : "border-cream-200 bg-white")}>
                <input type="radio" name="ky" value={k} defaultChecked={p.kind === k} className="sr-only" />
                {KINDS[k]}
              </label>
            ))}
          </div>
          <div>
            <label className="label text-xs" htmlFor="from">Từ ngày (tùy chỉnh)</label>
            <input id="from" type="date" name="from" defaultValue={p.from} className="input py-1.5" />
          </div>
          <div>
            <label className="label text-xs" htmlFor="to">Đến ngày</label>
            <input id="to" type="date" name="to" defaultValue={p.to} className="input py-1.5" />
          </div>
          <button className="btn-olive btn-sm">Xem báo cáo</button>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="1. Tổng số tiếp nhận" value={s.total} tone="brand" />
        <Stat label="4. Đã giải quyết" value={s.resolved} tone="good" />
        <Stat label="5. Đang giải quyết" value={s.inProgress + s.newCount} tone="olive" />
        <Stat label="6. Quá hạn" value={s.overdue} tone="brand" />
        <Stat label="7. Tỷ lệ giải quyết" value={s.resolutionRate === null ? "—" : `${s.resolutionRate}%`} tone="good" />
        <Stat label="TG giải quyết TB" value={s.avgResolveDays === null ? "—" : `${s.avgResolveDays} ngày`} />
        <Stat label="Kết thúc không xử lý" value={s.closedNoAction} />
        <Stat label="Chuyển cấp có thẩm quyền" value={s.transferred} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="2. Số ý kiến theo loại" bodyClassName="p-0">
          <table className="table-base">
            <thead><tr><th>Loại ý kiến</th><th className="text-right">Số lượng</th></tr></thead>
            <tbody>{r.byType.map((t) => <tr key={t.name}><td>{t.name}</td><td className="text-right tabular-nums">{t.value}</td></tr>)}</tbody>
          </table>
        </Card>
        <Card title="3. Số ý kiến theo lĩnh vực" bodyClassName="p-0">
          <table className="table-base">
            <thead><tr><th>Lĩnh vực</th><th className="text-right">Số ý kiến</th><th className="text-right">Đã GQ</th><th className="text-right">Quá hạn</th></tr></thead>
            <tbody>
              {r.byCategory.length === 0 && <tr><td colSpan={4} className="text-center text-ink-muted">Không có dữ liệu</td></tr>}
              {r.byCategory.map((c) => <tr key={c.name}><td>{c.name}</td><td className="text-right tabular-nums">{c.value}</td><td className="text-right tabular-nums">{c.resolved}</td><td className="text-right tabular-nums">{c.overdue}</td></tr>)}
            </tbody>
          </table>
        </Card>
      </div>
      <Card title="8. Nhận xét tình hình (tự động ở mức số liệu tổng hợp)">
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">{r.narrative.map((l, i) => <li key={i}>{l}</li>)}</ul>
        <p className="mt-3 text-xs text-ink-muted">Người lập báo cáo có thể chỉnh sửa phần nhận xét trên bản in trước khi in/lưu PDF. Tỷ lệ giải quyết = đã giải quyết / (tổng − kết thúc không xử lý − chuyển cấp có thẩm quyền).</p>
      </Card>
    </div>
  );
}
