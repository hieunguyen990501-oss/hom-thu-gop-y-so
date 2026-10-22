import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/admin/auth-card";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/client";
import { getCurrentActor } from "@/server/session";
import { loginAction } from "./actions";

export const metadata: Metadata = { title: "Đăng nhập quản trị" };

export default async function LoginPage() {
  if (await getCurrentActor()) redirect("/quan-tri");
  return (
    <AuthCard title="Đăng nhập" subtitle="Dành cho cán bộ được giao nhiệm vụ tiếp nhận, xử lý và quản trị.">
      <ActionForm action={loginAction} className="space-y-4">
        <div>
          <label className="label" htmlFor="username">Tên đăng nhập</label>
          <input id="username" name="username" className="input" autoComplete="username" required autoFocus maxLength={60} />
        </div>
        <div>
          <label className="label" htmlFor="password">Mật khẩu</label>
          <input id="password" name="password" type="password" className="input" autoComplete="current-password" required maxLength={128} />
        </div>
        <SubmitButton className="btn-primary w-full" pendingText="Đang đăng nhập...">Đăng nhập</SubmitButton>
        <p className="text-xs text-ink-muted">Sai mật khẩu 5 lần liên tiếp, tài khoản bị khóa tạm 15 phút. Quên mật khẩu: liên hệ quản trị hệ thống để được cấp lại.</p>
      </ActionForm>
    </AuthCard>
  );
}
