import type { FeedbackStatus, Priority } from "@prisma/client";
import { Inbox, Loader2 } from "lucide-react";
import Link from "next/link";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/constants";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Card({ className, children, title, actions, bodyClassName }: { className?: string; children: React.ReactNode; title?: React.ReactNode; actions?: React.ReactNode; bodyClassName?: string }) {
  return (
    <section className={cx("card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-cream-200 px-4 py-3">
          {title && <h2 className="text-[15px] font-bold text-ink">{title}</h2>}
          {actions}
        </header>
      )}
      <div className={bodyClassName ?? "p-4"}>{children}</div>
    </section>
  );
}

const STATUS_STYLE: Record<FeedbackStatus, string> = {
  NEW: "bg-brand-50 text-brand-700 border-brand-200",
  CLASSIFYING: "bg-bronze-50 text-bronze-700 border-bronze-200",
  ASSIGNED: "bg-olive-50 text-olive-700 border-olive-200",
  IN_PROGRESS: "bg-sky-50 text-sky-900 border-sky-200",
  WAITING_INFO: "bg-amber-50 text-amber-900 border-amber-200",
  PENDING_APPROVAL: "bg-violet-50 text-violet-900 border-violet-200",
  RESOLVED: "bg-green-50 text-green-900 border-green-200",
  CLOSED_NO_ACTION: "bg-stone-100 text-stone-700 border-stone-300",
  TRANSFERRED: "bg-slate-100 text-slate-700 border-slate-300",
};

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cx("inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", className)}>{children}</span>;
}

export function StatusBadge({ status }: { status: FeedbackStatus }) {
  return <Badge className={STATUS_STYLE[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const cls =
    priority === "HIGH"
      ? "bg-brand-700 text-white border-brand-700"
      : priority === "ATTENTION"
        ? "bg-bronze-100 text-bronze-700 border-bronze-300"
        : "bg-white text-ink-muted border-cream-200";
  return <Badge className={cls}>{PRIORITY_LABELS[priority]}</Badge>;
}

export function DemoBadge() {
  return <Badge className="border-amber-300 bg-amber-100 text-amber-900">DEMO</Badge>;
}

export function Alert({ kind = "info", children, title }: { kind?: "info" | "error" | "success" | "warning"; children: React.ReactNode; title?: string }) {
  const styles = {
    info: "border-olive-200 bg-olive-50 text-olive-900",
    error: "border-brand-200 bg-brand-50 text-brand-800",
    success: "border-green-200 bg-green-50 text-green-900",
    warning: "border-bronze-300 bg-bronze-50 text-bronze-700",
  }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={cx("rounded-md border px-4 py-3 text-sm leading-relaxed", styles)}>
      {title && <p className="mb-1 font-bold">{title}</p>}
      {children}
    </div>
  );
}

export function EmptyState({ title = "Chưa có dữ liệu", children }: { title?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-ink-muted">
      <Inbox className="h-10 w-10 text-cream-200" aria-hidden />
      <p className="font-semibold text-ink-soft">{title}</p>
      {children && <div className="text-sm">{children}</div>}
    </div>
  );
}

export function Spinner({ label = "Đang tải..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-ink-muted" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-ink md:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Pagination({ page, pages, makeHref }: { page: number; pages: number; makeHref: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Phân trang" className="flex items-center justify-between gap-2 pt-4 text-sm">
      <span className="text-ink-muted">
        Trang {page}/{pages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className="btn-outline btn-sm" href={makeHref(page - 1)}>
            ← Trước
          </Link>
        ) : (
          <span className="btn-outline btn-sm opacity-50">← Trước</span>
        )}
        {page < pages ? (
          <Link className="btn-outline btn-sm" href={makeHref(page + 1)}>
            Sau →
          </Link>
        ) : (
          <span className="btn-outline btn-sm opacity-50">Sau →</span>
        )}
      </div>
    </nav>
  );
}

export function Field({ label, htmlFor, hint, error, children, required }: { label: string; htmlFor?: string; hint?: string; error?: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label} {required && <span className="text-brand-600" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      {error && (
        <p className="mt-1 text-sm font-medium text-brand-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Stat({ label, value, hint, tone = "default" }: { label: string; value: React.ReactNode; hint?: string; tone?: "default" | "brand" | "olive" | "warn" | "good" }) {
  const toneCls = {
    default: "border-l-cream-200",
    brand: "border-l-brand-600",
    olive: "border-l-olive-500",
    warn: "border-l-bronze-400",
    good: "border-l-green-600",
  }[tone];
  return (
    <div className={cx("card border-l-4 px-4 py-3", toneCls)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
