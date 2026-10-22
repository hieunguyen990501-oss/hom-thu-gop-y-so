// Chạy PostgreSQL cục bộ cho môi trường phát triển/thử nghiệm trên máy không có Docker.
// KHÔNG dùng cho triển khai chính thức (triển khai chính thức dùng docker-compose với postgres:17).
import path from "node:path";
import { startLocalPg, createDatabase, cacheRoot } from "./pg-local.mjs";

const dataDir = process.env.DEV_DB_DIR || path.join(cacheRoot(), "pgdata-dev");
const port = Number(process.env.DEV_DB_PORT || 54329);
const password = process.env.DEV_DB_PASSWORD || "devonly_local_pw";

const server = await startLocalPg({ dataDir, port, password });
await createDatabase({ port, password, name: "homthu" });
console.log(`PostgreSQL (dev) đang chạy tại localhost:${port}, CSDL "homthu". Dữ liệu: ${dataDir}`);

const shutdown = async () => { await server.stop(); process.exit(0); };
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
setInterval(() => {}, 1 << 30);
