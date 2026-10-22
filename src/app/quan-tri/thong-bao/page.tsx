import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireActor, actorForAction } from "@/server/session";
import { listNotifications, markRead } from "@/server/services/notifications";
import { Badge, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/constants";

export const metadata = { title: "Thông báo" };

async function markAllAction() {
  "use server";
  await markRead(await actorForAction());
  revalidatePath("/quan-tri/thong-bao");
}

async function openAction(fd: FormData) {
  "use server";
  const actor = await actorForAction();
  const id = String(fd.get("id") ?? "");
  await markRead(actor, id);
  const fid = String(fd.get("feedbackId") ?? "");
  const { redirect } = await import("next/navigation");
  redirect(fid ? `/quan-tri/gop-y/${encodeURIComponent(fid)}` : "/quan-tri/thong-bao");
}

export default async function NotificationsPage() {
  const actor = await requireActor();
  const items = await listNotifications(actor, { take: 100 });
  const tone = (t: string) => (t === "OVERDUE" ? "border-brand-200 bg-brand-50 text-brand-700" : t === "DUE_SOON" ? "border-bronze-300 bg-bronze-50 text-bronze-700" : "border-olive-200 bg-olive-50 text-olive-700");
  return (
    <div>
      <PageHeader
        title="Thông báo nội bộ"
        subtitle="Thông báo chỉ hiển thị trong hệ thống, không gửi ra email/SMS."
        actions={
          <form action={markAllAction}>
            <button className="btn-outline btn-sm">Đánh dấu đã đọc tất cả</button>
          </form>
        }
      />
      <Card bodyClassName="p-0">
        {items.length === 0 ? (
          <EmptyState title="Chưa có thông báo" />
        ) : (
          <ul className="divide-y divide-cream-100">
            {items.map((n) => (
              <li key={n.id} className={cx("flex flex-wrap items-start gap-3 px-4 py-3", !n.isRead && "bg-bronze-50/50")}>
                <Badge className={tone(n.type)}>{NOTIFICATION_TYPE_LABELS[n.type] ?? n.type}</Badge>
                <div className="min-w-0 flex-1">
                  <p className={cx("text-sm", !n.isRead && "font-bold")}>{n.title}</p>
                  <p className="text-sm text-ink-muted">{n.message}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{formatDateTime(n.createdAt)}</p>
                </div>
                {n.feedback ? (
                  <form action={openAction}>
                    <input type="hidden" name="id" value={n.id} />
                    <input type="hidden" name="feedbackId" value={n.feedback.id} />
                    <button className="btn-outline btn-sm">Mở hồ sơ</button>
                  </form>
                ) : (
                  <Link href="/quan-tri" className="btn-ghost btn-sm">Xem</Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
