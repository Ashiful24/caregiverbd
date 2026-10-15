/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { CalendarRange, CheckCircle2, Circle, KeyRound, MapPin } from "lucide-react";
import { providerApi } from "../api";
import { CANCEL_REASONS, fmtDate, fmtTime, taka, today } from "../format";
import { useAction, useApi } from "../hooks";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, KV, Loading, Notice, Screen, Section, Segmented, Select, Sheet, StatusBadge, Textarea, useToast } from "../ui";

type Tab = "upcoming" | "proposed" | "done";

function shiftLabel(s: any): { label: string; tone: "brand" | "blue" | "violet" | "gray" | "amber" } {
  if (s.status === "IN_PROGRESS") return { label: "On duty", tone: "violet" };
  if (s.status === "COMPLETED") return { label: "Done", tone: "brand" };
  if (s.status === "CANCELLED") return { label: "Cancelled", tone: "gray" };
  if (!s.confirmed) return { label: "Awaiting payment", tone: "amber" };
  if (s.date === today()) return { label: "Today", tone: "blue" };
  return { label: "Confirmed", tone: "blue" };
}

export function Shifts() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("upcoming");
  const { data, error, loading, reload } = useApi(() => providerApi.get<any[]>("/providers/me/long-term-shifts"), []);
  const rows = (data ?? []).filter((s) =>
    tab === "proposed" ? !s.confirmed && !["CANCELLED", "COMPLETED"].includes(s.opportunityStatus) : tab === "done" ? ["COMPLETED", "CANCELLED"].includes(s.status) : s.confirmed && ["ACCEPTED", "IN_PROGRESS"].includes(s.status)
  );
  const byDate = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const s of tab === "done" ? [...rows].reverse() : rows) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return m;
  }, [rows, tab]);

  return (
    <Screen title="Long-term shifts">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "upcoming", label: "Confirmed" },
          { value: "proposed", label: "Proposed" },
          { value: "done", label: "Past" },
        ]}
      />
      {tab === "proposed" && rows.length > 0 && (
        <div className="mb-3">
          <Notice tone="blue">Admin assigned you to these shifts. They become confirmed once the patient pays.</Notice>
        </div>
      )}
      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : !rows.length ? (
        <Empty icon={<CalendarRange size={40} />} title="No shifts here" text="When admin assigns you to a long-term booking, the shifts show up here." />
      ) : (
        [...byDate.entries()].map(([date, shifts]) => (
          <Section key={date} title={date === today() ? `Today · ${fmtDate(date)}` : fmtDate(date, { weekday: "long", day: "numeric", month: "short" })}>
            <div className="grid gap-2">
              {shifts.map((s) => {
                const l = shiftLabel(s);
                return (
                  <Card key={s.slotId} onClick={() => navigate(`/app/provider/shifts/${s.slotId}`)}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.patientName}</p>
                      <Badge tone={l.tone}>{l.label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {fmtTime(s.startTime)} – {fmtTime(s.endTime)} · {s.consultationTypeName}
                    </p>
                    <p className="truncate text-xs text-gray-500">{s.address}</p>
                  </Card>
                );
              })}
            </div>
          </Section>
        ))
      )}
    </Screen>
  );
}

export function ShiftDetail() {
  const { slotId } = useParams();
  const toast = useToast();
  const { busy, run } = useAction();
  const shifts = useApi(() => providerApi.get<any[]>("/providers/me/long-term-shifts"), []);
  const s = shifts.data?.find((x) => String(x.slotId) === slotId);
  const services = useApi(() => (s ? providerApi.get<any[]>(`/consultation-types/${s.consultationTypeId}/services`) : Promise.resolve([])), [s?.consultationTypeId]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reasonCategory, setReasonCategory] = useState("PERSONAL_EMERGENCY");
  const [note, setNote] = useState("");
  const [otp, setOtp] = useState("");

  if (shifts.loading && !shifts.data) return <Screen title="Shift" back><Loading /></Screen>;
  if (!s) return <Screen title="Shift" back="/app/provider/shifts"><ErrorBox message="Shift not found or no longer assigned to you." /></Screen>;

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    const ok = await run(fn, (m) => toast(m, "err"));
    if (ok) toast(msg);
    return ok;
  };
  const done: number[] = s.checklistDone ?? [];
  const toggle = (id: number) =>
    run(() => providerApi.put(`/long-term-shifts/${s.slotId}/checklist`, { doneIds: done.includes(id) ? done.filter((x) => x !== id) : [...done, id] }), (m) => toast(m, "err"));
  const l = shiftLabel(s);

  return (
    <Screen
      title={s.patientName}
      subtitle={`${s.requestNo} · ${fmtDate(s.date)}`}
      back="/app/provider/shifts"
      footer={
        s.confirmed && s.status === "ACCEPTED" && !s.hasStartOtp ? (
          <Button className="w-full" busy={busy} disabled={s.date > today()} onClick={() => act(() => providerApi.post(`/long-term-shifts/${s.slotId}/request-start-otp`), "OTP sent to the patient")}>
            <KeyRound size={16} /> {s.date > today() ? `Check-in opens on ${fmtDate(s.date)}` : "I have arrived · send OTP"}
          </Button>
        ) : s.status === "IN_PROGRESS" ? (
          <Button className="w-full" busy={busy} onClick={() => act(() => providerApi.post(`/long-term-shifts/${s.slotId}/complete`), "Shift completed")}>
            <CheckCircle2 size={16} /> Complete shift
          </Button>
        ) : undefined
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <Badge tone={l.tone}>{l.label}</Badge>
        <StatusBadge status={s.opportunityStatus} />
      </div>
      {s.status === "ACCEPTED" && s.hasStartOtp && (
        <Card className="mb-4 border-violet-300 dark:border-violet-900">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Enter the start OTP</p>
          <p className="mt-1 text-xs text-gray-500">Ask the patient or family for the 6-digit code shown in their app.</p>
          <div className="mt-3 flex gap-2">
            <Input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" maxLength={6} placeholder="••••••" className="text-center font-mono text-lg tracking-[0.3em]" />
            <Button
              busy={busy}
              disabled={otp.length !== 6}
              onClick={async () => {
                if (await act(() => providerApi.post(`/long-term-shifts/${s.slotId}/verify-start-otp`, { otp }), "Shift started")) setOtp("");
              }}
            >
              Start
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="mt-2 w-full" busy={busy} onClick={() => act(() => providerApi.post(`/long-term-shifts/${s.slotId}/request-start-otp`), "New OTP sent")}>
            Send a new OTP
          </Button>
        </Card>
      )}
      {!s.confirmed && <Notice tone="amber">The patient has not paid yet. You can check in once this booking is paid.</Notice>}
      {s.cancelRequested && <Notice tone="amber">You asked admin to cancel this shift. Waiting for review.</Notice>}

      <Section title="Shift" className="mt-4">
        <Card>
          <KV label="Date">{fmtDate(s.date, { weekday: "long", day: "numeric", month: "long" })}</KV>
          <KV label="Time">
            {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
          </KV>
          <KV label="Service">{s.consultationTypeName}</KV>
          <KV label="Shift fee">{taka(s.fee)}</KV>
          <KV label="Address">
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} /> {s.address}
            </span>
          </KV>
          {s.notes && <p className="mt-2 whitespace-pre-line rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">{s.notes}</p>}
        </Card>
      </Section>

      {s.status === "IN_PROGRESS" && (services.data ?? []).length > 0 && (
        <Section title="Care checklist">
          <Card className="py-2">
            {(services.data ?? []).map((c) => (
              <button key={c.id} type="button" onClick={() => toggle(c.id)} className="flex w-full items-center gap-3 py-2 text-left text-sm text-gray-800 dark:text-gray-100">
                {done.includes(c.id) ? <CheckCircle2 size={20} className="text-brand-500" /> : <Circle size={20} className="text-gray-300" />}
                {c.label}
              </button>
            ))}
          </Card>
        </Section>
      )}

      {s.status === "ACCEPTED" && !s.cancelRequested && (
        <Button variant="danger" className="w-full" onClick={() => setCancelOpen(true)}>
          I can't attend this shift
        </Button>
      )}

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Can't attend this shift">
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">Admin reviews the request and arranges a replacement.</p>
        <Field label="Reason">
          <Select value={reasonCategory} onChange={(e) => setReasonCategory(e.target.value)}>
            {CANCEL_REASONS.map(([v, lbl]) => (
              <option key={v} value={v}>
                {lbl}
              </option>
            ))}
          </Select>
        </Field>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Details for admin" />
        <Button
          variant="danger"
          className="mt-3 w-full"
          busy={busy}
          onClick={async () => {
            if (await act(() => providerApi.post(`/long-term-shifts/${s.slotId}/cancel-request`, { reasonCategory, reasonNote: note }), "Sent to admin")) setCancelOpen(false);
          }}
        >
          Send to admin
        </Button>
      </Sheet>
    </Screen>
  );
}
