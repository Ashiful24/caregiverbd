import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { CalenderIcon, PencilIcon, ViewIcon } from "../icons";
import {
  adminLongTermOpportunitiesApi,
  normalizeLongTermOpportunitiesListResponse,
  normalizeLongTermOpportunityRow,
  type LongTermOpportunityListItem,
  type LongTermOpportunityStatusFilter,
} from "../services/api";
import { formatDate } from "../utils/format";
import { Modal } from "../components/ui/modal";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const STATUS_TABS: { value: "all" | LongTermOpportunityStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "REQUESTED", label: "Requested" },
  { value: "SCHEDULE_PROPOSED", label: "Schedule proposed" },
  { value: "CHANGE_REQUESTED", label: "Change requested" },
  { value: "SCHEDULE_CONFIRMED", label: "Schedule confirmed" },
  { value: "PAYMENT_COMPLETED", label: "Payment completed" },
  { value: "IN_PROGRESS", label: "In progress" },
];

function formatRequestWindow(row: LongTermOpportunityListItem): string {
  const start = row.startDate;
  const end = row.endDate;
  if (start && end) {
    return `${formatDate(start)} – ${formatDate(end)}`;
  }
  if (start) return formatDate(start);
  if (end) return formatDate(end);
  return "—";
}

function rowTitle(row: LongTermOpportunityListItem): string {
  const no = row.requestNo?.trim() || (row.id ? `SR-${row.id}` : "—");
  const name = row.patientName?.trim() || "—";
  return `${no} — ${name}`;
}

function formatAmount(row: LongTermOpportunityListItem): string {
  const raw = row.amount?.trim();
  if (!raw) return "—";
  const n = Number(raw);
  if (Number.isFinite(n)) return n.toLocaleString();
  return raw;
}

function formatTimeRange(row: LongTermOpportunityListItem): string {
  return row.timeRange?.trim() || "—";
}

function resolveOpportunityFromScheduleDetails(data: unknown): LongTermOpportunityListItem {
  const candidates: unknown[] = [];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    candidates.push(
      o,
      o.data,
      o.opportunity,
      o.longTermOpportunity,
      o.serviceRequest,
      o.request,
      o.scheduleDetails
    );
  } else {
    candidates.push(data);
  }
  for (const candidate of candidates) {
    const normalized = normalizeLongTermOpportunityRow(candidate);
    if (normalized.id > 0) return normalized;
  }
  return { id: 0, status: "" };
}

function extractOpportunityPayload(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const nestedData = o.data && typeof o.data === "object" ? (o.data as Record<string, unknown>) : null;
  const candidates: unknown[] = [o.opportunity, nestedData?.opportunity, o.longTermOpportunity, o.serviceRequest, o.request, o];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const co = candidate as Record<string, unknown>;
    const idVal = Number(co.id ?? co.serviceRequestId ?? co.service_request_id);
    if (Number.isFinite(idVal) && idVal > 0) return { ...co };
  }
  return null;
}

export default function NurseScheduleList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<LongTermOpportunityListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [statusTab, setStatusTab] = useState<"all" | LongTermOpportunityStatusFilter>("all");
  const [detailsItem, setDetailsItem] = useState<LongTermOpportunityListItem | null>(null);
  const [updateItem, setUpdateItem] = useState<LongTermOpportunityListItem | null>(null);
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateAmount, setUpdateAmount] = useState("");
  const [updatePreferredStartTime, setUpdatePreferredStartTime] = useState("");
  const [updateShiftDurationHours, setUpdateShiftDurationHours] = useState("");
  const [updateStartDate, setUpdateStartDate] = useState("");
  const [updateEndDate, setUpdateEndDate] = useState("");
  const [updateSaving, setUpdateSaving] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const fetchList = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const res = await adminLongTermOpportunitiesApi.getList(
          {
            page,
            limit,
            status: statusTab === "all" ? undefined : statusTab,
          },
          { signal }
        );
        const norm = normalizeLongTermOpportunitiesListResponse(res.data);
        setItems(norm.items.filter((r) => r.id > 0));
        setTotal(norm.total);
        const lp = norm.limit > 0 ? norm.limit : limit;
        setTotalPages(lp > 0 ? Math.ceil(norm.total / lp) || 1 : 1);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Failed to load service requests.";
        setError(message);
        setItems([]);
        setTotal(0);
        setTotalPages(0);
      } finally {
        setLoading(false);
      }
    },
    [page, limit, statusTab]
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchList(controller.signal);
    return () => controller.abort();
  }, [fetchList]);

  const fetchScheduleDetailsOpportunity = async (requestId: number) => {
    const res = await adminLongTermOpportunitiesApi.getScheduleDetails(requestId);
    const normalized = resolveOpportunityFromScheduleDetails(res.data);
    return { normalized, raw: res.data };
  };

  const goToCalendar = async (request: LongTermOpportunityListItem) => {
    setActionLoadingId(request.id);
    try {
      const { normalized, raw } = await fetchScheduleDetailsOpportunity(request.id);
      const routeRequest = normalized.id > 0 ? normalized : request;
      navigate(`/schedule/${request.id}`, { state: { request: routeRequest, scheduleDetails: raw } });
    } catch {
      navigate(`/schedule/${request.id}`, { state: { request } });
    } finally {
      setActionLoadingId(null);
    }
  };

  const openDetails = async (request: LongTermOpportunityListItem) => {
    setActionLoadingId(request.id);
    try {
      const { normalized } = await fetchScheduleDetailsOpportunity(request.id);
      setDetailsItem(normalized.id > 0 ? normalized : request);
    } catch {
      setDetailsItem(request);
    } finally {
      setActionLoadingId(null);
    }
  };

  const openUpdate = async (request: LongTermOpportunityListItem) => {
    setActionLoadingId(request.id);
    let source = request;
    try {
      const { normalized, raw } = await fetchScheduleDetailsOpportunity(request.id);
      if (normalized.id > 0) source = normalized;
      void extractOpportunityPayload(raw);
    } catch {
      // fall back to list row values
    } finally {
      setActionLoadingId(null);
    }
    setUpdateItem(source);
    setUpdateStatus(source.status || "");
    setUpdateAmount(source.amount?.trim() || "");
    setUpdatePreferredStartTime(source.preferredStartTime?.trim() || "");
    setUpdateShiftDurationHours(
      source.shiftDurationHours != null ? String(source.shiftDurationHours) : ""
    );
    setUpdateStartDate(source.startDate?.slice(0, 10) || "");
    setUpdateEndDate(source.endDate?.slice(0, 10) || "");
    setUpdateError("");
  };

  const closeUpdate = () => {
    setUpdateItem(null);
    setUpdateStatus("");
    setUpdateAmount("");
    setUpdatePreferredStartTime("");
    setUpdateShiftDurationHours("");
    setUpdateStartDate("");
    setUpdateEndDate("");
    setUpdateSaving(false);
    setUpdateError("");
  };

  const handleSaveUpdate = async () => {
    if (!updateItem) return;
    setUpdateSaving(true);
    setUpdateError("");
    const payload: Record<string, unknown> = {
      status: updateStatus.trim() || updateItem.status,
    };
    try {
      const res = await adminLongTermOpportunitiesApi.updateOpportunity(updateItem.id, payload);
      const fromApi = resolveOpportunityFromScheduleDetails(res.data);
      const updated: LongTermOpportunityListItem =
        fromApi.id > 0
          ? fromApi
          : {
              ...updateItem,
              status: updateStatus.trim() || updateItem.status,
            };
      setItems((prev) => prev.map((row) => (row.id === updateItem.id ? updated : row)));
      setDetailsItem((prev) => (prev?.id === updateItem.id ? updated : prev));
      closeUpdate();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to update service request.";
      setUpdateError(message);
    } finally {
      setUpdateSaving(false);
    }
  };

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <>
      <PageMeta
        title="Service requests | Hope - BMQAS"
        description="Long-term service requests — Hope Pro"
      />
      <PageBreadcrumb pageTitle="Service request" />
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border-gray-800">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
              <CalenderIcon className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Service requests</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Long-term opportunities and scheduling workflow. Open a row to view the calendar.
              </p>
            </div>
          </div>
        </div>

        {/* Status tabs */}
        <div className="border-b border-gray-200 px-4 dark:border-gray-800 sm:px-6">
          <nav className="-mb-px flex gap-4 overflow-x-auto pb-px sm:gap-6" aria-label="Status filter">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setStatusTab(t.value);
                  setPage(1);
                }}
                className={`shrink-0 whitespace-nowrap border-b-2 py-4 text-sm font-medium transition-colors ${
                  statusTab === t.value
                    ? "border-brand-500 text-brand-500 dark:border-brand-500 dark:text-brand-500"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {error ? (
          <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 sm:mx-6">
            {error}
          </div>
        ) : null}

        <div className="px-4 py-4 sm:px-6 lg:py-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              No service requests found for this filter.
            </p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {items.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/30"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-gray-200 pb-3 dark:border-gray-700">
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-white/90">{rowTitle(request)}</p>
                        <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          {request.status || "—"}
                        </p>
                        {request.location ? (
                          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{request.location}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="View calendar"
                          aria-label="View calendar"
                          disabled={actionLoadingId === request.id}
                          onClick={() => void goToCalendar(request)}
                          className="rounded-md border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          <CalenderIcon className="size-4" />
                        </button>
                        <button
                          type="button"
                          title="Details"
                          aria-label="Details"
                          disabled={actionLoadingId === request.id}
                          onClick={() => void openDetails(request)}
                          className="rounded-md border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          <ViewIcon className="size-4" />
                        </button>
                        <button
                          type="button"
                          title="Update"
                          aria-label="Update"
                          disabled={actionLoadingId === request.id}
                          onClick={() => void openUpdate(request)}
                          className="rounded-md border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          <PencilIcon className="size-4" />
                        </button>
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">Amount</dt>
                        <dd className="text-gray-800 dark:text-gray-200">{formatAmount(request)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">Time range</dt>
                        <dd className="text-gray-800 dark:text-gray-200">{formatTimeRange(request)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">Requested window</dt>
                        <dd className="text-gray-800 dark:text-gray-200">{formatRequestWindow(request)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">Assigned nurses</dt>
                        <dd className="text-right text-gray-800 dark:text-gray-200">
                          {request.assignedNursesLabel ?? "—"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                    <TableRow>
                      <TableCell
                        isHeader
                        className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Request no
                      </TableCell>
                      <TableCell
                        isHeader
                        className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Patient
                      </TableCell>
                      <TableCell
                        isHeader
                        className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Location
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[140px] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Status
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[120px] py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Amount
                      </TableCell>
                      <TableCell
                        isHeader
                        className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Time range
                      </TableCell>
                      <TableCell
                        isHeader
                        className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Requested window
                      </TableCell>
                      <TableCell
                        isHeader
                        className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Assigned nurses
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[120px] py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {items.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="py-3 font-medium text-gray-800 dark:text-white/90">
                          {request.requestNo?.trim() || `SR-${request.id}`}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {request.patientName?.trim() || "—"}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {request.location?.trim() || "—"}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm leading-snug text-gray-600 dark:text-gray-400">
                          {request.status || "—"}
                        </TableCell>
                        <TableCell className="py-3 text-right text-theme-sm whitespace-nowrap text-gray-600 dark:text-gray-400">
                          {formatAmount(request)}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {formatTimeRange(request)}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {formatRequestWindow(request)}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {request.assignedNursesLabel ?? "—"}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              title="View calendar"
                              aria-label="View calendar"
                              disabled={actionLoadingId === request.id}
                              onClick={() => void goToCalendar(request)}
                              className="rounded-md border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                              <CalenderIcon className="size-4" />
                            </button>
                            <button
                              type="button"
                              title="Details"
                              aria-label="Details"
                              disabled={actionLoadingId === request.id}
                              onClick={() => void openDetails(request)}
                              className="rounded-md border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                              <ViewIcon className="size-4" />
                            </button>
                            <button
                              type="button"
                              title="Update"
                              aria-label="Update"
                              disabled={actionLoadingId === request.id}
                              onClick={() => void openUpdate(request)}
                              className="rounded-md border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                              <PencilIcon className="size-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        {!loading && items.length > 0 && totalPages > 0 ? (
          <div className="flex flex-col gap-4 border-t border-gray-200 px-4 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                Rows per page
                <select
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing <span className="font-medium">{from}</span> to <span className="font-medium">{to}</span> of{" "}
                <span className="font-medium">{total}</span> service requests
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        isOpen={detailsItem !== null}
        onClose={() => setDetailsItem(null)}
        title="Long-term opportunity details"
        className="max-h-[90vh] max-w-3xl overflow-y-auto p-0"
      >
        {detailsItem ? (
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                <p className="text-xs text-gray-500 dark:text-gray-400">Request no</p>
                <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-white/90">
                  {detailsItem.requestNo?.trim() || `SR-${detailsItem.id}`}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                  {detailsItem.status || "—"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                <p className="text-xs text-gray-500 dark:text-gray-400">Patient</p>
                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                  {detailsItem.patientName?.trim() || "—"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                <p className="text-xs text-gray-500 dark:text-gray-400">Location</p>
                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                  {detailsItem.location?.trim() || "—"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                <p className="text-xs text-gray-500 dark:text-gray-400">Amount</p>
                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                  {formatAmount(detailsItem)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                <p className="text-xs text-gray-500 dark:text-gray-400">Time range</p>
                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                  {formatTimeRange(detailsItem)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                <p className="text-xs text-gray-500 dark:text-gray-400">Requested window</p>
                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                  {formatRequestWindow(detailsItem)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
                <p className="text-xs text-gray-500 dark:text-gray-400">Assigned nurses</p>
                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                  {detailsItem.assignedNursesLabel ?? "—"}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={updateItem !== null}
        onClose={closeUpdate}
        title="Update long-term opportunity"
        className="max-h-[90vh] max-w-2xl overflow-y-auto p-0"
      >
        {updateItem ? (
          <form
            className="space-y-4 pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSaveUpdate();
            }}
          >
            <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:border-brand-800/40 dark:bg-brand-900/20 dark:text-brand-200">
              Save will update this long-term opportunity via API.
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm text-gray-700 dark:text-gray-300">
                Status
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  {[
                    "REQUESTED",
                    "SCHEDULE_PROPOSED",
                    "CHANGE_REQUESTED",
                    "SCHEDULE_CONFIRMED",
                    "PAYMENT_COMPLETED",
                    "IN_PROGRESS",
                  ].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-700 dark:text-gray-300">
                Amount
                <input
                  type="text"
                  value={updateAmount}
                  readOnly
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-300"
                />
              </label>
              <label className="text-sm text-gray-700 dark:text-gray-300">
                Preferred start time
                <input
                  type="text"
                  value={updatePreferredStartTime}
                  readOnly
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-300"
                />
              </label>
              <label className="text-sm text-gray-700 dark:text-gray-300">
                Shift duration (hours)
                <input
                  type="number"
                  value={updateShiftDurationHours}
                  readOnly
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-300"
                />
              </label>
              <label className="text-sm text-gray-700 dark:text-gray-300">
                Start date
                <input
                  type="date"
                  value={updateStartDate}
                  readOnly
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-300"
                />
              </label>
              <label className="text-sm text-gray-700 dark:text-gray-300">
                End date
                <input
                  type="date"
                  value={updateEndDate}
                  readOnly
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-300"
                />
              </label>
            </div>
            {updateError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{updateError}</p>
            ) : null}
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-800">
              <button
                type="button"
                onClick={closeUpdate}
                disabled={updateSaving}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateSaving}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {updateSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
