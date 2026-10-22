"use client";
// Biểu mẫu gửi góp ý (React Hook Form + Zod). Server kiểm tra lại toàn bộ dữ liệu bằng schema riêng.
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, CheckCircle2, Download, Loader2, UserRound, VenetianMask } from "lucide-react";
import Link from "next/link";
import { submitFeedbackAction } from "@/app/(public)/actions";
import { FEEDBACK_TYPES, FEEDBACK_TYPE_LABELS, LIMITS, SECURITY_WARNING } from "@/lib/constants";
import { Alert, cx } from "@/components/ui";
import { CopyButton } from "@/components/ui/client";
import { formatDateTime } from "@/lib/dates";

const schema = z
  .object({
    isAnonymous: z.boolean(),
    fullName: z.string().max(LIMITS.fullName.max, `Họ và tên không vượt quá ${LIMITS.fullName.max} ký tự.`).optional(),
    senderUnitId: z.string().optional(),
    contact: z.string().max(LIMITS.contact.max, `Thông tin liên hệ không vượt quá ${LIMITS.contact.max} ký tự.`).optional(),
    type: z.string().min(1, "Vui lòng chọn loại ý kiến."),
    categoryId: z.string().min(1, "Vui lòng chọn lĩnh vực góp ý."),
    title: z.string().trim().min(LIMITS.title.min, `Tiêu đề cần tối thiểu ${LIMITS.title.min} ký tự.`).max(LIMITS.title.max, `Tiêu đề không vượt quá ${LIMITS.title.max} ký tự.`),
    content: z.string().trim().min(LIMITS.content.min, `Nội dung cần tối thiểu ${LIMITS.content.min} ký tự.`).max(LIMITS.content.max, `Nội dung không vượt quá ${LIMITS.content.max} ký tự.`),
    proposal: z.string().max(LIMITS.proposal.max, `Đề xuất không vượt quá ${LIMITS.proposal.max} ký tự.`).optional(),
    acknowledge: z.boolean().refine((v) => v, "Vui lòng xác nhận đã đọc lưu ý trước khi gửi."),
    website: z.string().optional(),
  });
type Values = z.infer<typeof schema>;

interface Option {
  id: string;
  name: string;
}

export function FeedbackForm({ categories, units, allowIdentified }: { categories: Option[]; units: Option[]; allowIdentified: boolean }) {
  const startedAt = useMemo(() => Date.now(), []);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; secret: string; createdAt: Date; publicStatus: string } | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { isAnonymous: true, type: "", categoryId: "", title: "", content: "", proposal: "", acknowledge: false, website: "" },
  });
  const anonymous = watch("isAnonymous");
  const contentLen = watch("content")?.length ?? 0;

  const onSubmit = async (v: Values) => {
    setServerError(null);
    const res = await submitFeedbackAction({ ...v, startedAt });
    if (!res.ok) {
      setServerError(res.error);
      for (const [k, msg] of Object.entries(res.fieldErrors ?? {})) setError(k as keyof Values, { message: msg });
      return;
    }
    setResult(res.data);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (result) return <SubmitSuccess {...result} />;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="flex gap-3 rounded-md border border-bronze-300 bg-bronze-50 p-3 text-sm leading-relaxed text-bronze-700" role="note">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p>{SECURITY_WARNING}</p>
      </div>

      {/* A. Hình thức gửi */}
      <fieldset className="card p-4">
        <legend className="px-1 text-sm font-bold uppercase tracking-wide text-brand-700">A. Hình thức gửi</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {[
            { v: true, label: "Gửi ẩn danh", desc: "Không cần họ tên, liên hệ.", icon: VenetianMask },
            { v: false, label: "Gửi có thông tin", desc: "Để đơn vị liên hệ khi cần.", icon: UserRound, disabled: !allowIdentified },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              disabled={o.disabled}
              onClick={() => setValue("isAnonymous", o.v)}
              aria-pressed={anonymous === o.v}
              className={cx(
                "flex min-h-[64px] items-center gap-3 rounded-md border-2 p-3 text-left transition-colors disabled:opacity-50",
                anonymous === o.v ? "border-brand-700 bg-brand-50" : "border-cream-200 bg-white hover:border-bronze-300",
              )}
            >
              <o.icon className={cx("h-6 w-6 shrink-0", anonymous === o.v ? "text-brand-700" : "text-ink-muted")} aria-hidden />
              <span>
                <span className="block font-semibold">{o.label}</span>
                <span className="block text-xs text-ink-muted">{o.disabled ? "Đơn vị hiện chỉ nhận góp ý ẩn danh." : o.desc}</span>
              </span>
            </button>
          ))}
        </div>
        {anonymous ? (
          <p className="mt-3 text-xs leading-relaxed text-ink-muted">
            Hệ thống không lưu họ tên, tài khoản, địa chỉ thiết bị vào hồ sơ ẩn danh. Không có cách khôi phục hồ sơ ẩn danh nếu mất mã bí mật.
          </p>
        ) : (
          <div className="mt-4 grid gap-4">
            <p className="text-xs text-ink-muted">Các thông tin dưới đây không bắt buộc, được mã hóa và chỉ cán bộ có thẩm quyền mới xem được.</p>
            <div>
              <label className="label" htmlFor="fullName">Họ và tên</label>
              <input id="fullName" className="input" autoComplete="off" {...register("fullName")} />
              {errors.fullName && <p className="mt-1 text-sm text-brand-700">{errors.fullName.message}</p>}
            </div>
            <div>
              <label className="label" htmlFor="senderUnitId">Đơn vị công tác</label>
              <select id="senderUnitId" className="input" {...register("senderUnitId")}>
                <option value="">— Không chọn —</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="contact">Thông tin liên hệ (tùy chọn)</label>
              <input id="contact" className="input" autoComplete="off" placeholder="Ví dụ: liên hệ qua đại đội" {...register("contact")} />
              {errors.contact && <p className="mt-1 text-sm text-brand-700">{errors.contact.message}</p>}
            </div>
          </div>
        )}
      </fieldset>

      {/* B, C. Phân loại */}
      <fieldset className="card grid gap-4 p-4">
        <legend className="px-1 text-sm font-bold uppercase tracking-wide text-brand-700">B. Loại ý kiến &amp; C. Lĩnh vực</legend>
        <div>
          <label className="label" htmlFor="type">Loại ý kiến <span className="text-brand-600">*</span></label>
          <select id="type" className="input" aria-invalid={!!errors.type} {...register("type")}>
            <option value="">— Chọn loại ý kiến —</option>
            {FEEDBACK_TYPES.map((t) => (
              <option key={t} value={t}>{FEEDBACK_TYPE_LABELS[t]}</option>
            ))}
          </select>
          {errors.type && <p className="mt-1 text-sm text-brand-700" role="alert">{errors.type.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="categoryId">Lĩnh vực góp ý <span className="text-brand-600">*</span></label>
          <select id="categoryId" className="input" aria-invalid={!!errors.categoryId} {...register("categoryId")}>
            <option value="">— Chọn lĩnh vực —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {errors.categoryId && <p className="mt-1 text-sm text-brand-700" role="alert">{errors.categoryId.message}</p>}
        </div>
      </fieldset>

      {/* D. Nội dung */}
      <fieldset className="card grid gap-4 p-4">
        <legend className="px-1 text-sm font-bold uppercase tracking-wide text-brand-700">D. Nội dung góp ý</legend>
        <div>
          <label className="label" htmlFor="title">Tiêu đề ngắn gọn <span className="text-brand-600">*</span></label>
          <input id="title" className="input" maxLength={LIMITS.title.max} aria-invalid={!!errors.title} {...register("title")} />
          {errors.title && <p className="mt-1 text-sm text-brand-700" role="alert">{errors.title.message}</p>}
        </div>
        <div>
          <label className="label" htmlFor="content">Nội dung chi tiết <span className="text-brand-600">*</span></label>
          <textarea id="content" rows={7} className="input" maxLength={LIMITS.content.max} aria-invalid={!!errors.content} {...register("content")} />
          <div className="mt-1 flex justify-between text-xs text-ink-muted">
            <span>{errors.content ? <span className="text-sm text-brand-700" role="alert">{errors.content.message}</span> : `Tối thiểu ${LIMITS.content.min} ký tự.`}</span>
            <span>{contentLen}/{LIMITS.content.max}</span>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="proposal">Đề xuất phương án giải quyết (không bắt buộc)</label>
          <textarea id="proposal" rows={3} className="input" maxLength={LIMITS.proposal.max} {...register("proposal")} />
          {errors.proposal && <p className="mt-1 text-sm text-brand-700">{errors.proposal.message}</p>}
        </div>
        {/* Trường bẫy chống gửi tự động — ẩn với người dùng */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Website</label>
          <input id="website" tabIndex={-1} autoComplete="off" {...register("website")} />
        </div>
      </fieldset>

      {/* E. Xác nhận */}
      <div className="card p-4">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-brand-700" {...register("acknowledge")} />
          <span>Tôi đã đọc lưu ý, nội dung không chứa thông tin bí mật nhà nước, bí mật quân sự và hiểu rằng cần lưu lại mã bí mật để tra cứu.</span>
        </label>
        {errors.acknowledge && <p className="mt-2 text-sm text-brand-700" role="alert">{errors.acknowledge.message}</p>}
        {serverError && (
          <div className="mt-3">
            <Alert kind="error">{serverError}</Alert>
          </div>
        )}
        <button type="submit" disabled={isSubmitting} className="btn-primary mt-4 w-full text-base tracking-wide">
          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
          {isSubmitting ? "ĐANG GỬI..." : "GỬI Ý KIẾN"}
        </button>
      </div>
    </form>
  );
}

function SubmitSuccess({ code, secret, createdAt, publicStatus }: { code: string; secret: string; createdAt: Date; publicStatus: string }) {
  const text = `HÒM THƯ GÓP Ý SỐ – LỮ ĐOÀN PHÁO BINH 572\nMã hồ sơ: ${code}\nMã bí mật tra cứu: ${secret}\nThời gian gửi: ${formatDateTime(createdAt)}\n\nGiữ kín mã bí mật. Mất mã bí mật thì không thể tra cứu hồ sơ ẩn danh.`;
  const download = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gop-y-${code}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="space-y-4" aria-live="polite">
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 bg-olive-600 px-4 py-3 text-white">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
          <div>
            <p className="text-lg font-bold">Gửi ý kiến thành công</p>
            <p className="text-sm text-olive-100">Trạng thái: {publicStatus}</p>
          </div>
        </div>
        <div className="space-y-4 p-4">
          <div className="rounded-md border-2 border-dashed border-bronze-300 bg-bronze-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-bronze-700">Mã hồ sơ</p>
            <p className="font-mono text-xl font-bold tracking-wider">{code}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-bronze-700">Mã bí mật tra cứu</p>
            <p className="font-mono text-2xl font-bold tracking-[0.2em] text-brand-700">{secret}</p>
            <p className="mt-3 text-xs text-ink-muted">Thời gian gửi: {formatDateTime(createdAt)}</p>
          </div>
          <Alert kind="warning" title="Lưu ý quan trọng">
            Hãy chép lại hoặc lưu mã bí mật ngay bây giờ. Hệ thống chỉ hiển thị mã này <b>một lần</b> và không lưu dạng có thể đọc lại. Mã hồ sơ không phải mật khẩu; muốn xem nội dung phải có cả hai mã. Không đưa mã bí mật cho người khác.
          </Alert>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={text} label="Sao chép thông tin tra cứu" />
            <button type="button" className="btn-outline btn-sm" onClick={download}>
              <Download className="h-4 w-4" aria-hidden /> Tải tệp lưu mã
            </button>
          </div>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Link href="/tra-cuu" className="btn-olive">Tra cứu kết quả</Link>
        <Link href="/" className="btn-outline">Về trang chủ</Link>
      </div>
    </div>
  );
}
