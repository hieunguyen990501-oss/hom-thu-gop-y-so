// Mã hóa đối xứng AES-256-GCM cho dữ liệu nhạy cảm (thông tin người gửi, khóa TOTP)
// và các hàm sinh mã ngẫu nhiên an toàn.
import crypto from "node:crypto";

function key(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) throw new Error("Thiếu biến môi trường APP_ENCRYPTION_KEY");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("APP_ENCRYPTION_KEY phải là 32 byte mã hóa base64");
  return buf;
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decrypt(payload: string): string {
  const [v, ivB, tagB, encB] = payload.split(".");
  if (v !== "v1" || !ivB || !tagB || encB === undefined) throw new Error("Dữ liệu mã hóa không hợp lệ");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encB, "base64url")), decipher.final()]).toString("utf8");
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

// Bảng chữ không gây nhầm lẫn: bỏ 0/O, 1/I/L.
const SECRET_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomSecret(length = 12): string {
  let out = "";
  while (out.length < length) {
    const b = crypto.randomBytes(1)[0];
    if (b < 248) out += SECRET_ALPHABET[b % SECRET_ALPHABET.length]; // 248 = 31*8, tránh lệch phân phối
  }
  return out;
}

export function formatSecret(secret: string): string {
  return secret.match(/.{1,4}/g)?.join("-") ?? secret;
}

export function randomPassword(length = 16): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  while (out.length < length) {
    const b = crypto.randomBytes(1)[0];
    if (b < 228) out += alphabet[b % alphabet.length];
  }
  // bảo đảm có cả chữ và số
  return /\d/.test(out) && /[a-zA-Z]/.test(out) ? out : randomPassword(length);
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
