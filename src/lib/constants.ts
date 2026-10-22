// Nhãn hiển thị, ánh xạ trạng thái và các hằng số nghiệp vụ dùng chung cho client và server.
import type { FeedbackStatus, FeedbackType, Priority, Satisfaction } from "@prisma/client";

export const UNIT_NAME = "LỮ ĐOÀN PHÁO BINH 572 – QUÂN KHU 5";
export const APP_NAME = "HÒM THƯ GÓP Ý SỐ";
export const SLOGAN = "Lắng nghe ý kiến – Tiếp nhận kịp thời – Giải quyết trách nhiệm";

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  KIEN_NGHI: "Kiến nghị",
  PHAN_ANH: "Phản ánh",
  DE_XUAT: "Đề xuất, sáng kiến",
  GOP_Y_XAY_DUNG: "Góp ý xây dựng đơn vị",
  KHAC: "Nội dung khác",
};
export const FEEDBACK_TYPES = Object.keys(FEEDBACK_TYPE_LABELS) as FeedbackType[];

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  NEW: "Mới tiếp nhận",
  CLASSIFYING: "Đang phân loại",
  ASSIGNED: "Đã phân công",
  IN_PROGRESS: "Đang xử lý",
  WAITING_INFO: "Chờ bổ sung thông tin",
  PENDING_APPROVAL: "Chờ duyệt kết quả",
  RESOLVED: "Đã giải quyết",
  CLOSED_NO_ACTION: "Kết thúc không xử lý",
  TRANSFERRED: "Chuyển đầu mối có thẩm quyền",
};
export const STATUSES = Object.keys(STATUS_LABELS) as FeedbackStatus[];

// Trạng thái người gửi nhìn thấy: không lộ quy trình nội bộ (ai đang xử lý, đang chờ duyệt...).
export const PUBLIC_STATUS_LABELS: Record<FeedbackStatus, string> = {
  NEW: "Đã tiếp nhận",
  CLASSIFYING: "Đang xem xét",
  ASSIGNED: "Đang xem xét, giải quyết",
  IN_PROGRESS: "Đang xem xét, giải quyết",
  WAITING_INFO: "Cần bổ sung thông tin",
  PENDING_APPROVAL: "Đang xem xét, giải quyết",
  RESOLVED: "Đã có kết quả giải quyết",
  CLOSED_NO_ACTION: "Đã kết thúc",
  TRANSFERRED: "Đã chuyển đến cấp có thẩm quyền",
};

export const TERMINAL_STATUSES: FeedbackStatus[] = ["RESOLVED", "CLOSED_NO_ACTION", "TRANSFERRED"];
export const OPEN_STATUSES: FeedbackStatus[] = STATUSES.filter((s) => !TERMINAL_STATUSES.includes(s));

// Các bước chuyển trạng thái hợp lệ do cán bộ thực hiện thủ công.
// Một số bước (WAITING_INFO, PENDING_APPROVAL, RESOLVED) chỉ diễn ra qua chức năng chuyên biệt.
export const MANUAL_TRANSITIONS: Partial<Record<FeedbackStatus, FeedbackStatus[]>> = {
  NEW: ["CLASSIFYING"],
  CLASSIFYING: [],
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: [],
  WAITING_INFO: ["IN_PROGRESS"],
  PENDING_APPROVAL: [],
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  NORMAL: "Thông thường",
  ATTENTION: "Cần quan tâm",
  HIGH: "Ưu tiên cao",
};
export const PRIORITIES = Object.keys(PRIORITY_LABELS) as Priority[];

export const SATISFACTION_LABELS: Record<Satisfaction, string> = {
  SATISFIED: "Hài lòng",
  NEUTRAL: "Bình thường",
  UNSATISFIED: "Chưa hài lòng",
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị hệ thống",
  RECEIVER: "Cán bộ tiếp nhận",
  HANDLER: "Cán bộ xử lý",
  LEADER: "Lãnh đạo, chỉ huy",
};

export const LIMITS = {
  title: { min: 5, max: 150 },
  content: { min: 20, max: 5000 },
  proposal: { max: 3000 },
  fullName: { max: 100 },
  contact: { max: 120 },
  message: { min: 5, max: 3000 },
  note: { min: 2, max: 3000 },
  response: { min: 10, max: 5000 },
  reason: { min: 10, max: 1000 },
};

export const SECURITY_WARNING =
  "Không nhập thông tin thuộc phạm vi bí mật nhà nước, bí mật quân sự hoặc dữ liệu cá nhân của người khác khi không cần thiết. Trường hợp khẩn cấp, sử dụng kênh báo cáo trực tiếp theo quy định của đơn vị.";

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  NEW_FEEDBACK: "Góp ý mới",
  ASSIGNED: "Được phân công",
  INFO_REQUESTED: "Yêu cầu bổ sung",
  SENDER_REPLIED: "Người gửi bổ sung",
  DUE_SOON: "Sắp đến hạn",
  OVERDUE: "Quá hạn",
  PENDING_APPROVAL: "Chờ phê duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Bị trả lại",
  TRANSFERRED: "Chuyển đầu mối",
};
