// Quản trị hệ thống: tài khoản, danh mục, cấu hình, mẫu trả lời, nhật ký, lưu trữ.
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { invalid } from "../errors";
import { type Actor, assertCan } from "../rbac";
import { logAudit } from "../audit";
import { hashSecret } from "../auth/password";
import { randomPassword } from "../auth/crypto";
import { DEFAULT_SETTINGS, getAllSettings, setSetting, type SettingsShape } from "../settings";
import { cleanText } from "@/lib/validation";
import { ROLE_LABELS } from "@/lib/constants";
import { DAY_MS } from "@/lib/dates";

const str = (v: unknown, max: number, label: string, min = 0) => {
  const s = cleanText(v);
  if (s.length < min) throw invalid(`${label} không được để trống.`);
  if (s.length > max) throw invalid(`${label} không vượt quá ${max} ký tự.`);
  return s;
};

// ───────────── Tài khoản ─────────────

export async function listUsers(actor: Actor) {
  assertCan(actor, "ADMIN_USERS");
  return prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
    select: {
      id: true, username: true, fullName: true, rank: true, position: true, isActive: true, isDemo: true, isIndependentContact: true,
      mustChangePassword: true, totpEnabled: true, lockedUntil: true, lastLoginAt: true, createdAt: true,
      role: { select: { code: true, name: true } }, unit: { select: { id: true, name: true } },
      categoryScopes: { select: { categoryId: true } },
    },
  });
}

export interface UserInput {
  username?: string;
  fullName: string;
  rank?: string;
  position?: string;
  roleCode: string;
  unitId?: string;
  isActive?: boolean;
  isIndependentContact?: boolean;
  categoryIds?: string[];
}

async function resolveRole(code: string) {
  if (!(code in ROLE_LABELS)) throw invalid("Vai trò không hợp lệ.");
  return prisma.role.findUniqueOrThrow({ where: { code } });
}

export async function createUser(actor: Actor, input: UserInput): Promise<{ id: string; tempPassword: string }> {
  assertCan(actor, "ADMIN_USERS");
  const username = str(input.username, 40, "Tên đăng nhập", 3).toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw invalid("Tên đăng nhập chỉ gồm chữ thường không dấu, số, dấu chấm, gạch dưới, gạch ngang.");
  if (await prisma.user.findUnique({ where: { username } })) throw invalid("Tên đăng nhập đã tồn tại.");
  const role = await resolveRole(input.roleCode);
  const tempPassword = randomPassword(14);
  const user = await prisma.user.create({
    data: {
      username,
      fullName: str(input.fullName, 100, "Họ và tên", 2),
      rank: str(input.rank, 60, "Cấp bậc") || null,
      position: str(input.position, 120, "Chức vụ") || null,
      roleId: role.id,
      unitId: input.unitId || null,
      isIndependentContact: !!input.isIndependentContact,
      passwordHash: await hashSecret(tempPassword),
      mustChangePassword: true,
      categoryScopes: { create: (input.categoryIds ?? []).filter(Boolean).map((categoryId) => ({ categoryId })) },
    },
  });
  await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "user.created", entityType: "User", entityId: user.id, metadata: { username, role: role.code } });
  return { id: user.id, tempPassword };
}

export async function updateUser(actor: Actor, id: string, input: UserInput) {
  assertCan(actor, "ADMIN_USERS");
  const target = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!target) throw invalid("Không tìm thấy tài khoản.");
  const role = await resolveRole(input.roleCode);
  if (target.id === actor.id && (role.code !== "ADMIN" || input.isActive === false))
    throw invalid("Không thể tự hạ quyền hoặc tự khóa tài khoản quản trị của chính mình.");
  if (target.role.code === "ADMIN" && (role.code !== "ADMIN" || input.isActive === false)) {
    const admins = await prisma.user.count({ where: { isActive: true, role: { code: "ADMIN" } } });
    if (admins <= 1) throw invalid("Phải còn ít nhất một tài khoản quản trị hệ thống đang hoạt động.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        fullName: str(input.fullName, 100, "Họ và tên", 2),
        rank: str(input.rank, 60, "Cấp bậc") || null,
        position: str(input.position, 120, "Chức vụ") || null,
        roleId: role.id,
        unitId: input.unitId || null,
        isActive: input.isActive !== false,
        isIndependentContact: !!input.isIndependentContact,
      },
    });
    await tx.userCategoryScope.deleteMany({ where: { userId: id } });
    const cats = (input.categoryIds ?? []).filter(Boolean);
    if (cats.length) await tx.userCategoryScope.createMany({ data: cats.map((categoryId) => ({ userId: id, categoryId })) });
    if (input.isActive === false || role.id !== target.roleId) await tx.session.deleteMany({ where: { userId: id } });
    await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "user.updated", entityType: "User", entityId: id, metadata: { role: role.code, isActive: input.isActive !== false, scopes: cats.length } }, tx);
  });
}

export async function resetUserPassword(actor: Actor, id: string): Promise<string> {
  assertCan(actor, "ADMIN_USERS");
  const tempPassword = randomPassword(14);
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashSecret(tempPassword), mustChangePassword: true, failedLoginCount: 0, lockedUntil: null, totpEnabled: false, totpSecretEnc: null },
  });
  await prisma.session.deleteMany({ where: { userId: id } });
  await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "user.password_reset", entityType: "User", entityId: id });
  return tempPassword;
}

export async function unlockUser(actor: Actor, id: string) {
  assertCan(actor, "ADMIN_USERS");
  await prisma.user.update({ where: { id }, data: { failedLoginCount: 0, lockedUntil: null } });
  await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "user.unlocked", entityType: "User", entityId: id });
}

export async function listRolesWithPermissions() {
  return prisma.role.findMany({ orderBy: { createdAt: "asc" }, include: { permissions: { include: { permission: true } } } });
}

// ───────────── Danh mục ─────────────

export async function listCategories() {
  return prisma.feedbackCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { feedback: true } } } });
}

export async function saveCategory(actor: Actor, input: { id?: string; name: string; description?: string; keywords?: string; slaDays?: string | number; sortOrder?: string | number; isActive?: boolean }) {
  assertCan(actor, "ADMIN_CATALOG");
  const name = str(input.name, 120, "Tên lĩnh vực", 2);
  const sla = input.slaDays === "" || input.slaDays === undefined || input.slaDays === null ? null : Number(input.slaDays);
  if (sla !== null && (!Number.isInteger(sla) || sla < 1 || sla > 180)) throw invalid("Thời hạn xử lý phải từ 1 đến 180 ngày.");
  const data = {
    name,
    description: str(input.description, 500, "Mô tả") || null,
    keywords: str(input.keywords, 1000, "Từ khóa"),
    slaDays: sla,
    sortOrder: Number(input.sortOrder) || 0,
    isActive: input.isActive !== false,
  };
  const saved = input.id
    ? await prisma.feedbackCategory.update({ where: { id: input.id }, data })
    : await prisma.feedbackCategory.create({ data: { ...data, code: `LV${Date.now().toString(36).toUpperCase()}` } });
  await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "category.saved", entityType: "FeedbackCategory", entityId: saved.id, metadata: { name } });
}

export async function listUnits() {
  return prisma.organizationalUnit.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { parent: { select: { name: true } } } });
}

export async function saveUnit(actor: Actor, input: { id?: string; name: string; code?: string; parentId?: string; isHandlingUnit?: boolean; isSenderSelectable?: boolean; isActive?: boolean; sortOrder?: string | number }) {
  assertCan(actor, "ADMIN_CATALOG");
  const name = str(input.name, 120, "Tên đơn vị", 2);
  if (input.id && input.parentId === input.id) throw invalid("Đơn vị cấp trên không hợp lệ.");
  const data = {
    name,
    parentId: input.parentId || null,
    isHandlingUnit: !!input.isHandlingUnit,
    isSenderSelectable: !!input.isSenderSelectable,
    isActive: input.isActive !== false,
    sortOrder: Number(input.sortOrder) || 0,
  };
  const saved = input.id
    ? await prisma.organizationalUnit.update({ where: { id: input.id }, data })
    : await prisma.organizationalUnit.create({ data: { ...data, code: str(input.code, 30, "Mã đơn vị") || `DV${Date.now().toString(36).toUpperCase()}` } });
  await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "unit.saved", entityType: "OrganizationalUnit", entityId: saved.id, metadata: { name } });
}

// ───────────── Cấu hình ─────────────

export async function readSettings(actor: Actor) {
  assertCan(actor, "ADMIN_SETTINGS");
  return getAllSettings();
}

export function validateTargetPath(p: string): string {
  const s = cleanText(p);
  // Chỉ cho phép đường dẫn nội bộ, chặn chuyển hướng mở (open redirect).
  if (!/^\/[A-Za-z0-9\-._~/]*$/.test(s) || s.startsWith("//")) throw invalid("Đường dẫn đích phải là đường dẫn nội bộ bắt đầu bằng \"/\" (ví dụ: / hoặc /gop-y).");
  return s;
}

export function validateBaseUrl(u: string): string {
  const s = cleanText(u).replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw invalid("Địa chỉ chính thức không hợp lệ (ví dụ: https://gopy.lu572.local).");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw invalid("Địa chỉ chính thức chỉ gồm giao thức http/https, tên miền/IP và cổng.");
  return url.origin + (url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, ""));
}

export async function updateSettings(actor: Actor, patch: Partial<SettingsShape>) {
  assertCan(actor, "ADMIN_SETTINGS");
  const changes: string[] = [];
  for (const [key, value] of Object.entries(patch) as [keyof SettingsShape, unknown][]) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    let v: unknown = value;
    switch (key) {
      case "qr.targetPath": v = validateTargetPath(String(value)); break;
      case "qr.publicBaseUrl": v = validateBaseUrl(String(value)); break;
      case "public.rateLimitPerHour": {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1 || n > 100) throw invalid("Giới hạn gửi mỗi giờ phải từ 1 đến 100.");
        v = n; break;
      }
      case "sla.dueSoonDays": {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 0 || n > 30) throw invalid("Số ngày cảnh báo sắp đến hạn phải từ 0 đến 30.");
        v = n; break;
      }
      case "retention.closedMonths": {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 6 || n > 240) throw invalid("Thời hạn lưu trữ phải từ 6 đến 240 tháng.");
        v = n; break;
      }
      case "sla.days": {
        const o = value as Record<string, unknown>;
        const out = { NORMAL: Number(o.NORMAL), ATTENTION: Number(o.ATTENTION), HIGH: Number(o.HIGH) };
        for (const n of Object.values(out)) if (!Number.isInteger(n) || n < 1 || n > 180) throw invalid("Thời hạn xử lý phải từ 1 đến 180 ngày.");
        v = out; break;
      }
      case "security.requireTotpRoles":
        v = (value as string[]).filter((r) => r in ROLE_LABELS); break;
      default:
        v = Boolean(value);
    }
    await setSetting(key, v as never, actor.id);
    changes.push(key);
  }
  if (changes.length) await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "setting.updated", metadata: { keys: changes } });
}

// ───────────── Mẫu trả lời ─────────────

export async function listTemplates() {
  return prisma.responseTemplate.findMany({ orderBy: [{ isActive: "desc" }, { title: "asc" }] });
}

export async function saveTemplate(actor: Actor, input: { id?: string; title: string; content: string; isActive?: boolean }) {
  assertCan(actor, "ADMIN_TEMPLATES");
  const data = { title: str(input.title, 150, "Tiêu đề mẫu", 3), content: str(input.content, 5000, "Nội dung mẫu", 10), isActive: input.isActive !== false };
  // Sửa nội dung thì phải phê duyệt lại.
  const saved = input.id
    ? await prisma.responseTemplate.update({ where: { id: input.id }, data: { ...data, isApproved: false, approvedById: null, approvedAt: null } })
    : await prisma.responseTemplate.create({ data: { ...data, createdById: actor.id } });
  await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "template.saved", entityType: "ResponseTemplate", entityId: saved.id });
}

export async function approveTemplate(actor: Actor, id: string) {
  assertCan(actor, "ADMIN_TEMPLATES");
  await prisma.responseTemplate.update({ where: { id }, data: { isApproved: true, approvedById: actor.id, approvedAt: new Date() } });
  await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "template.approved", entityType: "ResponseTemplate", entityId: id });
}

// ───────────── Nhật ký ─────────────

export async function listAuditLogs(actor: Actor, f: { action?: string; q?: string; page?: number }) {
  assertCan(actor, "ADMIN_AUDIT");
  const where: Prisma.AuditLogWhereInput = {};
  if (f.action) where.action = String(f.action).slice(0, 60);
  const q = cleanText(f.q ?? "").slice(0, 60);
  if (q) where.OR = [{ actorLabel: { contains: q, mode: "insensitive" } }, { entityId: q }];
  const page = Math.max(Number(f.page) || 1, 1);
  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50, include: { actor: { select: { fullName: true } } } }),
  ]);
  return { total, page, pages: Math.max(1, Math.ceil(total / 50)), items };
}

// ───────────── Lưu trữ và xóa dữ liệu ─────────────

export async function retentionPreview(actor: Actor) {
  assertCan(actor, "ADMIN_RETENTION");
  const months = (await getAllSettings())["retention.closedMonths"];
  const cutoff = new Date(Date.now() - months * 30 * DAY_MS);
  const [expired, demoFeedback, demoUsers] = await Promise.all([
    prisma.feedback.count({ where: { closedAt: { lt: cutoff }, status: { in: ["RESOLVED", "CLOSED_NO_ACTION", "TRANSFERRED"] } } }),
    prisma.feedback.count({ where: { isDemo: true } }),
    prisma.user.count({ where: { isDemo: true } }),
  ]);
  return { months, cutoff, expired, demoFeedback, demoUsers };
}

// Xóa hồ sơ đã kết thúc quá thời hạn lưu trữ. Đặt cờ phiên để trigger cho phép xóa lịch sử kèm theo.
export async function purgeExpired(actor: Actor, confirmText: string) {
  assertCan(actor, "ADMIN_RETENTION");
  if (confirmText !== "XOA DU LIEU") throw invalid('Nhập chính xác "XOA DU LIEU" để xác nhận.');
  const { cutoff, months } = await retentionPreview(actor);
  const count = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL app.retention_purge = 'on'");
    const r = await tx.feedback.deleteMany({ where: { closedAt: { lt: cutoff }, status: { in: ["RESOLVED", "CLOSED_NO_ACTION", "TRANSFERRED"] } } });
    await tx.$executeRawUnsafe("SET LOCAL app.retention_purge = 'off'");
    await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "retention.purged", metadata: { count: r.count, months, cutoff: cutoff.toISOString() } }, tx);
    return r.count;
  });
  return count;
}

export async function purgeDemoData(actor: Actor, confirmText: string) {
  assertCan(actor, "ADMIN_RETENTION");
  if (confirmText !== "XOA DEMO") throw invalid('Nhập chính xác "XOA DEMO" để xác nhận.');
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL app.retention_purge = 'on'");
    const fb = await tx.feedback.deleteMany({ where: { isDemo: true } });
    await tx.feedbackCounter.deleteMany({ where: { scope: { startsWith: "DEMO-" } } });
    const demoUsers = await tx.user.findMany({ where: { isDemo: true }, select: { id: true } });
    const ids = demoUsers.map((u) => u.id);
    let users = 0;
    if (ids.length) {
      // Tài khoản demo đã để lại dấu vết trong nhật ký kiểm toán → vô hiệu hóa thay vì xóa.
      await tx.session.deleteMany({ where: { userId: { in: ids } } });
      await tx.notification.deleteMany({ where: { userId: { in: ids } } });
      users = (await tx.user.updateMany({ where: { id: { in: ids } }, data: { isActive: false } })).count;
    }
    await tx.$executeRawUnsafe("SET LOCAL app.retention_purge = 'off'");
    await setSettingTx(tx, actor.id);
    await logAudit({ actorId: actor.id, actorLabel: actor.username, action: "demo.purged", metadata: { feedback: fb.count, usersDisabled: users } }, tx);
    return { feedback: fb.count, usersDisabled: users };
  });
}

async function setSettingTx(tx: Prisma.TransactionClient, actorId: string) {
  await tx.systemSetting.upsert({
    where: { key: "system.demoMode" },
    create: { key: "system.demoMode", value: false, updatedById: actorId },
    update: { value: false, updatedById: actorId },
  });
}
