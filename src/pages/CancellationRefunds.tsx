import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { SearchableSelect } from "../components/form/SearchableSelect";
import ThemedSelect from "../components/form/ThemedSelect";
import { DateRangePicker, type DateRangePickerValue } from "../components/ui/date-range-picker";
import Badge from "../components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  adminCancellationApi,
  patientsApi,
  type AdminRefundTxStatus,
  type CancellationRefundQueueResponse,
  type CancellationRefundQueueRow,
  type PatientListItem,
} from "../services/api";
import { formatDateTime, formatStatusLabel, toBangladeshISODateOptional } from "../utils/format";
import { fmtBDT } from "./financial/shared";

type StatusFilter = "all" | AdminRefundTxStatus;
type PaymentFilter = "all" | "ONLINE" | "CASH";

const STATUS_OPTIONS: StatusFilter[] = ["all", "PENDING", "COMPLETED", "FAILED", "CANCELLED"];
const PAYMENT_OPTIONS: PaymentFilter[] = ["all", "ONLINE", "CASH"];
const LIMIT_OPTIONS = [25, 50, 100];

function refundStatusBadgeColor(status: string): "success" | "error" | "warning" | "light" {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "FAILED":
    case "CANCELLED":
      return "error";
    default:
      return "warning";
  }
}

export default function CancellationRefunds() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<CancellationRefundQueueRow[]>([]);
  const [summary, setSummary] = useState<CancellationRefundQueueResponse["summary"] | null>(null);
  const [pagination, setPagination] = useState<CancellationRefundQueueResponse["pagination"] | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [reconcileBusy, setReconcileBusy] = useState(false);
  const [reconcileBanner, setReconcileBanner] = useState<{ kind: "success" | "error"; text: string } | null>(
    null
  );

  const [dateRange, setDateRange] = useState<DateRangePickerValue>({
    startDate: null,
    endDate: null,
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [patientId, setPatientId] = useState<number | "">("");
  const [limit, setLimit] = useState(25);
  const [includeSummary, setIncludeSummary] = useState(false);
  const [includeTotal, setIncludeTotal] = useState(false);

  const startDateParam = useMemo(
    () => toBangladeshISODateOptional(dateRange.startDate),
    [dateRange.startDate]
  );
  const endDateParam = useMemo(
    () => toBangladeshISODateOptional(dateRange.endDate),
    [dateRange.endDate]
  );

  const patientIdParsed = patientId === "" ? undefined : Number(patientId);

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

  const baseQuery = useMemo(
    () => ({
      startDate: startDateParam,
      endDate: endDateParam,
      status: statusFilter === "all" ? undefined : statusFilter,
      paymentMethod: paymentFilter === "all" ? undefined : paymentFilter,
      patientId: patientIdParsed,
      limit,
      includeSummary,
      includeTotal,
    }),
    [
      endDateParam,
      includeSummary,
      includeTotal,
      limit,
      patientIdParsed,
      paymentFilter,
      startDateParam,
      statusFilter,
    ]
  );

  const fetchFirstPage = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      setReconcileBanner(null);
      try {
        const res = await adminCancellationApi.listRefundsQueue(
          { ...baseQuery, page: 1 },
          { signal }
        );
        const payload = (res as { data?: CancellationRefundQueueResponse }).data ?? res;
        const body = payload as CancellationRefundQueueResponse;
        setRows(Array.isArray(body.data) ? body.data : []);
        setSummary(body.summary ?? null);
        setPagination(body.pagination ?? null);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : t("cancellationRefunds.failedToLoad");
        setError(message);
        setRows([]);
        setSummary(null);
        setPagination(null);
      } finally {
        setLoading(false);
      }
    },
    [baseQuery, t]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchFirstPage(controller.signal);
    return () => controller.abort();
  }, [fetchFirstPage]);

  const loadMore = async () => {
    const cursor = pagination?.nextCursor;
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const res = await adminCancellationApi.listRefundsQueue({
        ...baseQuery,
        cursor,
      });
      const payload = (res as { data?: CancellationRefundQueueResponse }).data ?? res;
      const body = payload as CancellationRefundQueueResponse;
      setRows((prev) => [...prev, ...(Array.isArray(body.data) ? body.data : [])]);
      setSummary(body.summary ?? null);
      setPagination(body.pagination ?? null);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("cancellationRefunds.failedToLoad");
      setError(message);
    } finally {
      setLoadingMore(false);
    }
  };

  const runReconcile = async () => {
    setReconcileBusy(true);
    setReconcileBanner(null);
    try {
      const res = await adminCancellationApi.reconcileRefunds();
      const data = (res as { data?: typeof res.data }).data ?? res;
      const r = data as {
        scanned?: number;
        settled?: number;
        failed?: number;
        pending?: number;
        escalated?: number;
      };
      setReconcileBanner({
        kind: "success",
        text: t("cancellationRefunds.reconcileDone", {
          scanned: r.scanned ?? 0,
          settled: r.settled ?? 0,
          failed: r.failed ?? 0,
          pending: r.pending ?? 0,
          escalated: r.escalated ?? 0,
        }),
      });
      await fetchFirstPage();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("cancellationRefunds.reconcileFailed");
      setReconcileBanner({ kind: "error", text: message });
    } finally {
      setReconcileBusy(false);
    }
  };

  const counts = summary?.counts;
  const windowLabel =
    summary?.window?.start && summary?.window?.end
      ? `${formatDateTime(summary.window.start)} → ${formatDateTime(summary.window.end)}`
      : "";

  return (
    <>
      <PageMeta title={t("cancellationRefunds.metaTitle")} description={t("cancellationRefunds.metaDescription")} />
      <PageBreadcrumb pageTitle={t("cancellationRefunds.pageTitle")} />

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {t("cancellationRefunds.heading")}
            </h3>
            <p className="mt-0.5 max-w-3xl text-xs text-gray-500 dark:text-gray-400">
              {t("cancellationRefunds.subheading")}
            </p>
            {windowLabel ? (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                {t("cancellationRefunds.effectiveWindow")}: {windowLabel}
                {summary?.window?.filteredBy ? (
                  <span className="ml-1 text-gray-400">({summary.window.filteredBy})</span>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fetchFirstPage()}
              disabled={loading}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {loading ? t("cancellationRefunds.refreshing") : t("cancellationRefunds.refresh")}
            </button>
            <button
              type="button"
              onClick={runReconcile}
              disabled={reconcileBusy || loading}
              className="rounded-lg border border-brand-500 bg-brand-500 px-3 py-1.5 text-sm text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reconcileBusy ? t("cancellationRefunds.reconciling") : t("cancellationRefunds.runReconcile")}
            </button>
          </div>
        </div>

        {reconcileBanner ? (
          <p
            className={`mb-4 rounded-lg px-3 py-2 text-sm ${
              reconcileBanner.kind === "success"
                ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-100"
            }`}
          >
            {reconcileBanner.text}
          </p>
        ) : null}

        <div className="mb-4 space-y-4">
          {/* Primary filters: aligned grid, consistent control height */}
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
            <div className="min-w-0 sm:col-span-2 lg:col-span-4">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                {t("cancellationRefunds.dateRange")}
              </label>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                placeholder={t("cancellationRefunds.dateRangePlaceholder")}
              />
            </div>
            <div className="min-w-0 sm:col-span-1 lg:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                {t("cancellationRefunds.refundStatus")}
              </label>
              <ThemedSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full min-h-[42px]"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? t("cancellationRefunds.allStatuses") : formatStatusLabel(s)}
                  </option>
                ))}
              </ThemedSelect>
            </div>
            <div className="min-w-0 sm:col-span-1 lg:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                {t("cancellationRefunds.paymentMethod")}
              </label>
              <ThemedSelect
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
                className="w-full min-h-[42px]"
              >
                {PAYMENT_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p === "all" ? t("cancellationRefunds.allMethods") : p}
                  </option>
                ))}
              </ThemedSelect>
            </div>
            <div className="min-w-0 sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                {t("cancellationRefunds.patientFilter")}
              </label>
              <SearchableSelect<number>
                value={patientId === "" ? null : patientId}
                onChange={(v) => setPatientId(v == null ? "" : v)}
                placeholder={t("cancellationRefunds.allPatients")}
                clearLabel={t("cancellationRefunds.allPatients")}
                searchPlaceholder={t("cancellationRefunds.patientSearchPlaceholder")}
                className="min-h-[42px]"
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
            </div>
            <div className="min-w-0 sm:col-span-2 sm:max-w-[11rem] lg:col-span-1 lg:max-w-none">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                {t("cancellationRefunds.pageSize")}
              </label>
              <ThemedSelect
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full min-h-[42px]"
              >
                {LIMIT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </ThemedSelect>
            </div>
          </div>

          {/* Options: separate row so they don’t break the field grid */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={includeSummary}
                onChange={(e) => setIncludeSummary(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              {t("cancellationRefunds.includeSummary")}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={includeTotal}
                onChange={(e) => setIncludeTotal(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              {t("cancellationRefunds.includeTotal")}
            </label>
          </div>
        </div>

        {includeSummary && counts ? (
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div className="rounded-lg border border-gray-200 p-3 text-center dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400">{t("cancellationRefunds.countTotal")}</div>
              <div className="text-lg font-semibold">{counts.total}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 text-center dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400">{t("cancellationRefunds.countPending")}</div>
              <div className="text-lg font-semibold">{counts.pending}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 text-center dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400">{t("cancellationRefunds.countCompleted")}</div>
              <div className="text-lg font-semibold">{counts.completed}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 text-center dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400">{t("cancellationRefunds.countFailed")}</div>
              <div className="text-lg font-semibold">{counts.failed}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3 text-center dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400">{t("cancellationRefunds.countCancelled")}</div>
              <div className="text-lg font-semibold">{counts.cancelled}</div>
            </div>
          </div>
        ) : null}

        {pagination?.total != null ? (
          <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
            {t("cancellationRefunds.exactTotal", { total: pagination.total })}
          </p>
        ) : null}

        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : error ? (
          <p className="text-rose-600 dark:text-rose-400">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">{t("cancellationRefunds.noData")}</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200 dark:border-gray-700">
                    <TableCell isHeader className="whitespace-nowrap px-3 py-2 text-xs">
                      {t("cancellationRefunds.colCancelledAt")}
                    </TableCell>
                    <TableCell isHeader className="whitespace-nowrap px-3 py-2 text-xs">
                      {t("cancellationRefunds.colCancellation")}
                    </TableCell>
                    <TableCell isHeader className="whitespace-nowrap px-3 py-2 text-xs">
                      {t("cancellationRefunds.colServiceRequest")}
                    </TableCell>
                    <TableCell isHeader className="whitespace-nowrap px-3 py-2 text-xs">
                      {t("cancellationRefunds.colActor")}
                    </TableCell>
                    <TableCell isHeader className="whitespace-nowrap px-3 py-2 text-xs">
                      {t("cancellationRefunds.colRefundTx")}
                    </TableCell>
                    <TableCell isHeader className="whitespace-nowrap px-3 py-2 text-xs">
                      {t("cancellationRefunds.colAmount")}
                    </TableCell>
                    <TableCell isHeader className="whitespace-nowrap px-3 py-2 text-xs">
                      {t("cancellationRefunds.colPatient")}
                    </TableCell>
                    <TableCell isHeader className="whitespace-nowrap px-3 py-2 text-xs">
                      {t("cancellationRefunds.colGateway")}
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const c = row.cancellation;
                    const tx = row.refundTransaction;
                    return (
                      <TableRow key={`${c.id}-${tx.id}`} className="border-gray-100 dark:border-gray-800">
                        <TableCell className="whitespace-nowrap px-3 py-2 text-xs">
                          {formatDateTime(c.cancelledAt)}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs">
                          <div className="font-mono text-[11px]">#{c.id}</div>
                          <div className="text-gray-500">{formatStatusLabel(c.scope)}</div>
                          <div className="text-gray-500">{formatStatusLabel(c.refundMethod)}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-3 py-2 text-xs">
                          {c.serviceRequestId != null ? (
                            <Link
                              className="text-brand-600 hover:underline dark:text-brand-400"
                              to={`/schedule/${c.serviceRequestId}`}
                            >
                              #{c.serviceRequestId}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate px-3 py-2 text-xs" title={c.actorName ?? c.actor}>
                          <div>{c.actorName || formatStatusLabel(c.actor)}</div>
                          <div className="text-[11px] text-gray-500">{formatStatusLabel(c.stage)}</div>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs">
                          <div className="font-mono text-[11px]">#{tx.id}</div>
                          <Badge size="sm" color={refundStatusBadgeColor(tx.status)}>
                            {formatStatusLabel(tx.status)}
                          </Badge>
                          {tx.adminEscalated ? (
                            <span className="ml-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                              {t("cancellationRefunds.escalated")}
                            </span>
                          ) : null}
                          <div className="text-gray-500">{tx.paymentMethod}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-3 py-2 text-xs">{fmtBDT(tx.amount)}</TableCell>
                        <TableCell className="max-w-[120px] truncate px-3 py-2 text-xs" title={tx.patientName ?? ""}>
                          {tx.patientId != null ? (
                            <>
                              <span className="font-mono text-[11px]">p{tx.patientId}</span>
                              {tx.patientName ? <div className="truncate text-gray-600">{tx.patientName}</div> : null}
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate px-3 py-2 text-[11px]" title={tx.gatewayRefundRefId ?? ""}>
                          {tx.gatewayRefundRefId ?? "—"}
                          {tx.gatewayRefundStatus ? (
                            <div className="truncate text-gray-500">{tx.gatewayRefundStatus}</div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("cancellationRefunds.loadedRows", { count: rows.length })}
                {pagination?.hasMore ? ` · ${t("cancellationRefunds.moreAvailable")}` : ""}
              </p>
              {pagination?.hasMore ? (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  {loadingMore ? t("cancellationRefunds.loadingMore") : t("cancellationRefunds.loadMore")}
                </button>
              ) : null}
            </div>
          </>
        )}
      </section>
    </>
  );
}
