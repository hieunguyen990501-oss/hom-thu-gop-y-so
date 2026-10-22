// Danh mục quyền và phân quyền mặc định theo vai trò.
// Quyền được kiểm tra tại server; giao diện chỉ ẩn/hiện theo cùng danh mục này.

export const PERMISSIONS = {
  // Hồ sơ góp ý
  FEEDBACK_VIEW_ALL: { name: "Xem toàn bộ hồ sơ trong phạm vi lĩnh vực được giao", group: "Hồ sơ" },
  FEEDBACK_VIEW_ASSIGNED: { name: "Xem hồ sơ được phân công cho mình/bộ phận", group: "Hồ sơ" },
  FEEDBACK_CLASSIFY: { name: "Phân loại, kiểm tra tính hợp lệ, đặt mức ưu tiên", group: "Hồ sơ" },
  FEEDBACK_ASSIGN: { name: "Phân công xử lý", group: "Hồ sơ" },
  FEEDBACK_PROCESS: { name: "Cập nhật tiến độ, soạn phản hồi, chuyển duyệt", group: "Hồ sơ" },
  FEEDBACK_APPROVE: { name: "Duyệt phản hồi và kết quả giải quyết", group: "Hồ sơ" },
  FEEDBACK_CLOSE: { name: "Kết thúc không xử lý (có lý do)", group: "Hồ sơ" },
  FEEDBACK_TRANSFER: { name: "Chuyển đầu mối có thẩm quyền", group: "Hồ sơ" },
  FEEDBACK_RESTRICT: { name: "Loại trừ người có xung đột lợi ích khỏi hồ sơ", group: "Hồ sơ" },
  FEEDBACK_NOTE: { name: "Đọc và ghi chú nội bộ", group: "Hồ sơ" },
  FEEDBACK_VIEW_SENDER: { name: "Xem thông tin người gửi (khi người gửi tự nguyện cung cấp)", group: "Hồ sơ" },
  // Điều hành, báo cáo
  DASHBOARD_VIEW: { name: "Xem bảng điều hành, thống kê", group: "Điều hành" },
  REPORT_VIEW: { name: "Xem báo cáo tổng hợp", group: "Điều hành" },
  REPORT_EXPORT: { name: "Xuất báo cáo, danh sách (Excel/PDF)", group: "Điều hành" },
  // Quản trị
  ADMIN_USERS: { name: "Quản lý tài khoản, phân quyền", group: "Quản trị" },
  ADMIN_CATALOG: { name: "Quản lý danh mục lĩnh vực, đơn vị", group: "Quản trị" },
  ADMIN_SETTINGS: { name: "Quản lý cấu hình hệ thống", group: "Quản trị" },
  ADMIN_AUDIT: { name: "Xem nhật ký hệ thống", group: "Quản trị" },
  ADMIN_QR: { name: "Tạo, tải, in mã QR", group: "Quản trị" },
  ADMIN_RETENTION: { name: "Quản lý chính sách lưu trữ, xóa dữ liệu", group: "Quản trị" },
  ADMIN_TEMPLATES: { name: "Quản lý và phê duyệt mẫu trả lời", group: "Quản trị" },
} as const;

export type PermissionCode = keyof typeof PERMISSIONS;

export const ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
  // Quản trị viên kỹ thuật KHÔNG mặc nhiên được đọc nội dung góp ý.
  ADMIN: [
    "ADMIN_USERS",
    "ADMIN_CATALOG",
    "ADMIN_SETTINGS",
    "ADMIN_AUDIT",
    "ADMIN_QR",
    "ADMIN_RETENTION",
    "ADMIN_TEMPLATES",
  ],
  RECEIVER: [
    "FEEDBACK_VIEW_ALL",
    "FEEDBACK_CLASSIFY",
    "FEEDBACK_ASSIGN",
    "FEEDBACK_CLOSE",
    "FEEDBACK_TRANSFER",
    "FEEDBACK_RESTRICT",
    "FEEDBACK_NOTE",
    "FEEDBACK_VIEW_SENDER",
    "DASHBOARD_VIEW",
    "REPORT_VIEW",
    "REPORT_EXPORT",
    "ADMIN_QR",
  ],
  HANDLER: ["FEEDBACK_VIEW_ASSIGNED", "FEEDBACK_PROCESS", "FEEDBACK_NOTE"],
  LEADER: [
    "FEEDBACK_VIEW_ALL",
    "FEEDBACK_APPROVE",
    "FEEDBACK_CLOSE",
    "FEEDBACK_TRANSFER",
    "FEEDBACK_RESTRICT",
    "FEEDBACK_NOTE",
    "FEEDBACK_VIEW_SENDER",
    "DASHBOARD_VIEW",
    "REPORT_VIEW",
    "REPORT_EXPORT",
  ],
};

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: "Quản lý tài khoản, danh mục, cấu hình, phân quyền, lưu trữ và nhật ký. Không mặc nhiên đọc nội dung góp ý.",
  RECEIVER: "Tiếp nhận, kiểm tra, phân loại, phân công và theo dõi hồ sơ trong phạm vi được giao.",
  HANDLER: "Xử lý hồ sơ được phân công: cập nhật tiến độ, soạn phản hồi, chuyển duyệt.",
  LEADER: "Theo dõi thống kê, hồ sơ quá hạn; duyệt phản hồi, kết quả giải quyết; xem báo cáo.",
};
