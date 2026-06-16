import { useCallback, useEffect, useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { InfoTooltip } from "../components/common/InfoTooltip";
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
} from "../services/api";
import { fmtBDT, KpiCard, HealthDot } from "./financial/shared";

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
        description="Live snapshot of platform ledger health: wallet balances and money summary."
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
          <button
            type="button"
            onClick={fetchSummary}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
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

            {/* ── GL Wallet table ─────────────────────────────────────────────── */}
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
                    <TableCell isHeader className="text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Health
                        <InfoTooltip text="Green = healthy (balance equals net change). Red = corruption detected." align="end" />
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
