/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router";
import { CalendarCheck, Info, KeyRound } from "lucide-react";
import clsx from "clsx";
import { patientApi } from "../api";
import { addDays, fmtDate, fmtTime, taka, today } from "../format";
import { useAction, useApi } from "../hooks";
import { Avatar, Button, Card, ErrorBox, Field, Input, KV, Loading, Notice, Screen, Section, Select, Sheet, StatusBadge, Textarea, Timeline, useToast } from "../ui";
import { EventsTimeline, GatewaySheet } from "../shared";

const PER_SHIFT: Record<number, number> = { 8: 1900, 12: 2600, 24: 4200 };

function daysBetween(a: string, b: string) {
  if (!a || !b || b < a) return 0;
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 864e5) + 1;
}

export function NewLongTerm() {
  const navigate = useNavigate();
  const toast = useToast();
  const { busy, run } = useAction();
  const me = useApi(() => patientApi.get("/patients/me"), []);
  const types = useApi(() => patientApi.get<any[]>("/consultation-types"), []);
  const careTypes = (types.data ?? []).filter((r) => ["NURSING_CARE", "CAREGIVER"].includes(r.code));
  const [form, setForm] = useState({
    consultationTypeId: "",
    startDate: today(),
    endDate: addDays(today(), 6),
    shiftDurationHours: "12",
    startHour: "8",
    serviceAddressText: "",
    beneficiaryName: "",
    notes: "",
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const days = daysBetween(form.startDate, form.endDate);
  const estimate = days * PER_SHIFT[Number(form.shiftDurationHours)];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const lto = await run(
      () =>
        patientApi.post("/long-term-opportunities", {
          ...form,
          consultationTypeId: Number(form.consultationTypeId),
          shiftDurationHours: Number(form.shiftDurationHours),
          startHour: Number(form.startHour),
          serviceAddressText: form.serviceAddressText || me.data?.address,
        }),
      (m) => toast(m, "err")
    );
    if (lto) {
      toast("Request sent. Our team will propose a schedule.");
      navigate(`/app/patient/long-term/${lto.id}`, { replace: true });
    }
  };

  return (
    <Screen title="Long-term care" back="/app/patient">
      <Notice tone="blue">
        Tell us what you need. Caregiver BD matches trained nurses or caregivers and sends you a day-by-day schedule to approve before you pay.
      </Notice>
      <form onSubmit={submit} className="mt-4">
        <Field label="Type of care">
          <Select value={form.consultationTypeId} onChange={set("consultationTypeId")} required>
            <option value="">Select</option>
            {careTypes.map((root) => (
              <optgroup key={root.id} label={root.name}>
                {root.children.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <Input type="date" min={today()} value={form.startDate} onChange={set("startDate")} required />
          </Field>
          <Field label="End date">
            <Input type="date" min={form.startDate} value={form.endDate} onChange={set("endDate")} required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Shift length">
            <Select value={form.shiftDurationHours} onChange={set("shiftDurationHours")}>
              <option value="8">8 hours</option>
              <option value="12">12 hours</option>
              <option value="24">24 hours</option>
            </Select>
          </Field>
          <Field label="Shift starts at">
            <Select value={form.startHour} onChange={set("startHour")}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {fmtTime(`${h}:00`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Patient name (if not you)">
          <Input value={form.beneficiaryName} onChange={set("beneficiaryName")} placeholder="e.g. my mother" />
        </Field>
        <Field label="Service address">
          <Input value={form.serviceAddressText} onChange={set("serviceAddressText")} placeholder={me.data?.address} />
        </Field>
        <Field label="Patient condition & needs">
          <Textarea value={form.notes} onChange={set("notes")} placeholder="e.g. Bedridden after stroke, needs turning every 2 hours, insulin twice daily" />
        </Field>
        <Card className="mb-4 bg-gray-50 dark:bg-gray-800/40">
          <KV label="Days">{days || "—"}</KV>
          <KV label="Per shift">{taka(PER_SHIFT[Number(form.shiftDurationHours)])}</KV>
          <KV label="Estimated total">{days ? taka(estimate) : "—"}</KV>
          <p className="mt-1 text-xs text-gray-400">Final amount is based on the shifts in the approved schedule. You pay only after approving it.</p>
        </Card>
        <Button type="submit" busy={busy} className="w-full" disabled={!days}>
          Send request
        </Button>
      </form>
    </Screen>
  );
}

const STEPS = [
  ["REQUESTED", "Request received"],
  ["SCHEDULE_PROPOSED", "Schedule proposed"],
  ["PAYMENT_PENDING", "Schedule accepted"],
  ["PAID", "Paid & confirmed"],
  ["IN_PROGRESS", "Care in progress"],
  ["COMPLETED", "Completed"],
] as const;

export function LongTermDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { busy, run } = useAction();
  const { data: l, error, loading, reload } = useApi(() => patientApi.get(`/long-term-opportunities/${id}`), [id]);
  const [changeOpen, setChangeOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [note, setNote] = useState("");
  const [gateway, setGateway] = useState<{ id: number; amount: string } | null>(null);

  const byNurse = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const s of l?.shifts ?? []) m.set(s.providerName, [...(m.get(s.providerName) ?? []), s]);
    return m;
  }, [l]);

  if (loading && !l) return <Screen title="Long-term care" back><Loading /></Screen>;
  if (error || !l) return <Screen title="Long-term care" back><ErrorBox message={error ?? "Not found"} onRetry={reload} /></Screen>;

  const reached = l.status === "CHANGE_REQUESTED" ? 1 : STEPS.findIndex(([s]) => s === l.status);
  const act = async (path: string, body?: unknown, msg?: string) => {
    const ok = await run(() => patientApi.post(`/long-term-opportunities/${id}/${path}`, body), (m) => toast(m, "err"));
    if (ok && msg) toast(msg);
    return ok;
  };
  const pay = async () => {
    const res = await act("pay");
    if (res) setGateway({ id: res.paymentAttemptId, amount: res.amount });
  };
  const completedShifts = (l.shifts ?? []).filter((s: any) => s.status === "COMPLETED").length;

  return (
    <Screen title={l.consultationTypeName} subtitle={l.requestNo} back="/app/patient/requests">
      <div className="mb-3 flex items-center justify-between">
        <StatusBadge status={l.status} />
        <span className="text-xs text-gray-400">
          {fmtDate(l.startDate)} – {fmtDate(l.endDate)}
        </span>
      </div>

      {l.status === "REQUESTED" && <Notice tone="amber">Our care team is matching nurses for your dates. You will be notified when the schedule is ready.</Notice>}
      {l.status === "CHANGE_REQUESTED" && <Notice tone="amber">We received your change request and are revising the schedule: “{l.changeRequestNote}”</Notice>}
      {l.status === "SCHEDULE_PROPOSED" && (
        <Card className="border-blue-300 dark:border-blue-900">
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <CalendarCheck size={16} className="text-blue-600" /> Your schedule is ready
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {l.shifts.length} shifts with {byNurse.size} {byNurse.size === 1 ? "carer" : "carers"} · total {taka(l.payableAmount)}. Review below, then accept to pay.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setChangeOpen(true)}>
              Request changes
            </Button>
            <Button busy={busy} onClick={() => act("accept-schedule", undefined, "Schedule accepted")}>
              Accept
            </Button>
          </div>
        </Card>
      )}
      {l.status === "PAYMENT_PENDING" && (
        <Card className="border-amber-300 dark:border-amber-900">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Pay {taka(l.payableAmount)} to confirm your carers</p>
          <p className="mt-1 text-xs text-gray-500">Paid online through SSLCommerz. Shifts are confirmed once payment succeeds.</p>
          <Button className="mt-3 w-full" busy={busy} onClick={pay}>
            Pay now
          </Button>
          <Button variant="ghost" className="mt-1 w-full" onClick={() => setChangeOpen(true)}>
            Something is wrong? Request changes
          </Button>
        </Card>
      )}
      {(l.shifts ?? [])
        .filter((s: any) => s.startOtp && s.status === "ACCEPTED")
        .map((s: any) => (
          <Card key={`otp${s.slotId}`} className="mb-3 border-violet-300 bg-violet-50 dark:border-violet-900 dark:bg-violet-950">
            <p className="flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-200">
              <KeyRound size={16} /> {s.providerName} has arrived
            </p>
            <p className="mt-1 text-xs text-violet-700 dark:text-violet-300">
              Share this code to start the {fmtDate(s.date)} {fmtTime(s.startTime)} shift.
            </p>
            <p className="my-3 text-center font-mono text-4xl font-bold tracking-[0.3em] text-violet-900 dark:text-white">{s.startOtp}</p>
            <Button
              variant="secondary"
              size="sm"
              busy={busy}
              className="w-full"
              onClick={() => run(() => patientApi.post(`/long-term-opportunities/${id}/shifts/${s.slotId}/regenerate-start-otp`), (m) => toast(m, "err"))}
            >
              Generate a new code
            </Button>
          </Card>
        ))}
      {["PAID", "IN_PROGRESS"].includes(l.status) && (
        <Notice tone="brand">
          {completedShifts} of {l.shifts.length} shifts completed. When your carer arrives, a start code appears here to share with them.
        </Notice>
      )}

      <Section title="Progress" className="mt-4">
        <Card>
          <Timeline
            steps={STEPS.map(([s, label], i) => ({
              label: s === "SCHEDULE_PROPOSED" && l.status === "CHANGE_REQUESTED" ? "Schedule being revised" : label,
              done: ["CANCELLED", "EXPIRED", "REJECTED"].includes(l.status) ? false : i <= reached,
            }))}
          />
        </Card>
      </Section>

      <Section title="Request">
        <Card>
          <KV label="Shift">
            {l.shiftDurationHours}h from {l.preferredStartTime}
          </KV>
          <KV label="Per shift">{taka(l.perShiftFee)}</KV>
          <KV label={l.shifts.length ? "Total" : "Estimate"}>{taka(l.payableAmount)}</KV>
          {l.beneficiaryName && <KV label="Patient">{l.beneficiaryName}</KV>}
          <KV label="Address">{l.serviceAddressText}</KV>
          {l.supervisorName && <KV label="Supervisor">{l.supervisorName}</KV>}
          {l.notes && <p className="mt-2 whitespace-pre-line rounded-lg bg-gray-50 p-2 text-xs text-gray-600 dark:bg-gray-800/50 dark:text-gray-300">{l.notes}</p>}
        </Card>
      </Section>

      {l.shifts.length > 0 && (
        <Section title={`Schedule (${l.shifts.length} shifts)`}>
          <div className="grid gap-2">
            {[...byNurse.entries()].map(([name, shifts]) => (
              <Card key={name}>
                <div className="mb-2 flex items-center gap-2">
                  <Avatar name={name} size={32} />
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{name}</p>
                  <span className="ml-auto text-xs text-gray-400">{shifts.length} shifts</span>
                </div>
                <div className="grid gap-1">
                  {shifts.map((s: any) => (
                    <div key={s.slotId} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-300">
                        {fmtDate(s.date)} · {fmtTime(s.startTime)}–{fmtTime(s.endTime)}
                      </span>
                      <span className={clsx("font-medium", s.status === "COMPLETED" ? "text-brand-600" : s.status === "IN_PROGRESS" ? "text-violet-600" : s.status === "CANCELLED" ? "text-gray-400" : "text-gray-500")}>
                        {s.status === "ACCEPTED" ? "Scheduled" : s.status === "IN_PROGRESS" ? "On duty" : s.status.charAt(0) + s.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {l.events?.length > 0 && (
        <Section title="Activity">
          <Card>
            <EventsTimeline events={l.events} />
          </Card>
        </Section>
      )}

      {["REQUESTED", "SCHEDULE_PROPOSED", "CHANGE_REQUESTED", "PAYMENT_PENDING", "PAID"].includes(l.status) && (
        <Button variant="danger" className="w-full" onClick={() => setCancelOpen(true)}>
          Cancel request
        </Button>
      )}

      <Sheet open={changeOpen} onClose={() => setChangeOpen(false)} title="Request schedule changes">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please assign a female nurse for night shifts, start one day later" />
        <Button
          className="mt-3 w-full"
          disabled={!note.trim()}
          busy={busy}
          onClick={async () => {
            if (await act("request-change", { note }, "Change request sent")) {
              setNote("");
              setChangeOpen(false);
            }
          }}
        >
          Send to care team
        </Button>
      </Sheet>
      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel long-term care?">
        <p className="mb-3 flex gap-2 text-sm text-gray-600 dark:text-gray-300">
          <Info size={16} className="mt-0.5 shrink-0" />
          {l.status === "PAID" ? "You already paid. A 10% cancellation fee applies and the rest is refunded to your payment method." : "Nothing has been charged yet."}
        </p>
        <Button
          variant="danger"
          className="w-full"
          busy={busy}
          onClick={async () => {
            if (await act("cancel", {}, "Request cancelled")) setCancelOpen(false);
          }}
        >
          Yes, cancel
        </Button>
      </Sheet>
      <GatewaySheet open={Boolean(gateway)} amount={gateway?.amount ?? 0} attemptId={gateway?.id ?? null} onClose={() => setGateway(null)} onDone={reload} />
    </Screen>
  );
}
