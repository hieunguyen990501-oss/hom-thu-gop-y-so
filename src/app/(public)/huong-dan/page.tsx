import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/shell";
import { getSetting } from "@/server/settings";
import { SECURITY_WARNING } from "@/lib/constants";

export const metadata: Metadata = { title: "Hướng dẫn sử dụng" };

const STEPS = [
  { t: "Quét mã QR", d: "Dùng camera điện thoại quét mã QR dán tại đơn vị (hoặc mở đường dẫn được thông báo). Điện thoại cần kết nối vào mạng được phép truy cập hệ thống." },
  { t: "Chọn “Gửi ý kiến góp ý”", d: "Chọn gửi ẩn danh hoặc gửi có thông tin; chọn loại ý kiến, lĩnh vực; nhập tiêu đề, nội dung và đề xuất (nếu có)." },
  { t: "Bấm “GỬI Ý KIẾN” và lưu mã", d: "Hệ thống cấp Mã hồ sơ và Mã bí mật. Chép lại, chụp màn hình hoặc tải tệp lưu mã. Mã bí mật chỉ hiển thị một lần." },
  { t: "Tra cứu kết quả", d: "Vào “Tra cứu kết quả xử lý”, nhập Mã hồ sơ và Mã bí mật để xem trạng thái, phản hồi của đơn vị; gửi bổ sung khi được đề nghị; đánh giá sau khi có kết quả." },
];

export default async function GuidePage() {
  const demo = await getSetting("system.demoMode");
  return (
    <PublicShell demo={demo}>
      <Link href="/" className="text-sm text-ink-muted hover:underline">← Trang chủ</Link>
      <h1 className="mb-4 mt-1 text-xl font-bold">Hướng dẫn sử dụng</h1>
      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={i} className="card flex gap-4 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 font-bold text-white">{i + 1}</span>
            <div>
              <p className="font-bold">{s.t}</p>
              <p className="text-sm leading-relaxed text-ink-soft">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
      <section className="card mt-5 space-y-3 p-4 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-base font-bold text-ink">Những điều cần lưu ý</h2>
        <p><b>Bảo mật:</b> {SECURITY_WARNING}</p>
        <p><b>Ẩn danh:</b> Khi gửi ẩn danh, hệ thống không yêu cầu họ tên, tài khoản và không ghi địa chỉ thiết bị vào hồ sơ. Mức độ ẩn danh thực tế còn phụ thuộc hạ tầng mạng và nội dung đồng chí viết, vì vậy không nên nêu chi tiết có thể nhận ra bản thân nếu không cần thiết.</p>
        <p><b>Mã bí mật:</b> Mã hồ sơ không phải mật khẩu. Chỉ người có cả Mã hồ sơ và Mã bí mật mới xem được nội dung và phản hồi. Không đưa mã bí mật cho người khác. Nếu mất mã bí mật, hệ thống không thể khôi phục đối với hồ sơ ẩn danh (vì không có thông tin nào để xác minh người gửi); đồng chí có thể gửi ý kiến mới và ghi rõ là bổ sung cho ý kiến trước.</p>
        <p><b>Trường hợp khẩn cấp:</b> Không dùng hòm thư góp ý số. Báo cáo trực tiếp theo quy định của đơn vị.</p>
        <p><b>Thời hạn xử lý:</b> Mỗi ý kiến được phân loại và giao xử lý theo thời hạn do đơn vị quy định. Đồng chí theo dõi trạng thái tại trang tra cứu.</p>
      </section>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Link href="/gop-y" className="btn-primary">Gửi ý kiến ngay</Link>
        <Link href="/tra-cuu" className="btn-outline">Tra cứu kết quả</Link>
      </div>
    </PublicShell>
  );
}
