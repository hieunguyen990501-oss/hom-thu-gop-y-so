import { requirePermission } from "@/server/session";
import { listTemplates } from "@/server/services/admin";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/client";
import * as A from "../actions";

export const metadata = { title: "Mẫu trả lời" };

export default async function TemplatesPage() {
  await requirePermission("ADMIN_TEMPLATES");
  const items = await listTemplates();
  return (
    <div className="space-y-4">
      <PageHeader title="Mẫu trả lời hành chính" subtitle="Chỉ mẫu đã được phê duyệt mới hiển thị cho cán bộ xử lý. Sửa nội dung mẫu sẽ phải phê duyệt lại." />
      <Card title="Thêm mẫu">
        <ActionForm action={A.saveTemplateAction} className="space-y-3" resetOnSuccess>
          <input name="title" className="input py-2" placeholder="Tiêu đề mẫu" required maxLength={150} />
          <textarea name="content" rows={4} className="input" placeholder="Nội dung mẫu" required maxLength={5000} />
          <SubmitButton className="btn-olive btn-sm">Thêm mẫu</SubmitButton>
        </ActionForm>
      </Card>
      <Card title={`Danh sách mẫu (${items.length})`}>
        {items.length === 0 ? <EmptyState title="Chưa có mẫu trả lời" /> : (
          <div className="space-y-2">
            {items.map((t) => (
              <details key={t.id} className="rounded-md border border-cream-200">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2">
                  <span className="font-semibold">{t.title}</span>
                  {t.isApproved ? <Badge className="border-green-200 bg-green-50 text-green-900">Đã duyệt</Badge> : <Badge className="border-bronze-300 bg-bronze-50 text-bronze-700">Chờ duyệt</Badge>}
                  {!t.isActive && <Badge className="border-stone-300 bg-stone-100 text-stone-700">Ngừng dùng</Badge>}
                </summary>
                <div className="space-y-3 border-t border-cream-200 p-3">
                  <ActionForm action={A.saveTemplateAction} className="space-y-2">
                    <input type="hidden" name="id" value={t.id} />
                    <input name="title" className="input py-2" defaultValue={t.title} required maxLength={150} />
                    <textarea name="content" rows={4} className="input" defaultValue={t.content} required maxLength={5000} />
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={t.isActive} className="h-4 w-4 accent-brand-700" /> Đang dùng</label>
                    <SubmitButton className="btn-outline btn-sm">Lưu</SubmitButton>
                  </ActionForm>
                  {!t.isApproved && (
                    <ActionForm action={A.approveTemplateAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <SubmitButton className="btn-olive btn-sm">Phê duyệt mẫu</SubmitButton>
                    </ActionForm>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
