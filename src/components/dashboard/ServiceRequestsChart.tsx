import Chart from "react-apexcharts";
import { useTranslation } from "react-i18next";
import { ApexOptions } from "apexcharts";
import type { DashboardServiceRequestsSummary } from "../../services/api";
import { formatStatusLabel } from "../../utils/format";

const STATUS_ORDER = ["PENDING", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REJECTED"] as const;
const STATUS_COLORS = [
  "#f59e0b", // amber - PENDING
  "#10b981", // emerald - ACCEPTED
  "#6366f1", // indigo - IN_PROGRESS
  "#22c55e", // green - COMPLETED
  "#6b7280", // gray - CANCELLED
  "#ef4444", // red - REJECTED
];

export interface ServiceRequestsChartProps {
  summary: DashboardServiceRequestsSummary | null | undefined;
  loading?: boolean;
}

export function ServiceRequestsChart({ summary, loading }: ServiceRequestsChartProps) {
  const { t } = useTranslation();
  const series = STATUS_ORDER.map((s) => summary?.[s] ?? 0);
  /** Legend labels match API enum keys (not localized — same in EN/BN). */
  const labels = STATUS_ORDER.map((s) => formatStatusLabel(s));
  const total = series.reduce((a, b) => a + b, 0);

  const options: ApexOptions = {
    chart: {
      type: "donut",
      fontFamily: "Outfit, sans-serif",
    },
    labels,
    colors: STATUS_COLORS,
    legend: {
      position: "right",
      horizontalAlign: "right",
      fontSize: "12px",
    },
    dataLabels: { enabled: true },
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
          labels: {
            show: true,
            name: { show: true },
            value: { show: true, fontSize: "1.5rem" },
            total: { show: true, label: t("dashboard.total"), formatter: () => total.toString() },
          },
        },
      },
    },
    responsive: [
      { breakpoint: 640, options: { legend: { position: "bottom" } } },
    ],
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200/80 bg-white/95 p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/60 md:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {t("dashboard.serviceRequestsByStatus")}
        </h3>
        <div className="mt-4 flex h-64 animate-pulse items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700/50" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white/95 p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/60 md:p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {t("dashboard.serviceRequestsByStatus")}
      </h3>
      {total === 0 ? (
        <div className="mt-4 flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
          {t("dashboard.noServiceRequestData")}
        </div>
      ) : (
        <div className="mt-4">
          <Chart options={options} series={series} type="donut" height={320} />
        </div>
      )}
    </div>
  );
}
