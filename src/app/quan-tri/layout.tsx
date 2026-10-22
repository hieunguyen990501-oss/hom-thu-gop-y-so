import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireActor } from "@/server/session";
import { can, canAny } from "@/server/rbac";
import { getSetting } from "@/server/settings";
import { unreadCount } from "@/server/services/notifications";
import { AdminNav, NotificationBell, type NavItem } from "@/components/admin/nav";
import { APP_NAME, ROLE_LABELS, UNIT_NAME } from "@/lib/constants";
import { logoutAction } from "../dang-nhap/actions";

export const metadata = { title: "Quản trị" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const [demo, unread, totpRoles] = await Promise.all([getSetting("system.demoMode"), unreadCount(actor), getSetting("security.requireTotpRoles")]);

  const items: NavItem[] = [];
  if (can(actor, "DASHBOARD_VIEW")) items.push({ href: "/quan-tri/tong-quan", label: "Bảng điều hành", icon: "LayoutDashboard", group: "Điều hành" });
  if (canAny(actor, ["FEEDBACK_VIEW_ALL", "FEEDBACK_VIEW_ASSIGNED"])) {
    if (can(actor, "FEEDBACK_PROCESS")) items.push({ href: "/quan-tri/gop-y?view=mine", label: "Việc được giao", icon: "ClipboardList", group: "Điều hành" });
    items.push({ href: "/quan-tri/gop-y", label: "Hồ sơ góp ý", icon: "FileText", group: "Điều hành" });
  }
  if (can(actor, "REPORT_VIEW")) items.push({ href: "/quan-tri/bao-cao", label: "Báo cáo", icon: "BarChart3", group: "Điều hành" });
  items.push({ href: "/quan-tri/thong-bao", label: "Thông báo", icon: "Bell", group: "Điều hành" });
  if (can(actor, "ADMIN_QR")) items.push({ href: "/quan-tri/ma-qr", label: "Mã QR", icon: "QrCode", group: "Điều hành" });
  if (can(actor, "ADMIN_USERS")) items.push({ href: "/quan-tri/he-thong/nguoi-dung", label: "Tài khoản, phân quyền", icon: "Users", group: "Quản trị hệ thống" });
  if (can(actor, "ADMIN_CATALOG")) items.push({ href: "/quan-tri/he-thong/danh-muc", label: "Danh mục", icon: "FolderTree", group: "Quản trị hệ thống" });
  if (can(actor, "ADMIN_SETTINGS")) items.push({ href: "/quan-tri/he-thong/cau-hinh", label: "Cấu hình", icon: "Settings", group: "Quản trị hệ thống" });
  if (can(actor, "ADMIN_TEMPLATES")) items.push({ href: "/quan-tri/he-thong/mau-tra-loi", label: "Mẫu trả lời", icon: "MessageSquareText", group: "Quản trị hệ thống" });
  if (can(actor, "ADMIN_AUDIT")) items.push({ href: "/quan-tri/he-thong/nhat-ky", label: "Nhật ký hệ thống", icon: "History", group: "Quản trị hệ thống" });
  if (can(actor, "ADMIN_RETENTION")) items.push({ href: "/quan-tri/he-thong/luu-tru", label: "Lưu trữ, xóa dữ liệu", icon: "Archive", group: "Quản trị hệ thống" });
  items.push({ href: "/quan-tri/tai-khoan", label: "Tài khoản của tôi", icon: "UserCog", group: "Cá nhân" });
  items.push({ href: "/quan-tri/huong-dan", label: "Hướng dẫn sử dụng", icon: "BookOpen", group: "Cá nhân" });

  const highPrivilege = ["ADMIN", "LEADER"].includes(actor.roleCode);
  const totpRequired = totpRoles.includes(actor.roleCode);

  return (
    <div className="min-h-screen">
      <header className="no-print fixed inset-x-0 top-0 z-40 flex h-[60px] items-center gap-2 border-b-2 border-bronze-300 bg-brand-800 px-3 text-white">
        <AdminNav items={items} />
        <Link href="/quan-tri" className="min-w-0 flex-1 leading-tight">
          <span className="hidden text-[11px] font-semibold text-bronze-200 sm:block">{UNIT_NAME}</span>
          <span className="block truncate text-[15px] font-bold">{APP_NAME} – Quản trị</span>
        </Link>
        <div className="hidden text-right text-xs leading-tight md:block">
          <p className="font-semibold">{actor.fullName}</p>
          <p className="text-bronze-200">{ROLE_LABELS[actor.roleCode]}</p>
        </div>
        <NotificationBell initial={unread} />
        <form action={logoutAction}>
          <button className="flex h-10 items-center gap-1 rounded-md px-2 text-sm hover:bg-brand-900/40" aria-label="Đăng xuất">
            <LogOut className="h-5 w-5" aria-hidden />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </form>
      </header>
      <div className="pt-[60px] lg:pl-64 print:p-0">
        {demo && (
          <div className="no-print bg-amber-100 px-4 py-1.5 text-center text-xs font-semibold text-amber-900">
            CHẾ ĐỘ DEMO – chỉ hiển thị dữ liệu giả lập. Trước khi vận hành chính thức: Quản trị → Lưu trữ, xóa dữ liệu → Xóa dữ liệu demo.
          </div>
        )}
        {highPrivilege && !actor.totpEnabled && (
          <div className="no-print border-b border-bronze-300 bg-bronze-50 px-4 py-2 text-center text-xs text-bronze-700">
            {totpRequired ? "Cấu hình yêu cầu" : "Khuyến nghị"} bật xác thực hai yếu tố cho tài khoản có thẩm quyền cao.{" "}
            <Link href="/quan-tri/tai-khoan" className="font-semibold underline">Bật ngay</Link>
          </div>
        )}
        <main className="mx-auto max-w-7xl px-4 py-5 md:px-6 print:max-w-none print:p-0">{children}</main>
      </div>
    </div>
  );
}
