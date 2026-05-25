import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Coins,
  Download,
  FileSpreadsheet,
  HandCoins,
  Hourglass,
  Percent,
  PiggyBank,
  RefreshCw,
  Repeat,
  Timer,
  TrendingUp,
  Undo2,
  Wallet,
} from "lucide-react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import ThemedSelect from "../components/form/ThemedSelect";
import {
  DateRangePicker,
  type DateRangePickerValue,
} from "../components/ui/date-range-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { toBangladeshISODate } from "../utils/format";
import {
  reportingApi,
  type ReportingDailyBreakdownResponse,
  type ReportingDailyBreakdownRow,
  type ReportingSummaryDto,
} from "../services/api";

// ── KPI cards driven by GET /v1/reporting/summary ─────────────────────────────

type MetricCardConfig = {
  labelKey: string;
  descKey?: string;
  value: string;
  icon: React.ReactNode;
  bgClass: string;
  iconBgClass: string;
};

function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("en-US");
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const n = Number(value);
  return `${n.toLocaleString("en-US", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  })}%`;
}

function formatBdtCompact(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `BDT ${n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function buildMetrics(
  summary: ReportingSummaryDto | null,
): { row1: MetricCardConfig[]; row2: MetricCardConfig[]; row3: MetricCardConfig[] } {
  const s = summary;

  const row1: MetricCardConfig[] = [
    {
      labelKey: "adminSupervisorReporting.kpi.totalRequests",
      descKey: "adminSupervisorReporting.kpi.totalRequestsDesc",
      value: formatCount(s?.totalRequests),
      icon: <ClipboardList className="size-5" />,
      bgClass: "bg-emerald-50/80 dark:bg-emerald-500/10",
      iconBgClass:
        "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
    },
    {
      labelKey: "adminSupervisorReporting.kpi.confirmedBookings",
      descKey: "adminSupervisorReporting.kpi.confirmedBookingsDesc",
      value: formatCount(s?.confirmedBookings),
      icon: <CheckCircle2 className="size-5" />,
      bgClass: "bg-sky-50/80 dark:bg-sky-500/10",
      iconBgClass: "bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400",
    },
    {
      labelKey: "adminSupervisorReporting.kpi.completedServices",
      descKey: "adminSupervisorReporting.kpi.completedServicesDesc",
      value: formatCount(s?.completedServices),
      icon: <TrendingUp className="size-5" />,
      bgClass: "bg-violet-50/80 dark:bg-violet-500/10",
      iconBgClass:
        "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400",
    },
    {
      labelKey: "adminSupervisorReporting.kpi.fulfillmentRate",
      descKey: "adminSupervisorReporting.kpi.fulfillmentRateDesc",
      value: formatPercent(s?.fulfillmentRate),
      icon: <Percent className="size-5" />,
      bgClass: "bg-amber-50/80 dark:bg-amber-500/10",
      iconBgClass:
        "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    },
  ];

  const row2: MetricCardConfig[] = [
    {
      labelKey: "adminSupervisorReporting.kpi.acceptanceRate",
      descKey: "adminSupervisorReporting.kpi.acceptanceRateDesc",
      value: formatPercent(s?.acceptanceRate),
      icon: <Hourglass className="size-5" />,
      bgClass: "bg-indigo-50/80 dark:bg-indigo-500/10",
      iconBgClass:
        "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400",
    },
    {
      labelKey: "adminSupervisorReporting.kpi.paymentExpiryRate",
      descKey: "adminSupervisorReporting.kpi.paymentExpiryRateDesc",
      value: formatPercent(s?.paymentExpiryRate),
      icon: <Timer className="size-5" />,
      bgClass: "bg-rose-50/80 dark:bg-rose-500/10",
      iconBgClass: "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400",
    },
    {
      labelKey: "adminSupervisorReporting.kpi.cancellationRate",
      descKey: "adminSupervisorReporting.kpi.cancellationRateDesc",
      value: formatPercent(s?.cancellationRate),
      icon: <Repeat className="size-5" />,
      bgClass: "bg-orange-50/80 dark:bg-orange-500/10",
      iconBgClass:
        "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400",
    },
    {
      labelKey: "adminSupervisorReporting.kpi.refundAmount",
      descKey: "adminSupervisorReporting.kpi.refundAmountDesc",
      value: formatBdtCompact(s?.refundAmount),
      icon: <Undo2 className="size-5" />,
      bgClass: "bg-pink-50/80 dark:bg-pink-500/10",
      iconBgClass: "bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400",
    },
  ];

  const row3: MetricCardConfig[] = [
    {
      labelKey: "adminSupervisorReporting.kpi.grossRevenue",
      descKey: "adminSupervisorReporting.kpi.grossRevenueDesc",
      value: formatBdtCompact(s?.grossRevenue),
      icon: <Wallet className="size-5" />,
      bgClass: "bg-emerald-50/80 dark:bg-emerald-500/10",
      iconBgClass:
        "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
    },
    {
      labelKey: "adminSupervisorReporting.kpi.ontorCommission",
      descKey: "adminSupervisorReporting.kpi.ontorCommissionDesc",
      value: formatBdtCompact(s?.ontorCommission),
      icon: <Coins className="size-5" />,
      bgClass: "bg-yellow-50/80 dark:bg-yellow-500/10",
      iconBgClass:
        "bg-yellow-100 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400",
    },
    {
      labelKey: "adminSupervisorReporting.kpi.providerPayout",
      descKey: "adminSupervisorReporting.kpi.providerPayoutDesc",
      value: formatBdtCompact(s?.providerPayout),
      icon: <HandCoins className="size-5" />,
      bgClass: "bg-cyan-50/80 dark:bg-cyan-500/10",
      iconBgClass: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400",
    },
    {
      labelKey: "adminSupervisorReporting.kpi.pendingPayout",
      descKey: "adminSupervisorReporting.kpi.pendingPayoutDesc",
      value: formatBdtCompact(s?.pendingPayout),
      icon: <PiggyBank className="size-5" />,
      bgClass: "bg-blue-50/80 dark:bg-blue-500/10",
      iconBgClass: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
    },
  ];

  return { row1, row2, row3 };
}

// ── Data table — driven by GET /v1/reporting/daily-breakdown ──────────────────

/** Normalized row shape consumed by the table UI. */
type BreakdownTableRow = {
  date: string;
  rawDate: string;
  totalRequests: number | null;
  confirmedBookings: number | null;
  completedServices: number | null;
  fulfillmentRate: number | null;
  acceptanceRate: number | null;
  grossRevenue: number | null;
};

const LIMIT_OPTIONS = [5, 10, 20];
/**
 * Rows requested per server page. Server pagination is cursor-based; we follow
 * `nextCursor` until exhausted (or the safety cap below) and then paginate on
 * the client over the merged set.
 */
const API_PAGE_SIZE = 100;
/** Max cursor follow-ups to prevent infinite loops on misbehaving cursors. */
const MAX_CURSOR_PAGES = 20;

function toNumberOrNull(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Format an ISO date (or YYYY-MM-DD) as e.g. "06 May 2025". Returns input on parse failure. */
function formatRowDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return format(d, "dd MMM yyyy");
}

function normalizeBreakdownRow(r: ReportingDailyBreakdownRow): BreakdownTableRow {
  return {
    date: formatRowDate(r.date),
    rawDate: r.date,
    totalRequests: toNumberOrNull(r.totalRequests),
    confirmedBookings: toNumberOrNull(r.confirmedBookings),
    completedServices: toNumberOrNull(r.completedServices),
    fulfillmentRate: toNumberOrNull(r.fulfillmentRate),
    acceptanceRate: toNumberOrNull(r.acceptanceRate),
    grossRevenue: toNumberOrNull(r.grossRevenue),
  };
}

function sumOrNull(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return nums.reduce((acc, v) => acc + v, 0);
}

function avgOrNull(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return nums.reduce((acc, v) => acc + v, 0) / nums.length;
}

function computeTableTotals(rows: BreakdownTableRow[]) {
  return {
    totalRequests: sumOrNull(rows.map((r) => r.totalRequests)),
    confirmedBookings: sumOrNull(rows.map((r) => r.confirmedBookings)),
    completedServices: sumOrNull(rows.map((r) => r.completedServices)),
    fulfillmentRate: avgOrNull(rows.map((r) => r.fulfillmentRate)),
    acceptanceRate: avgOrNull(rows.map((r) => r.acceptanceRate)),
    grossRevenue: sumOrNull(rows.map((r) => r.grossRevenue)),
  };
}

/** Empty range — no date filter applied. APIs are called without startDate/endDate. */
const EMPTY_RANGE: DateRangePickerValue = { startDate: null, endDate: null };

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({
  config,
  loading,
}: {
  config: MetricCardConfig;
  loading: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-gray-200/80 p-4 shadow-sm dark:border-gray-800",
        config.bgClass,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-xl",
            config.iconBgClass,
          )}
        >
          {config.icon}
        </span>
      </div>
      <p className="mt-3 text-xs font-medium text-gray-600 dark:text-gray-400">
        {t(config.labelKey)}
      </p>
      {config.descKey ? (
        <p className="mt-0.5 text-[10px] leading-tight text-gray-500 dark:text-gray-500">
          {t(config.descKey)}
        </p>
      ) : null}
      {loading ? (
        <div
          className="mt-3 h-7 w-20 animate-pulse rounded-md bg-gray-200/80 dark:bg-gray-700/60"
          aria-label="Loading"
        />
      ) : (
        <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white/95 sm:text-[1.65rem]">
          {config.value}
        </p>
      )}
    </div>
  );
}

function MetricsGrid({
  metrics,
  loading,
}: {
  metrics: MetricCardConfig[];
  loading: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((m) => (
        <MetricCard key={m.labelKey} config={m} loading={loading} />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminSupervisorReporting() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const R = "adminSupervisorReporting";

  const currentRole = String(user?.role ?? "").toUpperCase();
  const supervisorId =
    currentRole === "SUPERVISOR" &&
    Number.isFinite(Number(user?.id)) &&
    Number(user?.id) > 0
      ? Number(user?.id)
      : undefined;

  const [dateRange, setDateRange] = useState<DateRangePickerValue>(EMPTY_RANGE);
  const [appliedRange, setAppliedRange] = useState<DateRangePickerValue>(EMPTY_RANGE);
  const [lastUpdated, setLastUpdated] = useState(() => format(new Date(), "h:mm a"));
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);

  const [summary, setSummary] = useState<ReportingSummaryDto | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const fetchSeq = useRef(0);

  const [breakdownRows, setBreakdownRows] = useState<BreakdownTableRow[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState("");
  const breakdownFetchSeq = useRef(0);

  const totalEntries = breakdownRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / limit));
  const from = totalEntries === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, totalEntries);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * limit;
    return breakdownRows.slice(start, start + limit);
  }, [page, limit, breakdownRows]);

  const totals = useMemo(() => computeTableTotals(breakdownRows), [breakdownRows]);

  const { row1, row2, row3 } = useMemo(() => buildMetrics(summary), [summary]);

  const fetchSummary = useCallback(
    async (range: DateRangePickerValue, signal?: AbortSignal) => {
      const seq = ++fetchSeq.current;
      setSummaryLoading(true);
      setSummaryError("");
      try {
        const params: Parameters<typeof reportingApi.getSummary>[0] = {};
        if (range.startDate) params.startDate = toBangladeshISODate(range.startDate);
        if (range.endDate) params.endDate = toBangladeshISODate(range.endDate);
        if (supervisorId != null) params.supervisorId = supervisorId;

        const res = await reportingApi.getSummary(params, { signal });
        if (seq !== fetchSeq.current) return;
        const data = (res?.data ?? res) as ReportingSummaryDto;
        setSummary(data ?? null);
        setLastUpdated(format(new Date(), "h:mm a"));
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (seq !== fetchSeq.current) return;
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : t(`${R}.loadError`);
        setSummaryError(message);
        setSummary(null);
      } finally {
        if (seq === fetchSeq.current) setSummaryLoading(false);
      }
    },
    [supervisorId, t],
  );

  const fetchBreakdown = useCallback(
    async (range: DateRangePickerValue, signal?: AbortSignal) => {
      const seq = ++breakdownFetchSeq.current;
      setBreakdownLoading(true);
      setBreakdownError("");
      try {
        const baseParams: Parameters<typeof reportingApi.getDailyBreakdown>[0] = {
          limit: API_PAGE_SIZE,
        };
        if (range.startDate) baseParams.startDate = toBangladeshISODate(range.startDate);
        if (range.endDate) baseParams.endDate = toBangladeshISODate(range.endDate);
        if (supervisorId != null) baseParams.supervisorId = supervisorId;

        const collected: BreakdownTableRow[] = [];
        let cursor: string | undefined;
        let pagesFetched = 0;
        while (pagesFetched < MAX_CURSOR_PAGES) {
          const params = cursor ? { ...baseParams, cursor } : baseParams;
          const res = await reportingApi.getDailyBreakdown(params, { signal });
          if (seq !== breakdownFetchSeq.current) return;
          const payload = (res?.data ?? res) as
            | ReportingDailyBreakdownResponse
            | { data?: ReportingDailyBreakdownResponse };

          const envelope = (
            payload && typeof payload === "object" && "data" in payload && Array.isArray(
              (payload as ReportingDailyBreakdownResponse).data,
            )
              ? (payload as ReportingDailyBreakdownResponse)
              : (payload as { data?: ReportingDailyBreakdownResponse })?.data
          ) as ReportingDailyBreakdownResponse | undefined;

          const rows: ReportingDailyBreakdownRow[] = Array.isArray(envelope?.data)
            ? envelope!.data
            : [];
          for (const r of rows) collected.push(normalizeBreakdownRow(r));

          pagesFetched += 1;
          const next = envelope?.nextCursor;
          if (!envelope?.hasMore || !next || rows.length === 0) break;
          cursor = next;
        }

        setBreakdownRows(collected);
        setPage(1);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (seq !== breakdownFetchSeq.current) return;
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : t(`${R}.loadError`);
        setBreakdownError(message);
        setBreakdownRows([]);
      } finally {
        if (seq === breakdownFetchSeq.current) setBreakdownLoading(false);
      }
    },
    [supervisorId, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchSummary(appliedRange, controller.signal);
    return () => controller.abort();
  }, [appliedRange, fetchSummary]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchBreakdown(appliedRange, controller.signal);
    return () => controller.abort();
  }, [appliedRange, fetchBreakdown]);

  const handleApply = () => {
    // Only apply when both ends are set — partial ranges are treated as "no filter".
    if (dateRange.startDate && dateRange.endDate) {
      setAppliedRange(dateRange);
    } else {
      setAppliedRange(EMPTY_RANGE);
    }
    setPage(1);
  };

  const handleClearFilter = () => {
    setDateRange(EMPTY_RANGE);
    setAppliedRange(EMPTY_RANGE);
    setPage(1);
  };

  const handleRefresh = () => {
    void fetchSummary(appliedRange);
    void fetchBreakdown(appliedRange);
  };

  const isFilterApplied = Boolean(appliedRange.startDate && appliedRange.endDate);
  const rangeLabel = isFilterApplied
    ? `${format(appliedRange.startDate as Date, "dd MMM yyyy")} - ${format(appliedRange.endDate as Date, "dd MMM yyyy")}`
    : t(`${R}.allTime`);

  return (
    <>
      <PageMeta
        title={t(`${R}.metaTitle`)}
        description={t(`${R}.metaDescription`)}
      />
      <PageBreadcrumb pageTitle={t(`${R}.pageTitle`)} />

      <div className="space-y-5">
        {/* Header + filters */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                <BarChart3 className="size-5" aria-hidden />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  {t(`${R}.heading`)}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>{t(`${R}.lastUpdated`, { time: lastUpdated })}</span>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="inline-flex items-center justify-center rounded-lg p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                    aria-label={t(`${R}.refresh`)}
                  >
                    <RefreshCw className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end sm:justify-end lg:w-auto">
              <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-xs lg:min-w-[240px]">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t(`${R}.dateRange`)}
                </span>
                <DateRangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  defaultSelectionMode="range"
                  placeholder={t(`${R}.dateRange`)}
                  className="w-full"
                />
              </label>
              <button
                type="button"
                onClick={handleApply}
                className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
              >
                {t(`${R}.apply`)}
              </button>
              {isFilterApplied || dateRange.startDate || dateRange.endDate ? (
                <button
                  type="button"
                  onClick={handleClearFilter}
                  className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  {t(`${R}.clear`)}
                </button>
              ) : null}
            </div>
          </div>

          {rangeLabel ? (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              <Calendar className="mr-1 inline size-3.5 align-text-bottom" aria-hidden />
              {rangeLabel}
            </p>
          ) : null}
        </section>

        {/* KPI rows — 4 cards per row on xl, sourced from GET /v1/reporting/summary */}
        {summaryError ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800/60 dark:bg-rose-500/10 dark:text-rose-200 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>{summaryError}</span>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-200 dark:hover:bg-rose-900/50"
            >
              <RefreshCw className="size-3.5" aria-hidden />
              {t(`${R}.retry`)}
            </button>
          </div>
        ) : null}
        <MetricsGrid metrics={row1} loading={summaryLoading} />
        <MetricsGrid metrics={row2} loading={summaryLoading} />
        <MetricsGrid metrics={row3} loading={summaryLoading} />

        {/* Supervisor note */}
        <div
          role="note"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-500/10 dark:text-amber-200"
        >
          {t(`${R}.supervisorNote`)}
        </div>

        {/* Data table */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col gap-3 border-b border-gray-200 bg-brand-500 px-4 py-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white">
              {t(`${R}.table.title`)}
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
              >
                <Download className="size-3.5" aria-hidden />
                {t(`${R}.table.exportCsv`)}
              </button>
              <button
                type="button"
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
              >
                <FileSpreadsheet className="size-3.5" aria-hidden />
                {t(`${R}.table.exportExcel`)}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto px-0" style={{ WebkitOverflowScrolling: "touch" }}>
            <Table className="min-w-[44rem] table-auto">
              <TableHeader className="border-b border-gray-200 bg-gray-50/80 dark:border-gray-800 dark:bg-white/[0.02]">
                <TableRow>
                  {[
                    "colDate",
                    "colTotalRequests",
                    "colConfirmedBookings",
                    "colCompletedServices",
                    "colFulfillmentRate",
                    "colAcceptanceRate",
                    "colGrossRevenue",
                  ].map((key) => (
                    <TableCell
                      key={key}
                      isHeader
                      className="whitespace-nowrap py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                    >
                      {t(`${R}.table.${key}`)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {breakdownLoading && breakdownRows.length === 0 ? (
                  Array.from({ length: limit }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j} className="py-3">
                          <div className="h-4 w-24 animate-pulse rounded bg-gray-200/80 dark:bg-gray-700/60" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : breakdownError ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-sm text-rose-600 dark:text-rose-400"
                    >
                      <div className="inline-flex flex-col items-center gap-2">
                        <span>{breakdownError}</span>
                        <button
                          type="button"
                          onClick={handleRefresh}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-200 dark:hover:bg-rose-900/50"
                        >
                          <RefreshCw className="size-3.5" aria-hidden />
                          {t(`${R}.retry`)}
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : breakdownRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      {t(`${R}.table.empty`)}
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {paginatedRows.map((row, i) => (
                      <TableRow
                        key={`${row.rawDate ?? row.date}-${i}`}
                        className="hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                      >
                        <TableCell className="whitespace-nowrap py-3 text-theme-sm text-gray-700 dark:text-gray-300">
                          {row.date}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm font-medium text-gray-800 dark:text-white/90">
                          {formatCount(row.totalRequests)}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-700 dark:text-gray-300">
                          {formatCount(row.confirmedBookings)}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-700 dark:text-gray-300">
                          {formatCount(row.completedServices)}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-700 dark:text-gray-300">
                          {formatPercent(row.fulfillmentRate)}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-700 dark:text-gray-300">
                          {formatPercent(row.acceptanceRate)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-3 text-theme-sm text-gray-700 dark:text-gray-300">
                          {formatBdtCompact(row.grossRevenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50/90 font-semibold dark:bg-white/[0.04]">
                      <TableCell className="py-3 text-theme-sm text-gray-800 dark:text-white/90">
                        {t(`${R}.table.totalAvg`)}
                      </TableCell>
                      <TableCell className="py-3 text-theme-sm text-gray-800 dark:text-white/90">
                        {formatCount(totals.totalRequests)}
                      </TableCell>
                      <TableCell className="py-3 text-theme-sm text-gray-800 dark:text-white/90">
                        {formatCount(totals.confirmedBookings)}
                      </TableCell>
                      <TableCell className="py-3 text-theme-sm text-gray-800 dark:text-white/90">
                        {formatCount(totals.completedServices)}
                      </TableCell>
                      <TableCell className="py-3 text-theme-sm text-gray-800 dark:text-white/90">
                        {formatPercent(totals.fulfillmentRate)}
                      </TableCell>
                      <TableCell className="py-3 text-theme-sm text-gray-800 dark:text-white/90">
                        {formatPercent(totals.acceptanceRate)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-3 text-theme-sm text-gray-800 dark:text-white/90">
                        {formatBdtCompact(totals.grossRevenue)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-4 border-t border-gray-200 px-4 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                {t("pagination.rowsPerPage")}
                <ThemedSelect
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {LIMIT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </ThemedSelect>
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t(`${R}.table.showingRangeOf`, { from, to, total: totalEntries })}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                {t("common.actions.previous")}
              </button>
              <span className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                {t("pagination.pageOf", { page, totalPages })}
              </span>
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                {t("common.actions.next")}
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
