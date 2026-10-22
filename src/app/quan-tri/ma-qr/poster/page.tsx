import { requirePermission } from "@/server/session";
import { qrDataUrl, qrTargetUrl } from "@/server/services/qr";
import { PrintButton } from "@/components/ui/client";
import { APP_NAME, UNIT_NAME } from "@/lib/constants";

export const metadata = { title: "Poster mã QR" };

// Poster A4 để in, dán tại đơn vị. Không dùng quân hiệu/biểu tượng chính thức khi chưa có tệp hợp lệ được phép.
export default async function PosterPage() {
  await requirePermission("ADMIN_QR");
  const [url, img] = await Promise.all([qrTargetUrl(), qrDataUrl(undefined, 1200)]);
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center gap-3 rounded-md border border-bronze-300 bg-bronze-50 p-3 text-sm">
        <span className="flex-1">Khổ A4 đứng. Khi in, chọn “Không lề” hoặc lề tối thiểu, bật “In hình nền” để giữ màu.</span>
        <PrintButton label="In poster" />
      </div>
      <div className="mx-auto flex aspect-[210/297] w-full max-w-[680px] flex-col overflow-hidden border-[10px] border-brand-800 bg-cream text-center shadow-card print:max-w-none print:shadow-none" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
        <div className="bg-brand-800 px-6 pb-5 pt-6 text-white">
          <p className="text-[clamp(13px,2.6vw,20px)] font-bold tracking-wide text-bronze-200">{UNIT_NAME}</p>
          <div className="mx-auto my-3 h-[3px] w-24 bg-bronze-300" />
          <p className="text-[clamp(28px,6.4vw,48px)] font-bold leading-tight tracking-wide">{APP_NAME}</p>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-4">
          <p className="text-[clamp(15px,3vw,22px)] font-semibold leading-snug text-olive-800">“Quét mã QR để gửi ý kiến, kiến nghị, phản ánh và đề xuất”</p>
          <div className="rounded-xl border-4 border-bronze-400 bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt="Mã QR hòm thư góp ý số" className="h-auto w-[min(56vw,330px)] print:w-[88mm]" />
          </div>
          <p className="break-all font-mono text-[clamp(11px,2vw,14px)] text-ink-soft">{url}</p>
          <div className="grid w-full grid-cols-3 gap-2 text-[clamp(11px,2.1vw,15px)]">
            {["Quét mã QR", "Nhập nội dung góp ý", "Nhận mã và theo dõi kết quả"].map((t, i) => (
              <div key={t} className="rounded-md border border-olive-200 bg-white px-2 py-2">
                <span className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-olive-600 font-bold text-white">{i + 1}</span>
                <span className="font-semibold leading-tight text-olive-900">{t}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-olive-800 px-6 py-4">
          <p className="text-[clamp(16px,3.2vw,24px)] font-bold tracking-wide text-bronze-200">Lắng nghe – Tôn trọng – Trách nhiệm</p>
          <p className="mt-1 text-[clamp(10px,1.8vw,12px)] text-olive-100">Có thể gửi ẩn danh · Không nhập thông tin bí mật nhà nước, bí mật quân sự</p>
        </div>
      </div>
    </div>
  );
}
