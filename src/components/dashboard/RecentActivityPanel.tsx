import { formatDate, formatTime } from "../../utils/format";
import { useTranslation } from "react-i18next";
import type { DashboardRecentServiceRequest } from "../../services/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";

const statusBadgeColor: Record<string, "success" | "warning" | "error" | "info" | "light"> = {
  PENDING: "warning",
  ACCEPTED: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  CANCELLED: "light",
  REJECTED: "error",
};

function getStatusBadgeColor(status: string): "success" | "warning" | "error" | "info" | "light" {
  const key = String(status).toUpperCase();
  return statusBadgeColor[key] ?? "light";
}

function statusLabel(status: string, t: (key: string) => string): string {
  const key = String(status).toUpperCase();
  switch (key) {
    case "PENDING":
      return t("common.status.pending");
    case "ACCEPTED":
      return t("common.status.accepted");
    case "IN_PROGRESS":
      return t("common.status.inProgress");
    case "COMPLETED":
      return t("common.status.completed");
    case "CANCELLED":
      return t("common.status.cancelled");
    case "REJECTED":
      return t("common.status.rejected");
    default:
      return status;
  }
}

export interface RecentActivityPanelProps {
  items: DashboardRecentServiceRequest[];
  loading?: boolean;
}

export function RecentActivityPanel({ items, loading }: RecentActivityPanelProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          {t("dashboard.recentActivity")}
        </h3>
        <div className="mt-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-100 py-3 animate-pulse dark:border-gray-700">
              <div className="h-4 flex-1 max-w-[120px] rounded bg-gray-200 dark:bg-gray-600" />
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-600" />
              <div className="h-6 w-20 rounded-full bg-gray-200 dark:bg-gray-600" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          {t("dashboard.recentActivity")}
        </h3>
        {items?.length > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {t("dashboard.latestServiceRequests")}
          </span>
        )}
      </div>

      {!items?.length ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          {t("dashboard.noRecentServiceRequests")}
        </p>
      ) : (
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-y border-gray-100 dark:border-gray-800">
              <TableRow>
                <TableCell
                  isHeader
                  className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  {t("dashboard.patient")}
                </TableCell>
                <TableCell
                  isHeader
                  className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  {t("dashboard.provider")}
                </TableCell>
                <TableCell
                  isHeader
                  className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  {t("dashboard.dateTime")}
                </TableCell>
                <TableCell
                  isHeader
                  className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  {t("dashboard.status")}
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.slice(0, 10).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="py-3">
                    <p className="min-w-0 truncate font-medium text-gray-800 text-theme-sm dark:text-white/90">
                      {row.patientName ?? t("common.noValue")}
                    </p>
                  </TableCell>
                  <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                    {row.providerName ?? t("common.noValue")}
                  </TableCell>
                  <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                    <div>
                      <p>{formatDate(row.createdAt)}</p>
                      <p className="text-theme-xs">{formatTime(row.createdAt)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge size="sm" color={getStatusBadgeColor(row.status)}>
                      {statusLabel(row.status, t)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
