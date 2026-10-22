"use client";
// Biểu mẫu gắn với server action: hiển thị trạng thái chờ, thông báo lỗi/thành công dễ hiểu.
// Gọi action qua onSubmit (thay vì thuộc tính action) để React không tự đặt lại các ô nhập về giá trị cũ
// sau khi lưu — người dùng thấy đúng giá trị vừa lưu.
import { createContext, startTransition, useActionState, useEffect, useRef } from "react";
import { Alert } from "./index";

export type FormState = { ok: boolean; error?: string; message?: string; data?: Record<string, unknown> } | null;
export type FormAction = (prev: FormState, formData: FormData) => Promise<FormState>;

export const PendingContext = createContext(false);

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
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      id={id}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const fd = new FormData(e.currentTarget, submitter);
        startTransition(() => formAction(fd));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
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
