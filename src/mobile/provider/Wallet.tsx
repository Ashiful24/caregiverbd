/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Wallet } from "lucide-react";
import { getSession, providerApi } from "../api";
import { fmtDateTime, taka } from "../format";
import { useAction, useApi } from "../hooks";
import { Button, Card, Empty, Field, Input, KV, Loading, Screen, Segmented, Select, Sheet, StatusBadge, useToast } from "../ui";

export default function WalletScreen() {
  const toast = useToast();
  const { busy, run } = useAction();
  const w = useApi(() => providerApi.get("/financial/wallet/me"), []);
  const tx = useApi(() => providerApi.get<{ data: any[] }>("/financial/transactions/me"), []);
  const wd = useApi(() => providerApi.get<any[]>("/financial/withdrawals/me"), []);
  const [tab, setTab] = useState<"activity" | "withdrawals">("activity");
  const [sheet, setSheet] = useState<null | "topup" | "withdraw">(null);
  const [form, setForm] = useState({ amount: "", method: "BKASH", mobileNumber: getSession("PROVIDER")?.user.username ?? "", bankName: "", accountNumber: "" });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok =
      sheet === "topup"
        ? await run(() => providerApi.post("/financial/recharge", { amount: Number(form.amount), method: form.method }), (m) => toast(m, "err"))
        : await run(() => providerApi.post("/financial/withdrawal", { ...form, amount: Number(form.amount) }), (m) => toast(m, "err"));
    if (ok) {
      toast(sheet === "topup" ? "Wallet topped up" : "Withdrawal requested. Admin will process it.");
      setSheet(null);
      setForm((f) => ({ ...f, amount: "" }));
    }
  };

  if (!w.data) return <Screen title="Wallet"><Loading /></Screen>;
  const d = w.data;
  const o = d.overview ?? {};

  return (
    <Screen title="Wallet">
      <Card className="mb-4 border-0 bg-gradient-to-br from-brand-600 to-brand-800 text-white">
        <p className="text-xs uppercase tracking-wide text-white/70">Available to withdraw</p>
        <p className="mt-1 text-3xl font-semibold">{taka(d.availableToWithdraw)}</p>
        {Number(d.pendingWithdrawal) > 0 ? (
          <p className="text-xs text-white/70">
            {taka(d.pendingWithdrawal)} withdrawal in progress · claimable {taka(d.claimableBalance)}
          </p>
        ) : (
          <p className="text-xs text-white/70">Online earnings you can cash out</p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setSheet("withdraw")} className="flex items-center justify-center gap-2 rounded-xl bg-white/15 py-2 text-sm font-semibold hover:bg-white/25">
            <ArrowUpFromLine size={16} /> Withdraw
          </button>
          <button type="button" onClick={() => setSheet("topup")} className="flex items-center justify-center gap-2 rounded-xl bg-white/15 py-2 text-sm font-semibold hover:bg-white/25">
            <ArrowDownToLine size={16} /> Top up
          </button>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Card className="p-3">
          <p className="text-[11px] text-gray-500">This month</p>
          <p className="font-semibold text-gray-900 dark:text-white">{taka(o.currentMonthEarnings)}</p>
          {o.monthOverMonthPercent != null && (
            <p className={o.monthOverMonthPercent >= 0 ? "text-[11px] text-brand-600" : "text-[11px] text-red-500"}>
              {o.monthOverMonthPercent >= 0 ? "▲" : "▼"} {Math.abs(o.monthOverMonthPercent)}% vs last month
            </p>
          )}
        </Card>
        <Card className="p-3">
          <p className="text-[11px] text-gray-500">Lifetime earned</p>
          <p className="font-semibold text-gray-900 dark:text-white">{taka(o.totalEarnedLifetime)}</p>
          <p className="text-[11px] text-gray-500">{o.completedJobsCount ?? 0} jobs</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] text-gray-500">Wallet (cash + top-ups)</p>
          <p className="font-semibold text-gray-900 dark:text-white">{taka(d.walletBalance)}</p>
          <p className="text-[11px] text-gray-500">Used for commission</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] text-gray-500">Avg per job</p>
          <p className="font-semibold text-gray-900 dark:text-white">{o.avgEarningsPerCompletedJob ? taka(o.avgEarningsPerCompletedJob) : "—"}</p>
          <p className="text-[11px] text-gray-500">Cash commission due {taka(d.cashCommissionDue)}</p>
        </Card>
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "activity", label: "Activity" },
          { value: "withdrawals", label: `Withdrawals (${wd.data?.length ?? 0})` },
        ]}
      />

      {tab === "activity" ? (
        !tx.data?.data.length ? (
          <Empty icon={<Wallet size={40} />} title="No transactions yet" />
        ) : (
          <div className="grid gap-2">
            {tx.data.data.map((t) => (
              <Card key={`${t.type}${t.transactionId}`} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                    {t.type === "WALLET_RECHARGE" ? `Top-up · ${t.paymentMethod}` : t.type === "WITHDRAWAL" ? "Withdrawal" : `${t.consultationTypeName} · ${t.patientName}`}
                  </p>
                  <p className={t.type === "WITHDRAWAL" ? "text-sm font-semibold text-red-500" : "text-sm font-semibold text-brand-600"}>
                    {t.type === "WITHDRAWAL" ? "−" : "+"}
                    {taka(t.providerFee)}
                  </p>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[11px] text-gray-500">
                  <span>
                    {fmtDateTime(t.date)}
                    {t.paymentMethod && t.type === "CONSULTATION_PAYMENT" ? ` · ${t.paymentMethod.toLowerCase()}` : ""}
                    {t.serviceType === "LONG_TERM" ? " · long-term" : ""}
                  </span>
                  <StatusBadge status={t.status} />
                </div>
              </Card>
            ))}
          </div>
        )
      ) : !wd.data?.length ? (
        <Empty title="No withdrawals yet" />
      ) : (
        <div className="grid gap-2">
          {wd.data.map((x) => (
            <Card key={x.id} className="p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{taka(x.amount)}</p>
                <StatusBadge status={x.status} />
              </div>
              <p className="text-[11px] text-gray-500">
                {x.method} {x.mobileNumber ?? x.accountNumber} · {fmtDateTime(x.createdAt)}
              </p>
              {x.adminNote && <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Admin: {x.adminNote}</p>}
            </Card>
          ))}
        </div>
      )}

      <Sheet open={sheet !== null} onClose={() => setSheet(null)} title={sheet === "topup" ? "Top up wallet" : "Withdraw earnings"}>
        <form onSubmit={submit}>
          {sheet === "withdraw" && (
            <Card className="mb-3 bg-gray-50 p-3 dark:bg-gray-800/50">
              <KV label="Available">{taka(d.availableToWithdraw)}</KV>
            </Card>
          )}
          {sheet === "topup" && <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">Commission for new jobs is checked against this balance after your free jobs.</p>}
          <Field label="Amount (৳)">
            <Input type="number" min={sheet === "topup" ? 50 : 500} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </Field>
          <Field label={sheet === "topup" ? "Pay with" : "Send to"}>
            <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="BKASH">bKash</option>
              <option value="NAGAD">Nagad</option>
              {sheet === "withdraw" && <option value="BANK">Bank account</option>}
            </Select>
          </Field>
          {sheet === "withdraw" &&
            (form.method === "BANK" ? (
              <>
                <Field label="Bank name">
                  <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} required />
                </Field>
                <Field label="Account number">
                  <Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} required />
                </Field>
              </>
            ) : (
              <Field label="Wallet number">
                <Input value={form.mobileNumber} onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })} required />
              </Field>
            ))}
          <Button type="submit" busy={busy} className="w-full">
            {sheet === "topup" ? "Top up" : "Request withdrawal"}
          </Button>
        </form>
      </Sheet>
    </Screen>
  );
}
