// Dữ liệu nền bắt buộc: vai trò, quyền, danh mục mặc định. Chạy lại nhiều lần không bị trùng.
import type { PrismaClient } from "@prisma/client";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLE_DESCRIPTIONS } from "../src/lib/permissions";
import { ROLE_LABELS } from "../src/lib/constants";

export const DEFAULT_CATEGORIES: { code: string; name: string; keywords: string; slaDays?: number }[] = [
  { code: "QL_CH", name: "Công tác quản lý, chỉ huy", keywords: "chỉ huy, quản lý, điều hành, kỷ luật, mệnh lệnh, phân công, trực ban, lịch công tác" },
  { code: "CD_CS", name: "Chế độ, chính sách", keywords: "chế độ, chính sách, phụ cấp, lương, nghỉ phép, phép, thăm gia đình, bảo hiểm, hậu phương, khen thưởng, nâng lương" },
  { code: "DS_SH", name: "Đời sống, sinh hoạt", keywords: "sinh hoạt, đời sống, doanh trại, phòng ở, giường, nhà vệ sinh, nước nóng, điện, quạt, tắm giặt" },
  { code: "HC_BD", name: "Hậu cần, bảo đảm đời sống", keywords: "bếp ăn, nhà ăn, bữa ăn, tiêu chuẩn ăn, thực phẩm, quân trang, quân y, thuốc, tăng gia, nước uống", slaDays: 10 },
  { code: "GD_TT", name: "Công tác giáo dục, tuyên truyền", keywords: "giáo dục, chính trị, tuyên truyền, học tập, nghị quyết, bản tin, sách báo, thư viện, pháp luật" },
  { code: "VH_TT", name: "Hoạt động văn hóa, thể thao", keywords: "văn hóa, văn nghệ, thể thao, bóng đá, bóng chuyền, sân bóng, câu lạc bộ, giải trí, internet, wifi" },
  { code: "NN_MT", name: "Xây dựng nền nếp, môi trường làm việc", keywords: "nền nếp, chính quy, môi trường, vệ sinh, cảnh quan, đoàn kết, nội bộ, thái độ, ứng xử, văn hóa ứng xử" },
  { code: "KHAC", name: "Lĩnh vực khác", keywords: "" },
];

// Cơ cấu đơn vị MẪU (chưa phải danh mục chính thức) — đơn vị cần cập nhật lại trong trang quản trị.
export const DEFAULT_UNITS: { code: string; name: string; handling: boolean; sender: boolean; order: number }[] = [
  { code: "CQ_TM", name: "Cơ quan Tham mưu", handling: true, sender: true, order: 1 },
  { code: "CQ_CT", name: "Cơ quan Chính trị", handling: true, sender: true, order: 2 },
  { code: "CQ_HCKT", name: "Cơ quan Hậu cần – Kỹ thuật", handling: true, sender: true, order: 3 },
  { code: "TD1", name: "Tiểu đoàn 1", handling: false, sender: true, order: 10 },
  { code: "TD2", name: "Tiểu đoàn 2", handling: false, sender: true, order: 11 },
  { code: "TD3", name: "Tiểu đoàn 3", handling: false, sender: true, order: 12 },
  { code: "DD_TT", name: "Các đại đội, trung đội trực thuộc", handling: false, sender: true, order: 13 },
];

export async function seedCore(prisma: PrismaClient) {
  for (const [code, p] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { code }, create: { code, name: p.name, group: p.group }, update: { name: p.name, group: p.group } });
  }
  for (const [code, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { code },
      create: { code, name: ROLE_LABELS[code], description: ROLE_DESCRIPTIONS[code] },
      update: { name: ROLE_LABELS[code], description: ROLE_DESCRIPTIONS[code] },
    });
    const permRows = await prisma.permission.findMany({ where: { code: { in: perms } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({ data: permRows.map((p) => ({ roleId: role.id, permissionId: p.id })) });
  }
  for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
    await prisma.feedbackCategory.upsert({
      where: { code: c.code },
      create: { code: c.code, name: c.name, keywords: c.keywords, slaDays: c.slaDays ?? null, sortOrder: i + 1 },
      update: {},
    });
  }
  for (const u of DEFAULT_UNITS) {
    await prisma.organizationalUnit.upsert({
      where: { code: u.code },
      create: { code: u.code, name: u.name, isHandlingUnit: u.handling, isSenderSelectable: u.sender, sortOrder: u.order },
      update: {},
    });
  }
}
