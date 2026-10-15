/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { CheckCircle2, KeyRound, Circle, ExternalLink, MapPin, Navigation, Phone, Radar } from "lucide-react";
import { providerApi } from "../api";
import { CANCEL_REASONS, fmtDate, fmtTime, taka } from "../format";
import { useAction, useApi } from "../hooks";
import { Avatar, Button, Card, Empty, ErrorBox, Field, Input, KV, Loading, Notice, Screen, Section, Segmented, Select, Sheet, Stars, StatusBadge, Textarea, useToast } from "../ui";
import { EventsTimeline, ReviewBox } from "../shared";

type Tab = "new" | "upcoming" | "active" | "nearby" | "history";

const GROUPS: Record<Exclude<Tab, "nearby">, string[]> = {
  new: ["PENDING"],
  upcoming: ["ACCEPTED", "ON_THE_WAY"],
  active: ["IN_PROGRESS", "PAYMENT_PENDING"],
  history: ["COMPLETED", "REJECTED", "CANCELLED", "EXPIRED"],
};


export function Jobs() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("new");
  const mine = useApi(() => providerApi.get<{ data: any[] }>("/service-requests/provider/my-requests"), []);
  const nearby = useApi(() => providerApi.get<any[]>("/service-requests/nearby", { radiusKm: 15 }).catch(() => []), []);
  const count = (t: Exclude<Tab, "nearby">) => (mine.data?.data ?? []).filter((j) => GROUPS[t].includes(j.status)).length;
  const rows = tab === "nearby" ? nearby.data ?? [] : (mine.data?.data ?? []).filter((j) => GROUPS[tab].includes(j.status));

  return (
    <Screen title="Jobs">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "new", label: `New ${count("new") || ""}` },
          { value: "upcoming", label: "Upcoming" },
          { value: "active", label: "Active" },
          { value: "nearby", label: `Nearby ${nearby.data?.length || ""}` },
          { value: "history", label: "Past" },
        ]}
      />
      {mine.loading && !mine.data ? (
        <Loading />
      ) : mine.error ? (
        <ErrorBox message={mine.error} onRetry={mine.reload} />
      ) : !rows.length ? (
        <Empty
          icon={<Radar size={40} />}
          title={tab === "nearby" ? "No open requests nearby" : "Nothing here"}
          text={tab === "new" ? "Direct bookings from patients appear here. Keep your schedule open and stay online." : tab === "nearby" ? "Patients can also send open requests to every provider of your service around them." : undefined}
        />
      ) : (
        <div className="grid gap-2">
          {rows.map((j) => (
            <Card key={j.id} onClick={() => navigate(`/app/provider/jobs/${j.id}`)}>
              <div className="flex items-center gap-3">
                <Avatar name={j.patientName} size={40} tone="blue" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{j.patientName}</p>
                    <StatusBadge status={j.status} label={j.status === "PENDING" ? (j.providerId ? "New" : "Open") : undefined} />
                  </div>
                  <p className="text-xs text-gray-500">
                    {fmtDate(j.scheduledDate)} · {fmtTime(j.scheduledTime)}
                    {j.distance != null ? ` · ${j.distance} km` : ""}
                  </p>
                  <p className="truncate text-xs text-gray-500">{j.address}</p>
                </div>
                {Number(j.fee) > 0 && <p className="text-sm font-semibold text-gray-900 dark:text-white">{taka(j.fee)}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  );
}

export function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { busy, run } = useAction();
  const { data: j, error, loading, reload } = useApi(() => providerApi.get(`/service-requests/${id}`), [id]);
  const [sheet, setSheet] = useState<null | "reject" | "cancel">(null);
  const [reason, setReason] = useState("");
  const [reasonCategory, setReasonCategory] = useState("PERSONAL_EMERGENCY");
  const [otp, setOtp] = useState("");

  if (loading && !j) return <Screen title="Job" back><Loading /></Screen>;
  if (error || !j) return <Screen title="Job" back><ErrorBox message={error ?? "Not found"} onRetry={reload} /></Screen>;

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    const ok = await run(fn, (m) => toast(m, "err"));
    if (ok) {
      toast(msg);
      setSheet(null);
    }
    return ok;
  };
  const accept = async () => {
    const ok = await run(() => providerApi.patch(`/service-requests/${id}/accept`), (m) => {
      toast(m, "err");
      if (m.includes("top up")) navigate("/app/provider/wallet");
    });
    if (ok) toast("Accepted. The slot is now booked.");
  };
  const toggleItem = (itemId: number) => {
    const done = j.checklist.filter((c: any) => c.done).map((c: any) => c.id);
    const next = done.includes(itemId) ? done.filter((x: number) => x !== itemId) : [...done, itemId];
    run(() => providerApi.put(`/service-requests/${id}/checklist`, { doneIds: next }), (m) => toast(m, "err"));
  };

  const pt = j.patient;
  const isOpen = j.status === "PENDING" && !j.providerId;

  return (
    <Screen
      title={pt?.name ?? j.patientName}
      subtitle={`#${j.id} · ${j.consultationTypeName}`}
      back="/app/provider/jobs"
      footer={
        j.status === "PENDING" ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setSheet("reject")}>
              {isOpen ? "Not for me" : "Reject"}
            </Button>
            <Button busy={busy} onClick={accept}>
              Accept
            </Button>
          </div>
        ) : j.status === "ACCEPTED" ? (
          <Button className="w-full" busy={busy} onClick={() => act(() => providerApi.post(`/service-requests/${id}/on-the-way`), "Patient notified that you are on the way")}>
            <Navigation size={16} /> Start trip
          </Button>
        ) : j.status === "ON_THE_WAY" && !j.hasStartOtp ? (
          <Button className="w-full" busy={busy} onClick={() => act(() => providerApi.post(`/service-requests/${id}/request-start-otp`), "OTP sent to the patient")}>
            <KeyRound size={16} /> I have arrived · send OTP
          </Button>
        ) : j.status === "IN_PROGRESS" ? (
          <Button className="w-full" busy={busy} onClick={() => act(() => providerApi.post(`/service-requests/${id}/request-completion`), "Patient asked to confirm & pay")}>
            <CheckCircle2 size={16} /> Mark service complete
          </Button>
        ) : undefined
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <StatusBadge status={j.status} />
        <p className="text-lg font-semibold text-gray-900 dark:text-white">{Number(j.fee) > 0 ? taka(j.fee) : "Your fee applies"}</p>
      </div>

      {j.status === "ON_THE_WAY" && j.hasStartOtp && (
        <Card className="mb-4 border-violet-300 dark:border-violet-900">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Enter the start OTP</p>
          <p className="mt-1 text-xs text-gray-500">Ask the patient for the 6-digit code shown in their app.</p>
          <div className="mt-3 flex gap-2">
            <Input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" maxLength={6} placeholder="••••••" className="text-center font-mono text-lg tracking-[0.3em]" />
            <Button busy={busy} disabled={otp.length !== 6} onClick={() => act(() => providerApi.post(`/service-requests/${id}/verify-start-otp`, { otp }), "Service started")}>
              Start
            </Button>
          </div>
        </Card>
      )}
      {j.status === "PAYMENT_PENDING" && <Notice tone="amber">Waiting for the patient to confirm and pay (cash or online).</Notice>}
      {j.status === "COMPLETED" && (
        <Notice tone="brand">
          Completed · paid {j.paymentMethod === "CASH" ? "in cash (collect from patient)" : "online (added to claimable balance)"}
        </Notice>
      )}
      {j.cancelRequested && <Notice tone="amber">You asked admin to cancel this service. Waiting for review.</Notice>}

      <Section title="Patient" className="mt-4">
        <Card>
          <div className="flex items-center gap-3">
            <Avatar name={pt?.name} tone="blue" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 dark:text-white">{pt?.name}</p>
              <Stars value={pt?.averageRating} count={pt?.totalReviews} />
            </div>
            {["ACCEPTED", "ON_THE_WAY", "IN_PROGRESS"].includes(j.status) && (
              <a href={`tel:${pt?.phone}`} aria-label="Call patient" className="rounded-full bg-brand-50 p-2.5 text-brand-600 dark:bg-brand-950">
                <Phone size={18} />
              </a>
            )}
          </div>
          {j.beneficiaryType === "DEPENDENT" && <p className="mt-2 text-xs text-gray-500">Care for: {j.beneficiaryDependentName}</p>}
        </Card>
      </Section>

      <Section title="Visit">
        <Card>
          <KV label="When">
            {fmtDate(j.scheduledDate)} · {fmtTime(j.scheduledTime)}
            {j.endTime ? `–${fmtTime(j.endTime)}` : ""}
          </KV>
          <KV label="Address">
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} /> {j.address}
            </span>
          </KV>
          {j.description && <KV label="Notes">{j.description}</KV>}
          {j.destinationMapUrl && (
            <a href={j.destinationMapUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
              Directions in Google Maps <ExternalLink size={12} />
            </a>
          )}
        </Card>
      </Section>

      {j.status === "IN_PROGRESS" && j.checklist?.length > 0 && (
        <Section title="Service checklist">
          <Card className="py-2">
            {j.checklist.map((c: any) => (
              <button key={c.id} type="button" onClick={() => toggleItem(c.id)} className="flex w-full items-center gap-3 py-2 text-left text-sm text-gray-800 dark:text-gray-100">
                {c.done ? <CheckCircle2 size={20} className="text-brand-500" /> : <Circle size={20} className="text-gray-300" />}
                {c.label}
              </button>
            ))}
          </Card>
        </Section>
      )}

      {j.status === "COMPLETED" && <ReviewBox role="PROVIDER" serviceRequestId={j.id} otherName={pt?.name ?? "the patient"} review={j.myReview} />}

      <Section title="Timeline" className="mt-4">
        <Card>
          <EventsTimeline events={j.events} />
          {!j.events?.length && <p className="text-sm text-gray-400">No activity recorded.</p>}
        </Card>
      </Section>

      {["ACCEPTED", "ON_THE_WAY"].includes(j.status) && !j.cancelRequested && (
        <Button variant="danger" className="w-full" onClick={() => setSheet("cancel")}>
          I can't attend
        </Button>
      )}

      <Sheet open={sheet === "reject"} onClose={() => setSheet(null)} title={isOpen ? "Skip this request?" : "Reject this request?"}>
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
          {isOpen ? "It will be hidden for you; other providers can still take it." : "The patient will be notified."} This patient won't be able to book you again.
        </p>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
        <Button variant="danger" className="mt-3 w-full" busy={busy} onClick={() => act(() => providerApi.patch(`/service-requests/${id}/reject`, { reason }), "Request rejected")}>
          Reject
        </Button>
      </Sheet>


      <Sheet open={sheet === "cancel"} onClose={() => setSheet(null)} title="Can't attend this service">
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">Admin reviews your request and cancels or reassigns the service.</p>
        <Field label="Reason">
          <Select value={reasonCategory} onChange={(e) => setReasonCategory(e.target.value)}>
            {CANCEL_REASONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Details for admin" />
        <Button
          variant="danger"
          className="mt-3 w-full"
          busy={busy}
          onClick={() => act(() => providerApi.post(`/service-requests/${id}/provider-cancel`, { reasonCategory, reasonNote: reason }), "Sent to admin for review")}
        >
          Send to admin
        </Button>
      </Sheet>
    </Screen>
  );
}
