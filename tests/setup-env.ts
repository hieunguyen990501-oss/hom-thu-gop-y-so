// Biến môi trường riêng cho kiểm thử (CSDL kiểm thử tách biệt, khóa mã hóa sinh ngẫu nhiên mỗi lần chạy).
import crypto from "node:crypto";

process.env.DATABASE_URL = `postgresql://postgres:test_only_pw@127.0.0.1:${process.env.TEST_DB_PORT ?? 54339}/homthu_test`;
process.env.APP_ENCRYPTION_KEY ??= crypto.randomBytes(32).toString("base64");
process.env.DISABLE_SCHEDULER = "true";
process.env.SESSION_IDLE_MINUTES = "30";
process.env.SESSION_MAX_HOURS = "8";

import { afterAll } from "vitest";
afterAll(async () => {
  const { prisma } = await import("@/server/db");
  await prisma.$disconnect();
});
