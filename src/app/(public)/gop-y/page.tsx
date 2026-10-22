import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public/shell";
import { FeedbackForm } from "@/components/public/feedback-form";
import { publicFormOptions } from "@/server/services/public-feedback";
import { Alert } from "@/components/ui";

export const metadata: Metadata = { title: "Gửi ý kiến góp ý" };

export default async function SubmitPage() {
  const opts = await publicFormOptions();
  return (
    <PublicShell demo={opts.demoMode}>
      <div className="mb-4">
        <Link href="/" className="text-sm text-ink-muted hover:underline">← Trang chủ</Link>
        <h1 className="mt-1 text-xl font-bold">Gửi ý kiến góp ý</h1>
        <p className="text-sm text-ink-muted">Các mục có dấu <span className="text-brand-600">*</span> là bắt buộc.</p>
      </div>
      {opts.submissionsOpen ? (
        <FeedbackForm categories={opts.categories} units={opts.units} allowIdentified={opts.allowIdentified} />
      ) : (
        <Alert kind="warning">Hệ thống đang tạm dừng tiếp nhận góp ý mới. Vui lòng sử dụng kênh trực tiếp theo quy định của đơn vị.</Alert>
      )}
    </PublicShell>
  );
}
