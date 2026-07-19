import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../ui/modal";
import {
  adminCertificationsApi,
  unwrapScrapingEnvelope,
  previewFromScrapingRecord,
  type CertificationScrapingPreviewDto,
  type FaceMatchedMetaDto,
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

/** Hope file-service / absolute URLs (provider profile picture). */
function resolveProfileSrc(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const raw = url.trim();
  if (raw.startsWith("data:") || raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }
  return getAssetUrl(raw) || raw;
}

/** BNMC scraped photo (may be absolute or site-relative). */
function resolveScrapedSrc(url: string | null | undefined): string | null {
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
    <div className="w-full">
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

function PhotoThumb({
  src,
  label,
  emptyLabel,
}: {
  src: string | null;
  label: string;
  emptyLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      {src ? (
        <img
          src={src}
          alt=""
          className="h-[88px] w-[72px] border border-gray-300 object-cover"
        />
      ) : (
        <div className="flex h-[88px] w-[72px] items-center justify-center border border-dashed border-gray-300 bg-gray-50 text-[10px] text-gray-400">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

function formatScore01(score: number | null): string {
  if (score == null || !Number.isFinite(score)) return "—";
  return score.toFixed(score >= 0.01 || score === 0 ? 2 : 3);
}

function decisionBadgeClass(decision: string | null, matched: boolean | null): string {
  const d = (decision ?? "").toLowerCase();
  if (matched === true || d === "match") {
    return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";
  }
  if (d === "review" || d === "manual_review") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  }
  if (matched === false || d === "no_match" || d === "mismatch") {
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  }
  return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
}

function FaceMatchMetaDetails({ meta }: { meta: FaceMatchedMetaDto }) {
  const { t } = useTranslation();
  const decisionLabel = meta.decision?.trim()
    ? meta.decision
    : meta.matched === true
      ? "match"
      : meta.matched === false
        ? "no_match"
        : "—";

  return (
    <div className="rounded border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs text-gray-700">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-gray-600">
          {t("providers.certScrapingFaceDecision")}:
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${decisionBadgeClass(
            meta.decision,
            meta.matched
          )}`}
        >
          {decisionLabel}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-2 gap-y-1">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-gray-500">
            {t("providers.certScrapingFaceScore")}
          </dt>
          <dd className="font-semibold tabular-nums">{formatScore01(meta.score)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-gray-500">
            {t("providers.certScrapingFaceMatched")}
          </dt>
          <dd className="font-semibold">
            {meta.matched == null
              ? "—"
              : meta.matched
                ? t("upgradeRequests.yes")
                : t("upgradeRequests.no")}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-gray-500">
            {t("providers.certScrapingFaceThreshold")}
          </dt>
          <dd className="font-semibold tabular-nums">{formatScore01(meta.threshold)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-gray-500">
            {t("providers.certScrapingFaceReviewThreshold")}
          </dt>
          <dd className="font-semibold tabular-nums">
            {formatScore01(meta.reviewThreshold)}
          </dd>
        </div>
      </dl>
      {meta.reason ? (
        <p className="mt-1.5 text-[11px] text-gray-600">
          <span className="font-semibold text-gray-500">
            {t("providers.certScrapingFaceReason")}:{" "}
          </span>
          {meta.reason}
        </p>
      ) : null}
    </div>
  );
}

export function CertificationScrapingPreviewModal({ isOpen, providerId, onClose }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<ScrapingCertificationRecordDto[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [providerFullName, setProviderFullName] = useState("");
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !providerId) return;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    setRecords([]);
    setSelectedId(null);
    setProviderFullName("");
    setProfilePicture(null);

    void adminCertificationsApi
      .getProviderScraping(providerId)
      .then((res) => {
        if (ac.signal.aborted) return;
        const raw = (res as { data?: unknown }).data ?? res;
        const envelope = unwrapScrapingEnvelope(raw);
        if (envelope.items.length === 0) {
          setError(t("providers.certScrapingEmpty"));
          return;
        }
        setProviderFullName(envelope.providerFullName);
        setProfilePicture(envelope.profilePicture);
        setRecords(envelope.items);
        setSelectedId(envelope.items[0]?.id ?? null);
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
    return previewFromScrapingRecord(record, { providerFullName, profilePicture });
  }, [records, selectedId, providerFullName, profilePicture]);

  const profileSrc = resolveProfileSrc(preview?.profilePicture);
  const scrapedPhotoSrc = resolveScrapedSrc(preview?.photoUrl);
  const qrSrc = resolveScrapedSrc(preview?.qrCodeUrl);

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
            <div className="bnmc-preview text-gray-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="min-w-0 flex-1 bg-[#cfe8f7] px-3 py-2.5 text-center text-sm font-bold uppercase tracking-wide text-[#1a4a7a] sm:self-stretch sm:text-base">
                  <span className="inline-flex h-full items-center justify-center">
                    {t("providers.certScrapingTitle")}
                  </span>
                </div>

                <div className="flex w-full shrink-0 flex-col gap-3 sm:w-[280px]">
                  <div className="space-y-2">
                    <MatchProgressBar
                      label={t("providers.certScrapingFaceMatch")}
                      percent={preview.faceMatched}
                      pendingLabel={t("providers.certScrapingMatchPending")}
                    />
                    <div className="flex items-start justify-center gap-3">
                      <PhotoThumb
                        src={profileSrc}
                        label={t("providers.certScrapingProviderPhoto")}
                        emptyLabel={t("providers.certScrapingNoPhoto")}
                      />
                      <PhotoThumb
                        src={scrapedPhotoSrc}
                        label={t("providers.certScrapingScrapedPhoto")}
                        emptyLabel={t("providers.certScrapingNoPhoto")}
                      />
                    </div>
                    {preview.faceMatchedMeta ? (
                      <FaceMatchMetaDetails meta={preview.faceMatchedMeta} />
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <MatchProgressBar
                      label={t("providers.certScrapingNameMatch")}
                      percent={preview.nameMatched}
                      pendingLabel={t("providers.certScrapingMatchPending")}
                    />
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded border border-gray-200 bg-gray-50 px-2 py-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          {t("providers.certScrapingProviderName")}
                        </p>
                        <p className="mt-0.5 font-semibold text-gray-900" dir="auto">
                          {dash(preview.providerFullName)}
                        </p>
                      </div>
                      <div className="rounded border border-gray-200 bg-gray-50 px-2 py-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          {t("providers.certScrapingScrapedName")}
                        </p>
                        <p className="mt-0.5 font-semibold uppercase text-gray-900" dir="auto">
                          {dash(preview.name)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-4 border border-gray-300 p-4 sm:flex-row sm:items-start">
                {scrapedPhotoSrc ? (
                  <img
                    src={scrapedPhotoSrc}
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

        <div className="flex shrink-0 justify-end border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t("common.actions.close")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function pickOptionLabel(r: ScrapingCertificationRecordDto): string {
  const meta =
    r.metadata && typeof r.metadata === "object" ? (r.metadata as Record<string, unknown>) : {};
  const name = String(meta.name ?? r.name ?? "").trim();
  const reg = String(r.registrationNumber ?? meta.regNumber ?? "").trim();
  const program = String(r.programName ?? meta.programName ?? "").trim();
  return [reg, program || name].filter(Boolean).join(" — ") || `#${r.id}`;
}
