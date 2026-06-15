import { useCallback, useEffect, useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { InfoTooltip } from "../components/common/InfoTooltip";
import Badge from "../components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  adminFinancialApi,
  type GlReconciliationSummaryResponseDto,
  type GlEscrowIntegrityDto,
  type GlEarningsIntegrityDto,
} from "../services/api";
import { fmtBDT, KpiCard, HealthDot } from "./financial/shared";

// ── Escrow integrity panel ────────────────────────────────────────────────────
function EscrowIntegrityPanel({ v }: { v: GlEscrowIntegrityDto }) {
  return (
    <div className="space-y-3">
      {/* Short-term / LTO breakdown row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.02]">
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Short-term expected
            </span>
            <InfoTooltip text="Sum of sr.fee for PAID or IN_PROGRESS short-term service requests whose CONSULTATION_PAYMENT transaction has usesHoldGl = true. These fees are parked in SERVICE_HOLD_GL and have not yet been released to the provider." />
          </div>
          <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
            {fmtBDT(v.shortTermExpected)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.02]">
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              LTO expected
            </span>
            <InfoTooltip text="Sum of sr.fee for PAID or IN_PROGRESS LTO shifts whose parent CONSULTATION_PAYMENT transaction has usesHoldGl = true. Released per shift when each shift is marked COMPLETED." />
          </div>
          <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
            {fmtBDT(v.ltoExpected)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.02]">
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Total expected
            </span>
            <InfoTooltip text="Short-term + LTO. The total BDT amount that must be sitting in SERVICE_HOLD_GL right now." />
          </div>
          <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
            {fmtBDT(v.totalExpected)}
          </p>
        </div>
      </div>
      {/* Actual balance + drift row */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.02]">
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Actual (SERVICE_HOLD_GL)
            </span>
            <InfoTooltip text="Current balance of the SERVICE_HOLD_GL ledger wallet. Should exactly equal Total expected." />
          </div>
          <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
            {fmtBDT(v.actualBalance)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.02]">
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Drift
            </span>
            <InfoTooltip text="Actual − Expected. Must be 0. Negative: a shift fee left SERVICE_HOLD_GL without an SR reaching COMPLETED/CANCELLED. Positive: money entered SERVICE_HOLD_GL without a matching active SR." />
          </div>
          <p
            className={`text-sm font-semibold ${
              v.inSync
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-rose-700 dark:text-rose-400"
            }`}
          >
            {fmtBDT(v.drift)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Earnings integrity panel ──────────────────────────────────────────────────
function EarningsIntegrityPanel({ v }: { v: GlEarningsIntegrityDto }) {
  const rows = [
    {
      label: "Commission",
      released: v.commissionReleased,
      balance: v.commissionBalance,
      drift: v.commissionDrift,
      inSync: v.commissionInSync,
      releasedTip: "Sum of commissionAmount on COMPLETED SRs + PAID SRs whose payment did NOT use hold-GL. These are the SRs whose commission has been transferred to COMMISSION_GL.",
      balanceTip: "Current COMMISSION_GL ledger wallet balance.",
      driftTip: "GL Balance − Released sum. Must be 0. Non-zero means ledger and business data disagree on how much commission the platform has earned.",
    },
    {
      label: "Tax (VAT)",
      released: v.taxReleased,
      balance: v.taxBalance,
      drift: v.taxDrift,
      inSync: v.taxInSync,
      releasedTip: "Sum of taxAmount on SRs whose tax has been released to VAT_GL.",
      balanceTip: "Current VAT_GL ledger wallet balance.",
      driftTip: "GL Balance − Released sum. Must be 0.",
    },
    {
      label: "AIT",
      released: v.aitReleased,
      balance: v.aitBalance,
      drift: v.aitDrift,
      inSync: v.aitInSync,
      releasedTip: "Sum of aitAmount on SRs whose AIT has been released to AIT_GL.",
      balanceTip: "Current AIT_GL ledger wallet balance.",
      driftTip: "GL Balance − Released sum. Must be 0.",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <div key={r.label} className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {r.label}
            </span>
            <HealthDot healthy={r.inSync} />
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="flex items-center gap-1">
                <p className="text-gray-500 dark:text-gray-400">Released</p>
                <InfoTooltip text={r.releasedTip} />
              </div>
              <p className="font-medium text-gray-800 dark:text-white/90">{fmtBDT(r.released)}</p>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-gray-500 dark:text-gray-400">GL balance</p>
                <InfoTooltip text={r.balanceTip} />
              </div>
              <p className="font-medium text-gray-800 dark:text-white/90">{fmtBDT(r.balance)}</p>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-gray-500 dark:text-gray-400">Drift</p>
                <InfoTooltip text={r.driftTip} />
              </div>
              <p
                className={`font-medium ${
                  r.inSync
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-rose-700 dark:text-rose-400"
                }`}
              >
                {fmtBDT(r.drift)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function GlReconciliation() {
  const [glSummary, setGlSummary] = useState<GlReconciliationSummaryResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminFinancialApi.getGlReconciliationSummary();
      const data = (res as { data?: GlReconciliationSummaryResponseDto }).data ?? res;
      setGlSummary(data as GlReconciliationSummaryResponseDto);
    } catch {
      setError("Failed to load GL reconciliation.");
      setGlSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <>
      <PageMeta
        title="GL Reconciliation | Hope - BMQAS"
        description="Live snapshot of platform ledger health: wallet balances, escrow integrity, and earnings validation."
      />
      <PageBreadcrumb pageTitle="GL Reconciliation" />

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              GL Reconciliation
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              All-time platform ledger health · live snapshot
            </p>
          </div>
          <div className="flex items-center gap-2">
            {glSummary?.overallHealth ? (
              <Badge color={glSummary.overallHealth.healthy ? "success" : "error"}>
                <HealthDot healthy={glSummary.overallHealth.healthy} />
                <span className="ml-1">
                  {glSummary.overallHealth.healthy ? "All systems healthy" : "Drift detected"}
                </span>
              </Badge>
            ) : null}
            <button
              type="button"
              onClick={fetchSummary}
              disabled={loading}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {loading && !glSummary ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : error ? (
          <p className="text-rose-600 dark:text-rose-400">{error}</p>
        ) : glSummary ? (
          <div className="space-y-5">

            {/* ── Money summary KPIs ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {/* 9 cards: 8 original + supervisor commission */}
              <KpiCard
                label="In escrow"
                value={fmtBDT(glSummary.moneySummary.inEscrow)}
                tone="neutral"
                hint="Payments awaiting service completion"
                tooltip="SERVICE_HOLD_GL balance — total held in escrow for both short-term and LTO payments. Released to the provider's wallet only when each service reaches COMPLETED."
              />
              <KpiCard
                label="Commission earned"
                value={fmtBDT(glSummary.moneySummary.commissionEarned)}
                tone="positive"
                tooltip="COMMISSION_GL balance — platform commission released at service completion."
              />
              <KpiCard
                label="Tax collected"
                value={fmtBDT(glSummary.moneySummary.taxCollected)}
                tone="positive"
                tooltip="VAT_GL balance — VAT/tax released at service completion."
              />
              <KpiCard
                label="AIT withheld"
                value={fmtBDT(glSummary.moneySummary.aitWithheld)}
                tone="neutral"
                tooltip="AIT_GL balance — advance income tax withheld from provider earnings at completion."
              />
              <KpiCard
                label="Total platform revenue"
                value={fmtBDT(glSummary.moneySummary.totalPlatformRevenue)}
                tone="positive"
                hint="Commission + tax + cancellation fees"
                tooltip="Sum of COMMISSION_GL + VAT_GL + CANCELLATION_FEE_GL balances — all direct platform income."
              />
              <KpiCard
                label="Payouts processed"
                value={fmtBDT(glSummary.moneySummary.providerPayoutsProcessed)}
                tone="neutral"
                hint="Provider withdrawals"
                tooltip="PAYOUT_GL balance — cumulative provider withdrawals processed. Money that has left the platform to provider bank accounts."
              />
              <KpiCard
                label="Staged refunds"
                value={fmtBDT(glSummary.moneySummary.stagedRefunds)}
                tone="neutral"
                hint="Awaiting gateway payout"
                tooltip="REFUND_GL balance — refunds staged and pending gateway disbursement to patients."
              />
              <KpiCard
                label="Cancellation fees"
                value={fmtBDT(glSummary.moneySummary.cancellationFees)}
                tone="neutral"
                hint="Revenue from cancellations"
                tooltip="CANCELLATION_FEE_GL balance — cancellation fee revenue retained by the platform."
              />
              <KpiCard
                label="Supervisor commission"
                value={fmtBDT(glSummary.moneySummary.supervisorCommissionReleased)}
                tone="neutral"
                hint="Credited to supervisor wallets"
                tooltip="Total supervisor commission credited to assigned supervisors' CLAIMABLE wallets on service completion. Still inside the platform — supervisors can withdraw this when they request a payout. When no supervisor is assigned, that amount goes to Ontor's COMMISSION_GL and is already included in 'Commission earned'."
              />
            </div>

            {/* ── Escrow integrity ────────────────────────────────────────────── */}
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                    Escrow integrity
                  </p>
                  <InfoTooltip text="SERVICE_HOLD_GL balance must equal the sum of sr.fee for every service that has been paid for but not yet delivered (PAID or IN_PROGRESS). Covers both short-term and LTO service requests with usesHoldGl=true. A non-zero drift means a fee moved out of escrow without the corresponding SR status change, or vice versa." />
                </div>
                <HealthDot healthy={glSummary.escrowIntegrity.inSync} />
              </div>
              <EscrowIntegrityPanel v={glSummary.escrowIntegrity} />
            </div>

            {/* ── Earnings integrity ──────────────────────────────────────────── */}
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                    Earnings integrity
                  </p>
                  <InfoTooltip text="Compares COMMISSION_GL / VAT_GL / AIT_GL wallet balances against the sum of the corresponding SR columns for every SR whose platform cut has been released from escrow (COMPLETED SRs, or PAID SRs whose payment did not use hold-GL). PAID hold-GL SRs are excluded — their earnings are still in SERVICE_HOLD_GL. A non-zero drift means ledger entries and business data disagree." />
                </div>
                <HealthDot healthy={glSummary.overallHealth.earningsInSync} />
              </div>
              <EarningsIntegrityPanel v={glSummary.earningsIntegrity} />
            </div>

            {/* ── GL Wallet drift table ───────────────────────────────────────── */}
            <div className="overflow-x-auto -mx-1 px-1">
              <Table className="min-w-[44rem]">
                <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                  <TableRow>
                    <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Wallet
                        <InfoTooltip text="GL wallet name. ONLINE_PAYMENT_GL is a pass-through (balance always 0). SERVICE_HOLD_GL holds escrow funds until service completes. COMMISSION_GL, VAT_GL, AIT_GL hold released platform cuts. PAYOUT_GL tracks provider withdrawals. HOPE_GL is the platform control wallet. REFUND_GL stages patient refunds. CANCELLATION_FEE_GL holds cancellation fee revenue." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Balance
                        <InfoTooltip text="Current balance from the wallets table." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Credits
                        <InfoTooltip text="Sum of all ledger entries that credited this wallet (money in)." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Debits
                        <InfoTooltip text="Sum of all ledger entries that debited this wallet (money out)." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Net change
                        <InfoTooltip text="Credits − Debits. Must equal Balance." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Drift
                        <InfoTooltip text="Balance − Net change. Must be 0. Non-zero = wallet balance modified without a matching ledger entry (write corruption)." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Health
                        <InfoTooltip text="Green = healthy (drift is 0). Red = corruption detected." align="end" />
                      </span>
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {glSummary.wallets.map((w) => (
                    <TableRow key={w.walletType}>
                      <TableCell className="font-medium text-gray-800 dark:text-white/90 py-2.5">
                        {w.walletType}
                      </TableCell>
                      <TableCell className="text-right text-gray-700 dark:text-gray-300 py-2.5">
                        {fmtBDT(w.balance)}
                      </TableCell>
                      <TableCell className="text-right text-gray-600 dark:text-gray-400 py-2.5">
                        {fmtBDT(w.totalCredit)}
                      </TableCell>
                      <TableCell className="text-right text-gray-600 dark:text-gray-400 py-2.5">
                        {fmtBDT(w.totalDebit)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-gray-800 dark:text-white/90 py-2.5">
                        {fmtBDT(w.netChange)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium py-2.5 ${
                          w.isHealthy
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-rose-700 dark:text-rose-400"
                        }`}
                      >
                        {fmtBDT(w.drift)}
                      </TableCell>
                      <TableCell className="text-center py-2.5">
                        <HealthDot healthy={w.isHealthy} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
