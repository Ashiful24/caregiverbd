/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { CalendarDays, ChevronRight, FileCheck2, KeyRound, ListChecks, LogOut, MapPin, MessageSquareQuote, Settings2, TrendingUp } from "lucide-react";
import { getSession, providerApi, setSession } from "../api";
import { fmtDate, taka } from "../format";
import { useAction, useApi } from "../hooks";
import { Avatar, Button, Card, Empty, Field, Input, KV, Loading, Notice, Screen, Section, Select, Stars, StatusBadge, useToast } from "../ui";
import { ChangePasswordSheet } from "../shared";

export function ProviderProfile() {
  const navigate = useNavigate();
  const me = useApi(() => providerApi.get("/providers/me"), []);
  const [pwOpen, setPwOpen] = useState(false);
  const caregiver = getSession("PROVIDER")?.providerCategory === "CAREGIVER";
  const logout = () => {
    setSession("PROVIDER", null);
    navigate("/app/provider/login", { replace: true });
  };
  if (!me.data) return <Screen title="Profile"><Loading /></Screen>;
  const d = me.data;
  const link = (icon: React.ReactNode, label: string, to: string, extra?: React.ReactNode) => (
    <button type="button" onClick={() => navigate(to)} className="flex w-full items-center gap-3 py-3 text-left text-sm text-gray-800 dark:text-gray-100">
      {icon}
      <span className="flex-1">{label}</span>
      {extra}
      <ChevronRight size={16} className="text-gray-400" />
    </button>
  );
  return (
    <Screen title="Profile">
      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <Avatar name={d.providerName} size={56} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 dark:text-white">{d.providerName}</p>
            <p className="text-xs text-gray-500">
              {d.consultationTypeName} · {d.phone}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={d.status} />
              <Stars value={d.averageRating} count={d.totalReviews} />
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
          <KV label="Employment">{d.employmentType === "SALARIED" ? "Salaried (rate set by admin)" : "Independent"}</KV>
          <KV label="Level">{d.levelName ?? "Not assigned"}</KV>
          {d.supervisorName && <KV label="Supervisor">{d.supervisorName}</KV>}
          <KV label="Fee">{taka(d.currentFee)}</KV>
        </div>
      </Card>
      <Section title="Work">
        <Card className="divide-y divide-gray-100 py-0 dark:divide-gray-800">
          {link(<FileCheck2 size={18} className="text-brand-600" />, "Documents & certifications", "/app/provider/verification", d.status === "PENDING" ? <StatusBadge status="PENDING" /> : null)}
          {caregiver && link(<CalendarDays size={18} className="text-brand-600" />, "Short-visit schedule", "/app/provider/schedule")}
          {link(<ListChecks size={18} className="text-brand-600" />, "Services I offer", "/app/provider/services")}
          {link(<Settings2 size={18} className="text-brand-600" />, "Fee, radius & location", "/app/provider/settings")}
          {link(<TrendingUp size={18} className="text-brand-600" />, "Upgrade my category", "/app/provider/upgrade")}
          {link(<MessageSquareQuote size={18} className="text-brand-600" />, "Reviews & feedback", "/app/provider/reviews")}
        </Card>
      </Section>
      <Section title="Account">
        <Card className="divide-y divide-gray-100 py-0 dark:divide-gray-800">
          <button type="button" onClick={() => setPwOpen(true)} className="flex w-full items-center gap-3 py-3 text-left text-sm text-gray-800 dark:text-gray-100">
            <KeyRound size={18} className="text-gray-500" />
            <span className="flex-1">Change password</span>
            <ChevronRight size={16} className="text-gray-400" />
          </button>
        </Card>
      </Section>
      <Button variant="danger" className="w-full" onClick={logout}>
        <LogOut size={16} /> Sign out
      </Button>
      <ChangePasswordSheet role="PROVIDER" open={pwOpen} onClose={() => setPwOpen(false)} />
    </Screen>
  );
}

export function ServicesOffered() {
  const toast = useToast();
  const { busy, run } = useAction();
  const { data } = useApi(() => providerApi.get<any[]>("/providers/me/consultation-services"), []);
  const [offered, setOffered] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (data) setOffered(new Set(data.filter((s) => s.offered).map((s) => s.id)));
  }, [data]);
  const save = async () => {
    const excludedServiceIds = (data ?? []).filter((s) => !offered.has(s.id)).map((s) => s.id);
    const ok = await run(() => providerApi.put("/providers/me/consultation-services", { excludedServiceIds }), (m) => toast(m, "err"));
    if (ok) toast("Saved. Patients see this on your profile.");
  };
  return (
    <Screen title="Services I offer" back="/app/provider/profile" footer={<Button className="w-full" busy={busy} onClick={save}>Save</Button>}>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">Untick anything you don't do. Patients see the list on your profile before booking.</p>
      {!data ? (
        <Loading />
      ) : !data.length ? (
        <Empty title="No checklist for your service yet" />
      ) : (
        <Card className="py-1">
          {data.map((s) => (
            <label key={s.id} className="flex items-center gap-3 py-2.5 text-sm text-gray-800 dark:text-gray-100">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={offered.has(s.id)}
                onChange={(e) => {
                  const next = new Set(offered);
                  if (e.target.checked) next.add(s.id);
                  else next.delete(s.id);
                  setOffered(next);
                }}
              />
              {s.label}
            </label>
          ))}
        </Card>
      )}
    </Screen>
  );
}

export function Settings() {
  const toast = useToast();
  const { busy, run } = useAction();
  const me = useApi(() => providerApi.get("/providers/me"), []);
  const rates = useApi(() => providerApi.get("/providers/billing-rate/history").catch(() => null), []);
  const [fee, setFee] = useState("");
  const [radius, setRadius] = useState("");
  useEffect(() => {
    if (me.data) {
      setFee(String(Math.round(me.data.currentFee)));
      setRadius(String(me.data.serviceRadiusKm ?? ""));
    }
  }, [me.data]);
  if (!me.data) return <Screen title="Fee, radius & location" back="/app/provider/profile"><Loading /></Screen>;
  const d = me.data;
  const salaried = d.employmentType === "SALARIED";

  const updateLocation = () => {
    const send = (latitude: number, longitude: number) =>
      run(() => providerApi.put("/providers/location", { latitude, longitude }), (m) => toast(m, "err")).then((ok) => ok && toast("Location updated"));
    if (!navigator.geolocation) return send(23.7465, 90.376);
    navigator.geolocation.getCurrentPosition(
      (pos) => send(pos.coords.latitude, pos.coords.longitude),
      () => {
        toast("Location permission denied, using Dhanmondi for the demo", "err");
        send(23.7465, 90.376);
      },
      { timeout: 6000 }
    );
  };

  return (
    <Screen title="Fee, radius & location" back="/app/provider/profile">
      <Section title="Fee">
        <Card>
          {salaried ? (
            <Notice tone="gray">You are salaried. Caregiver BD admin sets what patients pay ({taka(d.currentFee)}) and your salary.</Notice>
          ) : (
            <>
              <Field label="Consultation fee (৳)" hint="New bookings use the new fee. Accepted bookings keep the fee locked at booking time.">
                <Input type="number" min={100} value={fee} onChange={(e) => setFee(e.target.value)} />
              </Field>
              <Button className="w-full" busy={busy} onClick={() => run(() => providerApi.put("/providers/billing-rate", { amount: Number(fee) }), (m) => toast(m, "err")).then((ok) => ok && toast("Fee updated"))}>
                Update fee
              </Button>
            </>
          )}
          {rates.data?.history?.length > 0 && (
            <div className="mt-3 border-t border-gray-100 pt-2 dark:border-gray-800">
              <p className="mb-1 text-xs font-semibold text-gray-500">History</p>
              {rates.data.history.slice(0, 5).map((r: any) => (
                <KV key={r.id} label={`${fmtDate(r.validFrom)} – ${fmtDate(r.validTo)}`}>
                  {taka(r.amount)}
                </KV>
              ))}
            </div>
          )}
        </Card>
      </Section>
      <Section title="Service radius">
        <Card>
          <Field label="How far will you travel? (km)" hint={`Maximum ${d.maxServiceRadiusKm} km`}>
            <Input type="number" step="0.5" min={0.1} max={d.maxServiceRadiusKm} value={radius} onChange={(e) => setRadius(e.target.value)} />
          </Field>
          <Button variant="secondary" className="w-full" busy={busy} onClick={() => run(() => providerApi.put("/providers/service-radius", { serviceRadiusKm: Number(radius) }), (m) => toast(m, "err")).then((ok) => ok && toast("Radius saved"))}>
            Save radius
          </Button>
        </Card>
      </Section>
      <Section title="Location">
        <Card>
          <KV label="Current">
            {Number(d.latitude).toFixed(4)}, {Number(d.longitude).toFixed(4)}
          </KV>
          <KV label="Updated">{d.locationUpdatedAt ? fmtDate(d.locationUpdatedAt) : "Never"}</KV>
          <Button variant="secondary" className="mt-2 w-full" busy={busy} onClick={updateLocation}>
            <MapPin size={16} /> Use my current location
          </Button>
        </Card>
      </Section>
    </Screen>
  );
}

export function Upgrade() {
  const toast = useToast();
  const { busy, run } = useAction();
  const me = useApi(() => providerApi.get("/providers/me"), []);
  const list = useApi(() => providerApi.get<any[]>("/providers/me/upgrade-requests"), []);
  const types = useApi(() => providerApi.get<any[]>("/consultation-types"), []);
  const [target, setTarget] = useState("");
  const sameRoot = (types.data ?? []).find((r) => r.children.some((c: any) => c.id === me.data?.consultationTypeId));
  const submit = async () => {
    const ok = await run(() => providerApi.post("/providers/me/upgrade-requests", { targetConsultationTypeId: Number(target) }), (m) => toast(m, "err"));
    if (ok) {
      toast("Upgrade request sent to admin");
      setTarget("");
    }
  };
  return (
    <Screen title="Upgrade category" back="/app/provider/profile">
      <Card className="mb-4">
        <KV label="Current">{me.data?.consultationTypeName}</KV>
        <Field label="Move to">
          <Select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Select</option>
            {(sameRoot?.children ?? [])
              .filter((c: any) => c.id !== me.data?.consultationTypeId)
              .map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </Field>
        <p className="mb-3 text-xs text-gray-500">Upload the documents the new category needs from the Verification page; admin checks them before approving.</p>
        <Button className="w-full" disabled={!target} busy={busy} onClick={submit}>
          Request upgrade
        </Button>
      </Card>
      <Section title="My requests">
        {!list.data?.length ? (
          <Empty title="No upgrade requests" />
        ) : (
          <div className="grid gap-2">
            {list.data.map((u) => (
              <Card key={u.id} className="p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">→ {u.targetConsultationTypeName}</p>
                  <StatusBadge status={u.status} />
                </div>
                <p className="text-xs text-gray-500">From {u.currentConsultationTypeName} · {fmtDate(u.createdAt)}</p>
                {u.adminComment && <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Admin: {u.adminComment}</p>}
              </Card>
            ))}
          </div>
        )}
      </Section>
    </Screen>
  );
}

export function Reviews() {
  const reviews = useApi(() => providerApi.get("/reviews/my/received"), []);
  const feedback = useApi(() => providerApi.get<any[]>("/feedback/provider/me"), []);
  return (
    <Screen title="Reviews & feedback" back="/app/provider/profile">
      {!reviews.data ? (
        <Loading />
      ) : (
        <>
          <Card className="mb-4 text-center">
            <p className="text-4xl font-semibold text-gray-900 dark:text-white">{Number(reviews.data.averageRating).toFixed(1)}</p>
            <Stars value={reviews.data.averageRating} count={reviews.data.totalReviews} />
          </Card>
          <Section title="From the app">
            {!reviews.data.reviews.length && !feedback.data?.length ? (
              <Empty title="No reviews from app bookings yet" text="Patients can rate you after a completed service." />
            ) : (
              <div className="grid gap-2">
                {reviews.data.reviews.map((r: any) => (
                  <Card key={`r${r.id}`} className="p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{r.reviewerName}</p>
                      <Stars value={r.rating} />
                    </div>
                    {r.comment && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{r.comment}</p>}
                  </Card>
                ))}
                {(feedback.data ?? []).map((f) => (
                  <Card key={`f${f.id}`} className="p-3">
                    <p className="text-sm text-gray-600 dark:text-gray-300">“{f.feedback}”</p>
                    <p className="mt-1 text-xs text-gray-400">{f.patientName} · {fmtDate(f.createdAt)}</p>
                  </Card>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </Screen>
  );
}
