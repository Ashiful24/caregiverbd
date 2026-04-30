import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { ActionsMenu } from "../components/common/ActionsMenu";
import { DetailModal } from "../components/common/DetailModal";
import { PatientFullDetailsView } from "../components/common/ProfileDetailBlocks";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import Badge from "../components/ui/badge/Badge";
import { DropdownItem } from "../components/ui/dropdown/DropdownItem";
import { patientsApi, type PatientFullDetailsDto, type PatientListItem } from "../services/api";
import { formatDate } from "../utils/format";

const LIMIT_OPTIONS = [10, 20, 50];
const SEARCH_DEBOUNCE_MS = 300;

export default function PatientList() {
  const { t } = useTranslation();
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [openActionsId, setOpenActionsId] = useState<number | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailPatientId, setDetailPatientId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<PatientFullDetailsDto | null>(null);

  // Debounce search: update searchQuery (and reset to page 1) after user stops typing
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  /** Refetch list. Use silent: true after detail updates to avoid full-page skeleton. */
  const fetchPatients = async (signal?: AbortSignal, options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    let aborted = false;
    try {
      const response = await patientsApi.getList(
        { page, limit, search: searchQuery || undefined },
        { signal }
      );
      // Backend returns { patients: [], total, page, limit } (no totalPages)
      const payload = response.data as { patients?: PatientListItem[]; total?: number; page?: number; limit?: number } | null;
      const list = payload?.patients ?? [];
      const totalCount = payload?.total ?? 0;
      const limitVal = payload?.limit ?? limit;

      setPatients(Array.isArray(list) ? list : []);
      setTotal(totalCount);
      setTotalPages(limitVal > 0 ? Math.ceil(totalCount / limitVal) : 1);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        aborted = true;
        return;
      }
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("patients.failedLoad");
      if (!silent) setError(message);
      if (!silent) {
        setPatients([]);
        setTotal(0);
        setTotalPages(0);
      }
    } finally {
      if (!aborted && !silent) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchPatients(controller.signal);
    return () => controller.abort();
  }, [page, limit, searchQuery]);

  const loadPatientDetail = useCallback(async (patientId: number) => {
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await patientsApi.getDetails(patientId);
      const data = (res?.data ?? res) as PatientFullDetailsDto | null;
      setDetailData(data);
    } catch {
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (detailModalOpen && detailPatientId != null) {
      loadPatientDetail(detailPatientId);
    } else {
      setDetailData(null);
    }
  }, [detailModalOpen, detailPatientId, loadPatientDetail]);

  const openDetails = (patientId: number) => {
    setOpenActionsId(null);
    setDetailPatientId(patientId);
    setDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setDetailPatientId(null);
    setDetailData(null);
  };

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <>
      <PageMeta
        title={t("patients.metaTitle")}
        description={t("patients.metaDescription")}
      />
      <PageBreadcrumb pageTitle={t("patients.pageTitle")} />
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {t("patients.heading")}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("patients.subheading")}
            </p>
          </div>
          <div className="flex shrink-0 sm:ml-auto">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="search"
                placeholder={t("patients.searchPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full min-w-[200px] rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500 sm:w-56"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-4 mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 sm:mx-6">
            {error}
          </div>
        )}

        <div className="px-4 sm:px-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : patients.length === 0 ? (
            <div className="py-16 text-center text-gray-500 dark:text-gray-400">
              {t("patients.noPatientsFound")}
            </div>
          ) : (
            <>
              {/* Mobile: card list (stacked cards, no horizontal scroll) */}
              <div className="space-y-3 md:hidden">
                {patients.map((patient, index) => (
                  <div
                    key={patient.id}
                    className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/30"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-200 pb-3 dark:border-gray-700">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                        {patient.firstName} {patient.lastName}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge
                          size="sm"
                          color={patient.isActive !== false ? "success" : "error"}
                        >
                          {patient.isActive !== false ? t("common.status.active") : t("common.status.inactive")}
                        </Badge>
                        <ActionsMenu
                          isOpen={openActionsId === patient.id}
                          onClose={() => setOpenActionsId(null)}
                          onButtonClick={() => setOpenActionsId(openActionsId === patient.id ? null : patient.id)}
                          buttonRef={openActionsId === patient.id ? actionsButtonRef : undefined}
                        >
                          <DropdownItem
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openDetails(patient.id);
                            }}
                            className="dark:hover:bg-gray-700 dark:text-gray-200"
                          >
                            {t("patients.viewFullDetails")}
                          </DropdownItem>
                        </ActionsMenu>
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">#</dt>
                        <dd className="text-gray-800 dark:text-gray-200">{(page - 1) * limit + index + 1}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">{t("patients.email")}</dt>
                        <dd className="truncate text-right text-gray-800 dark:text-gray-200">{patient.email ?? "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">{t("patients.phone")}</dt>
                        <dd className="truncate text-right text-gray-800 dark:text-gray-200">{patient.username ?? "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">{t("patients.nid")}</dt>
                        <dd className="text-gray-800 dark:text-gray-200">{patient.nidNumber ?? "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">{t("patients.registered")}</dt>
                        <dd className="text-gray-800 dark:text-gray-200">{formatDate(patient.createdAt)}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>

              {/* Desktop: table (scrollable on small tablets if needed) */}
              <div className="hidden overflow-x-auto md:block" style={{ WebkitOverflowScrolling: "touch" }}>
                <Table>
                  <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                    <TableRow>
                      <TableCell
                        isHeader
                        className="w-[5%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        #
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[18%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        {t("patients.name")}
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[18%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        {t("patients.email")}
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[14%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        {t("patients.phone")}
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[12%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        {t("patients.nid")}
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[16%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        {t("patients.registered")}
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[10%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        {t("patients.status")}
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[8%] py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        {t("patients.actions")}
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {patients.map((patient, index) => (
                      <TableRow key={patient.id}>
                        <TableCell className="py-3 text-theme-sm text-gray-700 dark:text-gray-300">
                          {(page - 1) * limit + index + 1}
                        </TableCell>
                        <TableCell className="py-3 font-medium text-gray-800 dark:text-white/90">
                          {patient.firstName} {patient.lastName}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400 truncate max-w-[140px]" title={patient.email ?? ""}>
                          {patient.email ?? "—"}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {patient.username ?? "—"}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {patient.nidNumber ?? "—"}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {formatDate(patient.createdAt)}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            size="sm"
                            color={patient.isActive !== false ? "success" : "error"}
                          >
                            {patient.isActive !== false ? t("common.status.active") : t("common.status.inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <ActionsMenu
                            isOpen={openActionsId === patient.id}
                            onClose={() => setOpenActionsId(null)}
                            onButtonClick={() => setOpenActionsId(openActionsId === patient.id ? null : patient.id)}
                            buttonRef={openActionsId === patient.id ? actionsButtonRef : undefined}
                          >
                            <DropdownItem
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openDetails(patient.id);
                              }}
                              className="dark:hover:bg-gray-700 dark:text-gray-200"
                            >
                              {t("patients.viewFullDetails")}
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

        {!loading && patients.length > 0 && totalPages > 0 && (
          <div className="flex flex-col gap-4 border-t border-gray-200 px-4 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                {t("pagination.rowsPerPage")}
                <select
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
                </select>
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t("pagination.showingRangeOf", {
                  from,
                  to,
                  total,
                  entity: t("patients.patientsEntity"),
                })}
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
        )}
      </div>

      <DetailModal
        title={t("patients.detailsTitle")}
        isOpen={detailModalOpen}
        onClose={closeDetailModal}
        loading={detailLoading}
        errorMessage={!detailLoading && !detailData ? t("patients.detailsLoadError") : null}
      >
        {detailData && (
          <PatientFullDetailsView
            data={detailData}
            onRefresh={
              detailPatientId != null
                ? () => {
                    loadPatientDetail(detailPatientId);
                    fetchPatients(undefined, { silent: true });
                  }
                : undefined
            }
          />
        )}
      </DetailModal>
    </>
  );
}
