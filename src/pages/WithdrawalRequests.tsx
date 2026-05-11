import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Download, Upload, X } from "lucide-react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import ThemedSelect from "../components/form/ThemedSelect";
import { DateRangePicker, type DateRangePickerValue } from "../components/ui/date-range-picker";
import { ConfirmModal } from "../components/ui/confirm-modal";
import { Modal } from "../components/ui/modal";
import Badge from "../components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  financialApi,
  type WithdrawalRequestDetail,
  type WithdrawalRequestListItem,
  type WithdrawalRequestStatus,
  uploadFileToStorage,
} from "../services/api";
import { getAssetUrl } from "../utils/assetUrl";
import { formatDate, formatStatusLabel } from "../utils/format";

const LIMIT_OPTIONS = [10, 20, 50];
const MAX_PROOF_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const FILE_UPLOAD_PUBLIC_BASE =
  (import.meta.env.VITE_FILE_UPLOAD_URL as string | undefined)?.replace(/\/$/, "") || "";
type WithdrawalStatusTab = "all" | WithdrawalRequestStatus;
const STATUS_TABS: WithdrawalStatusTab[] = [
  "all",
  "PENDING",
  "APPROVED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
];

function statusBadgeColor(status: string) {
  switch (status) {
    case "COMPLETED":
    case "APPROVED":
      return "success";
    case "REJECTED":
    case "CANCELLED":
      return "error";
    default:
      return "warning";
  }
}

function resolveProofDownloadUrl(detail: WithdrawalRequestDetail | null): string {
  if (!detail) return "";
  const normalize = (value: unknown): string => {
    if (typeof value !== "string" || !value.trim()) return "";
    const raw = value.trim();
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    // Proof files come from uploader service; keep /files/... on upload host.
    if (raw.startsWith("/files/") && FILE_UPLOAD_PUBLIC_BASE) {
      return `${FILE_UPLOAD_PUBLIC_BASE}${raw}`;
    }
    return getAssetUrl(raw);
  };

  const raw = (detail as Record<string, unknown>).proofUrl;
  if (typeof raw === "string" && raw.trim()) return normalize(raw);
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const access = normalize(obj.accessUrl);
    if (access) return access;
    const download = normalize(obj.downloadUrl);
    if (download) return download;
    const path = normalize(obj.path);
    if (path) return path;
  }
  return "";
}

export default function WithdrawalRequests() {
  const { t } = useTranslation();
  const [list, setList] = useState<WithdrawalRequestListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<WithdrawalStatusTab>("all");
  const [dateRange, setDateRange] = useState<DateRangePickerValue>({
    startDate: null,
    endDate: null,
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<WithdrawalRequestDetail | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirmApproveId, setConfirmApproveId] = useState<number | null>(null);
  const [confirmRejectId, setConfirmRejectId] = useState<number | null>(null);
  const [approveNote, setApproveNote] = useState("");
  const [approveModalError, setApproveModalError] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [rejectModalError, setRejectModalError] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [completeProofFile, setCompleteProofFile] = useState<File | null>(null);
  const [completeModalError, setCompleteModalError] = useState("");
  const [submitting, setSubmitting] = useState<"" | "approve" | "reject" | "complete">("");
  const proofDownloadUrl = useMemo(() => resolveProofDownloadUrl(detailData), [detailData]);

  const totalPages = useMemo(
    () => (limit > 0 ? Math.max(1, Math.ceil((total || 0) / limit)) : 1),
    [limit, total]
  );
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const toISODateLocal = (date: Date | null): string | undefined => {
    if (!date) return undefined;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const startDateParam = useMemo(() => toISODateLocal(dateRange.startDate), [dateRange.startDate]);
  const endDateParam = useMemo(() => toISODateLocal(dateRange.endDate), [dateRange.endDate]);

  const fetchList = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      let aborted = false;
      try {
        const response = await financialApi.getWithdrawalAdminList(
          {
            page,
            limit,
            status: status === "all" ? undefined : status,
            startDate: startDateParam,
            endDate: endDateParam,
          },
          { signal }
        );
        const payload = response.data ?? response;
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        const meta = payload?.meta;
        const totalCount =
          (typeof meta?.total === "number" ? meta.total : undefined) ??
          (typeof payload?.total === "number" ? payload.total : undefined) ??
          rows.length;
        setList(rows);
        setTotal(totalCount);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          aborted = true;
          return;
        }
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : t("withdrawalRequests.failedToLoad");
        setError(message);
        setList([]);
        setTotal(0);
      } finally {
        if (!aborted) setLoading(false);
      }
    },
    [endDateParam, limit, page, startDateParam, status, t]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchList(controller.signal);
    return () => controller.abort();
  }, [fetchList]);

  const openDetails = async (id: number) => {
    setSelectedId(id);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailData(null);
    setReviewNote("");
    setCompleteProofFile(null);
    setCompleteModalError("");
    try {
      const res = await financialApi.getWithdrawalAdminById(id);
      const payload = (res?.data ?? res) as WithdrawalRequestDetail;
      setDetailData(payload);
      setReviewNote(String(payload?.adminNote ?? ""));
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("withdrawalRequests.failedToLoad");
      setError(message);
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const extractErrorMessages = (err: unknown, fallback: string): string[] => {
    if (!(err && typeof err === "object")) return [fallback];
    const e = err as {
      message?: unknown;
      response?: { data?: { message?: unknown; errors?: Record<string, unknown> } };
    };
    const out: string[] = [];
    const top = e.response?.data?.message ?? e.message;
    if (typeof top === "string" && top.trim()) out.push(top.trim());
    const fieldErrors = e.response?.data?.errors;
    if (fieldErrors && typeof fieldErrors === "object") {
      for (const [field, value] of Object.entries(fieldErrors)) {
        if (Array.isArray(value)) {
          value.forEach((msg) => {
            if (typeof msg === "string" && msg.trim()) out.push(`${field}: ${msg.trim()}`);
          });
        } else if (typeof value === "string" && value.trim()) {
          out.push(`${field}: ${value.trim()}`);
        }
      }
    }
    if (!out.length) out.push(fallback);
    return out;
  };

  const applyAction = async (
    action: "approve" | "reject" | "complete",
    idOverride?: number,
    noteOverride?: string,
    options?: { openDetailOnSuccess?: boolean }
  ) => {
    const targetId = idOverride ?? selectedId;
    if (!targetId) return false;
    const effectiveNoteRaw = typeof noteOverride === "string" ? noteOverride : reviewNote;
    const effectiveNote = String(effectiveNoteRaw ?? "").trim();
    const shouldOpenDetail = options?.openDetailOnSuccess ?? true;
    setSubmitting(action);
    if (action === "reject") setRejectModalError("");
    else if (action === "approve") setApproveModalError("");
    else if (action === "complete") setCompleteModalError("");
    else setError("");
    try {
      if (action === "approve") {
        if (effectiveNote.length > 1000) {
          setApproveModalError(t("withdrawalRequests.approveNoteTooLong"));
          return false;
        }
        await financialApi.approveWithdrawalAdmin(targetId, {
          adminNote: effectiveNote || undefined,
        });
      } else if (action === "reject") {
        if (!effectiveNote) {
          setRejectModalError(t("withdrawalRequests.rejectNoteRequired"));
          return false;
        }
        if (effectiveNote.length > 1000) {
          setRejectModalError(t("withdrawalRequests.rejectNoteTooLong"));
          return false;
        }
        await financialApi.rejectWithdrawalAdmin(targetId, { adminNote: effectiveNote });
      } else {
        if (!completeProofFile) {
          setCompleteModalError(t("withdrawalRequests.completeProofRequired"));
          return false;
        }
        if (completeProofFile.size > MAX_PROOF_FILE_SIZE_BYTES) {
          setCompleteModalError(t("withdrawalRequests.completeProofTooLarge"));
          return false;
        }
        let uploadObject: unknown;
        try {
          uploadObject = await uploadFileToStorage(completeProofFile);
        } catch (uploadErr: unknown) {
          const messages = extractErrorMessages(uploadErr, t("withdrawalRequests.proofUploadFailed"));
          setCompleteModalError(messages.join("\n"));
          return false;
        }
        const uploadRecord =
          uploadObject && typeof uploadObject === "object" && "data" in (uploadObject as Record<string, unknown>)
            ? ((uploadObject as Record<string, unknown>).data as Record<string, unknown> | null)
            : (uploadObject as Record<string, unknown> | null);
        const accessUrl =
          uploadRecord && typeof uploadRecord === "object"
            ? String(uploadRecord.accessUrl ?? "").trim()
            : "";
        if (!accessUrl) {
          setCompleteModalError(t("withdrawalRequests.proofAccessUrlMissing"));
          return false;
        }
        await financialApi.completeWithdrawalAdmin(targetId, {
          proofUrl: accessUrl,
          adminNote: effectiveNote || undefined,
        });
      }
      await fetchList();
      if (shouldOpenDetail) await openDetails(targetId);
      return true;
    } catch (err: unknown) {
      const messages = extractErrorMessages(err, t("withdrawalRequests.actionFailed"));
      if (action === "reject") {
        setRejectModalError(messages.join("\n"));
      } else if (action === "approve") {
        setApproveModalError(messages.join("\n"));
      } else if (action === "complete") {
        setCompleteModalError(messages.join("\n"));
      } else {
        setError(messages.join(" | "));
      }
      return false;
    } finally {
      setSubmitting("");
    }
  };

  const quickAction = async (
    id: number,
    action: "approve" | "reject",
    noteOverride?: string
  ) => {
    setSelectedId(id);
    setReviewNote(noteOverride ?? "");
    setCompleteProofFile(null);
    setCompleteModalError("");
    return applyAction(action, id, noteOverride, { openDetailOnSuccess: false });
  };

  return (
    <>
      <PageMeta
        title={t("withdrawalRequests.metaTitle")}
        description={t("withdrawalRequests.metaDescription")}
      />
      <PageBreadcrumb pageTitle={t("withdrawalRequests.pageTitle")} />

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {t("withdrawalRequests.heading")}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("withdrawalRequests.subheading")}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 sm:ml-auto">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="shrink-0">
                {t("withdrawalRequests.startDate")} - {t("withdrawalRequests.endDate")}
              </span>
              <div className="w-[270px]">
                <DateRangePicker
                  value={dateRange}
                  onChange={(next) => {
                    setDateRange(next);
                    setPage(1);
                  }}
                  defaultSelectionMode="range"
                  placeholder={t("withdrawalRequests.dateRangePlaceholder")}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-gray-200 px-4 dark:border-gray-800 sm:px-6">
          <nav
            className="-mb-px flex gap-4 overflow-x-auto pb-px sm:gap-8"
            aria-label={t("withdrawalRequests.status")}
          >
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setStatus(tab);
                  setPage(1);
                }}
                className={`whitespace-nowrap border-b-2 py-4 text-sm font-medium transition-colors ${
                  status === tab
                    ? "border-brand-500 text-brand-500 dark:border-brand-500 dark:text-brand-500"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"
                }`}
              >
                {tab === "all" ? t("common.all") : formatStatusLabel(tab)}
              </button>
            ))}
          </nav>
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
          ) : list.length === 0 ? (
            <div className="py-16 text-center text-gray-500 dark:text-gray-400">
              {t("withdrawalRequests.noData")}
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {list.map((row, index) => (
                  <div
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => void openDetails(row.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void openDetails(row.id);
                      }
                    }}
                    className="cursor-pointer rounded-xl border border-gray-200 bg-gray-50/50 p-4 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800/30 dark:hover:bg-white/[0.02]"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-gray-200 pb-3 dark:border-gray-700">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                        {row.providerName || `Provider #${row.providerId ?? "-"}`}
                      </span>
                      <Badge size="sm" color={statusBadgeColor(String(row.status))}>
                        {formatStatusLabel(String(row.status))}
                      </Badge>
                    </div>
                    <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">#</dt>
                        <dd className="text-gray-800 dark:text-gray-200">{(page - 1) * limit + index + 1}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">{t("withdrawalRequests.amount")}</dt>
                        <dd className="text-gray-800 dark:text-gray-200">{row.amount ?? t("common.noValue")}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">{t("withdrawalRequests.requestedAt")}</dt>
                        <dd className="text-gray-800 dark:text-gray-200">
                          {row.requestedAt || row.createdAt
                            ? formatDate(String(row.requestedAt || row.createdAt))
                            : t("common.noValue")}
                        </dd>
                      </div>
                      <div className="pt-1 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          title={t("withdrawalRequests.approve")}
                          aria-label={t("withdrawalRequests.approve")}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (String(row.status).toUpperCase() !== "PENDING") return;
                            setConfirmApproveId(row.id);
                            setApproveNote("");
                            setApproveModalError("");
                          }}
                          disabled={String(row.status).toUpperCase() !== "PENDING"}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-green-200 text-green-600 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:border-green-700/60 dark:text-green-400 dark:hover:bg-green-900/20 dark:disabled:hover:bg-transparent"
                        >
                          <Check className="size-4" />
                        </button>
                        <button
                          type="button"
                          title={t("withdrawalRequests.reject")}
                          aria-label={t("withdrawalRequests.reject")}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (String(row.status).toUpperCase() === "COMPLETED") return;
                            setConfirmRejectId(row.id);
                          }}
                          disabled={String(row.status).toUpperCase() === "COMPLETED"}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:border-red-700/60 dark:text-red-400 dark:hover:bg-red-900/20 dark:disabled:hover:bg-transparent"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block" style={{ WebkitOverflowScrolling: "touch" }}>
                <Table>
                  <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                    <TableRow>
                      <TableCell isHeader className="w-[5%] px-2 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">#</TableCell>
                      <TableCell isHeader className="w-[24%] px-2 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{t("withdrawalRequests.provider")}</TableCell>
                      <TableCell isHeader className="w-[16%] px-2 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{t("withdrawalRequests.status")}</TableCell>
                      <TableCell isHeader className="w-[20%] px-2 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{t("withdrawalRequests.amount")}</TableCell>
                      <TableCell isHeader className="w-[20%] px-2 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{t("withdrawalRequests.requestedAt")}</TableCell>
                      <TableCell isHeader className="w-[15%] px-2 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">{t("users.actions")}</TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {list.map((row, index) => (
                      <TableRow
                        key={row.id}
                        onClick={() => void openDetails(row.id)}
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                      >
                        <TableCell className="px-2 py-3 text-theme-sm text-gray-700 dark:text-gray-300">
                          {(page - 1) * limit + index + 1}
                        </TableCell>
                        <TableCell className="px-2 py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {row.providerName || `Provider #${row.providerId ?? "-"}`}
                        </TableCell>
                        <TableCell className="px-2 py-3">
                          <Badge size="sm" color={statusBadgeColor(String(row.status))}>
                            {formatStatusLabel(String(row.status))}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {row.amount ?? t("common.noValue")}
                        </TableCell>
                        <TableCell className="px-2 py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {row.requestedAt || row.createdAt
                            ? formatDate(String(row.requestedAt || row.createdAt))
                            : t("common.noValue")}
                        </TableCell>
                        <TableCell className="px-2 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              title={t("withdrawalRequests.approve")}
                              aria-label={t("withdrawalRequests.approve")}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (String(row.status).toUpperCase() !== "PENDING") return;
                                setConfirmApproveId(row.id);
                                setApproveNote("");
                                setApproveModalError("");
                              }}
                              disabled={String(row.status).toUpperCase() !== "PENDING"}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-green-200 text-green-600 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:border-green-700/60 dark:text-green-400 dark:hover:bg-green-900/20 dark:disabled:hover:bg-transparent"
                            >
                              <Check className="size-4" />
                            </button>
                            <button
                              type="button"
                              title={t("withdrawalRequests.reject")}
                              aria-label={t("withdrawalRequests.reject")}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (String(row.status).toUpperCase() === "COMPLETED") return;
                                setConfirmRejectId(row.id);
                              }}
                              disabled={String(row.status).toUpperCase() === "COMPLETED"}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:border-red-700/60 dark:text-red-400 dark:hover:bg-red-900/20 dark:disabled:hover:bg-transparent"
                            >
                              <X className="size-4" />
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

        {!loading && list.length > 0 && totalPages > 0 && (
          <div className="flex flex-col gap-4 border-t border-gray-200 px-4 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                {t("pagination.rowsPerPage")}
                <ThemedSelect
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
                </ThemedSelect>
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t("pagination.showingRangeOf", {
                  from,
                  to,
                  total,
                  entity: t("withdrawalRequests.entity"),
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

      <Modal
        isOpen={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailData(null);
          setSelectedId(null);
          setSubmitting("");
          setCompleteProofFile(null);
          setCompleteModalError("");
        }}
        title={t("withdrawalRequests.detailTitle")}
        className="max-w-2xl p-0"
      >
        <div className="space-y-4 pt-2">
          {detailLoading ? (
            <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {t("systemConfig.loading")}
            </div>
          ) : !detailData ? (
            <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {t("withdrawalRequests.noDetail")}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <p><span className="text-gray-500">{t("withdrawalRequests.id")}:</span> {detailData.id}</p>
                <p><span className="text-gray-500">{t("withdrawalRequests.status")}:</span> {formatStatusLabel(String(detailData.status))}</p>
                <p><span className="text-gray-500">{t("withdrawalRequests.provider")}:</span> {detailData.providerName || `Provider #${detailData.providerId ?? "-"}`}</p>
                <p><span className="text-gray-500">{t("withdrawalRequests.amount")}:</span> {detailData.amount ?? t("common.noValue")}</p>
                <p><span className="text-gray-500">{t("withdrawalRequests.requestedAt")}:</span> {detailData.requestedAt || detailData.createdAt ? formatDate(String(detailData.requestedAt || detailData.createdAt)) : t("common.noValue")}</p>
                <p><span className="text-gray-500">{t("withdrawalRequests.method")}:</span> {detailData.method ?? t("common.noValue")}</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("withdrawalRequests.adminNote")}
                </label>
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  placeholder={t("withdrawalRequests.adminNotePlaceholder")}
                />
              </div>

              <div
                className={`space-y-2 rounded-lg border p-3 transition-colors ${
                  completeProofFile
                    ? "border-brand-300 bg-brand-50/60 dark:border-brand-700 dark:bg-brand-900/20"
                    : "border-gray-200 bg-gray-50/40 dark:border-gray-700 dark:bg-gray-800/30"
                }`}
              >
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("withdrawalRequests.proofFile")}
                </label>
                <input
                  id="withdrawal-complete-proof-file"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    if (file && file.size > MAX_PROOF_FILE_SIZE_BYTES) {
                      setCompleteProofFile(null);
                      setCompleteModalError(t("withdrawalRequests.completeProofTooLarge"));
                      return;
                    }
                    setCompleteProofFile(file);
                    if (completeModalError) setCompleteModalError("");
                  }}
                  className="sr-only"
                />
                <label
                  htmlFor="withdrawal-complete-proof-file"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <Upload className="size-4" />
                  {t("withdrawalRequests.chooseFile")}
                </label>
                {completeProofFile && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("withdrawalRequests.selectedFile")}: {completeProofFile.name}
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("withdrawalRequests.maxFileSizeHint")}
                </p>
                {completeModalError && (
                  <div className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                    {completeModalError}
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/40 p-3 dark:border-gray-700 dark:bg-gray-800/30">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("withdrawalRequests.uploadedProof")}
                </label>
                {proofDownloadUrl ? (
                  <a
                    href={proofDownloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-brand-300 bg-white px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:bg-gray-800 dark:text-brand-300 dark:hover:bg-brand-900/20"
                  >
                    <Download className="size-4" />
                    {t("withdrawalRequests.downloadProof")}
                  </a>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("withdrawalRequests.noUploadedProof")}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={submitting !== ""}
                  onClick={async () => {
                    const ok = await applyAction("complete", selectedId ?? undefined, undefined, {
                      openDetailOnSuccess: false,
                    });
                    if (ok) {
                      setDetailOpen(false);
                      setDetailData(null);
                      setSelectedId(null);
                      setCompleteProofFile(null);
                      setCompleteModalError("");
                    }
                  }}
                  className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {submitting === "complete" ? t("common.actions.loadingMore") : t("withdrawalRequests.complete")}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <ConfirmModal
        isOpen={confirmApproveId != null}
        onClose={() => {
          setConfirmApproveId(null);
          setApproveNote("");
          setApproveModalError("");
        }}
        title={t("withdrawalRequests.approveConfirmTitle")}
        message={
          <div className="space-y-3">
            <p>{t("withdrawalRequests.approveConfirmMessage")}</p>
            {approveModalError && (
              <div className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                {approveModalError}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
                {t("withdrawalRequests.adminNote")}
              </label>
              <textarea
                value={approveNote}
                onChange={(e) => {
                  setApproveNote(e.target.value);
                  if (approveModalError) setApproveModalError("");
                }}
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder={t("withdrawalRequests.approveNotePlaceholder")}
              />
            </div>
          </div>
        }
        confirmLabel={t("withdrawalRequests.approve")}
        cancelLabel={t("common.actions.cancel")}
        confirmVariant="primary"
        closeOnConfirm={false}
        onConfirm={async () => {
          if (confirmApproveId == null) return;
          const note = approveNote.trim();
          if (note.length > 1000) {
            setApproveModalError(t("withdrawalRequests.approveNoteTooLong"));
            return;
          }
          const ok = await quickAction(confirmApproveId, "approve", note);
          if (ok) {
            setConfirmApproveId(null);
            setApproveNote("");
            setApproveModalError("");
            setDetailOpen(false);
          }
        }}
      />

      <ConfirmModal
        isOpen={confirmRejectId != null}
        onClose={() => {
          setConfirmRejectId(null);
          setRejectNote("");
          setRejectModalError("");
        }}
        title={t("withdrawalRequests.rejectConfirmTitle")}
        message={
          <div className="space-y-3">
            <p>{t("withdrawalRequests.rejectConfirmMessage")}</p>
            {rejectModalError && (
              <div className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                {rejectModalError}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">
                {t("withdrawalRequests.adminNote")}
              </label>
              <textarea
                value={rejectNote}
                onChange={(e) => {
                  setRejectNote(e.target.value);
                  if (rejectModalError) setRejectModalError("");
                }}
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                placeholder={t("withdrawalRequests.rejectNotePlaceholder")}
              />
            </div>
          </div>
        }
        confirmLabel={t("withdrawalRequests.reject")}
        cancelLabel={t("common.actions.cancel")}
        confirmVariant="danger"
        closeOnConfirm={false}
        onConfirm={async () => {
          if (confirmRejectId == null) return;
          const note = rejectNote.trim();
          if (!note) {
            setRejectModalError(t("withdrawalRequests.rejectNoteRequired"));
            return;
          }
          setReviewNote(note);
          const ok = await quickAction(confirmRejectId, "reject", note);
          if (ok) {
            setConfirmRejectId(null);
            setRejectNote("");
            setRejectModalError("");
            setDetailOpen(false);
          }
        }}
      />
    </>
  );
}
