"use server";
// Server action cho cổng góp ý. Next.js tự kiểm tra Origin/Host (chống CSRF) cho mọi server action.
// Địa chỉ IP chỉ dùng làm khóa giới hạn tần suất trong bộ nhớ, không lưu vào hồ sơ hay nhật ký.
import { clientIp } from "@/server/session";
import { AppError } from "@/server/errors";
import {
  addSenderMessage,
  lookupFeedback,
  submitFeedback,
  submitSatisfaction,
  ValidationFailure,
  type PublicFeedbackView,
  type SubmitResult,
} from "@/server/services/public-feedback";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fail(e: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (e instanceof ValidationFailure) return { ok: false, error: e.message, fieldErrors: e.fields };
  if (e instanceof AppError) return { ok: false, error: e.message };
  console.error("[public-action]", e instanceof Error ? e.name : "unknown");
  return { ok: false, error: "Hệ thống đang bận hoặc gặp sự cố. Vui lòng thử lại sau." };
}

export async function submitFeedbackAction(input: Record<string, unknown>): Promise<Result<SubmitResult>> {
  try {
    // Trường bẫy chống gửi tự động: người dùng thật không nhìn thấy và không điền.
    if (typeof input.website === "string" && input.website.length > 0) return { ok: false, error: "Không thể gửi ý kiến. Vui lòng thử lại." };
    const startedAt = Number(input.startedAt);
    if (Number.isFinite(startedAt) && Date.now() - startedAt < 3000) return { ok: false, error: "Thao tác quá nhanh, vui lòng kiểm tra lại nội dung rồi gửi." };
    const data = await submitFeedback(input, { clientKey: (await clientIp()) ?? undefined });
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

export async function lookupAction(input: { code: string; secret: string }): Promise<Result<PublicFeedbackView>> {
  try {
    return { ok: true, data: await lookupFeedback(input, { clientKey: (await clientIp()) ?? undefined }) };
  } catch (e) {
    return fail(e);
  }
}

export async function senderMessageAction(input: { code: string; secret: string; content: string }): Promise<Result<PublicFeedbackView>> {
  try {
    return { ok: true, data: await addSenderMessage(input, { clientKey: (await clientIp()) ?? undefined }) };
  } catch (e) {
    return fail(e);
  }
}

export async function satisfactionAction(input: { code: string; secret: string; satisfaction: string; comment?: string }): Promise<Result<PublicFeedbackView>> {
  try {
    return { ok: true, data: await submitSatisfaction(input, { clientKey: (await clientIp()) ?? undefined }) };
  } catch (e) {
    return fail(e);
  }
}
