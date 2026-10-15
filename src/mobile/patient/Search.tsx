/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { BadgeCheck, CheckCircle2, Heart } from "lucide-react";
import clsx from "clsx";
import { patientApi } from "../api";
import { fmtDate, fmtTime, taka, today } from "../format";
import { useAction, useApi } from "../hooks";
import { Avatar, Badge, Button, Card, Chip, ErrorBox, Field, Input, KV, Loading, Notice, Screen, Section, Select, Sheet, Stars, Textarea, useToast } from "../ui";

const FEE_UNIT: Record<string, string> = { CONSULTATION: "/visit", HOURLY: "/hour", SHIFT_8H: "/8h shift", SHIFT_12H: "/12h shift" };

function useTypes() {
  return useApi(() => patientApi.get<any[]>("/consultation-types"), []);
}


export function ProviderDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { busy, run } = useAction();
  const me = useApi(() => patientApi.get("/patients/me"), []);
  const p = useApi(() => patientApi.post(`/providers/${id}/search`, {}), [id]);
  const [slot, setSlot] = useState<any>(null);
  const [confirming, setConfirming] = useState(false);
  const [form, setForm] = useState({ beneficiaryType: "SELF", beneficiaryDependentName: "", address: "", description: "" });
  const [day, setDay] = useState(params.get("date") ?? "");

  const slotsByDay = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const s of p.data?.availableSlots ?? []) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return m;
  }, [p.data]);
  const activeDay = day && slotsByDay.has(day) ? day : [...slotsByDay.keys()][0];

  const toggleLike = async () => {
    if (!p.data) return;
    await run(() => (p.data.isLiked ? patientApi.del(`/patients/me/liked-providers/${id}`) : patientApi.post(`/patients/me/liked-providers/${id}`)), (m) => toast(m, "err"));
  };

  const book = async (e: FormEvent) => {
    e.preventDefault();
    const sr = await run(
      () =>
        patientApi.post("/service-requests", {
          consultationTypeId: p.data.consultationTypeId,
          providerId: Number(id),
          scheduleSlotId: slot.id,
          address: form.address || me.data?.address,
          description: form.description,
          beneficiaryType: form.beneficiaryType,
          beneficiaryDependentName: form.beneficiaryType === "DEPENDENT" ? form.beneficiaryDependentName : null,
        }),
      (m) => toast(m, "err")
    );
    if (sr) {
      toast("Request sent. The provider will confirm shortly.");
      navigate(`/app/patient/requests/${sr.id}`, { replace: true });
    }
  };

  if (p.loading && !p.data) return <Screen title="Provider" back><Loading /></Screen>;
  if (p.error || !p.data) return <Screen title="Provider" back><ErrorBox message={p.error ?? "Not found"} /></Screen>;
  const d = p.data;

  return (
    <Screen
      title={d.providerName}
      back
      footer={
        <Button className="w-full" disabled={!slot} onClick={() => setConfirming(true)}>
          {slot ? `Continue · ${fmtDate(slot.date)} ${fmtTime(slot.startTime)}` : "Select a time slot"}
        </Button>
      }
      right={
        <button type="button" aria-label={d.isLiked ? "Remove from favourites" : "Add to favourites"} onClick={toggleLike} className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800">
          <Heart size={20} className={d.isLiked ? "fill-red-500 text-red-500" : "text-gray-500"} />
        </button>
      }
    >
      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <Avatar name={d.providerName} size={56} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 font-semibold text-gray-900 dark:text-white">
              {d.providerName} <BadgeCheck size={16} className="text-brand-500" />
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{d.consultationTypeName}{d.levelName ? ` · ${d.levelName}` : ""}</p>
            <div className="mt-1 flex items-center gap-3">
              <Stars value={d.averageRating} count={d.totalReviews} />
              <span className="text-xs text-gray-500">{d.experience} yrs exp</span>
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 divide-x divide-gray-100 rounded-xl bg-gray-50 py-2 text-center dark:divide-gray-800 dark:bg-gray-800/50">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{taka(d.currentFee)}</p>
            <p className="text-[11px] text-gray-500">{FEE_UNIT[d.feeType]?.slice(1) ?? "fee"}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{d.distance} km</p>
            <p className="text-[11px] text-gray-500">away</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{d.isOnline ? "Online" : "Offline"}</p>
            <p className="text-[11px] text-gray-500">now</p>
          </div>
        </div>
      </Card>

      <Section title="Pick a time">
        {slotsByDay.size === 0 ? (
          <Notice tone="gray">No free slots this week. Try another provider.</Notice>
        ) : (
          <>
            <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
              {[...slotsByDay.keys()].map((d2) => (
                <Chip key={d2} active={activeDay === d2} onClick={() => setDay(d2)}>
                  {fmtDate(d2, { weekday: "short", day: "numeric", month: "short" })}
                </Chip>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(slotsByDay.get(activeDay!) ?? []).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSlot(s)}
                  className={clsx(
                    "rounded-xl border px-3 py-2.5 text-left",
                    slot?.id === s.id ? "border-brand-500 bg-brand-50 dark:bg-brand-950" : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
                  )}
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                  </p>
                  <p className="text-xs text-gray-500">{taka(s.fee)}</p>
                </button>
              ))}
            </div>
          </>
        )}
      </Section>

      {d.offeredServices?.length > 0 && (
        <Section title="Services included">
          <Card>
            <ul className="grid gap-1.5">
              {d.offeredServices.map((s: any) => (
                <li key={s.id} className={clsx("flex items-center gap-2 text-sm", s.offered ? "text-gray-700 dark:text-gray-200" : "text-gray-400 line-through")}>
                  <CheckCircle2 size={15} className={s.offered ? "text-brand-500" : "text-gray-300"} /> {s.label}
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      )}

      {(d.reviews?.length > 0 || d.feedbacks?.length > 0) && (
        <Section title="What patients say">
          <div className="grid gap-2">
            {d.reviews.map((r: any) => (
              <Card key={`r${r.id}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{r.reviewerName}</p>
                  <Stars value={r.rating} />
                </div>
                {r.comment && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{r.comment}</p>}
              </Card>
            ))}
            {d.feedbacks.map((f: any) => (
              <Card key={`f${f.id}`}>
                <p className="text-sm text-gray-600 dark:text-gray-300">“{f.feedback}”</p>
                <p className="mt-1 text-xs text-gray-400">{f.patientName}</p>
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Sheet open={confirming && Boolean(slot)} onClose={() => setConfirming(false)} title="Confirm booking">
        {slot && (
          <form onSubmit={book}>
            <div className="mb-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
              <KV label="Provider">{d.providerName}</KV>
              <KV label="When">
                {fmtDate(slot.date)}, {fmtTime(slot.startTime)} – {fmtTime(slot.endTime)}
              </KV>
              <KV label="Fee (locked)">{taka(slot.fee)}</KV>
              <KV label="Pay">After service · cash or online</KV>
            </div>
            <Field label="Who is this for?">
              <Select value={form.beneficiaryType} onChange={(e) => setForm({ ...form, beneficiaryType: e.target.value })}>
                <option value="SELF">Myself</option>
                <option value="DEPENDENT">A family member</option>
              </Select>
            </Field>
            {form.beneficiaryType === "DEPENDENT" && (
              <Field label="Family member's name">
                <Input value={form.beneficiaryDependentName} onChange={(e) => setForm({ ...form, beneficiaryDependentName: e.target.value })} required />
              </Field>
            )}
            <Field label="Visit address">
              <Input value={form.address} placeholder={me.data?.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Symptoms / notes (optional)">
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Badge tone="blue">The slot is held for you once the provider accepts</Badge>
            <Button type="submit" busy={busy} className="mt-4 w-full">
              Send request
            </Button>
          </form>
        )}
      </Sheet>
    </Screen>
  );
}

/** Request without picking a provider: any nearby provider of that type can accept it. */
export function OpenRequest() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const { busy, run } = useAction();
  const types = useTypes();
  const me = useApi(() => patientApi.get("/patients/me"), []);
  const leaves = (types.data ?? []).flatMap((r) => (r.children.length ? r.children : [r]));
  const [form, setForm] = useState({ consultationTypeId: params.get("type") ?? "", date: today(), time: "", address: "", description: "" });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const scheduledAt = form.time ? new Date(`${form.date}T${form.time}:00`).toISOString() : null;
    const sr = await run(
      () => patientApi.post("/service-requests", { consultationTypeId: Number(form.consultationTypeId), scheduledAt, address: form.address || me.data?.address, description: form.description }),
      (m) => toast(m, "err")
    );
    if (sr) {
      toast("Request sent to nearby providers");
      navigate(`/app/patient/requests/${sr.id}`, { replace: true });
    }
  };

  return (
    <Screen title="Open request" back>
      <Notice tone="blue">Every nearby provider of this service sees your request. The first one to accept takes it, and their fee is locked then.</Notice>
      <form onSubmit={submit} className="mt-4">
        <Field label="Service">
          <Select value={form.consultationTypeId} onChange={(e) => setForm({ ...form, consultationTypeId: e.target.value })} required>
            <option value="">Select</option>
            {leaves.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" min={today()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </Field>
          <Field label="Time (optional)">
            <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </Field>
        </div>
        <Field label="Address">
          <Input value={form.address} placeholder={me.data?.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <Field label="What do you need?">
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Button type="submit" busy={busy} className="w-full">
          Send to nearby providers
        </Button>
      </form>
    </Screen>
  );
}
