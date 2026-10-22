import { requirePermission } from "@/server/session";
import { retentionPreview } from "@/server/services/admin";
import { Alert, Card, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmSubmit } from "@/components/ui/client";
import { formatDate } from "@/lib/dates";
import * as A from "../actions";

export const metadata = { title: "Lưu trữ, xóa dữ liệu" };

export default async function RetentionPage() {
  const actor = await requirePermission("ADMIN_RETENTION");
  const p = await retentionPreview(actor);
  return (
    <div className="space-y-4">
      <PageHeader title="Lưu trữ, xóa dữ liệu" subtitle="Thực hiện theo chính sách lưu trữ đã được cấp có thẩm quyền phê duyệt. Sao lưu cơ sở dữ liệu trước khi xóa." />
      <Card title="Xóa hồ sơ hết thời hạn lưu trữ">
        <p className="text-sm">Chính sách hiện tại: lưu <b>{p.months} tháng</b> kể từ ngày kết thúc. Hồ sơ kết thúc trước ngày <b>{formatDate(p.cutoff)}</b>: <b>{p.expired}</b> hồ sơ.</p>
        <p className="mt-1 text-xs text-ink-muted">Xóa vĩnh viễn hồ sơ cùng lịch sử, phản hồi, ghi chú, thông tin người gửi. Nhật ký kiểm toán được giữ lại và ghi nhận thao tác xóa.</p>
        <ActionForm action={A.purgeExpiredAction} className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="label text-xs" htmlFor="c1">Nhập “XOA DU LIEU” để xác nhận</label>
            <input id="c1" name="confirm" className="input py-2 font-mono" autoComplete="off" required />
          </div>
          <ConfirmSubmit className="btn-danger" message={`Xóa vĩnh viễn ${p.expired} hồ sơ hết hạn lưu trữ? Không thể hoàn tác.`}>Xóa hồ sơ hết hạn</ConfirmSubmit>
        </ActionForm>
      </Card>
      <Card title="Xóa dữ liệu demo (trước khi vận hành chính thức)">
        {p.demoFeedback === 0 && p.demoUsers === 0 ? (
          <Alert kind="success">Không còn dữ liệu demo.</Alert>
        ) : (
          <>
            <p className="text-sm">Hiện có <b>{p.demoFeedback}</b> hồ sơ demo và <b>{p.demoUsers}</b> tài khoản demo.</p>
            <p className="mt-1 text-xs text-ink-muted">Xóa toàn bộ hồ sơ demo, vô hiệu hóa tài khoản demo (giữ lại để đối chiếu nhật ký) và chuyển hệ thống sang chế độ chính thức.</p>
            <ActionForm action={A.purgeDemoAction} className="mt-3 flex flex-wrap items-end gap-2">
              <div>
                <label className="label text-xs" htmlFor="c2">Nhập “XOA DEMO” để xác nhận</label>
                <input id="c2" name="confirm" className="input py-2 font-mono" autoComplete="off" required />
              </div>
              <ConfirmSubmit className="btn-danger" message="Xóa toàn bộ dữ liệu demo và chuyển sang chế độ chính thức?">Xóa dữ liệu demo</ConfirmSubmit>
            </ActionForm>
          </>
        )}
      </Card>
      <Card title="Sao lưu, khôi phục">
        <p className="text-sm leading-relaxed">Sao lưu được thực hiện ở tầng máy chủ (dịch vụ <code>backup</code> trong docker-compose chạy pg_dump hằng ngày, giữ 14 bản gần nhất) và theo tài liệu <code>docs/SAO-LUU-KHOI-PHUC.md</code>. Định kỳ hằng quý cần khôi phục thử một bản sao lưu ra máy kiểm tra để xác nhận bản sao lưu dùng được. Khóa mã hóa APP_ENCRYPTION_KEY phải được sao lưu riêng, tách khỏi bản sao lưu CSDL.</p>
      </Card>
    </div>
  );
}
