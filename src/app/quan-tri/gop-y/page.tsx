import Link from "next/link";
import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { requirePermission } from "@/server/session";
import { can } from "@/server/rbac";
import { listFeedback, processingOptions } from "@/server/services/feedback-admin";
import { Card, DemoBadge, EmptyState, PageHeader, Pagination, PriorityBadge, StatusBadge, cx } from "@/components/ui";
import { FEEDBACK_TYPES, FEEDBACK_TYPE_LABELS, OPEN_STATUSES, PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/dates";

export const metadata = { title: "Hồ sơ góp ý" };

const VIEWS: Record<string, string> = {
  "": "Tất cả",
  mine: "Được giao cho tôi",
  unassigned: "Chưa phân công",
  due_soon: "Sắp đến hạn",
  overdue: "Quá hạn",
  pending_approval: "Chờ duyệt",
  leader_review: "Cần lãnh đạo xem xét",
};

export default async function FeedbackListPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requirePermission(["FEEDBACK_VIEW_ALL", "FEEDBACK_VIEW_ASSIGNED"]);
  const sp = await searchParams;
  const filters = { q: sp.q, status: sp.status, type: sp.type, categoryId: sp.categoryId, priority: sp.priority, from: sp.from, to: sp.to, view: sp.view, sort: sp.sort, dir: sp.dir, page: Number(sp.page) || 1 };
  const [res, opts] = await Promise.all([listFeedback(actor, filters), processingOptions(actor)]);
  const now = new Date();

  const qs = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, ...patch })) if (v !== undefined && v !== "" && !(k === "page" && v === 1)) p.set(k, String(v));
    const s = p.toString();
    return `/quan-tri/gop-y${s ? "?" + s : ""}`;
  };
  const sortLink = (field: string, label: string) => {
    const active = (filters.sort ?? "createdAt") === field;
    const nextDir = active && filters.dir !== "asc" ? "asc" : "desc";
    return (
      <Link href={qs({ sort: field, dir: nextDir, page: 1 })} className="inline-flex items-center gap-1 hover:text-brand-700">
        {label}
        {active && (filters.dir === "asc" ? <ArrowUp className="h-3 w-3" aria-label="tăng dần" /> : <ArrowDown className="h-3 w-3" aria-label="giảm dần" />)}
      </Link>
    );
  };
  const exportHref = `/api/gop-y/xuat-excel?${new URLSearchParams(Object.entries(filters).filter(([k, v]) => v && k !== "page").map(([k, v]) => [k, String(v)])).toString()}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Hồ sơ góp ý"
        subtitle={`${res.total} hồ sơ trong phạm vi được phân quyền. Danh sách không hiển thị thông tin người gửi.`}
        actions={can(actor, "REPORT_EXPORT") && (
          <a href={exportHref} className="btn-outline btn-sm"><Download className="h-4 w-4" aria-hidden /> Xuất Excel</a>
        )}
      />

      <nav className="flex flex-wrap gap-1.5" aria-label="Lọc nhanh">
        {Object.entries(VIEWS).map(([k, label]) => (
          <Link key={k} href={qs({ view: k || undefined, page: 1 })} className={cx("rounded-full border px-3 py-1.5 text-sm font-medium", (filters.view ?? "") === k ? "border-brand-700 bg-brand-700 text-white" : "border-cream-200 bg-white hover:border-bronze-300")}>
            {label}
          </Link>
        ))}
      </nav>

      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {filters.view && <input type="hidden" name="view" value={filters.view} />}
          <div className="sm:col-span-2">
            <label className="label text-xs" htmlFor="q">Tìm kiếm</label>
            <input id="q" name="q" defaultValue={filters.q} className="input py-2" placeholder="Mã hồ sơ hoặc tiêu đề" maxLength={100} />
          </div>
          <div>
            <label className="label text-xs" htmlFor="status">Trạng thái</label>
            <select id="status" name="status" defaultValue={filters.status ?? ""} className="input py-2">
              <option value="">Tất cả</option>
              <option value="OPEN">— Đang mở —</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs" htmlFor="type">Loại ý kiến</label>
            <select id="type" name="type" defaultValue={filters.type ?? ""} className="input py-2">
              <option value="">Tất cả</option>
              {FEEDBACK_TYPES.map((t) => <option key={t} value={t}>{FEEDBACK_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs" htmlFor="categoryId">Lĩnh vực</label>
            <select id="categoryId" name="categoryId" defaultValue={filters.categoryId ?? ""} className="input py-2">
              <option value="">Tất cả</option>
              {opts.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs" htmlFor="priority">Ưu tiên</label>
            <select id="priority" name="priority" defaultValue={filters.priority ?? ""} className="input py-2">
              <option value="">Tất cả</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs" htmlFor="from">Từ ngày</label>
            <input id="from" type="date" name="from" defaultValue={filters.from} className="input py-2" />
          </div>
          <div>
            <label className="label text-xs" htmlFor="to">Đến ngày</label>
            <input id="to" type="date" name="to" defaultValue={filters.to} className="input py-2" />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4 xl:col-span-8">
            <button className="btn-olive btn-sm">Lọc</button>
            <Link href="/quan-tri/gop-y" className="btn-ghost btn-sm">Xóa bộ lọc</Link>
          </div>
        </form>
      </Card>

      <Card bodyClassName="p-0">
        {res.items.length === 0 ? (
          <EmptyState title="Không có hồ sơ phù hợp">Thử thay đổi bộ lọc hoặc khoảng thời gian.</EmptyState>
        ) : (
          <>
            {/* Bảng cho màn hình rộng */}
            <div className="hidden overflow-x-auto md:block">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>{sortLink("code", "Mã hồ sơ")}</th>
                    <th>{sortLink("createdAt", "Thời gian gửi")}</th>
                    <th>Loại ý kiến</th>
                    <th>Lĩnh vực</th>
                    <th>Tiêu đề</th>
                    <th>{sortLink("priority", "Ưu tiên")}</th>
                    <th>{sortLink("status", "Trạng thái")}</th>
                    <th>Phụ trách</th>
                    <th>{sortLink("dueAt", "Hạn xử lý")}</th>
                    <th><span className="sr-only">Thao tác</span></th>
                  </tr>
                </thead>
                <tbody>
                  {res.items.map((f) => {
                    const overdue = OPEN_STATUSES.includes(f.status) && f.dueAt && f.dueAt < now;
                    return (
                      <tr key={f.id} className="hover:bg-cream">
                        <td className="whitespace-nowrap font-mono text-xs font-semibold">{f.code} {f.isDemo && <DemoBadge />}</td>
                        <td className="whitespace-nowrap text-xs">{formatDateTime(f.createdAt)}</td>
                        <td className="whitespace-nowrap">{FEEDBACK_TYPE_LABELS[f.type]}</td>
                        <td>{f.category.name}</td>
                        <td className="max-w-[280px]"><Link href={`/quan-tri/gop-y/${f.id}`} className="link line-clamp-2">{f.title}</Link></td>
                        <td><PriorityBadge priority={f.priority} /></td>
                        <td><StatusBadge status={f.status} /></td>
                        <td className="text-xs">{[f.assignedUser && `${f.assignedUser.rank ?? ""} ${f.assignedUser.fullName}`.trim(), f.assignedUnit?.name].filter(Boolean).join(" – ") || <span className="text-ink-muted">Chưa phân công</span>}</td>
                        <td className={cx("whitespace-nowrap text-xs", overdue && "font-bold text-brand-700")}>{formatDate(f.dueAt)}{overdue && " (quá hạn)"}</td>
                        <td><Link href={`/quan-tri/gop-y/${f.id}`} className="btn-outline btn-sm">Xem</Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Thẻ cho điện thoại */}
            <ul className="divide-y divide-cream-100 md:hidden">
              {res.items.map((f) => {
                const overdue = OPEN_STATUSES.includes(f.status) && f.dueAt && f.dueAt < now;
                return (
                  <li key={f.id}>
                    <Link href={`/quan-tri/gop-y/${f.id}`} className="block space-y-1.5 px-4 py-3 hover:bg-cream">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-brand-700">{f.code}</span>
                        <StatusBadge status={f.status} />
                        {f.priority !== "NORMAL" && <PriorityBadge priority={f.priority} />}
                      </div>
                      <p className="font-semibold">{f.title}</p>
                      <p className="text-xs text-ink-muted">{FEEDBACK_TYPE_LABELS[f.type]} · {f.category.name} · gửi {formatDate(f.createdAt)}</p>
                      <p className={cx("text-xs", overdue ? "font-bold text-brand-700" : "text-ink-muted")}>Hạn xử lý: {formatDate(f.dueAt)}{overdue && " (quá hạn)"}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <div className="px-4 pb-4">
          <Pagination page={res.page} pages={res.pages} makeHref={(p) => qs({ page: p })} />
        </div>
      </Card>
    </div>
  );
}
