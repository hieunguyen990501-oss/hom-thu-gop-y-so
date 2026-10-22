import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Download, Printer } from "lucide-react";
import { requirePermission, actorForAction } from "@/server/session";
import { can } from "@/server/rbac";
import { getSetting } from "@/server/settings";
import { qrDataUrl, qrTargetUrl } from "@/server/services/qr";
import { updateSettings } from "@/server/services/admin";
import { toActionError } from "@/server/errors";
import { Alert, Card, PageHeader } from "@/components/ui";
import { ActionForm, type FormState } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/client";

export const metadata = { title: "Mã QR" };

async function saveQrAction(_: FormState, fd: FormData): Promise<FormState> {
  "use server";
  try {
    await updateSettings(await actorForAction(), {
      "qr.publicBaseUrl": String(fd.get("base") ?? ""),
      "qr.targetPath": String(fd.get("target") ?? "/"),
    });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/quan-tri/ma-qr");
  return { ok: true, message: "Đã lưu cấu hình đường dẫn mã QR." };
}

export default async function QrPage() {
  const actor = await requirePermission("ADMIN_QR");
  const [url, img, base, target] = await Promise.all([qrTargetUrl(), qrDataUrl(undefined, 520), getSetting("qr.publicBaseUrl"), getSetting("qr.targetPath")]);
  const isLocal = /localhost|127\.0\.0\.1/.test(base);
  return (
    <div className="space-y-4">
      <PageHeader title="Mã QR truy cập hòm thư" subtitle="Mã QR được sinh ngay trên máy chủ, không dùng dịch vụ tạo QR trực tuyến." />
      {isLocal && (
        <Alert kind="warning" title="Địa chỉ chính thức chưa được cấu hình">
          Mã QR đang trỏ tới {base}, điện thoại của cán bộ, chiến sĩ sẽ không truy cập được. Đặt “Địa chỉ chính thức” là tên miền/IP nội bộ của máy chủ (do bộ phận CNTT cấp) trước khi in.
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Xem trước mã QR">
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={`Mã QR trỏ tới ${url}`} className="h-64 w-64 rounded-md border border-cream-200" />
            <p className="break-all text-center font-mono text-sm">{url}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <a className="btn-outline btn-sm" href="/api/qr?format=png&size=1600"><Download className="h-4 w-4" aria-hidden /> Tải PNG</a>
              <a className="btn-outline btn-sm" href="/api/qr?format=svg"><Download className="h-4 w-4" aria-hidden /> Tải SVG</a>
              <Link className="btn-primary btn-sm" href="/quan-tri/ma-qr/poster"><Printer className="h-4 w-4" aria-hidden /> Poster A4</Link>
            </div>
          </div>
        </Card>
        <Card title="Cấu hình đường dẫn">
          {can(actor, "ADMIN_SETTINGS") ? (
            <ActionForm action={saveQrAction} className="space-y-4">
              <div>
                <label className="label" htmlFor="base">Địa chỉ chính thức của hệ thống</label>
                <input id="base" name="base" className="input font-mono" defaultValue={base} required placeholder="https://gopy.lu572.local" />
                <p className="mt-1 text-xs text-ink-muted">Tên miền hoặc địa chỉ IP nội bộ mà điện thoại trong mạng được phép truy cập. Mã QR luôn là &lt;địa chỉ&gt;/q.</p>
              </div>
              <div>
                <label className="label" htmlFor="target">Đường dẫn đích khi quét (chuyển hướng nội bộ)</label>
                <input id="target" name="target" className="input font-mono" defaultValue={target} required placeholder="/" />
                <p className="mt-1 text-xs text-ink-muted">Ví dụ “/” (trang chủ) hoặc “/gop-y” (vào thẳng biểu mẫu). Đổi đích không cần in lại mã QR. Chỉ chấp nhận đường dẫn nội bộ.</p>
              </div>
              <SubmitButton className="btn-olive">Lưu cấu hình</SubmitButton>
            </ActionForm>
          ) : (
            <p className="text-sm text-ink-muted">Đồng chí có quyền tải, in mã QR. Thay đổi đường dẫn do quản trị hệ thống thực hiện.</p>
          )}
          <div className="mt-5 space-y-2 rounded-md bg-cream p-3 text-xs leading-relaxed text-ink-soft">
            <p><b>Lưu ý kỹ thuật:</b> Mã QR chỉ chứa đường dẫn, không tự cấp quyền truy cập mạng. Nếu hệ thống chạy trong mạng nội bộ, điện thoại phải được kết nối vào mạng đó.</p>
            <p>Không tự ý mở hệ thống ra Internet khi chưa được cấp có thẩm quyền phê duyệt.</p>
            <p>Mã QR dùng chung cho cả đơn vị, không gắn tham số định danh người quét.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
