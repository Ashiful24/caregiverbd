import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../ui/button/Button";
import { Modal } from "../ui/modal";
import {
  adminLongTermOpportunitiesApi,
  adminSupervisorsApi,
  normalizeAdminSupervisorsListResponse,
  type AdminSupervisorDto,
  type LongTermOpportunityListItem,
} from "../../services/api";

function supervisorLabel(s: AdminSupervisorDto): string {
  const first = s.firstName?.trim() ?? "";
  const last = s.lastName?.trim() ?? "";
  const joined = [first, last].filter(Boolean).join(" ");
  if (joined) return joined;
  return s.email?.trim() || s.username?.trim() || `Supervisor #${s.id}`;
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  opportunity: LongTermOpportunityListItem | null;
  onAssigned?: (updated: LongTermOpportunityListItem) => void;
};

const PAGE_SIZE = 20;

export function AssignSupervisorModal({ isOpen, onClose, opportunity, onAssigned }: Props) {
  const { t } = useTranslation();
  const [supervisors, setSupervisors] = useState<AdminSupervisorDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastBatchSize, setLastBatchSize] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listLoadingMore, setListLoadingMore] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const lastLoadedSearchRef = useRef<string | null>(null);

  const loadSupervisors = useCallback(
    async (searchTerm: string) => {
      lastLoadedSearchRef.current = searchTerm.trim();
      setListLoading(true);
      setError(null);
      try {
        const res = await adminSupervisorsApi.getAll({
          page: 1,
          limit: PAGE_SIZE,
          search: searchTerm.trim() || undefined,
        });
        const norm = normalizeAdminSupervisorsListResponse(res.data);
        setSupervisors(norm.supervisors);
        setTotal(norm.total);
        setPage(1);
        setLastBatchSize(norm.supervisors.length);
      } catch (err: unknown) {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : t("schedule.failedToLoadSupervisors");
        setError(message);
        setSupervisors([]);
        setTotal(0);
        setLastBatchSize(0);
      } finally {
        setListLoading(false);
      }
    },
    [t]
  );

  const fetchMore = useCallback(
    async (nextPage: number) => {
      setListLoadingMore(true);
      setError(null);
      try {
        const res = await adminSupervisorsApi.getAll({
          page: nextPage,
          limit: PAGE_SIZE,
          search: searchQuery.trim() || undefined,
        });
        const norm = normalizeAdminSupervisorsListResponse(res.data);
        setTotal(norm.total);
        setPage(nextPage);
        setLastBatchSize(norm.supervisors.length);
        setSupervisors((prev) => {
          const existing = new Set(prev.map((s) => s.id));
          const extra = norm.supervisors.filter((s) => !existing.has(s.id));
          return [...prev, ...extra];
        });
      } catch (err: unknown) {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : t("schedule.failedToAssignSupervisor");
        setError(message);
      } finally {
        setListLoadingMore(false);
      }
    },
    [searchQuery, t]
  );

  useEffect(() => {
    if (!isOpen || !opportunity) return;
    setSearchInput("");
    setSearchQuery("");
    setError(null);
    setSelectedId(opportunity.supervisorId ?? null);
    void loadSupervisors("");
  }, [isOpen, opportunity?.id, loadSupervisors]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!isOpen || !opportunity) return;
    if (lastLoadedSearchRef.current === searchQuery.trim()) return;
    void loadSupervisors(searchQuery);
  }, [isOpen, opportunity?.id, searchQuery, loadSupervisors]);

  const handleClose = () => {
    setSupervisors([]);
    setTotal(0);
    setPage(1);
    setLastBatchSize(0);
    setSelectedId(null);
    setError(null);
    setSubmitting(false);
    setSearchInput("");
    setSearchQuery("");
    lastLoadedSearchRef.current = null;
    onClose();
  };

  const lastPageFull = lastBatchSize >= PAGE_SIZE;
  const canLoadMore =
    lastBatchSize > 0 && lastPageFull && (total <= 0 || supervisors.length < total);

  const handleAssign = async () => {
    if (!opportunity) return;
    if (selectedId == null || !Number.isFinite(selectedId) || selectedId <= 0) {
      setError(t("schedule.selectSupervisorFirst"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await adminLongTermOpportunitiesApi.assignSupervisor(opportunity.id, {
        supervisorId: selectedId,
      });
      const selected = supervisors.find((s) => s.id === selectedId);
      const updated: LongTermOpportunityListItem = {
        ...opportunity,
        supervisorId: selectedId,
        supervisorName: selected ? supervisorLabel(selected) : opportunity.supervisorName,
      };
      onAssigned?.(updated);
      handleClose();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("schedule.failedToAssignSupervisor");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!opportunity) return null;

  const requestLabel =
    opportunity.requestNo?.trim() || (opportunity.id ? `SR-${opportunity.id}` : "—");

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      showCloseButton
      className="max-h-[min(90vh,720px)] w-full max-w-xl overflow-hidden p-0 sm:p-0"
    >
      <div className="flex max-h-[min(90vh,720px)] min-h-0 flex-col">
        <div className="shrink-0 border-b border-gray-200 px-6 pb-4 pt-6 dark:border-gray-800">
          <h3 className="pr-10 text-xl font-semibold text-gray-900 dark:text-white/90">
            {t("schedule.assignSupervisorTitle")}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("schedule.assignSupervisorFor", { requestNo: requestLabel })}
          </p>
          {opportunity.supervisorName ? (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("schedule.currentSupervisor")}:{" "}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {opportunity.supervisorName}
              </span>
            </p>
          ) : null}
          <div className="relative mt-3">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
            <input
              type="search"
              placeholder={t("supervisor.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {listLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("supervisor.loadingSupervisors")}
            </p>
          ) : supervisors.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchQuery.trim()
                ? t("supervisor.noSupervisorsMatchSearch")
                : t("supervisor.noSupervisorsFound")}
            </p>
          ) : (
            <ul className="space-y-2" role="radiogroup" aria-label={t("schedule.assignSupervisorTitle")}>
              {supervisors.map((s) => {
                const checked = selectedId === s.id;
                const name = supervisorLabel(s);
                return (
                  <li key={s.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                        checked
                          ? "border-brand-500 bg-brand-50/80 dark:border-brand-500 dark:bg-brand-950/30"
                          : "border-gray-100 bg-gray-50/80 hover:border-gray-200 dark:border-gray-800 dark:bg-gray-900/40 dark:hover:border-gray-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="assign-supervisor"
                        value={s.id}
                        checked={checked}
                        onChange={() => {
                          setSelectedId(s.id);
                          setError(null);
                        }}
                        className="mt-1 size-4 shrink-0 accent-brand-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-gray-900 dark:text-white/90">
                          {name}
                        </span>
                        {s.email ? (
                          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-500">
                            {s.email}
                          </span>
                        ) : null}
                        {s.region ? (
                          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-500">
                            {t("supervisor.region")}: {s.region}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {error ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          ) : null}
        </div>

        {!listLoading && canLoadMore ? (
          <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-950/40">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => void fetchMore(page + 1)}
              disabled={listLoadingMore}
              className="w-full"
            >
              {listLoadingMore ? t("common.actions.loadingMore") : t("common.actions.loadMore")}
            </Button>
          </div>
        ) : null}

        <div className="shrink-0 border-t border-gray-200 bg-gray-50/80 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void handleAssign()}
              disabled={submitting || listLoading || selectedId == null}
            >
              {submitting ? t("schedule.assigningSupervisor") : t("schedule.assignSupervisor")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
