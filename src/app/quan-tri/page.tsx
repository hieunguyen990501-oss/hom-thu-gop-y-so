import { redirect } from "next/navigation";
import { requireActor } from "@/server/session";
import { can, canAny } from "@/server/rbac";
import { Alert, PageHeader } from "@/components/ui";

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireActor();
  const sp = await searchParams;
  if (!sp.loi && !sp["doi-mat-khau"]) {
    if (can(actor, "DASHBOARD_VIEW")) redirect("/quan-tri/tong-quan");
    if (can(actor, "FEEDBACK_PROCESS")) redirect("/quan-tri/gop-y?view=mine");
    if (canAny(actor, ["FEEDBACK_VIEW_ALL", "FEEDBACK_VIEW_ASSIGNED"])) redirect("/quan-tri/gop-y");
    if (can(actor, "ADMIN_USERS")) redirect("/quan-tri/he-thong/nguoi-dung");
  }
  return (
    <div>
      <PageHeader title={`Xin chào, ${actor.fullName}`} />
      {sp.loi === "khong-co-quyen" && <Alert kind="error">Đồng chí không có quyền truy cập chức năng vừa chọn.</Alert>}
      {sp["doi-mat-khau"] === "ok" && <Alert kind="success">Đã đổi mật khẩu thành công. Các phiên đăng nhập khác đã bị đăng xuất.</Alert>}
      <p className="mt-4 text-sm text-ink-muted">Chọn chức năng ở thanh menu bên trái.</p>
    </div>
  );
}
