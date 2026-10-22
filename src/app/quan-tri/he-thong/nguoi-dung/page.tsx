import { requirePermission } from "@/server/session";
import { listCategories, listRolesWithPermissions, listUnits, listUsers } from "@/server/services/admin";
import { Badge, Card, PageHeader, cx } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/dates";
import * as A from "../actions";

export const metadata = { title: "Tài khoản, phân quyền" };

type Units = Awaited<ReturnType<typeof listUnits>>;
type Cats = Awaited<ReturnType<typeof listCategories>>;

function UserFields({ units, cats, u }: { units: Units; cats: Cats; u?: Awaited<ReturnType<typeof listUsers>>[number] }) {
  const scope = new Set(u?.categoryScopes.map((c) => c.categoryId));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {!u && (
        <div>
          <label className="label text-xs" htmlFor="username">Tên đăng nhập</label>
          <input id="username" name="username" className="input py-2" required pattern="[a-z0-9._\-]{3,40}" placeholder="vd: nguyenvana" />
        </div>
      )}
      <div>
        <label className="label text-xs">Họ và tên</label>
        <input name="fullName" className="input py-2" defaultValue={u?.fullName} required maxLength={100} />
      </div>
      <div>
        <label className="label text-xs">Cấp bậc</label>
        <input name="rank" className="input py-2" defaultValue={u?.rank ?? ""} maxLength={60} />
      </div>
      <div>
        <label className="label text-xs">Chức vụ</label>
        <input name="position" className="input py-2" defaultValue={u?.position ?? ""} maxLength={120} />
      </div>
      <div>
        <label className="label text-xs">Vai trò</label>
        <select name="roleCode" className="input py-2" defaultValue={u?.role.code ?? "HANDLER"}>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div>
        <label className="label text-xs">Đơn vị/bộ phận</label>
        <select name="unitId" className="input py-2" defaultValue={u?.unit?.id ?? ""}>
          <option value="">— Không —</option>
          {units.filter((x) => x.isActive).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </div>
      <fieldset className="sm:col-span-2">
        <legend className="label text-xs">Phạm vi lĩnh vực được xem (để trống = toàn bộ; áp dụng cho tiếp nhận, lãnh đạo)</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {cats.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={scope.has(c.id)} className="h-4 w-4 accent-brand-700" /> {c.name}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="isIndependentContact" defaultChecked={u?.isIndependentContact} className="h-4 w-4 accent-brand-700" /> Đầu mối độc lập (nhận hồ sơ nhạy cảm, hồ sơ liên quan đến cán bộ có thẩm quyền)
      </label>
      {u && (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="hidden" name="isActive" value="" />
          <input type="checkbox" name="isActive" defaultChecked={u.isActive} className="h-4 w-4 accent-brand-700" /> Đang hoạt động (bỏ chọn để khóa tài khoản)
        </label>
      )}
    </div>
  );
}

export default async function UsersPage() {
  await requirePermission("ADMIN_USERS");
  const [users, units, cats, roles] = await Promise.all([listUsers(await requirePermission("ADMIN_USERS")), listUnits(), listCategories(), listRolesWithPermissions()]);
  const now = new Date();
  return (
    <div className="space-y-4">
      <PageHeader title="Tài khoản, phân quyền" subtitle="Không có mật khẩu mặc định: mỗi tài khoản mới được cấp mật khẩu tạm ngẫu nhiên và bắt buộc đổi khi đăng nhập lần đầu." />
      <Card title="Tạo tài khoản mới">
        <ActionForm action={A.createUserAction} className="space-y-3" resetOnSuccess>
          <UserFields units={units} cats={cats} />
          <SubmitButton className="btn-olive">Tạo tài khoản</SubmitButton>
        </ActionForm>
      </Card>

      <Card title={`Danh sách tài khoản (${users.length})`} bodyClassName="p-0">
        <ul className="divide-y divide-cream-100">
          {users.map((u) => {
            const locked = u.lockedUntil && u.lockedUntil > now;
            return (
              <li key={u.id} className={cx("px-4 py-3", !u.isActive && "bg-cream/60 opacity-75")}>
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                    <span className="font-semibold">{u.rank} {u.fullName}</span>
                    <span className="font-mono text-xs text-ink-muted">{u.username}</span>
                    <Badge className="border-olive-200 bg-olive-50 text-olive-800">{ROLE_LABELS[u.role.code]}</Badge>
                    {u.unit && <span className="text-xs text-ink-muted">{u.unit.name}</span>}
                    {!u.isActive && <Badge className="border-stone-300 bg-stone-100 text-stone-700">Đã khóa</Badge>}
                    {locked && <Badge className="border-brand-200 bg-brand-50 text-brand-700">Tạm khóa (sai mật khẩu)</Badge>}
                    {u.isDemo && <Badge className="border-amber-300 bg-amber-100 text-amber-900">DEMO</Badge>}
                    {u.totpEnabled && <Badge className="border-green-200 bg-green-50 text-green-900">2FA</Badge>}
                    {u.mustChangePassword && <Badge className="border-bronze-300 bg-bronze-50 text-bronze-700">Chưa đổi MK tạm</Badge>}
                    {u.isIndependentContact && <Badge className="border-violet-200 bg-violet-50 text-violet-900">Đầu mối độc lập</Badge>}
                    <span className="ml-auto text-xs text-ink-muted">Đăng nhập: {formatDateTime(u.lastLoginAt)}</span>
                  </summary>
                  <div className="mt-3 space-y-3 rounded-md border border-cream-200 p-3">
                    <ActionForm action={A.updateUserAction} className="space-y-3">
                      <input type="hidden" name="id" value={u.id} />
                      <UserFields units={units} cats={cats} u={u} />
                      <SubmitButton className="btn-olive btn-sm">Lưu thay đổi</SubmitButton>
                    </ActionForm>
                    <div className="flex flex-wrap gap-2 border-t border-cream-200 pt-3">
                      <ActionForm action={A.resetPasswordAction}>
                        <input type="hidden" name="id" value={u.id} />
                        <ConfirmSubmit className="btn-outline btn-sm" message={`Cấp lại mật khẩu tạm cho ${u.fullName}? Mọi phiên đăng nhập của tài khoản sẽ bị hủy.`}>Cấp lại mật khẩu</ConfirmSubmit>
                      </ActionForm>
                      {locked && (
                        <ActionForm action={A.unlockUserAction}>
                          <input type="hidden" name="id" value={u.id} />
                          <SubmitButton className="btn-outline btn-sm">Mở khóa</SubmitButton>
                        </ActionForm>
                      )}
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card title="Ma trận phân quyền theo vai trò">
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((r) => (
            <div key={r.id} className="rounded-md border border-cream-200 p-3">
              <p className="font-bold">{r.name}</p>
              <p className="mb-2 text-xs text-ink-muted">{r.description}</p>
              <ul className="space-y-0.5 text-sm">{r.permissions.map((p) => <li key={p.permissionId}>• {p.permission.name}</li>)}</ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-muted">Quyền được kiểm tra tại máy chủ cho mọi thao tác. Quản trị hệ thống không mặc nhiên có quyền đọc nội dung góp ý.</p>
      </Card>
    </div>
  );
}
