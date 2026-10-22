import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/shell";
import { LookupPanel } from "@/components/public/lookup";
import { getSetting } from "@/server/settings";

export const metadata: Metadata = { title: "Tra cứu kết quả xử lý" };

export default async function LookupPage() {
  const demo = await getSetting("system.demoMode");
  return (
    <PublicShell demo={demo}>
      <div className="mb-4">
        <Link href="/" className="text-sm text-ink-muted hover:underline">← Trang chủ</Link>
        <h1 className="mt-1 text-xl font-bold">Tra cứu kết quả xử lý</h1>
        <p className="text-sm text-ink-muted">Nhập mã hồ sơ và mã bí mật được cấp khi gửi ý kiến.</p>
      </div>
      <LookupPanel />
    </PublicShell>
  );
}
