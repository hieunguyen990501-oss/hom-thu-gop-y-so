import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { APP_NAME, UNIT_NAME } from "@/lib/constants";

export function AuthCard({ title, children, subtitle }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-olive-800 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-5 text-center text-white">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg border border-bronze-300/50 bg-brand-800">
            <LockKeyhole className="h-6 w-6 text-bronze-200" aria-hidden />
          </span>
          <p className="text-xs font-semibold tracking-wide text-bronze-200">{UNIT_NAME}</p>
          <p className="text-lg font-bold">{APP_NAME}</p>
        </div>
        <div className="card p-6">
          <h1 className="text-lg font-bold">{title}</h1>
          {subtitle && <p className="mb-4 mt-1 text-sm text-ink-muted">{subtitle}</p>}
          <div className={subtitle ? "" : "mt-4"}>{children}</div>
        </div>
        <p className="mt-4 text-center text-xs text-olive-100">
          <Link href="/" className="hover:underline">← Về cổng góp ý</Link>
        </p>
      </div>
    </div>
  );
}
