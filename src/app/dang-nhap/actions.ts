"use server";
import { redirect } from "next/navigation";
import { AppError } from "@/server/errors";
import { changePassword, destroySession, login, verifyMfa } from "@/server/services/auth";
import { clearSessionCookie, clientIp, getCurrentActor, getSessionToken, setSessionCookie } from "@/server/session";
import type { FormState } from "@/components/ui/action-form";

function msg(e: unknown): FormState {
  if (e instanceof AppError) return { ok: false, error: e.message };
  console.error("[auth-action]", e instanceof Error ? e.name : "unknown");
  return { ok: false, error: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại." };
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  let next = "/quan-tri";
  try {
    const r = await login({ username: fd.get("username"), password: fd.get("password") }, await clientIp());
    await setSessionCookie(r.token);
    if (r.mfaRequired) next = "/dang-nhap/xac-thuc";
    else if (r.mustChangePassword) next = "/doi-mat-khau";
  } catch (e) {
    return msg(e);
  }
  redirect(next);
}

export async function mfaAction(_: FormState, fd: FormData): Promise<FormState> {
  let next = "/quan-tri";
  try {
    const token = await getSessionToken();
    if (!token) return { ok: false, error: "Phiên xác thực đã hết hạn, vui lòng đăng nhập lại." };
    const r = await verifyMfa(token, String(fd.get("code") ?? ""), await clientIp());
    await setSessionCookie(r.token);
    if (r.mustChangePassword) next = "/doi-mat-khau";
  } catch (e) {
    return msg(e);
  }
  redirect(next);
}

export async function logoutAction() {
  const token = await getSessionToken();
  const actor = await getCurrentActor();
  await destroySession(token, actor);
  await clearSessionCookie();
  redirect("/dang-nhap");
}

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const actor = await getCurrentActor();
    if (!actor) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
    await changePassword(actor, Object.fromEntries(fd), await getSessionToken());
  } catch (e) {
    return msg(e);
  }
  redirect("/quan-tri?doi-mat-khau=ok");
}
