"use client";
// Các thành phần giao diện chạy phía trình duyệt: nút gửi có trạng thái chờ, hộp xác nhận, sao chép, in.
import { useFormStatus } from "react-dom";
import { useContext, useRef, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { cx } from "./index";
import { PendingContext } from "./action-form";

export function SubmitButton({ children, className = "btn-primary", pendingText = "Đang xử lý...", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const status = useFormStatus();
  const ctxPending = useContext(PendingContext);
  const pending = status.pending || ctxPending;
  return (
    <button type="submit" disabled={pending || rest.disabled} className={className} {...rest}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? pendingText : children}
    </button>
  );
}

// Nút gửi biểu mẫu có bước xác nhận (dùng thẻ <dialog> gốc, hỗ trợ bàn phím, Esc để hủy).
export function ConfirmSubmit({ children, message, className = "btn-primary", confirmLabel = "Xác nhận" }: { children: React.ReactNode; message: string; className?: string; confirmLabel?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const status = useFormStatus();
  const ctxPending = useContext(PendingContext);
  const pending = status.pending || ctxPending;
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          const form = triggerRef.current?.form;
          if (form && !form.reportValidity()) return;
          ref.current?.showModal();
        }}
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
      <dialog ref={ref} className="w-[min(92vw,440px)] rounded-lg border border-cream-200 p-0 shadow-xl backdrop:bg-black/40">
        <div className="p-5">
          <p className="mb-1 text-base font-bold">Xác nhận thao tác</p>
          <p className="text-sm text-ink-soft">{message}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-cream-200 bg-cream px-5 py-3">
          <button type="button" className="btn-outline btn-sm" onClick={() => ref.current?.close()} autoFocus>
            Hủy
          </button>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => {
              ref.current?.close();
              triggerRef.current?.form?.requestSubmit();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}

export function CopyButton({ text, label = "Sao chép", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={cx("btn-outline btn-sm", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
    >
      {done ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {done ? "Đã sao chép" : label}
    </button>
  );
}

export function PrintButton({ label = "In / Lưu PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn-primary" onClick={() => window.print()}>
      {label}
    </button>
  );
}
