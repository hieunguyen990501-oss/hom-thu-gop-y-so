// Kiểm thử xác thực (khóa tài khoản, phiên, TOTP), mã QR [13], chính sách lưu trữ.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PNG } from "pngjs";
import jsQR from "jsqr";
import { prisma } from "@/server/db";
import { beginTotpSetup, changePassword, confirmTotpSetup, createSession, login, validateSession, verifyMfa } from "@/server/services/auth";
import { totpCode } from "@/server/auth/totp";
import { qrPng, qrSvg, qrTargetUrl } from "@/server/services/qr";
import { purgeExpired, updateSettings, validateTargetPath } from "@/server/services/admin";
import { setSetting } from "@/server/settings";
import { loadActor } from "@/server/rbac";
import { makeUser, resetDb, submitSample, TEST_PASSWORD } from "./helpers";

beforeEach(resetDb);

describe("Đăng nhập, phiên", () => {
  it("đăng nhập đúng tạo phiên; sai 5 lần thì khóa tạm", async () => {
    const u = await makeUser("RECEIVER");
    const ok = await login({ username: u.username.toUpperCase(), password: TEST_PASSWORD }, "10.0.0.1");
    expect(ok.mfaRequired).toBe(false);
    const session = await prisma.session.findFirstOrThrow({ where: { userId: u.id } });
    expect(session.tokenHash).not.toBe(ok.token); // chỉ lưu băm của token
    expect(await validateSession(ok.token)).not.toBeNull();

    for (let i = 0; i < 4; i++) await expect(login({ username: u.username, password: "sai-mat-khau-1" }, "10.0.0.1")).rejects.toThrow(/không đúng/);
    await expect(login({ username: u.username, password: "sai-mat-khau-1" }, "10.0.0.1")).rejects.toThrow(/khóa tạm/);
    await expect(login({ username: u.username, password: TEST_PASSWORD }, "10.0.0.1")).rejects.toThrow(/tạm khóa/);
    await expect(login({ username: "khong-ton-tai", password: "x" }, null)).rejects.toThrow(/không đúng/);
    expect(await prisma.auditLog.count({ where: { action: "auth.locked" } })).toBe(1);
  });

  it("phiên hết hạn khi không hoạt động quá thời gian quy định", async () => {
    const u = await makeUser("HANDLER");
    const token = await createSession(u.id, false);
    await prisma.session.updateMany({ where: { userId: u.id }, data: { lastSeenAt: new Date(Date.now() - 31 * 60_000) } });
    expect(await validateSession(token)).toBeNull();
    expect(await prisma.session.count({ where: { userId: u.id } })).toBe(0);
    expect(await validateSession("token-gia-mao")).toBeNull();
  });

  it("đổi mật khẩu kiểm tra chính sách, hủy các phiên khác", async () => {
    const u = await makeUser("HANDLER");
    const t1 = await createSession(u.id, false);
    const t2 = await createSession(u.id, false);
    await expect(changePassword(u, { currentPassword: TEST_PASSWORD, newPassword: "ngan1", confirmPassword: "ngan1" })).rejects.toThrow(/10 ký tự/);
    await expect(changePassword(u, { currentPassword: TEST_PASSWORD, newPassword: "chicochuthoi", confirmPassword: "chicochuthoi" })).rejects.toThrow(/chữ và số/);
    await expect(changePassword(u, { currentPassword: "sai", newPassword: "MatKhauMoi2026", confirmPassword: "MatKhauMoi2026" })).rejects.toThrow(/hiện tại/);
    await changePassword(u, { currentPassword: TEST_PASSWORD, newPassword: "MatKhauMoi2026", confirmPassword: "MatKhauMoi2026" }, t1);
    expect(await validateSession(t1)).not.toBeNull();
    expect(await validateSession(t2)).toBeNull();
  });

  it("xác thực hai yếu tố TOTP", async () => {
    const u = await makeUser("LEADER");
    const { secret } = await beginTotpSetup(u);
    await expect(confirmTotpSetup(u, "000000")).rejects.toThrow(/không đúng/);
    await confirmTotpSetup(u, totpCode(secret));
    const r = await login({ username: u.username, password: TEST_PASSWORD }, null);
    expect(r.mfaRequired).toBe(true);
    expect(await validateSession(r.token)).toBeNull(); // phiên chờ xác thực chưa dùng được
    await expect(verifyMfa(r.token, "123456", null)).rejects.toThrow(/không đúng/);
    const done = await verifyMfa(r.token, totpCode(secret), null);
    expect(await validateSession(done.token)).not.toBeNull();
    expect(await validateSession(r.token, { allowMfaPending: true })).toBeNull(); // phiên cũ đã hủy
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(stored.totpSecretEnc).not.toContain(secret);
  });

  it("tài khoản bị khóa (isActive=false) không còn quyền", async () => {
    const u = await makeUser("RECEIVER");
    await prisma.user.update({ where: { id: u.id }, data: { isActive: false } });
    expect(await loadActor(u.id)).toBeNull();
  });
});

describe("Mã QR", () => {
  it("[13] sinh PNG đọc lại được đúng địa chỉ, SVG hợp lệ, đổi địa chỉ qua cấu hình", async () => {
    const admin = await makeUser("ADMIN");
    await updateSettings(admin, { "qr.publicBaseUrl": "https://gopy.lu572.local/" });
    expect(await qrTargetUrl()).toBe("https://gopy.lu572.local/q");
    const png = PNG.sync.read(await qrPng(600));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(decoded?.data).toBe("https://gopy.lu572.local/q");
    const svg = await qrSvg();
    expect(svg.startsWith("<svg")).toBe(true);
  });

  it("chặn chuyển hướng mở và địa chỉ không hợp lệ", async () => {
    const admin = await makeUser("ADMIN");
    expect(validateTargetPath("/gop-y")).toBe("/gop-y");
    expect(() => validateTargetPath("https://evil.example")).toThrow();
    expect(() => validateTargetPath("//evil.example")).toThrow();
    expect(() => validateTargetPath("/a?x=<script>")).toThrow();
    await expect(updateSettings(admin, { "qr.publicBaseUrl": "javascript:alert(1)" })).rejects.toThrow();
    await expect(updateSettings(admin, { "qr.publicBaseUrl": "https://user:pw@host" })).rejects.toThrow();
  });
});

describe("Lưu trữ", () => {
  it("xóa hồ sơ hết hạn lưu trữ qua thủ tục được phép, giữ hồ sơ còn hạn, ghi nhật ký", async () => {
    const admin = await makeUser("ADMIN");
    await setSetting("retention.closedMonths", 12);
    const old = await submitSample();
    const recent = await submitSample();
    await prisma.feedback.update({ where: { id: old.id }, data: { status: "RESOLVED", closedAt: new Date(Date.now() - 400 * 86_400_000) } });
    await prisma.feedback.update({ where: { id: recent.id }, data: { status: "RESOLVED", closedAt: new Date() } });
    await expect(purgeExpired(admin, "xoa")).rejects.toThrow(/XOA DU LIEU/);
    expect(await purgeExpired(admin, "XOA DU LIEU")).toBe(1);
    expect(await prisma.feedback.count()).toBe(1);
    expect(await prisma.feedbackStatusHistory.count({ where: { feedbackId: old.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "retention.purged" } })).toBe(1);
    // Sau thủ tục, cờ cho phép xóa không còn hiệu lực
    await expect(prisma.feedbackStatusHistory.deleteMany({})).rejects.toThrow();
  });
});

vi.setConfig({ testTimeout: 60000 });
