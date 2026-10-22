// Sinh tệp .env với khóa ngẫu nhiên. Không ghi đè nếu .env đã tồn tại.
import fs from "node:fs";
import crypto from "node:crypto";

if (fs.existsSync(".env")) {
  console.log(".env đã tồn tại, không ghi đè.");
  process.exit(0);
}
const template = fs.readFileSync(".env.example", "utf8");
const out = template
  .replace("APP_ENCRYPTION_KEY=", `APP_ENCRYPTION_KEY=${crypto.randomBytes(32).toString("base64")}`)
  .replace(/^POSTGRES_PASSWORD=.*$/m, `POSTGRES_PASSWORD=${crypto.randomBytes(18).toString("base64url")}`);
fs.writeFileSync(".env", out, { mode: 0o600 });
console.log("Đã tạo .env với khóa mã hóa ngẫu nhiên.");
