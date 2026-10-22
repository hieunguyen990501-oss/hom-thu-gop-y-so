"use client";
import { Alert } from "@/components/ui";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-3">
      <Alert kind="error" title="Không tải được trang">
        Đã xảy ra lỗi khi tải dữ liệu. Có thể phiên đăng nhập đã hết hạn hoặc đồng chí không có quyền với nội dung này.
      </Alert>
      <div className="flex gap-2">
        <button className="btn-outline" onClick={reset}>Thử lại</button>
        <a href="/quan-tri" className="btn-ghost">Về trang chính</a>
      </div>
    </div>
  );
}
