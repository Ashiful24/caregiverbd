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
  type ProviderCancelReviewListItem,
  type ProviderListItem,
} from "../services/api";
import { formatDateTime, formatStatusLabel } from "../utils/format";
import { fmtBDT } from "./financial/shared";

// ── Types ─────────────────────────────────────────────────────────────────────

type BatchShift = {
  cancellationId: number;
  shiftId: number;
  scheduledDate: string | null;
  scheduledTime: string | null;
  fee: string;
  reasonCategory: string | null;
  reasonNote: string | null;
  reviewStatus: string;
  srStatus: string | null;
  previousSrStatus: string | null;
  refundPreview: { feeAmount: string; refundAmount: string };
};

type BatchDetail = {
  batchId: string;
  opportunityId: number | null;
  reviewStatus: string;
  shiftCount: number;
  resolvedCount: number;
  earliestDate: string | null;
  latestDate: string | null;
  reasonCategory: string | null;
  reasonNote: string | null;
  createdAt: string | null;
  provider: { id: number; name: string | null } | null;
  patient: { id: number; name: string | null } | null;
  shifts: BatchShift[];
};

type Decision = "approve" | "reject" | "reassign";

type ShiftDecision = {
  decision: Decision;
  refundAmount: string;
  newProviderId: number | null;
  notes: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function reviewStatusBadgeColor(
  status: string
): "success" | "error" | "warning" | "light" {
  switch (status) {
    case "APPROVED":
    case "RESOLVED":
      return "success";
    case "REJECTED":
      return "error";
    case "REASSIGNED":
      return "light";
    default:
      return "warning";
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProviderCancelBatchDetail() {
  const { t } = useTranslation();
  const { batchId } = useParams<{ batchId: string }>();

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [decisions, setDecisions] = useState<Record<number, ShiftDecision>>({});

  const [providers, setProviders] = useState<ProviderListItem[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<ProviderCancelReviewListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchBatch = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const res = await adminProviderCancelApi.getBatch(batchId);
      const data = ((res as unknown as { data?: BatchDetail }).data ?? res) as BatchDetail;
      setBatch(data);
      setDecisions({});
    } catch {
      setError("Failed to load batch.");
      setBatch(null);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => { fetchBatch(); }, [fetchBatch]);

  const isPending = batch?.reviewStatus === "PENDING";

  const pendingShifts = useMemo(
    () => batch?.shifts.filter((s) => s.reviewStatus === "PENDING") ?? [],
    [batch]
  );
  const resolvedShifts = useMemo(
    () => batch?.shifts.filter((s) => s.reviewStatus !== "PENDING") ?? [],
    [batch]
  );

  useEffect(() => {
    if (!isPending) { setProviders([]); return; }
    const controller = new AbortController();
    (async () => {
      setLoadingProviders(true);
      try {
        const res = await providersApi.getList(
          { status: "active", limit: 200, page: 1 },
          { signal: controller.signal }
        );
        const body = (res?.data as { providers?: ProviderListItem[] }) ?? res;
        const list =
          (body as { providers?: ProviderListItem[] }).providers ??
          (res as { providers?: ProviderListItem[] }).providers ??
          [];
        setProviders(Array.isArray(list) ? list : []);
      } catch {
        if (!controller.signal.aborted) setProviders([]);
      } finally {
        if (!controller.signal.aborted) setLoadingProviders(false);
      }
    })();
    return () => controller.abort();
  }, [isPending]);

  // ── Decision helpers ───────────────────────────────────────────────────────

  const setShiftDecision = (cancellationId: number, d: Decision, shift: BatchShift) => {
    setDecisions((prev) => ({
      ...prev,
      [cancellationId]: {
        decision: d,
        refundAmount: shift.refundPreview.refundAmount,
        newProviderId: null,
        notes: "",
      },
    }));
  };

  const patchDecision = (cancellationId: number, patch: Partial<ShiftDecision>) => {
    setDecisions((prev) => ({
      ...prev,
      [cancellationId]: { ...prev[cancellationId], ...patch },
    }));
  };

  const clearDecision = (cancellationId: number) => {
    setDecisions((prev) => {
      const next = { ...prev };
      delete next[cancellationId];
      return next;
    });
  };

  const isDecisionValid = (s: BatchShift) => {
    const d = decisions[s.cancellationId];
    if (!d) return false;
    if (d.decision === "reject" && !d.notes.trim()) return false;
    if (d.decision === "reassign" && !d.newProviderId) return false;
    return true;
  };

  const allDecided = useMemo(
    () => pendingShifts.length > 0 && pendingShifts.every(isDecisionValid),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [decisions, pendingShifts]
  );

  const decidedCount = pendingShifts.filter(isDecisionValid).length;

  const approveCount  = pendingShifts.filter((s) => decisions[s.cancellationId]?.decision === "approve" && isDecisionValid(s)).length;
  const reassignCount = pendingShifts.filter((s) => decisions[s.cancellationId]?.decision === "reassign" && isDecisionValid(s)).length;
  const rejectCount   = pendingShifts.filter((s) => decisions[s.cancellationId]?.decision === "reject"   && isDecisionValid(s)).length;
  const totalRefundAmount = pendingShifts
    .filter((s) => decisions[s.cancellationId]?.decision === "approve")
    .reduce((sum, s) => sum + (parseFloat(decisions[s.cancellationId]?.refundAmount || "0") || 0), 0);

  // ── Process ────────────────────────────────────────────────────────────────

  const handleProcess = async () => {
    if (!batchId || !allDecided) return;
    setProcessing(true);
    setError("");
    setSuccessMessage("");
    try {
      const actions = pendingShifts.map((s) => {
        const d = decisions[s.cancellationId]!;
        return {
          cancellationId: s.cancellationId,
          decision: d.decision,
          refundAmount: d.decision === "approve" ? parseFloat(d.refundAmount) || undefined : undefined,
          newProviderId: d.decision === "reassign" ? d.newProviderId ?? undefined : undefined,
          shiftNotes: d.notes.trim() || undefined,
        };
      });

      const res = await adminProviderCancelApi.processBatch(batchId, { actions });
      const data = (res as { data?: { processed: number } }).data ?? res;
      const processed = (data as { processed?: number }).processed ?? pendingShifts.length;
      setSuccessMessage(`Processed ${processed} shift${processed !== 1 ? "s" : ""} successfully.`);
      setConfirmOpen(false);
      await fetchBatch();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("providerCancelRequests.actionFailed");
      setError(message);
      setConfirmOpen(false);
    } finally {
      setProcessing(false);
    }
  };

  // ── Render states ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <PageMeta title="Provider Cancel Batch | Hope Admin" description="Review multi-shift provider cancellation batch." />
        <PageBreadcrumb pageTitle="Batch Review" />
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          {t("systemConfig.loading")}
        </div>
      </>
    );
  }

  if (error && !batch) {
    return (
      <>
        <PageMeta title="Provider Cancel Batch | Hope Admin" description="Review multi-shift provider cancellation batch." />
        <PageBreadcrumb pageTitle="Batch Review" />
        <p className="text-rose-600 dark:text-rose-400">{error}</p>
        <Link to="/provider-cancel-requests" className="mt-4 inline-block text-brand-600 hover:underline dark:text-brand-400">
          ← {t("providerCancelRequests.backToList")}
        </Link>
      </>
    );
  }

  if (!batch) return null;

  return (
    <>
      <PageMeta title="Provider Cancel Batch | Hope Admin" description="Review multi-shift provider cancellation batch." />
      <PageBreadcrumb
        pageTitle={`Batch Review — ${batch.shiftCount} shift${batch.shiftCount !== 1 ? "s" : ""}`}
      />

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link
            to="/provider-cancel-requests"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            ← Back to Queue
          </Link>
        </div>

        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-100">{error}</p>
        ) : null}
        {successMessage ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">{successMessage}</p>
        ) : null}

        {/* ── Batch Summary ───────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {t("providerCancelRequests.requestSummary")}
            </h3>
            <Badge size="sm" color={reviewStatusBadgeColor(batch.reviewStatus)}>
              {formatStatusLabel(batch.reviewStatus)}
            </Badge>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-gray-500 dark:text-gray-400">{t("providerCancelRequests.submittedAt")}:</span>{" "}
              {batch.createdAt ? formatDateTime(batch.createdAt) : "—"}
            </p>
            <p>
              <span className="text-gray-500 dark:text-gray-400">Batch ID:</span>{" "}
              <span className="font-mono text-xs">{batch.batchId}</span>
            </p>
            {batch.opportunityId ? (
              <p>
                <span className="text-gray-500 dark:text-gray-400">LTO:</span>{" "}
                <Link to={`/schedule/${batch.opportunityId}`} className="font-mono text-brand-600 hover:underline dark:text-brand-400">
                  #{batch.opportunityId}
                </Link>
              </p>
            ) : null}
            <p>
              <span className="text-gray-500 dark:text-gray-400">{t("providerCancelRequests.colProvider")}:</span>{" "}
              {batch.provider?.name ?? "—"}
            </p>
            <p>
              <span className="text-gray-500 dark:text-gray-400">{t("providerCancelRequests.colPatient")}:</span>{" "}
              {batch.patient?.name ?? "—"}
            </p>
            <p>
              <span className="text-gray-500 dark:text-gray-400">Shifts:</span>{" "}
              {batch.resolvedCount} / {batch.shiftCount} resolved
            </p>
            {batch.earliestDate || batch.latestDate ? (
              <p>
                <span className="text-gray-500 dark:text-gray-400">Date range:</span>{" "}
                {[batch.earliestDate, batch.latestDate].filter(Boolean).join(" – ") || "—"}
              </p>
            ) : null}
            <p className="sm:col-span-2">
              <span className="text-gray-500 dark:text-gray-400">{t("providerCancelRequests.colReason")}:</span>{" "}
              {batch.reasonCategory ? formatStatusLabel(batch.reasonCategory) : "—"}
              {batch.reasonNote ? (
                <span className="block text-gray-600 dark:text-gray-300">{batch.reasonNote}</span>
              ) : null}
            </p>
          </div>
        </section>

        {/* ── Cancel history toggle ───────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              if (!showHistory && !historyLoaded) {
                setHistoryLoading(true);
                try {
                  const res = await adminProviderCancelApi.list({
                    providerId: batch.provider?.id,
                    limit: 30,
                  });
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
        </div>

        {/* ── Cancel history table ────────────────────────────────────────── */}
        {showHistory && !historyLoading ? (
          <section className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800/60 dark:bg-white/[0.03]">
            <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-white/80">
                Provider cancel history (90 days)
              </h3>
            </div>
            {historyItems.length === 0 ? (
              <p className="px-5 py-4 text-xs text-gray-400">No cancel history found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-900/20">
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">Submitted</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">Status</th>
                    <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((h) => (
                    <tr key={h.id} className="border-b border-gray-100/70 last:border-0 dark:border-gray-800/50">
                      <td className="px-5 py-2.5 text-xs text-gray-600 dark:text-gray-400">
                        {formatDateTime(h.createdAt ?? "")}
                      </td>
                      <td className="px-5 py-2.5 text-xs">
                        {formatStatusLabel(h.reviewStatus ?? "")}
                      </td>
                      <td className="px-5 py-2.5 text-xs text-gray-600 dark:text-gray-400">
                        {h.reasonCategory ? formatStatusLabel(h.reasonCategory) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ) : null}

        {/* ── Shifts Table ─────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              Shifts
              <span className="ml-2 text-sm font-normal text-gray-400">
                {batch.shiftCount} total
                {pendingShifts.length > 0 ? ` · ${pendingShifts.length} pending` : ""}
                {resolvedShifts.length > 0 ? ` · ${resolvedShifts.length} resolved` : ""}
              </span>
            </h3>
            {isPending && pendingShifts.length > 0 ? (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {decidedCount} / {pendingShifts.length} decided
              </span>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-900/20">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Shift</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Scheduled</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Fee</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Max Refund</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Decision</th>
                </tr>
              </thead>
              <tbody>
                {/* Pending shifts first */}
                {pendingShifts.map((shift) => (
                  <ShiftTableRows
                    key={shift.cancellationId}
                    shift={shift}
                    currentProviderId={batch.provider?.id ?? null}
                    providers={providers}
                    loadingProviders={loadingProviders}
                    decision={decisions[shift.cancellationId] ?? null}
                    onDecide={(d) => setShiftDecision(shift.cancellationId, d, shift)}
                    onClear={() => clearDecision(shift.cancellationId)}
                    onPatch={(patch) => patchDecision(shift.cancellationId, patch)}
                    t={t}
                  />
                ))}

                {/* Resolved shifts — compact rows, no sub-row */}
                {resolvedShifts.map((shift) => (
                  <tr
                    key={shift.cancellationId}
                    className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                  >
                    <td className="px-4 py-3">
                      <Link to={`/schedule/${shift.shiftId}`} className="font-mono text-xs text-brand-600 hover:underline dark:text-brand-400">
                        #{shift.shiftId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                      {shift.scheduledDate ?? "—"}
                      {shift.scheduledTime ? <span className="ml-1 text-gray-400">{shift.scheduledTime}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                      {fmtBDT(shift.fee)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {fmtBDT(shift.refundPreview.refundAmount)}
                    </td>
                    <td className="px-4 py-3">
                      {shift.srStatus ? (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatStatusLabel(shift.srStatus)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge size="sm" color={reviewStatusBadgeColor(shift.reviewStatus)}>
                        {formatStatusLabel(shift.reviewStatus)}
                      </Badge>
                    </td>
                  </tr>
                ))}

                {batch.shifts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">
                      No shifts found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Decision summary ────────────────────────────────────────────── */}
        {isPending && decidedCount > 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="mb-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Decision summary</p>
            <div className="flex flex-wrap gap-4">
              {approveCount > 0 ? (
                <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-2.5 dark:bg-emerald-950/30">
                  <div>
                    <p className="text-2xl font-bold leading-none text-emerald-600 dark:text-emerald-400">{approveCount}</p>
                    <p className="mt-0.5 text-xs text-emerald-700/70 dark:text-emerald-400/70">Approve</p>
                  </div>
                  <div className="h-8 w-px bg-emerald-200 dark:bg-emerald-800" />
                  <div>
                    <p className="text-sm font-semibold leading-none text-emerald-700 dark:text-emerald-300">{fmtBDT(totalRefundAmount.toFixed(2))}</p>
                    <p className="mt-0.5 text-xs text-emerald-700/70 dark:text-emerald-400/70">Total refund</p>
                  </div>
                </div>
              ) : null}
              {reassignCount > 0 ? (
                <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2.5 dark:bg-indigo-950/30">
                  <div>
                    <p className="text-2xl font-bold leading-none text-indigo-600 dark:text-indigo-400">{reassignCount}</p>
                    <p className="mt-0.5 text-xs text-indigo-700/70 dark:text-indigo-400/70">Reassign</p>
                  </div>
                </div>
              ) : null}
              {rejectCount > 0 ? (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 dark:bg-rose-950/30">
                  <div>
                    <p className="text-2xl font-bold leading-none text-rose-600 dark:text-rose-400">{rejectCount}</p>
                    <p className="mt-0.5 text-xs text-rose-700/70 dark:text-rose-400/70">Reject</p>
                  </div>
                </div>
              ) : null}
              {pendingShifts.length - decidedCount > 0 ? (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 dark:bg-amber-950/30">
                  <div>
                    <p className="text-2xl font-bold leading-none text-amber-600 dark:text-amber-400">{pendingShifts.length - decidedCount}</p>
                    <p className="mt-0.5 text-xs text-amber-700/70 dark:text-amber-400/70">Pending</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* ── Process / Cancel buttons ────────────────────────────────────── */}
        {isPending && pendingShifts.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!allDecided || processing}
              onClick={() => setConfirmOpen(true)}
              className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {processing
                ? "Processing…"
                : `Process ${decidedCount} / ${pendingShifts.length} shift${pendingShifts.length !== 1 ? "s" : ""}`}
            </button>
            <Link
              to="/provider-cancel-requests"
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </Link>
            {!allDecided ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {pendingShifts.length - decidedCount} shift{pendingShifts.length - decidedCount !== 1 ? "s" : ""} still need a valid decision.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Process batch decisions?"
        message={`This will apply ${decidedCount} decision${decidedCount !== 1 ? "s" : ""} across ${pendingShifts.length} pending shift${pendingShifts.length !== 1 ? "s" : ""}. This cannot be undone.`}
        confirmLabel="Process"
        cancelLabel={t("providerCancelRequests.cancel")}
        onConfirm={handleProcess}
        confirmVariant="primary"
      />
    </>
  );
}

// ── ShiftTableRows ────────────────────────────────────────────────────────────

type ShiftTableRowsProps = {
  shift: BatchShift;
  currentProviderId: number | null;
  providers: ProviderListItem[];
  loadingProviders: boolean;
  decision: ShiftDecision | null;
  onDecide: (d: Decision) => void;
  onClear: () => void;
  onPatch: (patch: Partial<ShiftDecision>) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
};

function ShiftTableRows({
  shift,
  currentProviderId,
  providers,
  loadingProviders,
  decision,
  onDecide,
  onClear,
  onPatch,
  t,
}: ShiftTableRowsProps) {
  const [refundMode, setRefundMode] = useState<"amount" | "percent">("amount");
  const [percentInput, setPercentInput] = useState("100");

  const providerOptions = useMemo(
    () =>
      providers
        .filter((p) => p.id !== currentProviderId)
        .map((p) => ({
          value: p.id,
          label:
            [p.firstName, p.lastName].filter(Boolean).join(" ") ||
            p.name ||
            `Provider #${p.id}`,
        })),
    [currentProviderId, providers]
  );

  // paidAmount = what the patient actually paid for this shift (the correct base for percentages)
  // policyRefund = what the policy recommends refunding (pre-filled default; can be 0 for IN_PROGRESS)
  const paidAmount = parseFloat(shift.fee || "0");
  const policyRefund = parseFloat(shift.refundPreview.refundAmount || "0");
  const refundValue = decision ? parseFloat(decision.refundAmount || "0") : policyRefund;
  const pct = paidAmount > 0 ? Math.round((refundValue / paidAmount) * 100) : 0;
  const isPartialRefund =
    decision?.decision === "approve" && refundValue > 0 && refundValue < paidAmount;

  const handlePercentChange = (raw: string) => {
    setPercentInput(raw);
    const p = Math.min(100, Math.max(0, parseFloat(raw) || 0));
    onPatch({ refundAmount: ((p / 100) * paidAmount).toFixed(2) });
  };

  const handleAmountChange = (raw: string) => {
    onPatch({ refundAmount: raw });
    setPercentInput(
      String(paidAmount > 0
        ? Math.min(100, Math.max(0, Math.round(((parseFloat(raw) || 0) / paidAmount) * 100)))
        : 0)
    );
  };

  const switchMode = (mode: "amount" | "percent") => {
    setRefundMode(mode);
    if (mode === "percent") setPercentInput(String(pct));
  };

  return (
    <>
      {/* Main data row */}
      <tr className={`border-b border-gray-100 dark:border-gray-800 ${decision ? "bg-brand-50/30 dark:bg-brand-900/10" : ""}`}>
        <td className="px-4 py-3">
          <Link
            to={`/schedule/${shift.shiftId}`}
            className="font-mono text-xs text-brand-600 hover:underline dark:text-brand-400"
          >
            #{shift.shiftId}
          </Link>
        </td>
        <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
          {shift.scheduledDate ?? "—"}
          {shift.scheduledTime ? (
            <span className="ml-1 text-gray-400">{shift.scheduledTime}</span>
          ) : null}
        </td>
        <td className="px-4 py-3 text-xs font-medium text-gray-800 dark:text-gray-200">
          {fmtBDT(shift.fee)}
        </td>
        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
          {fmtBDT(shift.refundPreview.refundAmount)}
        </td>
        <td className="px-4 py-3">
          <Badge
            size="sm"
            color={
              shift.reviewStatus === "PENDING" ? "warning" : reviewStatusBadgeColor(shift.reviewStatus)
            }
          >
            {formatStatusLabel(shift.reviewStatus)}
          </Badge>
        </td>
        <td className="px-4 py-3">
          {!decision ? (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onDecide("approve")}
                className="rounded-md bg-brand-500 px-2.5 py-1 text-xs text-white hover:bg-brand-600"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => onDecide("reassign")}
                className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              >
                Reassign
              </button>
              <button
                type="button"
                onClick={() => onDecide("reject")}
                className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
              >
                Reject
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge
                size="sm"
                color={
                  decision.decision === "approve"
                    ? "success"
                    : decision.decision === "reject"
                    ? "error"
                    : "light"
                }
              >
                {decision.decision === "approve"
                  ? "Approve"
                  : decision.decision === "reject"
                  ? "Reject"
                  : "Reassign"}
              </Badge>
              <button
                type="button"
                onClick={onClear}
                className="text-xs text-gray-400 underline hover:text-gray-600 dark:hover:text-gray-300"
              >
                Change
              </button>
            </div>
          )}
        </td>
      </tr>

      {/* Decision panel — card style */}
      {decision ? (
        <tr className="border-b border-gray-100 dark:border-gray-800">
          <td colSpan={6} className="px-4 py-2">
            <div
              className={`rounded-xl border p-4 ${
                decision.decision === "approve"
                  ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/50 dark:bg-emerald-950/25"
                  : decision.decision === "reject"
                  ? "border-rose-200 bg-rose-50/60 dark:border-rose-800/50 dark:bg-rose-950/25"
                  : "border-indigo-200 bg-indigo-50/60 dark:border-indigo-800/50 dark:bg-indigo-950/25"
              }`}
            >
              {/* Panel header */}
              <div className="mb-3 flex items-center justify-between">
                <p
                  className={`text-xs font-semibold tracking-wide ${
                    decision.decision === "approve"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : decision.decision === "reject"
                      ? "text-rose-700 dark:text-rose-400"
                      : "text-indigo-700 dark:text-indigo-400"
                  }`}
                >
                  {decision.decision === "approve"
                    ? "Approve & Refund Patient"
                    : decision.decision === "reject"
                    ? "Reject — Restore Shift to Provider"
                    : "Reassign to New Provider"}
                </p>
                <button
                  type="button"
                  onClick={onClear}
                  className="rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
                >
                  ← Change decision
                </button>
              </div>

              {/* Fields row */}
              <div className="flex flex-wrap items-start gap-5">

                {/* Approve: refund amount / % */}
                {decision.decision === "approve" ? (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                      Refund amount
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Mode toggle */}
                      <span className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white text-xs dark:border-gray-700 dark:bg-gray-900">
                        <button
                          type="button"
                          onClick={() => switchMode("amount")}
                          className={`px-3 py-1.5 ${
                            refundMode === "amount"
                              ? "bg-brand-500 text-white"
                              : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                          }`}
                        >
                          BDT
                        </button>
                        <button
                          type="button"
                          onClick={() => switchMode("percent")}
                          className={`px-3 py-1.5 ${
                            refundMode === "percent"
                              ? "bg-brand-500 text-white"
                              : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                          }`}
                        >
                          %
                        </button>
                      </span>

                      {/* Input */}
                      {refundMode === "amount" ? (
                        <input
                          type="number"
                          min={0}
                          max={paidAmount}
                          step="0.01"
                          value={decision.refundAmount}
                          onChange={(e) => handleAmountChange(e.target.value)}
                          className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="1"
                            value={percentInput}
                            onChange={(e) => handlePercentChange(e.target.value)}
                            className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                          />
                          <span className="text-sm text-gray-400">%</span>
                        </div>
                      )}

                      {/* Result chip — always visible */}
                      <div className="flex items-baseline gap-1.5 rounded-lg bg-white px-3 py-1.5 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {fmtBDT(decision.refundAmount)}
                        </span>
                        <span className="text-xs text-gray-400">{pct}%</span>
                      </div>

                      {/* Status pill */}
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isPartialRefund
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            : refundValue <= 0
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        }`}
                      >
                        {isPartialRefund ? "Partial" : refundValue <= 0 ? "No refund" : "Full refund"}
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* Reassign: provider select */}
                {decision.decision === "reassign" ? (
                  <div className="min-w-[200px] flex-1 max-w-xs">
                    <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                      New provider <span className="text-rose-500">*</span>
                    </p>
                    {loadingProviders ? (
                      <p className="text-xs text-gray-400">{t("providerCancelRequests.loadingProviders")}</p>
                    ) : providerOptions.length === 0 ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {t("providerCancelRequests.noReplacementProviders")}
                      </p>
                    ) : (
                      <SearchableSelect<number>
                        value={decision.newProviderId}
                        onChange={(v) => onPatch({ newProviderId: v ?? null })}
                        placeholder={t("providerCancelRequests.reassignSelectPlaceholder")}
                        clearLabel={t("providerCancelRequests.reassignClear")}
                        searchPlaceholder={t("providerCancelRequests.reassignSearchPlaceholder")}
                        className="min-h-[38px]"
                        options={providerOptions}
                      />
                    )}
                    <p className="mt-1 min-h-[1rem] text-xs text-rose-500">
                      {!loadingProviders && providerOptions.length > 0 && !decision.newProviderId
                        ? "Select a provider"
                        : ""}
                    </p>
                  </div>
                ) : null}

                {/* Notes */}
                <div className="min-w-[180px] flex-1 max-w-sm">
                  <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                    Notes
                    {decision.decision === "reject" ? (
                      <span className="ml-0.5 text-rose-500">*</span>
                    ) : (
                      <span className="ml-1 font-normal text-gray-400">(optional)</span>
                    )}
                  </p>
                  <input
                    type="text"
                    value={decision.notes}
                    onChange={(e) => onPatch({ notes: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    placeholder={
                      decision.decision === "reject"
                        ? "Reason for rejection (required)"
                        : t("providerCancelRequests.adminNotesPlaceholder")
                    }
                  />
                  <p className="mt-1 min-h-[1rem] text-xs text-rose-500">
                    {decision.decision === "reject" && !decision.notes.trim()
                      ? "Required when rejecting"
                      : ""}
                  </p>
                </div>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
