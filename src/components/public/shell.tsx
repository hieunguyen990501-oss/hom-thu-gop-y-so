import Link from "next/link";
import { Mail } from "lucide-react";
import { APP_NAME, SLOGAN, UNIT_NAME } from "@/lib/constants";

export function PublicShell({ children, demo }: { children: React.ReactNode; demo?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#noi-dung" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Bỏ qua, đến nội dung chính
      </a>
      {demo && (
        <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-semibold text-amber-900">
          HỆ THỐNG ĐANG CHẠY THỬ NGHIỆM (DỮ LIỆU DEMO) – không gửi ý kiến chính thức
        </div>
      )}
      <header className="border-b-4 border-bronze-300 bg-brand-800 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-3" aria-label="Về trang chủ Hòm thư góp ý số">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-bronze-300/60 bg-brand-900/40">
              <Mail className="h-6 w-6 text-bronze-200" aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block text-[11px] font-semibold tracking-wide text-bronze-200 sm:text-xs">{UNIT_NAME}</span>
              <span className="block text-base font-bold tracking-wide sm:text-lg">{APP_NAME}</span>
            </span>
          </Link>
        </div>
      </header>
      <main id="noi-dung" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {children}
      </main>
      <footer className="border-t border-cream-200 bg-olive-800 px-4 py-4 text-center text-xs text-olive-100">
        <p className="font-semibold text-bronze-200">{SLOGAN}</p>
        <p className="mt-1 opacity-80">Hệ thống nội bộ phục vụ tiếp nhận ý kiến. Không dùng để trao đổi thông tin bí mật.</p>
      </footer>
    </div>
  );
}
