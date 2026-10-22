// Kiểm thử 16: sao lưu và khôi phục dữ liệu.
// Môi trường phát triển không có pg_dump (gói PostgreSQL nhúng chỉ có initdb/postgres/pg_ctl), nên kịch bản này
// kiểm thử phương án SAO LƯU MỨC TỆP (cold backup): dừng CSDL → sao chép thư mục dữ liệu → giả lập mất dữ liệu →
// khôi phục thư mục → khởi động → đối chiếu dữ liệu. Phương án pg_dump/pg_restore dùng trong Docker được mô tả
// trong docs/SAO-LUU-KHOI-PHUC.md và cần chạy thử trên máy chủ thật.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import pg from "pg";
import { startLocalPg, createDatabase, cacheRoot } from "./pg-local.mjs";

const PORT = 54349;
const PASSWORD = "backup_test_pw";
const root = path.join(cacheRoot(), "backup-test");
const dataDir = path.join(root, "data");
const backupDir = path.join(root, "backup-copy");
const url = `postgresql://postgres:${PASSWORD}@127.0.0.1:${PORT}/homthu_bk`;

const log = (m) => console.log(`[backup-test] ${m}`);
const fail = (m) => { console.error(`[backup-test] THẤT BẠI: ${m}`); process.exit(1); };

async function snapshot() {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  const fb = await c.query('SELECT code, title, status FROM "Feedback" ORDER BY code');
  const hist = await c.query('SELECT count(*)::int AS n FROM "FeedbackStatusHistory"');
  const audit = await c.query('SELECT count(*)::int AS n FROM "AuditLog"');
  const trig = await c.query("SELECT count(*)::int AS n FROM pg_trigger WHERE tgname LIKE '%append_only'");
  await c.end();
  const digest = crypto.createHash("sha256").update(JSON.stringify(fb.rows)).digest("hex");
  return { feedback: fb.rowCount, history: hist.rows[0].n, audit: audit.rows[0].n, triggers: trig.rows[0].n, digest };
}

fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(root, { recursive: true });

// 1. Tạo CSDL, áp dụng migration, nạp dữ liệu demo
let server = await startLocalPg({ dataDir, port: PORT, password: PASSWORD });
await createDatabase({ port: PORT, password: PASSWORD, name: "homthu_bk" });
const env = { ...process.env, DATABASE_URL: url, APP_ENCRYPTION_KEY: crypto.randomBytes(32).toString("base64"), SEED_OUTPUT_DIR: root };
execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
execSync("npx tsx prisma/seed.ts --demo", { env, stdio: "pipe" });
const before = await snapshot();
log(`Dữ liệu gốc: ${JSON.stringify(before)}`);
if (before.feedback < 20) fail("dữ liệu mẫu chưa được nạp");

// 2. Sao lưu: dừng CSDL, sao chép thư mục dữ liệu
await server.stop();
fs.cpSync(dataDir, backupDir, { recursive: true });
log(`Đã sao lưu thư mục dữ liệu → ${backupDir}`);

// 3. Giả lập sự cố: khởi động lại, xóa dữ liệu, rồi hủy toàn bộ thư mục dữ liệu
server = await startLocalPg({ dataDir, port: PORT, password: PASSWORD });
{
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  await c.query('TRUNCATE "Feedback" CASCADE');
  const n = (await c.query('SELECT count(*)::int AS n FROM "Feedback"')).rows[0].n;
  await c.end();
  if (n !== 0) fail("giả lập mất dữ liệu không thành công");
  log("Đã giả lập mất dữ liệu (Feedback = 0).");
}
await server.stop();
fs.rmSync(dataDir, { recursive: true, force: true });

// 4. Khôi phục: chép lại thư mục sao lưu, khởi động, đối chiếu
fs.cpSync(backupDir, dataDir, { recursive: true });
server = await startLocalPg({ dataDir, port: PORT, password: PASSWORD });
const after = await snapshot();
await server.stop();
log(`Sau khôi phục: ${JSON.stringify(after)}`);

if (JSON.stringify(before) !== JSON.stringify(after)) fail("dữ liệu sau khôi phục không khớp bản gốc");
log("ĐẠT: dữ liệu khôi phục khớp hoàn toàn (số hồ sơ, lịch sử, nhật ký, trigger bảo vệ, mã băm nội dung).");
fs.rmSync(root, { recursive: true, force: true });
