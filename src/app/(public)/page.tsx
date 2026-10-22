import Link from "next/link";
import { BookOpen, PenLine, Search, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/public/shell";
import { getSetting } from "@/server/settings";
import { SLOGAN } from "@/lib/constants";

export default async function HomePage() {
  const demo = await getSetting("system.demoMode");
  const open = await getSetting("public.submissionsOpen");
  const items = [
    { href: "/gop-y", title: "GỬI Ý KIẾN GÓP Ý", desc: "Gửi kiến nghị, phản ánh, đề xuất – có thể gửi ẩn danh.", icon: PenLine, primary: true },
    { href: "/tra-cuu", title: "TRA CỨU KẾT QUẢ XỬ LÝ", desc: "Dùng mã hồ sơ và mã bí mật để theo dõi kết quả.", icon: Search },
    { href: "/huong-dan", title: "HƯỚNG DẪN SỬ DỤNG", desc: "Các bước gửi ý kiến, lưu mã, tra cứu và lưu ý bảo mật.", icon: BookOpen },
  ];
  return (
    <PublicShell demo={demo}>
      <section className="mb-6 rounded-lg border border-cream-200 bg-white p-5 shadow-card">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-bronze-700">{SLOGAN}</p>
        <p className="text-[15px] leading-relaxed text-ink-soft">
          Đây là kênh tiếp nhận ý kiến, kiến nghị, phản ánh và đề xuất của cán bộ, chiến sĩ nhằm góp phần xây dựng đơn vị vững mạnh, dân chủ, đoàn kết và hoàn thành tốt nhiệm vụ.
        </p>
      </section>

      {!open && (
        <div className="mb-4 rounded-md border border-bronze-300 bg-bronze-50 p-3 text-sm text-bronze-700">
          Hệ thống đang tạm dừng tiếp nhận góp ý mới. Đồng chí vẫn có thể tra cứu kết quả các ý kiến đã gửi.
        </div>
      )}

      <nav aria-label="Chức năng chính" className="grid gap-3">
        {items.map(({ href, title, desc, icon: Icon, primary }) => (
          <Link
            key={href}
            href={href}
            className={
              "group flex items-center gap-4 rounded-lg border p-4 shadow-card transition-colors " +
              (primary ? "border-brand-700 bg-brand-700 text-white hover:bg-brand-800" : "border-cream-200 bg-white hover:border-bronze-300 hover:bg-bronze-50")
            }
          >
            <span className={"flex h-12 w-12 shrink-0 items-center justify-center rounded-md " + (primary ? "bg-brand-900/40" : "bg-olive-50 text-olive-700")}>
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <span>
              <span className="block text-base font-bold tracking-wide">{title}</span>
              <span className={"block text-sm " + (primary ? "text-brand-100" : "text-ink-muted")}>{desc}</span>
            </span>
          </Link>
        ))}
      </nav>

      <section className="mt-6 flex gap-3 rounded-lg border border-olive-200 bg-olive-50 p-4 text-sm leading-relaxed text-olive-900">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="font-bold">Về việc gửi ẩn danh</p>
          <p>
            Khi chọn gửi ẩn danh, hệ thống không yêu cầu họ tên, số điện thoại hay tài khoản và không ghi địa chỉ thiết bị vào hồ sơ góp ý. Tuy nhiên, mức độ ẩn danh còn phụ thuộc vào hạ tầng mạng của đơn vị và nội dung đồng chí viết; tránh nêu chi tiết có thể nhận ra chính mình nếu không cần thiết.
          </p>
        </div>
      </section>
    </PublicShell>
  );
}
