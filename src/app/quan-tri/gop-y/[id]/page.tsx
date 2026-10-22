import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Lightbulb } from "lucide-react";
import { requirePermission } from "@/server/session";
import { can, type Actor } from "@/server/rbac";
import { AppError } from "@/server/errors";
import { findSimilar, getFeedbackDetail, processingOptions } from "@/server/services/feedback-admin";
import { Alert, Badge, Card, DemoBadge, PriorityBadge, StatusBadge, cx } from "@/components/ui";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { SenderReveal, TemplateTextarea } from "@/components/admin/feedback-widgets";
import {
  FEEDBACK_TYPES, FEEDBACK_TYPE_LABELS, MANUAL_TRANSITIONS, OPEN_STATUSES, PRIORITIES, PRIORITY_LABELS, SATISFACTION_LABELS, STATUS_LABELS, TERMINAL_STATUSES,
} from "@/lib/constants";
import { formatDate, formatDateTime, toVnIsoDate } from "@/lib/dates";
import * as A from "./actions";

export const metadata = { title: "Chi tiết hồ sơ" };

type Detail = Awaited<ReturnType<typeof getFeedbackDetail>>;
type Opts = Awaited<ReturnType<typeof processingOptions>>;

export default async function FeedbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission(["FEEDBACK_VIEW_ALL", "FEEDBACK_VIEW_ASSIGNED"]);
  const { id } = await params;
  let fb: Detail;
  try {
    fb = await getFeedbackDetail(actor, id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const [opts, similar] = await Promise.all([processingOptions(actor), findSimilar(actor, fb.id)]);
  const now = new Date();
  const overdue = OPEN_STATUSES.includes(fb.status) && fb.dueAt && fb.dueAt < now;
  const terminal = TERMINAL_STATUSES.includes(fb.status);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/quan-tri/gop-y" className="text-sm text-ink-muted hover:underline">← Danh sách hồ sơ</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-xl font-bold">{fb.code}</h1>
          <StatusBadge status={fb.status} />
          <PriorityBadge priority={fb.priority} />
          {fb.isDemo && <DemoBadge />}
          {fb.needsLeaderReview && <Badge className="border-violet-200 bg-violet-50 text-violet-900">Cần lãnh đạo xem xét</Badge>}
          {overdue && <Badge className="border-brand-700 bg-brand-700 text-white">Quá hạn</Badge>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Thông tin tiếp nhận">
            <dl className="mb-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Row k="Ngày gửi" v={formatDateTime(fb.createdAt)} />
              <Row k="Hình thức gửi" v={fb.isAnonymous ? "Ẩn danh" : "Có thông tin người gửi"} />
              <Row k="Loại ý kiến" v={FEEDBACK_TYPE_LABELS[fb.type]} />
              <Row k="Lĩnh vực" v={fb.category.name} />
            </dl>
            {fb.suggestedCategory && can(actor, "FEEDBACK_CLASSIFY") && !terminal && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-bronze-200 bg-bronze-50 p-3 text-sm text-bronze-700">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>Gợi ý phân loại theo từ khóa: lĩnh vực <b>{fb.suggestedCategory.name}</b>. Gợi ý chỉ để tham khảo — cán bộ tiếp nhận xác nhận ở mục “Phân loại”.</p>
              </div>
            )}
            <h2 className="text-lg font-bold">{fb.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{fb.content}</p>
            {fb.proposal && (
              <div className="mt-4 rounded-md bg-cream p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Đề xuất phương án giải quyết</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{fb.proposal}</p>
              </div>
            )}
          </Card>

          {fb.messages.length > 0 && (
            <Card title={`Thông tin bổ sung từ người gửi (${fb.messages.length})`}>
              <ul className="space-y-2">
                {fb.messages.map((m) => (
                  <li key={m.id} className="rounded-md border border-bronze-200 bg-bronze-50 p-3 text-sm">
                    <p className="text-xs text-ink-muted">{formatDateTime(m.createdAt)}</p>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Phản hồi cho người gửi">
            {fb.responses.length === 0 ? (
              <p className="text-sm text-ink-muted">Chưa có phản hồi.</p>
            ) : (
              <ul className="space-y-3">
                {fb.responses.map((r) => (
                  <li key={r.id} className="rounded-md border border-cream-200 p-3 text-sm">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                      <Badge className="border-cream-200 bg-cream">{r.kind === "REQUEST_INFO" ? "Yêu cầu bổ sung" : "Trả lời / kết quả"}</Badge>
                      <Badge className={r.status === "PUBLISHED" ? "border-green-200 bg-green-50 text-green-900" : r.status === "REJECTED" ? "border-brand-200 bg-brand-50 text-brand-700" : "border-violet-200 bg-violet-50 text-violet-900"}>
                        {r.status === "PUBLISHED" ? "Đã công bố cho người gửi" : r.status === "REJECTED" ? "Bị trả lại" : "Chờ duyệt"}
                      </Badge>
                      <span>Soạn: {r.author.rank} {r.author.fullName} · {formatDateTime(r.createdAt)}</span>
                      {r.approvedBy && r.status !== "REJECTED" && <span>· Duyệt: {r.approvedBy.fullName}</span>}
                    </div>
                    <p className="whitespace-pre-wrap">{r.content}</p>
                    {r.rejectReason && <p className="mt-1 text-xs text-brand-700">Lý do trả lại: {r.rejectReason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Tiến trình xử lý">
            <ol className="relative ml-2 border-l-2 border-cream-200">
              {fb.history.map((h) => (
                <li key={h.id} className="mb-4 ml-4 last:mb-0">
                  <span className={cx("absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-white", h.actorType === "SENDER" ? "bg-bronze-400" : h.actorType === "SYSTEM" ? "bg-olive-500" : "bg-brand-600")} aria-hidden />
                  <p className="text-xs text-ink-muted">
                    {formatDateTime(h.createdAt)} · {h.actorType === "SENDER" ? "Người gửi" : h.actorType === "SYSTEM" ? "Hệ thống" : `${h.actor?.rank ?? ""} ${h.actor?.fullName ?? ""}`.trim()}
                  </p>
                  <p className="text-sm">
                    {h.fromStatus && h.fromStatus !== h.toStatus ? <><b>{STATUS_LABELS[h.fromStatus]}</b> → <b>{STATUS_LABELS[h.toStatus]}</b>. </> : !h.fromStatus ? <b>{STATUS_LABELS[h.toStatus]}. </b> : null}
                    {h.note}
                  </p>
                  {h.publicNote && <p className="text-xs text-olive-700">Hiển thị cho người gửi: “{h.publicNote}”</p>}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-ink-muted">Lịch sử xử lý chỉ được ghi thêm, không thể sửa hay xóa.</p>
          </Card>

          {can(actor, "FEEDBACK_NOTE") && (
            <Card title="Ghi chú nội bộ (người gửi không thấy)">
              {fb.notes.length > 0 && (
                <ul className="mb-4 space-y-2">
                  {fb.notes.map((n) => (
                    <li key={n.id} className="rounded-md bg-cream p-3 text-sm">
                      <p className="text-xs text-ink-muted">{n.author.rank} {n.author.fullName} · {formatDateTime(n.createdAt)}</p>
                      <p className="whitespace-pre-wrap">{n.content}</p>
                    </li>
                  ))}
                </ul>
              )}
              <ActionForm action={A.noteAction} resetOnSuccess className="space-y-2">
                <input type="hidden" name="id" value={fb.id} />
                <label className="sr-only" htmlFor="note-content">Ghi chú</label>
                <textarea id="note-content" name="content" rows={2} className="input" placeholder="Thêm ghi chú nội bộ..." required minLength={2} maxLength={3000} />
                <SubmitButton className="btn-outline btn-sm">Thêm ghi chú</SubmitButton>
              </ActionForm>
            </Card>
          )}

          {similar.length > 0 && (
            <Card title="Hồ sơ có nội dung tương tự (tham khảo)">
              <p className="mb-2 text-xs text-ink-muted">Gợi ý theo mức trùng từ ngữ, xử lý cục bộ. Hệ thống không tự gộp hay xóa hồ sơ.</p>
              <ul className="divide-y divide-cream-100 text-sm">
                {similar.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
                    <Link href={`/quan-tri/gop-y/${s.id}`} className="font-mono text-xs font-semibold text-brand-700">{s.code}</Link>
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    <StatusBadge status={s.status} />
                    <span className="text-xs text-ink-muted">{Math.round(s.score * 100)}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card title="Phân công, thời hạn">
            <dl className="space-y-2 text-sm">
              <Row k="Cán bộ phụ trách" v={fb.assignedUser ? `${fb.assignedUser.rank ?? ""} ${fb.assignedUser.fullName}`.trim() : "—"} />
              <Row k="Bộ phận phụ trách" v={fb.assignedUnit?.name ?? "—"} />
              <Row k="Hạn xử lý" v={<span className={overdue ? "font-bold text-brand-700" : ""}>{formatDate(fb.dueAt)}{overdue && " (quá hạn)"}</span>} />
              {fb.satisfaction && <Row k="Đánh giá của người gửi" v={`${SATISFACTION_LABELS[fb.satisfaction]}${fb.satisfactionComment ? ` – “${fb.satisfactionComment}”` : ""}`} />}
            </dl>
          </Card>

          {(fb.conclusion || fb.closeReason) && (
            <Card title="Kết luận xử lý">
              <dl className="space-y-2 text-sm">
                {fb.conclusion && <Row k="Kết luận" v={fb.conclusion} />}
                {fb.closeReason && <Row k="Lý do kết thúc/chuyển" v={fb.closeReason} />}
                {fb.resolvedAt && <Row k="Ngày giải quyết" v={formatDateTime(fb.resolvedAt)} />}
                {fb.closedAt && !fb.resolvedAt && <Row k="Ngày kết thúc" v={formatDateTime(fb.closedAt)} />}
                {fb.conclusionApprovedBy && <Row k="Người phê duyệt" v={`${fb.conclusionApprovedBy.rank ?? ""} ${fb.conclusionApprovedBy.fullName}`.trim()} />}
              </dl>
            </Card>
          )}

          <ActionPanels fb={fb} actor={actor} opts={opts} />

          {fb.hasSenderInfo && can(actor, "FEEDBACK_VIEW_SENDER") && (
            <Card title="Thông tin người gửi">
              <SenderReveal id={fb.id} action={A.senderInfoAction} />
            </Card>
          )}

          {can(actor, "FEEDBACK_RESTRICT") && (
            <Card title="Loại trừ quyền truy cập">
              {fb.restrictions.length > 0 && (
                <ul className="mb-3 space-y-1 text-sm">
                  {fb.restrictions.map((r) => (
                    <li key={r.id} className="rounded bg-cream px-2 py-1">
                      <b>{r.user.fullName}</b> ({r.user.username}) – {r.reason}
                    </li>
                  ))}
                </ul>
              )}
              <ActionForm action={A.restrictAction} className="space-y-2">
                <input type="hidden" name="id" value={fb.id} />
                <p className="text-xs text-ink-muted">Dùng khi hồ sơ phản ánh liên quan đến chính một cán bộ: người bị loại trừ sẽ không xem được hồ sơ, kể cả khi có quyền chung.</p>
                <label className="label text-xs" htmlFor="r-user">Tài khoản bị loại trừ</label>
                <select id="r-user" name="userId" className="input py-2 text-sm" required defaultValue="">
                  <option value="" disabled>— Chọn tài khoản —</option>
                  {opts.users.filter((u) => u.id !== actor.id).map((u) => <option key={u.id} value={u.id}>{u.rank} {u.fullName} ({u.username})</option>)}
                </select>
                <label className="label text-xs" htmlFor="r-reason">Lý do</label>
                <input id="r-reason" name="reason" className="input py-2 text-sm" required minLength={10} maxLength={1000} />
                <ConfirmSubmit className="btn-danger btn-sm" message="Tài khoản được chọn sẽ mất quyền xem hồ sơ này. Nếu đang được phân công, phân công sẽ bị thu hồi.">Loại trừ</ConfirmSubmit>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}

function ActionPanels({ fb, actor, opts }: { fb: Detail; actor: Actor; opts: Opts }) {
  const terminal = TERMINAL_STATUSES.includes(fb.status);
  const manual = MANUAL_TRANSITIONS[fb.status] ?? [];
  const pending = fb.responses.find((r) => r.status === "PENDING_APPROVAL");
  const canProcess = can(actor, "FEEDBACK_PROCESS");
  const panels: React.ReactNode[] = [];

  if (can(actor, "FEEDBACK_CLASSIFY") && !terminal && fb.status !== "PENDING_APPROVAL") {
    panels.push(
      <Card key="classify" title="Phân loại, kiểm tra hợp lệ">
        <ActionForm action={A.classifyAction} className="space-y-3">
          <input type="hidden" name="id" value={fb.id} />
          <div>
            <label className="label text-xs" htmlFor="c-cat">Lĩnh vực</label>
            <select id="c-cat" name="categoryId" className="input py-2 text-sm" defaultValue={fb.suggestedCategory?.id ?? fb.categoryId}>
              {opts.categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.id === fb.suggestedCategory?.id ? " (gợi ý)" : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs" htmlFor="c-type">Loại ý kiến</label>
            <select id="c-type" name="type" className="input py-2 text-sm" defaultValue={fb.type}>
              {FEEDBACK_TYPES.map((t) => <option key={t} value={t}>{FEEDBACK_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs" htmlFor="c-pri">Mức ưu tiên</label>
            <select id="c-pri" name="priority" className="input py-2 text-sm" defaultValue={fb.priority}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </select>
            <p className="mt-1 text-xs text-ink-muted">Đổi mức ưu tiên/lĩnh vực sẽ tính lại hạn xử lý. Mức ưu tiên không thay thế quy trình xử lý tình huống khẩn cấp.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="needsLeaderReview" defaultChecked={fb.needsLeaderReview} className="h-4 w-4 accent-brand-700" /> Cần lãnh đạo xem xét
          </label>
          <input name="note" className="input py-2 text-sm" placeholder="Ghi chú phân loại (tùy chọn)" maxLength={3000} />
          <SubmitButton className="btn-olive btn-sm w-full">Lưu phân loại</SubmitButton>
        </ActionForm>
      </Card>,
    );
  }

  if (can(actor, "FEEDBACK_ASSIGN") && !terminal && fb.status !== "PENDING_APPROVAL") {
    panels.push(
      <Card key="assign" title={fb.assignedUserId || fb.assignedUnitId ? "Phân công lại" : "Phân công xử lý"}>
        <ActionForm action={A.assignAction} className="space-y-3">
          <input type="hidden" name="id" value={fb.id} />
          <div>
            <label className="label text-xs" htmlFor="a-unit">Bộ phận xử lý</label>
            <select id="a-unit" name="unitId" className="input py-2 text-sm" defaultValue={fb.assignedUnit?.id ?? ""}>
              <option value="">— Không chọn —</option>
              {opts.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs" htmlFor="a-user">Cán bộ xử lý / đầu mối</label>
            <select id="a-user" name="userId" className="input py-2 text-sm" defaultValue={fb.assignedUser?.id ?? ""}>
              <option value="">— Không chọn —</option>
              {opts.handlers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.rank} {u.fullName}{u.unit ? ` – ${u.unit.name}` : ""}{u.isIndependentContact ? " (đầu mối độc lập)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs" htmlFor="a-due">Hạn xử lý</label>
            <input id="a-due" type="date" name="dueDate" className="input py-2 text-sm" defaultValue={fb.dueAt ? toVnIsoDate(fb.dueAt) : ""} />
          </div>
          <input name="note" className="input py-2 text-sm" placeholder="Nội dung chỉ đạo (tùy chọn)" maxLength={3000} />
          <SubmitButton className="btn-olive btn-sm w-full">Phân công</SubmitButton>
        </ActionForm>
      </Card>,
    );
  }

  const allowedManual = manual.filter((t) => (t === "CLASSIFYING" ? can(actor, "FEEDBACK_CLASSIFY") : canProcess || can(actor, "FEEDBACK_CLASSIFY")));
  if (allowedManual.length) {
    panels.push(
      <Card key="status" title="Cập nhật tiến độ">
        <ActionForm action={A.statusAction} className="space-y-3">
          <input type="hidden" name="id" value={fb.id} />
          <select name="to" className="input py-2 text-sm" aria-label="Trạng thái mới">
            {allowedManual.map((t) => <option key={t} value={t}>{STATUS_LABELS[t]}</option>)}
          </select>
          <textarea name="note" rows={2} className="input text-sm" placeholder="Nội dung cập nhật (nội bộ)" maxLength={3000} />
          <SubmitButton className="btn-olive btn-sm w-full">Cập nhật</SubmitButton>
        </ActionForm>
      </Card>,
    );
  }

  if ((canProcess || can(actor, "FEEDBACK_CLASSIFY")) && ["NEW", "CLASSIFYING", "ASSIGNED", "IN_PROGRESS"].includes(fb.status) && fb.allowSenderInteraction) {
    panels.push(
      <Card key="reqinfo" title="Yêu cầu người gửi bổ sung">
        <ActionForm action={A.requestInfoAction} className="space-y-3" resetOnSuccess>
          <input type="hidden" name="id" value={fb.id} />
          <p className="text-xs text-ink-muted">Nội dung hiển thị cho người gửi tại trang tra cứu; người gửi trả lời bằng mã tra cứu, không cần đăng nhập, không lộ danh tính.</p>
          <textarea name="content" rows={3} className="input text-sm" required minLength={10} maxLength={5000} placeholder="Đề nghị đồng chí cho biết thêm..." />
          <ConfirmSubmit className="btn-outline btn-sm w-full" message="Gửi yêu cầu bổ sung cho người gửi? Hồ sơ chuyển sang trạng thái “Chờ bổ sung thông tin”.">Gửi yêu cầu bổ sung</ConfirmSubmit>
        </ActionForm>
      </Card>,
    );
  }

  if (canProcess && ["ASSIGNED", "IN_PROGRESS"].includes(fb.status)) {
    panels.push(
      <Card key="respond" title="Kết quả xử lý, trả lời người gửi">
        <ActionForm action={A.submitResponseAction} className="space-y-3">
          <input type="hidden" name="id" value={fb.id} />
          <div>
            <label className="label text-xs" htmlFor="r-conc">Kết luận xử lý (nội bộ)</label>
            <textarea id="r-conc" name="conclusion" rows={3} className="input text-sm" required minLength={2} maxLength={3000} />
          </div>
          <div>
            <label className="label text-xs" htmlFor="r-content">Nội dung trả lời người gửi</label>
            <TemplateTextarea id="r-content" name="content" templates={opts.templates} required />
          </div>
          <ConfirmSubmit className="btn-primary btn-sm w-full" message="Trình kết quả xử lý và nội dung trả lời để lãnh đạo phê duyệt? (Nếu cấu hình không yêu cầu duyệt, nội dung được công bố ngay.)">Trình duyệt kết quả</ConfirmSubmit>
        </ActionForm>
      </Card>,
    );
  }

  if (can(actor, "FEEDBACK_APPROVE") && fb.status === "PENDING_APPROVAL" && pending) {
    panels.push(
      <Card key="review" title="Duyệt kết quả giải quyết" className="border-2 border-violet-200">
        <ActionForm action={A.reviewAction} className="space-y-3">
          <input type="hidden" name="id" value={fb.id} />
          <input type="hidden" name="responseId" value={pending.id} />
          {fb.conclusion && <p className="text-sm"><span className="text-ink-muted">Kết luận đề xuất:</span> {fb.conclusion}</p>}
          <label className="label text-xs" htmlFor="v-content">Nội dung trả lời (có thể chỉnh sửa trước khi duyệt)</label>
          <textarea id="v-content" name="content" rows={6} className="input text-sm" defaultValue={pending.content} maxLength={5000} />
          <label className="label text-xs" htmlFor="v-reason">Lý do trả lại (khi không duyệt)</label>
          <input id="v-reason" name="reason" className="input py-2 text-sm" maxLength={1000} />
          <div className="grid grid-cols-2 gap-2">
            <button name="decision" value="reject" className="btn-danger btn-sm">Trả lại</button>
            <button name="decision" value="approve" className="btn-primary btn-sm">Phê duyệt</button>
          </div>
        </ActionForm>
      </Card>,
    );
  }

  if (can(actor, "FEEDBACK_CLOSE") && !terminal) {
    panels.push(
      <Card key="close" title="Kết thúc không xử lý">
        <ActionForm action={A.closeAction} className="space-y-3">
          <input type="hidden" name="id" value={fb.id} />
          <textarea name="reason" rows={2} className="input text-sm" placeholder="Lý do (bắt buộc, tối thiểu 10 ký tự)" required minLength={10} maxLength={1000} />
          <input name="publicNote" className="input py-2 text-sm" placeholder="Thông báo cho người gửi (tùy chọn)" maxLength={3000} />
          <ConfirmSubmit className="btn-danger btn-sm w-full" message="Kết thúc hồ sơ mà không xử lý? Thao tác được ghi vào lịch sử và không thể hoàn tác (chỉ lãnh đạo có thể mở lại).">Kết thúc không xử lý</ConfirmSubmit>
        </ActionForm>
      </Card>,
    );
  }

  if (can(actor, "FEEDBACK_TRANSFER") && !terminal) {
    panels.push(
      <Card key="transfer" title="Chuyển đầu mối có thẩm quyền">
        <ActionForm action={A.transferAction} className="space-y-3">
          <input type="hidden" name="id" value={fb.id} />
          <input name="target" className="input py-2 text-sm" placeholder="Cơ quan/đầu mối tiếp nhận" required minLength={2} maxLength={3000} />
          <textarea name="reason" rows={2} className="input text-sm" placeholder="Lý do chuyển (tối thiểu 10 ký tự)" required minLength={10} maxLength={1000} />
          <p className="text-xs text-ink-muted">Để chuyển cho đầu mối độc lập trong hệ thống, dùng “Phân công” và chọn tài khoản được đánh dấu đầu mối độc lập.</p>
          <ConfirmSubmit className="btn-outline btn-sm w-full" message="Chuyển hồ sơ đến đầu mối có thẩm quyền ngoài hệ thống? Hồ sơ sẽ kết thúc trên hệ thống.">Chuyển</ConfirmSubmit>
        </ActionForm>
      </Card>,
    );
  }

  if (can(actor, "FEEDBACK_APPROVE") && (fb.status === "RESOLVED" || fb.status === "CLOSED_NO_ACTION")) {
    panels.push(
      <Card key="reopen" title="Mở lại hồ sơ">
        <ActionForm action={A.reopenAction} className="space-y-3">
          <input type="hidden" name="id" value={fb.id} />
          <textarea name="reason" rows={2} className="input text-sm" placeholder="Lý do mở lại" required minLength={10} maxLength={1000} />
          <ConfirmSubmit className="btn-outline btn-sm w-full" message="Mở lại hồ sơ để tiếp tục xử lý?">Mở lại</ConfirmSubmit>
        </ActionForm>
      </Card>,
    );
  }

  if (panels.length === 0) {
    return (
      <Alert kind="info">
        <span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Không có thao tác nào phù hợp với vai trò của đồng chí ở trạng thái hiện tại.</span>
      </Alert>
    );
  }
  return <>{panels}</>;
}
