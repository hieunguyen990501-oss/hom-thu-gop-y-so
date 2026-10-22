import Link from "next/link";
import { requirePermission } from "@/server/session";
import { attentionLists, dashboardData } from "@/server/services/stats";
import { Card, EmptyState, PageHeader, PriorityBadge, Stat, StatusBadge } from "@/components/ui";
import { DonutChart, MonthlyChart, TrendChart, UnitChart } from "@/components/admin/charts";
import { AutoRefresh } from "@/components/admin/nav";
import { formatDate, formatDateTime, monthLabel } from "@/lib/dates";
import type { FeedbackStatus, Priority } from "@prisma/client";

export const metadata = { title: "Bảng điều hành" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermission("DASHBOARD_VIEW");
  const sp = await searchParams;
  const period = { from: sp.from && ISO.test(sp.from) ? sp.from : undefined, to: sp.to && ISO.test(sp.to) ? sp.to : undefined };
  const [d, att] = await Promise.all([dashboardData(actor, period), attentionLists(actor)]);
  const s = d.summary;

  let cr = 0;
  let cs = 0;
  const monthly = d.monthly.map((m) => ({ label: monthLabel(m.month), received: m.received, resolved: m.resolved, cumReceived: (cr += m.received), cumResolved: (cs += m.resolved) }));

  return (
    <div className="space-y-5">
      <AutoRefresh seconds={60} />
      <PageHeader
        title="Bảng điều hành"
        subtitle={`Số liệu thật trong phạm vi được phân quyền · cập nhật ${formatDateTime(d.generatedAt)} (tự làm mới mỗi phút)`}
        actions={
          <form className="flex flex-wrap items-end gap-2" method="get">
            <div>
              <label className="label text-xs" htmlFor="from">Từ ngày</label>
              <input id="from" type="date" name="from" defaultValue={period.from} className="input py-1.5" />
            </div>
            <div>
              <label className="label text-xs" htmlFor="to">Đến ngày</label>
              <input id="to" type="date" name="to" defaultValue={period.to} className="input py-1.5" />
            </div>
            <button className="btn-olive btn-sm">Lọc</button>
            {(period.from || period.to) && <Link href="/quan-tri/tong-quan" className="btn-ghost btn-sm">Bỏ lọc</Link>}
          </form>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Stat label="Tổng tiếp nhận" value={s.total} tone="brand" />
        <Stat label="Ý kiến mới" value={s.newCount} hint="Chưa phân loại" tone="warn" />
        <Stat label="Đang xử lý" value={s.inProgress} tone="olive" />
        <Stat label="Đã giải quyết" value={s.resolved} tone="good" />
        <Stat label="Quá hạn" value={s.overdue} tone="brand" />
        <Stat label="Tỷ lệ giải quyết" value={s.resolutionRate === null ? "—" : `${s.resolutionRate}%`} hint="Không tính KT không xử lý, đã chuyển" tone="good" />
        <Stat label="TG xử lý TB" value={s.avgResolveDays === null ? "—" : `${s.avgResolveDays} ngày`} tone="olive" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Số lượng góp ý theo tháng"><MonthlyChart data={monthly} /></Card>
        <Card title="Xu hướng tiếp nhận và giải quyết (lũy kế)"><TrendChart data={monthly} /></Card>
        <Card title="Tỷ lệ góp ý theo lĩnh vực"><DonutChart data={d.byCategory.map((c) => ({ name: c.name, value: c.value }))} /></Card>
        <Card title="Tỷ lệ hồ sơ theo trạng thái"><DonutChart colorBy="status" data={d.byStatus.map((x) => ({ name: x.name, value: x.value, key: x.status }))} /></Card>
      </div>
      <Card title="Tình hình giải quyết theo bộ phận được phân công"><UnitChart data={d.byUnit} /></Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <AttentionList title="Hồ sơ mới chưa được phân công" items={att.unassigned} href="/quan-tri/gop-y?view=unassigned" empty="Không có hồ sơ chờ phân công" />
        <AttentionList title="Hồ sơ sắp đến hạn" items={att.dueSoon} href="/quan-tri/gop-y?view=due_soon" empty="Không có hồ sơ sắp đến hạn" showDue />
        <AttentionList title="Hồ sơ quá hạn" items={att.overdue} href="/quan-tri/gop-y?view=overdue" empty="Không có hồ sơ quá hạn" showDue danger />
        <AttentionList title="Hồ sơ cần lãnh đạo xem xét, chờ duyệt" items={att.leader} href="/quan-tri/gop-y?view=pending_approval" empty="Không có hồ sơ chờ lãnh đạo" />
      </div>
      <p className="text-xs text-ink-muted">Bảng điều hành chỉ hiển thị số liệu tổng hợp, mã và tiêu đề hồ sơ; không công bố nội dung chi tiết hay thông tin người gửi.</p>
    </div>
  );
}

function AttentionList({ title, items, href, empty, showDue, danger }: {
  title: string; href: string; empty: string; showDue?: boolean; danger?: boolean;
  items: { id: string; code: string; title: string; dueAt: Date | null; createdAt: Date; status: FeedbackStatus; priority: Priority }[];
}) {
  return (
    <Card title={<span className={danger && items.length ? "text-brand-700" : ""}>{title} ({items.length}{items.length === 8 ? "+" : ""})</span>} actions={<Link href={href} className="link text-sm">Xem tất cả →</Link>} bodyClassName="p-0">
      {items.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ul className="divide-y divide-cream-100">
          {items.map((f) => (
            <li key={f.id}>
              <Link href={`/quan-tri/gop-y/${f.id}`} className="flex flex-wrap items-center gap-2 px-4 py-2.5 hover:bg-cream">
                <span className="font-mono text-xs font-semibold text-brand-700">{f.code}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{f.title}</span>
                {f.priority !== "NORMAL" && <PriorityBadge priority={f.priority} />}
                {showDue ? <span className={"text-xs " + (danger ? "font-semibold text-brand-700" : "text-ink-muted")}>Hạn {formatDate(f.dueAt)}</span> : <StatusBadge status={f.status} />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
