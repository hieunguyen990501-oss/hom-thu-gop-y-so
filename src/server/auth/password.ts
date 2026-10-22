// Băm mật khẩu và mã bí mật tra cứu bằng Argon2id.
import { hash, verify } from "@node-rs/argon2";

const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const; // khuyến nghị OWASP

export function hashSecret(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifySecret(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

// Băm giả để thời gian phản hồi tương đương khi tài khoản/hồ sơ không tồn tại.
let dummyHash: Promise<string> | null = null;
export async function dummyVerify(plain: string): Promise<void> {
  dummyHash ??= hash("dummy-value-for-timing", OPTIONS);
  await verifySecret(await dummyHash, plain);
}
