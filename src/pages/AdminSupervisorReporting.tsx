import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Calendar,
  ClipboardList,
  Clock,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Star,
  Stethoscope,
  Timer,
  TrendingUp,
  UserCheck,
  Users,
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

// ── Hardcoded mock data (API integration later) ───────────────────────────────

type TrendDirection = "up" | "down";

type MetricCardConfig = {
  labelKey: string;
  descKey?: string;
  value: string;
  trend: string;
  trendDirection: TrendDirection;
  /** Green trend = good for this metric; red = bad */
  trendPositive: boolean;
  icon: React.ReactNode;
  bgClass: string;
  iconBgClass: string;
};

const ROW1_METRICS: MetricCardConfig[] = [
  {
    labelKey: "adminSupervisorReporting.kpi.totalBookings",
    value: "1,254",
    trend: "7.1%",
    trendDirection: "up",
    trendPositive: true,
    icon: <ClipboardList className="size-5" />,
    bgClass: "bg-emerald-50/80 dark:bg-emerald-500/10",
    iconBgClass: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  },
  {
    labelKey: "adminSupervisorReporting.kpi.fulfillmentRate",
    descKey: "adminSupervisorReporting.kpi.fulfillmentRateDesc",
    value: "86.7%",
    trend: "4.3%",
    trendDirection: "up",
    trendPositive: true,
    icon: <TrendingUp className="size-5" />,
    bgClass: "bg-amber-50/80 dark:bg-amber-500/10",
    iconBgClass: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
  },
  {
    labelKey: "adminSupervisorReporting.kpi.activeCaregivers",
    value: "782",
    trend: "8.7%",
    trendDirection: "up",
    trendPositive: true,
    icon: <Users className="size-5" />,
    bgClass: "bg-sky-50/80 dark:bg-sky-500/10",
    iconBgClass: "bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400",
  },
  {
    labelKey: "adminSupervisorReporting.kpi.activeDoctors",
    value: "146",
    trend: "6.2%",
    trendDirection: "up",
    trendPositive: true,
    icon: <Stethoscope className="size-5" />,
    bgClass: "bg-violet-50/80 dark:bg-violet-500/10",
    iconBgClass: "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400",
  },
];

const ROW2_METRICS: MetricCardConfig[] = [
  {
    labelKey: "adminSupervisorReporting.kpi.assignToConfirmRate",
    descKey: "adminSupervisorReporting.kpi.assignToConfirmRateDesc",
    value: "71.2%",
    trend: "5.1%",
    trendDirection: "up",
    trendPositive: true,
    icon: <UserCheck className="size-5" />,
    bgClass: "bg-indigo-50/80 dark:bg-indigo-500/10",
    iconBgClass: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400",
  },
  {
    labelKey: "adminSupervisorReporting.kpi.confirmationExpiryRate",
    descKey: "adminSupervisorReporting.kpi.confirmationExpiryRateDesc",
    value: "8.4%",
    trend: "2.3%",
    trendDirection: "down",
    trendPositive: true,
    icon: <Timer className="size-5" />,
    bgClass: "bg-rose-50/80 dark:bg-rose-500/10",
    iconBgClass: "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400",
  },
  {
    labelKey: "adminSupervisorReporting.kpi.reassignmentRate",
    descKey: "adminSupervisorReporting.kpi.reassignmentRateDesc",
    value: "12.6%",
    trend: "1.7%",
    trendDirection: "up",
    trendPositive: false,
    icon: <RefreshCw className="size-5" />,
    bgClass: "bg-orange-50/80 dark:bg-orange-500/10",
    iconBgClass: "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400",
  },
  {
    labelKey: "adminSupervisorReporting.kpi.avgTimeToAssignment",
    descKey: "adminSupervisorReporting.kpi.avgTimeToAssignmentDesc",
    value: "28m",
    trend: "8m",
    trendDirection: "down",
    trendPositive: true,
    icon: <Clock className="size-5" />,
    bgClass: "bg-teal-50/80 dark:bg-teal-500/10",
    iconBgClass: "bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400",
  },
];

const ROW3_METRICS: MetricCardConfig[] = [
  {
    labelKey: "adminSupervisorReporting.kpi.totalRevenue",
    value: "BDT 1,245,800",
    trend: "15.6%",
    trendDirection: "up",
    trendPositive: true,
    icon: <Wallet className="size-5" />,
    bgClass: "bg-emerald-50/80 dark:bg-emerald-500/10",
    iconBgClass: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  },
  {
    labelKey: "adminSupervisorReporting.kpi.averageFulfillmentTime",
    value: "3.2 Hrs",
    trend: "15%",
    trendDirection: "down",
    trendPositive: true,
    icon: <Clock className="size-5" />,
    bgClass: "bg-blue-50/80 dark:bg-blue-500/10",
    iconBgClass: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
  },
  {
    labelKey: "adminSupervisorReporting.kpi.caregiverEngagementScore",
    value: "82%",
    trend: "2.1%",
    trendDirection: "up",
    trendPositive: true,
    icon: <BarChart3 className="size-5" />,
    bgClass: "bg-cyan-50/80 dark:bg-cyan-500/10",
    iconBgClass: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400",
  },
  {
    labelKey: "adminSupervisorReporting.kpi.serviceRating",
    value: "4.5 Stars",
    trend: "0.2",
    trendDirection: "up",
    trendPositive: true,
    icon: <Star className="size-5" />,
    bgClass: "bg-yellow-50/80 dark:bg-yellow-500/10",
    iconBgClass: "bg-yellow-100 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400",
  },
];

type TableRowData = {
  date: string;
  serviceType: string;
  providerType: string;
  area: string;
  totalBookings: number;
  fulfilledBookings: number;
  fulfillmentRate: string;
  activeCaregivers: number;
  revenue: string;
  assignToConfirmRate: string;
  expiryRate: string;
  reassignmentRate: string;
  avgTimeToAssignment: string;
};

const TABLE_DATA: TableRowData[] = [
  {
    date: "06 May 2025",
    serviceType: "Lab Test",
    providerType: "Doctor",
    area: "Mirpur",
    totalBookings: 45,
    fulfilledBookings: 40,
    fulfillmentRate: "88.9%",
    activeCaregivers: 12,
    revenue: "BDT 45,000",
    assignToConfirmRate: "82%",
    expiryRate: "5.6%",
    reassignmentRate: "8.1%",
    avgTimeToAssignment: "15m",
  },
  {
    date: "07 May 2025",
    serviceType: "Physiotherapy",
    providerType: "Caregiver",
    area: "Uttara",
    totalBookings: 82,
    fulfilledBookings: 75,
    fulfillmentRate: "91.5%",
    activeCaregivers: 28,
    revenue: "BDT 120,000",
    assignToConfirmRate: "88%",
    expiryRate: "3.4%",
    reassignmentRate: "6.2%",
    avgTimeToAssignment: "18m",
  },
  {
    date: "08 May 2025",
    serviceType: "Physiotherapy",
    providerType: "Caregiver",
    area: "Mirpur",
    totalBookings: 62,
    fulfilledBookings: 55,
    fulfillmentRate: "88.7%",
    activeCaregivers: 22,
    revenue: "BDT 95,000",
    assignToConfirmRate: "85%",
    expiryRate: "4.2%",
    reassignmentRate: "7.5%",
    avgTimeToAssignment: "22m",
  },
  {
    date: "09 May 2025",
    serviceType: "Physiotherapy",
    providerType: "Caregiver",
    area: "Uttara",
    totalBookings: 92,
    fulfilledBookings: 82,
    fulfillmentRate: "89.1%",
    activeCaregivers: 31,
    revenue: "BDT 150,000",
    assignToConfirmRate: "86%",
    expiryRate: "3.8%",
    reassignmentRate: "5.9%",
    avgTimeToAssignment: "20m",
  },
  {
    date: "10 May 2025",
    serviceType: "Lab Test",
    providerType: "Doctor",
    area: "Gulshan",
    totalBookings: 38,
    fulfilledBookings: 35,
    fulfillmentRate: "92.1%",
    activeCaregivers: 15,
    revenue: "BDT 38,000",
    assignToConfirmRate: "90%",
    expiryRate: "2.5%",
    reassignmentRate: "4.3%",
    avgTimeToAssignment: "12m",
  },
];

const TABLE_TOTALS = {
  totalBookings: 319,
  fulfilledBookings: 287,
  fulfillmentRate: "90.0%",
  revenue: "BDT 448,000",
  assignToConfirmRate: "86.2%",
  expiryRate: "3.9%",
  reassignmentRate: "6.4%",
  avgTimeToAssignment: "17.4m",
};

const TOTAL_ENTRIES = 25;
const LIMIT_OPTIONS = [5, 10, 20];

const DEFAULT_RANGE: DateRangePickerValue = {
  startDate: new Date(2025, 4, 6),
  endDate: new Date(2025, 4, 12),
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({
  config,
  vsLastWeekLabel,
}: {
  config: MetricCardConfig;
  vsLastWeekLabel: string;
}) {
  const { t } = useTranslation();
  const isGood =
    (config.trendDirection === "up" && config.trendPositive) ||
    (config.trendDirection === "down" && config.trendPositive);

  const TrendIcon = config.trendDirection === "up" ? ArrowUp : ArrowDown;

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
      <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white/95 sm:text-[1.65rem]">
        {config.value}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 font-semibold",
            isGood
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400",
          )}
        >
          <TrendIcon className="size-3.5 shrink-0" aria-hidden />
          {config.trend}
        </span>
        <span className="text-gray-500 dark:text-gray-400">{vsLastWeekLabel}</span>
      </div>
    </div>
  );
}

function MetricsGrid({
  metrics,
  vsLastWeekLabel,
}: {
  metrics: MetricCardConfig[];
  vsLastWeekLabel: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((m) => (
        <MetricCard key={m.labelKey} config={m} vsLastWeekLabel={vsLastWeekLabel} />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminSupervisorReporting() {
  const { t } = useTranslation();
  const R = "adminSupervisorReporting";

  const [dateRange, setDateRange] = useState<DateRangePickerValue>(DEFAULT_RANGE);
  const [appliedRange, setAppliedRange] = useState<DateRangePickerValue>(DEFAULT_RANGE);
  const [lastUpdated, setLastUpdated] = useState(() => format(new Date(), "h:mm a"));
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);

  const totalPages = Math.ceil(TOTAL_ENTRIES / limit) || 1;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, TOTAL_ENTRIES);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * limit;
    return TABLE_DATA.slice(start, start + limit);
  }, [page, limit]);

  const handleApply = () => {
    setAppliedRange(dateRange);
    setPage(1);
    setLastUpdated(format(new Date(), "h:mm a"));
  };

  const handleRefresh = () => {
    setLastUpdated(format(new Date(), "h:mm a"));
  };

  const rangeLabel =
    appliedRange.startDate && appliedRange.endDate
      ? `${format(appliedRange.startDate, "dd MMM yyyy")} - ${format(appliedRange.endDate, "dd MMM yyyy")}`
      : "";

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
            </div>
          </div>

          {rangeLabel ? (
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              <Calendar className="mr-1 inline size-3.5 align-text-bottom" aria-hidden />
              {rangeLabel}
            </p>
          ) : null}
        </section>

        {/* KPI rows — 4 cards per row on xl */}
        <MetricsGrid
          metrics={ROW1_METRICS}
          vsLastWeekLabel={t(`${R}.vsLastWeek`)}
        />
        <MetricsGrid
          metrics={ROW2_METRICS}
          vsLastWeekLabel={t(`${R}.vsLastWeek`)}
        />
        <MetricsGrid
          metrics={ROW3_METRICS}
          vsLastWeekLabel={t(`${R}.vsLastWeek`)}
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
                    "colServiceType",
                    "colProviderType",
                    "colArea",
                    "colTotalBookings",
                    "colFulfilledBookings",
                    "colRevenue",
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
                {paginatedRows.map((row) => (
                  <TableRow
                    key={row.date}
                    className="hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                  >
                    <TableCell className="whitespace-nowrap py-3 text-theme-sm text-gray-700 dark:text-gray-300">
                      {row.date}
                    </TableCell>
                    <TableCell className="py-3 text-theme-sm text-gray-700 dark:text-gray-300">
                      {row.serviceType}
                    </TableCell>
                    <TableCell className="py-3 text-theme-sm text-gray-700 dark:text-gray-300">
                      {row.providerType}
                    </TableCell>
                    <TableCell className="py-3 text-theme-sm text-gray-700 dark:text-gray-300">
                      {row.area}
                    </TableCell>
                    <TableCell className="py-3 text-theme-sm font-medium text-gray-800 dark:text-white/90">
                      {row.totalBookings}
                    </TableCell>
                    <TableCell className="py-3 text-theme-sm text-gray-700 dark:text-gray-300">
                      {row.fulfilledBookings}
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3 text-theme-sm text-gray-700 dark:text-gray-300">
                      {row.revenue}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-gray-50/90 font-semibold dark:bg-white/[0.04]">
                  <TableCell className="py-3 text-theme-sm text-gray-800 dark:text-white/90">
                    {t(`${R}.table.totalAvg`)}
                  </TableCell>
                  <TableCell className="py-3 text-theme-sm text-gray-500">—</TableCell>
                  <TableCell className="py-3 text-theme-sm text-gray-500">—</TableCell>
                  <TableCell className="py-3 text-theme-sm text-gray-500">—</TableCell>
                  <TableCell className="py-3 text-theme-sm text-gray-800 dark:text-white/90">
                    {TABLE_TOTALS.totalBookings}
                  </TableCell>
                  <TableCell className="py-3 text-theme-sm text-gray-800 dark:text-white/90">
                    {TABLE_TOTALS.fulfilledBookings}
                  </TableCell>
                  <TableCell className="whitespace-nowrap py-3 text-theme-sm text-gray-800 dark:text-white/90">
                    {TABLE_TOTALS.revenue}
                  </TableCell>
                </TableRow>
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
                {t(`${R}.table.showingRangeOf`, { from, to, total: TOTAL_ENTRIES })}
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
