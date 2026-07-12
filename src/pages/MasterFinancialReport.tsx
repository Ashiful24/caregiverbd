import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { DetailModal } from "../components/common/DetailModal";
import { InfoTooltip } from "../components/common/InfoTooltip";
import { PaginatedSearchableSelect } from "../components/form/PaginatedSearchableSelect";
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
  type AdminProviderListResponse,
  type PatientsListResponse,
} from "../services/api";
import {
  bangladeshCalendarRangeToApiParams,
  formatDate,
  formatDateTime,
} from "../utils/format";
import {
  fmtBDT,
  KpiCard,
  TX_TYPES,
  TX_STATUSES,
  statusBadgeColor,
  toISODateLocal,
  DEFAULT_LIMIT,
  MAX_RANGE_DAYS,
} from "./financial/shared";

const PARTY_PAGE_SIZE = 10;

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function MasterFinancialReport() {
  const { t } = useTranslation();
  const M = "financialReports.master";

  // ── Financial report (combined: summary + paginated transactions) ─────────
  const [startDate, setStartDate] = useState(() => {
    const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return toISODateLocal(past);
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
    if (!startDate || !endDate) return t(`${M}.valDatesRequired`);
    const ymd = /^\d{4}-\d{2}-\d{2}$/;
    if (!ymd.test(startDate) || !ymd.test(endDate)) return t(`${M}.valInvalidFormat`);
    if (endDate < startDate) return t(`${M}.valEndBeforeStart`);
    const utcMidnight = (s: string) =>
      Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
    const diffDays = (utcMidnight(endDate) - utcMidnight(startDate)) / (24 * 60 * 60 * 1000);
    if (diffDays > MAX_RANGE_DAYS)
      return t(`${M}.valRangeExceeded`, { maxDays: MAX_RANGE_DAYS });
    return null;
  }, [startDate, endDate, t, M]);

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
        const { startDate: startApi, endDate: endApi } = bangladeshCalendarRangeToApiParams(
          startDate,
          endDate
        );
        const params = {
          startDate: startApi,
          endDate: endApi,
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
        setReportError(t(`${M}.errLoadReport`));
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
      t,
      M,
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

  // ── Provider / patient pickers (paginated + server search) ────────────────
  const fetchProviderPage = useCallback(
    async (
      params: { page: number; limit: number; search?: string },
      signal?: AbortSignal
    ) => {
      const res = await providersApi.getList(
        { page: params.page, limit: params.limit, search: params.search },
        { signal }
      );
      const data = (res?.data ?? res) as AdminProviderListResponse;
      const list = Array.isArray(data?.providers) ? data.providers : [];
      return {
        items: list.map((p: ProviderListItem) => {
          const name =
            p.providerName ||
            p.fullName ||
            [p.firstName, p.lastName].filter(Boolean).join(" ") ||
            t(`${M}.detail.providerFallback`, { id: p.id });
          return {
            value: p.id,
            label: name,
            hint: p.email ?? undefined,
          };
        }),
        total: data?.total ?? list.length,
      };
    },
    [t, M]
  );

  const fetchPatientPage = useCallback(
    async (
      params: { page: number; limit: number; search?: string },
      signal?: AbortSignal
    ) => {
      const res = await patientsApi.getList(
        { page: params.page, limit: params.limit, search: params.search },
        { signal }
      );
      const data = (res?.data ?? res) as PatientsListResponse;
      const list = Array.isArray(data?.patients) ? data.patients : [];
      return {
        items: list.map((p: PatientListItem) => {
          const name =
            [p.firstName, p.lastName].filter(Boolean).join(" ") ||
            t(`${M}.detail.patientFallback`, { id: p.id });
          return {
            value: p.id,
            label: name,
            hint: p.email ?? p.username ?? undefined,
          };
        }),
        total: data?.total ?? list.length,
      };
    },
    [t, M]
  );

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
      setDetailError(t(`${M}.errLoadDetail`));
    } finally {
      setDetailLoading(false);
    }
  }, [t, M]);

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

  const paymentsHint =
    totals == null
      ? ""
      : totals.consultationCount === 1
        ? t(`${M}.kpi.paymentsHint_one`, { count: totals.consultationCount })
        : t(`${M}.kpi.paymentsHint_other`, { count: totals.consultationCount });
  const processedHint =
    totals == null
      ? ""
      : totals.withdrawalCount === 1
        ? t(`${M}.kpi.processedHint_one`, { count: totals.withdrawalCount })
        : t(`${M}.kpi.processedHint_other`, { count: totals.withdrawalCount });

  return (
    <>
      <PageMeta
        title={t(`${M}.metaTitle`)}
        description={t(`${M}.metaDescription`)}
      />
      <PageBreadcrumb pageTitle={t(`${M}.pageTitle`)} />

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
                  {t(`${M}.pageTitle`)}
                </h3>
                {reportLoading ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                    {t(`${M}.loading`)}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {t(`${M}.subheading`, { maxDays: MAX_RANGE_DAYS })}
              </p>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              disabled={reportLoading}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {t(`${M}.resetFilters`)}
            </button>
          </div>

          {/* Two-row grid: row 1 dates + wide party pickers; row 2 transaction filters — avoids crushed SearchableSelects */}
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
            <label className="flex min-w-0 flex-col gap-1 sm:col-span-1 lg:col-span-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t(`${M}.filters.startDate`)}
                <InfoTooltip text={t(`${M}.filters.ttStartDate`, { maxDays: MAX_RANGE_DAYS })} />
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="min-h-[42px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 sm:col-span-1 lg:col-span-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t(`${M}.filters.endDate`)}
                <InfoTooltip text={t(`${M}.filters.ttEndDate`, { maxDays: MAX_RANGE_DAYS })} />
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="min-h-[42px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-4">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t(`${M}.filters.provider`)}
                <InfoTooltip text={t(`${M}.filters.ttProvider`)} />
              </span>
              <PaginatedSearchableSelect<number>
                value={providerId === "" ? null : providerId}
                onChange={(v) => setProviderId(v == null ? "" : v)}
                fetchPage={fetchProviderPage}
                pageSize={PARTY_PAGE_SIZE}
                placeholder={t(`${M}.filters.allProviders`)}
                clearLabel={t(`${M}.filters.allProviders`)}
                searchPlaceholder={t(`${M}.filters.searchByName`)}
                seeMoreLabel={t(`${M}.filters.seeMore`)}
                loadingLabel={t("systemConfig.loading")}
                loadingMoreLabel={t("common.actions.loadingMore")}
                noMatchesLabel={t(`${M}.filters.noMatches`)}
                className="min-h-[42px]"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-4">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t(`${M}.filters.patient`)}
                <InfoTooltip text={t(`${M}.filters.ttPatient`)} />
              </span>
              <PaginatedSearchableSelect<number>
                value={patientId === "" ? null : patientId}
                onChange={(v) => setPatientId(v == null ? "" : v)}
                fetchPage={fetchPatientPage}
                pageSize={PARTY_PAGE_SIZE}
                placeholder={t(`${M}.filters.allPatients`)}
                clearLabel={t(`${M}.filters.allPatients`)}
                searchPlaceholder={t(`${M}.filters.searchByName`)}
                seeMoreLabel={t(`${M}.filters.seeMore`)}
                loadingLabel={t("systemConfig.loading")}
                loadingMoreLabel={t("common.actions.loadingMore")}
                noMatchesLabel={t(`${M}.filters.noMatches`)}
                className="min-h-[42px]"
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 sm:col-span-1 lg:col-span-3">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t(`${M}.filters.type`)}
                <InfoTooltip text={t(`${M}.filters.ttType`)} />
              </span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as FinancialTxType | "")}
                className="min-h-[42px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="">{t(`${M}.filters.allTypes`)}</option>
                {TX_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(`${M}.txType.${opt.value}`, { defaultValue: opt.label })}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 sm:col-span-1 lg:col-span-3">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t(`${M}.filters.paymentMethod`)}
                <InfoTooltip text={t(`${M}.filters.ttPayment`)} />
              </span>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as FinancialPaymentMethod | "")
                }
                className="min-h-[42px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="">{t(`${M}.filters.allMethods`)}</option>
                <option value="ONLINE">{t(`${M}.filters.paymentOnline`)}</option>
                <option value="CASH">{t(`${M}.filters.paymentCash`)}</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 sm:col-span-1 lg:col-span-3">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t(`${M}.filters.service`)}
                <InfoTooltip text={t(`${M}.filters.ttService`)} />
              </span>
              <select
                value={serviceType}
                onChange={(e) =>
                  setServiceType(e.target.value as FinancialServiceType | "")
                }
                className="min-h-[42px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="">{t(`${M}.filters.allServices`)}</option>
                <option value="SHORT_TERM">{t(`${M}.filters.serviceShortTerm`)}</option>
                <option value="LONG_TERM">{t(`${M}.filters.serviceLongTerm`)}</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 sm:col-span-1 lg:col-span-3">
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                {t(`${M}.filters.status`)}
                <InfoTooltip text={t(`${M}.filters.ttStatus`)} align="end" />
              </span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FinancialTxStatus | "")}
                className="min-h-[42px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="">{t(`${M}.filters.allStatuses`)}</option>
                {TX_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {t(`${M}.txStatus.${s.value}`, { defaultValue: s.label })}
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
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <KpiCard
              label={t(`${M}.kpi.totalInflow`)}
              value={fmtBDT(totals.totalInflow)}
              hint={t(`${M}.kpi.inflowHint`, {
                online: fmtBDT(totals.onlinePayments),
                cash: fmtBDT(totals.cashPayments),
              })}
              tone="positive"
              tooltip={t(`${M}.kpi.totalInflowTt`)}
            />
            <KpiCard
              label={t(`${M}.kpi.providerEarningsAllocated`)}
              value={fmtBDT(totals.totalProviderEarningsAllocated)}
              hint={paymentsHint}
              tone="neutral"
              tooltip={t(`${M}.kpi.providerEarningsAllocatedTt`)}
            />
            <KpiCard
              label={t(`${M}.kpi.aitWithheld`)}
              value={fmtBDT(totals.totalAit ?? "0")}
              tone="neutral"
              tooltip={t(`${M}.kpi.aitWithheldTt`)}
            />
            <KpiCard
              label={t(`${M}.kpi.vat`)}
              value={fmtBDT(totals.totalVat ?? totals.totalTax ?? "0")}
              tone="neutral"
              tooltip={t(`${M}.kpi.vatTt`)}
            />
            <KpiCard
              label={t(`${M}.kpi.supervisorCommission`)}
              value={fmtBDT(totals.totalSupervisorCommission ?? "0")}
              tone="neutral"
              tooltip={t(`${M}.kpi.supervisorCommissionTt`)}
            />
            <KpiCard
              label={t(`${M}.kpi.platformEarnings`)}
              value={fmtBDT(totals.netPlatformEarnings)}
              hint={t(`${M}.kpi.earningsHint`, {
                commission: fmtBDT(totals.totalCommission),
              })}
              tone="positive"
              tooltip={t(`${M}.kpi.platformEarningsTt`)}
            />
            <KpiCard
              label={t(`${M}.kpi.withdrawals`)}
              value={fmtBDT(totals.totalWithdrawals)}
              hint={processedHint}
              tone="negative"
              tooltip={t(`${M}.kpi.withdrawalsTt`)}
            />
          </section>
        ) : null}

        {/* ─────────────────────────── DAILY FLOW TABLE ─────────────────────────── */}
        {report?.summary?.byDay && report.summary.byDay.length > 0 ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
              {t(`${M}.dailyFlow.title`)}
            </h3>
            <div className="overflow-x-auto">
              <Table className="min-w-[64rem]">
                <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                  <TableRow>
                    <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {t(`${M}.dailyFlow.colDate`)}
                        <InfoTooltip text={t(`${M}.dailyFlow.ttDate`)} />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {t(`${M}.dailyFlow.colOnline`)}
                        <InfoTooltip text={t(`${M}.dailyFlow.ttOnline`)} />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {t(`${M}.dailyFlow.colCash`)}
                        <InfoTooltip text={t(`${M}.dailyFlow.ttCash`)} />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-emerald-700 dark:text-emerald-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {t(`${M}.dailyFlow.colInflow`)}
                        <InfoTooltip text={t(`${M}.dailyFlow.ttInflow`)} />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {t(`${M}.dailyFlow.colToProviders`)}
                        <InfoTooltip text={t(`${M}.dailyFlow.ttToProviders`)} />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {t(`${M}.dailyFlow.colCommission`)}
                        <InfoTooltip text={t(`${M}.dailyFlow.ttCommission`)} />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {t(`${M}.dailyFlow.colTax`)}
                        <InfoTooltip text={t(`${M}.dailyFlow.ttTax`)} />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {t(`${M}.dailyFlow.colAit`)}
                        <InfoTooltip text={t(`${M}.dailyFlow.ttAit`)} />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-rose-700 dark:text-rose-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {t(`${M}.dailyFlow.colWithdrawals`)}
                        <InfoTooltip text={t(`${M}.dailyFlow.ttWithdrawals`)} />
                      </span>
                    </TableCell>
                    <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {t(`${M}.dailyFlow.txCount`)}
                        <InfoTooltip text={t(`${M}.dailyFlow.ttTxCount`)} align="end" />
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
                        {fmtBDT(d.distribution.providerEarningsAllocated)}
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
                {t(`${M}.txnList.title`)}
              </h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {t(`${M}.txnList.subtitle`)}
              </p>
            </div>
          </div>

          {reportLoading && txList.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : txList.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {t(`${M}.txnList.empty`)}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="min-w-[60rem]">
                  <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                    <TableRow>
                      <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          {t(`${M}.txnList.colDate`)}
                          <InfoTooltip text={t(`${M}.txnList.ttDate`)} />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          {t(`${M}.txnList.colType`)}
                          <InfoTooltip text={t(`${M}.txnList.ttType`)} />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          {t(`${M}.txnList.colParties`)}
                          <InfoTooltip text={t(`${M}.txnList.ttParties`)} />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          {t(`${M}.txnList.colService`)}
                          <InfoTooltip text={t(`${M}.txnList.ttService`)} />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          {t(`${M}.txnList.colTotal`)}
                          <InfoTooltip text={t(`${M}.txnList.ttTotal`)} />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          {t(`${M}.txnList.colTax`)}
                          <InfoTooltip text={t(`${M}.txnList.ttTax`)} />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          {t(`${M}.txnList.colSupervisorComm`)}
                          <InfoTooltip text={t(`${M}.txnList.ttSupervisorComm`)} />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          {t(`${M}.txnList.colComm`)}
                          <InfoTooltip text={t(`${M}.txnList.ttCommission`)} />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          {t(`${M}.txnList.colAit`)}
                          <InfoTooltip text={t(`${M}.txnList.ttAit`)} />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          {t(`${M}.txnList.colProvider`)}
                          <InfoTooltip text={t(`${M}.txnList.ttProviderNet`)} />
                        </span>
                      </TableCell>
                      <TableCell isHeader className="text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          {t(`${M}.txnList.colStatus`)}
                          <InfoTooltip text={t(`${M}.txnList.ttStatus`)} align="end" />
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {txList.map((row: FinancialReportTxItemDto) => {
                      const isEscrow = row.isEscrow;
                      return (
                      <TableRow
                        key={row.transactionId}
                        onClick={() => openDetail(row.transactionId)}
                        className={`cursor-pointer ${isEscrow ? 'bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100/70 dark:hover:bg-amber-900/20' : 'hover:bg-gray-50 dark:hover:bg-white/[0.02]'}`}
                      >
                        <TableCell className="text-gray-700 dark:text-gray-300 py-2.5">
                          {formatDateTime(row.date)}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                              {t(`${M}.txType.${row.type}`, { defaultValue: row.type })}
                            </span>
                            {row.paymentMethod ? (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {row.paymentMethod === "ONLINE"
                                  ? t(`${M}.filters.paymentOnline`)
                                  : row.paymentMethod === "CASH"
                                    ? t(`${M}.filters.paymentCash`)
                                    : row.paymentMethod}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-800 dark:text-white/90">
                              {row.patientName ?? "—"}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              → {row.providerName ?? "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-800 dark:text-white/90">
                              {row.consultationTypeName ?? "—"}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {row.serviceType === "SHORT_TERM"
                                ? t(`${M}.filters.serviceShortTerm`)
                                : row.serviceType === "LONG_TERM"
                                  ? t(`${M}.filters.serviceLongTerm`)
                                  : (row.serviceType ?? "")}
                              {row.scheduledDate ? ` · ${formatDate(row.scheduledDate)}` : ""}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-gray-800 dark:text-white/90 py-2.5">
                          {fmtBDT(row.totalFee)}
                        </TableCell>
                        <TableCell className="text-right text-gray-600 dark:text-gray-400 py-2.5">
                          {fmtBDT(row.tax)}
                        </TableCell>
                        <TableCell className="text-right text-gray-600 dark:text-gray-400 py-2.5">
                          {fmtBDT(row.supervisorCommission)}
                        </TableCell>
                        <TableCell className="text-right text-gray-600 dark:text-gray-400 py-2.5">
                          {fmtBDT(row.commission)}
                        </TableCell>
                        <TableCell className="text-right text-gray-600 dark:text-gray-400 py-2.5">
                          {fmtBDT(row.ait)}
                        </TableCell>
                        <TableCell className="text-right text-gray-700 dark:text-gray-300 py-2.5">
                          {fmtBDT(row.providerFee)}
                        </TableCell>
                        <TableCell className="text-center py-2.5">
                          <span title={isEscrow ? t(`${M}.txStatus.escrowHint`) : undefined}>
                            <Badge color={isEscrow ? "warning" : statusBadgeColor(row.status)} size="sm">
                              {t(`${M}.txStatus.${row.status}`, { defaultValue: row.status })}
                            </Badge>
                          </span>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t(`${M}.txnList.paginationPage`, { page })}
                  {pagination?.total != null ? (
                    <>{" "}{t(`${M}.txnList.paginationTotal`, { total: pagination.total })}</>
                  ) : null}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="min-h-[40px] rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    disabled={page <= 1 || reportLoading}
                    onClick={() => goToPage(page - 1)}
                  >
                    {t(`${M}.txnList.prev`)}
                  </button>
                  <button
                    type="button"
                    className="min-h-[40px] rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    disabled={!hasMore || reportLoading}
                    onClick={() => goToPage(page + 1)}
                  >
                    {t(`${M}.txnList.next`)}
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
        title={t(`${M}.detailModal.title`)}
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
  const { t } = useTranslation();
  const M = "financialReports.master";

  return (
    <div className="space-y-5">
      {/* Header strip — amount lives here too, no separate card. */}
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-2xl font-semibold text-gray-900 dark:text-white">
          {fmtBDT(detail.amount)}
        </span>
        <Badge color={statusBadgeColor(detail.status)}>
          {t(`${M}.txStatus.${detail.status}`, { defaultValue: detail.status })}
        </Badge>
        <Badge color="info">{t(`${M}.txType.${detail.type}`, { defaultValue: detail.type })}</Badge>
        {detail.paymentMethod ? (
          <Badge color="light">
            {detail.paymentMethod === "ONLINE"
              ? t(`${M}.filters.paymentOnline`)
              : detail.paymentMethod === "CASH"
                ? t(`${M}.filters.paymentCash`)
                : detail.paymentMethod}
          </Badge>
        ) : null}
        <span className="text-sm text-gray-500 dark:text-gray-400">
          #{detail.transactionId} · {formatDateTime(detail.createdAt)}
        </span>
      </div>

      {/* Parties */}
      <div className="grid gap-4 sm:grid-cols-2">
        {detail.patient ? (
          <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <div className="mb-2 flex items-center gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t(`${M}.detail.patient`)}
              </p>
              <InfoTooltip text={t(`${M}.detail.ttPatientBrief`)} />
            </div>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {detail.patient.name ??
                t(`${M}.detail.patientFallback`, { id: detail.patient.id })}
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
                {t(`${M}.detail.provider`)}
              </p>
              <InfoTooltip text={t(`${M}.detail.ttProviderBrief`)} />
            </div>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {detail.provider.name ??
                t(`${M}.detail.providerFallback`, { id: detail.provider.id })}
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
              {t(`${M}.detail.serviceRequest`)}
            </p>
            <InfoTooltip text={t(`${M}.detail.ttServiceRequestBrief`)} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <div className="flex items-center gap-1">
                <p className="text-gray-500 dark:text-gray-400">{t(`${M}.detail.fldId`)}</p>
                <InfoTooltip text={t(`${M}.detail.ttFldId`)} />
              </div>
              <p className="font-medium text-gray-800 dark:text-white/90">
                #{detail.serviceRequest.id}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-gray-500 dark:text-gray-400">{t(`${M}.detail.fldType`)}</p>
                <InfoTooltip text={t(`${M}.detail.ttFldType`)} />
              </div>
              <p className="font-medium text-gray-800 dark:text-white/90">
                {detail.serviceRequest.referenceType ?? "—"}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-gray-500 dark:text-gray-400">{t(`${M}.detail.fldStatus`)}</p>
                <InfoTooltip text={t(`${M}.detail.ttFldStatus`)} />
              </div>
              <p className="font-medium text-gray-800 dark:text-white/90">
                {detail.serviceRequest.status}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-gray-500 dark:text-gray-400">{t(`${M}.detail.fldScheduled`)}</p>
                <InfoTooltip text={t(`${M}.detail.ttFldScheduled`)} />
              </div>
              <p className="font-medium text-gray-800 dark:text-white/90">
                {detail.serviceRequest.scheduledDate
                  ? formatDate(detail.serviceRequest.scheduledDate)
                  : "—"}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-gray-500 dark:text-gray-400">{t(`${M}.detail.fldRate`)}</p>
                <InfoTooltip text={t(`${M}.detail.ttFldRate`)} />
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
                <p className="text-gray-500 dark:text-gray-400">{t(`${M}.detail.fldShiftDur`)}</p>
                <InfoTooltip text={t(`${M}.detail.ttFldShiftDur`)} />
              </div>
              <p className="font-medium text-gray-800 dark:text-white/90">
                {detail.serviceRequest.shiftDuration ?? "—"} h
              </p>
            </div>
            {detail.serviceRequest.longTermOpportunityId ? (
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 dark:text-gray-400">{t(`${M}.detail.fldOpportunity`)}</p>
                  <InfoTooltip text={t(`${M}.detail.ttFldOpportunity`)} />
                </div>
                <p className="font-medium text-gray-800 dark:text-white/90">
                  #{detail.serviceRequest.longTermOpportunityId}
                </p>
              </div>
            ) : null}
            {detail.consultationTypeName ? (
              <div>
                <div className="flex items-center gap-1">
                  <p className="text-gray-500 dark:text-gray-400">{t(`${M}.detail.fldConsultation`)}</p>
                  <InfoTooltip text={t(`${M}.detail.ttFldConsultation`)} />
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
      {detail.breakdown ? (() => {
        // Realized state: the fee was actually deducted only after the service
        // was COMPLETED (or for CASH which settles at completion). Otherwise
        // the money is still held in SERVICE_HOLD_GL and the breakdown below
        // shows the PLANNED split, not what's been collected.
        const isCompleted = detail.serviceRequest?.status === "COMPLETED";
        const heldInEscrow =
          !isCompleted &&
          detail.type === "CONSULTATION_PAYMENT" &&
          detail.status === "COMPLETED"; // payment received but service not yet done
        return (
        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <div className="mb-3 flex items-center gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t(`${M}.detail.feeBreakdown`)}
            </p>
            <InfoTooltip text={t(`${M}.detail.ttFeeBreakdown`)} />
          </div>

          {/* Status banner — makes "planned vs realized" obvious */}
          {heldInEscrow ? (
            <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <span className="font-medium">⏳ {t(`${M}.detail.escrowBanner`)}</span>{" "}
              {t(`${M}.detail.escrowBannerHint`)}
            </div>
          ) : isCompleted ? (
            <div className="mb-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
              <span className="font-medium">✓ {t(`${M}.detail.realizedBanner`)}</span>{" "}
              {t(`${M}.detail.realizedBannerHint`)}
            </div>
          ) : null}
          <Table>
            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {/* Row 1: Total fee */}
              <TableRow>
                <TableCell className="text-gray-700 dark:text-gray-300 py-2">
                  {t(`${M}.detail.rowTotalFee`)}
                </TableCell>
                <TableCell className="text-right font-medium text-gray-800 dark:text-white/90 py-2">
                  {fmtBDT(detail.breakdown.totalFee)}
                </TableCell>
              </TableRow>
              {/* Row 2: VAT (first deduction) */}
              <TableRow>
                <TableCell className="text-gray-700 dark:text-gray-300 py-2">
                  {t(`${M}.detail.rowTax`)}
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    {detail.breakdown.tax.percent}%{" "}
                    {detail.breakdown.tax.inclusive
                      ? t(`${M}.detail.inclusive`)
                      : t(`${M}.detail.exclusive`)}
                  </span>
                </TableCell>
                <TableCell className="text-right text-gray-800 dark:text-white/90 py-2">
                  − {fmtBDT(detail.breakdown.tax.amount)}
                </TableCell>
              </TableRow>
              {/* Row 3: Supervisor commission (second deduction — always shown as part of the flow) */}
              <TableRow>
                <TableCell className="text-gray-700 dark:text-gray-300 py-2">
                  {t(`${M}.detail.rowSupervisorCommission`)}
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    {detail.breakdown.supervisorCommission.percent}%{" "}
                    {t(`${M}.detail.supervisorCommissionSuffix`)}
                  </span>
                </TableCell>
                <TableCell className="text-right text-gray-800 dark:text-white/90 py-2">
                  − {fmtBDT(detail.breakdown.supervisorCommission.amount)}
                </TableCell>
              </TableRow>
              {/* Row 4: Platform commission (third deduction) */}
              <TableRow>
                <TableCell className="text-gray-700 dark:text-gray-300 py-2">
                  {t(`${M}.detail.rowCommission`)}
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    {detail.breakdown.commission.percent}%{" "}
                    {detail.breakdown.commission.inclusive
                      ? t(`${M}.detail.inclusive`)
                      : t(`${M}.detail.exclusive`)}
                  </span>
                </TableCell>
                <TableCell className="text-right text-gray-800 dark:text-white/90 py-2">
                  − {fmtBDT(detail.breakdown.commission.amount)}
                </TableCell>
              </TableRow>
              {/* Row 5: AIT (fourth deduction) */}
              {detail.breakdown.ait &&
               parseFloat(detail.breakdown.ait.amount) > 0 ? (
                <TableRow>
                  <TableCell className="text-gray-700 dark:text-gray-300 py-2">
                    {t(`${M}.detail.rowAit`)}
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      {detail.breakdown.ait.percent}% {t(`${M}.detail.aitWithheldSuffix`)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-gray-800 dark:text-white/90 py-2">
                    − {fmtBDT(detail.breakdown.ait.amount)}
                  </TableCell>
                </TableRow>
              ) : null}
              {/* Row 6: Provider net */}
              <TableRow>
                <TableCell className="font-medium text-emerald-700 dark:text-emerald-400 py-2">
                  {heldInEscrow
                    ? t(`${M}.detail.providerWillReceive`)
                    : t(`${M}.detail.providerReceives`)}
                </TableCell>
                <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400 py-2">
                  {fmtBDT(detail.breakdown.providerFee)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        );
      })() : null}

      {/* Ledger trail */}
      {detail.ledgerEntries.length > 0 ? (
        <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
          <div className="mb-3 flex items-center gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t(`${M}.detail.ledgerTrail`)}
            </p>
            <InfoTooltip text={t(`${M}.detail.ttLedgerTrail`)} />
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[44rem]">
              <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                <TableRow>
                  <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {t(`${M}.detail.colDebit`)}
                      <InfoTooltip text={t(`${M}.detail.ttDebit`)} />
                    </span>
                  </TableCell>
                  <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {t(`${M}.detail.colCredit`)}
                      <InfoTooltip text={t(`${M}.detail.ttCredit`)} />
                    </span>
                  </TableCell>
                  <TableCell isHeader className="text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {t(`${M}.detail.colAmount`)}
                      <InfoTooltip text={t(`${M}.detail.ttLedgerAmount`)} />
                    </span>
                  </TableCell>
                  <TableCell isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {t(`${M}.detail.colDescription`)}
                      <InfoTooltip text={t(`${M}.detail.ttDescription`)} align="end" />
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
