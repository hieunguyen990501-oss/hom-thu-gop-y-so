// Quản lý cookie phiên trong Next.js (chỉ dùng phía server).
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { validateSession } from "./services/auth";
import { type Actor, loadActor, can } from "./rbac";
import type { PermissionCode } from "@/lib/permissions";

export const SESSION_COOKIE = "htgy_session";

export function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true";
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "strict",
    path: "/",
    maxAge: Number(process.env.SESSION_MAX_HOURS || 8) * 3600,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export const getCurrentActor = cache(async (): Promise<Actor | null> => {
  const session = await validateSession(await getSessionToken());
  if (!session) return null;
  return loadActor(session.userId);
});

// Dùng trong trang quản trị: chưa đăng nhập → về trang đăng nhập; phải đổi mật khẩu → về trang đổi mật khẩu.
export async function requireActor(opts: { allowMustChange?: boolean } = {}): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/dang-nhap");
  if (actor.mustChangePassword && !opts.allowMustChange) redirect("/doi-mat-khau");
  return actor;
}

export async function requirePermission(perm: PermissionCode | PermissionCode[]): Promise<Actor> {
  const actor = await requireActor();
  const perms = Array.isArray(perm) ? perm : [perm];
  if (!perms.some((p) => can(actor, p))) redirect("/quan-tri?loi=khong-co-quyen");
  return actor;
}

// Dùng trong server action: không redirect, ném lỗi để action trả thông báo.
export async function actorForAction(): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) throw new (await import("./errors")).AppError("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.", "UNAUTHENTICATED");
  if (actor.mustChangePassword) throw new (await import("./errors")).AppError("Đồng chí cần đổi mật khẩu trước khi thao tác.", "FORBIDDEN");
  return actor;
}

// Địa chỉ máy khách — CHỈ dùng cho giới hạn tần suất (trong bộ nhớ) và nhật ký đăng nhập của cán bộ.
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  if (process.env.TRUST_PROXY === "true") {
    const xff = h.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim().slice(0, 64);
    const real = h.get("x-real-ip");
    if (real) return real.slice(0, 64);
  }
  return h.get("x-htgy-remote") ?? "local";
}
