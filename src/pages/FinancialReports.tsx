import { useCallback, useEffect, useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  adminFinancialApi,
  providersApi,
  type GlReconciliationSummaryResponseDto,
  type GlDailyFlowResponseDto,
  type ProviderTransactionHistoryResponseDto,
  type ProviderListItem,
} from "../services/api";
import { formatDate } from "../utils/format";

function toISODateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function FinancialReports() {
  const [glSummary, setGlSummary] = useState<GlReconciliationSummaryResponseDto | null>(null);
  const [glSummaryLoading, setGlSummaryLoading] = useState(true);
  const [glSummaryError, setGlSummaryError] = useState("");

  const [glHistory, setGlHistory] = useState<GlDailyFlowResponseDto | null>(null);
  const [glHistoryLoading, setGlHistoryLoading] = useState(false);
  const [glHistoryError, setGlHistoryError] = useState("");
  const [historyStart, setHistoryStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toISODateLocal(d);
  });
  const [historyEnd, setHistoryEnd] = useState(() => toISODateLocal(new Date()));

  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [providerId, setProviderId] = useState<number | "">("");
  const [transactions, setTransactions] = useState<ProviderTransactionHistoryResponseDto | null>(null);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState("");
  const [txStart, setTxStart] = useState("");
  const [txEnd, setTxEnd] = useState("");

  const fetchGlSummary = useCallback(async () => {
    setGlSummaryLoading(true);
    setGlSummaryError("");
    try {
      const res = await adminFinancialApi.getGlReconciliationSummary();
      const data = (res as { data?: GlReconciliationSummaryResponseDto }).data ?? res;
      setGlSummary(data as GlReconciliationSummaryResponseDto);
    } catch {
      setGlSummaryError("Failed to load GL summary.");
      setGlSummary(null);
    } finally {
      setGlSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGlSummary();
  }, [fetchGlSummary]);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await providersApi.getList({ page: 1, limit: 500 });
      const list = (res?.data as { providers?: ProviderListItem[] })?.providers ?? (res as { providers?: ProviderListItem[] })?.providers ?? [];
      setProviders(Array.isArray(list) ? list : []);
    } catch {
      setProviders([]);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const loadGlHistory = async () => {
    if (!historyStart || !historyEnd) return;
    setGlHistoryLoading(true);
    setGlHistoryError("");
    try {
      const startDate = new Date(historyStart).toISOString();
      const endDate = new Date(historyEnd + "T23:59:59.999Z").toISOString();
      const res = await adminFinancialApi.getGlReconciliationHistory(
        { startDate, endDate }
      );
      const data = (res as { data?: GlDailyFlowResponseDto }).data ?? res;
      setGlHistory(data as GlDailyFlowResponseDto);
    } catch {
      setGlHistoryError("Failed to load GL history.");
      setGlHistory(null);
    } finally {
      setGlHistoryLoading(false);
    }
  };

  const loadProviderTransactions = async () => {
    if (providerId === "" || typeof providerId !== "number") return;
    setTransactionsLoading(true);
    setTransactionsError("");
    try {
      const params: { startDate?: string; endDate?: string; page?: number; limit?: number } = {
        page: 1,
        limit: 50,
      };
      if (txStart) params.startDate = new Date(txStart).toISOString();
      if (txEnd) params.endDate = new Date(txEnd + "T23:59:59.999Z").toISOString();
      const res = await adminFinancialApi.getProviderTransactionHistory(
        providerId,
        params
      );
      const data = (res as { data?: ProviderTransactionHistoryResponseDto }).data ?? res;
      setTransactions(data as ProviderTransactionHistoryResponseDto);
    } catch {
      setTransactionsError("Failed to load transactions.");
      setTransactions(null);
    } finally {
      setTransactionsLoading(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Financial Reports | Hope - BMQAS"
        description="GL reconciliation and provider transaction history"
      />
      <PageBreadcrumb pageTitle="Financial Reports" />
      <div className="space-y-6">
        {/* GL Reconciliation Summary */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
            GL Reconciliation Summary
          </h3>
          {glSummaryLoading ? (
            <p className="text-gray-500 dark:text-gray-400">Loading…</p>
          ) : glSummaryError ? (
            <p className="text-red-600 dark:text-red-400">{glSummaryError}</p>
          ) : glSummary ? (
            <div className="space-y-4">
              {glSummary.profitSummary && (
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <p className="mb-2 text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                    Profit summary
                  </p>
                  <div className="grid gap-2 text-sm sm:grid-cols-1">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Commission balance: </span>
                      <span className="font-medium text-gray-800 dark:text-white/90">
                        {glSummary.profitSummary.commissionBalance ?? "—"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {glSummary.wallets?.length > 0 && (
                <div className="overflow-x-auto -mx-1 px-1">
                  <Table className="min-w-[36rem]">
                    <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                      <TableRow>
                        <TableCell isHeader className="w-[28%] min-w-[11rem] max-w-[18rem] text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 whitespace-normal break-words py-3">Wallet type</TableCell>
                        <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 whitespace-nowrap py-3">Balance</TableCell>
                        <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 whitespace-nowrap py-3">Credit</TableCell>
                        <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 whitespace-nowrap py-3">Debit</TableCell>
                        <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 whitespace-nowrap py-3">Net change</TableCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {glSummary.wallets.map((w, i) => (
                        <TableRow key={w.walletType ?? i}>
                          <TableCell className="w-[28%] min-w-[11rem] max-w-[18rem] font-medium text-gray-800 dark:text-white/90 whitespace-normal break-words py-2.5" title={w.walletType ?? undefined}>{w.walletType ?? "—"}</TableCell>
                          <TableCell className="text-right text-gray-700 dark:text-gray-300 whitespace-nowrap py-2.5">{w.balance ?? "—"} {w.currency ?? ""}</TableCell>
                          <TableCell className="text-right text-gray-700 dark:text-gray-300 whitespace-nowrap py-2.5">{w.totalCredit ?? "—"}</TableCell>
                          <TableCell className="text-right text-gray-700 dark:text-gray-300 whitespace-nowrap py-2.5">{w.totalDebit ?? "—"}</TableCell>
                          <TableCell className="text-right font-medium text-gray-800 dark:text-white/90 whitespace-nowrap py-2.5">{w.netChange ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No summary data.</p>
          )}
        </div>

        {/* GL History (date range) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
            GL Daily Flow (History)
          </h3>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Start date</span>
              <input
                type="date"
                value={historyStart}
                onChange={(e) => setHistoryStart(e.target.value)}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">End date</span>
              <input
                type="date"
                value={historyEnd}
                onChange={(e) => setHistoryEnd(e.target.value)}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            <button
              type="button"
              disabled={glHistoryLoading}
              onClick={loadGlHistory}
              className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-700 dark:hover:bg-brand-800"
            >
              {glHistoryLoading ? "Loading…" : "Load history"}
            </button>
          </div>
          {glHistoryError && (
            <p className="mb-2 text-red-600 dark:text-red-400">{glHistoryError}</p>
          )}
          {(glHistory?.days?.length ?? 0) > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                  <TableRow>
                    <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Date</TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Total credit</TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Total debit</TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Net change</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(glHistory?.days ?? []).map((day) => (
                    <TableRow key={day.date}>
                      <TableCell className="font-medium text-gray-800 dark:text-white/90">{day.date}</TableCell>
                      <TableCell className="text-right text-gray-700 dark:text-gray-300">{day.totalCredit}</TableCell>
                      <TableCell className="text-right text-gray-700 dark:text-gray-300">{day.totalDebit}</TableCell>
                      <TableCell className="text-right font-medium text-gray-800 dark:text-white/90">{day.netChange}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {glHistory?.total && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Grand total — Credit: {glHistory.total.totalCredit}, Debit: {glHistory.total.totalDebit}, Net: {glHistory.total.netChange}
                </p>
              )}
            </div>
          ) : glHistory != null && !glHistoryLoading ? (
            <p className="text-gray-500 dark:text-gray-400">No daily data for this range.</p>
          ) : null}
        </div>

        {/* Provider transactions */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
            Provider transaction history
          </h3>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Provider</span>
              <select
                value={providerId === "" ? "" : providerId}
                onChange={(e) => setProviderId(e.target.value === "" ? "" : Number(e.target.value))}
                className="min-w-[12rem] rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="">Select provider</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {[p.firstName, p.lastName].filter(Boolean).join(" ") || `Provider #${p.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">From (optional)</span>
              <input
                type="date"
                value={txStart}
                onChange={(e) => setTxStart(e.target.value)}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">To (optional)</span>
              <input
                type="date"
                value={txEnd}
                onChange={(e) => setTxEnd(e.target.value)}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            <button
              type="button"
              disabled={transactionsLoading || providerId === ""}
              onClick={loadProviderTransactions}
              className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-700 dark:hover:bg-brand-800"
            >
              {transactionsLoading ? "Loading…" : "Load transactions"}
            </button>
          </div>
          {transactionsError && (
            <p className="mb-2 text-red-600 dark:text-red-400">{transactionsError}</p>
          )}
          {(transactions?.data?.length ?? 0) > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                  <TableRow>
                    <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Date</TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Amount</TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Balance after</TableCell>
                    <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Type</TableCell>
                    <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Description</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(transactions?.data ?? []).map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-gray-700 dark:text-gray-300">{formatDate(tx.createdAt)}</TableCell>
                      <TableCell className="text-right font-medium text-gray-800 dark:text-white/90">{tx.amount}</TableCell>
                      <TableCell className="text-right text-gray-700 dark:text-gray-300">{tx.balanceAfter ?? "—"}</TableCell>
                      <TableCell className="text-gray-700 dark:text-gray-300">{tx.type ?? "—"}</TableCell>
                      <TableCell className="text-gray-600 dark:text-gray-400">{tx.description ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Total: {transactions?.total ?? (transactions?.data?.length ?? 0)} record(s)
              </p>
            </div>
          ) : transactions != null && !transactionsLoading ? (
            <p className="text-gray-500 dark:text-gray-400">No transactions for this provider.</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
