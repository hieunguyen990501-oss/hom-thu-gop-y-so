import { requirePermission } from "@/server/session";
import { readSettings } from "@/server/services/admin";
import { Alert, Card, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { ROLE_LABELS } from "@/lib/constants";
import * as A from "../actions";

export const metadata = { title: "Cấu hình" };

export default async function SettingsPage() {
  const actor = await requirePermission("ADMIN_SETTINGS");
  const st = await readSettings(actor);
  const sla = st["sla.days"];
  return (
    <div className="space-y-4">
      <PageHeader title="Cấu hình hệ thống" subtitle="Mọi thay đổi được ghi nhật ký. Các giá trị mặc định là đề xuất — đơn vị cần xác nhận trước khi vận hành." />
      <ActionForm action={A.saveSettingsAction} className="space-y-4">
        <Card title="Cổng góp ý">
          <div className="space-y-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="submissionsOpen" defaultChecked={st["public.submissionsOpen"]} className="h-4 w-4 accent-brand-700" /> Đang tiếp nhận góp ý mới</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="allowIdentified" defaultChecked={st["public.allowIdentified"]} className="h-4 w-4 accent-brand-700" /> Cho phép gửi có thông tin người gửi (tắt = chỉ nhận ẩn danh)</label>
            <div className="max-w-xs">
              <label className="label text-xs" htmlFor="rl">Số góp ý tối đa mỗi giờ từ một địa chỉ mạng</label>
              <input id="rl" name="rateLimitPerHour" type="number" min={1} max={100} defaultValue={st["public.rateLimitPerHour"]} className="input py-2" />
              <p className="mt-1 text-xs text-ink-muted">Chống gửi tràn. Bộ đếm chỉ nằm trong bộ nhớ máy chủ, được băm và tự xóa; không lưu vào hồ sơ. Lưu ý: nếu nhiều điện thoại dùng chung một địa chỉ NAT, nên đặt giá trị cao hơn.</p>
            </div>
          </div>
        </Card>
        <Card title="Quy trình, thời hạn xử lý">
          <div className="space-y-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="requireApproval" defaultChecked={st["workflow.requireApproval"]} className="h-4 w-4 accent-brand-700" /> Kết quả, nội dung trả lời phải được lãnh đạo phê duyệt trước khi công bố cho người gửi</label>
            <div className="grid gap-3 sm:grid-cols-4">
              <div><label className="label text-xs">Thông thường (ngày)</label><input name="slaNormal" type="number" min={1} max={180} defaultValue={sla.NORMAL} className="input py-2" /></div>
              <div><label className="label text-xs">Cần quan tâm (ngày)</label><input name="slaAttention" type="number" min={1} max={180} defaultValue={sla.ATTENTION} className="input py-2" /></div>
              <div><label className="label text-xs">Ưu tiên cao (ngày)</label><input name="slaHigh" type="number" min={1} max={180} defaultValue={sla.HIGH} className="input py-2" /></div>
              <div><label className="label text-xs">Báo sắp đến hạn trước (ngày)</label><input name="dueSoonDays" type="number" min={0} max={30} defaultValue={st["sla.dueSoonDays"]} className="input py-2" /></div>
            </div>
            <p className="text-xs text-ink-muted">Thời hạn tính từ ngày tiếp nhận. Mức “Thông thường” dùng thời hạn riêng của lĩnh vực nếu có (Danh mục). Các mức ưu tiên không thay thế quy trình xử lý tình huống khẩn cấp.</p>
          </div>
        </Card>
        <Card title="Lưu trữ, bảo mật">
          <div className="space-y-3 text-sm">
            <div className="max-w-xs">
              <label className="label text-xs" htmlFor="ret">Thời hạn lưu hồ sơ đã kết thúc (tháng)</label>
              <input id="ret" name="retentionMonths" type="number" min={6} max={240} defaultValue={st["retention.closedMonths"]} className="input py-2" />
            </div>
            <fieldset>
              <legend className="label text-xs">Vai trò bắt buộc bật xác thực hai yếu tố (hiển thị cảnh báo thường trực)</legend>
              <div className="flex flex-wrap gap-4">
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <label key={k} className="flex items-center gap-2"><input type="checkbox" name="totpRoles" value={k} defaultChecked={st["security.requireTotpRoles"].includes(k)} className="h-4 w-4 accent-brand-700" /> {v}</label>
                ))}
              </div>
            </fieldset>
          </div>
        </Card>
        <SubmitButton className="btn-primary">Lưu cấu hình</SubmitButton>
      </ActionForm>

      <Card title="Chế độ vận hành">
        {st["system.demoMode"] ? (
          <Alert kind="warning">Hệ thống đang ở <b>CHẾ ĐỘ DEMO</b>: chỉ hiển thị và tiếp nhận dữ liệu giả lập (mã hồ sơ có tiền tố DEMO-). Trước khi vận hành chính thức, vào “Lưu trữ, xóa dữ liệu” để xóa dữ liệu demo (tự tắt chế độ demo).</Alert>
        ) : (
          <Alert kind="success">Hệ thống đang ở <b>CHẾ ĐỘ CHÍNH THỨC</b>. Dữ liệu demo (nếu còn) không hiển thị và không được tính trong thống kê.</Alert>
        )}
        <ActionForm action={A.setDemoModeAction} className="mt-3">
          <input type="hidden" name="demo" value={st["system.demoMode"] ? "off" : "on"} />
          <ConfirmSubmit className="btn-outline btn-sm" message={st["system.demoMode"] ? "Chuyển sang chế độ chính thức? Dữ liệu demo sẽ bị ẩn (không bị xóa)." : "Chuyển sang chế độ demo? Dữ liệu chính thức sẽ bị ẩn trong thời gian demo."}>
            {st["system.demoMode"] ? "Chuyển sang chế độ chính thức" : "Chuyển sang chế độ demo"}
          </ConfirmSubmit>
        </ActionForm>
      </Card>
    </div>
  );
}
