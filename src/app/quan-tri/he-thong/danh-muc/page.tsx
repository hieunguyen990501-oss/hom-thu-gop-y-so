import { requirePermission } from "@/server/session";
import { listCategories, listUnits } from "@/server/services/admin";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/client";
import * as A from "../actions";

export const metadata = { title: "Danh mục" };

export default async function CatalogPage() {
  await requirePermission("ADMIN_CATALOG");
  const [cats, units] = await Promise.all([listCategories(), listUnits()]);
  return (
    <div className="space-y-4">
      <PageHeader title="Danh mục" subtitle="Lĩnh vực góp ý và cơ cấu đơn vị. Không xóa mục đã có dữ liệu — chuyển sang “ngừng sử dụng”." />

      <Card title="Lĩnh vực góp ý">
        <div className="space-y-2">
          {cats.map((c) => (
            <details key={c.id} className="rounded-md border border-cream-200">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2">
                <span className="font-semibold">{c.name}</span>
                <span className="text-xs text-ink-muted">{c._count.feedback} hồ sơ · hạn {c.slaDays ? `${c.slaDays} ngày` : "theo mặc định"}</span>
                {!c.isActive && <Badge className="border-stone-300 bg-stone-100 text-stone-700">Ngừng sử dụng</Badge>}
              </summary>
              <ActionForm action={A.saveCategoryAction} className="grid gap-3 border-t border-cream-200 p-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={c.id} />
                <CategoryFields c={c} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={c.isActive} className="h-4 w-4 accent-brand-700" /> Đang sử dụng</label>
                <div className="sm:col-span-2"><SubmitButton className="btn-olive btn-sm">Lưu</SubmitButton></div>
              </ActionForm>
            </details>
          ))}
        </div>
        <details className="mt-4 rounded-md border border-dashed border-bronze-300 bg-bronze-50/40">
          <summary className="cursor-pointer px-3 py-2 font-semibold text-brand-700">+ Thêm lĩnh vực</summary>
          <ActionForm action={A.saveCategoryAction} className="grid gap-3 p-3 sm:grid-cols-2" resetOnSuccess>
            <CategoryFields />
            <div className="sm:col-span-2"><SubmitButton className="btn-olive btn-sm">Thêm</SubmitButton></div>
          </ActionForm>
        </details>
      </Card>

      <Card title="Đơn vị, bộ phận">
        <p className="mb-3 text-xs text-ink-muted">Cơ cấu đang dùng là danh mục mẫu, đơn vị cần cập nhật cho đúng thực tế. “Bộ phận xử lý” là nơi có thể được phân công; “Người gửi chọn được” là danh mục đơn vị công tác trên biểu mẫu góp ý.</p>
        <div className="space-y-2">
          {units.map((u) => (
            <details key={u.id} className="rounded-md border border-cream-200">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2">
                <span className="font-semibold">{u.name}</span>
                <span className="font-mono text-xs text-ink-muted">{u.code}</span>
                {u.parent && <span className="text-xs text-ink-muted">thuộc {u.parent.name}</span>}
                {u.isHandlingUnit && <Badge className="border-olive-200 bg-olive-50 text-olive-800">Bộ phận xử lý</Badge>}
                {!u.isActive && <Badge className="border-stone-300 bg-stone-100 text-stone-700">Ngừng sử dụng</Badge>}
              </summary>
              <ActionForm action={A.saveUnitAction} className="grid gap-3 border-t border-cream-200 p-3 sm:grid-cols-2">
                <input type="hidden" name="id" value={u.id} />
                <UnitFields units={units} u={u} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={u.isActive} className="h-4 w-4 accent-brand-700" /> Đang sử dụng</label>
                <div className="sm:col-span-2"><SubmitButton className="btn-olive btn-sm">Lưu</SubmitButton></div>
              </ActionForm>
            </details>
          ))}
        </div>
        <details className="mt-4 rounded-md border border-dashed border-bronze-300 bg-bronze-50/40">
          <summary className="cursor-pointer px-3 py-2 font-semibold text-brand-700">+ Thêm đơn vị, bộ phận</summary>
          <ActionForm action={A.saveUnitAction} className="grid gap-3 p-3 sm:grid-cols-2" resetOnSuccess>
            <div>
              <label className="label text-xs">Mã (không dấu)</label>
              <input name="code" className="input py-2" maxLength={30} pattern="[A-Za-z0-9_\-]+" />
            </div>
            <UnitFields units={units} />
            <div className="sm:col-span-2"><SubmitButton className="btn-olive btn-sm">Thêm</SubmitButton></div>
          </ActionForm>
        </details>
      </Card>
    </div>
  );
}

function CategoryFields({ c }: { c?: Awaited<ReturnType<typeof listCategories>>[number] }) {
  return (
    <>
      <div>
        <label className="label text-xs">Tên lĩnh vực</label>
        <input name="name" className="input py-2" defaultValue={c?.name} required maxLength={120} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label text-xs">Hạn xử lý (ngày)</label>
          <input name="slaDays" type="number" min={1} max={180} className="input py-2" defaultValue={c?.slaDays ?? ""} placeholder="mặc định" />
        </div>
        <div>
          <label className="label text-xs">Thứ tự</label>
          <input name="sortOrder" type="number" className="input py-2" defaultValue={c?.sortOrder ?? 0} />
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className="label text-xs">Từ khóa gợi ý phân loại (phân tách bằng dấu phẩy)</label>
        <input name="keywords" className="input py-2" defaultValue={c?.keywords} maxLength={1000} />
      </div>
      <div className="sm:col-span-2">
        <label className="label text-xs">Mô tả</label>
        <input name="description" className="input py-2" defaultValue={c?.description ?? ""} maxLength={500} />
      </div>
    </>
  );
}

function UnitFields({ units, u }: { units: Awaited<ReturnType<typeof listUnits>>; u?: Awaited<ReturnType<typeof listUnits>>[number] }) {
  return (
    <>
      <div>
        <label className="label text-xs">Tên đơn vị, bộ phận</label>
        <input name="name" className="input py-2" defaultValue={u?.name} required maxLength={120} />
      </div>
      <div>
        <label className="label text-xs">Thuộc</label>
        <select name="parentId" className="input py-2" defaultValue={u?.parentId ?? ""}>
          <option value="">— Cấp cao nhất —</option>
          {units.filter((x) => x.id !== u?.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label text-xs">Thứ tự</label>
        <input name="sortOrder" type="number" className="input py-2" defaultValue={u?.sortOrder ?? 0} />
      </div>
      <div className="flex flex-col justify-end gap-1">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isHandlingUnit" defaultChecked={u?.isHandlingUnit} className="h-4 w-4 accent-brand-700" /> Bộ phận xử lý</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isSenderSelectable" defaultChecked={u?.isSenderSelectable ?? true} className="h-4 w-4 accent-brand-700" /> Người gửi chọn được</label>
      </div>
    </>
  );
}
