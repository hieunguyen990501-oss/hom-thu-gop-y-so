// Giới hạn tần suất trong bộ nhớ tiến trình. Khóa (địa chỉ IP...) được băm kèm muối ngẫu nhiên
// sinh mỗi lần khởi động và tự hết hạn; KHÔNG ghi xuống CSDL hay nhật ký để không làm lộ người gửi.
import crypto from "node:crypto";

const salt = crypto.randomBytes(16).toString("hex");
const buckets = new Map<string, number[]>();

function k(scope: string, key: string) {
  return scope + ":" + crypto.createHash("sha256").update(salt + key).digest("hex").slice(0, 32);
}

export function rateLimit(scope: string, key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const id = k(scope, key);
  const now = Date.now();
  const arr = (buckets.get(id) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(id, arr);
    return { ok: false, retryAfterMs: windowMs - (now - arr[0]) };
  }
  arr.push(now);
  buckets.set(id, arr);
  return { ok: true, retryAfterMs: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}

// Dọn định kỳ để không giữ dữ liệu lâu hơn cần thiết.
const timer = setInterval(() => {
  const now = Date.now();
  for (const [id, arr] of buckets) if (arr.every((t) => now - t > 3_600_000)) buckets.delete(id);
}, 600_000);
timer.unref?.();
