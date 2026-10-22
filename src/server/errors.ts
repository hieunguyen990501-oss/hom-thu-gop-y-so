// Lỗi nghiệp vụ có thông điệp an toàn để hiển thị cho người dùng.
export class AppError extends Error {
  constructor(
    message: string,
    public code: "FORBIDDEN" | "NOT_FOUND" | "INVALID" | "CONFLICT" | "RATE_LIMITED" | "UNAUTHENTICATED" = "INVALID",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const forbidden = (msg = "Bạn không có quyền thực hiện thao tác này.") => new AppError(msg, "FORBIDDEN");
// Không phân biệt "không tồn tại" với "không có quyền" để tránh dò hồ sơ (IDOR).
export const notFound = (msg = "Không tìm thấy hồ sơ hoặc bạn không có quyền truy cập.") => new AppError(msg, "NOT_FOUND");
export const invalid = (msg: string) => new AppError(msg, "INVALID");

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function toActionError(e: unknown): { ok: false; error: string } {
  if (e instanceof AppError) return { ok: false, error: e.message };
  console.error("[action-error]", e instanceof Error ? e.name + ": " + e.message : "unknown");
  return { ok: false, error: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau hoặc báo quản trị viên." };
}
