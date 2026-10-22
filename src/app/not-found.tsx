import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-5xl font-bold text-brand-700">404</p>
      <p className="text-lg font-semibold">Không tìm thấy trang hoặc đồng chí không có quyền truy cập.</p>
      <Link href="/" className="btn-primary">Về trang chủ</Link>
    </div>
  );
}
