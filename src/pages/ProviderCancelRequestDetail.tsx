import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { SearchableSelect } from "../components/form/SearchableSelect";
import Badge from "../components/ui/badge/Badge";
import { ConfirmModal } from "../components/ui/confirm-modal";
import {
  adminProviderCancelApi,
  providersApi,
  type ProviderCancelReviewDetail,
  type ProviderListItem,
  type ProviderCancelReviewListItem,
} from "../services/api";
import { formatDateTime, formatStatusLabel } from "../utils/format";
import { fmtBDT } from "./financial/shared";

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

function unwrapDetail(res: unknown): ProviderCancelReviewDetail {
  const payload = (res as { data?: ProviderCancelReviewDetail }).data ?? res;
  return payload as ProviderCancelReviewDetail;
}

export default function ProviderCancelRequestDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const requestId = id ? parseInt(id, 10) : NaN;

  const [detail, setDetail] = useState<ProviderCancelReviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [newProviderId, setNewProviderId] = useState<number | "">("");
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | "reassign" | null>(
    null
  );
  const [successMessage, setSuccessMessage] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<ProviderCancelReviewListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [selectedAction, setSelectedAction] = useState<"approve" | "reject" | "reassign" | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMode, setRefundMode] = useState<"amount" | "percent">("amount");
  const [percentInput, setPercentInput] = useState("100");
  const [replacementProviders, setReplacementProviders] = useState<ProviderListItem[]>([]);
  const [loadingReplacementProviders, setLoadingReplacementProviders] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!requestId || Number.isNaN(requestId)) {
      setError(t("providerCancelRequests.invalidId"));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const res = await adminProviderCancelApi.detail(requestId);
      const body = unwrapDetail(res);
      setDetail(body);
      setNewProviderId("");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("providerCancelRequests.failedDetail");
      setError(message);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [requestId, t]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    if (selectedAction === "approve" && detail) {
      setRefundAmount(detail.refundPreview.refundAmount ?? "");
      setRefundMode("amount");
      setPercentInput("100");
    }
  }, [selectedAction, detail?.id]);

  // ── Approve-panel derived values ─────────────────────────────────────────
  const fullRefundValue = parseFloat(detail?.refundPreview.refundAmount ?? "0") || 0;
  const currentRefundValue = parseFloat(refundAmount) || 0;
  const approveRefundPct =
    fullRefundValue > 0 ? Math.round((currentRefundValue / fullRefundValue) * 100) : 0;
  const isPartialRefund = currentRefundValue < fullRefundValue && currentRefundValue >= 0;

  const handleApproveAmountChange = (raw: string) => {
    setRefundAmount(raw);
    if (fullRefundValue > 0)
      setPercentInput(
        String(Math.min(100, Math.max(0, Math.round(((parseFloat(raw) || 0) / fullRefundValue) * 100))))
      );
  };
  const handleApprovePercentChange = (raw: string) => {
    setPercentInput(raw);
    const p = Math.min(100, Math.max(0, parseFloat(raw) || 0));
    setRefundAmount(((p / 100) * fullRefundValue).toFixed(2));
  };
  const switchApproveRefundMode = (mode: "amount" | "percent") => {
    setRefundMode(mode);
    if (mode === "percent") setPercentInput(String(approveRefundPct));
  };
  // ─────────────────────────────────────────────────────────────────────────

  const consultationTypeId = detail?.serviceRequest.consultationTypeId;
  const isPending = detail?.reviewStatus === "PENDING";

  useEffect(() => {
    if (!consultationTypeId || detail?.reviewStatus !== "PENDING") {
      setReplacementProviders([]);
      return;
    }
    const controller = new AbortController();
    (async () => {
      setLoadingReplacementProviders(true);
      try {
        const res = await providersApi.getList(
          { consultationTypeId, status: "active", limit: 200, page: 1 },
          { signal: controller.signal }
        );
        const body = (res?.data as { providers?: ProviderListItem[] }) ?? res;
        const list =
          (body as { providers?: ProviderListItem[] }).providers ??
          (res as { providers?: ProviderListItem[] }).providers ??
          [];
        setReplacementProviders(Array.isArray(list) ? list : []);
      } catch {
        if (!controller.signal.aborted) setReplacementProviders([]);
      } finally {
        if (!controller.signal.aborted) setLoadingReplacementProviders(false);
      }
    })();
    return () => controller.abort();
  }, [consultationTypeId, detail?.reviewStatus]);

  const availabilityByProviderId = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const r of detail?.suggestedReplacements ?? []) {
      map.set(r.providerId, r.isAvailable);
    }
    return map;
  }, [detail?.suggestedReplacements]);

  const reassignProviderOptions = useMemo(() => {
    if (!detail) return [];
    const excludeId = detail.provider?.id;
    const byId = new Map<
      number,
      { value: number; label: string; hint?: string; sortKey: string }
    >();

    const providerLabel = (p: ProviderListItem) =>
      [p.firstName, p.lastName].filter(Boolean).join(" ") ||
      p.name ||
      p.providerName ||
      `Provider #${p.id}`;

    const hintFor = (providerId: number, fallback?: string) => {
      if (availabilityByProviderId.has(providerId)) {
        return availabilityByProviderId.get(providerId)
          ? t("providerCancelRequests.availableAtSlot")
          : t("providerCancelRequests.busyAtSlot");
      }
      return fallback ?? t("providerCancelRequests.scheduleUnknown");
    };

    for (const p of replacementProviders) {
      if (p.id === excludeId) continue;
      const avail = availabilityByProviderId.get(p.id);
      const sortKey =
        avail === true ? `0-${providerLabel(p)}` : avail === false ? `2-${providerLabel(p)}` : `1-${providerLabel(p)}`;
      byId.set(p.id, {
        value: p.id,
        label: providerLabel(p),
        hint: hintFor(p.id, p.consultationTypeName ?? undefined),
        sortKey,
      });
    }

    for (const s of detail.suggestedReplacements) {
      if (s.providerId === excludeId || byId.has(s.providerId)) continue;
      const sortKey = s.isAvailable ? `0-${s.name}` : `2-${s.name}`;
      byId.set(s.providerId, {
        value: s.providerId,
        label: s.name,
        hint: s.isAvailable
          ? t("providerCancelRequests.availableAtSlot")
          : t("providerCancelRequests.busyAtSlot"),
        sortKey,
      });
    }

    return Array.from(byId.values())
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ value, label, hint }) => ({ value, label, hint }));
  }, [availabilityByProviderId, detail, replacementProviders, t]);

  const selectedReassignProvider = useMemo(() => {
    if (newProviderId === "") return null;
    return reassignProviderOptions.find((o) => o.value === newProviderId) ?? null;
  }, [newProviderId, reassignProviderOptions]);

  useEffect(() => {
    if (!isPending || reassignProviderOptions.length === 0) return;
    const stillValid =
      newProviderId !== "" && reassignProviderOptions.some((o) => o.value === newProviderId);
    if (stillValid) return;
    setNewProviderId(reassignProviderOptions[0].value);
  }, [isPending, newProviderId, reassignProviderOptions]);

  const runAction = async () => {
    if (!confirmAction || !requestId || Number.isNaN(requestId)) return;
    setActionBusy(true);
    setError("");
    try {
      if (confirmAction === "approve") {
        const fullAmt = parseFloat(detail?.refundPreview.refundAmount ?? "0");
        const customAmt = parseFloat(refundAmount);
        await adminProviderCancelApi.approve(requestId, {
          adminNotes: adminNotes.trim() || undefined,
          refundAmount:
            Number.isFinite(customAmt) && customAmt < fullAmt ? customAmt : undefined,
        });
        setSuccessMessage(t("providerCancelRequests.approveSuccess"));
      } else if (confirmAction === "reject") {
        const notes = adminNotes.trim();
        if (!notes) {
          setError(t("providerCancelRequests.rejectNotesRequired"));
          setActionBusy(false);
          setConfirmAction(null);
          return;
        }
        await adminProviderCancelApi.reject(requestId, { adminNotes: notes });
        setSuccessMessage(t("providerCancelRequests.rejectSuccess"));
      } else if (confirmAction === "reassign") {
        const pid = newProviderId === "" ? NaN : Number(newProviderId);
        if (!Number.isFinite(pid) || pid < 1) {
          setError(t("providerCancelRequests.reassignProviderSelectRequired"));
          setActionBusy(false);
          setConfirmAction(null);
          return;
        }
        const reassignRes = await adminProviderCancelApi.reassign(requestId, {
          newProviderId: pid,
          adminNotes: adminNotes.trim() || undefined,
        });
        const txId = reassignRes.data?.reassignTransactionId;
        setSuccessMessage(
          txId != null
            ? t("providerCancelRequests.reassignSuccessWithTx", { txId })
            : t("providerCancelRequests.reassignSuccessNoTransfer")
        );
      }
      setConfirmAction(null);
      setAdminNotes("");
      await fetchDetail();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("providerCancelRequests.actionFailed");
      setError(message);
      setConfirmAction(null);
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageMeta
          title={t("providerCancelRequests.detailMetaTitle")}
          description={t("providerCancelRequests.detailMetaDescription")}
        />
        <PageBreadcrumb pageTitle={t("providerCancelRequests.detailPageTitle")} />
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          {t("systemConfig.loading")}
        </div>
      </>
    );
  }

  if (error && !detail) {
    return (
      <>
        <PageMeta
          title={t("providerCancelRequests.detailMetaTitle")}
          description={t("providerCancelRequests.detailMetaDescription")}
        />
        <PageBreadcrumb pageTitle={t("providerCancelRequests.detailPageTitle")} />
        <p className="text-rose-600 dark:text-rose-400">{error}</p>
        <Link
          to="/provider-cancel-requests"
          className="mt-4 inline-block text-brand-600 hover:underline dark:text-brand-400"
        >
          ← {t("providerCancelRequests.backToList")}
        </Link>
      </>
    );
  }

  if (!detail) return null;

  const sr = detail.serviceRequest;
  const preview = detail.refundPreview;

  return (
    <>
      <PageMeta
        title={t("providerCancelRequests.detailMetaTitle")}
        description={t("providerCancelRequests.detailMetaDescription")}
      />
      <PageBreadcrumb
        pageTitle={t("providerCancelRequests.detailPageTitleWithId", { id: detail.id })}
      />

      <div className="space-y-6">
        <Link
          to="/provider-cancel-requests"
          className="inline-block text-sm text-brand-600 hover:underline dark:text-brand-400"
        >
          ← {t("providerCancelRequests.backToList")}
        </Link>

        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
            {error}
          </p>
        ) : null}
        {successMessage ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
            {successMessage}
          </p>
        ) : null}

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {t("providerCancelRequests.requestSummary")}
            </h3>
            <Badge size="sm" color={reviewStatusBadgeColor(detail.reviewStatus)}>
              {formatStatusLabel(detail.reviewStatus ?? "PENDING")}
            </Badge>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-gray-500 dark:text-gray-400">
                {t("providerCancelRequests.submittedAt")}:
              </span>{" "}
              {formatDateTime(detail.createdAt ?? "")}
            </p>
            <p>
              <span className="text-gray-500 dark:text-gray-400">
                {t("providerCancelRequests.colServiceRequest")}:
              </span>{" "}
              <Link
                to={`/schedule/${sr.id}`}
                className="font-mono text-brand-600 hover:underline dark:text-brand-400"
              >
                #{sr.id}
              </Link>{" "}
              <span className="text-gray-500">({formatStatusLabel(sr.status ?? "")})</span>
            </p>
            <p>
              <span className="text-gray-500 dark:text-gray-400">
                {t("providerCancelRequests.colProvider")}:
              </span>{" "}
              {detail.provider?.name ?? "—"}
            </p>
            <p>
              <span className="text-gray-500 dark:text-gray-400">
                {t("providerCancelRequests.colPatient")}:
              </span>{" "}
              {detail.patient.name}
            </p>
            <p>
              <span className="text-gray-500 dark:text-gray-400">
                {t("providerCancelRequests.scheduled")}:
              </span>{" "}
              {[sr.scheduledDate, sr.scheduledTime].filter(Boolean).join(" ") || "—"}
            </p>
            <p>
              <span className="text-gray-500 dark:text-gray-400">
                {t("providerCancelRequests.colFee")}:
              </span>{" "}
              {fmtBDT(sr.fee)}
            </p>
            <p>
              <span className="text-gray-500 dark:text-gray-400">
                {t("providerCancelRequests.consultationType")}:
              </span>{" "}
              {sr.consultationTypeName ?? "—"}
              {sr.serviceCategory ? (
                <span className="text-gray-500"> ({formatStatusLabel(sr.serviceCategory)})</span>
              ) : null}
            </p>
            <p className="sm:col-span-2">
              <span className="text-gray-500 dark:text-gray-400">
                {t("providerCancelRequests.colReason")}:
              </span>{" "}
              {detail.reasonCategory ? formatStatusLabel(detail.reasonCategory) : "—"}
              {detail.reasonNote ? (
                <span className="block text-gray-600 dark:text-gray-300">{detail.reasonNote}</span>
              ) : null}
            </p>
            <p className="sm:col-span-2 text-xs text-gray-500 dark:text-gray-400">
              {t("providerCancelRequests.srStatusNote")}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">
            {t("providerCancelRequests.refundPreview")}
          </h3>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-gray-500">{t("providerCancelRequests.refundAmount")}:</span>{" "}
              <span className="font-semibold">{fmtBDT(preview.refundAmount)}</span>
            </p>
            <p>
              <span className="text-gray-500">{t("providerCancelRequests.refundMethod")}:</span>{" "}
              {formatStatusLabel(preview.refundMethod)}
            </p>
            <p className="sm:col-span-2 text-xs text-gray-500 dark:text-gray-400">
              {preview.note}
            </p>
          </div>
        </section>

        <div>
          <button
            type="button"
            onClick={async () => {
              if (!showHistory && !historyLoaded) {
                setHistoryLoading(true);
                try {
                  const res = await adminProviderCancelApi.list(
                    { providerId: detail.provider?.id, limit: 30 }
                  );
                  const body = (res as unknown as { data?: { data?: ProviderCancelReviewListItem[] } }).data ?? res;
                  const items = (body as { data?: ProviderCancelReviewListItem[] }).data ?? [];
                  setHistoryItems(Array.isArray(items) ? items : []);
                  setHistoryLoaded(true);
                } catch {
                  setHistoryItems([]);
                  setHistoryLoaded(true);
                } finally {
                  setHistoryLoading(false);
                }
              }
              setShowHistory((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            {historyLoading
              ? "Loading…"
              : showHistory
              ? "Hide provider cancel history (90 days)"
              : "Show provider cancel history (90 days)"}
          </button>
          {showHistory && !historyLoading ? (
            <section className="mt-3 rounded-2xl border border-gray-100 bg-white dark:border-gray-800/60 dark:bg-white/[0.03]">
              <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800/60">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                  {t("providerCancelRequests.providerHistory")}
                </h3>
              </div>
              {historyItems.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-400">No previous cancel requests.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/60 dark:border-gray-800/60 dark:bg-gray-900/20">
                        <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">{t("providerCancelRequests.colSubmitted")}</th>
                        <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">{t("providerCancelRequests.colReviewStatus")}</th>
                        <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">{t("providerCancelRequests.colReason")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyItems.map((h) => (
                        <tr key={h.id} className="border-b border-gray-100/70 last:border-0 dark:border-gray-800/40">
                          <td className="px-5 py-2.5 text-xs text-gray-600 dark:text-gray-400">{formatDateTime(h.createdAt ?? "")}</td>
                          <td className="px-5 py-2.5 text-xs">{formatStatusLabel(h.reviewStatus ?? "")}</td>
                          <td className="px-5 py-2.5 text-xs text-gray-600 dark:text-gray-400">{h.reasonCategory ? formatStatusLabel(h.reasonCategory) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}
        </div>

        {isPending ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
              {t("providerCancelRequests.adminActions")}
            </h3>

            {/* Step 1 — pick an action */}
            {!selectedAction ? (
              <>
              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => { setSelectedAction("approve"); setAdminNotes(""); }}
                  className="group rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-left hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/25 dark:hover:bg-emerald-950/40"
                >
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    {t("providerCancelRequests.approve")}
                  </p>
                  <p className="mt-0.5 text-xs text-emerald-600/70 dark:text-emerald-500">
                    Refund patient · {fmtBDT(preview.refundAmount)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedAction("reassign"); setAdminNotes(""); }}
                  className="group rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 text-left hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-800/50 dark:bg-indigo-950/25 dark:hover:bg-indigo-950/40"
                >
                  <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                    {t("providerCancelRequests.reassign")}
                  </p>
                  <p className="mt-0.5 text-xs text-indigo-600/70 dark:text-indigo-500">
                    Assign a different provider
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedAction("reject"); setAdminNotes(""); }}
                  className="group rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-left hover:border-rose-300 hover:bg-rose-50 dark:border-rose-800/50 dark:bg-rose-950/25 dark:hover:bg-rose-950/40"
                >
                  <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                    {t("providerCancelRequests.reject")}
                  </p>
                  <p className="mt-0.5 text-xs text-rose-600/70 dark:text-rose-500">
                    Restore shift to provider
                  </p>
                </button>
              </div>
              <div className="mt-4 flex justify-end">
                <Link
                  to="/provider-cancel-requests"
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </Link>
              </div>
              </>
            ) : (
              /* Step 2 — configure the selected action */
              <div
                className={`rounded-xl border p-4 ${
                  selectedAction === "approve"
                    ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/50 dark:bg-emerald-950/25"
                    : selectedAction === "reject"
                    ? "border-rose-200 bg-rose-50/60 dark:border-rose-800/50 dark:bg-rose-950/25"
                    : "border-indigo-200 bg-indigo-50/60 dark:border-indigo-800/50 dark:bg-indigo-950/25"
                }`}
              >
                {/* Panel header */}
                <div className="mb-4 flex items-center justify-between">
                  <p
                    className={`text-xs font-semibold tracking-wide ${
                      selectedAction === "approve"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : selectedAction === "reject"
                        ? "text-rose-700 dark:text-rose-400"
                        : "text-indigo-700 dark:text-indigo-400"
                    }`}
                  >
                    {selectedAction === "approve"
                      ? "Approve & Refund Patient"
                      : selectedAction === "reject"
                      ? "Reject — Restore Shift to Provider"
                      : "Reassign to New Provider"}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedAction(null)}
                    className="rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
                  >
                    ← Change decision
                  </button>
                </div>

                {/* Fields row */}
                <div className="flex flex-wrap items-end gap-5">
                  {/* Approve — custom refund amount */}
                  {selectedAction === "approve" ? (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                        Refund amount
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white text-xs dark:border-gray-700 dark:bg-gray-900">
                          <button type="button" onClick={() => switchApproveRefundMode("amount")}
                            className={`px-3 py-1.5 ${refundMode === "amount" ? "bg-brand-500 text-white" : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"}`}>
                            BDT
                          </button>
                          <button type="button" onClick={() => switchApproveRefundMode("percent")}
                            className={`px-3 py-1.5 ${refundMode === "percent" ? "bg-brand-500 text-white" : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"}`}>
                            %
                          </button>
                        </span>
                        {refundMode === "amount" ? (
                          <input type="number" min={0} max={fullRefundValue} step="0.01" value={refundAmount}
                            onChange={(e) => handleApproveAmountChange(e.target.value)}
                            className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <input type="number" min={0} max={100} step="1" value={percentInput}
                              onChange={(e) => handleApprovePercentChange(e.target.value)}
                              className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
                            <span className="text-sm text-gray-400">%</span>
                          </div>
                        )}
                        <div className="flex items-baseline gap-1.5 rounded-lg bg-white px-3 py-1.5 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700">
                          <span className="text-sm font-bold text-gray-900 dark:text-white">{fmtBDT(refundAmount)}</span>
                          <span className="text-xs text-gray-400">{approveRefundPct}%</span>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isPartialRefund
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            : currentRefundValue <= 0
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        }`}>
                          {isPartialRefund ? "Partial" : currentRefundValue <= 0 ? "No refund" : "Full refund"}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {/* Reassign — provider select */}
                  {selectedAction === "reassign" ? (
                    <div className="w-60">
                      <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                        New provider <span className="text-rose-500">*</span>
                      </p>
                      {loadingReplacementProviders ? (
                        <p className="text-xs text-gray-400">{t("providerCancelRequests.loadingProviders")}</p>
                      ) : reassignProviderOptions.length === 0 ? (
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          {t("providerCancelRequests.noReplacementProviders")}
                        </p>
                      ) : (
                        <>
                          <SearchableSelect<number>
                            value={newProviderId === "" ? null : newProviderId}
                            onChange={(id) => setNewProviderId(id ?? "")}
                            placeholder={t("providerCancelRequests.reassignSelectPlaceholder")}
                            clearLabel={t("providerCancelRequests.reassignClear")}
                            searchPlaceholder={t("providerCancelRequests.reassignSearchPlaceholder")}
                            className="min-h-[38px]"
                            options={reassignProviderOptions}
                          />
                          {selectedReassignProvider?.hint ? (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {selectedReassignProvider.hint}
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}

                  {/* Notes */}
                  <div className="min-w-[180px] flex-1 max-w-sm">
                    <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {t("providerCancelRequests.adminNotes")}
                      {selectedAction === "reject" ? (
                        <span className="ml-0.5 text-rose-500">*</span>
                      ) : (
                        <span className="ml-1 font-normal text-gray-400">(optional)</span>
                      )}
                    </p>
                    <input
                      type="text"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                      placeholder={
                        selectedAction === "reject"
                          ? "Reason for rejection (required)"
                          : t("providerCancelRequests.adminNotesPlaceholder")
                      }
                    />
                    {selectedAction === "reject" && !adminNotes.trim() ? (
                      <p className="mt-1 text-xs text-rose-500">Required when rejecting</p>
                    ) : null}
                  </div>
                </div>

                {/* Submit + Cancel */}
                <div className="mt-4 flex items-center justify-end gap-3">
                  <Link
                    to="/provider-cancel-requests"
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </Link>
                  <button
                    type="button"
                    disabled={
                      actionBusy ||
                      (selectedAction === "reject" && !adminNotes.trim()) ||
                      (selectedAction === "reassign" && (newProviderId === "" || reassignProviderOptions.length === 0))
                    }
                    onClick={() => setConfirmAction(selectedAction)}
                    className={`rounded-lg px-6 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 ${
                      selectedAction === "approve"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : selectedAction === "reject"
                        ? "bg-rose-600 hover:bg-rose-700"
                        : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                  >
                    {selectedAction === "approve"
                      ? "Approve & Refund"
                      : selectedAction === "reject"
                      ? "Reject"
                      : "Reassign"}
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : null}
      </div>

      <ConfirmModal
        isOpen={confirmAction != null}
        onClose={() => setConfirmAction(null)}
        title={
          confirmAction === "approve"
            ? t("providerCancelRequests.confirmApproveTitle")
            : confirmAction === "reject"
              ? t("providerCancelRequests.confirmRejectTitle")
              : t("providerCancelRequests.confirmReassignTitle")
        }
        message={
          confirmAction === "approve"
            ? t("providerCancelRequests.confirmApproveBody", {
                amount: fmtBDT(preview.refundAmount),
              })
            : confirmAction === "reject"
              ? t("providerCancelRequests.confirmRejectBody")
              : t("providerCancelRequests.confirmReassignBody", {
                  provider:
                    selectedReassignProvider?.label ??
                    (newProviderId !== "" ? `#${newProviderId}` : ""),
                })
        }
        confirmLabel={t("providerCancelRequests.confirm")}
        cancelLabel={t("providerCancelRequests.cancel")}
        onConfirm={runAction}
        confirmVariant={confirmAction === "reject" ? "danger" : "primary"}
      />
    </>
  );
}
