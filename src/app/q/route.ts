// Điểm vào cố định của mã QR: chuyển hướng nội bộ tới đường dẫn đích cấu hình trong trang quản trị.
// Chỉ chấp nhận đường dẫn nội bộ (bắt đầu bằng "/"), không chuyển hướng ra ngoài.
// Dùng Location tương đối để hoạt động đúng sau reverse proxy.
import { getSetting } from "@/server/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  let target = await getSetting("qr.targetPath");
  if (!/^\/[A-Za-z0-9\-._~/]*$/.test(target) || target.startsWith("//")) target = "/";
  return new Response(null, {
    status: 302,
    headers: { Location: target, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
