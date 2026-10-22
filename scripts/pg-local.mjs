// Tiện ích chạy PostgreSQL cục bộ từ gói @embedded-postgres (chỉ dùng cho phát triển và kiểm thử).
// Trên Windows, postgres.exe không chạy được từ đường dẫn có ký tự Unicode (ví dụ "Phần mềm"),
// vì vậy bộ chương trình được sao chép sang thư mục cache có đường dẫn ASCII.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";

function platformPackage() {
  const map = { win32: "windows", darwin: "darwin", linux: "linux" };
  const arch = process.arch === "x64" ? "x64" : process.arch;
  return `@embedded-postgres/${map[process.platform]}-${arch}`;
}

export function cacheRoot() {
  const base = process.env.LOCALAPPDATA || os.tmpdir();
  return path.join(base, "HomThuGopYSo");
}

function binDir() {
  const src = path.resolve("node_modules", platformPackage(), "native");
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(src)) return path.join(src, "bin");
  const dst = path.join(cacheRoot(), "pg-native");
  if (!fs.existsSync(path.join(dst, "bin"))) {
    fs.mkdirSync(dst, { recursive: true });
    fs.cpSync(src, dst, { recursive: true });
  }
  return path.join(dst, "bin");
}

const exe = (name) => (process.platform === "win32" ? `${name}.exe` : name);

export function waitForPort(port, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const s = net.connect(port, "127.0.0.1");
      s.on("connect", () => { s.end(); resolve(); });
      s.on("error", () => {
        if (Date.now() - started > timeoutMs) reject(new Error(`PostgreSQL không mở cổng ${port}`));
        else setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

export async function startLocalPg({ dataDir, port, password }) {
  const bin = binDir();
  if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
    fs.mkdirSync(dataDir, { recursive: true });
    const pwFile = path.join(os.tmpdir(), `pgpw-${process.pid}-${Date.now()}`);
    fs.writeFileSync(pwFile, password);
    const r = spawnSync(path.join(bin, exe("initdb")), [
      "-D", dataDir, "-U", "postgres", `--pwfile=${pwFile}`, "-A", "scram-sha-256", "-E", "UTF8", "--locale=C",
    ], { encoding: "utf8" });
    fs.rmSync(pwFile, { force: true });
    if (r.status !== 0) throw new Error(`initdb thất bại: ${r.stderr || r.stdout}`);
  }
  const child = spawn(path.join(bin, exe("postgres")), ["-D", dataDir, "-p", String(port), "-c", "listen_addresses=127.0.0.1", "-c", "TimeZone=UTC"], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  let errBuf = "";
  child.stderr.on("data", (d) => { errBuf = (errBuf + d).slice(-4000); });
  try {
    await waitForPort(port);
  } catch (e) {
    child.kill();
    throw new Error(`${e.message}\n${errBuf}`);
  }
  return {
    bin,
    async stop() {
      spawnSync(path.join(bin, exe("pg_ctl")), ["stop", "-D", dataDir, "-m", "fast", "-w"], { encoding: "utf8" });
      child.kill();
    },
  };
}

export async function createDatabase({ port, password, name }) {
  const { default: pg } = await import("pg");
  const client = new pg.Client({ host: "127.0.0.1", port, user: "postgres", password, database: "postgres" });
  await client.connect();
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
  if (exists.rowCount === 0) await client.query(`CREATE DATABASE "${name.replace(/"/g, "")}"`);
  await client.end();
}
