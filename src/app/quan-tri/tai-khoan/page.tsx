import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireActor, actorForAction } from "@/server/session";
import { beginTotpSetup, confirmTotpSetup, disableTotp } from "@/server/services/auth";
import { qrDataUrl } from "@/server/services/qr";
import { toActionError } from "@/server/errors";
import { prisma } from "@/server/db";
import { Alert, Card, PageHeader } from "@/components/ui";
import { ActionForm, type FormState } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/client";
import { ROLE_LABELS } from "@/lib/constants";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/dates";
import { decrypt } from "@/server/auth/crypto";
import { totpUri } from "@/server/auth/totp";

export const metadata = { title: "Tài khoản của tôi" };

async function startTotp() {
  "use server";
  await beginTotpSetup(await actorForAction());
  revalidatePath("/quan-tri/tai-khoan");
}

async function confirmTotp(_: FormState, fd: FormData): Promise<FormState> {
  "use server";
  try {
    await confirmTotpSetup(await actorForAction(), String(fd.get("code") ?? ""));
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/quan-tri", "layout");
  return { ok: true, message: "Đã bật xác thực hai yếu tố." };
}

async function offTotp(_: FormState, fd: FormData): Promise<FormState> {
  "use server";
  try {
    await disableTotp(await actorForAction(), String(fd.get("password") ?? ""));
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/quan-tri", "layout");
  return { ok: true, message: "Đã tắt xác thực hai yếu tố." };
}

export default async function AccountPage() {
  const actor = await requireActor();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, include: { unit: true } });
  let setup: { secret: string; img: string } | null = null;
  if (!user.totpEnabled && user.totpSecretEnc) {
    const secret = decrypt(user.totpSecretEnc);
    setup = { secret, img: await qrDataUrl(totpUri(secret, user.username), 320) };
  }
  return (
    <div className="space-y-4">
      <PageHeader title="Tài khoản của tôi" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Thông tin tài khoản">
          <dl className="space-y-2 text-sm">
            <div><dt className="text-xs text-ink-muted">Họ và tên</dt><dd className="font-semibold">{user.rank} {user.fullName}</dd></div>
            <div><dt className="text-xs text-ink-muted">Tên đăng nhập</dt><dd className="font-mono">{user.username}</dd></div>
            <div><dt className="text-xs text-ink-muted">Vai trò</dt><dd>{ROLE_LABELS[actor.roleCode]}</dd></div>
            <div><dt className="text-xs text-ink-muted">Chức vụ, đơn vị</dt><dd>{[user.position, user.unit?.name].filter(Boolean).join(" – ") || "—"}</dd></div>
            <div><dt className="text-xs text-ink-muted">Đăng nhập gần nhất</dt><dd>{formatDateTime(user.lastLoginAt)}</dd></div>
            <div><dt className="text-xs text-ink-muted">Phạm vi lĩnh vực</dt><dd>{actor.categoryScope.length ? `${actor.categoryScope.length} lĩnh vực được giao` : "Toàn bộ lĩnh vực"}</dd></div>
          </dl>
          <Link href="/doi-mat-khau" className="btn-outline btn-sm mt-4">Đổi mật khẩu</Link>
        </Card>
        <Card title="Xác thực hai yếu tố (TOTP)">
          {user.totpEnabled ? (
            <div className="space-y-3">
              <Alert kind="success">Đang bật. Mỗi lần đăng nhập cần nhập mã 6 số từ ứng dụng xác thực.</Alert>
              <ActionForm action={offTotp} className="space-y-2">
                <label className="label text-xs" htmlFor="pw">Nhập mật khẩu để tắt</label>
                <input id="pw" name="password" type="password" className="input" required autoComplete="current-password" />
                <SubmitButton className="btn-danger btn-sm">Tắt xác thực hai yếu tố</SubmitButton>
              </ActionForm>
            </div>
          ) : setup ? (
            <div className="space-y-3 text-sm">
              <p>1. Cài ứng dụng xác thực (Google Authenticator, Microsoft Authenticator, FreeOTP...) — ứng dụng hoạt động không cần Internet.</p>
              <p>2. Quét mã dưới đây hoặc nhập khóa thủ công:</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setup.img} alt="Mã QR thiết lập xác thực hai yếu tố" className="h-48 w-48 rounded border border-cream-200" />
              <p className="break-all rounded bg-cream p-2 font-mono text-xs">{setup.secret}</p>
              <ActionForm action={confirmTotp} className="space-y-2">
                <label className="label text-xs" htmlFor="code">3. Nhập mã 6 số đang hiển thị trong ứng dụng</label>
                <input id="code" name="code" className="input max-w-[180px] text-center font-mono tracking-[0.3em]" inputMode="numeric" maxLength={6} required />
                <SubmitButton className="btn-olive btn-sm">Xác nhận và bật</SubmitButton>
              </ActionForm>
            </div>
          ) : (
            <form action={startTotp} className="space-y-3 text-sm">
              <p>Khuyến nghị bắt buộc với tài khoản quản trị hệ thống và lãnh đạo, chỉ huy. Mã xác thực sinh trên điện thoại, giúp tài khoản an toàn kể cả khi lộ mật khẩu.</p>
              <SubmitButton className="btn-olive btn-sm">Bắt đầu thiết lập</SubmitButton>
            </form>
          )}
        </Card>
      </div>
      <Card title="Quyền của tài khoản">
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {[...actor.permissions].map((p) => <li key={p} className="flex gap-2"><span className="text-olive-600">✓</span>{PERMISSIONS[p]?.name ?? p}</li>)}
        </ul>
      </Card>
    </div>
  );
}
