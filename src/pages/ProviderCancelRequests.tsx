import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  isProviderCancelBatchItem,
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

const thClass =
  "whitespace-nowrap px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400";
const tdClass = "px-3 py-3 text-xs align-top";

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

function rowsForStatusTab(
  data: ProviderCancelReviewListItem[],
  statusTab: ProviderCancelReviewStatus
): ProviderCancelReviewListItem[] {
  if (statusTab === "ALL") return data;
  return data.filter((row) => row.reviewStatus === statusTab);
}

function tabButtonClass(active: boolean): string {
  return `rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
    active
      ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-900/30 dark:text-brand-300"
      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
  }`;
}

export default function ProviderCancelRequests() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ProviderCancelReviewListItem[]>([]);
  const [summary, setSummary] = useState<ProviderCancelReviewListResponse["summary"] | null>(
    null
  );
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusTab, setStatusTab] = useState<ProviderCancelReviewStatus>("PENDING");
  const [providerId, setProviderId] = useState<number | "">("");
  const [patientId, setPatientId] = useState<number | "">("");
  const [limit, setLimit] = useState(20);
  const [includeSummary, setIncludeSummary] = useState(false);
  const [includeTotal, setIncludeTotal] = useState(false);

  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const requestIdRef = useRef(0);

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
      includeSummary,
      includeTotal,
    }),
    [includeSummary, includeTotal, patientIdParsed, providerIdParsed, statusTab]
  );

  // Reset to page 1 and clear stale rows when any filter changes
  useEffect(() => {
    setCurrentPage(1);
    setRows([]);
    setSummary(null);
    setTotal(undefined);
    setError("");
  }, [statusTab, providerIdParsed, patientIdParsed, limit, includeSummary, includeTotal]);

  const fetchPage = useCallback(
    async (page: number, signal?: AbortSignal) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError("");
      try {
        const res = await adminProviderCancelApi.list(
          { ...baseQuery, page, limit },
          { signal }
        );
        if (requestId !== requestIdRef.current) return;

        const body = unwrapListPayload(res);
        const raw = Array.isArray(body.data) ? body.data : [];
        setRows(rowsForStatusTab(raw, statusTab));
        setSummary(body.summary ?? null);
        setHasNext(!!body.hasNext);
        setHasPrev(page > 1);
        setTotal(body.total);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (requestId !== requestIdRef.current) return;
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : t("providerCancelRequests.failedToLoad");
        setError(message);
        setRows([]);
        setSummary(null);
        setHasNext(false);
        setHasPrev(false);
        setTotal(undefined);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [baseQuery, limit, statusTab, t]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchPage(currentPage, controller.signal);
    return () => controller.abort();
  }, [fetchPage, currentPage]);

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
          pendingCount={includeSummary ? summary?.pending : undefined}
          onRefresh={() => fetchPage(currentPage)}
          loading={loading}
          refreshLabel={
            loading ? t("providerCancelRequests.refreshing") : t("providerCancelRequests.refresh")
          }
        />

        <div className="mb-4 flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusTab(tab)}
              className={tabButtonClass(statusTab === tab)}
            >
              {tab === "ALL"
                ? t("providerCancelRequests.tabAll")
                : formatStatusLabel(tab)}
            </button>
          ))}
        </div>

        <div className="mb-4 space-y-4">
          <FilterGrid
            providerFilter={
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
            }
            patientFilter={
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
            }
            labels={{
              provider: t("providerCancelRequests.providerFilter"),
              patient: t("providerCancelRequests.patientFilter"),
            }}
          />

          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
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

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : !loading && rows.length === 0 ? (
          <p className="py-8 text-center text-gray-500 dark:text-gray-400">
            {t("providerCancelRequests.noData")}
          </p>
        ) : rows.length > 0 ? (
          <>
            <RequestsTable rows={rows} t={t} />
            {/* Pagination bar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {/* Left: page size + row count */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-gray-500 dark:text-gray-400">
                    {t("providerCancelRequests.pageSize")}:
                  </label>
                  <ThemedSelect
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="min-h-[32px] py-1 text-xs"
                  >
                    {LIMIT_OPTIONS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </ThemedSelect>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {total != null
                    ? t("providerCancelRequests.exactTotal", { total })
                    : `${rows.length} rows`}
                </p>
              </div>
              {/* Right: prev / page indicator / next */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!hasPrev || loading}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  ← Prev
                </button>
                <span className="min-w-[60px] text-center text-xs text-gray-600 dark:text-gray-400">
                  Page {currentPage}
                </span>
                <button
                  type="button"
                  disabled={!hasNext || loading}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 text-center dark:border-gray-700">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-lg font-semibold text-gray-800 dark:text-white/90">{value}</div>
    </div>
  );
}

function PageHeader(props: {
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
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{props.title}</h3>
        <p className="mt-0.5 max-w-3xl text-xs text-gray-500 dark:text-gray-400">{props.subheading}</p>
        {props.pendingCount != null && props.pendingCount > 0 ? (
          <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            {t("providerCancelRequests.pendingBadge", { count: props.pendingCount })}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={props.onRefresh}
        disabled={props.loading}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        {props.refreshLabel}
      </button>
    </div>
  );
}

function FilterGrid(props: {
  providerFilter: React.ReactNode;
  patientFilter: React.ReactNode;
  labels: { provider: string; patient: string };
}) {
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
      <div className="min-w-0 sm:col-span-2 lg:col-span-4">
        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
          {props.labels.provider}
        </label>
        {props.providerFilter}
      </div>
      <div className="min-w-0 sm:col-span-2 lg:col-span-4">
        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
          {props.labels.patient}
        </label>
        {props.patientFilter}
      </div>
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
        <TableHeader className="border-b border-gray-200 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-900/40">
          <TableRow>
            <TableCell isHeader className={`${thClass} w-10`}>
              {t("providerCancelRequests.colNo")}
            </TableCell>
            <TableCell isHeader className={thClass}>
              {t("providerCancelRequests.colSubmitted")}
            </TableCell>
            <TableCell isHeader className={thClass}>
              {t("providerCancelRequests.colReviewStatus")}
            </TableCell>
            <TableCell isHeader className={thClass}>
              {t("providerCancelRequests.colVisit")}
            </TableCell>
            <TableCell isHeader className={thClass}>
              {t("providerCancelRequests.colProvider")}
            </TableCell>
            <TableCell isHeader className={thClass}>
              {t("providerCancelRequests.colPatient")}
            </TableCell>
            <TableCell isHeader className={thClass}>
              {t("providerCancelRequests.colReason")}
            </TableCell>
            <TableCell isHeader className={`${thClass} text-right`}>
              {t("providerCancelRequests.colFee")}
            </TableCell>
            <TableCell isHeader className={`${thClass} text-right`}>
              {t("providerCancelRequests.colActions")}
            </TableCell>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((row, index) => (
            <ProviderCancelRow
              key={
                isProviderCancelBatchItem(row)
                  ? `batch-${row.batchId}`
                  : `cancel-${row.id}`
              }
              row={row}
              rowNumber={index + 1}
              t={t}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ProviderCancelRow({
  row,
  rowNumber,
  t,
}: {
  row: ProviderCancelReviewListItem;
  rowNumber: number;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const isPending = row.reviewStatus === "PENDING";
  const isBatch = isProviderCancelBatchItem(row);

  const visitMeta = isBatch
    ? [
        t("providerCancelRequests.longTermBatch"),
        t("providerCancelRequests.shiftCount", { count: row.shiftCount }),
        row.earliestDate && row.latestDate && row.earliestDate !== row.latestDate
          ? t("providerCancelRequests.dateRange", {
              from: row.earliestDate,
              to: row.latestDate,
            })
          : row.earliestDate ?? row.latestDate,
      ]
        .filter(Boolean)
        .join(" · ")
    : (() => {
        const sr = row.serviceRequest;
        const scheduleLabel = [sr.scheduledDate, sr.scheduledTime].filter(Boolean).join(" · ");
        return [
          scheduleLabel,
          sr.status ? formatStatusLabel(sr.status) : null,
          sr.serviceCategory ? formatStatusLabel(sr.serviceCategory) : null,
        ]
          .filter(Boolean)
          .join(" · ");
      })();

  const detailHref = isBatch
    ? `/provider-cancel-requests/batch/${row.batchId}`
    : `/provider-cancel-requests/${row.id}`;

  return (
    <TableRow
      className={`transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40 ${
        isPending ? "bg-amber-50/30 dark:bg-amber-950/10" : ""
      }`}
    >
      <TableCell className={`${tdClass} text-center text-gray-500 dark:text-gray-400`}>
        {rowNumber}
      </TableCell>

      <TableCell className={`${tdClass} whitespace-nowrap text-gray-700 dark:text-gray-300`}>
        {formatDateTime(row.createdAt ?? "")}
      </TableCell>

      <TableCell className={tdClass}>
        <Badge size="sm" color={reviewStatusBadgeColor(row.reviewStatus)}>
          {formatStatusLabel(row.reviewStatus ?? "PENDING")}
        </Badge>
      </TableCell>

      <TableCell className={tdClass}>
        {/* Service type badge */}
        <span className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
          isBatch
            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
        }`}>
          {isBatch ? "Long Term Batch" : "Short Term"}
        </span>
        {visitMeta ? (
          <p className="mb-0.5 text-xs text-gray-600 dark:text-gray-400">{visitMeta}</p>
        ) : null}
        {isBatch ? (
          <Link
            className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            to={detailHref}
            title={t("providerCancelRequests.openBatchTitle", { count: row.shiftCount })}
          >
            {t("providerCancelRequests.openBatch")}
          </Link>
        ) : (
          <Link
            className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            to={`/schedule/${row.serviceRequest.id}`}
            title={t("providerCancelRequests.openVisitTitle", { id: row.serviceRequest.id })}
          >
            {t("providerCancelRequests.openVisit")}
          </Link>
        )}
      </TableCell>

      <TableCell className={tdClass}>
        {row.provider ? (
          <span
            className="max-w-[160px] truncate font-medium text-gray-800 dark:text-white/90"
            title={row.provider.name}
          >
            {row.provider.name}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </TableCell>

      <TableCell className={tdClass}>
        <span
          className="max-w-[140px] truncate font-medium text-gray-800 dark:text-white/90"
          title={row.patient.name}
        >
          {row.patient.name}
        </span>
      </TableCell>
      <TableCell className={`${tdClass} max-w-[200px]`}>
        <ReasonCell category={row.reasonCategory} note={row.reasonNote} />
      </TableCell>

      <TableCell className={`${tdClass} whitespace-nowrap text-right font-medium text-gray-800 dark:text-white/90`}>
        {isBatch ? "—" : fmtBDT(row.serviceRequest.fee)}
      </TableCell>

      <TableCell className={`${tdClass} text-right`}>
        <Link
          to={detailHref}
          className="inline-flex rounded border border-brand-500 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50"
        >
          {isPending ? t("providerCancelRequests.review") : t("common.actions.view")}
        </Link>
      </TableCell>
    </TableRow>
  );
}


function ReasonCell({
  category,
  note,
}: {
  category: string | null;
  note: string | null;
}) {
  return (
    <>
      <div className="font-medium text-gray-800 dark:text-white/90">
        {category ? formatStatusLabel(category) : "—"}
      </div>
      {note ? (
        <ReasonNote note={note} />
      ) : null}
    </>
  );
}

function ReasonNote({ note }: { note: string }) {
  return (
    <div className="mt-0.5 line-clamp-2 text-[11px] text-gray-500 dark:text-gray-400" title={note}>
      {note}
    </div>
  );
}
