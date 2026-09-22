import { useCallback, useEffect, useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import {
  verificationDocumentsApi,
  type DocumentsWithRequirementsResponseDto,
  type VerificationRequirementWithUploadDto,
  type DocumentUploadResponse,
} from "../services/api";
import { getAssetUrl } from "../utils/assetUrl";
import { formatDate } from "../utils/format";

function documentPath(doc: DocumentUploadResponse | null | undefined): string {
  if (!doc) return "";
  return (doc.filePath ?? doc.path ?? "").trim();
}

function RequirementRow({
  req,
  onUploadSuccess,
  onDeleteSuccess,
}: {
  req: VerificationRequirementWithUploadDto;
  onUploadSuccess: () => void;
  onDeleteSuccess: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [fileInputEl, setFileInputEl] = useState<HTMLInputElement | null>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadError("");
      setUploading(true);
      try {
        await verificationDocumentsApi.upload(file, {
          verificationRequirementId: req.id,
        });
        onUploadSuccess();
      } catch (err: unknown) {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : "Upload failed";
        setUploadError(message);
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [req.id, onUploadSuccess]
  );

  const handleDelete = useCallback(async () => {
    const doc = req.uploadedDocument;
    if (!doc?.id) return;
    if (!window.confirm("Delete this document?")) return;
    setDeleting(true);
    try {
      await verificationDocumentsApi.deleteDocument(doc.id);
      onDeleteSuccess();
    } finally {
      setDeleting(false);
    }
  }, [req.uploadedDocument, onDeleteSuccess]);

  const doc = req.uploadedDocument;
  const hasUpload = !!doc;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800 dark:text-white/90">
            {req.documentType.replace(/_/g, " ")}
          </span>
          {req.isRequired && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              Required
            </span>
          )}
        </div>
        {hasUpload ? (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>Status: {doc?.status ?? "—"}</span>
            {doc?.createdAt && (
              <span>Uploaded {formatDate(doc.createdAt)}</span>
            )}
            {documentPath(doc) && (
              <a
                href={getAssetUrl(documentPath(doc))}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-500 hover:underline"
              >
                View file
              </a>
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            No document uploaded
          </p>
        )}
        {uploadError && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{uploadError}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          ref={(el) => setFileInputEl(el)}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <button
          type="button"
          onClick={() => fileInputEl?.click()}
          disabled={uploading}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : hasUpload ? "Replace" : "Upload"}
        </button>
        {hasUpload && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function VerificationDocuments() {
  const [data, setData] = useState<DocumentsWithRequirementsResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await verificationDocumentsApi.getMyDocumentsWithRequirements();
      setData(response.data ?? null);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to load verification documents.";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <>
      <PageMeta
        title="Verification Documents | Ontor - BMQAS"
        description="Upload and manage your verification documents (BMDC, NID, degree, etc.)"
      />
      <PageBreadcrumb pageTitle="Verification Documents" />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
          Verification Documents
        </h3>
        <p className="mb-5 text-sm text-gray-600 dark:text-gray-400">
          Upload proof documents required for your consultation type. Use the requirement ID from this list when uploading (the app sends it automatically).
        </p>

        {loading && (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            Loading…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
        {!loading && !error && data && (
          <>
            {data.consultationTypeName && (
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Consultation type: <strong>{data.consultationTypeName}</strong>
                {data.consultationTypeId != null && (
                  <span className="ml-1">(ID: {data.consultationTypeId})</span>
                )}
              </p>
            )}
            {data.requirements.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">
                No verification requirements configured for your type. You can still upload documents using the type field if needed.
              </p>
            ) : (
              <div className="space-y-3">
                {data.requirements.map((req) => (
                  <RequirementRow
                    key={req.id}
                    req={req}
                    onUploadSuccess={fetchData}
                    onDeleteSuccess={fetchData}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
