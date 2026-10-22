"use server";
import { revalidatePath } from "next/cache";
import { actorForAction } from "@/server/session";
import { toActionError } from "@/server/errors";
import * as admin from "@/server/services/admin";
import type { FormState } from "@/components/ui/action-form";
import type { SettingsShape } from "@/server/settings";

const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};
const b = (fd: FormData, k: string) => fd.get(k) === "on";

function userInput(fd: FormData): admin.UserInput {
  return {
    username: s(fd, "username"),
    fullName: s(fd, "fullName"),
    rank: s(fd, "rank"),
    position: s(fd, "position"),
    roleCode: s(fd, "roleCode"),
    unitId: s(fd, "unitId"),
    isActive: fd.has("isActive") ? fd.getAll("isActive").includes("on") : true,
    isIndependentContact: b(fd, "isIndependentContact"),
    categoryIds: fd.getAll("categoryIds").map(String),
  };
}

async function wrap(path: string, fn: () => Promise<string | void>, ok: string): Promise<FormState> {
  let extra: string | void;
  try {
    extra = await fn();
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath(path);
  return { ok: true, message: extra ? `${ok} ${extra}` : ok };
}

export async function createUserAction(_: FormState, fd: FormData) {
  return wrap("/quan-tri/he-thong/nguoi-dung", async () => {
    const r = await admin.createUser(await actorForAction(), { ...userInput(fd), isActive: true });
    return `Mật khẩu tạm: ${r.tempPassword} — chỉ hiển thị một lần, giao trực tiếp cho người dùng; bắt buộc đổi khi đăng nhập lần đầu.`;
  }, "Đã tạo tài khoản.");
}

export async function updateUserAction(_: FormState, fd: FormData) {
  return wrap("/quan-tri/he-thong/nguoi-dung", async () => admin.updateUser(await actorForAction(), s(fd, "id"), userInput(fd)), "Đã cập nhật tài khoản.");
}

export async function resetPasswordAction(_: FormState, fd: FormData) {
  return wrap("/quan-tri/he-thong/nguoi-dung", async () => {
    const pw = await admin.resetUserPassword(await actorForAction(), s(fd, "id"));
    return `Mật khẩu tạm mới: ${pw} — chỉ hiển thị một lần. Xác thực hai yếu tố của tài khoản đã được tắt.`;
  }, "Đã cấp lại mật khẩu.");
}

export async function unlockUserAction(_: FormState, fd: FormData) {
  return wrap("/quan-tri/he-thong/nguoi-dung", async () => admin.unlockUser(await actorForAction(), s(fd, "id")), "Đã mở khóa tài khoản.");
}

export async function saveCategoryAction(_: FormState, fd: FormData) {
  return wrap("/quan-tri/he-thong/danh-muc", async () =>
    admin.saveCategory(await actorForAction(), { id: s(fd, "id") || undefined, name: s(fd, "name"), description: s(fd, "description"), keywords: s(fd, "keywords"), slaDays: s(fd, "slaDays"), sortOrder: s(fd, "sortOrder"), isActive: s(fd, "id") ? b(fd, "isActive") : true }), "Đã lưu lĩnh vực.");
}

export async function saveUnitAction(_: FormState, fd: FormData) {
  return wrap("/quan-tri/he-thong/danh-muc", async () =>
    admin.saveUnit(await actorForAction(), { id: s(fd, "id") || undefined, name: s(fd, "name"), code: s(fd, "code"), parentId: s(fd, "parentId"), isHandlingUnit: b(fd, "isHandlingUnit"), isSenderSelectable: b(fd, "isSenderSelectable"), isActive: s(fd, "id") ? b(fd, "isActive") : true, sortOrder: s(fd, "sortOrder") }), "Đã lưu đơn vị.");
}

export async function saveSettingsAction(_: FormState, fd: FormData) {
  return wrap("/quan-tri/he-thong/cau-hinh", async () => {
    const patch: Partial<SettingsShape> = {
      "public.submissionsOpen": b(fd, "submissionsOpen"),
      "public.allowIdentified": b(fd, "allowIdentified"),
      "public.rateLimitPerHour": Number(s(fd, "rateLimitPerHour")),
      "workflow.requireApproval": b(fd, "requireApproval"),
      "sla.days": { NORMAL: Number(s(fd, "slaNormal")), ATTENTION: Number(s(fd, "slaAttention")), HIGH: Number(s(fd, "slaHigh")) },
      "sla.dueSoonDays": Number(s(fd, "dueSoonDays")),
      "retention.closedMonths": Number(s(fd, "retentionMonths")),
      "security.requireTotpRoles": fd.getAll("totpRoles").map(String),
    };
    await admin.updateSettings(await actorForAction(), patch);
  }, "Đã lưu cấu hình.");
}

export async function setDemoModeAction(_: FormState, fd: FormData) {
  return wrap("/quan-tri", async () => admin.updateSettings(await actorForAction(), { "system.demoMode": s(fd, "demo") === "on" }), "Đã chuyển chế độ.");
}

export async function saveTemplateAction(_: FormState, fd: FormData) {
  return wrap("/quan-tri/he-thong/mau-tra-loi", async () =>
    admin.saveTemplate(await actorForAction(), { id: s(fd, "id") || undefined, title: s(fd, "title"), content: s(fd, "content"), isActive: s(fd, "id") ? b(fd, "isActive") : true }), "Đã lưu mẫu (cần phê duyệt trước khi sử dụng).");
}

export async function approveTemplateAction(_: FormState, fd: FormData) {
  return wrap("/quan-tri/he-thong/mau-tra-loi", async () => admin.approveTemplate(await actorForAction(), s(fd, "id")), "Đã phê duyệt mẫu.");
}

export async function purgeExpiredAction(_: FormState, fd: FormData) {
  return wrap("/quan-tri/he-thong/luu-tru", async () => {
    const n = await admin.purgeExpired(await actorForAction(), s(fd, "confirm"));
    return `Đã xóa ${n} hồ sơ.`;
  }, "Hoàn tất.");
}

export async function purgeDemoAction(_: FormState, fd: FormData) {
  return wrap("/quan-tri", async () => {
    const r = await admin.purgeDemoData(await actorForAction(), s(fd, "confirm"));
    return `Đã xóa ${r.feedback} hồ sơ demo, vô hiệu hóa ${r.usersDisabled} tài khoản demo, tắt chế độ demo.`;
  }, "Hoàn tất.");
}
