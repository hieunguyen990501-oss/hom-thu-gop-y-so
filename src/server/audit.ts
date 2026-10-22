// Ghi nhật ký kiểm toán. Bảng AuditLog được trigger CSDL bảo vệ: không sửa, không xóa.
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export interface AuditInput {
  actorId?: string | null;
  actorLabel?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

export async function logAudit(input: AuditInput, tx: Prisma.TransactionClient = prisma) {
  await tx.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      actorLabel: input.actorLabel ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      ipAddress: input.ipAddress ?? null,
    },
  });
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "auth.login": "Đăng nhập",
  "auth.login_failed": "Đăng nhập sai",
  "auth.locked": "Khóa tài khoản do đăng nhập sai nhiều lần",
  "auth.logout": "Đăng xuất",
  "auth.password_changed": "Đổi mật khẩu",
  "auth.totp_enabled": "Bật xác thực hai yếu tố",
  "auth.totp_disabled": "Tắt xác thực hai yếu tố",
  "auth.totp_failed": "Nhập sai mã xác thực hai yếu tố",
  "user.created": "Tạo tài khoản",
  "user.updated": "Cập nhật tài khoản",
  "user.password_reset": "Cấp lại mật khẩu",
  "user.unlocked": "Mở khóa tài khoản",
  "category.saved": "Cập nhật danh mục lĩnh vực",
  "unit.saved": "Cập nhật danh mục đơn vị",
  "setting.updated": "Thay đổi cấu hình",
  "template.saved": "Cập nhật mẫu trả lời",
  "template.approved": "Phê duyệt mẫu trả lời",
  "feedback.viewed": "Xem chi tiết hồ sơ",
  "feedback.sender_viewed": "Xem thông tin người gửi",
  "feedback.classified": "Phân loại hồ sơ",
  "feedback.assigned": "Phân công xử lý",
  "feedback.status_changed": "Thay đổi trạng thái",
  "feedback.response_submitted": "Soạn phản hồi",
  "feedback.response_approved": "Duyệt phản hồi",
  "feedback.response_rejected": "Trả lại phản hồi",
  "feedback.closed": "Kết thúc không xử lý",
  "feedback.transferred": "Chuyển đầu mối có thẩm quyền",
  "feedback.restricted": "Loại trừ quyền truy cập",
  "feedback.note_added": "Thêm ghi chú nội bộ",
  "feedback.reopened": "Mở lại hồ sơ",
  "export.feedback_list": "Xuất danh sách hồ sơ",
  "export.report_excel": "Xuất báo cáo Excel",
  "export.report_print": "In/xuất báo cáo PDF",
  "qr.downloaded": "Tải mã QR",
  "retention.purged": "Xóa dữ liệu hết hạn lưu trữ",
  "demo.purged": "Xóa dữ liệu demo",
};
