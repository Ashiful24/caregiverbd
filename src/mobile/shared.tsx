/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Bell, CreditCard, Smartphone } from "lucide-react";
import clsx from "clsx";
import { client, type Role } from "./api";
import { EVENT_LABELS, fmtDateTime, taka, timeAgo } from "./format";
import { useAction, useApi } from "./hooks";
import { Button, Card, Empty, ErrorBox, Field, Input, Loading, Screen, Sheet, StarInput, Textarea, Timeline, useToast } from "./ui";

export function useUnreadCount(role: Role) {
  const { data } = useApi(() => client(role).get<{ meta: { unreadCount: number } }>("/notifications"), [role]);
  return data?.meta.unreadCount ?? 0;
}

export function NotificationsScreen({ role, back }: { role: Role; back?: boolean }) {
  const api = client(role);
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi(() => api.get<{ data: any[]; meta: { unreadCount: number } }>("/notifications"), [role]);
  const base = role === "PATIENT" ? "/app/patient" : "/app/provider";

  const open = async (n: any) => {
    if (!n.readAt) await api.patch(`/notifications/${n.id}/read`).catch(() => {});
    if (n.data?.serviceRequestId) navigate(`${base}/${role === "PATIENT" ? "requests" : "jobs"}/${n.data.serviceRequestId}`);
    else if (n.data?.longTermOpportunityId) navigate(role === "PATIENT" ? `${base}/long-term/${n.data.longTermOpportunityId}` : `${base}/shifts`);
  };

  return (
    <Screen
      title="Notifications"
      back={back}

      right={
        data?.meta.unreadCount ? (
          <Button variant="ghost" size="sm" onClick={() => api.post("/notifications/mark-all-read")}>
            Mark all read
          </Button>
        ) : null
      }
    >
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !data?.data.length ? (
        <Empty icon={<Bell size={40} />} title="No notifications yet" text="Updates about your requests will show up here." />
      ) : (
        <div className="grid gap-2">
          {data.data.map((n) => (
            <Card key={n.id} onClick={() => open(n)} className={clsx(!n.readAt && "border-brand-300 bg-brand-25 dark:border-brand-800 dark:bg-gray-900")}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{n.title}</p>
                <span className="shrink-0 text-[11px] text-gray-400">{timeAgo(n.createdAt)}</span>
              </div>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{n.body}</p>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  );
}

export function ChangePasswordSheet({ role, open, onClose }: { role: Role; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { busy, run } = useAction();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const r = await run(() => client(role).put("/users/profile/password", { currentPassword: cur, newPassword: next }), (m) => toast(m, "err"));
    if (r) {
      toast("Password updated");
      setCur("");
      setNext("");
      onClose();
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Change password">
      <form onSubmit={submit}>
        <Field label="Current password">
          <Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} required autoComplete="current-password" />
        </Field>
        <Field label="New password" hint="At least 8 characters">
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required autoComplete="new-password" />
        </Field>
        <Button type="submit" busy={busy} className="w-full">
          Update password
        </Button>
      </form>
    </Sheet>
  );
}

/** Rate the other party after a completed service. */
export function ReviewBox({ role, serviceRequestId, otherName, review }: { role: Role; serviceRequestId: number; otherName: string; review: any }) {
  const toast = useToast();
  const { busy, run } = useAction();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  if (review) {
    return (
      <Card>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Your review</p>
        <p className="mt-1 text-amber-500">{"★".repeat(review.rating)}<span className="text-gray-300">{"★".repeat(5 - review.rating)}</span></p>
        {review.comment && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{review.comment}</p>}
      </Card>
    );
  }
  const submit = async () => {
    const r = await run(() => client(role).post(`/reviews/service-request/${serviceRequestId}`, { rating, comment }), (m) => toast(m, "err"));
    if (r) toast("Thanks for the review");
  };
  return (
    <Card>
      <p className="text-sm font-semibold text-gray-900 dark:text-white">Rate {otherName}</p>
      <div className="my-2">
        <StarInput value={rating} onChange={setRating} />
      </div>
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Anything to share? (optional)" maxLength={1000} />
      <Button className="mt-3 w-full" disabled={!rating} busy={busy} onClick={submit}>
        Submit review
      </Button>
    </Card>
  );
}

export function EventsTimeline({ events }: { events: any[] }) {
  if (!events?.length) return null;
  return (
    <Timeline
      steps={events.map((e) => ({
        label: EVENT_LABELS[e.step] ?? e.step,
        at: fmtDateTime(e.at) + (e.actorName ? ` · ${e.actorName}` : ""),
        note: e.note,
        done: true,
        danger: ["REQUEST_REJECTED", "REQUEST_CANCELLED", "REQUEST_EXPIRED", "CANCELLED"].includes(e.step),
      }))}
    />
  );
}

/** Stand-in for the SSLCommerz hosted page. */
export function GatewaySheet({ open, amount, attemptId, onClose, onDone }: { open: boolean; amount: string | number; attemptId: number | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { busy, run } = useAction();
  const [method, setMethod] = useState<"bkash" | "nagad" | "card">("bkash");
  const finish = async (result: "success" | "fail" | "cancel") => {
    if (!attemptId) return;
    const r = await run(() => client("PATIENT").post<{ status: string; message: string }>(`/payments/demo/${attemptId}/${result}`), (m) => toast(m, "err"));
    if (!r) return;
    toast(r.message, r.status === "COMPLETED" ? "ok" : "err");
    if (r.status === "COMPLETED") onDone();
    onClose();
  };
  return (
    <Sheet open={open} onClose={() => finish("cancel")} title="SSLCommerz (demo)">
      <div className="mb-4 rounded-2xl bg-gray-900 p-4 text-white">
        <p className="text-xs uppercase tracking-wide text-gray-400">Pay to Caregiver BD</p>
        <p className="mt-1 text-2xl font-semibold">{taka(amount)}</p>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {(
          [
            ["bkash", "bKash", <Smartphone key="b" size={18} />],
            ["nagad", "Nagad", <Smartphone key="n" size={18} />],
            ["card", "Card", <CreditCard key="c" size={18} />],
          ] as const
        ).map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMethod(key)}
            className={clsx(
              "flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-semibold",
              method === key ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
      <p className="mb-3 text-xs text-gray-500">This is a simulated gateway. Choose what the bank returns.</p>
      <Button className="w-full" busy={busy} onClick={() => finish("success")}>
        Pay {taka(amount)}
      </Button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => finish("fail")}>
          Simulate failure
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => finish("cancel")}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}

/** Tiny bar chart (inline SVG) for 7–30 points. */
export function MiniBars({ values, labels, height = 80, color = "var(--color-brand-500)" }: { values: number[]; labels?: string[]; height?: number; color?: string }) {
  const max = Math.max(1, ...values);
  const w = 100 / Math.max(1, values.length);
  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label="Chart">
        {values.map((v, i) => {
          const h = (v / max) * (height - 4);
          return <rect key={i} x={i * w + w * 0.18} y={height - h} width={w * 0.64} height={Math.max(h, v > 0 ? 2 : 0)} rx={1.2} fill={color} />;
        })}
      </svg>
      {labels && (
        <div className="mt-1 flex text-[10px] text-gray-400">
          {labels.map((l, i) => (
            <span key={i} className="flex-1 text-center">
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
