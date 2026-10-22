// Tạo thêm tài khoản quản trị hệ thống hoặc cấp lại mật khẩu khi bị mất quyền truy cập.
// Dùng: npx tsx scripts/create-admin.ts <tên-đăng-nhập> "<Họ và tên>"
import { PrismaClient } from "@prisma/client";
import { hashSecret } from "../src/server/auth/password";
import { randomPassword } from "../src/server/auth/crypto";

const prisma = new PrismaClient();

async function main() {
  const [username, fullName = "Quản trị hệ thống"] = process.argv.slice(2);
  if (!username || !/^[a-z0-9._-]{3,40}$/.test(username)) {
    console.error('Dùng: npx tsx scripts/create-admin.ts <tên-đăng-nhập> "<Họ và tên>"');
    process.exit(1);
  }
  const role = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });
  const pw = randomPassword(16);
  const hash = await hashSecret(pw);
  await prisma.user.upsert({
    where: { username },
    create: { username, fullName, roleId: role.id, passwordHash: hash, mustChangePassword: true },
    update: { roleId: role.id, passwordHash: hash, mustChangePassword: true, isActive: true, failedLoginCount: 0, lockedUntil: null, totpEnabled: false, totpSecretEnc: null },
  });
  await prisma.auditLog.create({ data: { action: "user.password_reset", actorLabel: "cli", entityType: "User", metadata: { username, via: "create-admin" } } });
  console.log(`Tài khoản quản trị: ${username}\nMật khẩu tạm: ${pw}\n(Bắt buộc đổi khi đăng nhập lần đầu)`);
}

main().finally(() => prisma.$disconnect());
