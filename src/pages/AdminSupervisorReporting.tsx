import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  HandCoins,
  Hourglass,
  Percent,
  RefreshCw,
  Send,
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
import {
  bangladeshCalendarRangeToApiParams,
  toBangladeshISODate,
} from "../utils/format";
import {
  adminFinancialApi,
  reportingApi,
  type FinancialReportTotalsDto,
  type FinancialServiceType,
  type ReportingDailyBreakdownResponse,
  type ReportingDailyBreakdownRow,
  type ReportingServiceType,
  type SupervisorReportingSummaryDto,
} from "../services/api";
import {
  fmtBDT,
  MAX_RANGE_DAYS,
  toISODateLocal,
} from "./financial/shared";

// ── KPI cards driven by GET /v1/reporting/supervisor-summary ──────────────────

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

function buildMetrics(
  summary: SupervisorReportingSummaryDto | null,
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
      labelKey: "adminSupervisorReporting.kpi.sentToProviders",
      descKey: "adminSupervisorReporting.kpi.sentToProvidersDesc",
      value: formatCount(s?.sentToProviders),
      icon: <Send className="size-5" />,
      bgClass: "bg-sky-50/80 dark:bg-sky-500/10",
      iconBgClass: "bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400",
    },
    {
      labelKey: "adminSupervisorReporting.kpi.acceptedByProvider",
      descKey: "adminSupervisorReporting.kpi.acceptedByProviderDesc",
      value: formatCount(s?.acceptedByProvider),
      icon: <HandCoins className="size-5" />,
      bgClass: "bg-indigo-50/80 dark:bg-indigo-500/10",
      iconBgClass:
        "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400",
    },
    {
      labelKey: "adminSupervisorReporting.kpi.confirmedBookings",
      descKey: "adminSupervisorReporting.kpi.confirmedBookingsDesc",
      value: formatCount(s?.confirmedBookings),
      icon: <CheckCircle2 className="size-5" />,
      bgClass: "bg-violet-50/80 dark:bg-violet-500/10",
      iconBgClass:
        "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400",
    },
  ];

  const row2: MetricCardConfig[] = [
    {
      labelKey: "adminSupervisorReporting.kpi.completedServices",
      descKey: "adminSupervisorReporting.kpi.completedServicesDesc",
      value: formatCount(s?.completedServices),
      icon: <TrendingUp className="size-5" />,
      bgClass: "bg-amber-50/80 dark:bg-amber-500/10",
      iconBgClass:
        "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    },
    {
      labelKey: "adminSupervisorReporting.kpi.autoCancelUnpaid",
      descKey: "adminSupervisorReporting.kpi.autoCancelUnpaidDesc",
      value: formatCount(s?.autoCancelUnpaid),
      icon: <Timer className="size-5" />,
      bgClass: "bg-rose-50/80 dark:bg-rose-500/10",
      iconBgClass: "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400",
    },
    {
      labelKey: "adminSupervisorReporting.kpi.cancelledTotal",
      descKey: "adminSupervisorReporting.kpi.cancelledTotalDesc",
      value: formatCount(s?.cancelledTotal),
      icon: <Undo2 className="size-5" />,
      bgClass: "bg-orange-50/80 dark:bg-orange-500/10",
      iconBgClass:
        "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400",
    },
    {
      labelKey: "adminSupervisorReporting.kpi.fulfillmentRate",
      descKey: "adminSupervisorReporting.kpi.fulfillmentRateDesc",
      value: formatPercent(s?.fulfillmentRate),
      icon: <Percent className="size-5" />,
      bgClass: "bg-pink-50/80 dark:bg-pink-500/10",
      iconBgClass: "bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400",
    },
  ];

  const row3: MetricCardConfig[] = [
    {
      labelKey: "adminSupervisorReporting.kpi.providerAcceptanceRate",
      descKey: "adminSupervisorReporting.kpi.providerAcceptanceRateDesc",
      value: formatPercent(s?.providerAcceptanceRate),
      icon: <Hourglass className="size-5" />,
      bgClass: "bg-cyan-50/80 dark:bg-cyan-500/10",
      iconBgClass: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400",
    },
    {
      labelKey: "adminSupervisorReporting.kpi.paymentExpiryRate",
      descKey: "adminSupervisorReporting.kpi.paymentExpiryRateDesc",
      value: formatPercent(s?.paymentExpiryRate),
      icon: <Timer className="size-5" />,
      bgClass: "bg-blue-50/80 dark:bg-blue-500/10",
      iconBgClass: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
    },
  ];

  return { row1, row2, row3 };
}

// ── Data table — driven by GET /v1/reporting/supervisor-daily-breakdown ───────

/** Normalized row shape consumed by the table UI. */
type BreakdownTableRow = {
  date: string;
  rawDate: string;
  totalRequests: number | null;
  sentToProviders: number | null;
  acceptedByProvider: number | null;
  confirmedBookings: number | null;
  completedServices: number | null;
  autoCancelUnpaid: number | null;
  cancelledTotal: number | null;
  fulfillmentRate: number | null;
  providerAcceptanceRate: number | null;
  paymentExpiryRate: number | null;
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
    sentToProviders: toNumberOrNull(r.sentToProviders),
    acceptedByProvider: toNumberOrNull(r.acceptedByProvider),
    confirmedBookings: toNumberOrNull(r.confirmedBookings),
    completedServices: toNumberOrNull(r.completedServices),
    autoCancelUnpaid: toNumberOrNull(r.autoCancelUnpaid),
    cancelledTotal: toNumberOrNull(r.cancelledTotal),
    fulfillmentRate: toNumberOrNull(r.fulfillmentRate),
    providerAcceptanceRate: toNumberOrNull(
      r.providerAcceptanceRate ?? r.acceptanceRate,
    ),
    paymentExpiryRate: toNumberOrNull(r.paymentExpiryRate),
  };
}

/**
 * Column definition shared by the table renderer and the CSV/Excel exporters.
 * `hideClass` controls responsive visibility — empty string = always visible.
 */
type BreakdownColumn = {
  key: string;
  labelKey: string;
  /** Tailwind class to hide on small screens, e.g. "hidden md:table-cell". */
  hideClass: string;
  /** Renderer for the on-screen cell. */
  render: (row: BreakdownTableRow) => string;
  /** Raw value used in exports (kept as a plain string/number for CSV cells). */
  exportValue: (row: BreakdownTableRow) => string | number;
};

const BREAKDOWN_COLUMNS: BreakdownColumn[] = [
  {
    key: "colDate",
    labelKey: "colDate",
    hideClass: "",
    render: (r) => r.date,
    exportValue: (r) => r.rawDate ?? r.date,
  },
  {
    key: "colTotalRequests",
    labelKey: "colTotalRequests",
    hideClass: "",
    render: (r) => formatCount(r.totalRequests),
    exportValue: (r) => r.totalRequests ?? "",
  },
  {
    key: "colConfirmedBookings",
    labelKey: "colConfirmedBookings",
    hideClass: "",
    render: (r) => formatCount(r.confirmedBookings),
    exportValue: (r) => r.confirmedBookings ?? "",
  },
  {
    key: "colCompletedServices",
    labelKey: "colCompletedServices",
    hideClass: "",
    render: (r) => formatCount(r.completedServices),
    exportValue: (r) => r.completedServices ?? "",
  },
  {
    key: "colFulfillmentRate",
    labelKey: "colFulfillmentRate",
    hideClass: "",
    render: (r) => formatPercent(r.fulfillmentRate),
    exportValue: (r) => r.fulfillmentRate ?? "",
  },
  {
    key: "colProviderAcceptanceRate",
    labelKey: "colProviderAcceptanceRate",
    hideClass: "",
    render: (r) => formatPercent(r.providerAcceptanceRate),
    exportValue: (r) => r.providerAcceptanceRate ?? "",
  },
  {
    key: "colPaymentExpiryRate",
    labelKey: "colPaymentExpiryRate",
    hideClass: "",
    render: (r) => formatPercent(r.paymentExpiryRate),
    exportValue: (r) => r.paymentExpiryRate ?? "",
  },
];

/** Escape a value for a single CSV cell (RFC 4180-ish). */
function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Trigger a browser download for the given Blob. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildCsv(rows: BreakdownTableRow[], headers: string[]): Blob {
  const headerLine = headers.map(csvCell).join(",");
  const bodyLines = rows.map((r) =>
    BREAKDOWN_COLUMNS.map((c) => csvCell(c.exportValue(r))).join(","),
  );
  // UTF-8 BOM so Excel opens non-ASCII (e.g. Bangla) correctly.
  const content = "\uFEFF" + [headerLine, ...bodyLines].join("\r\n");
  return new Blob([content], { type: "text/csv;charset=utf-8;" });
}

/**
 * Excel-compatible export. Emits an HTML <table> with `.xls` extension —
 * Excel reliably opens this without a third-party library.
 */
function buildXls(rows: BreakdownTableRow[], headers: string[]): Blob {
  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const thead = `<thead><tr>${headers
    .map((h) => `<th>${escapeHtml(h)}</th>`)
    .join("")}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map(
      (r) =>
        `<tr>${BREAKDOWN_COLUMNS.map(
          (c) => `<td>${escapeHtml(String(c.exportValue(r) ?? ""))}</td>`,
        ).join("")}</tr>`,
    )
    .join("")}</tbody>`;

  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:x="urn:schemas-microsoft-com:office:excel" ` +
    `xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head><meta charset="utf-8" /></head>` +
    `<body><table border="1">${thead}${tbody}</table></body></html>`;

  return new Blob(["\uFEFF" + html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
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

/** Resolve a financial-report date window (API requires dates, max 90 days). */
function resolveFinancialWindow(range: DateRangePickerValue): {
  startDate: string;
  endDate: string;
  usedFallback: boolean;
  clamped: boolean;
} {
  const today = toISODateLocal(new Date());
  const fallbackStart = toISODateLocal(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  );
  const usedFallback = !(range.startDate && range.endDate);
  let startDate = range.startDate ? toBangladeshISODate(range.startDate) : fallbackStart;
  let endDate = range.endDate ? toBangladeshISODate(range.endDate) : today;

  const utcMidnight = (s: string) =>
    Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  let clamped = false;
  const diffDays =
    (utcMidnight(endDate) - utcMidnight(startDate)) / (24 * 60 * 60 * 1000);
  if (diffDays > MAX_RANGE_DAYS) {
    const endMs = utcMidnight(endDate);
    const startMs = endMs - MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;
    const d = new Date(startMs);
    startDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    clamped = true;
  }
  return { startDate, endDate, usedFallback, clamped };
}

type FinancialMetricTone = "inflow" | "outflow" | "neutral" | "accent";

type FinancialMetricItem = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  tone: FinancialMetricTone;
};

const FINANCIAL_TONE_BAR: Record<FinancialMetricTone, string> = {
  inflow: "bg-emerald-500",
  outflow: "bg-rose-500",
  neutral: "bg-slate-400",
  accent: "bg-teal-500",
};

const FINANCIAL_TONE_VALUE: Record<FinancialMetricTone, string> = {
  inflow: "text-emerald-700 dark:text-emerald-400",
  outflow: "text-rose-700 dark:text-rose-400",
  neutral: "text-slate-800 dark:text-slate-100",
  accent: "text-teal-800 dark:text-teal-300",
};

/** Money KPIs — slate panel + top accent bars (visually distinct from request pastel cards). */
function FinancialKpiSection({
  totals,
  loading,
  error,
  rangeNote,
  onRetry,
}: {
  totals: FinancialReportTotalsDto | null;
  loading: boolean;
  error: string;
  rangeNote: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const R = "adminSupervisorReporting";

  const items: FinancialMetricItem[] = useMemo(() => {
    if (!totals) return [];
    return [
      {
        key: "inflow",
        label: t(`${R}.financialKpi.totalInflow`),
        value: fmtBDT(totals.totalInflow),
        hint: t(`${R}.financialKpi.inflowHint`, {
          online: fmtBDT(totals.onlinePayments),
          cash: fmtBDT(totals.cashPayments),
        }),
        tone: "inflow",
      },
      {
        key: "provider",
        label: t(`${R}.financialKpi.providerEarnings`),
        value: fmtBDT(totals.totalProviderEarningsAllocated),
        tone: "neutral",
      },
      {
        key: "supervisor",
        label: t(`${R}.financialKpi.supervisorCommission`),
        value: fmtBDT(totals.totalSupervisorCommission ?? "0"),
        tone: "accent",
      },
      {
        key: "platform",
        label: t(`${R}.financialKpi.platformEarnings`),
        value: fmtBDT(totals.netPlatformEarnings),
        hint: t(`${R}.financialKpi.platformHint`, {
          commission: fmtBDT(totals.totalCommission),
        }),
        tone: "inflow",
      },
      {
        key: "vat",
        label: t(`${R}.financialKpi.vat`),
        value: fmtBDT(totals.totalVat ?? totals.totalTax ?? "0"),
        tone: "neutral",
      },
      {
        key: "ait",
        label: t(`${R}.financialKpi.ait`),
        value: fmtBDT(totals.totalAit ?? "0"),
        tone: "neutral",
      },
      {
        key: "withdrawals",
        label: t(`${R}.financialKpi.withdrawals`),
        value: fmtBDT(totals.totalWithdrawals),
        tone: "outflow",
      },
    ];
  }, [totals, t]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/90 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-900 px-4 py-3 dark:border-slate-700 sm:px-5">
        <div className="flex items-center gap-2.5 text-white">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300">
            <Wallet className="size-4" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-wide">
              {t(`${R}.financialKpi.title`)}
            </h3>
            {rangeNote ? (
              <p className="mt-0.5 text-[11px] font-normal text-slate-300">
                {rangeNote}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex flex-col gap-2 px-4 py-4 text-sm text-rose-700 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between sm:px-5"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-200"
          >
            <RefreshCw className="size-3.5" aria-hidden />
            {t(`${R}.retry`)}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-px bg-slate-200/70 dark:bg-slate-700/50 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {loading && items.length === 0
            ? Array.from({ length: 7 }, (_, i) => (
                <div
                  key={`sk-${i}`}
                  className="bg-white px-4 py-3.5 dark:bg-slate-950/50"
                >
                  <div className="mb-2 h-1 w-8 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                  <div className="h-3 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="mt-2 h-6 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                </div>
              ))
            : items.map((m) => (
                <div
                  key={m.key}
                  className="relative bg-white px-4 py-3.5 dark:bg-slate-950/50"
                >
                  <span
                    className={cn(
                      "absolute inset-x-0 top-0 h-0.5",
                      FINANCIAL_TONE_BAR[m.tone],
                    )}
                    aria-hidden
                  />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {m.label}
                  </p>
                  {loading ? (
                    <div className="mt-2 h-6 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                  ) : (
                    <p
                      className={cn(
                        "mt-1.5 text-lg font-semibold tabular-nums tracking-tight",
                        FINANCIAL_TONE_VALUE[m.tone],
                      )}
                    >
                      {m.value}
                    </p>
                  )}
                  {m.hint && !loading ? (
                    <p className="mt-1 text-[10px] leading-snug text-slate-400 dark:text-slate-500">
                      {m.hint}
                    </p>
                  ) : null}
                </div>
              ))}
        </div>
      )}
    </section>
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
  const [serviceType, setServiceType] = useState<ReportingServiceType | "">("");
  const [appliedServiceType, setAppliedServiceType] = useState<ReportingServiceType | "">("");
  const [lastUpdated, setLastUpdated] = useState(() => format(new Date(), "h:mm a"));
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);

  const [summary, setSummary] = useState<SupervisorReportingSummaryDto | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const fetchSeq = useRef(0);

  const [breakdownRows, setBreakdownRows] = useState<BreakdownTableRow[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState("");
  const breakdownFetchSeq = useRef(0);

  const [financialTotals, setFinancialTotals] =
    useState<FinancialReportTotalsDto | null>(null);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [financialError, setFinancialError] = useState("");
  const [financialRangeMeta, setFinancialRangeMeta] = useState<{
    usedFallback: boolean;
    clamped: boolean;
    startDate: string;
    endDate: string;
  } | null>(null);
  const financialFetchSeq = useRef(0);

  const totalEntries = breakdownRows.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / limit));
  const from = totalEntries === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, totalEntries);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * limit;
    return breakdownRows.slice(start, start + limit);
  }, [page, limit, breakdownRows]);

  const { row1, row2, row3 } = useMemo(() => buildMetrics(summary), [summary]);

  const handleExport = useCallback(
    (kind: "csv" | "xls") => {
      if (breakdownRows.length === 0) return;
      const headers = BREAKDOWN_COLUMNS.map((c) => t(`${R}.table.${c.labelKey}`));
      const today = format(new Date(), "yyyy-MM-dd");
      const rangePart =
        appliedRange.startDate && appliedRange.endDate
          ? `${toBangladeshISODate(appliedRange.startDate)}_${toBangladeshISODate(appliedRange.endDate)}`
          : "all-time";
      const base = `supervisor-daily-breakdown_${rangePart}_${today}`;
      if (kind === "csv") {
        downloadBlob(buildCsv(breakdownRows, headers), `${base}.csv`);
      } else {
        downloadBlob(buildXls(breakdownRows, headers), `${base}.xls`);
      }
    },
    [breakdownRows, appliedRange, t],
  );

  const fetchSummary = useCallback(
    async (
      range: DateRangePickerValue,
      serviceTypeFilter: ReportingServiceType | "",
      signal?: AbortSignal,
    ) => {
      const seq = ++fetchSeq.current;
      setSummaryLoading(true);
      setSummaryError("");
      try {
        const params: Parameters<typeof reportingApi.getSupervisorSummary>[0] = {};
        if (range.startDate) params.startDate = toBangladeshISODate(range.startDate);
        if (range.endDate) params.endDate = toBangladeshISODate(range.endDate);
        if (serviceTypeFilter) params.serviceType = serviceTypeFilter;
        if (supervisorId != null) params.supervisorId = supervisorId;

        const res = await reportingApi.getSupervisorSummary(params, { signal });
        if (seq !== fetchSeq.current) return;
        const data = (res?.data ?? res) as SupervisorReportingSummaryDto;
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
    async (
      range: DateRangePickerValue,
      serviceTypeFilter: ReportingServiceType | "",
      signal?: AbortSignal,
    ) => {
      const seq = ++breakdownFetchSeq.current;
      setBreakdownLoading(true);
      setBreakdownError("");
      try {
        const baseParams: Parameters<typeof reportingApi.getSupervisorDailyBreakdown>[0] = {
          limit: API_PAGE_SIZE,
        };
        if (range.startDate) baseParams.startDate = toBangladeshISODate(range.startDate);
        if (range.endDate) baseParams.endDate = toBangladeshISODate(range.endDate);
        if (serviceTypeFilter) baseParams.serviceType = serviceTypeFilter;
        if (supervisorId != null) baseParams.supervisorId = supervisorId;

        const collected: BreakdownTableRow[] = [];
        let cursor: string | undefined;
        let pagesFetched = 0;
        while (pagesFetched < MAX_CURSOR_PAGES) {
          const params = cursor ? { ...baseParams, cursor } : baseParams;
          const res = await reportingApi.getSupervisorDailyBreakdown(params, { signal });
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

  const fetchFinancial = useCallback(
    async (
      range: DateRangePickerValue,
      serviceTypeFilter: ReportingServiceType | "",
      signal?: AbortSignal,
    ) => {
      const seq = ++financialFetchSeq.current;
      setFinancialLoading(true);
      setFinancialError("");
      try {
        const window = resolveFinancialWindow(range);
        setFinancialRangeMeta({
          usedFallback: window.usedFallback,
          clamped: window.clamped,
          startDate: window.startDate,
          endDate: window.endDate,
        });
        const { startDate: startApi, endDate: endApi } =
          bangladeshCalendarRangeToApiParams(window.startDate, window.endDate);
        const res = await adminFinancialApi.getFinancialReport(
          {
            startDate: startApi,
            endDate: endApi,
            supervisorId,
            serviceType: serviceTypeFilter
              ? (serviceTypeFilter as FinancialServiceType)
              : undefined,
            page: 1,
            limit: 1,
            paginationOnly: false,
          },
          { signal },
        );
        if (seq !== financialFetchSeq.current) return;
        setFinancialTotals(res.data?.summary?.totals ?? null);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (seq !== financialFetchSeq.current) return;
        setFinancialError(t(`${R}.financialKpi.loadError`));
        setFinancialTotals(null);
      } finally {
        if (seq === financialFetchSeq.current) setFinancialLoading(false);
      }
    },
    [supervisorId, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchSummary(appliedRange, appliedServiceType, controller.signal);
    return () => controller.abort();
  }, [appliedRange, appliedServiceType, fetchSummary]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchBreakdown(appliedRange, appliedServiceType, controller.signal);
    return () => controller.abort();
  }, [appliedRange, appliedServiceType, fetchBreakdown]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchFinancial(appliedRange, appliedServiceType, controller.signal);
    return () => controller.abort();
  }, [appliedRange, appliedServiceType, fetchFinancial]);

  const handleApply = () => {
    // Only apply when both ends are set — partial ranges are treated as "no filter".
    if (dateRange.startDate && dateRange.endDate) {
      setAppliedRange(dateRange);
    } else {
      setAppliedRange(EMPTY_RANGE);
    }
    setAppliedServiceType(serviceType);
    setPage(1);
  };

  const handleClearFilter = () => {
    setDateRange(EMPTY_RANGE);
    setAppliedRange(EMPTY_RANGE);
    setServiceType("");
    setAppliedServiceType("");
    setPage(1);
  };

  const handleRefresh = () => {
    void fetchSummary(appliedRange, appliedServiceType);
    void fetchBreakdown(appliedRange, appliedServiceType);
    void fetchFinancial(appliedRange, appliedServiceType);
  };

  const financialRangeNote = useMemo(() => {
    if (!financialRangeMeta) return "";
    if (financialRangeMeta.usedFallback) {
      return t(`${R}.financialKpi.fallbackRangeNote`, {
        start: financialRangeMeta.startDate,
        end: financialRangeMeta.endDate,
      });
    }
    if (financialRangeMeta.clamped) {
      return t(`${R}.financialKpi.clampedRangeNote`, {
        maxDays: MAX_RANGE_DAYS,
        start: financialRangeMeta.startDate,
        end: financialRangeMeta.endDate,
      });
    }
    return t(`${R}.financialKpi.rangeNote`, {
      start: financialRangeMeta.startDate,
      end: financialRangeMeta.endDate,
    });
  }, [financialRangeMeta, t]);

  const isDateFilterApplied = Boolean(appliedRange.startDate && appliedRange.endDate);
  const isServiceTypeFilterApplied = Boolean(appliedServiceType);
  const isFilterApplied = isDateFilterApplied || isServiceTypeFilterApplied;
  const hasDraftFilters =
    Boolean(dateRange.startDate || dateRange.endDate) || Boolean(serviceType);

  const rangeLabel = isDateFilterApplied
    ? `${format(appliedRange.startDate as Date, "dd MMM yyyy")} - ${format(appliedRange.endDate as Date, "dd MMM yyyy")}`
    : t(`${R}.allTime`);

  const serviceTypeLabel = appliedServiceType === "SHORT_TERM"
    ? t(`${R}.shortTerm`)
    : appliedServiceType === "LONG_TERM"
      ? t(`${R}.longTerm`)
      : t(`${R}.allServiceTypes`);

  const filterSummaryLabel = isServiceTypeFilterApplied
    ? `${rangeLabel} · ${serviceTypeLabel}`
    : rangeLabel;

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
              <label className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-[180px] lg:min-w-[160px]">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t(`${R}.serviceType`)}
                </span>
                <ThemedSelect
                  value={serviceType}
                  onChange={(e) =>
                    setServiceType(e.target.value as ReportingServiceType | "")
                  }
                  className="min-h-[42px] w-full"
                >
                  <option value="">{t(`${R}.allServiceTypes`)}</option>
                  <option value="SHORT_TERM">{t(`${R}.shortTerm`)}</option>
                  <option value="LONG_TERM">{t(`${R}.longTerm`)}</option>
                </ThemedSelect>
              </label>
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
              {isFilterApplied || hasDraftFilters ? (
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

          {filterSummaryLabel ? (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              <Calendar className="mr-1 inline size-3.5 align-text-bottom" aria-hidden />
              {filterSummaryLabel}
            </p>
          ) : null}
        </section>

        {/* KPI rows — 4 cards per row on xl, sourced from GET /v1/reporting/supervisor-summary */}
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

        <FinancialKpiSection
          totals={financialTotals}
          loading={financialLoading}
          error={financialError}
          rangeNote={financialRangeNote}
          onRetry={() => void fetchFinancial(appliedRange, appliedServiceType)}
        />

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
              {filterSummaryLabel ? (
                <span className="ml-1.5 text-xs font-normal normal-case opacity-80">
                  ({filterSummaryLabel})
                </span>
              ) : null}
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleExport("csv")}
                disabled={breakdownRows.length === 0 || breakdownLoading}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="size-3.5" aria-hidden />
                {t(`${R}.table.exportCsv`)}
              </button>
              <button
                type="button"
                onClick={() => handleExport("xls")}
                disabled={breakdownRows.length === 0 || breakdownLoading}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileSpreadsheet className="size-3.5" aria-hidden />
                {t(`${R}.table.exportExcel`)}
              </button>
            </div>
          </div>

          <div className="max-w-full overflow-hidden">
            <Table className="w-full table-fixed">
              <TableHeader className="border-b border-gray-200 bg-gray-50/80 dark:border-gray-800 dark:bg-white/[0.02]">
                <TableRow>
                  {BREAKDOWN_COLUMNS.map((col) => (
                    <TableCell
                      key={col.key}
                      isHeader
                      title={t(`${R}.table.${col.labelKey}`)}
                      className={cn(
                        "!px-2 py-2.5 text-left text-xs font-semibold leading-tight text-gray-500 dark:text-gray-400",
                        col.hideClass,
                      )}
                    >
                      {t(`${R}.table.${col.labelKey}`)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {breakdownLoading && breakdownRows.length === 0 ? (
                  Array.from({ length: limit }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      {BREAKDOWN_COLUMNS.map((col) => (
                        <TableCell
                          key={col.key}
                          className={cn("!px-2 py-2.5", col.hideClass)}
                        >
                          <div className="h-4 w-12 animate-pulse rounded bg-gray-200/80 dark:bg-gray-700/60" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : breakdownError ? (
                  <TableRow>
                    <TableCell
                      colSpan={BREAKDOWN_COLUMNS.length}
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
                      colSpan={BREAKDOWN_COLUMNS.length}
                      className="py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      {t(`${R}.table.empty`)}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRows.map((row, i) => (
                    <TableRow
                      key={`${row.rawDate ?? row.date}-${i}`}
                      className="hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                    >
                      {BREAKDOWN_COLUMNS.map((col, colIdx) => (
                        <TableCell
                          key={col.key}
                          className={cn(
                            "!px-2 py-2.5 text-theme-sm tabular-nums",
                            colIdx === 0 ? "whitespace-nowrap" : "",
                            colIdx === 1
                              ? "font-medium text-gray-800 dark:text-white/90"
                              : "text-gray-700 dark:text-gray-300",
                            col.hideClass,
                          )}
                        >
                          {col.render(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
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
