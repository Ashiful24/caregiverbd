import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import Badge from "../components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { adminProviderCancelApi, providersApi, type ProviderListItem } from "../services/api";
import { fmtBDT } from "./financial/shared";
import { SearchableSelect } from "../components/form/SearchableSelect";

type BatchShift = {
  cancellationId: number;
  shiftId: number;
  scheduledDate: string | null;
  scheduledTime: string | null;
  fee: string;
  reasonCategory: string | null;
  reviewStatus: string;
  srStatus: string | null;
  previousSrStatus: string | null;
  refundPreview: { feeAmount: string; refundAmount: string };
};

type ShiftAction = {
  decision: "approve" | "reject" | "reassign" | null;
  refundAmount: string;       // for approve — editable
  newProviderId: number | null;  // for reassign
  shiftNotes: string;
};

function statusBadgeColor(status: string): "success" | "error" | "warning" | "light" {
  switch (status) {
    case "APPROVED": case "REFUNDED": case "REASSIGNED": return "success";
    case "REJECTED": case "REFUND_FAILED": return "error";
    case "PENDING": case "REFUND_IN_PROGRESS": return "warning";
    default: return "light";
  }
}

export default function ProviderCancelBatchDetail() {
  const { batchId } = useParams<{ batchId: string }>();
  const [batch, setBatch] = useState<{ batchId: string; opportunityId: number | null; shifts: BatchShift[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [providers, setProviders] = useState<ProviderListItem[]>([]);

  // Per-shift action state
  const [actions, setActions] = useState<Record<number, ShiftAction>>({});

  const fetchBatch = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    setError("");
    try {
      const res = await adminProviderCancelApi.getBatch(batchId);
      const data = (res as any).data ?? res;
      setBatch(data);
      // Initialise action state for each pending shift
      const init: Record<number, ShiftAction> = {};
      (data.shifts as BatchShift[]).forEach((s) => {
        if (s.reviewStatus === "PENDING") {
          init[s.cancellationId] = {
            decision: null,
            refundAmount: s.fee,   // default = full refund
            newProviderId: null,
            shiftNotes: "",
          };
        }
      });
      setActions(init);
    } catch {
      setError("Failed to load batch.");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => { fetchBatch(); }, [fetchBatch]);

  // Load providers for reassign dropdowns
  useEffect(() => {
    providersApi.getList({ limit: 200 }).then((res) => {
      const data = (res as any).data ?? res;
      setProviders(Array.isArray(data.data) ? data.data : []);
    }).catch(() => {});
  }, []);

  const setShiftAction = (cancellationId: number, patch: Partial<ShiftAction>) => {
    setActions((prev) => ({ ...prev, [cancellationId]: { ...prev[cancellationId], ...patch } }));
  };

  const pendingShifts = batch?.shifts.filter((s) => s.reviewStatus === "PENDING") ?? [];
  const allDecided = pendingShifts.every((s) => actions[s.cancellationId]?.decision != null);

  const handleProcess = async () => {
    if (!batchId || !allDecided) return;
    setProcessing(true);
    setError("");
    setSuccessMsg("");
    try {
      const actionsPayload = pendingShifts
        .map((s) => {
          const a = actions[s.cancellationId];
          if (!a?.decision) return null;
          return {
            cancellationId: s.cancellationId,
            decision: a.decision,
            refundAmount: a.decision === "approve" ? parseFloat(a.refundAmount) || undefined : undefined,
            newProviderId: a.decision === "reassign" ? a.newProviderId ?? undefined : undefined,
            shiftNotes: a.shiftNotes || undefined,
          };
        })
        .filter(Boolean) as any[];

      const res = await adminProviderCancelApi.processBatch(batchId, { actions: actionsPayload });
      const data = (res as any).data ?? res;
      setSuccessMsg(`Processed ${data.processed} shift(s).`);
      fetchBatch();
    } catch {
      setError("Failed to process batch.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <PageMeta title="Provider Cancel Batch | Hope Admin" description="Review and process multi-shift provider cancellation requests." />
      <PageBreadcrumb pageTitle="Provider Cancel Batch" />

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Batch: <span className="font-mono text-sm">{batchId}</span>
            </h3>
            {batch?.opportunityId && (
              <p className="text-xs text-gray-500 mt-0.5">LTO #{batch.opportunityId}</p>
            )}
          </div>
          {pendingShifts.length > 0 && (
            <button
              onClick={handleProcess}
              disabled={!allDecided || processing}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {processing ? "Processing…" : `Process ${pendingShifts.length} shift(s)`}
            </button>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
        {successMsg && <p className="mb-3 text-sm text-emerald-600">{successMsg}</p>}
        {!allDecided && pendingShifts.length > 0 && (
          <p className="mb-3 text-xs text-amber-600">
            Select a decision for all {pendingShifts.length} pending shift(s) before processing.
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : batch ? (
          <div className="overflow-x-auto -mx-1 px-1">
            <Table className="min-w-[64rem]">
              <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                <TableRow>
                  {["Shift #", "Date / Time", "Fee", "Reason", "Status", "Decision", "Refund Amount", "New Provider / Notes"].map((h) => (
                    <TableCell key={h} isHeader className="text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 py-3">
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {batch.shifts.map((shift) => {
                  const action = actions[shift.cancellationId];
                  const isPending = shift.reviewStatus === "PENDING";

                  return (
                    <TableRow key={shift.cancellationId}>
                      <TableCell className="font-medium text-gray-800 dark:text-white/90 py-3 text-sm">
                        #{shift.shiftId}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-gray-700 dark:text-gray-300">
                        {shift.scheduledDate ?? "—"}<br />
                        <span className="text-xs text-gray-400">{shift.scheduledTime ?? ""}</span>
                      </TableCell>
                      <TableCell className="py-3 text-sm font-medium">{fmtBDT(shift.fee)}</TableCell>
                      <TableCell className="py-3 text-xs text-gray-500">{shift.reasonCategory ?? "—"}</TableCell>
                      <TableCell className="py-3">
                        <Badge color={statusBadgeColor(shift.reviewStatus)} size="sm">
                          {shift.reviewStatus}
                        </Badge>
                      </TableCell>

                      {/* Decision dropdown — only for PENDING shifts */}
                      <TableCell className="py-3">
                        {isPending ? (
                          <select
                            value={action?.decision ?? ""}
                            onChange={(e) => setShiftAction(shift.cancellationId, { decision: (e.target.value || null) as any })}
                            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                          >
                            <option value="">— select —</option>
                            <option value="approve">Approve refund</option>
                            <option value="reject">Reject</option>
                            <option value="reassign">Reassign provider</option>
                          </select>
                        ) : (
                          <span className="text-xs text-gray-400">resolved</span>
                        )}
                      </TableCell>

                      {/* Refund amount — only for approve */}
                      <TableCell className="py-3">
                        {isPending && action?.decision === "approve" ? (
                          <div>
                            <input
                              type="number"
                              min={0}
                              max={parseFloat(shift.fee)}
                              step="0.01"
                              value={action.refundAmount}
                              onChange={(e) => setShiftAction(shift.cancellationId, { refundAmount: e.target.value })}
                              className="w-28 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                            />
                            {parseFloat(action.refundAmount) < parseFloat(shift.fee) && (
                              <p className="text-xs text-amber-600 mt-0.5">
                                Fee retained: {fmtBDT((parseFloat(shift.fee) - parseFloat(action.refundAmount)).toFixed(2))}
                              </p>
                            )}
                          </div>
                        ) : isPending && action?.decision === "reject" ? (
                          <span className="text-xs text-gray-400">No refund</span>
                        ) : isPending && action?.decision === "reassign" ? (
                          <span className="text-xs text-gray-400">N/A</span>
                        ) : (
                          <span className="text-xs text-gray-400">{fmtBDT(shift.refundPreview.refundAmount)}</span>
                        )}
                      </TableCell>

                      {/* New provider (reassign) or notes */}
                      <TableCell className="py-3">
                        {isPending && action?.decision === "reassign" ? (
                          <SearchableSelect
                            options={providers.map((p) => ({
                              value: p.id,
                              label: [p.firstName, p.lastName].filter(Boolean).join(" ") || `Provider #${p.id}`,
                            }))}
                            value={action.newProviderId}
                            onChange={(v) => setShiftAction(shift.cancellationId, { newProviderId: v as number })}
                            placeholder="Select provider"
                          />
                        ) : isPending ? (
                          <input
                            type="text"
                            placeholder="Notes (optional)"
                            value={action?.shiftNotes ?? ""}
                            onChange={(e) => setShiftAction(shift.cancellationId, { shiftNotes: e.target.value })}
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                          />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </section>
    </>
  );
}
