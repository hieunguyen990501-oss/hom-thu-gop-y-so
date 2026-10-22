import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/auth-card";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/client";
import { mfaAction } from "../actions";

export const metadata: Metadata = { title: "Xác thực hai yếu tố" };

export default function MfaPage() {
  return (
    <AuthCard title="Xác thực hai yếu tố" subtitle="Nhập mã 6 chữ số trong ứng dụng xác thực (Google Authenticator, Microsoft Authenticator...).">
      <ActionForm action={mfaAction} className="space-y-4">
        <div>
          <label className="label" htmlFor="code">Mã xác thực</label>
          <input id="code" name="code" className="input text-center font-mono text-xl tracking-[0.4em]" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required autoFocus />
        </div>
        <SubmitButton className="btn-primary w-full">Xác nhận</SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
