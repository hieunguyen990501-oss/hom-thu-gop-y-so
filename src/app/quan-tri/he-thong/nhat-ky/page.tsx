import { requirePermission } from "@/server/session";
import { listAuditLogs } from "@/server/services/admin";
import { AUDIT_ACTION_LABELS } from "@/server/audit";
import { Card, EmptyState, PageHeader, Pagination } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";

export const metadata = { title: "Nhật ký hệ thống" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermission("ADMIN_AUDIT");
  const sp = await searchParams;
  const res = await listAuditLogs(actor, { action: sp.action, q: sp.q, page: Number(sp.page) || 1 });
  const href = (p: number) => `/quan-tri/he-thong/nhat-ky?${new URLSearchParams({ ...(sp.action ? { action: sp.action } : {}), ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`;
  return (
    <div className="space-y-4">
      <PageHeader title="Nhật ký hệ thống" subtitle={`${res.total} bản ghi. Nhật ký chỉ ghi thêm; cơ sở dữ liệu chặn mọi thao tác sửa, xóa.`} />
      <Card>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label text-xs" htmlFor="action">Loại thao tác</label>
            <select id="action" name="action" defaultValue={sp.action ?? ""} className="input py-2">
              <option value="">Tất cả</option>
              {Object.entries(AUDIT_ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs" htmlFor="q">Tài khoản / mã đối tượng</label>
            <input id="q" name="q" defaultValue={sp.q} className="input py-2" maxLength={60} />
          </div>
          <button className="btn-olive btn-sm">Lọc</button>
        </form>
      </Card>
      <Card bodyClassName="p-0">
        {res.items.length === 0 ? <EmptyState /> : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Thời gian</th><th>Tài khoản</th><th>Thao tác</th><th>Đối tượng</th><th>Chi tiết</th><th>Địa chỉ</th></tr></thead>
              <tbody>
                {res.items.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap text-xs">{formatDateTime(l.createdAt)}</td>
                    <td className="text-xs">{l.actor?.fullName ?? "—"}<br /><span className="font-mono text-ink-muted">{l.actorLabel}</span></td>
                    <td className="text-xs font-semibold">{AUDIT_ACTION_LABELS[l.action] ?? l.action}</td>
                    <td className="font-mono text-xs">{l.entityType ? `${l.entityType}` : "—"}</td>
                    <td className="max-w-[360px] break-words font-mono text-[11px] text-ink-muted">{l.metadata ? JSON.stringify(l.metadata) : ""}</td>
                    <td className="font-mono text-xs text-ink-muted">{l.ipAddress ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 pb-4"><Pagination page={res.page} pages={res.pages} makeHref={href} /></div>
      </Card>
    </div>
  );
}
