"use client";
import { useActionState, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui";
import type { FormAction } from "@/components/ui/action-form";

// Xem thông tin người gửi: chỉ tải khi cán bộ chủ động bấm, mỗi lần xem đều ghi nhật ký.
export function SenderReveal({ id, action }: { id: string; action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, null);
  const info = state?.ok ? (state.data as { fullName: string | null; contact: string | null; unitName: string | null } | undefined) : undefined;
  return (
    <div className="space-y-3">
      {!info && (
        <form action={formAction}>
          <input type="hidden" name="id" value={id} />
          <p className="mb-2 text-xs text-ink-muted">Người gửi đã tự nguyện cung cấp thông tin. Chỉ xem khi cần thiết cho việc giải quyết; thao tác xem được ghi nhật ký.</p>
          <button className="btn-outline btn-sm" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />} Xem thông tin người gửi
          </button>
        </form>
      )}
      {info && (
        <dl className="space-y-1 text-sm">
          <div><dt className="inline text-ink-muted">Họ và tên: </dt><dd className="inline font-semibold">{info.fullName ?? "—"}</dd></div>
          <div><dt className="inline text-ink-muted">Đơn vị: </dt><dd className="inline font-semibold">{info.unitName ?? "—"}</dd></div>
          <div><dt className="inline text-ink-muted">Liên hệ: </dt><dd className="inline font-semibold">{info.contact ?? "—"}</dd></div>
        </dl>
      )}
      {state && !state.ok && <Alert kind="error">{state.error}</Alert>}
      {state?.ok && state.message && <Alert>{state.message}</Alert>}
    </div>
  );
}

// Ô soạn nội dung có chọn mẫu trả lời đã được phê duyệt.
export function TemplateTextarea({ name, templates, defaultValue = "", rows = 6, required, id }: { name: string; templates: { id: string; title: string; content: string }[]; defaultValue?: string; rows?: number; required?: boolean; id: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="space-y-2">
      {templates.length > 0 && (
        <select
          className="input py-2 text-sm"
          aria-label="Chèn mẫu trả lời"
          defaultValue=""
          onChange={(e) => {
            const t = templates.find((x) => x.id === e.target.value);
            if (t) setValue((v) => (v ? v + "\n\n" : "") + t.content);
            e.target.value = "";
          }}
        >
          <option value="">— Chèn mẫu trả lời đã duyệt —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      )}
      <textarea id={id} name={name} className="input" rows={rows} value={value} onChange={(e) => setValue(e.target.value)} required={required} maxLength={5000} />
    </div>
  );
}
