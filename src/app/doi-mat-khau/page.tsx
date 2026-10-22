import type { Metadata } from "next";
import { AuthCard } from "@/components/admin/auth-card";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/client";
import { requireActor } from "@/server/session";
import { changePasswordAction } from "../dang-nhap/actions";

export const metadata: Metadata = { title: "Đổi mật khẩu" };

export default async function ChangePasswordPage() {
  const actor = await requireActor({ allowMustChange: true });
  return (
    <AuthCard
      title="Đổi mật khẩu"
      subtitle={actor.mustChangePassword ? "Đồng chí đang dùng mật khẩu tạm. Vui lòng đặt mật khẩu mới trước khi sử dụng hệ thống." : "Mật khẩu tối thiểu 10 ký tự, gồm cả chữ và số, không chứa tên đăng nhập."}
    >
      <ActionForm action={changePasswordAction} className="space-y-4">
        <div>
          <label className="label" htmlFor="currentPassword">Mật khẩu hiện tại</label>
          <input id="currentPassword" name="currentPassword" type="password" className="input" autoComplete="current-password" required />
        </div>
        <div>
          <label className="label" htmlFor="newPassword">Mật khẩu mới</label>
          <input id="newPassword" name="newPassword" type="password" className="input" autoComplete="new-password" minLength={10} required />
        </div>
        <div>
          <label className="label" htmlFor="confirmPassword">Nhập lại mật khẩu mới</label>
          <input id="confirmPassword" name="confirmPassword" type="password" className="input" autoComplete="new-password" minLength={10} required />
        </div>
        <SubmitButton className="btn-primary w-full">Lưu mật khẩu mới</SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
