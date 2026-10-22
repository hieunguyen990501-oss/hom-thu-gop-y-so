"use client";
// Tra cứu kết quả bằng mã hồ sơ + mã bí mật. Mã chỉ giữ trong bộ nhớ trang (không đưa vào URL, không lưu trình duyệt).
import { useState, useTransition } from "react";
import { Loader2, MessageSquarePlus, Search, Star } from "lucide-react";
import { lookupAction, satisfactionAction, senderMessageAction } from "@/app/(public)/actions";
import type { PublicFeedbackView } from "@/server/services/public-feedback";
import { Alert, Badge, cx } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { LIMITS } from "@/lib/constants";

export function LookupPanel() {
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState("");
  const [view, setView] = useState<PublicFeedbackView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await lookupAction({ code, secret });
      if (res.ok) setView(res.data);
      else {
        setView(null);
        setError(res.error);
      }
    });
  };

  return (
    <div className="space-y-5">
      <form onSubmit={submit} className="card grid gap-4 p-4" autoComplete="off">
        <div>
          <label className="label" htmlFor="code">Mã hồ sơ</label>
          <input id="code" className="input font-mono uppercase" placeholder="GY-2026-000001" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={30} />
        </div>
        <div>
          <label className="label" htmlFor="secret">Mã bí mật tra cứu</label>
          <input id="secret" className="input font-mono uppercase tracking-widest" placeholder="XXXX-XXXX-XXXX" value={secret} onChange={(e) => setSecret(e.target.value)} required maxLength={20} type="password" />
          <p className="mt-1 text-xs text-ink-muted">Mã bí mật được cấp khi gửi ý kiến. Hệ thống không thể khôi phục mã bí mật của hồ sơ ẩn danh.</p>
        </div>
        {error && <Alert kind="error">{error}</Alert>}
        <button className="btn-primary" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
          {pending ? "Đang tra cứu..." : "TRA CỨU"}
        </button>
      </form>
      {view && <FeedbackView view={view} code={code} secret={secret} onUpdate={setView} />}
    </div>
  );
}

function FeedbackView({ view, code, secret, onUpdate }: { view: PublicFeedbackView; code: string; secret: string; onUpdate: (v: PublicFeedbackView) => void }) {
  const done = ["RESOLVED", "CLOSED_NO_ACTION", "TRANSFERRED"].includes(view.statusKey);
  return (
    <div className="space-y-4" aria-live="polite">
      <section className="card overflow-hidden">
        <div className={cx("px-4 py-3 text-white", done ? "bg-olive-600" : view.needsInfo ? "bg-bronze-500" : "bg-brand-700")}>
          <p className="text-xs uppercase tracking-wide opacity-80">Trạng thái hiện tại</p>
          <p className="text-lg font-bold">{view.publicStatus}</p>
        </div>
        <dl className="grid gap-x-4 gap-y-2 p-4 text-sm sm:grid-cols-2">
          <div><dt className="text-ink-muted">Mã hồ sơ</dt><dd className="font-mono font-semibold">{view.code} {view.isDemo && <Badge className="ml-1 border-amber-300 bg-amber-100 text-amber-900">DEMO</Badge>}</dd></div>
          <div><dt className="text-ink-muted">Ngày gửi</dt><dd className="font-semibold">{formatDateTime(view.createdAt)}</dd></div>
          <div><dt className="text-ink-muted">Loại ý kiến</dt><dd className="font-semibold">{view.typeLabel}</dd></div>
          <div><dt className="text-ink-muted">Lĩnh vực</dt><dd className="font-semibold">{view.categoryName}</dd></div>
          <div><dt className="text-ink-muted">Hình thức</dt><dd className="font-semibold">{view.isAnonymous ? "Ẩn danh" : "Có thông tin người gửi"}</dd></div>
          <div><dt className="text-ink-muted">Cập nhật mới nhất</dt><dd className="font-semibold">{formatDateTime(view.updatedAt)}</dd></div>
        </dl>
        <details className="border-t border-cream-200 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-semibold text-brand-700">Xem lại nội dung đã gửi</summary>
          <p className="mt-2 font-semibold">{view.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-ink-soft">{view.content}</p>
          {view.proposal && <p className="mt-2 whitespace-pre-wrap text-ink-soft"><b>Đề xuất:</b> {view.proposal}</p>}
        </details>
      </section>

      {view.responses.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 font-bold">Phản hồi của đơn vị</h2>
          <ul className="space-y-3">
            {view.responses.map((r, i) => (
              <li key={i} className={cx("rounded-md border p-3 text-sm", r.kind === "REQUEST_INFO" ? "border-bronze-300 bg-bronze-50" : "border-olive-200 bg-olive-50")}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {r.kind === "REQUEST_INFO" ? "Đề nghị bổ sung thông tin" : "Trả lời, kết quả giải quyết"} · {formatDateTime(r.at)}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">{r.content}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-4">
        <h2 className="mb-3 font-bold">Quá trình xử lý</h2>
        <ol className="relative ml-2 border-l-2 border-cream-200">
          {view.timeline.map((t, i) => (
            <li key={i} className="mb-4 ml-4 last:mb-0">
              <span className={cx("absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full border-2 border-white", t.bySender ? "bg-bronze-400" : "bg-brand-600")} aria-hidden />
              <p className="text-xs text-ink-muted">{formatDateTime(t.at)}</p>
              <p className="whitespace-pre-wrap text-sm">{t.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {view.canAddInfo && <AddInfo code={code} secret={secret} highlight={view.needsInfo} onUpdate={onUpdate} />}
      {view.canRate && <Rate code={code} secret={secret} onUpdate={onUpdate} />}
      {view.satisfactionLabel && <Alert kind="success">Đồng chí đã đánh giá: <b>{view.satisfactionLabel}</b>. Cảm ơn đồng chí.</Alert>}
    </div>
  );
}

function AddInfo({ code, secret, highlight, onUpdate }: { code: string; secret: string; highlight: boolean; onUpdate: (v: PublicFeedbackView) => void }) {
  const [content, setContent] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className={cx("card p-4", highlight && "border-2 border-bronze-400")}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await senderMessageAction({ code, secret, content });
          if (res.ok) {
            setContent("");
            setMsg({ ok: true, text: "Đã gửi thông tin bổ sung." });
            onUpdate(res.data);
          } else setMsg({ ok: false, text: res.error });
        });
      }}
    >
      <h2 className="mb-1 flex items-center gap-2 font-bold"><MessageSquarePlus className="h-5 w-5" aria-hidden /> Gửi thông tin bổ sung</h2>
      <p className="mb-3 text-sm text-ink-muted">{highlight ? "Đơn vị đề nghị đồng chí bổ sung thông tin theo yêu cầu ở trên." : "Đồng chí có thể bổ sung thông tin cho ý kiến đã gửi."}</p>
      <label className="sr-only" htmlFor="extra">Nội dung bổ sung</label>
      <textarea id="extra" className="input" rows={4} value={content} onChange={(e) => setContent(e.target.value)} minLength={LIMITS.message.min} maxLength={LIMITS.message.max} required />
      {msg && <div className="mt-3"><Alert kind={msg.ok ? "success" : "error"}>{msg.text}</Alert></div>}
      <button className="btn-olive mt-3" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Gửi bổ sung</button>
    </form>
  );
}

function Rate({ code, secret, onUpdate }: { code: string; secret: string; onUpdate: (v: PublicFeedbackView) => void }) {
  const [choice, setChoice] = useState<string>("");
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const opts = [
    { v: "SATISFIED", label: "Hài lòng" },
    { v: "NEUTRAL", label: "Bình thường" },
    { v: "UNSATISFIED", label: "Chưa hài lòng" },
  ];
  return (
    <form
      className="card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await satisfactionAction({ code, secret, satisfaction: choice, comment });
          if (res.ok) onUpdate(res.data);
          else setErr(res.error);
        });
      }}
    >
      <h2 className="mb-1 flex items-center gap-2 font-bold"><Star className="h-5 w-5" aria-hidden /> Đánh giá mức độ hài lòng</h2>
      <p className="mb-3 text-sm text-ink-muted">Không bắt buộc, không cần cung cấp danh tính.</p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Mức độ hài lòng">
        {opts.map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={choice === o.v} onClick={() => setChoice(o.v)} className={cx("min-h-[48px] rounded-md border-2 px-2 text-sm font-semibold", choice === o.v ? "border-olive-600 bg-olive-50" : "border-cream-200 bg-white")}>
            {o.label}
          </button>
        ))}
      </div>
      <label className="label mt-3" htmlFor="cmt">Ý kiến thêm (tùy chọn)</label>
      <textarea id="cmt" className="input" rows={2} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
      {err && <div className="mt-3"><Alert kind="error">{err}</Alert></div>}
      <button className="btn-olive mt-3" disabled={pending || !choice}>{pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Gửi đánh giá</button>
    </form>
  );
}
