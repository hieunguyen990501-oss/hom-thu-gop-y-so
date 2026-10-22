import { NextResponse } from "next/server";
import { getCurrentActor } from "@/server/session";
import { unreadCount } from "@/server/services/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ count: 0 }, { status: 401 });
  return NextResponse.json({ count: await unreadCount(actor) }, { headers: { "Cache-Control": "no-store" } });
}
