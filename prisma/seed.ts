// Khởi tạo dữ liệu nền; tạo tài khoản quản trị đầu tiên với mật khẩu NGẪU NHIÊN (không có mật khẩu mặc định).
// Dùng: npm run db:seed          → dữ liệu nền + quản trị viên đầu tiên
//       npm run db:seed-demo     → thêm tài khoản, hồ sơ demo và bật chế độ demo
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { seedCore } from "./seed-core";
import { seedDemo } from "./seed-demo";
import { hashSecret } from "../src/server/auth/password";
import { randomPassword } from "../src/server/auth/crypto";

const prisma = new PrismaClient();

async function main() {
  await seedCore(prisma);
  console.log("✔ Đã khởi tạo vai trò, quyền, lĩnh vực, đơn vị mẫu.");

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });
  const hasAdmin = await prisma.user.count({ where: { roleId: adminRole.id, isDemo: false } });
  if (!hasAdmin) {
    const pw = randomPassword(16);
    await prisma.user.create({
      data: { username: "quantri", fullName: "Quản trị hệ thống", position: "Quản trị hệ thống", roleId: adminRole.id, passwordHash: await hashSecret(pw), mustChangePassword: true },
    });
    const msg = `Tài khoản quản trị đầu tiên\n  Tên đăng nhập: quantri\n  Mật khẩu tạm:  ${pw}\nBắt buộc đổi mật khẩu khi đăng nhập lần đầu. Xóa tệp này sau khi đã ghi nhận.\n`;
    fs.writeFileSync(".initial-admin.txt", msg, { mode: 0o600 });
    console.log("\n" + msg + "(Đã lưu vào .initial-admin.txt)\n");
  }

  if (process.argv.includes("--demo")) {
    const lines = await seedDemo(prisma);
    fs.writeFileSync(".demo-accounts.txt", lines.join("\n") + "\n", { mode: 0o600 });
    console.log(lines.join("\n"));
    console.log("\n(Đã lưu vào .demo-accounts.txt)");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
