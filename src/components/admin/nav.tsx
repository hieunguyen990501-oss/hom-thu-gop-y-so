"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3, Bell, BookOpen, ClipboardList, FileText, FolderTree, History, LayoutDashboard, Menu, QrCode, Settings, ShieldCheck, UserCog, Users, X, Archive, MessageSquareText,
} from "lucide-react";
import { cx } from "@/components/ui";

const ICONS = { LayoutDashboard, ClipboardList, BarChart3, Bell, QrCode, Users, FolderTree, Settings, MessageSquareText, History, Archive, UserCog, BookOpen, FileText, ShieldCheck };
export type IconName = keyof typeof ICONS;
export interface NavItem { href: string; label: string; icon: IconName; group?: string }

export function AdminNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const groups = [...new Set(items.map((i) => i.group ?? ""))];
  const nav = (
    <nav aria-label="Điều hướng quản trị" className="space-y-5 p-3">
      {groups.map((g) => (
        <div key={g}>
          {g && <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-widest text-olive-200/70">{g}</p>}
          <ul className="space-y-0.5">
            {items.filter((i) => (i.group ?? "") === g).map((i) => {
              const Icon = ICONS[i.icon];
              const base = i.href.split("?")[0];
              const active = pathname === base || (base !== "/quan-tri" && pathname.startsWith(base + "/"));
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex min-h-[42px] items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                      active ? "bg-bronze-200 text-olive-900" : "text-olive-50 hover:bg-olive-700",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                    {i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
  return (
    <>
      <button type="button" className="btn-ghost btn-sm text-white hover:bg-olive-700 lg:hidden" onClick={() => setOpen(true)} aria-label="Mở menu">
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      <aside className="no-print hidden w-64 shrink-0 overflow-y-auto bg-olive-800 lg:fixed lg:inset-y-0 lg:left-0 lg:top-[60px] lg:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-olive-800 shadow-xl">
            <div className="flex justify-end p-2">
              <button type="button" className="btn-ghost btn-sm text-white hover:bg-olive-700" onClick={() => setOpen(false)} aria-label="Đóng menu">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}
    </>
  );
}

// Chuông thông báo: cập nhật gần thời gian thực bằng truy vấn định kỳ 30 giây.
export function NotificationBell({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/thong-bao/dem", { cache: "no-store" });
        if (r.ok && alive) setCount((await r.json()).count ?? 0);
      } catch {
        /* bỏ qua lỗi mạng tạm thời */
      }
    };
    const t = setInterval(tick, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return (
    <Link href="/quan-tri/thong-bao" className="relative flex h-10 w-10 items-center justify-center rounded-md text-white hover:bg-brand-900/40" aria-label={`Thông báo: ${count} chưa đọc`}>
      <Bell className="h-5 w-5" aria-hidden />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 min-w-[18px] rounded-full bg-bronze-300 px-1 text-center text-[11px] font-bold leading-[18px] text-brand-900">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

// Tự làm mới dữ liệu trang (dashboard) theo chu kỳ.
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [seconds, router]);
  return null;
}
