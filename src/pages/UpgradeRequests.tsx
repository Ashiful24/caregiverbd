import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import Badge from "../components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { upgradeRequestsApi, type UpgradeRequestListItem } from "../services/api";
import { formatDate, formatStatusLabel } from "../utils/format";

type StatusFilter = "PENDING" | "all";

export default function UpgradeRequests() {
  const { t } = useTranslation();
  const [list, setList] = useState<UpgradeRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params =
        statusFilter === "PENDING"
          ? { status: "PENDING" as const }
          : undefined;
      const response = await upgradeRequestsApi.list(params);
      setList(Array.isArray(response.data) ? response.data : []);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("upgradeRequests.failedLoadList");
      setError(message);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, t]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return (
    <>
      <PageMeta
        title={t("upgradeRequests.listMetaTitle")}
        description={t("upgradeRequests.listMetaDescription")}
      />
      <PageBreadcrumb pageTitle={t("upgradeRequests.listPageTitle")} />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {t("upgradeRequests.listHeading")}
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter("PENDING")}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                statusFilter === "PENDING"
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {t("upgradeRequests.pending")}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                statusFilter === "all"
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {t("common.all")}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            {t("systemConfig.loading")}
          </div>
        ) : list.length === 0 ? (
          <p className="py-8 text-center text-gray-500 dark:text-gray-400">
            {statusFilter === "PENDING"
              ? t("upgradeRequests.noPending")
              : t("upgradeRequests.noRequests")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                <TableRow>
                  <TableCell isHeader className="py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{t("upgradeRequests.provider")}</TableCell>
                  <TableCell isHeader className="py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{t("upgradeRequests.currentType")}</TableCell>
                  <TableCell isHeader className="py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{t("upgradeRequests.targetType")}</TableCell>
                  <TableCell isHeader className="py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{t("upgradeRequests.status")}</TableCell>
                  <TableCell isHeader className="py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{t("upgradeRequests.requested")}</TableCell>
                  <TableCell isHeader className="py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{t("upgradeRequests.actions")}</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {list.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="py-3 font-medium text-gray-800 dark:text-white/90">
                      {req.providerName ?? `Provider #${req.providerId}`}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-gray-600 dark:text-gray-400">
                      {req.currentConsultationTypeName ?? t("common.noValue")}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-gray-600 dark:text-gray-400">
                      {req.targetConsultationTypeName ?? t("common.noValue")}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        size="sm"
                        color={
                          req.status === "PENDING"
                            ? "warning"
                            : req.status === "APPROVED"
                              ? "success"
                              : "error"
                        }
                      >
                        {formatStatusLabel(req.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-gray-600 dark:text-gray-400">
                      {req.createdAt ? formatDate(req.createdAt) : t("common.noValue")}
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <Link
                        to={`/upgrade-requests/${req.id}`}
                        className="rounded border border-brand-500 bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50"
                      >
                        {t("common.actions.view")}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
