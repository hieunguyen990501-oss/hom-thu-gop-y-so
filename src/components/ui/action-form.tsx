"use client";
// Biểu mẫu gắn với server action: hiển thị trạng thái chờ, thông báo lỗi/thành công dễ hiểu.
import { useActionState, useEffect, useRef } from "react";
import { Alert } from "./index";

export type FormState = { ok: boolean; error?: string; message?: string; data?: Record<string, unknown> } | null;
export type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  id,
}: {
  action: FormAction;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  id?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} id={id} action={formAction} className={className} noValidate={false}>
      {children}
      {state && !state.ok && state.error && (
        <div className="mt-3">
          <Alert kind="error">{state.error}</Alert>
        </div>
      )}
      {state?.ok && state.message && (
        <div className="mt-3">
          <Alert kind="success">{state.message}</Alert>
        </div>
      )}
    </form>
  );
}
