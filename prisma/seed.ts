// Khởi tạo dữ liệu nền; tạo tài khoản quản trị đầu tiên với mật khẩu NGẪU NHIÊN (không có mật khẩu mặc định).
// Dùng: npm run db:seed          → dữ liệu nền + quản trị viên đầu tiên
//       npm run db:seed-demo     → thêm tài khoản, hồ sơ demo và bật chế độ demo
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { seedCore } from "./seed-core";
import { seedDemo } from "./seed-demo";
import { hashSecret } from "../src/server/auth/password";
import { randomPassword } from "../src/server/auth/crypto";

const prisma = new PrismaClient();
// Thư mục ghi tệp mật khẩu tạm (trong Docker: volume runtime, chỉ đọc được từ bên trong máy chủ).
const outDir = process.env.SEED_OUTPUT_DIR || ".";

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
    const file = path.join(outDir, ".initial-admin.txt");
    fs.writeFileSync(file, msg, { mode: 0o600 });
    // Trong Docker không in mật khẩu ra log (log container có thể lưu lâu); chỉ báo vị trí tệp.
    if (process.env.SEED_OUTPUT_DIR) console.log(`Đã tạo tài khoản quản trị đầu tiên. Xem mật khẩu tạm trong ${file}`);
    else console.log("\n" + msg + `(Đã lưu vào ${file})\n`);
  }

  if (process.argv.includes("--demo")) {
    const lines = await seedDemo(prisma);
    const file = path.join(outDir, ".demo-accounts.txt");
    fs.writeFileSync(file, lines.join("\n") + "\n", { mode: 0o600 });
    console.log(lines.join("\n"));
    console.log(`\n(Đã lưu vào ${file})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
