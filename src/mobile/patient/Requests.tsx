/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Banknote, CalendarClock, ClipboardList, CreditCard, ExternalLink, KeyRound, MapPin, Phone } from "lucide-react";
import { patientApi } from "../api";
import { fmtDate, fmtTime, taka } from "../format";
import { useAction, useApi } from "../hooks";
import { Avatar, Button, Card, Empty, ErrorBox, KV, Loading, Notice, Screen, Section, Segmented, Sheet, Stars, StatusBadge, Textarea, useToast } from "../ui";
import { EventsTimeline, GatewaySheet, ReviewBox } from "../shared";

export function Requests() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"visits" | "long">(() => (sessionStorage.getItem("cgbd_req_tab") as "visits" | "long") ?? "visits");
  const visits = useApi(() => patientApi.get<{ data: any[] }>("/service-requests/patient/my-requests"), []);
  const lto = useApi(() => patientApi.get<any[]>("/long-term-opportunities/patient/my"), []);
  const change = (t: "visits" | "long") => {
    setTab(t);
    try {
      sessionStorage.setItem("cgbd_req_tab", t);
    } catch {
      /* ignore */
    }
  };

  return (
    <Screen title="My bookings">
      <Segmented
        value={tab}
        onChange={change}
        options={[
          { value: "visits", label: `Home visits (${visits.data?.data.length ?? 0})` },
          { value: "long", label: `Long-term (${lto.data?.length ?? 0})` },
        ]}
      />
      {tab === "visits" ? (
        visits.loading && !visits.data ? (
          <Loading />
        ) : visits.error ? (
          <ErrorBox message={visits.error} onRetry={visits.reload} />
        ) : !visits.data?.data.length ? (
          <Empty icon={<ClipboardList size={40} />} title="No home visits yet" action={<Button onClick={() => navigate("/app/patient/search")}>Book a visit</Button>} />
        ) : (
          <div className="grid gap-2">
            {visits.data.data.map((r) => (
              <Card key={r.id} onClick={() => navigate(`/app/patient/requests/${r.id}`)}>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{r.providerName ?? "Open request · any provider"}</p>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  #{r.id} · {r.consultationTypeName} · {fmtDate(r.scheduledDate)} {fmtTime(r.scheduledTime)}
                </p>
                {Number(r.fee) > 0 && <p className="mt-1 text-xs font-medium text-gray-700 dark:text-gray-300">{taka(r.fee)}</p>}
              </Card>
            ))}
          </div>
        )
      ) : lto.loading && !lto.data ? (
        <Loading />
      ) : !lto.data?.length ? (
        <Empty icon={<CalendarClock size={40} />} title="No long-term care yet" text="Request daily nurse or caregiver shifts for a family member." action={<Button onClick={() => navigate("/app/patient/long-term/new")}>Request long-term care</Button>} />
      ) : (
        <div className="grid gap-2">
          {lto.data.map((l) => (
            <Card key={l.id} onClick={() => navigate(`/app/patient/long-term/${l.id}`)}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{l.consultationTypeName}</p>
                <StatusBadge status={l.status} />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {l.requestNo} · {fmtDate(l.startDate)} – {fmtDate(l.endDate)}
              </p>
              <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
                {l.shiftDurationHours}h shifts from {l.preferredStartTime} · {taka(l.payableAmount)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  );
}

export function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { busy, run } = useAction();
  const { data: r, error, loading, reload } = useApi(() => patientApi.get(`/service-requests/${id}`), [id]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [gateway, setGateway] = useState<{ id: number; amount: string } | null>(null);
  const [feedback, setFeedback] = useState("");

  if (loading && !r) return <Screen title="Booking" back><Loading /></Screen>;
  if (error || !r) return <Screen title="Booking" back><ErrorBox message={error ?? "Not found"} onRetry={reload} /></Screen>;

  const cancel = async () => {
    const ok = await run(() => patientApi.post(`/service-requests/${id}/cancel`, { reason }), (m) => toast(m, "err"));
    if (ok) {
      toast("Booking cancelled");
      setCancelOpen(false);
    }
  };
  const pay = async (method: "CASH" | "ONLINE") => {
    const res = await run(() => patientApi.post(`/service-requests/${id}/confirm-completion`, { paymentMethod: method }), (m) => toast(m, "err"));
    if (!res) return;
    if (method === "ONLINE") setGateway({ id: res.paymentAttemptId, amount: res.amount });
    else toast("Service confirmed. Please pay the provider in cash.");
  };
  const regenOtp = () => run(() => patientApi.post(`/service-requests/${id}/regenerate-start-otp`), (m) => toast(m, "err"));
  const sendFeedback = async () => {
    const ok = await run(() => patientApi.post("/feedback", { serviceRequestId: Number(id), feedback }), (m) => toast(m, "err"));
    if (ok) toast("Feedback sent");
  };

  const p = r.provider;
  return (
    <Screen title={`Booking #${r.id}`} subtitle={r.consultationTypeName} back="/app/patient/requests">
      <div className="mb-4 flex items-center justify-between">
        <StatusBadge status={r.status} />
        <span className="text-xs text-gray-400">{r.beneficiaryType === "DEPENDENT" ? `For ${r.beneficiaryDependentName}` : "For you"}</span>
      </div>

      {r.status === "PENDING" && (
        <Notice tone="amber">{p ? `Waiting for ${p.providerName} to accept. Requests expire if not answered within an hour.` : "Sent to nearby providers. The first to accept will be assigned."}</Notice>
      )}
      {r.status === "ACCEPTED" && <Notice tone="blue">Confirmed. Your provider will mark “on the way” when they leave.</Notice>}
      {r.status === "ON_THE_WAY" &&
        (r.startOtp ? (
          <Card className="border-violet-300 bg-violet-50 dark:border-violet-900 dark:bg-violet-950">
            <p className="flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-200">
              <KeyRound size={16} /> Your provider has arrived
            </p>
            <p className="mt-1 text-xs text-violet-700 dark:text-violet-300">Share this code so they can start the service.</p>
            <p className="my-3 text-center font-mono text-4xl font-bold tracking-[0.3em] text-violet-900 dark:text-white">{r.startOtp}</p>
            <Button variant="secondary" size="sm" busy={busy} onClick={regenOtp} className="w-full">
              Generate a new code
            </Button>
          </Card>
        ) : (
          <Notice tone="violet">{p?.providerName} is on the way to you.</Notice>
        ))}
      {r.status === "IN_PROGRESS" && <Notice tone="violet">Service in progress since {fmtTime(new Date(r.startedAt).toTimeString().slice(0, 5))}.</Notice>}
      {r.status === "PAYMENT_PENDING" && (
        <Card className="border-amber-300 dark:border-amber-900">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Service finished. Confirm and pay {taka(r.fee)}</p>
          <p className="mt-1 text-xs text-gray-500">Choose how you are paying.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" busy={busy} onClick={() => pay("CASH")}>
              <Banknote size={16} /> Cash
            </Button>
            <Button busy={busy} onClick={() => pay("ONLINE")}>
              <CreditCard size={16} /> Pay online
            </Button>
          </div>
        </Card>
      )}
      {["REJECTED", "EXPIRED", "CANCELLED"].includes(r.status) && (
        <Notice tone="gray">
          {r.status === "REJECTED" ? `${r.rejectedByProviderName ?? "The provider"} could not take this request${r.rejectionReason ? `: ${r.rejectionReason}` : "."}` : r.status === "EXPIRED" ? "The provider did not respond in time." : "This booking was cancelled."}
          <button type="button" className="ml-1 font-semibold underline" onClick={() => navigate(`/app/patient/search?type=${r.consultationTypeId}`)}>
            Book again
          </button>
        </Notice>
      )}

      <Section title="Provider" className="mt-4">
        {p ? (
          <Card onClick={() => navigate(`/app/patient/providers/${p.id}`)}>
            <div className="flex items-center gap-3">
              <Avatar name={p.providerName} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 dark:text-white">{p.providerName}</p>
                <p className="text-xs text-gray-500">{p.consultationTypeName}</p>
                <Stars value={p.averageRating} count={p.totalReviews} />
              </div>
              {["ACCEPTED", "ON_THE_WAY", "IN_PROGRESS"].includes(r.status) && (
                <a href={`tel:${p.phone ?? ""}`} onClick={(e) => e.stopPropagation()} aria-label="Call provider" className="rounded-full bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-950">
                  <Phone size={18} />
                </a>
              )}
            </div>
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-gray-500">Not assigned yet</p>
          </Card>
        )}
      </Section>

      <Section title="Details">
        <Card>
          <KV label="When">
            {fmtDate(r.scheduledDate)} · {fmtTime(r.scheduledTime)}
            {r.endTime ? ` – ${fmtTime(r.endTime)}` : ""}
          </KV>
          <KV label="Fee">{Number(r.fee) > 0 ? taka(r.fee) : "Set when a provider accepts"}</KV>
          {r.paymentMethod && <KV label="Paid by">{r.paymentMethod === "CASH" ? "Cash" : "Online"}</KV>}
          <KV label="Address">
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} /> {r.address}
            </span>
          </KV>
          {r.description && <KV label="Notes">{r.description}</KV>}
          {r.destinationMapUrl && (
            <a href={r.destinationMapUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
              Open in Google Maps <ExternalLink size={12} />
            </a>
          )}
        </Card>
      </Section>

      {r.checklist?.length > 0 && ["IN_PROGRESS", "PAYMENT_PENDING", "COMPLETED"].includes(r.status) && (
        <Section title="Care checklist">
          <Card>
            {r.checklist.map((c: any) => (
              <p key={c.id} className={`py-1 text-sm ${c.done ? "text-gray-800 dark:text-gray-100" : "text-gray-400"}`}>
                {c.done ? "✓" : "○"} {c.label}
              </p>
            ))}
          </Card>
        </Section>
      )}

      {r.status === "COMPLETED" && p && (
        <Section title="Review">
          <div className="grid gap-2">
            <ReviewBox role="PATIENT" serviceRequestId={r.id} otherName={p.providerName} review={r.myReview} />
            {!r.feedbackGiven && (
              <Card>
                <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Private feedback for Caregiver BD</p>
                <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="How was the provider's punctuality, behaviour, care…" />
                <Button variant="secondary" className="mt-2 w-full" disabled={!feedback.trim()} busy={busy} onClick={sendFeedback}>
                  Send feedback
                </Button>
              </Card>
            )}
          </div>
        </Section>
      )}

      <Section title="Timeline">
        <Card>
          <EventsTimeline events={r.events} />
          {!r.events?.length && <p className="text-sm text-gray-400">Booked before the app timeline existed.</p>}
        </Card>
      </Section>

      {["PENDING", "ACCEPTED", "ON_THE_WAY"].includes(r.status) && (
        <Button variant="danger" className="w-full" onClick={() => setCancelOpen(true)}>
          Cancel booking
        </Button>
      )}

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this booking?">
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">You have not paid yet, so there is no charge.</p>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
        <Button variant="danger" className="mt-3 w-full" busy={busy} onClick={cancel}>
          Yes, cancel
        </Button>
      </Sheet>
      <GatewaySheet open={Boolean(gateway)} amount={gateway?.amount ?? 0} attemptId={gateway?.id ?? null} onClose={() => setGateway(null)} onDone={reload} />
    </Screen>
  );
}
