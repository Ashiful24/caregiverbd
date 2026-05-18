import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import Badge from "../components/ui/badge/Badge";
import { ConfirmModal } from "../components/ui/confirm-modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  adminProviderCancelApi,
  type ProviderCancelReviewDetail,
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
      const firstAvailable = body.suggestedReplacements?.find((r) => r.isAvailable);
      if (firstAvailable) {
        setNewProviderId(firstAvailable.providerId);
      } else if (body.suggestedReplacements?.[0]) {
        setNewProviderId(body.suggestedReplacements[0].providerId);
      }
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

  const isPending = detail?.reviewStatus === "PENDING";

  const runAction = async () => {
    if (!confirmAction || !requestId || Number.isNaN(requestId)) return;
    setActionBusy(true);
    setError("");
    try {
      if (confirmAction === "approve") {
        await adminProviderCancelApi.approve(requestId, {
          adminNotes: adminNotes.trim() || undefined,
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
          setError(t("providerCancelRequests.reassignProviderRequired"));
          setActionBusy(false);
          setConfirmAction(null);
          return;
        }
        await adminProviderCancelApi.reassign(requestId, {
          newProviderId: pid,
          adminNotes: adminNotes.trim() || undefined,
        });
        setSuccessMessage(t("providerCancelRequests.reassignSuccess"));
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

        {detail.cancelHistory.length > 0 ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">
              {t("providerCancelRequests.providerHistory")}
            </h3>
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell isHeader className="px-3 py-2 text-xs">
                      {t("providerCancelRequests.colSubmitted")}
                    </TableCell>
                    <TableCell isHeader className="px-3 py-2 text-xs">
                      {t("providerCancelRequests.colReviewStatus")}
                    </TableCell>
                    <TableCell isHeader className="px-3 py-2 text-xs">
                      {t("providerCancelRequests.colReason")}
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.cancelHistory.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="px-3 py-2 text-xs">
                        {formatDateTime(h.createdAt ?? "")}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs">
                        {formatStatusLabel(h.reviewStatus ?? "")}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs">
                        {h.reasonCategory ? formatStatusLabel(h.reasonCategory) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}

        {isPending ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-white/90">
              {t("providerCancelRequests.adminActions")}
            </h3>

            {detail.suggestedReplacements.length > 0 ? (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">
                  {t("providerCancelRequests.suggestedReplacements")}
                </p>
                <ul className="space-y-1 text-sm">
                  {detail.suggestedReplacements.map((r) => (
                    <li key={r.providerId} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setNewProviderId(r.providerId)}
                        className={`rounded px-2 py-0.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800 ${
                          newProviderId === r.providerId
                            ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                            : ""
                        }`}
                      >
                        {r.name} (#{r.providerId})
                      </button>
                      <Badge size="sm" color={r.isAvailable ? "success" : "light"}>
                        {r.isAvailable
                          ? t("providerCancelRequests.available")
                          : t("providerCancelRequests.busy")}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                {t("providerCancelRequests.reassignProviderId")}
              </span>
              <input
                type="number"
                min={1}
                value={newProviderId === "" ? "" : newProviderId}
                onChange={(e) => {
                  const v = e.target.value;
                  setNewProviderId(v === "" ? "" : Number(v));
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
            </div>

            <label className="mb-4 block text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                {t("providerCancelRequests.adminNotes")}
              </span>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                placeholder={t("providerCancelRequests.adminNotesPlaceholder")}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setConfirmAction("approve")}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600 disabled:opacity-60"
              >
                {t("providerCancelRequests.approve")}
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setConfirmAction("reassign")}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              >
                {t("providerCancelRequests.reassign")}
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => setConfirmAction("reject")}
                className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm text-rose-800 hover:bg-rose-100 disabled:opacity-60 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
              >
                {t("providerCancelRequests.reject")}
              </button>
            </div>
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
              : t("providerCancelRequests.confirmReassignBody")
        }
        confirmLabel={t("providerCancelRequests.confirm")}
        cancelLabel={t("providerCancelRequests.cancel")}
        onConfirm={runAction}
        confirmVariant={confirmAction === "reject" ? "danger" : "primary"}
      />
    </>
  );
}
