// Xuất danh sách hồ sơ ra Excel theo bộ lọc. Kiểm tra quyền tại server, ghi nhật ký xuất dữ liệu.
import { getCurrentActor } from "@/server/session";
import { can } from "@/server/rbac";
import { feedbackListToExcel } from "@/server/services/reports";
import { toVnIsoDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getCurrentActor();
  if (!actor || actor.mustChangePassword) return new Response("Chưa đăng nhập", { status: 401 });
  if (!can(actor, "REPORT_EXPORT")) return new Response("Không có quyền", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const buf = await feedbackListToExcel(actor, sp);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="danh-sach-gop-y-${toVnIsoDate(new Date())}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
