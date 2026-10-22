import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Hòm thư góp ý số – Lữ đoàn Pháo binh 572", template: "%s – Hòm thư góp ý số" },
  description: "Kênh tiếp nhận ý kiến, kiến nghị, phản ánh và đề xuất của cán bộ, chiến sĩ Lữ đoàn Pháo binh 572 – Quân khu 5.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
  referrer: "no-referrer",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#741c1c" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers(); // buộc render động để áp dụng nonce CSP cho từng yêu cầu
  return (
    <html lang="vi">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
