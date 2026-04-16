import { useCallback, useEffect, useState } from "react";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import type { SupervisorFullDetails } from "../../data/supervisorSeed";
import {
  adminSupervisorsApi,
  normalizeAssignedProviderIdsResponse,
  normalizeProvidersAllResponse,
  providersApi,
  type ProviderListItem,
} from "../../services/api";
import { getAssetUrl } from "../../utils/assetUrl";

function providerLabel(p: ProviderListItem): string {
  const fn = p.firstName?.trim() ?? "";
  const ln = p.lastName?.trim() ?? "";
  const joined = [fn, ln].filter(Boolean).join(" ");
  if (joined) return joined;
  const single = p.name?.trim() || p.fullName?.trim() || p.providerName?.trim();
  if (single) return single;
  return p.email || p.username || `Nurse #${p.id}`;
}

function providerInitials(p: ProviderListItem): string {
  const fn = p.firstName?.trim()?.[0] ?? "";
  const ln = p.lastName?.trim()?.[0] ?? "";
  const both = `${fn}${ln}`.toUpperCase();
  if (both) return both;
  const e = p.email?.trim()?.[0] ?? "?";
  return e.toUpperCase();
}

function formatExperience(exp: ProviderListItem["experience"]): string {
  if (exp === null || exp === undefined || exp === "") return "—";
  if (typeof exp === "number") {
    return `${exp} year${exp === 1 ? "" : "s"}`;
  }
  return String(exp);
}

function providerAvatarSrc(p: ProviderListItem): string {
  return getAssetUrl(p.profilePicture ?? p.profile_picture ?? undefined);
}

function ProviderAvatar({ p }: { p: ProviderListItem }) {
  const [imgError, setImgError] = useState(false);
  const src = providerAvatarSrc(p);
  const showImg = Boolean(src) && !imgError;

  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800">
      {showImg ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-300">
          {providerInitials(p)}
        </div>
      )}
    </div>
  );
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  supervisor: SupervisorFullDetails | null;
  onAssigned?: () => void;
};

const PAGE_SIZE = 10;

export function SupervisorAssignNursesModal({ isOpen, onClose, supervisor, onAssigned }: Props) {
  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [total, setTotal] = useState(0);
  /** Row count returned in the last GET /providers/all response (for “full page ⇒ more may exist”). */
  const [lastBatchSize, setLastBatchSize] = useState(0);
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [listLoadingMore, setListLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (nextPage: number, append: boolean) => {
    if (append) setListLoadingMore(true);
    else setListLoading(true);
    setError(null);
    try {
      const res = await providersApi.getAllPublic({ page: nextPage, limit: PAGE_SIZE });
      const norm = normalizeProvidersAllResponse(res.data);
      setTotal(norm.total);
      setPage(nextPage);
      setLastBatchSize(norm.providers.length);
      setProviders((prev) => (append ? [...prev, ...norm.providers] : norm.providers));
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to load providers.";
      setError(message);
      if (!append) setProviders([]);
    } finally {
      setListLoading(false);
      setListLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !supervisor) return;
    setSelected(new Set());
    setError(null);
    const supervisorId = Number(supervisor.id);
    if (Number.isFinite(supervisorId) && supervisorId > 0) {
      void adminSupervisorsApi
        .getAssignedProviders(supervisorId)
        .then((res) => {
          const assignedIds = normalizeAssignedProviderIdsResponse(res.data);
          setSelected(new Set(assignedIds));
        })
        .catch(() => {
          // Keep modal usable even if assigned-list endpoint fails.
        });
    }
    void fetchPage(1, false);
  }, [isOpen, supervisor?.id, fetchPage]);

  const toggle = (providerId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) next.delete(providerId);
      else next.add(providerId);
      return next;
    });
    setError(null);
  };

  const lastPageFull = lastBatchSize >= PAGE_SIZE;
  /** Prefer server `total`; if missing (0), treat a full page of 10 as “more may exist”. */
  const canLoadMore =
    lastBatchSize > 0 &&
    lastPageFull &&
    (total <= 0 || providers.length < total);

  const handleLoadMore = () => {
    if (listLoadingMore || !canLoadMore) return;
    void fetchPage(page + 1, true);
  };

  const handleClose = () => {
    setProviders([]);
    setTotal(0);
    setLastBatchSize(0);
    setPage(1);
    setSelected(new Set());
    setError(null);
    setSubmitting(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!supervisor) return;
    const supervisorId = Number(supervisor.id);
    if (!Number.isFinite(supervisorId) || supervisorId <= 0) {
      setError("Invalid supervisor ID. Only supervisors from the server can assign nurses.");
      return;
    }
    const providerIds = Array.from(selected);
    setError(null);
    setSubmitting(true);
    try {
      await adminSupervisorsApi.reassignProviders({ supervisorId, providerIds });
      onAssigned?.();
      handleClose();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Assignment failed.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!supervisor) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      showCloseButton
      className="max-h-[min(90vh,720px)] w-full max-w-xl overflow-hidden p-0 sm:p-0"
    >
      <div className="flex max-h-[min(90vh,720px)] min-h-0 flex-col">
        <div className="shrink-0 border-b border-gray-200 px-6 pb-4 pt-6 dark:border-gray-800">
          <h3 className="pr-10 text-xl font-semibold text-gray-900 dark:text-white/90">Assign nurses</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Supervisor: <span className="font-medium text-gray-800 dark:text-gray-200">{supervisor.name}</span>
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {listLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading providers…</p>
          ) : providers.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No providers returned for this page.</p>
          ) : (
            <ul className="space-y-2">
              {providers.map((p) => {
                const checked = selected.has(p.id);
                const name = providerLabel(p);
                return (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900/40"
                  >
                    <input
                      id={`assign-provider-${p.id}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(p.id)}
                      className="size-4 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-900"
                    />
                    <ProviderAvatar p={p} />
                    <label
                      htmlFor={`assign-provider-${p.id}`}
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      <span className="block font-semibold text-gray-900 dark:text-white/90">{name}</span>
                      <span className="mt-0.5 block text-xs text-gray-600 dark:text-gray-400">
                        Experience:{" "}
                        <span className="text-gray-800 dark:text-gray-300">{formatExperience(p.experience)}</span>
                      </span>
                      {p.email ? (
                        <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-500">{p.email}</span>
                      ) : null}
                      {p.bmdcNumber ? (
                        <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-500">
                          BMDC: {p.bmdcNumber}
                        </span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Selected: {selected.size} nurse{selected.size === 1 ? "" : "s"}
          </p>

          {error ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          ) : null}
        </div>

        {!listLoading && canLoadMore ? (
          <div className="shrink-0 border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-950/40">
            <p className="mb-3 text-center text-xs text-gray-500 dark:text-gray-400">
              {total > 0 ? (
                <>
                  Showing {providers.length} of {total} providers
                </>
              ) : (
                <>Loaded {providers.length} providers — more may be available</>
              )}
            </p>
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleLoadMore}
              disabled={listLoadingMore}
              className="w-full"
            >
              {listLoadingMore ? "Loading more…" : "Load more"}
            </Button>
          </div>
        ) : null}

        <div className="shrink-0 border-t border-gray-200 bg-gray-50/80 px-6 py-4 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={submitting || listLoading}>
              {submitting ? "Assigning…" : "Assign selected"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
