// Khởi động PostgreSQL cục bộ riêng cho kiểm thử, áp dụng migration và dữ liệu nền.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
// @ts-expect-error - mô-đun JS thuần
import { startLocalPg, createDatabase, cacheRoot } from "../scripts/pg-local.mjs";

const PORT = Number(process.env.TEST_DB_PORT ?? 54339);
const PASSWORD = "test_only_pw";

export default async function setup() {
  const dataDir = path.join(cacheRoot(), "pgdata-test");
  fs.rmSync(dataDir, { recursive: true, force: true });
  const server = await startLocalPg({ dataDir, port: PORT, password: PASSWORD });
  await createDatabase({ port: PORT, password: PASSWORD, name: "homthu_test" });
  const env = { ...process.env, DATABASE_URL: `postgresql://postgres:${PASSWORD}@127.0.0.1:${PORT}/homthu_test` };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  return async () => {
    await server.stop();
  };
}
