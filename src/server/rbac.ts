// Kiểm soát truy cập theo vai trò (RBAC) và theo từng hồ sơ.
// Mọi truy vấn hồ sơ của cán bộ phải đi qua feedbackScopeWhere() để chống lỗi IDOR.
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { forbidden } from "./errors";
import { getSetting } from "./settings";
import type { PermissionCode } from "@/lib/permissions";

export interface Actor {
  id: string;
  username: string;
  fullName: string;
  roleCode: string;
  unitId: string | null;
  isIndependentContact: boolean;
  permissions: Set<PermissionCode>;
  categoryScope: string[]; // rỗng = mọi lĩnh vực
  totpEnabled: boolean;
  mustChangePassword: boolean;
}

export async function loadActor(userId: string): Promise<Actor | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
      categoryScopes: true,
    },
  });
  if (!user || !user.isActive) return null;
  // Tài khoản demo chỉ hoạt động khi hệ thống ở chế độ demo — không bao giờ chạm tới dữ liệu chính thức.
  if (user.isDemo && !(await getSetting("system.demoMode"))) return null;
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    roleCode: user.role.code,
    unitId: user.unitId,
    isIndependentContact: user.isIndependentContact,
    permissions: new Set(user.role.permissions.map((rp) => rp.permission.code as PermissionCode)),
    categoryScope: user.categoryScopes.map((s) => s.categoryId),
    totpEnabled: user.totpEnabled,
    mustChangePassword: user.mustChangePassword,
  };
}

export function can(actor: Actor, perm: PermissionCode): boolean {
  return actor.permissions.has(perm);
}

export function canAny(actor: Actor, perms: PermissionCode[]): boolean {
  return perms.some((p) => actor.permissions.has(p));
}

export function assertCan(actor: Actor, perm: PermissionCode) {
  if (!can(actor, perm)) throw forbidden();
}

// Điều kiện truy vấn giới hạn các hồ sơ mà tài khoản được phép thấy.
export function feedbackScopeWhere(actor: Actor, demoMode: boolean): Prisma.FeedbackWhereInput {
  const or: Prisma.FeedbackWhereInput[] = [];
  if (can(actor, "FEEDBACK_VIEW_ALL")) {
    or.push(actor.categoryScope.length ? { categoryId: { in: actor.categoryScope } } : { id: { not: "" } });
    // Hồ sơ đã chuyển cho chính đầu mối độc lập này luôn trong phạm vi.
    or.push({ assignedUserId: actor.id });
  }
  if (can(actor, "FEEDBACK_VIEW_ASSIGNED")) {
    or.push({ assignedUserId: actor.id });
    if (actor.unitId) or.push({ assignedUnitId: actor.unitId, assignedUserId: null });
  }
  if (or.length === 0) return { id: "__no_access__" };
  return {
    AND: [
      { isDemo: demoMode },
      { restrictions: { none: { userId: actor.id } } },
      { OR: or },
    ],
  };
}

export function hasFeedbackAccess(actor: Actor): boolean {
  return canAny(actor, ["FEEDBACK_VIEW_ALL", "FEEDBACK_VIEW_ASSIGNED"]);
}
