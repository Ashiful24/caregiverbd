/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, Heart, KeyRound, LogOut, Receipt } from "lucide-react";
import { patientApi, setSession } from "../api";
import { fmtDateTime, taka } from "../format";
import { useAction, useApi } from "../hooks";
import { Avatar, Button, Card, Empty, Field, Input, KV, Loading, Screen, Section, Stars, StatusBadge, useToast } from "../ui";
import { ChangePasswordSheet } from "../shared";

export function Profile() {
  const navigate = useNavigate();
  const toast = useToast();
  const { busy, run } = useAction();
  const me = useApi(() => patientApi.get("/patients/me"), []);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", address: "" });
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    if (me.data) setForm({ firstName: me.data.firstName ?? "", lastName: me.data.lastName ?? "", email: me.data.email ?? "", address: me.data.address ?? "" });
  }, [me.data]);

  const save = async () => {
    const ok = await run(() => patientApi.put("/patients/me", form), (m) => toast(m, "err"));
    if (ok) toast("Profile saved");
  };
  const logout = () => {
    setSession("PATIENT", null);
    navigate("/app/patient/login", { replace: true });
  };

  if (!me.data) return <Screen title="Profile"><Loading /></Screen>;
  const d = me.data;
  const link = (icon: React.ReactNode, label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 py-3 text-left text-sm text-gray-800 dark:text-gray-100">
      {icon}
      <span className="flex-1">{label}</span>
      <ChevronRight size={16} className="text-gray-400" />
    </button>
  );

  return (
    <Screen title="Profile">
      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <Avatar name={d.name} size={56} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 dark:text-white">{d.name}</p>
            <p className="text-xs text-gray-500">{d.username}</p>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={d.status} />
              <Stars value={d.averageRating} count={d.totalReviews} />
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 rounded-xl bg-gray-50 py-2 text-center dark:bg-gray-800/50">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{d.counts.active}</p>
            <p className="text-[11px] text-gray-500">Active</p>
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{d.counts.completed}</p>
            <p className="text-[11px] text-gray-500">Completed</p>
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{d.counts.longTerm}</p>
            <p className="text-[11px] text-gray-500">Long-term</p>
          </div>
        </div>
      </Card>

      <Section title="Account">
        <Card className="divide-y divide-gray-100 py-0 dark:divide-gray-800">
          {link(<Heart size={18} className="text-red-500" />, "Favourite providers", () => navigate("/app/patient/favorites"))}
          {link(<Receipt size={18} className="text-brand-600" />, "Payment history", () => navigate("/app/patient/payments"))}
          {link(<KeyRound size={18} className="text-gray-500" />, "Change password", () => setPwOpen(true))}
        </Card>
      </Section>

      <Section title="Personal details">
        <Card>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </Field>
            <Field label="Last name">
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </Field>
          </div>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Home address">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <KV label="NID">{d.nidNumber}</KV>
          <KV label="Face verified">{d.isFaceVerified ? "Yes" : "Not yet"}</KV>
          <Button className="mt-3 w-full" busy={busy} onClick={save}>
            Save changes
          </Button>
        </Card>
      </Section>

      <Button variant="danger" className="w-full" onClick={logout}>
        <LogOut size={16} /> Sign out
      </Button>
      <ChangePasswordSheet role="PATIENT" open={pwOpen} onClose={() => setPwOpen(false)} />
    </Screen>
  );
}

export function Favorites() {
  const navigate = useNavigate();
  const { data, loading } = useApi(() => patientApi.get<{ data: any[] }>("/patients/me/liked-providers"), []);
  return (
    <Screen title="Favourite providers" back="/app/patient/profile">
      {loading && !data ? (
        <Loading />
      ) : !data?.data.length ? (
        <Empty icon={<Heart size={40} />} title="No favourites yet" text="Tap the heart on a provider's page to save them here." />
      ) : (
        <div className="grid gap-2">
          {data.data.map((p) => (
            <Card key={p.id} onClick={() => navigate(`/app/patient/providers/${p.id}`)}>
              <div className="flex items-center gap-3">
                <Avatar name={p.providerName} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white">{p.providerName}</p>
                  <p className="text-xs text-gray-500">{p.consultationTypeName}</p>
                  <Stars value={p.averageRating} count={p.totalReviews} />
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{taka(p.currentFee)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  );
}

export function Payments() {
  const wallet = useApi(() => patientApi.get("/financial/wallet/me"), []);
  const tx = useApi(() => patientApi.get<{ data: any[] }>("/financial/transactions/me"), []);
  return (
    <Screen title="Payment history" back="/app/patient/profile">
      <Card className="mb-4 bg-gray-900 text-white dark:bg-gray-800">
        <p className="text-xs uppercase tracking-wide text-gray-400">Total paid</p>
        <p className="mt-1 text-2xl font-semibold">{taka(wallet.data?.totalSpent)}</p>
        <p className="text-xs text-gray-400">{wallet.data?.paymentsCount ?? 0} completed payments</p>
      </Card>
      {tx.loading && !tx.data ? (
        <Loading />
      ) : !tx.data?.data.length ? (
        <Empty icon={<Receipt size={40} />} title="No payments yet" />
      ) : (
        <div className="grid gap-2">
          {tx.data.data.map((t) => (
            <Card key={t.transactionId}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.consultationTypeName}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{taka(t.totalFee)}</p>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                <span>
                  {t.providerName} · {fmtDateTime(t.date)}
                </span>
                <StatusBadge status={t.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  );
}
