import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { DetailModal } from "../components/common/DetailModal";
import { InfoTooltip } from "../components/common/InfoTooltip";
import { SearchableSelect } from "../components/form/SearchableSelect";
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
  providersApi,
  patientsApi,
  type FinancialReportResponseDto,
  type FinancialReportTxItemDto,
  type FinancialTxDetailResponseDto,
  type FinancialTxType,
  type FinancialPaymentMethod,
  type FinancialServiceType,
  type FinancialTxStatus,
  type ProviderListItem,
  type PatientListItem,
} from "../services/api";
import { formatDate, formatDateTime } from "../utils/format";
import {
  fmtBDT,
  KpiCard,
  TX_TYPES,
  TX_STATUSES,
  statusBadgeColor,
  txTypeLabel,
  toISODateLocal,
  DEFAULT_LIMIT,
  MAX_RANGE_DAYS,
} from "./financial/shared";

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function MasterFinancialReport() {
  // ── Financial report (combined: summary + paginated transactions) ─────────
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toISODateLocal(d);
  });
  const [endDate, setEndDate] = useState(() => toISODateLocal(new Date()));

  const [providerId, setProviderId] = useState<number | "">("");
  const [patientId, setPatientId]   = useState<number | "">("");
  const [type, setType] = useState<FinancialTxType | "">("");
  const [paymentMethod, setPaymentMethod] = useState<FinancialPaymentMethod | "">("");
  const [serviceType, setServiceType] = useState<FinancialServiceType | "">("");
  const [status, setStatus] = useState<FinancialTxStatus | "">("");

  const [page, setPage] = useState(1);
  const [report, setReport] = useState<FinancialReportResponseDto | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");

  // Track filter version: when filters change, page resets to 1 and summary is refetched
  const filterKeyRef = useRef("");
  const currentFilterKey = useMemo(
    () =>
      JSON.stringify({
        startDate,
        endDate,
        providerId,
        patientId,
        type,
        paymentMethod,
        serviceType,
        status,
      }),
    [startDate, endDate, providerId, patientId, type, paymentMethod, serviceType, status],
  );

  const validateRange = useCallback((): string | null => {
    if (!startDate || !endDate) return "Start and end dates are required.";
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
      return "Invalid date format.";
    if (end < start) return "End date must be after start date.";
    const diffDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    if (diffDays > MAX_RANGE_DAYS) return `Date range cannot exceed ${MAX_RANGE_DAYS} days.`;
    return null;
  }, [startDate, endDate]);

  const loadReport = useCallback(
    async (targetPage: number, opts?: { paginationOnly?: boolean }) => {
      const err = validateRange();
      if (err) {
        setReportError(err);
        return;
      }
      setReportLoading(true);
      setReportError("");
      try {
        // Send end-of-day for endDate so the entire day is included.
        // Backend parses with `new Date()` and uses `lte` — without T23:59:59 we'd miss
        // every transaction on the end-date itself (since they'd be after midnight UTC).
        const endDateISO = new Date(`${endDate}T23:59:59.999Z`).toISOString();
        const params = {
          startDate,
          endDate: endDateISO,
          providerId: providerId === "" ? undefined : Number(providerId),
          patientId:  patientId  === "" ? undefined : Number(patientId),
          type:          type === "" ? undefined : type,
          paymentMethod: paymentMethod === "" ? undefined : paymentMethod,
          serviceType:   serviceType === "" ? undefined : serviceType,
          status:        status === "" ? undefined : status,
          page: targetPage,
          limit: DEFAULT_LIMIT,
          paginationOnly: opts?.paginationOnly ?? false,
        };
        const res = await adminFinancialApi.getFinancialReport(params);
        const data = (res as { data?: FinancialReportResponseDto }).data ?? res;
        const reportData = data as FinancialReportResponseDto;

        setReport((prev) => {
          // When paginating, preserve the existing summary
          if (opts?.paginationOnly && prev) {
            return { ...reportData, summary: prev.summary };
          }
          return reportData;
        });
      } catch {
        setReportError("Failed to load financial report.");
      } finally {
        setReportLoading(false);
      }
    },
    [
      validateRange,
      startDate,
      endDate,
      providerId,
      patientId,
      type,
      paymentMethod,
      serviceType,
      status,
    ],
  );

  // Auto-fetch on mount and when filters change (resets to page 1, fetches summary)
  useEffect(() => {
    if (filterKeyRef.current === currentFilterKey) return;
    filterKeyRef.current = currentFilterKey;
    setPage(1);
    loadReport(1, { paginationOnly: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFilterKey]);

  // Page change without filter change → paginationOnly (skip summary)
  const goToPage = useCallback(
    (next: number) => {
      if (next < 1) return;
      setPage(next);
      loadReport(next, { paginationOnly: true });
    },
    [loadReport],
  );

  // ── Provider list (for filter dropdown) ───────────────────────────────────
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await providersApi.getList({ page: 1, limit: 500 });
        const list =
          (res?.data as { providers?: ProviderListItem[] })?.providers ??
          (res as { providers?: ProviderListItem[] })?.providers ??
          [];
        setProviders(Array.isArray(list) ? list : []);
      } catch {
        setProviders([]);
      }
    })();
  }, []);

  // ── Patient list (for filter dropdown) ────────────────────────────────────
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await patientsApi.getList({ page: 1, limit: 500 });
        const list =
          (res?.data as { patients?: PatientListItem[] })?.patients ??
          (res as { patients?: PatientListItem[] })?.patients ??
          [];
        setPatients(Array.isArray(list) ? list : []);
      } catch {
        setPatients([]);
      }
    })();
  }, []);

  // ── Detail modal ──────────────────────────────────────────────────────────
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<FinancialTxDetailResponseDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const openDetail = useCallback(async (transactionId: number) => {
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await adminFinancialApi.getFinancialTransactionDetail(transactionId);
      const data = (res as { data?: FinancialTxDetailResponseDto }).data ?? res;
      setDetail(data as FinancialTxDetailResponseDto);
    } catch {
      setDetailError("Could not load transaction details.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setDetail(null);
    setDetailError(null);
  }, []);

  const resetFilters = () => {
    setProviderId("");
    setPatientId("");
    setType("");
    setPaymentMethod("");
    setServiceType("");
    setStatus("");
  };

  const totals = report?.summary?.totals;
  const txList = report?.transactions.data ?? [];
  const pagination = report?.transactions.pagination;
  const hasMore = pagination?.hasMore ?? false;

  return (
    <>
      <PageMeta
        title="Master Financial Report | Hope - BMQAS"
        description="Admin master financial report: daily money flow and paginated transactions with full breakdown."
      />
      <PageBreadcrumb pageTitle="Master Financial Report" />

      <div className="space-y-6">

        {/* ─────────────────────────── REPORT FILTERS ───────────────────────────── */}
        <section className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          {/* Top loading bar — visible while the report is being (re)loaded */}
          {reportLoading ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-brand-100 dark:bg-brand-500/10">
              <div
                className="h-full w-1/3 bg-brand-500"
                style={{ animation: "loadingBar 1.2s ease-in-out infinite" }}
              />
            </div>
          ) : null}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  Master financial report
                </h3>
                {reportLoading ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                    Loading…
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Daily money flow + paginated transactions · max 90 day range
              </p>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              disabled={reportLoading}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Reset filters
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                Start date
                <InfoTooltip text="The first day to include in the report (inclusive). Combined with End date, the range cannot exceed 90 days." />
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                End date
                <InfoTooltip text="The last day to include in the report (inclusive — the entire end day is included). Range from Start date cannot exceed 90 days." />
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                Provider
                <InfoTooltip text="Limit the report to transactions involving a specific provider. Type a name to search the dropdown." />
              </span>
              <SearchableSelect<number>
                value={providerId === "" ? null : providerId}
                onChange={(v) => setProviderId(v == null ? "" : v)}
                placeholder="All providers"
                clearLabel="All providers"
                searchPlaceholder="Search by name…"
                options={providers.map((p) => {
                  const name =
                    p.providerName ||
                    p.fullName ||
                    [p.firstName, p.lastName].filter(Boolean).join(" ") ||
                    `Provider #${p.id}`;
                  return {
                    value: p.id,
                    label: name,
                    hint: p.email ?? undefined,
                  };
                })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                Patient
                <InfoTooltip text="Limit the report to transactions involving a specific patient. Type a name to search the dropdown." />
              </span>
              <SearchableSelect<number>
                value={patientId === "" ? null : patientId}
                onChange={(v) => setPatientId(v == null ? "" : v)}
                placeholder="All patients"
                clearLabel="All patients"
                searchPlaceholder="Search by name…"
                options={patients.map((p) => {
                  const name =
                    [p.firstName, p.lastName].filter(Boolean).join(" ") ||
                    `Patient #${p.id}`;
                  return {
                    value: p.id,
                    label: name,
                    hint: p.email ?? p.username ?? undefined,
                  };
                })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                Type
                <InfoTooltip text="Transaction type. Payment = patient paid for a service. Withdrawal = provider cashed out earnings. Refund = money returned to a patient. Commission/Adjustment = platform internal entries." />
              </span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as FinancialTxType | "")}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="">All types</option>
                {TX_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                Payment method
                <InfoTooltip text="Online = paid via gateway (card / mobile banking). Cash = collected in person at the time of service." />
              </span>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as FinancialPaymentMethod | "")
                }
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="">All methods</option>
                <option value="ONLINE">Online</option>
                <option value="CASH">Cash</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                Service
                <InfoTooltip text="Short term = a single shift / consultation. Long term = an ongoing care engagement (multiple shifts grouped under one opportunity)." />
              </span>
              <select
                value={serviceType}
                onChange={(e) =>
                  setServiceType(e.target.value as FinancialServiceType | "")
                }
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="">All services</option>
                <option value="SHORT_TERM">Short term</option>
                <option value="LONG_TERM">Long term</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                Status
                <InfoTooltip text="If left empty, the summary KPIs only count COMPLETED transactions (realised money), while the list shows all statuses. Choose a specific status to focus on troubleshooting (e.g. PENDING or FAILED)." align="end" />
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FinancialTxStatus | "")}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="">All statuses</option>
                {TX_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {reportError && (
            <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{reportError}</p>
          )}
        </section>

        {/* Report content (KPIs · daily flow · transactions) — dimmed while reloading */}
        <div
          aria-busy={reportLoading}
          className={`space-y-6 transition-opacity duration-200 ${
            reportLoading ? "pointer-events-none opacity-60" : "opacity-100"
          }`}
        >

        {/* ─────────────────────────── SUMMARY KPIs ─────────────────────────────── */}
        {totals ? (
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              label="Total inflow"
              value={fmtBDT(totals.totalInflow)}
              hint={`${fmtBDT(totals.onlinePayments)} online · ${fmtBDT(totals.cashPayments)} cash`}
              tone="positive"
              tooltip="Total amount paid by patients across all selected days. Combines online (gateway) and cash payments. Limited by current filters."
            />
            <KpiCard
              label="Provider payouts"
              value={fmtBDT(totals.totalProviderFee)}
              hint={`${totals.consultationCount} payments`}
              tone="neutral"
              tooltip="Sum of providerFee — net credited to provider wallets after commission, tax, and AIT. This is what providers actually received from completed services in the selected range."
            />
            <KpiCard
              label="AIT withheld"
              value={fmtBDT(totals.totalAit ?? "0")}
              tone="neutral"
              tooltip="Advance Income Tax withheld from provider earnings and credited to AIT_GL. Deducted from the provider share after commission (not platform revenue)."
            />
            <KpiCard
              label="Platform earnings"
              value={fmtBDT(totals.netPlatformEarnings)}
              hint={`${fmtBDT(totals.totalCommission)} commission · ${fmtBDT(totals.totalTax)} tax`}
              tone="positive"
              tooltip="Commission + tax that the platform collected during the selected range. Hint shows the split. AIT is excluded — it is withheld from providers, not platform income."
            />
            <KpiCard
              label="Withdrawals"
              value={fmtBDT(totals.totalWithdrawals)}
              hint={`${totals.withdrawalCount} processed`}
              tone="negative"
              tooltip="Total amount paid out to providers as withdrawals during the selected range. This is money that left the platform."
            />
          </section>
        ) : null}

        {/* ─────────────────────────── DAILY FLOW TABLE ─────────────────────────── */}
        {report?.summary?.byDay && report.summary.byDay.length > 0 ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
              Daily money flow
            </h3>
            <div className="overflow-x-auto">
              <Table className="min-w-[64rem]">
                <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                  <TableRow>
                    <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Date
                        <InfoTooltip text="The calendar day (server time zone) on which the transactions were created." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Online
                        <InfoTooltip text="Total patient payments made via online gateway on this day." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Cash
                        <InfoTooltip text="Total patient payments collected as cash on this day." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-emerald-700 dark:text-emerald-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Inflow
                        <InfoTooltip text="Online + Cash. Total money that came in from patients on this day." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        To providers
                        <InfoTooltip text="Total provider net earnings (after commission and tax) credited from this day's payments." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Commission
                        <InfoTooltip text="Total platform commission earned on this day's payments." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Tax
                        <InfoTooltip text="Total tax collected on this day's payments." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        AIT
                        <InfoTooltip text="Advance Income Tax withheld from provider earnings on this day's payments (credited to AIT_GL)." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-rose-700 dark:text-rose-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        Withdrawals
                        <InfoTooltip text="Total provider withdrawals paid out on this day. This is money that left the platform." />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        #Tx
                        <InfoTooltip text="Number of transactions counted on this day (payments + withdrawals)." align="end" />
                      </span>
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {report.summary.byDay.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell className="font-medium text-gray-800 dark:text-white/90 py-2.5">
                        {formatDate(d.date)}
                      </TableCell>
                      <TableCell className="text-right text-gray-600 dark:text-gray-400 py-2.5">
                        {fmtBDT(d.inflow.onlinePayments)}
                      </TableCell>
                      <TableCell className="text-right text-gray-600 dark:text-gray-400 py-2.5">
                        {fmtBDT(d.inflow.cashPayments)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-700 dark:text-emerald-400 py-2.5">
                        {fmtBDT(d.inflow.total)}
                      </TableCell>
                      <TableCell className="text-right text-gray-700 dark:text-gray-300 py-2.5">
                        {fmtBDT(d.distribution.providerFee)}
                      </TableCell>
                      <TableCell className="text-right text-gray-700 dark:text-gray-300 py-2.5">
                        {fmtBDT(d.distribution.commission)}
                      </TableCell>
                      <TableCell className="text-right text-gray-700 dark:text-gray-300 py-2.5">
                        {fmtBDT(d.distribution.tax)}
                      </TableCell>
                      <TableCell className="text-right text-gray-700 dark:text-gray-300 py-2.5">
                        {fmtBDT(d.distribution.ait ?? "0")}
                      </TableCell>
                      <TableCell className="text-right font-medium text-rose-700 dark:text-rose-400 py-2.5">
                        {fmtBDT(d.outflow.withdrawals)}
                      </TableCell>
                      <TableCell className="text-right text-gray-600 dark:text-gray-400 py-2.5">
                        {d.transactionCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}

        {/* ─────────────────────────── TRANSACTIONS LIST ────────────────────────── */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Transactions
              </h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Click any row to view full breakdown and ledger trail
              </p>
            </div>
          </div>

          {reportLoading && txList.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : txList.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No transactions match the filters.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="min-w-[60rem]">
                  <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                    <TableRow>
                      <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          Date
                          <InfoTooltip text="When the transaction was created (date and time)." />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          Type
                          <InfoTooltip text="Transaction type (Payment, Withdrawal, etc.) and payment method (Online or Cash) for payments." />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          Patient → Provider
                          <InfoTooltip text="Patient who paid, and the provider who received the payment. Either side may be empty for non-service transactions (e.g. admin adjustments)." />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          Service
                          <InfoTooltip text="The consultation type (e.g. Professional Nurse), service mode (Short term / Long term), and scheduled date for the underlying service request." />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          Total
                          <InfoTooltip text="Total fee paid by the patient for this service. Inflow to the platform." />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          Provider
                          <InfoTooltip text="Net amount the provider receives from this payment, after platform deductions." />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          Comm
                          <InfoTooltip text="Commission amount the platform earned on this payment." />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          Tax
                          <InfoTooltip text="Tax collected on this payment." />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          AIT
                          <InfoTooltip text="Advance Income Tax withheld from the provider on this payment." />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          Status
                          <InfoTooltip text="Completed = settled, money has moved. Pending = awaiting confirmation. Failed/Cancelled = did not go through (no money moved)." align="end" />
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {txList.map((t: FinancialReportTxItemDto) => (
                      <TableRow
                        key={t.transactionId}
                        onClick={() => openDetail(t.transactionId)}
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                      >
                        <TableCell className="text-gray-700 dark:text-gray-300 py-2.5">
                          {formatDateTime(t.date)}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                              {txTypeLabel(t.type)}
                            </span>
                            {t.paymentMethod ? (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {t.paymentMethod}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-800 dark:text-white/90">
                              {t.patientName ?? "—"}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              → {t.providerName ?? "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-800 dark:text-white/90">
                              {t.consultationTypeName ?? "—"}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {t.serviceType ?? ""}
                              {t.scheduledDate ? ` · ${formatDate(t.scheduledDate)}` : ""}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-gray-800 dark:text-white/90 py-2.5">
                          {fmtBDT(t.totalFee)}
                        </TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-gray-300 py-2.5">
                          {fmtBDT(t.providerFee)}
                        </TableCell>
                        <TableCell className="text-right text-gray-600 dark:text-gray-400 py-2.5">
                          {fmtBDT(t.commission)}
                        </TableCell>
                        <TableCell className="text-right text-gray-600 dark:text-gray-400 py-2.5">
                          {fmtBDT(t.tax)}
                        </TableCell>
                        <TableCell className="text-right text-gray-600 dark:text-gray-400 py-2.5">
                          {fmtBDT(t.ait)}
                        </TableCell>
                        <TableCell className="text-center py-2.5">
                          <Badge color={statusBadgeColor(t.status)} size="sm">
                            {t.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Page <span className="font-medium">{page}</span>
                  {pagination?.total != null ? (
                    <>
                      {" "}
                      · <span className="font-medium">{pagination.total}</span> total
                    </>
                  ) : null}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="min-h-[40px] rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    disabled={page <= 1 || reportLoading}
                    onClick={() => goToPage(page - 1)}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="min-h-[40px] rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    disabled={!hasMore || reportLoading}
                    onClick={() => goToPage(page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        </div>
        {/* end of dimmed report content */}
      </div>

      {/* ─────────────────────────── DETAIL MODAL ──────────────────────────────── */}
      <DetailModal
        title="Transaction details"
        isOpen={detailOpen}
        onClose={closeDetail}
        loading={detailLoading}
        errorMessage={detailError}
      >
        {detail ? <TransactionDetailView detail={detail} /> : null}
      </DetailModal>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Detail modal body
// ────────────────────────────────────────────────────────────────────────────

function TransactionDetailView({ detail }: { detail: FinancialTxDetailResponseDto }) {
  return (
    <div className="space-y-5">
      {/* Header strip */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge color={statusBadgeColor(detail.status)}>{detail.status}</Badge>
        <Badge color="info">{txTypeLabel(detail.type)}</Badge>
        {detail.paymentMethod ? (
          <Badge color="light">{detail.paymentMethod}</Badge>
        ) : null}
        <span className="text-sm text-gray-500 dark:text-gray-400">
          #{detail.transactionId} · {formatDateTime(detail.createdAt)}
        </span>
      </div>

      {/* Top KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Amount"
          value={fmtBDT(detail.amount)}
          tooltip="The authoritative transaction amount stored on the transaction row itself. Used for accounting purposes."
        />
        {detail.breakdown ? (
          <>
            <KpiCard
              label="Total fee"
              value={fmtBDT(detail.breakdown.totalFee)}
              tone="neutral"
              tooltip="The full amount the patient paid for this service. Equal to the service fee plus any commission/tax that was charged on top (exclusive)."
            />
            <KpiCard
              label="Provider fee"
              value={fmtBDT(detail.breakdown.providerFee)}
              tone="positive"
              tooltip="Net amount the provider actually receives after all platform deductions. This is what gets credited to the provider wallet."
            />
            <KpiCard
              label="Platform"
              value={fmtBDT(
                Number(detail.breakdown.commission.amount) +
                  Number(detail.breakdown.tax.amount),
              )}
              hint={`${fmtBDT(detail.breakdown.commission.amount)} + ${fmtBDT(detail.breakdown.tax.amount)}`}
              tone="neutral"
              tooltip="Commission + tax. The platform's earnings on this single transaction."
            />
          </>
        ) : null}
      </div>

      {/* Parties */}
      <div className="grid gap-4 sm:grid-cols-2">
        {detail.patient ? (
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <div className="mb-2 flex items-center gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Patient
              </p>
              <InfoTooltip text="The patient who paid for this service." />
            </div>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {detail.patient.name ?? `Patient #${detail.patient.id}`}
            </p>
            {detail.patient.email ? (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {detail.patient.email}
              </p>
            ) : null}
          </div>
        ) : null}
        {detail.provider ? (
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <div className="mb-2 flex items-center gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Provider
              </p>
              <InfoTooltip text="The provider who delivered this service and received the net payment." />
            </div>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {detail.provider.name ?? `Provider #${detail.provider.id}`}
            </p>
            {detail.provider.email ? (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {detail.provider.email}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Service request */}
      {detail.serviceRequest ? (
        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <div className="mb-2 flex items-center gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Service request
            </p>
            <InfoTooltip text="The service request (shift / consultation) that this payment is tied to. Contains the snapshotted rate and fee breakdown at booking time." />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <div className="flex items-center gap-1">
                <p className="text-gray-500 dark:text-gray-400">ID</p>
                <InfoTooltip text="Internal database ID of the service request. Useful for cross-referencing with other admin tools or logs." />
              </div>
              <p className="font-medium text-gray-800 dark:text-white/90">
                #{detail.serviceRequest.id}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-gray-500 dark:text-gray-400">Type</p>
                <InfoTooltip text="SHORT_TERM = single shift / consultation. LONG_TERM = a shift inside an ongoing care engagement." />
              </div>
              <p className="font-medium text-gray-800 dark:text-white/90">
                {detail.serviceRequest.referenceType ?? "—"}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-gray-500 dark:text-gray-400">Status</p>
                <InfoTooltip text="Current status of the service request (e.g. PAID, COMPLETED, IN_PROGRESS). Money has settled only when status reflects a paid state." />
              </div>
              <p className="font-medium text-gray-800 dark:text-white/90">
                {detail.serviceRequest.status}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-gray-500 dark:text-gray-400">Scheduled</p>
                <InfoTooltip text="The date the service was scheduled to take place." />
              </div>
              <p className="font-medium text-gray-800 dark:text-white/90">
                {detail.serviceRequest.scheduledDate
                  ? formatDate(detail.serviceRequest.scheduledDate)
                  : "—"}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-gray-500 dark:text-gray-400">Rate</p>
                <InfoTooltip text="Provider's billing rate at the time of booking. CONSULTATION = flat fee per visit. HOURLY = rate per hour multiplied by shift duration." />
              </div>
              <p className="font-medium text-gray-800 dark:text-white/90">
                {fmtBDT(detail.serviceRequest.rate)}{" "}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {detail.serviceRequest.rateType ?? ""}
                </span>
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-gray-500 dark:text-gray-400">Shift duration</p>
                <InfoTooltip text="Length of the shift in hours. Used together with HOURLY rate to compute the service fee. Always 1 for CONSULTATION rates." />
              </div>
              <p className="font-medium text-gray-800 dark:text-white/90">
                {detail.serviceRequest.shiftDuration ?? "—"} h
              </p>
            </div>
            {detail.serviceRequest.longTermOpportunityId ? (
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 dark:text-gray-400">Opportunity</p>
                  <InfoTooltip text="Long-term opportunity ID. All shifts under the same ongoing engagement share this ID." />
                </div>
                <p className="font-medium text-gray-800 dark:text-white/90">
                  #{detail.serviceRequest.longTermOpportunityId}
                </p>
              </div>
            ) : null}
            {detail.consultationTypeName ? (
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 dark:text-gray-400">Consultation</p>
                  <InfoTooltip text="The consultation type (e.g. Professional Nurse, Home Care Assistant) that determines the commission rate applied." />
                </div>
                <p className="font-medium text-gray-800 dark:text-white/90">
                  {detail.consultationTypeName}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Fee breakdown */}
      {detail.breakdown ? (
        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <div className="mb-3 flex items-center gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Fee breakdown
            </p>
            <InfoTooltip text="How the patient's total fee is split between the provider and the platform. 'Inclusive' means the deduction comes out of the provider's earnings; 'Exclusive' means it was added on top of the patient's bill." />
          </div>
          <Table>
            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              <TableRow>
                <TableCell className="text-gray-700 dark:text-gray-300 py-2">
                  Total fee (patient paid)
                </TableCell>
                <TableCell className="text-right font-medium text-gray-800 dark:text-white/90 py-2">
                  {fmtBDT(detail.breakdown.totalFee)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-gray-700 dark:text-gray-300 py-2">
                  Commission
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    {detail.breakdown.commission.percent}%{" "}
                    {detail.breakdown.commission.inclusive ? "(inclusive)" : "(exclusive)"}
                  </span>
                </TableCell>
                <TableCell className="text-right text-gray-800 dark:text-white/90 py-2">
                  − {fmtBDT(detail.breakdown.commission.amount)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-gray-700 dark:text-gray-300 py-2">
                  Tax
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    {detail.breakdown.tax.percent}%{" "}
                    {detail.breakdown.tax.inclusive ? "(inclusive)" : "(exclusive)"}
                  </span>
                </TableCell>
                <TableCell className="text-right text-gray-800 dark:text-white/90 py-2">
                  − {fmtBDT(detail.breakdown.tax.amount)}
                </TableCell>
              </TableRow>
              {detail.breakdown.ait ? (
                <TableRow>
                  <TableCell className="text-gray-700 dark:text-gray-300 py-2">
                    AIT
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      {detail.breakdown.ait.percent}% (withheld from provider)
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-gray-800 dark:text-white/90 py-2">
                    − {fmtBDT(detail.breakdown.ait.amount)}
                  </TableCell>
                </TableRow>
              ) : null}
              <TableRow>
                <TableCell className="font-medium text-emerald-700 dark:text-emerald-400 py-2">
                  Provider receives
                </TableCell>
                <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400 py-2">
                  {fmtBDT(detail.breakdown.providerFee)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : null}

      {/* Ledger trail */}
      {detail.ledgerEntries.length > 0 ? (
        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <div className="mb-3 flex items-center gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Ledger trail
            </p>
            <InfoTooltip text="Every accounting movement that this transaction caused. Each row is a transfer from one wallet to another (double-entry: debit one, credit the other by the same amount)." />
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[44rem]">
              <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                <TableRow>
                  <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      Debit (from)
                      <InfoTooltip text="The wallet that money was taken FROM. Shows the balance before and after the deduction." />
                    </span>
                  </TableCell>
                  <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      Credit (to)
                      <InfoTooltip text="The wallet that money was added TO. Shows the balance before and after the addition." />
                    </span>
                  </TableCell>
                  <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      Amount
                      <InfoTooltip text="The amount transferred. Same number is debited from one wallet and credited to the other (double-entry)." />
                    </span>
                  </TableCell>
                  <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      Description
                      <InfoTooltip text="Optional human-readable note about why this entry exists (e.g. 'Provider fee credit', 'Commission deduction')." align="end" />
                    </span>
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {detail.ledgerEntries.map((l) => (
                  <TableRow key={l.ledgerId}>
                    <TableCell className="py-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                          {l.debitWalletType}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {l.debitBalanceBefore != null
                            ? `${fmtBDT(l.debitBalanceBefore)} → ${fmtBDT(l.debitBalanceAfter)}`
                            : `→ ${fmtBDT(l.debitBalanceAfter)}`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                          {l.creditWalletType}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {l.creditBalanceBefore != null
                            ? `${fmtBDT(l.creditBalanceBefore)} → ${fmtBDT(l.creditBalanceAfter)}`
                            : `→ ${fmtBDT(l.creditBalanceAfter)}`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-gray-800 dark:text-white/90 py-2">
                      {fmtBDT(l.amount)}
                    </TableCell>
                    <TableCell className="text-gray-600 dark:text-gray-400 py-2">
                      {l.description ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
