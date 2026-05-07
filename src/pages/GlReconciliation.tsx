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
} from "../services/api";
import { fmtBDT, KpiCard, HealthDot } from "./financial/shared";

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
        description="Live snapshot of platform ledger health: wallet balances, drift checks, and cross-system validation."
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
            {/* Profit summary KPIs */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard
                label="Commission earned"
                value={fmtBDT(glSummary.profitSummary.commissionBalance)}
                tone="positive"
                tooltip="Total commission the platform has collected across all completed services. Sourced from the COMMISSION_GL ledger wallet."
              />
              <KpiCard
                label="Tax collected"
                value={fmtBDT(glSummary.profitSummary.taxBalance)}
                tone="positive"
                tooltip="Total tax (e.g. VAT) collected on behalf of the platform across all completed services. Sourced from the TAX_GL ledger wallet."
              />
              <KpiCard
                label="Total platform earnings"
                value={fmtBDT(glSummary.profitSummary.totalPlatformEarnings)}
                tone="positive"
                tooltip="Commission + tax. The platform's total income across all time."
              />
              <KpiCard
                label="Payouts processed"
                value={fmtBDT(glSummary.profitSummary.totalPayoutsProcessed)}
                tone="neutral"
                hint="To providers via withdrawals"
                tooltip="Total amount disbursed to providers as withdrawals. Sourced from PAYOUT_GL — money that has left the system."
              />
            </div>

            {/* Cross-system validation */}
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                    Cross-system validation
                  </p>
                  <InfoTooltip text="Compares the platform's GL wallet balances (financial source of truth) against the totals stored on service_requests rows (business source of truth). If they drift, the ledger and business data are out of sync — the most critical inconsistency." />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Commission
                      </span>
                      <InfoTooltip text="Cross-check between the COMMISSION_GL wallet balance and the sum of commissionAmount on PAID/COMPLETED service_requests. Must match exactly." />
                    </div>
                    <HealthDot healthy={glSummary.crossSystemValidation.commissionInSync} />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="text-gray-500 dark:text-gray-400">From SR</p>
                        <InfoTooltip text="Sum of commissionAmount across all PAID/COMPLETED service_requests." />
                      </div>
                      <p className="font-medium text-gray-800 dark:text-white/90">
                        {fmtBDT(glSummary.crossSystemValidation.srCommissionTotal)}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="text-gray-500 dark:text-gray-400">From GL</p>
                        <InfoTooltip text="Current balance of the COMMISSION_GL ledger wallet." />
                      </div>
                      <p className="font-medium text-gray-800 dark:text-white/90">
                        {fmtBDT(glSummary.crossSystemValidation.glCommissionBalance)}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="text-gray-500 dark:text-gray-400">Drift</p>
                        <InfoTooltip text="From GL − From SR. Must be 0. Non-zero means a payment moved through the ledger without a matching service_request record, or vice versa." />
                      </div>
                      <p
                        className={`font-medium ${
                          glSummary.crossSystemValidation.commissionInSync
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-rose-700 dark:text-rose-400"
                        }`}
                      >
                        {fmtBDT(glSummary.crossSystemValidation.commissionDrift)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Tax
                      </span>
                      <InfoTooltip text="Cross-check between TAX_GL wallet balance and the sum of taxAmount on PAID/COMPLETED service_requests." />
                    </div>
                    <HealthDot healthy={glSummary.crossSystemValidation.taxInSync} />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="text-gray-500 dark:text-gray-400">From SR</p>
                        <InfoTooltip text="Sum of taxAmount across all PAID/COMPLETED service_requests." />
                      </div>
                      <p className="font-medium text-gray-800 dark:text-white/90">
                        {fmtBDT(glSummary.crossSystemValidation.srTaxTotal)}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="text-gray-500 dark:text-gray-400">From GL</p>
                        <InfoTooltip text="Current balance of the TAX_GL ledger wallet." />
                      </div>
                      <p className="font-medium text-gray-800 dark:text-white/90">
                        {fmtBDT(glSummary.crossSystemValidation.glTaxBalance)}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="text-gray-500 dark:text-gray-400">Drift</p>
                        <InfoTooltip text="From GL − From SR. Must be 0. Non-zero indicates a tax record mismatch between business and finance." />
                      </div>
                      <p
                        className={`font-medium ${
                          glSummary.crossSystemValidation.taxInSync
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-rose-700 dark:text-rose-400"
                        }`}
                      >
                        {fmtBDT(glSummary.crossSystemValidation.taxDrift)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* GL Wallet table */}
            <div className="overflow-x-auto -mx-1 px-1">
              <Table className="min-w-[44rem]">
                <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                  <TableRow>
                    <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Wallet
                        <InfoTooltip text="The GL (general ledger) wallet name. ONLINE_PAYMENT_GL receives online payments, COMMISSION_GL holds platform commission, TAX_GL holds tax, PAYOUT_GL tracks provider withdrawals, HOPE_GL is the platform control wallet." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Balance
                        <InfoTooltip text="Current balance read directly from the wallets table." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Credits
                        <InfoTooltip text="Sum of all ledger entries that credited this wallet (money that flowed in)." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Debits
                        <InfoTooltip text="Sum of all ledger entries that debited this wallet (money that flowed out)." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Net change
                        <InfoTooltip text="Credits − Debits. Must always equal Balance." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Drift
                        <InfoTooltip text="Balance − Net change. Must always be 0. A non-zero drift means a wallet balance was modified without a matching ledger entry." />
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
