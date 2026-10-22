"use server";
// Server action xử lý hồ sơ. Quyền và phạm vi được kiểm tra trong tầng dịch vụ (server), không dựa vào giao diện.
import { revalidatePath } from "next/cache";
import { actorForAction } from "@/server/session";
import { toActionError } from "@/server/errors";
import * as svc from "@/server/services/feedback-admin";
import type { FormState } from "@/components/ui/action-form";

const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

async function run(fd: FormData, fn: (actor: Awaited<ReturnType<typeof actorForAction>>, id: string) => Promise<unknown>, ok: string): Promise<FormState> {
  const id = s(fd, "id");
  try {
    const actor = await actorForAction();
    await fn(actor, id);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath(`/quan-tri/gop-y/${id}`);
  revalidatePath("/quan-tri/gop-y");
  return { ok: true, message: ok };
}

export async function classifyAction(_: FormState, fd: FormData) {
  return run(fd, (a, id) => svc.classifyFeedback(a, id, { categoryId: s(fd, "categoryId"), type: s(fd, "type"), priority: s(fd, "priority"), needsLeaderReview: fd.get("needsLeaderReview") === "on", note: s(fd, "note") }), "Đã lưu phân loại.");
}

export async function assignAction(_: FormState, fd: FormData) {
  return run(fd, (a, id) => svc.assignFeedback(a, id, { unitId: s(fd, "unitId"), userId: s(fd, "userId"), dueDate: s(fd, "dueDate"), note: s(fd, "note") }), "Đã phân công xử lý.");
}

export async function statusAction(_: FormState, fd: FormData) {
  return run(fd, (a, id) => svc.changeStatus(a, id, { to: s(fd, "to"), note: s(fd, "note") }), "Đã cập nhật trạng thái.");
}

export async function requestInfoAction(_: FormState, fd: FormData) {
  return run(fd, (a, id) => svc.requestMoreInfo(a, id, { content: s(fd, "content") }), "Đã gửi yêu cầu bổ sung cho người gửi.");
}

export async function submitResponseAction(_: FormState, fd: FormData) {
  return run(fd, (a, id) => svc.submitResponse(a, id, { content: s(fd, "content"), conclusion: s(fd, "conclusion") }), "Đã lưu kết quả xử lý.");
}

export async function reviewAction(_: FormState, fd: FormData) {
  const approve = s(fd, "decision") === "approve";
  return run(fd, (a, id) => svc.reviewResponse(a, id, { responseId: s(fd, "responseId"), approve, content: s(fd, "content"), reason: s(fd, "reason") }), approve ? "Đã phê duyệt và công bố kết quả cho người gửi." : "Đã trả lại để xử lý tiếp.");
}

export async function closeAction(_: FormState, fd: FormData) {
  return run(fd, (a, id) => svc.closeWithoutAction(a, id, { reason: s(fd, "reason"), publicNote: s(fd, "publicNote") }), "Đã kết thúc hồ sơ.");
}

export async function transferAction(_: FormState, fd: FormData) {
  return run(fd, (a, id) => svc.transferFeedback(a, id, { reason: s(fd, "reason"), target: s(fd, "target") }), "Đã chuyển đầu mối có thẩm quyền.");
}

export async function reopenAction(_: FormState, fd: FormData) {
  return run(fd, (a, id) => svc.reopenFeedback(a, id, { reason: s(fd, "reason") }), "Đã mở lại hồ sơ.");
}

export async function noteAction(_: FormState, fd: FormData) {
  return run(fd, (a, id) => svc.addInternalNote(a, id, { content: s(fd, "content") }), "Đã thêm ghi chú nội bộ.");
}

export async function restrictAction(_: FormState, fd: FormData) {
  return run(fd, (a, id) => svc.restrictAccess(a, id, { userId: s(fd, "userId"), reason: s(fd, "reason") }), "Đã loại trừ quyền truy cập.");
}

export async function senderInfoAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const actor = await actorForAction();
    const info = await svc.getSenderInfo(actor, s(fd, "id"));
    if (!info) return { ok: true, message: "Hồ sơ không có thông tin người gửi." };
    return { ok: true, data: info as unknown as Record<string, unknown> };
  } catch (e) {
    return toActionError(e);
  }
}
