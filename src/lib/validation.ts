// Schema kiểm tra dữ liệu đầu vào, dùng chung cho biểu mẫu phía trình duyệt và kiểm tra lại tại server.
import { z } from "zod";
import { FEEDBACK_TYPES, LIMITS, PRIORITIES } from "./constants";

// Chuẩn hóa văn bản: Unicode NFC, bỏ ký tự điều khiển (trừ xuống dòng, tab), gộp dòng trống thừa.
export function cleanText(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .normalize("NFC")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

const text = (min: number, max: number, label: string) =>
  z.preprocess(
    cleanText,
    z
      .string()
      .min(min, { message: `${label} cần tối thiểu ${min} ký tự.` })
      .max(max, { message: `${label} không vượt quá ${max} ký tự.` }),
  );

const optionalText = (max: number, label: string) =>
  z.preprocess(
    (v) => {
      const s = cleanText(v);
      return s === "" ? undefined : s;
    },
    z.string().max(max, { message: `${label} không vượt quá ${max} ký tự.` }).optional(),
  );

export const feedbackTypeSchema = z.enum(FEEDBACK_TYPES as [string, ...string[]], {
  message: "Vui lòng chọn loại ý kiến.",
});

export const submitFeedbackSchema = z
  .object({
    isAnonymous: z.preprocess((v) => v === true || v === "true" || v === "on", z.boolean()),
    fullName: optionalText(LIMITS.fullName.max, "Họ và tên"),
    senderUnitId: optionalText(40, "Đơn vị"),
    contact: optionalText(LIMITS.contact.max, "Thông tin liên hệ"),
    type: feedbackTypeSchema,
    categoryId: z.string().min(1, { message: "Vui lòng chọn lĩnh vực góp ý." }).max(40),
    title: text(LIMITS.title.min, LIMITS.title.max, "Tiêu đề"),
    content: text(LIMITS.content.min, LIMITS.content.max, "Nội dung"),
    proposal: optionalText(LIMITS.proposal.max, "Đề xuất phương án"),
    acknowledge: z.preprocess(
      (v) => v === true || v === "true" || v === "on",
      z.literal(true, { message: "Vui lòng xác nhận đã đọc lưu ý trước khi gửi." }),
    ),
  })
  .transform((d) =>
    d.isAnonymous ? { ...d, fullName: undefined, senderUnitId: undefined, contact: undefined } : d,
  );

export type SubmitFeedbackInput = z.input<typeof submitFeedbackSchema>;
export type SubmitFeedbackData = z.output<typeof submitFeedbackSchema>;

// Mã hồ sơ: GY-2026-000001 hoặc DEMO-GY-2026-000001. Mã bí mật: 12 ký tự, cho phép có dấu gạch.
export const lookupSchema = z.object({
  code: z.preprocess(
    (v) => cleanText(v).toUpperCase().replace(/\s+/g, ""),
    z.string().regex(/^(DEMO-)?GY-\d{4}-\d{6}$/, { message: "Mã hồ sơ không đúng định dạng (ví dụ: GY-2026-000001)." }),
  ),
  secret: z.preprocess(
    (v) => cleanText(v).toUpperCase().replace(/[\s-]+/g, ""),
    z.string().regex(/^[A-Z2-9]{12}$/, { message: "Mã bí mật gồm 12 ký tự (chữ và số)." }),
  ),
});

export const senderMessageSchema = lookupSchema.extend({
  content: text(LIMITS.message.min, LIMITS.message.max, "Nội dung bổ sung"),
});

export const satisfactionSchema = lookupSchema.extend({
  satisfaction: z.enum(["SATISFIED", "NEUTRAL", "UNSATISFIED"], { message: "Vui lòng chọn mức độ hài lòng." }),
  comment: optionalText(1000, "Ý kiến thêm"),
});

export const passwordSchema = z
  .string()
  .min(10, { message: "Mật khẩu cần tối thiểu 10 ký tự." })
  .max(128, { message: "Mật khẩu quá dài." })
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), { message: "Mật khẩu phải có cả chữ và số." });

export const loginSchema = z.object({
  username: z.preprocess((v) => cleanText(v).toLowerCase(), z.string().min(1, { message: "Nhập tên đăng nhập." }).max(60)),
  password: z.string().min(1, { message: "Nhập mật khẩu." }).max(128),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: "Nhập mật khẩu hiện tại." }).max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: "Mật khẩu xác nhận không khớp.", path: ["confirmPassword"] })
  .refine((d) => d.newPassword !== d.currentPassword, { message: "Mật khẩu mới phải khác mật khẩu cũ.", path: ["newPassword"] });

export const prioritySchema = z.enum(PRIORITIES as [string, ...string[]]);

export const noteText = text(LIMITS.note.min, LIMITS.note.max, "Nội dung");
export const responseText = text(LIMITS.response.min, LIMITS.response.max, "Nội dung phản hồi");
export const reasonText = text(LIMITS.reason.min, LIMITS.reason.max, "Lý do");
export const optionalNote = optionalText(LIMITS.note.max, "Ghi chú");

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Dữ liệu không hợp lệ.";
}

export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
