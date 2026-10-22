import { getCurrentActor } from "@/server/session";
import { can } from "@/server/rbac";
import { reportToExcel } from "@/server/services/reports";
import { AppError } from "@/server/errors";
import { periodRange } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getCurrentActor();
  if (!actor || actor.mustChangePassword) return new Response("Chưa đăng nhập", { status: 401 });
  if (!can(actor, "REPORT_EXPORT")) return new Response("Không có quyền", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const def = periodRange("month");
  const from = sp.get("from") ?? def.from;
  const to = sp.get("to") ?? def.to;
  try {
    const buf = await reportToExcel(actor, { from, to });
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="bao-cao-gop-y-${from}_${to}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(e instanceof AppError ? e.message : "Lỗi xuất báo cáo", { status: 400 });
  }
}
