import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { ActionsMenu } from "../components/common/ActionsMenu";
import { DropdownItem } from "../components/ui/dropdown/DropdownItem";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { CalenderIcon } from "../icons";
import {
  adminLongTermOpportunitiesApi,
  normalizeLongTermOpportunitiesListResponse,
  type LongTermOpportunityListItem,
  type LongTermOpportunityStatusFilter,
} from "../services/api";
import { formatDate } from "../utils/format";

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
  const [openActionsId, setOpenActionsId] = useState<number | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement>(null);

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

  const goToCalendar = (requestId: number) => {
    setOpenActionsId(null);
    navigate(`/schedule/${requestId}`);
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
                      <ActionsMenu
                        isOpen={openActionsId === request.id}
                        onClose={() => setOpenActionsId(null)}
                        onButtonClick={() =>
                          setOpenActionsId(openActionsId === request.id ? null : request.id)
                        }
                        buttonRef={openActionsId === request.id ? actionsButtonRef : undefined}
                      >
                        <DropdownItem
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            goToCalendar(request.id);
                          }}
                          className="dark:hover:bg-gray-700 dark:text-gray-200"
                        >
                          View calendar
                        </DropdownItem>
                      </ActionsMenu>
                    </div>
                    <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">Amount</dt>
                        <dd className="text-gray-800 dark:text-gray-200">{formatAmount(request)}</dd>
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
                        className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Status
                      </TableCell>
                      <TableCell
                        isHeader
                        className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Amount
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
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {request.status || "—"}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {formatAmount(request)}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {formatRequestWindow(request)}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {request.assignedNursesLabel ?? "—"}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <ActionsMenu
                            isOpen={openActionsId === request.id}
                            onClose={() => setOpenActionsId(null)}
                            onButtonClick={() =>
                              setOpenActionsId(openActionsId === request.id ? null : request.id)
                            }
                            buttonRef={openActionsId === request.id ? actionsButtonRef : undefined}
                          >
                            <DropdownItem
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                goToCalendar(request.id);
                              }}
                              className="dark:hover:bg-gray-700 dark:text-gray-200"
                            >
                              View calendar
                            </DropdownItem>
                          </ActionsMenu>
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
    </>
  );
}
