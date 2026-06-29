import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";
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
import {
  upgradeRequestsApi,
  adminUsersApi,
  adminDocumentsApi,
  verificationDocumentTypesApi,
  type UpgradeRequestListItem,
  type AdminVerificationDocumentsResponse,
  type VerificationDocumentTypeItem,
} from "../services/api";
import { formatDate, formatStatusLabel } from "../utils/format";
import { viewDocument, downloadDocument, printDocument } from "../utils/documentActions";
import { DownloadIcon } from "../icons";

export default function UpgradeRequestDetail() {
  const { t, i18n } = useTranslation();
  const apiLang: "en" | "bn" = i18n.resolvedLanguage === "bn" ? "bn" : "en";
  const { id } = useParams<{ id: string }>();
  const requestId = id ? parseInt(id, 10) : NaN;

  const [request, setRequest] = useState<UpgradeRequestListItem | null>(null);
  const [documents, setDocuments] = useState<AdminVerificationDocumentsResponse | null>(null);
  const [documentTypeLabels, setDocumentTypeLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verifyingDocId, setVerifyingDocId] = useState<number | null>(null);
  const [upgradeComment, setUpgradeComment] = useState("");
  const [reviewingUpgrade, setReviewingUpgrade] = useState(false);

  const fetchData = useCallback(async () => {
    if (!requestId || Number.isNaN(requestId)) {
      setError(t("upgradeRequests.invalidRequestId"));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [reqRes, typesRes] = await Promise.all([
        upgradeRequestsApi.getById(requestId),
        verificationDocumentTypesApi.list({ lang: apiLang }),
      ]);
      const typesList = Array.isArray(typesRes?.data) ? typesRes.data : Array.isArray(typesRes) ? typesRes : [];
      const labels: Record<string, string> = {};
      (typesList as VerificationDocumentTypeItem[]).forEach((t) => {
        labels[t.code] = t.label;
      });
      setDocumentTypeLabels(labels);

      const reqData = reqRes?.data ?? reqRes;
      if (!reqData || typeof reqData !== "object") {
        setError(t("upgradeRequests.requestNotFound"));
        setLoading(false);
        return;
      }
      setRequest(reqData as UpgradeRequestListItem);
      const providerUserId = (reqData as UpgradeRequestListItem).providerUserId;
      const targetConsultationTypeId = (reqData as UpgradeRequestListItem).targetConsultationTypeId;
      if (providerUserId != null && targetConsultationTypeId != null) {
        const docRes = await adminUsersApi.getUserVerificationDocuments(
          providerUserId,
          targetConsultationTypeId
        );
        const docData = docRes?.data ?? docRes;
        setDocuments((docData as AdminVerificationDocumentsResponse) ?? null);
      } else {
        setDocuments(null);
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("upgradeRequests.failedLoadDetail");
      setError(message);
      setRequest(null);
      setDocuments(null);
    } finally {
      setLoading(false);
    }
  }, [requestId, t, apiLang]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVerifyDocument = async (docId: number, status: "APPROVED" | "REJECTED") => {
    setVerifyingDocId(docId);
    try {
      await adminDocumentsApi.verify(docId, { status });
      await fetchData();
    } catch {
      setError(t("upgradeRequests.failedUpdateDocument"));
    } finally {
      setVerifyingDocId(null);
    }
  };

  const handleReviewUpgrade = async (status: "APPROVED" | "REJECTED") => {
    if (!requestId || Number.isNaN(requestId)) return;
    setReviewingUpgrade(true);
    setError("");
    try {
      await upgradeRequestsApi.review(requestId, {
        status,
        adminComment: upgradeComment.trim() || undefined,
      });
      setUpgradeComment("");
      await fetchData();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("upgradeRequests.failedSubmitReview");
      setError(message);
    } finally {
      setReviewingUpgrade(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageMeta title={t("upgradeRequests.detailMetaTitle")} description={t("upgradeRequests.detailMetaDescription")} />
        <PageBreadcrumb pageTitle={t("upgradeRequests.detailPageTitle")} />
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">{t("systemConfig.loading")}</div>
      </>
    );
  }

  if (error && !request) {
    return (
      <>
        <PageMeta title={t("upgradeRequests.detailMetaTitle")} description={t("upgradeRequests.detailMetaDescription")} />
        <PageBreadcrumb pageTitle={t("upgradeRequests.detailPageTitle")} />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
        <Link to="/upgrade-requests" className="mt-4 inline-block text-brand-600 hover:underline dark:text-brand-400">
          ← {t("upgradeRequests.backToList")}
        </Link>
      </>
    );
  }

  const req = request!;
  const requirements = documents?.requirements ?? [];
  const requiredReqs = requirements.filter((r) => r.isRequired);
  const requiredDocsOk = requiredReqs.every(
    (r) =>
      r.uploadedDocument &&
      String(r.uploadedDocument.status).toUpperCase() === "APPROVED"
  );
  const missingOrNotApproved = requiredReqs.filter(
    (r) =>
      !r.uploadedDocument ||
      String(r.uploadedDocument.status).toUpperCase() !== "APPROVED"
  );
  const canApproveUpgrade = req.status === "PENDING" && requiredDocsOk;

  return (
    <>
      <PageMeta
        title={t("upgradeRequests.detailMetaTitle")}
        description={t("upgradeRequests.detailMetaDescription")}
      />
      <PageBreadcrumb pageTitle={t("upgradeRequests.detailPageTitleWithId", { id: req.id })} />

      <div className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Request summary */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
            {t("upgradeRequests.requestSummary")}
          </h3>
          <div className="grid gap-2 text-sm">
            <p>
              <span className="text-gray-500 dark:text-gray-400">{t("upgradeRequests.provider")}:</span>{" "}
              <span className="font-medium text-gray-800 dark:text-white/90">
                {req.providerName ?? `Provider #${req.providerId}`}
              </span>
            </p>
            <p>
              <span className="text-gray-500 dark:text-gray-400">{t("upgradeRequests.currentType")}:</span>{" "}
              <span className="text-gray-800 dark:text-white/90">
                {req.currentConsultationTypeName ?? t("common.noValue")}
              </span>
            </p>
            <p>
              <span className="text-gray-500 dark:text-gray-400">{t("upgradeRequests.targetType")}:</span>{" "}
              <span className="text-gray-800 dark:text-white/90">
                {req.targetConsultationTypeName ?? t("common.noValue")}
              </span>
            </p>
            <p>
              <span className="text-gray-500 dark:text-gray-400">{t("upgradeRequests.status")}:</span>{" "}
              <Badge
                size="sm"
                color={
                  req.status === "PENDING"
                    ? "warning"
                    : req.status === "APPROVED"
                      ? "success"
                      : "error"
                }
              >
                {formatStatusLabel(req.status)}
              </Badge>
            </p>
            <p>
              <span className="text-gray-500 dark:text-gray-400">{t("upgradeRequests.requested")}:</span>{" "}
              <span className="text-gray-800 dark:text-white/90">
                {req.createdAt ? formatDate(req.createdAt) : t("common.noValue")}
              </span>
            </p>
            {req.reviewedAt && (
              <p>
                <span className="text-gray-500 dark:text-gray-400">{t("upgradeRequests.reviewedAt")}:</span>{" "}
                <span className="text-gray-800 dark:text-white/90">
                  {formatDate(req.reviewedAt)}
                </span>
              </p>
            )}
            {req.adminComment && (
              <p>
                <span className="text-gray-500 dark:text-gray-400">{t("upgradeRequests.adminComment")}:</span>{" "}
                <span className="text-gray-800 dark:text-white/90">
                  {req.adminComment}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Verification documents for target type */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
            {t("upgradeRequests.verificationDocsForTargetType")}
            {documents?.consultationTypeName ? ` (${documents.consultationTypeName})` : ""}
          </h3>
          {requirements.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("upgradeRequests.noRequirements")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                  <TableRow>
                    <TableCell isHeader className="py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                      {t("upgradeRequests.documentType")}
                    </TableCell>
                    <TableCell isHeader className="py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                      {t("upgradeRequests.required")}
                    </TableCell>
                    <TableCell isHeader className="py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                      {t("upgradeRequests.uploaded")}
                    </TableCell>
                    <TableCell isHeader className="py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                      {t("upgradeRequests.status")}
                    </TableCell>
                    <TableCell isHeader className="py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                      {t("upgradeRequests.document")}
                    </TableCell>
                    <TableCell isHeader className="py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                      {t("upgradeRequests.actions")}
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {requirements.map((r) => {
                    const doc = r.uploadedDocument;
                    const isVerifying = doc?.id === verifyingDocId;
                    const docUrl = doc?.filePath ?? doc?.path ?? "";
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="py-3 font-medium text-gray-800 dark:text-white/90">
                          {documentTypeLabels[r.documentType] ?? r.documentType.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-gray-600 dark:text-gray-400">
                          {r.isRequired ? t("upgradeRequests.yes") : t("upgradeRequests.no")}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-gray-600 dark:text-gray-400">
                          {doc ? t("upgradeRequests.yes") : t("common.noValue")}
                        </TableCell>
                        <TableCell className="py-3">
                          {doc ? (
                            <Badge
                              size="sm"
                              color={
                                doc.status === "APPROVED"
                                  ? "success"
                                  : doc.status === "REJECTED"
                                    ? "error"
                                    : "warning"
                              }
                            >
                              {formatStatusLabel(doc.status)}
                            </Badge>
                          ) : (
                            t("common.noValue")
                          )}
                          {doc?.adminComment && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {doc.adminComment}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          {doc ? (
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                disabled={!docUrl}
                                onClick={() => viewDocument(docUrl)}
                                title={t("upgradeRequests.view")}
                                className="rounded border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                              >
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                  <path d="M10.0002 13.8619C7.23361 13.8619 4.86803 12.1372 3.92328 9.70241C4.86804 7.26761 7.23361 5.54297 10.0002 5.54297C12.7667 5.54297 15.1323 7.26762 16.0771 9.70243C15.1323 12.1372 12.7667 13.8619 10.0002 13.8619ZM10.0002 4.04297C6.48191 4.04297 3.49489 6.30917 2.4155 9.4593C2.3615 9.61687 2.3615 9.78794 2.41549 9.94552C3.49488 13.0957 6.48191 15.3619 10.0002 15.3619C13.5184 15.3619 16.5055 13.0957 17.5849 9.94555C17.6389 9.78797 17.6389 9.6169 17.5849 9.45932C16.5055 6.30919 13.5184 4.04297 10.0002 4.04297ZM9.99151 7.84413C8.96527 7.84413 8.13333 8.67606 8.13333 9.70231C8.13333 10.7286 8.96527 11.5605 9.99151 11.5605H10.0064C11.0326 11.5605 11.8646 10.7286 11.8646 9.70231C11.8646 8.67606 11.0326 7.84413 10.0064 7.84413H9.99151Z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                disabled={!docUrl}
                                onClick={() => downloadDocument(docUrl, `${r.documentType}_${doc.id}.pdf`)}
                                title={t("upgradeRequests.download")}
                                className="rounded border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                              >
                                <DownloadIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled={!docUrl}
                                onClick={() => printDocument(docUrl)}
                                title={t("upgradeRequests.print")}
                                className="rounded border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                              >
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            t("common.noValue")
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          {doc && doc.status === "PENDING" && (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                disabled={isVerifying}
                                onClick={() => handleVerifyDocument(doc.id, "APPROVED")}
                                className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-700 dark:hover:bg-green-800"
                              >
                                {isVerifying ? "…" : t("upgradeRequests.approve")}
                              </button>
                              <button
                                type="button"
                                disabled={isVerifying}
                                onClick={() => handleVerifyDocument(doc.id, "REJECTED")}
                                className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-800"
                              >
                                {t("upgradeRequests.reject")}
                              </button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Approve / Reject upgrade (only when PENDING and docs OK) */}
        {req.status === "PENDING" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
              {t("upgradeRequests.reviewRequest")}
            </h3>
            {!canApproveUpgrade && req.status === "PENDING" && (
              <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">
                {missingOrNotApproved.length > 0
                  ? t("upgradeRequests.missingDocsPrefix", { docs: missingOrNotApproved.map((r) => documentTypeLabels[r.documentType] ?? r.documentType.replace(/_/g, " ")).join(", ") })
                  : t("upgradeRequests.approveDocsFirst")}
              </p>
            )}
            <label className="mb-4 block">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("upgradeRequests.commentOptional")}
              </span>
              <textarea
                value={upgradeComment}
                onChange={(e) => setUpgradeComment(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                placeholder={t("upgradeRequests.rejectionNotePlaceholder")}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canApproveUpgrade || reviewingUpgrade}
                onClick={() => handleReviewUpgrade("APPROVED")}
                className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-700 dark:hover:bg-green-800"
              >
                {reviewingUpgrade ? t("upgradeRequests.submitting") : t("upgradeRequests.approveUpgrade")}
              </button>
              <button
                type="button"
                disabled={reviewingUpgrade}
                onClick={() => handleReviewUpgrade("REJECTED")}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-800"
              >
                {t("upgradeRequests.rejectUpgrade")}
              </button>
            </div>
          </div>
        )}

        <Link
          to="/upgrade-requests"
          className="inline-block text-brand-600 hover:underline dark:text-brand-400"
        >
          ← {t("upgradeRequests.backToUpgradeRequests")}
        </Link>
      </div>
    </>
  );
}
