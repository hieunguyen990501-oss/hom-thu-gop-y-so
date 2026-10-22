// Kiểm tra sức khỏe dịch vụ cho Docker healthcheck (không trả thông tin nhạy cảm).
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "db_error" }, { status: 503 });
  }
}
