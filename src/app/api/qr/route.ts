// Tải mã QR (PNG/SVG) sinh cục bộ. Yêu cầu quyền ADMIN_QR, ghi nhật ký.
import { getCurrentActor } from "@/server/session";
import { can } from "@/server/rbac";
import { qrPng, qrSvg } from "@/server/services/qr";
import { logAudit } from "@/server/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await getCurrentActor();
  if (!actor || actor.mustChangePassword) return new Response("Chưa đăng nhập", { status: 401 });
  if (!can(actor, "ADMIN_QR")) return new Response("Không có quyền", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const format = sp.get("format") === "svg" ? "svg" : "png";
  const inline = sp.get("inline") === "1";
  if (!inline) await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "qr.downloaded", metadata: { format } });
  const disposition = inline ? "inline" : `attachment; filename="ma-qr-hom-thu-gop-y.${format}"`;
  if (format === "svg") {
    return new Response(await qrSvg(), { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": disposition, "Cache-Control": "no-store" } });
  }
  const size = Number(sp.get("size")) || 1024;
  return new Response(new Uint8Array(await qrPng(size)), { headers: { "Content-Type": "image/png", "Content-Disposition": disposition, "Cache-Control": "no-store" } });
}
