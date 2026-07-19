import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../ui/modal";
import {
  adminCertificationsApi,
  normalizeCertificationScrapingList,
  previewFromScrapingRecord,
  type CertificationScrapingPreviewDto,
  type ScrapingCertificationRecordDto,
} from "../../services/api";
import { getAssetUrl } from "../../utils/assetUrl";

const BNMC_ORIGIN = "https://bncdb.bnmc.gov.bd";

type Props = {
  isOpen: boolean;
  providerId: number;
  onClose: () => void;
};

function dash(value: string | null | undefined): string {
  const s = (value ?? "").trim();
  return s || "—";
}

function resolveMediaSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const raw = url.trim();
  if (raw.startsWith("data:") || raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return `${BNMC_ORIGIN}${raw}`;
  return getAssetUrl(raw) || raw;
}

function isPositiveStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === "renewed" || s === "active" || s === "valid" || s === "approved";
}

function matchBarColor(percent: number): string {
  if (percent >= 80) return "bg-[#1b7a3d]";
  if (percent >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function MatchProgressBar({
  label,
  percent,
  pendingLabel,
}: {
  label: string;
  percent: number | null;
  pendingLabel: string;
}) {
  const hasValue = percent != null;
  const value = hasValue ? percent : 0;
  return (
    <div className="w-full min-w-[140px] max-w-[220px]">
      <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-gray-700">
        <span>{label}</span>
        <span className="tabular-nums text-gray-600">
          {hasValue ? `${value}%` : pendingLabel}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            hasValue ? matchBarColor(value) : "bg-gray-300"
          }`}
          style={{ width: `${hasValue ? value : 0}%` }}
          role="progressbar"
          aria-valuenow={hasValue ? value : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
    </div>
  );
}

export function CertificationScrapingPreviewModal({ isOpen, providerId, onClose }: Props) {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<ScrapingCertificationRecordDto[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !providerId) return;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    setRecords([]);
    setSelectedId(null);

    void adminCertificationsApi
      .getProviderScraping(providerId)
      .then((res) => {
        if (ac.signal.aborted) return;
        const raw = (res as { data?: unknown }).data ?? res;
        const list = normalizeCertificationScrapingList(raw);
        if (list.length === 0) {
          setError(t("providers.certScrapingEmpty"));
          return;
        }
        setRecords(list);
        setSelectedId(list[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        const msg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : t("providers.certScrapingFailed");
        setError(msg || t("providers.certScrapingFailed"));
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [isOpen, providerId, t]);

  const preview: CertificationScrapingPreviewDto | null = useMemo(() => {
    if (records.length === 0) return null;
    const record =
      (selectedId != null ? records.find((r) => r.id === selectedId) : null) ?? records[0];
    return previewFromScrapingRecord(record);
  }, [records, selectedId]);

  const handlePrint = useCallback(() => {
    const node = printRef.current;
    if (!node) return;
    const win = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${t(
      "providers.certScrapingTitle"
    )}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #111; }
  img { max-width: 100%; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
  th { background: #1b7a3d; color: #fff; padding: 8px 6px; text-align: left; }
  td { border: 1px solid #d1d5db; padding: 8px 6px; vertical-align: top; }
</style></head><body>${node.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
      try {
        win.print();
      } catch {
        /* user can Ctrl+P */
      }
    }, 300);
  }, [t]);

  const photoSrc = resolveMediaSrc(preview?.photoUrl);
  const qrSrc = resolveMediaSrc(preview?.qrCodeUrl);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton
      className="max-h-[min(92vh,900px)] w-full max-w-5xl overflow-hidden p-0 sm:p-0"
    >
      <div className="flex max-h-[min(92vh,900px)] flex-col bg-white">
        <div className="shrink-0 border-b border-gray-200 px-4 py-3 sm:px-6">
          <h3 className="pr-10 text-lg font-semibold text-gray-900">
            {t("providers.certScrapingPreview")}
          </h3>
          {records.length > 1 ? (
            <div className="mt-2">
              <label className="block text-xs font-medium text-gray-500">
                {t("providers.certScrapingSelectRecord")}
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => setSelectedId(Number(e.target.value) || null)}
                  className="mt-1 w-full max-w-md rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-800"
                >
                  {records.map((r) => (
                    <option key={r.id} value={r.id}>
                      {pickOptionLabel(r)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {loading ? (
            <p className="py-10 text-center text-sm text-gray-500">{t("providers.certScrapingLoading")}</p>
          ) : error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : preview ? (
            <div ref={printRef} className="bnmc-preview text-gray-900">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#1b7a3d] bg-[#e8f5ec]">
                  <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
                    <circle cx="32" cy="32" r="30" fill="#1b7a3d" />
                    <circle cx="32" cy="32" r="22" fill="#fff" />
                    <path
                      d="M32 14c-6 8-10 14-10 20a10 10 0 0020 0c0-6-4-12-10-20z"
                      fill="#1b7a3d"
                    />
                    <text
                      x="32"
                      y="58"
                      textAnchor="middle"
                      fontSize="6"
                      fill="#fff"
                      fontFamily="Arial"
                    >
                      BNMC
                    </text>
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold leading-tight text-[#1b7a3d] sm:text-2xl md:text-3xl">
                    {dash(preview.councilName)}
                  </p>
                </div>
              </div>

              <p className="mt-2 text-center text-sm text-gray-700">
                <a
                  href={`https://${preview.councilUrl.replace(/^https?:\/\//, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-700 hover:underline"
                >
                  {preview.councilUrl}
                </a>
              </p>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1 bg-[#cfe8f7] px-3 py-2.5 text-center text-sm font-bold uppercase tracking-wide text-[#1a4a7a] sm:text-base">
                  {t("providers.certScrapingTitle")}
                </div>
                <div className="flex w-full shrink-0 flex-col gap-2.5 sm:w-[220px]">
                  <MatchProgressBar
                    label={t("providers.certScrapingFaceMatch")}
                    percent={preview.faceMatched}
                    pendingLabel={t("providers.certScrapingMatchPending")}
                  />
                  <MatchProgressBar
                    label={t("providers.certScrapingNameMatch")}
                    percent={preview.nameMatched}
                    pendingLabel={t("providers.certScrapingMatchPending")}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-4 border border-gray-300 p-4 sm:flex-row sm:items-start">
                {photoSrc ? (
                  <img
                    src={photoSrc}
                    alt=""
                    className="h-[140px] w-[120px] shrink-0 border-2 border-[#1b7a3d] object-cover"
                  />
                ) : (
                  <div className="flex h-[140px] w-[120px] shrink-0 items-center justify-center border-2 border-[#1b7a3d] bg-gray-100 text-xs text-gray-400">
                    {t("providers.certScrapingNoPhoto")}
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-1 text-sm leading-relaxed">
                  <p className="text-lg font-bold uppercase sm:text-xl">{dash(preview.name)}</p>
                  <p>
                    <span className="text-gray-600">{t("providers.certScrapingFatherName")}: </span>
                    <span className="font-semibold uppercase">{dash(preview.fatherName)}</span>
                  </p>
                  <p>
                    <span className="text-gray-600">{t("providers.certScrapingMotherName")}: </span>
                    <span className="font-semibold uppercase">{dash(preview.motherName)}</span>
                  </p>
                  <p>
                    <span className="text-gray-600">{t("providers.certScrapingAddress")}: </span>
                    <span className="font-medium">{dash(preview.address)}</span>
                  </p>
                  <p>
                    <span className="text-gray-600">{t("providers.certScrapingWorkingPlace")}: </span>
                    <span className="font-medium">{dash(preview.workingPlace)}</span>
                  </p>
                  <p>
                    <span className="text-gray-600">{t("providers.certScrapingPosition")}: </span>
                    <span className="font-medium">{dash(preview.position)}</span>
                  </p>
                </div>

                {qrSrc ? (
                  <img
                    src={qrSrc}
                    alt=""
                    className="mx-auto h-[110px] w-[110px] shrink-0 object-contain sm:mx-0"
                  />
                ) : null}
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#1b7a3d] text-white">
                      <th className="px-2 py-2 font-semibold">{t("providers.certScrapingRegNo")}</th>
                      <th className="px-2 py-2 font-semibold">{t("providers.certScrapingCourse")}</th>
                      <th className="px-2 py-2 font-semibold">
                        {t("providers.certScrapingInstitution")}
                      </th>
                      <th className="px-2 py-2 font-semibold">
                        {t("providers.certScrapingExamDate")}
                      </th>
                      <th className="px-2 py-2 font-semibold">
                        {t("providers.certScrapingRegDate")}
                      </th>
                      <th className="px-2 py-2 font-semibold">
                        {t("providers.certScrapingRenewIssue")}
                      </th>
                      <th className="px-2 py-2 font-semibold">
                        {t("providers.certScrapingRenewUpto")}
                      </th>
                      <th className="px-2 py-2 font-semibold">{t("users.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.registrations.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="border border-gray-200 px-2 py-4 text-center text-gray-500"
                        >
                          {t("providers.certScrapingNoRows")}
                        </td>
                      </tr>
                    ) : (
                      preview.registrations.map((row, idx) => (
                        <tr key={`${row.registrationNo}-${idx}`}>
                          <td className="border border-gray-200 px-2 py-2">
                            {dash(row.registrationNo)}
                          </td>
                          <td className="border border-gray-200 px-2 py-2">{dash(row.courseName)}</td>
                          <td className="border border-gray-200 px-2 py-2">{dash(row.institution)}</td>
                          <td className="border border-gray-200 px-2 py-2">
                            {dash(row.licensingExamPassingDate)}
                          </td>
                          <td className="border border-gray-200 px-2 py-2">
                            {dash(row.dateOfRegistration)}
                          </td>
                          <td className="border border-gray-200 px-2 py-2">
                            {dash(row.dateOfRenewIssue)}
                          </td>
                          <td className="border border-gray-200 px-2 py-2">{dash(row.renewUpto)}</td>
                          <td
                            className={`border border-gray-200 px-2 py-2 font-semibold ${
                              isPositiveStatus(row.status) ? "text-[#1b7a3d]" : "text-gray-800"
                            }`}
                          >
                            {dash(row.status)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        {preview && !loading && !error ? (
          <div className="flex shrink-0 flex-wrap gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={handlePrint}
              className="rounded bg-[#1b7a3d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#166533]"
            >
              {t("providers.certScrapingDownloadPdf")}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" />
              </svg>
              {t("upgradeRequests.print")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("common.actions.close")}
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 justify-end border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("common.actions.close")}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function pickOptionLabel(r: ScrapingCertificationRecordDto): string {
  const meta = r.metadata && typeof r.metadata === "object" ? (r.metadata as Record<string, unknown>) : {};
  const name = String(meta.name ?? r.name ?? "").trim();
  const reg = String(r.registrationNumber ?? meta.regNumber ?? "").trim();
  const program = String(r.programName ?? meta.programName ?? "").trim();
  return [reg, program || name].filter(Boolean).join(" — ") || `#${r.id}`;
}
