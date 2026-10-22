// Xác thực cán bộ: đăng nhập, khóa tạm khi sai nhiều lần, phiên đăng nhập, TOTP, đổi mật khẩu.
import { prisma } from "../db";
import { AppError, invalid } from "../errors";
import { logAudit } from "../audit";
import { dummyVerify, hashSecret, verifySecret } from "../auth/password";
import { decrypt, encrypt, randomToken, sha256 } from "../auth/crypto";
import { generateTotpSecret, totpUri, verifyTotp } from "../auth/totp";
import { rateLimit } from "../rate-limit";
import { getSetting } from "../settings";
import { changePasswordSchema, firstError, loginSchema } from "@/lib/validation";
import type { Actor } from "../rbac";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

const idleMs = () => Number(process.env.SESSION_IDLE_MINUTES || 30) * 60_000;
const maxMs = () => Number(process.env.SESSION_MAX_HOURS || 8) * 3_600_000;

const GENERIC = "Tên đăng nhập hoặc mật khẩu không đúng.";

export async function login(raw: unknown, ip: string | null): Promise<{ token: string; mfaRequired: boolean; mustChangePassword: boolean }> {
  if (ip && !rateLimit("login-ip", ip, 20, 15 * 60_000).ok) throw new AppError("Quá nhiều lần đăng nhập. Vui lòng thử lại sau.", "RATE_LIMITED");
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) throw invalid(firstError(parsed.error));
  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive || (user.isDemo && !(await getSetting("system.demoMode")))) {
    await dummyVerify(password);
    await logAudit({ action: "auth.login_failed", actorLabel: username.slice(0, 60), ipAddress: ip, metadata: { reason: "unknown_or_inactive" } });
    throw invalid(GENERIC);
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(`Tài khoản tạm khóa do đăng nhập sai nhiều lần. Thử lại sau ${LOCK_MINUTES} phút hoặc liên hệ quản trị viên.`, "RATE_LIMITED");
  }
  const ok = await verifySecret(user.passwordHash, password);
  if (!ok) {
    const fails = user.failedLoginCount + 1;
    const lock = fails >= MAX_FAILED_LOGINS;
    await prisma.user.update({
      where: { id: user.id },
      data: lock ? { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLoginCount: fails },
    });
    await logAudit({ actorId: user.id, actorLabel: user.username, action: lock ? "auth.locked" : "auth.login_failed", ipAddress: ip, metadata: { fails } });
    throw invalid(lock ? `Sai mật khẩu ${MAX_FAILED_LOGINS} lần, tài khoản bị khóa tạm ${LOCK_MINUTES} phút.` : GENERIC);
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  const token = await createSession(user.id, user.totpEnabled);
  if (!user.totpEnabled) {
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await logAudit({ actorId: user.id, actorLabel: user.username, action: "auth.login", ipAddress: ip });
  }
  return { token, mfaRequired: user.totpEnabled, mustChangePassword: user.mustChangePassword };
}

export async function createSession(userId: string, mfaPending: boolean): Promise<string> {
  const token = randomToken(32);
  await prisma.session.create({
    data: { tokenHash: sha256(token), userId, mfaPending, expiresAt: new Date(Date.now() + maxMs()) },
  });
  // Dọn phiên hết hạn
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return token;
}

export async function validateSession(token: string | undefined, opts: { allowMfaPending?: boolean } = {}) {
  if (!token || token.length > 100) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token) } });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() < now || now - session.lastSeenAt.getTime() > idleMs()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (session.mfaPending && !opts.allowMfaPending) return null;
  if (now - session.lastSeenAt.getTime() > 60_000) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } }).catch(() => {});
  }
  return session;
}

export async function verifyMfa(token: string, code: string, ip: string | null) {
  const session = await validateSession(token, { allowMfaPending: true });
  if (!session || !session.mfaPending) throw invalid("Phiên xác thực đã hết hạn, vui lòng đăng nhập lại.");
  if (!rateLimit("totp", session.id, 5, 10 * 60_000).ok) {
    await prisma.session.delete({ where: { id: session.id } });
    throw invalid("Nhập sai mã quá nhiều lần, vui lòng đăng nhập lại.");
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!user.totpEnabled || !user.totpSecretEnc || !verifyTotp(decrypt(user.totpSecretEnc), code)) {
    await logAudit({ actorId: user.id, actorLabel: user.username, action: "auth.totp_failed", ipAddress: ip });
    throw invalid("Mã xác thực không đúng.");
  }
  // Cấp phiên mới (chống cố định phiên) và xóa phiên chờ.
  await prisma.session.delete({ where: { id: session.id } });
  const newToken = await createSession(user.id, false);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logAudit({ actorId: user.id, actorLabel: user.username, action: "auth.login", ipAddress: ip, metadata: { mfa: true } });
  return { token: newToken, mustChangePassword: user.mustChangePassword };
}

export async function destroySession(token: string | undefined, actor?: Actor | null) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  if (actor) await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "auth.logout" });
}

export async function changePassword(actor: Actor, raw: unknown, currentToken?: string) {
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) throw invalid(firstError(parsed.error));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await verifySecret(user.passwordHash, parsed.data.currentPassword))) throw invalid("Mật khẩu hiện tại không đúng.");
  if (parsed.data.newPassword.toLowerCase().includes(user.username.toLowerCase())) throw invalid("Mật khẩu không được chứa tên đăng nhập.");
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashSecret(parsed.data.newPassword), mustChangePassword: false, passwordChangedAt: new Date() },
  });
  // Đăng xuất các phiên khác
  await prisma.session.deleteMany({ where: { userId: user.id, ...(currentToken ? { tokenHash: { not: sha256(currentToken) } } : {}) } });
  await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "auth.password_changed" });
}

// TOTP: bước 1 sinh khóa tạm (lưu mã hóa, chưa bật), bước 2 xác nhận bằng mã 6 số thì mới bật.
export async function beginTotpSetup(actor: Actor) {
  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: actor.id }, data: { totpSecretEnc: encrypt(secret), totpEnabled: false } });
  return { secret, uri: totpUri(secret, actor.username) };
}

export async function confirmTotpSetup(actor: Actor, code: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!user.totpSecretEnc) throw invalid("Chưa khởi tạo xác thực hai yếu tố.");
  if (!verifyTotp(decrypt(user.totpSecretEnc), code)) throw invalid("Mã xác thực không đúng, vui lòng thử lại.");
  await prisma.user.update({ where: { id: actor.id }, data: { totpEnabled: true } });
  await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "auth.totp_enabled" });
}

export async function disableTotp(actor: Actor, password: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await verifySecret(user.passwordHash, String(password ?? "")))) throw invalid("Mật khẩu không đúng.");
  await prisma.user.update({ where: { id: actor.id }, data: { totpEnabled: false, totpSecretEnc: null } });
  await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "auth.totp_disabled" });
}
