import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { SearchableSelect } from "../components/form/SearchableSelect";
import ThemedSelect from "../components/form/ThemedSelect";
import Badge from "../components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  adminProviderCancelApi,
  patientsApi,
  providersApi,
  type PatientListItem,
  type ProviderCancelReviewListItem,
  type ProviderCancelReviewListResponse,
  type ProviderCancelReviewStatus,
  type ProviderListItem,
} from "../services/api";
import { formatDateTime, formatStatusLabel } from "../utils/format";
import { fmtBDT } from "./financial/shared";

const STATUS_TABS: ProviderCancelReviewStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "REASSIGNED",
  "ALL",
];
const LIMIT_OPTIONS = [20, 50, 100];

function reviewStatusBadgeColor(
  status: string | null
): "success" | "error" | "warning" | "light" {
  switch (status) {
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "error";
    case "REASSIGNED":
      return "light";
    default:
      return "warning";
  }
}

function unwrapListPayload(res: unknown): ProviderCancelReviewListResponse {
  const payload = (res as { data?: ProviderCancelReviewListResponse }).data ?? res;
  return payload as ProviderCancelReviewListResponse;
}

export default function ProviderCancelRequests() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ProviderCancelReviewListItem[]>([]);
  const [summary, setSummary] = useState<ProviderCancelReviewListResponse["summary"] | null>(
    null
  );
  const [hasNext, setHasNext] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [statusTab, setStatusTab] = useState<ProviderCancelReviewStatus>("PENDING");
  const [providerId, setProviderId] = useState<number | "">("");
  const [patientId, setPatientId] = useState<number | "">("");
  const [limit, setLimit] = useState(20);
  const [includeSummary, setIncludeSummary] = useState(false);
  const [includeTotal, setIncludeTotal] = useState(false);

  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [patients, setPatients] = useState<PatientListItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [provRes, patRes] = await Promise.all([
          providersApi.getList({ page: 1, limit: 500, status: "active" }),
          patientsApi.getList({ page: 1, limit: 500 }),
        ]);
        const provBody = (provRes?.data as { providers?: ProviderListItem[] }) ?? provRes;
        const provList =
          (provBody as { providers?: ProviderListItem[] }).providers ??
          (provRes as { providers?: ProviderListItem[] }).providers ??
          [];
        setProviders(Array.isArray(provList) ? provList : []);

        const patList =
          (patRes?.data as { patients?: PatientListItem[] })?.patients ??
          (patRes as { patients?: PatientListItem[] }).patients ??
          [];
        setPatients(Array.isArray(patList) ? patList : []);
      } catch {
        setProviders([]);
        setPatients([]);
      }
    })();
  }, []);

  const providerIdParsed = providerId === "" ? undefined : Number(providerId);
  const patientIdParsed = patientId === "" ? undefined : Number(patientId);

  const baseQuery = useMemo(
    () => ({
      status: statusTab,
      providerId: providerIdParsed,
      patientId: patientIdParsed,
      limit,
      includeSummary,
      includeTotal,
    }),
    [includeSummary, includeTotal, limit, patientIdParsed, providerIdParsed, statusTab]
  );

  const fetchFirstPage = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const res = await adminProviderCancelApi.list(
          { ...baseQuery, page: 1 },
          { signal }
        );
        const body = unwrapListPayload(res);
        setRows(Array.isArray(body.data) ? body.data : []);
        setSummary(body.summary ?? null);
        setHasNext(!!body.hasNext);
        setNextCursor(body.nextCursor ?? null);
        setTotal(body.total);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : t("providerCancelRequests.failedToLoad");
        setError(message);
        setRows([]);
        setSummary(null);
        setHasNext(false);
        setNextCursor(null);
        setTotal(undefined);
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
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const res = await adminProviderCancelApi.list({
        ...baseQuery,
        cursor: nextCursor,
      });
      const body = unwrapListPayload(res);
      setRows((prev) => [...prev, ...(Array.isArray(body.data) ? body.data : [])]);
      if (body.summary) setSummary(body.summary);
      setHasNext(!!body.hasNext);
      setNextCursor(body.nextCursor ?? null);
      if (body.total !== undefined) setTotal(body.total);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("providerCancelRequests.failedToLoad");
      setError(message);
    } finally {
      setLoadingMore(false);
    }
  };

  const providerLabel = (p: ProviderListItem) =>
    [p.firstName, p.lastName].filter(Boolean).join(" ") ||
    p.name ||
    p.providerName ||
    `Provider #${p.id}`;

  const patientLabel = (p: PatientListItem) =>
    [p.firstName, p.lastName].filter(Boolean).join(" ") || `Patient #${p.id}`;

  return (
    <>
      <PageMeta
        title={t("providerCancelRequests.metaTitle")}
        description={t("providerCancelRequests.metaDescription")}
      />
      <PageBreadcrumb pageTitle={t("providerCancelRequests.pageTitle")} />

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <PageHeader
          title={t("providerCancelRequests.heading")}
          subheading={t("providerCancelRequests.subheading")}
          pendingCount={summary?.pending}
          onRefresh={() => fetchFirstPage()}
          loading={loading}
          refreshLabel={
            loading ? t("providerCancelRequests.refreshing") : t("providerCancelRequests.refresh")
          }
        />

        <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-100 pb-3 dark:border-gray-800">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusTab(tab)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                statusTab === tab
                  ? "bg-brand-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {tab === "ALL"
                ? t("providerCancelRequests.tabAll")
                : formatStatusLabel(tab)}
            </button>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <div className="min-w-0 sm:col-span-2 lg:col-span-4">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {t("providerCancelRequests.providerFilter")}
            </label>
            <SearchableSelect<number>
              value={providerId === "" ? null : providerId}
              onChange={(v) => setProviderId(v == null ? "" : v)}
              placeholder={t("providerCancelRequests.allProviders")}
              clearLabel={t("providerCancelRequests.allProviders")}
              searchPlaceholder={t("providerCancelRequests.providerSearchPlaceholder")}
              className="min-h-[42px]"
              options={providers.map((p) => ({
                value: p.id,
                label: providerLabel(p),
                hint: p.email ?? p.username ?? undefined,
              }))}
            />
          </div>
          <div className="min-w-0 sm:col-span-2 lg:col-span-4">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {t("providerCancelRequests.patientFilter")}
            </label>
            <SearchableSelect<number>
              value={patientId === "" ? null : patientId}
              onChange={(v) => setPatientId(v == null ? "" : v)}
              placeholder={t("providerCancelRequests.allPatients")}
              clearLabel={t("providerCancelRequests.allPatients")}
              searchPlaceholder={t("providerCancelRequests.patientSearchPlaceholder")}
              className="min-h-[42px]"
              options={patients.map((p) => ({
                value: p.id,
                label: patientLabel(p),
                hint: p.email ?? p.username ?? undefined,
              }))}
            />
          </div>
          <div className="min-w-0 sm:col-span-2 lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              {t("providerCancelRequests.pageSize")}
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

        <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={includeSummary}
              onChange={(e) => setIncludeSummary(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            {t("providerCancelRequests.includeSummary")}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={includeTotal}
              onChange={(e) => setIncludeTotal(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            {t("providerCancelRequests.includeTotal")}
          </label>
        </div>

        {includeSummary && summary ? (
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryCard label={t("providerCancelRequests.countPending")} value={summary.pending} />
            <SummaryCard
              label={t("providerCancelRequests.countApprovedToday")}
              value={summary.approvedToday}
            />
            <SummaryCard
              label={t("providerCancelRequests.countRejectedToday")}
              value={summary.rejectedToday}
            />
            <SummaryCard
              label={t("providerCancelRequests.countReassignedToday")}
              value={summary.reassignedToday}
            />
          </div>
        ) : null}

        {total != null ? (
          <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
            {t("providerCancelRequests.exactTotal", { total })}
          </p>
        ) : null}

        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : error ? (
          <p className="text-rose-600 dark:text-rose-400">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">{t("providerCancelRequests.noData")}</p>
        ) : (
          <>
            <RequestsTable rows={rows} t={t} />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("providerCancelRequests.loadedRows", { count: rows.length })}
                {hasNext ? ` · ${t("providerCancelRequests.moreAvailable")}` : ""}
              </p>
              {hasNext ? (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  {loadingMore
                    ? t("providerCancelRequests.loadingMore")
                    : t("providerCancelRequests.loadMore")}
                </button>
              ) : null}
            </div>
          </>
        )}
      </section>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 text-center dark:border-gray-700">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function PageHeader({
  title,
  subheading,
  pendingCount,
  onRefresh,
  loading,
  refreshLabel,
}: {
  title: string;
  subheading: string;
  pendingCount?: number;
  onRefresh: () => void;
  loading: boolean;
  refreshLabel: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h3>
        <p className="mt-0.5 max-w-3xl text-xs text-gray-500 dark:text-gray-400">{subheading}</p>
        {pendingCount != null && pendingCount > 0 ? (
          <p className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-400">
            {t("providerCancelRequests.pendingBadge", { count: pendingCount })}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        {refreshLabel}
      </button>
    </div>
  );
}



function RequestsTable({
  rows,
  t,
}: {
  rows: ProviderCancelReviewListItem[];
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-200 dark:border-gray-700">
            <TableCell isHeader className="whitespace-nowrap px-3 py-2 text-xs">
              {t("providerCancelRequests.colSubmitted")}
            </TableCell>
            <TableCell isHeader className="whitespace-nowrap px-3 py-2 text-xs">
              {t("providerCancelRequests.colReviewStatus")}
            </TableCell>
            <TableCell isHeader className="whitespace-nowrap px-3 py-2 text-xs">
              {t("providerCancelRequests.colServiceRequest")}
            </TableCell>
            <TableCell isHeader className="whitespace-nowrap px-3 py-2 text-xs">
              {t("providerCancelRequests.colProvider")}
            </TableCell>
            <TableCell isHeader className="whitespace-nowrap px-3 py-2 text-xs">
              {t("providerCancelRequests.colPatient")}
            </TableCell>
            <TableCell isHeader className="whitespace-nowrap px-3 py-2 text-xs">
              {t("providerCancelRequests.colReason")}
            </TableCell>
            <TableCell isHeader className="whitespace-nowrap px-3 py-2 text-xs">
              {t("providerCancelRequests.colFee")}
            </TableCell>
            <TableCell isHeader className="px-3 py-2 text-xs">
              {" "}
            </TableCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const sr = row.serviceRequest;
            return (
              <TableRow key={row.id} className="border-gray-100 dark:border-gray-800">
                <TableCell className="whitespace-nowrap px-3 py-2 text-xs">
                  {formatDateTime(row.createdAt ?? "")}
                </TableCell>
                <TableCell className="px-3 py-2 text-xs">
                  <Badge size="sm" color={reviewStatusBadgeColor(row.reviewStatus)}>
                    {formatStatusLabel(row.reviewStatus ?? "PENDING")}
                  </Badge>
                  {sr.status ? (
                    <SrStatusHint
                      status={sr.status}
                      title={t("providerCancelRequests.srStatusNote")}
                    />
                  ) : null}
                </TableCell>
                <TableCell className="px-3 py-2 text-xs">
                  <Link
                    className="font-mono text-brand-600 hover:underline dark:text-brand-400"
                    to={`/schedule/${sr.id}`}
                  >
                    #{sr.id}
                  </Link>
                  <div className="text-[11px] text-gray-500">{formatStatusLabel(sr.status ?? "")}</div>
                  {sr.scheduledDate || sr.scheduledTime ? (
                    <div className="text-[11px] text-gray-500">
                      {[sr.scheduledDate, sr.scheduledTime].filter(Boolean).join(" ")}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell
                  className="max-w-[140px] truncate px-3 py-2 text-xs"
                  title={row.provider?.name}
                >
                  {row.provider?.name ?? "—"}
                </TableCell>
                <TableCell
                  className="max-w-[120px] truncate px-3 py-2 text-xs"
                  title={row.patient.name}
                >
                  {row.patient.name}
                </TableCell>
                <TableCell className="max-w-[160px] px-3 py-2 text-xs">
                  <div>
                    {row.reasonCategory ? formatStatusLabel(row.reasonCategory) : "—"}
                  </div>
                  {row.reasonNote ? (
                    <div className="truncate text-[11px] text-gray-500">{row.reasonNote}</div>
                  ) : null}
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2 text-xs">
                  {fmtBDT(sr.fee)}
                </TableCell>
                <TableCell className="px-3 py-2 text-xs">
                  <Link
                    to={`/provider-cancel-requests/${row.id}`}
                    className="text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {t("providerCancelRequests.viewDetail")}
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function SrStatusHint({ status, title }: { status: string; title: string }) {
  return (
    <div className="mt-0.5 text-[10px] text-gray-400" title={title}>
      SR: {formatStatusLabel(status)}
    </div>
  );
}
