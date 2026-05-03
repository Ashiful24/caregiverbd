import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatAccountActiveLabel, formatDate } from "../../utils/format";
import { getAssetUrl } from "../../utils/assetUrl";
import { viewDocument, downloadDocument, printDocument } from "../../utils/documentActions";
import Badge from "../ui/badge/Badge";
import { ServiceRequestsListModal } from "./ServiceRequestsListModal";
import { ConfirmModal } from "../ui/confirm-modal";
import { UserCircleIcon, EyeIcon, DownloadIcon } from "../../icons";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { providersApi, adminCertificationsApi, patientsApi, adminUsersApi, adminDocumentsApi, adminProvidersApi } from "../../services/api";
import type {
  AdminCertificationDto,
  AdminDocumentDto,
  AdminServiceRequestStatus,
  BeneficiaryDetailDto,
  BillingRateHistoryResponseDto,
  PatientFullDetailsDto,
  ProviderWalletFundingHistoryResponseDto,
  ProviderFullDetailsDto,
  ProviderProfileChecklistItemDto,
  SalaryHistoryResponseDto,
  VitalsEntryDto,
  WalletHistoryEntryDto,
} from "../../services/api";

/** Reusable block for detail views (Personal, Contact, etc.). Full width, responsive. */
export function DetailBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 w-full rounded-xl border border-gray-200 bg-gray-50/50 p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-800/30">
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {title}
      </h4>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}

/** Reusable label/value row for detail blocks. Renders "—" when value is null/undefined. */
export function DetailBlockRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap justify-between gap-x-4 gap-y-1">
      <span className="shrink-0 text-gray-500 dark:text-gray-400">{label}</span>
      <span className="min-w-0 text-right break-words text-gray-800 dark:text-gray-200">
        {value ?? "—"}
      </span>
    </div>
  );
}

/** Profile picture or gender-based placeholder avatar for provider/patient detail. */
function ProfilePhotoSection({
  profilePictureUrl,
  gender,
  displayName,
}: {
  profilePictureUrl?: string | null;
  gender?: string | null;
  displayName: string;
}) {
  const sizeClass = "h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover shrink-0";
  const hasImage = profilePictureUrl && profilePictureUrl.trim().length > 0;
  const g = String(gender ?? "").toUpperCase();

  if (hasImage) {
    return (
      <img
        src={getAssetUrl(profilePictureUrl)!}
        alt={displayName || "Profile"}
        className={sizeClass}
      />
    );
  }

  const isMale = g === "MALE" || g === "M";
  const isFemale = g === "FEMALE" || g === "F";
  const bgClass = isMale
    ? "bg-blue-500/90 dark:bg-blue-600"
    : isFemale
      ? "bg-pink-500/90 dark:bg-pink-600"
      : "bg-gray-400 dark:bg-gray-600";
  const initial = isMale ? "M" : isFemale ? "F" : null;

  return (
    <div
      className={`flex items-center justify-center ${sizeClass} ${bgClass} text-white`}
      aria-hidden
    >
      {initial ? (
        <span className="text-3xl sm:text-4xl font-semibold select-none">{initial}</span>
      ) : (
        <UserCircleIcon className="h-12 w-12 sm:h-14 sm:w-14 opacity-90" />
      )}
    </div>
  );
}

function statusBadgeColor(status: string): "success" | "warning" | "error" | "light" {
  switch (String(status).toUpperCase()) {
    case "ACTIVE":
    case "COMPLETED":
    case "ACCEPTED":
      return "success";
    case "PENDING":
    case "IN_PROGRESS":
      return "warning";
    case "REJECTED":
    case "CANCELLED":
      return "error";
    case "ARCHIVED":
    default:
      return "light";
  }
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const SERVICE_REQUEST_STATUSES: AdminServiceRequestStatus[] = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

/** Clickable status card for service requests: opens list modal for that status. Disabled for pending providers. */
function ServiceRequestStatusCard({
  status,
  count,
  onOpen,
  disabled = false,
}: {
  status: AdminServiceRequestStatus;
  count: number;
  onOpen: (status: AdminServiceRequestStatus) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onOpen(status)}
      disabled={disabled}
      className={`rounded-xl border px-3 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/50 ${
        disabled
          ? "cursor-not-allowed border-gray-200 bg-gray-100/80 opacity-60 dark:border-gray-700 dark:bg-gray-800/50"
          : "border-gray-200 hover:border-brand-500 hover:bg-brand-50/50 dark:border-gray-700 dark:hover:border-brand-500 dark:hover:bg-brand-500/10"
      }`}
      title={disabled ? "Available after provider is verified (Active)" : undefined}
    >
      <span className="block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {status}
      </span>
      <p className="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">{count}</p>
      <span className="mt-0.5 block text-xs text-gray-400 dark:text-gray-500">
        {disabled ? "Not available" : "View list →"}
      </span>
    </button>
  );
}

/** Vitals table for a beneficiary (or patient). */
function VitalsTable({ vitals }: { vitals: VitalsEntryDto[] }) {
  if (!vitals?.length) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No vitals recorded.</p>;
  }
  return (
    <div className="max-h-40 overflow-y-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">Recorded</th>
            <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">BP (sys/dia)</th>
            <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">Blood sugar</th>
            <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">Steps</th>
            <th className="py-2 font-medium text-gray-500 dark:text-gray-400">Water</th>
          </tr>
        </thead>
        <tbody>
          {vitals.map((v, i) => (
            <tr key={v.id ?? i} className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-1.5 pr-2 text-gray-700 dark:text-gray-300">{formatDate(v.recordedAt)}</td>
              <td className="py-1.5 pr-2 text-gray-700 dark:text-gray-300">
                {v.bloodPressureSystolic != null && v.bloodPressureDiastolic != null
                  ? `${v.bloodPressureSystolic} / ${v.bloodPressureDiastolic}`
                  : "—"}
              </td>
              <td className="py-1.5 pr-2 text-gray-700 dark:text-gray-300">{v.bloodSugar ?? "—"}</td>
              <td className="py-1.5 pr-2 text-gray-700 dark:text-gray-300">{v.steps ?? "—"}</td>
              <td className="py-1.5 text-gray-700 dark:text-gray-300">{v.waterIntake ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Single beneficiary card: name, relation, vitals, service requests (no wallet). */
function BeneficiaryCard({
  beneficiary,
  onOpenServiceRequests,
}: {
  beneficiary: BeneficiaryDetailDto;
  onOpenServiceRequests: (status: AdminServiceRequestStatus, entityId: number, entityLabel: string) => void;
}) {
  const sr = beneficiary.serviceRequestsByStatus;
  const total =
    (sr.PENDING?.length ?? 0) +
    (sr.ACCEPTED?.length ?? 0) +
    (sr.REJECTED?.length ?? 0) +
    (sr.IN_PROGRESS?.length ?? 0) +
    (sr.COMPLETED?.length ?? 0) +
    (sr.CANCELLED?.length ?? 0);
  const entityLabel = `Beneficiary (${beneficiary.name})`;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3 dark:border-gray-700">
        <h5 className="text-base font-semibold text-gray-900 dark:text-white">{beneficiary.name}</h5>
        {beneficiary.relation && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {beneficiary.relation}
          </span>
        )}
        <span className="text-xs text-gray-500 dark:text-gray-400">Patient ID: {beneficiary.patientId}</span>
      </div>
      <div className="space-y-4">
        <div>
          <h6 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Vitals
          </h6>
          <VitalsTable vitals={beneficiary.vitals ?? []} />
        </div>
        <div>
          <h6 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Service requests
          </h6>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {SERVICE_REQUEST_STATUSES.map((status) => {
              const count =
                status === "PENDING"
                  ? sr.PENDING?.length ?? 0
                  : status === "ACCEPTED"
                    ? sr.ACCEPTED?.length ?? 0
                    : status === "REJECTED"
                      ? sr.REJECTED?.length ?? 0
                      : status === "IN_PROGRESS"
                        ? sr.IN_PROGRESS?.length ?? 0
                        : status === "COMPLETED"
                          ? sr.COMPLETED?.length ?? 0
                          : sr.CANCELLED?.length ?? 0;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => onOpenServiceRequests(status, beneficiary.patientId, entityLabel)}
                  className="rounded-lg border border-gray-200 px-2 py-2 text-left transition-colors hover:border-brand-500 hover:bg-brand-50/50 dark:border-gray-700 dark:hover:border-brand-500 dark:hover:bg-brand-500/10"
                >
                  <span className="block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {status}
                  </span>
                  <p className="mt-0.5 text-sm font-semibold text-gray-800 dark:text-white/90">{count}</p>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Total: {total} requests</p>
        </div>
      </div>
    </div>
  );
}

/** Pending → Rejected/Archived. Active → Deactivated/Archived only (not Rejected). Rejected → Active/Archived. */
type PatientStatusValue = "PENDING" | "ACTIVE" | "REJECTED" | "DEACTIVATED" | "ARCHIVED";
function getAllowedPatientStatuses(currentStatus: string): { value: PatientStatusValue; label: string }[] {
  const s = String(currentStatus).toUpperCase();
  if (s === "PENDING") return [{ value: "REJECTED", label: "Rejected" }, { value: "ARCHIVED", label: "Archived" }];
  if (s === "ACTIVE") return [{ value: "DEACTIVATED", label: "Deactivated" }, { value: "ARCHIVED", label: "Archived" }];
  if (s === "REJECTED") return [{ value: "ACTIVE", label: "Active" }, { value: "ARCHIVED", label: "Archived" }];
  return [];
}

/** Full patient details view: user, patient profile, status update, service requests, beneficiaries. */
export function PatientFullDetailsView({
  data,
  onRefresh,
}: {
  data: PatientFullDetailsDto;
  onRefresh?: () => void | Promise<void>;
}) {
  const { user, patient, serviceRequestsByStatus } = data;
  const [openStatus, setOpenStatus] = useState<AdminServiceRequestStatus | null>(null);
  const [openEntityId, setOpenEntityId] = useState<number>(patient.id);
  const [openEntityLabel, setOpenEntityLabel] = useState<string>("Patient");
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryDetailDto[] | null>(data.beneficiaries ?? null);
  const [beneficiariesLoading, setBeneficiariesLoading] = useState(false);
  const currentPatientStatus = String(patient.status).toUpperCase() as PatientStatusValue;
  const allowedPatientStatuses = getAllowedPatientStatuses(patient.status);
  const [patientStatusChoice, setPatientStatusChoice] = useState<PatientStatusValue>(
    allowedPatientStatuses[0]?.value ?? "REJECTED"
  );
  const [patientStatusComment, setPatientStatusComment] = useState("");
  const [patientStatusUpdating, setPatientStatusUpdating] = useState(false);
  const [userStatusUpdating, setUserStatusUpdating] = useState(false);
  const [userStatusChoice, setUserStatusChoice] = useState<"Active" | "Inactive">(user.isActive ? "Active" : "Inactive");
  const [userStatusComment, setUserStatusComment] = useState("");
  const [showUserStatusConfirm, setShowUserStatusConfirm] = useState(false);
  const [showPatientStatusConfirm, setShowPatientStatusConfirm] = useState(false);
  const canChangePatientStatus = allowedPatientStatuses.length > 0;

  useEffect(() => {
    setUserStatusChoice(user.isActive ? "Active" : "Inactive");
  }, [user.isActive]);

  const handleUserStatusUpdate = async () => {
    const isActive = userStatusChoice === "Active";
    if (user.isActive === isActive) return;
    setUserStatusUpdating(true);
    try {
      await adminUsersApi.updateStatus(String(user.id), {
        isActive,
        comment: userStatusComment.trim() || undefined,
      });
      setUserStatusComment("");
      await onRefresh?.();
    } catch {
      // Error could be shown via toast or inline
    } finally {
      setUserStatusUpdating(false);
    }
  };

  useEffect(() => {
    if (currentPatientStatus === "PENDING") setPatientStatusChoice("REJECTED");
    else if (currentPatientStatus === "ACTIVE") setPatientStatusChoice("DEACTIVATED");
    else if (currentPatientStatus === "REJECTED") setPatientStatusChoice("ACTIVE");
  }, [currentPatientStatus]);

  useEffect(() => {
    if (data.beneficiaries != null) {
      setBeneficiaries(data.beneficiaries);
      return;
    }
    const ac = new AbortController();
    let aborted = false;
    setBeneficiariesLoading(true);
    patientsApi
      .getBeneficiaries(patient.id, { signal: ac.signal })
      .then((res) => {
        if (!aborted) setBeneficiaries(res.data ?? []);
      })
      .catch((err) => {
        if (err?.name === "AbortError") aborted = true;
        else setBeneficiaries([]);
      })
      .finally(() => {
        if (!aborted) setBeneficiariesLoading(false);
      });
    return () => ac.abort();
  }, [patient.id, data.beneficiaries]);

  const totalRequests =
    (serviceRequestsByStatus.PENDING?.length ?? 0) +
    (serviceRequestsByStatus.ACCEPTED?.length ?? 0) +
    (serviceRequestsByStatus.REJECTED?.length ?? 0) +
    (serviceRequestsByStatus.IN_PROGRESS?.length ?? 0) +
    (serviceRequestsByStatus.COMPLETED?.length ?? 0) +
    (serviceRequestsByStatus.CANCELLED?.length ?? 0);

  const handleOpenPatientStatus = (status: AdminServiceRequestStatus) => {
    setOpenEntityId(patient.id);
    setOpenEntityLabel("Patient");
    setOpenStatus(status);
  };

  const handleOpenBeneficiaryStatus = (status: AdminServiceRequestStatus, entityId: number, entityLabel: string) => {
    setOpenEntityId(entityId);
    setOpenEntityLabel(entityLabel);
    setOpenStatus(status);
  };

  const handleCloseModal = () => {
    setOpenStatus(null);
    setOpenEntityId(patient.id);
    setOpenEntityLabel("Patient");
  };

  const handleSetPatientStatus = async () => {
    setPatientStatusUpdating(true);
    try {
      await patientsApi.verifyPatient(patient.id, {
        status: patientStatusChoice,
        comment: patientStatusComment.trim() || undefined,
      });
      setPatientStatusComment("");
      setShowPatientStatusConfirm(false);
      await onRefresh?.();
    } catch {
      // Could set a small error state; for now rely on onRefresh to show updated data or leave as is
    } finally {
      setPatientStatusUpdating(false);
    }
  };

  const displayBeneficiaries = beneficiaries ?? [];
  const patientDisplayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Patient";

  return (
    <div className="w-full min-w-0 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
      <div className="w-full min-w-0 sm:col-span-2 rounded-xl border border-gray-200 bg-gray-50/50 p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-800/30">
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Profile</h4>
        <div className="flex flex-wrap items-center gap-4">
          <ProfilePhotoSection
            profilePictureUrl={user.profilePicture}
            gender={user.gender}
            displayName={patientDisplayName}
          />
          <div className="min-w-0">
            <p className="text-lg font-semibold text-gray-900 dark:text-white/90">{patientDisplayName}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{user.role}</p>
          </div>
        </div>
      </div>

      <DetailBlock title="Personal (User)">
        <DetailBlockRow label="First name" value={user.firstName} />
        <DetailBlockRow label="Last name" value={user.lastName} />
        <DetailBlockRow label="Email" value={user.email} />
        <DetailBlockRow label="Username / Mobile" value={user.username} />
        <DetailBlockRow label="Role" value={user.role} />
        <DetailBlockRow
          label="Account"
          value={
            <Badge size="sm" color={user.isActive ? "success" : "error"}>
              {user.isActive ? "Active" : "Inactive"}
            </Badge>
          }
        />
        <DetailBlockRow label="Created" value={formatDate(user.createdAt)} />
        <div className="mt-3 w-full min-w-0 border-t border-gray-100 pt-3 dark:border-gray-700">
          <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">User account status</label>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <select
              value={userStatusChoice}
              onChange={(e) => setUserStatusChoice(e.target.value as "Active" | "Inactive")}
              className="w-full min-w-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 sm:w-auto sm:min-w-[8rem]"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <input
              type="text"
              value={userStatusComment}
              onChange={(e) => setUserStatusComment(e.target.value)}
              placeholder="Comment (optional)"
              className="w-full min-w-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500 sm:min-w-[12rem] sm:flex-1"
            />
            <button
              type="button"
              disabled={userStatusUpdating || (userStatusChoice === "Active") === user.isActive}
              onClick={() => setShowUserStatusConfirm(true)}
              className="w-full shrink-0 rounded bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-700 dark:hover:bg-brand-800 sm:w-auto"
            >
              {userStatusUpdating ? "Updating…" : "Update"}
            </button>
          </div>
        </div>
      </DetailBlock>

      <ConfirmModal
        isOpen={showUserStatusConfirm}
        onClose={() => setShowUserStatusConfirm(false)}
        title={userStatusChoice === "Active" ? "Activate user" : "Deactivate user"}
        message={
          <>
            Are you sure you want to {userStatusChoice === "Active" ? "activate" : "deactivate"}{" "}
            <span className="font-medium text-gray-800 dark:text-white/90">
              {user.firstName} {user.lastName}
            </span>
            ? They will {userStatusChoice === "Active" ? "be able to" : "not be able to"} sign in.
          </>
        }
        confirmLabel={userStatusChoice === "Active" ? "Activate" : "Deactivate"}
        cancelLabel="Cancel"
        confirmVariant={userStatusChoice === "Active" ? "primary" : "danger"}
        onConfirm={handleUserStatusUpdate}
      />

      <DetailBlock title="Patient profile">
        <DetailBlockRow label="Patient ID" value={patient.id} />
        <DetailBlockRow label="NID number" value={patient.nidNumber} />
        <DetailBlockRow
          label="Face verified"
          value={patient.isFaceVerified ? "Yes" : "No"}
        />
        <DetailBlockRow
          label="Status"
          value={
            <Badge size="sm" color={statusBadgeColor(patient.status)}>
              {patient.status}
            </Badge>
          }
        />
        <DetailBlockRow label="Created" value={formatDate(patient.createdAt)} />
        <div className="mt-3 w-full min-w-0 border-t border-gray-100 pt-3 dark:border-gray-700">
          <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Patient profile status</label>
          {canChangePatientStatus ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <select
                value={patientStatusChoice}
                onChange={(e) => setPatientStatusChoice(e.target.value as PatientStatusValue)}
                className="w-full min-w-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 sm:w-auto sm:min-w-[10rem]"
              >
                {allowedPatientStatuses.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={patientStatusComment}
                onChange={(e) => setPatientStatusComment(e.target.value)}
                placeholder="Comment (optional)"
                className="w-full min-w-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500 sm:min-w-[12rem] sm:flex-1"
              />
              <button
                type="button"
                disabled={patientStatusUpdating}
                onClick={() => setShowPatientStatusConfirm(true)}
                className="w-full shrink-0 rounded bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-700 dark:hover:bg-brand-800 sm:w-auto"
              >
                {patientStatusUpdating ? "Updating…" : "Update"}
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">Status cannot be changed from Deactivated or Archived.</p>
          )}
        </div>
      </DetailBlock>

      <ConfirmModal
        isOpen={showPatientStatusConfirm}
        onClose={() => setShowPatientStatusConfirm(false)}
        title="Change patient status"
        message={
          <>
            Are you sure you want to change this patient&apos;s status to{" "}
            <span className="font-medium text-gray-800 dark:text-white/90">
              {allowedPatientStatuses.find((o) => o.value === patientStatusChoice)?.label ?? patientStatusChoice}
            </span>
            ?{" "}
            <span className="block mt-1 text-gray-500 dark:text-gray-400">
              Patient: {user.firstName} {user.lastName}
            </span>
          </>
        }
        confirmLabel="Update status"
        cancelLabel="Cancel"
        confirmVariant="primary"
        onConfirm={handleSetPatientStatus}
      />

      <div className="w-full min-w-0 sm:col-span-2">
        <DetailBlock title="Service requests (account holder)">
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            Click a status to view all service requests of that type for this patient.
          </p>
          <div className="grid w-full min-w-0 grid-cols-2 gap-3 text-sm sm:grid-cols-3 md:grid-cols-6">
            {SERVICE_REQUEST_STATUSES.map((status) => (
              <ServiceRequestStatusCard
                key={status}
                status={status}
                count={
                  status === "PENDING"
                    ? serviceRequestsByStatus.PENDING?.length ?? 0
                    : status === "ACCEPTED"
                      ? serviceRequestsByStatus.ACCEPTED?.length ?? 0
                      : status === "REJECTED"
                        ? serviceRequestsByStatus.REJECTED?.length ?? 0
                        : status === "IN_PROGRESS"
                          ? serviceRequestsByStatus.IN_PROGRESS?.length ?? 0
                          : status === "COMPLETED"
                            ? serviceRequestsByStatus.COMPLETED?.length ?? 0
                            : serviceRequestsByStatus.CANCELLED?.length ?? 0
                }
                onOpen={handleOpenPatientStatus}
              />
            ))}
          </div>
          <p className="mt-3 text-gray-500 dark:text-gray-400">Total: {totalRequests} requests</p>
        </DetailBlock>
      </div>

      <ServiceRequestsListModal
        isOpen={openStatus != null}
        onClose={handleCloseModal}
        entityLabel={openEntityLabel}
        entityId={openEntityId}
        status={openStatus}
        variant="patient"
      />

      <div className="w-full min-w-0 sm:col-span-2">
        <DetailBlock title="Beneficiaries">
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            Beneficiaries linked to this patient. Each has vitals and service requests.
          </p>
          {beneficiariesLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading beneficiaries…</p>
          ) : displayBeneficiaries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 py-6 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800/30 dark:text-gray-400">
              No beneficiary profiles linked.
            </p>
          ) : (
            <div className="space-y-4">
              {displayBeneficiaries.map((ben) => (
                <BeneficiaryCard
                  key={ben.id}
                  beneficiary={ben}
                  onOpenServiceRequests={handleOpenBeneficiaryStatus}
                />
              ))}
            </div>
          )}
        </DetailBlock>
      </div>
    </div>
  );
}

/** Full provider details view: user, provider profile, certifications/documents, service requests, wallet, wallet history. */
export function ProviderFullDetailsView({
  data,
  onRefresh,
}: {
  data: ProviderFullDetailsDto;
  onRefresh?: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const {
    user,
    provider,
    profileCheacklists: profileChecklistRaw,
    consultationTypeServices = [],
    serviceRequestsByStatus,
    wallet,
    totalBalance,
    claimableBalance,
    nonClaimableBalance,
    cashCommissionDue,
    pendingWithdrawal,
    walletHistory,
  } = data;
  const profileChecklistItems = useMemo<ProviderProfileChecklistItemDto[]>(() => {
    const list = profileChecklistRaw ?? [];
    return [...list].sort((a, b) => a.displayOrder - b.displayOrder);
  }, [profileChecklistRaw]);
  const [openStatus, setOpenStatus] = useState<AdminServiceRequestStatus | null>(null);
  const [servicesEditMode, setServicesEditMode] = useState(false);
  const [servicesOffered, setServicesOffered] = useState<Record<number, boolean>>({});
  const [servicesSaving, setServicesSaving] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [certifications, setCertifications] = useState<AdminCertificationDto[]>([]);
  const [certsLoading, setCertsLoading] = useState(false);
  const [certsError, setCertsError] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [expandedCertId, setExpandedCertId] = useState<number | null>(null);
  const [userDocuments, setUserDocuments] = useState<AdminDocumentDto[]>([]);
  const [userDocsLoading, setUserDocsLoading] = useState(false);
  const [userDocsError, setUserDocsError] = useState<string | null>(null);
  const [verifyingDocId, setVerifyingDocId] = useState<number | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistoryResponseDto | null>(null);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salarySaving, setSalarySaving] = useState(false);
  const [salaryAmount, setSalaryAmount] = useState("");
  const [salaryFrequency, setSalaryFrequency] = useState<"MONTHLY" | "WEEKLY">("MONTHLY");
  const [billingRateHistory, setBillingRateHistory] = useState<BillingRateHistoryResponseDto | null>(null);
  const [billingRateLoading, setBillingRateLoading] = useState(false);
  const [billingRateSaving, setBillingRateSaving] = useState(false);
  const [billingRateAmount, setBillingRateAmount] = useState("");
  const [billingRateType, setBillingRateType] = useState<"CONSULTATION" | "HOURLY">("CONSULTATION");
  const [manualCreditAmount, setManualCreditAmount] = useState("");
  const [manualCreditReason, setManualCreditReason] = useState("");
  const [manualCreditReference, setManualCreditReference] = useState("");
  const [manualCreditLoading, setManualCreditLoading] = useState(false);
  const [fundingHistory, setFundingHistory] = useState<ProviderWalletFundingHistoryResponseDto | null>(null);
  const [fundingHistoryLoading, setFundingHistoryLoading] = useState(false);
  const [fundingHistoryError, setFundingHistoryError] = useState<string | null>(null);
  const [fundingHistoryPage, setFundingHistoryPage] = useState(1);
  const [statusUpdating, setStatusUpdating] = useState(false);
  type ProviderStatusValue = "PENDING" | "ACTIVE" | "REJECTED" | "DEACTIVATED" | "ARCHIVED";
  const currentStatus = String(provider.status).toUpperCase() as ProviderStatusValue;
  /** Pending → Active/Rejected/Archived. Active → Deactivated/Archived. Rejected → Active/Archived. Deactivated → Active/Archived. Archived → none. */
  const allowedNextStatuses: { value: ProviderStatusValue; label: string }[] =
    currentStatus === "PENDING"
      ? [
          { value: "ACTIVE", label: "ACTIVE" },
          { value: "REJECTED", label: "REJECTED" },
          { value: "ARCHIVED", label: "ARCHIVED" },
        ]
      : currentStatus === "ACTIVE"
        ? [
            { value: "DEACTIVATED", label: "DEACTIVATED" },
            { value: "ARCHIVED", label: "ARCHIVED" },
          ]
        : currentStatus === "REJECTED"
          ? [
              { value: "ACTIVE", label: "ACTIVE" },
              { value: "ARCHIVED", label: "ARCHIVED" },
            ]
          : currentStatus === "DEACTIVATED"
            ? [
                { value: "ACTIVE", label: "ACTIVE" },
                { value: "ARCHIVED", label: "ARCHIVED" },
              ]
            : [];
  const [profileStatusChoice, setProfileStatusChoice] = useState<ProviderStatusValue>(
    allowedNextStatuses[0]?.value ?? "DEACTIVATED"
  );
  const [profileStatusComment, setProfileStatusComment] = useState("");
  const [userStatusChoice, setUserStatusChoice] = useState<"Active" | "Inactive">(
    user.isActive ? "Active" : "Inactive"
  );
  const [userStatusComment, setUserStatusComment] = useState("");
  const [userStatusUpdating, setUserStatusUpdating] = useState(false);
  const [showProviderStatusConfirm, setShowProviderStatusConfirm] = useState(false);
  const [showUserStatusConfirm, setShowUserStatusConfirm] = useState(false);
  const [checklistUpdating, setChecklistUpdating] = useState(false);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [availabilityDate, setAvailabilityDate] = useState<Date | undefined>(new Date());
  const [availabilityTime, setAvailabilityTime] = useState("09:00");
  const [availabilityShiftDuration, setAvailabilityShiftDuration] = useState("8");
  const [availabilityDatePickerOpen, setAvailabilityDatePickerOpen] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilitySlots, setAvailabilitySlots] = useState<string[]>([]);
  const isProviderPending = currentStatus === "PENDING";
  const canChangeStatus = allowedNextStatuses.length > 0;

  const handleUserStatusUpdate = async () => {
    const isActive = userStatusChoice === "Active";
    if (user.isActive === isActive) return;
    setUserStatusUpdating(true);
    try {
      await adminUsersApi.updateStatus(String(user.id), {
        isActive,
        comment: userStatusComment.trim() || undefined,
      });
      setUserStatusComment("");
      await onRefresh?.();
    } catch {
      setCertsError("Failed to update user status.");
    } finally {
      setUserStatusUpdating(false);
    }
  };

  useEffect(() => {
    setUserStatusChoice(user.isActive ? "Active" : "Inactive");
  }, [user.isActive]);

  useEffect(() => {
    if (currentStatus === "PENDING") setProfileStatusChoice("ACTIVE");
    else if (currentStatus === "ACTIVE") setProfileStatusChoice("DEACTIVATED");
    else if (currentStatus === "REJECTED") setProfileStatusChoice("ACTIVE");
    else if (currentStatus === "DEACTIVATED") setProfileStatusChoice("ACTIVE");
  }, [currentStatus]);

  useEffect(() => {
    const next: Record<number, boolean> = {};
    consultationTypeServices.forEach((s) => {
      next[s.id] = s.offered;
    });
    setServicesOffered(next);
  }, [consultationTypeServices]);

  const handleSaveConsultationServices = async () => {
    if (!provider.id) return;
    setServicesSaving(true);
    setServicesError(null);
    try {
      const excludedServiceIds = consultationTypeServices
        .filter((s) => !servicesOffered[s.id])
        .map((s) => s.id);
      await providersApi.updateConsultationServices(provider.id, { excludedServiceIds });
      setServicesEditMode(false);
      await onRefresh?.();
    } catch {
      setServicesError("Failed to update services.");
    } finally {
      setServicesSaving(false);
    }
  };

  const handleProfileChecklistToggle = async (item: ProviderProfileChecklistItemDto) => {
    if (!provider.id || checklistUpdating) return;
    const nextChecked = !item.checked;
    const newIds = profileChecklistItems
      .filter((i) => (i.id === item.id ? nextChecked : i.checked))
      .map((i) => i.id);
    setChecklistUpdating(true);
    setChecklistError(null);
    try {
      await providersApi.updateProfileChecklist(provider.id, { checklistItemIds: newIds });
      await onRefresh?.();
    } catch {
      setChecklistError("Failed to update profile checklist.");
    } finally {
      setChecklistUpdating(false);
    }
  };

  useEffect(() => {
    if (!provider.id) return;
    const ac = new AbortController();
    let aborted = false;
    setCertsLoading(true);
    setCertsError(null);
    providersApi
      .getCertifications(provider.id, { signal: ac.signal })
      .then((res) => {
        if (!aborted) setCertifications(res.data ?? []);
      })
      .catch((err) => {
        if (err?.name === "AbortError") aborted = true;
        else setCertsError("Failed to load certifications.");
      })
      .finally(() => {
        if (!aborted) setCertsLoading(false);
      });
    return () => ac.abort();
  }, [provider.id]);

  useEffect(() => {
    if (!provider.id) return;
    const ac = new AbortController();
    let aborted = false;
    setFundingHistoryLoading(true);
    setFundingHistoryError(null);
    adminProvidersApi
      .getWalletFundingHistory(provider.id, { page: fundingHistoryPage, limit: 10 })
      .then((res) => {
        if (aborted) return;
        const d = res?.data ?? res;
        setFundingHistory(d as ProviderWalletFundingHistoryResponseDto);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setFundingHistoryError("Failed to load wallet funding history.");
        }
      })
      .finally(() => {
        if (!aborted) setFundingHistoryLoading(false);
      });
    return () => {
      aborted = true;
      ac.abort();
    };
  }, [provider.id, fundingHistoryPage]);

  useEffect(() => {
    if (!user.id) return;
    const ac = new AbortController();
    let aborted = false;
    setUserDocsLoading(true);
    setUserDocsError(null);
    adminUsersApi
      .getDocuments(user.id, { signal: ac.signal })
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : (res as unknown as { data?: AdminDocumentDto[] })?.data ?? [];
        if (!aborted) setUserDocuments(list);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") setUserDocsError("Failed to load documents.");
      })
      .finally(() => {
        if (!aborted) setUserDocsLoading(false);
      });
    return () => {
      aborted = true;
      ac.abort();
    };
  }, [user.id]);

  useEffect(() => {
    if (!provider.id) return;
    const ac = new AbortController();
    let aborted = false;
    setSalaryLoading(true);
    adminProvidersApi
      .getProviderSalaryHistory(provider.id, { signal: ac.signal })
      .then((res) => {
        const d = res?.data ?? res;
        if (!aborted && d) setSalaryHistory(d as SalaryHistoryResponseDto);
      })
      .finally(() => {
        if (!aborted) setSalaryLoading(false);
      });
    return () => {
      aborted = true;
      ac.abort();
    };
  }, [provider.id]);

  useEffect(() => {
    if (!provider.id) return;
    const ac = new AbortController();
    let aborted = false;
    setBillingRateLoading(true);
    adminProvidersApi
      .getProviderBillingRateHistory(provider.id, { signal: ac.signal })
      .then((res) => {
        const d = res?.data ?? res;
        if (!aborted && d) setBillingRateHistory(d as BillingRateHistoryResponseDto);
      })
      .finally(() => {
        if (!aborted) setBillingRateLoading(false);
      });
    return () => {
      aborted = true;
      ac.abort();
    };
  }, [provider.id]);

  const handleVerifyDocument = async (docId: number, status: "APPROVED" | "REJECTED") => {
    setVerifyingDocId(docId);
    try {
      await adminDocumentsApi.verify(docId, { status });
      const res = await adminUsersApi.getDocuments(user.id);
      const list = Array.isArray(res?.data) ? res.data : (res as unknown as { data?: AdminDocumentDto[] })?.data ?? [];
      setUserDocuments(list);
    } catch {
      setUserDocsError("Failed to update document.");
    } finally {
      setVerifyingDocId(null);
    }
  };

  const handleSetSalary = async () => {
    const amount = Number(salaryAmount);
    if (!provider.id || Number.isNaN(amount) || amount < 0) return;
    setSalarySaving(true);
    try {
      await adminProvidersApi.setProviderSalary(provider.id, { amount, frequency: salaryFrequency });
      setSalaryAmount("");
      const res = await adminProvidersApi.getProviderSalaryHistory(provider.id);
      const d = res?.data ?? res;
      if (d) setSalaryHistory(d as SalaryHistoryResponseDto);
    } catch {
      setCertsError("Failed to set salary.");
    } finally {
      setSalarySaving(false);
    }
  };

  const handleSetBillingRate = async () => {
    const amount = Number(billingRateAmount);
    if (!provider.id || Number.isNaN(amount) || amount < 0) return;
    setBillingRateSaving(true);
    try {
      await adminProvidersApi.setProviderBillingRate(provider.id, { amount, type: billingRateType });
      setBillingRateAmount("");
      const res = await adminProvidersApi.getProviderBillingRateHistory(provider.id);
      const d = res?.data ?? res;
      if (d) setBillingRateHistory(d as BillingRateHistoryResponseDto);
    } catch {
      setCertsError("Failed to set billing rate.");
    } finally {
      setBillingRateSaving(false);
    }
  };

  const handleManualCredit = async () => {
    if (!provider.id || !manualCreditAmount.trim()) return;
    const amount = Number(manualCreditAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFundingHistoryError("Enter a valid positive amount.");
      return;
    }

    setManualCreditLoading(true);
    setFundingHistoryError(null);
    try {
      await adminProvidersApi.manualWalletCredit(provider.id, {
        amount,
        reason: manualCreditReason.trim() || "Manual credit by admin",
        reference: manualCreditReference.trim() || undefined,
      });
      setManualCreditAmount("");
      setManualCreditReason("");
      setManualCreditReference("");
      setFundingHistoryPage(1);
      const res = await adminProvidersApi.getWalletFundingHistory(provider.id, { page: 1, limit: 10 });
      const d = res?.data ?? res;
      setFundingHistory(d as ProviderWalletFundingHistoryResponseDto);
      await onRefresh?.();
    } catch {
      setFundingHistoryError("Failed to apply manual credit.");
    } finally {
      setManualCreditLoading(false);
    }
  };

  const handleVerifyCertification = async (certId: number, status: "APPROVED" | "REJECTED") => {
    setVerifyingId(certId);
    try {
      await adminCertificationsApi.verify(certId, { status });
      const res = await providersApi.getCertifications(provider.id);
      setCertifications(res.data ?? []);
    } catch {
      setCertsError("Failed to update certification.");
    } finally {
      setVerifyingId(null);
    }
  };

  const handleCheckAvailability = async () => {
    if (!provider.id || !availabilityDate) return;
    const parsedShiftDuration = Number(availabilityShiftDuration);
    if (!Number.isFinite(parsedShiftDuration) || parsedShiftDuration <= 0) {
      setAvailabilityError("Shift duration must be a positive number.");
      setAvailabilitySlots([]);
      return;
    }
    setAvailabilityLoading(true);
    setAvailabilityError(null);
    setAvailabilitySlots([]);
    try {
      const res = await providersApi.getAvailability(provider.id, toYmd(availabilityDate), {
        time: availabilityTime || undefined,
        shiftDuration: parsedShiftDuration,
      });
      const data = res.data as unknown;
      const slotsRaw =
        Array.isArray(data)
          ? data
          : data && typeof data === "object"
            ? ((data as Record<string, unknown>).slots ??
              (data as Record<string, unknown>).availableSlots ??
              (data as Record<string, unknown>).data)
            : null;
      const parsedSlots = Array.isArray(slotsRaw)
        ? slotsRaw
            .map((x) => {
              if (x && typeof x === "object") {
                const o = x as Record<string, unknown>;
                const from = String(o.from ?? "").trim();
                const to = String(o.to ?? "").trim();
                if (from && to) return `${from} - ${to}`;
                return from || to;
              }
              return String(x ?? "").trim();
            })
            .filter(Boolean)
        : [];
      setAvailabilitySlots(parsedSlots);
      if (parsedSlots.length === 0) {
        setAvailabilityError("No available slots found for this selection.");
      }
    } catch {
      setAvailabilityError("Failed to load provider availability.");
      setAvailabilitySlots([]);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleSetProviderStatus = async () => {
    setStatusUpdating(true);
    try {
      await providersApi.verifyProvider(provider.id, {
        status: profileStatusChoice as "PENDING" | "ACTIVE" | "REJECTED" | "DEACTIVATED" | "ARCHIVED",
        comment: profileStatusComment.trim() || undefined,
      });
      setProfileStatusComment("");
      await onRefresh?.();
    } catch {
      setCertsError("Failed to update provider status.");
    } finally {
      setStatusUpdating(false);
    }
  };

  const totalRequests =
    (serviceRequestsByStatus.PENDING?.length ?? 0) +
    (serviceRequestsByStatus.ACCEPTED?.length ?? 0) +
    (serviceRequestsByStatus.REJECTED?.length ?? 0) +
    (serviceRequestsByStatus.IN_PROGRESS?.length ?? 0) +
    (serviceRequestsByStatus.COMPLETED?.length ?? 0) +
    (serviceRequestsByStatus.CANCELLED?.length ?? 0);

  const providerDisplayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || t("providers.providerName");
  /* Hardcoded reference check preview — disabled until API exists.
  const referenceChecks = [
    {
      id: 1,
      refName: "Tanvir Ahmed",
      relation: "Previous supervisor",
      contact: "+88017XXXXXXX",
      status: "VERIFIED" as const,
      note: "Confirmed punctuality and good bedside manner.",
    },
    {
      id: 2,
      refName: "Sabina Yasmin",
      relation: "Clinical lead",
      contact: "sabina.y@example.com",
      status: "PENDING" as const,
      note: "Pending outbound verification call.",
    },
  ];
  */
  const checklistTotal = profileChecklistItems.length;
  const completedSteps = profileChecklistItems.filter((i) => i.checked).length;
  const completionPercent =
    checklistTotal === 0 ? 0 : Math.round((completedSteps / checklistTotal) * 100);
  const consultationTypeLabel = provider.consultationTypeName?.trim() || null;
  const experienceLabel =
    provider.experience != null && String(provider.experience).trim() !== ""
      ? String(provider.experience).trim()
      : null;

  return (
    <div className="w-full min-w-0 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
      <div className="w-full min-w-0 sm:col-span-2 rounded-2xl border border-gray-200 bg-white p-0 dark:border-gray-800 dark:bg-gray-900/30">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div className="flex items-start gap-3">
            <ProfilePhotoSection
              profilePictureUrl={user.profilePicture}
              gender={user.gender}
              displayName={providerDisplayName}
            />
            <div className="min-w-0">
              <p className="text-xl font-semibold text-gray-900 dark:text-white/90">{providerDisplayName}</p>
              {consultationTypeLabel && (
                <p className="mt-1">
                  <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    {consultationTypeLabel}
                  </span>
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("providers.created")}: {formatDate(user.createdAt)}
                {experienceLabel != null && (
                  <>
                    {" "}
                    • {experienceLabel}
                    {/^\d+$/.test(experienceLabel) ? ` ${t("providers.experienceYears")}` : ""}
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="w-full sm:max-w-[240px]">
            <div className="flex items-center justify-between text-xs font-medium text-gray-600 dark:text-gray-300">
              <span>{t("providers.profileCompletion")}</span>
              <span>{checklistTotal === 0 ? t("common.noValue") : `${completionPercent}%`}</span>
            </div>
            <div className="mt-2 h-2.5 rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-2.5 rounded-full bg-amber-500 transition-[width]"
                style={{ width: checklistTotal === 0 ? "0%" : `${completionPercent}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400">
              {checklistTotal === 0
                ? t("providers.noChecklistItems")
                : t("providers.stepsChecked", { completed: completedSteps, total: checklistTotal })}
            </p>
          </div>
        </div>
        {checklistError && (
          <p className="px-4 pb-2 text-sm text-red-600 dark:text-red-400 sm:px-5">{checklistError}</p>
        )}
        <div className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-3 sm:px-5">
          {profileChecklistItems.length === 0 ? (
            <p className="col-span-full text-sm text-gray-500 dark:text-gray-400">
              {t("providers.noChecklistItemsApi")}
            </p>
          ) : (
            profileChecklistItems.map((item) => (
              <label
                key={item.id}
                className={`flex items-start gap-2 rounded-lg px-1.5 py-1 text-sm text-gray-700 dark:text-gray-300 ${
                  checklistUpdating ? "opacity-60" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={checklistUpdating}
                  onChange={() => void handleProfileChecklistToggle(item)}
                  className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
                />
                <span>
                  {item.displayOrder}. {item.label}
                </span>
              </label>
            ))
          )}
        </div>
      </div>

      <DetailBlock title={t("providers.personalUser")}>
        <DetailBlockRow label={t("users.firstName")} value={user.firstName} />
        <DetailBlockRow label={t("users.lastName")} value={user.lastName} />
        <DetailBlockRow label={t("users.email")} value={user.email} />
        <DetailBlockRow label={t("users.usernameOrMobile")} value={user.username} />
        <DetailBlockRow label={t("users.role")} value={user.role} />
        <DetailBlockRow
          label={t("providers.account")}
          value={
            <Badge size="sm" color={user.isActive ? "success" : "error"}>
              {formatAccountActiveLabel(!!user.isActive)}
            </Badge>
          }
        />
        <DetailBlockRow label={t("users.created")} value={formatDate(user.createdAt)} />
        <div className="mt-3 w-full min-w-0 border-t border-gray-100 pt-3 dark:border-gray-700">
          <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">{t("providers.userAccountStatus")}</label>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <select
              value={userStatusChoice}
              onChange={(e) => setUserStatusChoice(e.target.value as "Active" | "Inactive")}
              className="w-full min-w-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 sm:w-auto sm:min-w-[8rem]"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <input
              type="text"
              value={userStatusComment}
              onChange={(e) => setUserStatusComment(e.target.value)}
              placeholder={t("providers.commentOptional")}
              className="w-full min-w-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500 sm:min-w-[12rem] sm:flex-1"
            />
            <button
              type="button"
              disabled={userStatusUpdating || (userStatusChoice === "Active") === user.isActive}
              onClick={() => setShowUserStatusConfirm(true)}
              className="w-full shrink-0 rounded bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-700 dark:hover:bg-brand-800 sm:w-auto"
            >
              {userStatusUpdating ? t("providers.updating") : t("common.actions.update")}
            </button>
          </div>
        </div>
      </DetailBlock>

      <ConfirmModal
        isOpen={showUserStatusConfirm}
        onClose={() => setShowUserStatusConfirm(false)}
        title={userStatusChoice === "Active" ? t("users.activateTitle") : t("users.deactivateTitle")}
        message={
          <>
            {userStatusChoice === "Active" ? t("users.activateConfirmPrefix") : t("users.deactivateConfirmPrefix")}{" "}
            <span className="font-medium text-gray-800 dark:text-white/90">
              {user.firstName} {user.lastName}
            </span>
            ? {userStatusChoice === "Active" ? t("users.activateConfirmSuffix") : t("users.deactivateConfirmSuffix")}
          </>
        }
        confirmLabel={userStatusChoice === "Active" ? t("users.activate") : t("users.deactivate")}
        cancelLabel={t("common.actions.cancel")}
        confirmVariant={userStatusChoice === "Active" ? "primary" : "danger"}
        onConfirm={handleUserStatusUpdate}
        onError={() => setCertsError("Failed to update user status.")}
      />

      <DetailBlock title={t("providers.providerProfile")}>
        <DetailBlockRow label={t("providers.providerId")} value={provider.id} />
        <DetailBlockRow label={t("providers.experience")} value={provider.experience} />
        <DetailBlockRow
          label={t("users.status")}
          value={
            <Badge size="sm" color={statusBadgeColor(provider.status)}>
              {provider.status}
            </Badge>
          }
        />
        <DetailBlockRow label={t("providers.consultationType")} value={provider.consultationTypeName} />
        <DetailBlockRow label={t("providers.location")} value={provider.latitude && provider.longitude ? `${provider.latitude}, ${provider.longitude}` : undefined} />
        <DetailBlockRow label={t("providers.serviceRadiusKm")} value={provider.serviceRadiusKm} />
        <DetailBlockRow label={t("providers.created")} value={formatDate(provider.createdAt)} />
        <div className="mt-3 w-full min-w-0 border-t border-gray-100 pt-3 dark:border-gray-700">
          <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">{t("providers.providerProfileStatus")}</label>
          {canChangeStatus ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <select
                value={profileStatusChoice}
                onChange={(e) => setProfileStatusChoice(e.target.value as ProviderStatusValue)}
                className="w-full min-w-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 sm:w-auto sm:min-w-[10rem]"
              >
                {allowedNextStatuses.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={profileStatusComment}
                onChange={(e) => setProfileStatusComment(e.target.value)}
                placeholder={t("providers.commentOptional")}
                className="w-full min-w-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500 sm:min-w-[12rem] sm:flex-1"
              />
              <button
                type="button"
                disabled={statusUpdating}
                onClick={() => setShowProviderStatusConfirm(true)}
                className="w-full shrink-0 rounded bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-700 dark:hover:bg-brand-800 sm:w-auto"
              >
                {statusUpdating ? t("providers.updating") : t("common.actions.update")}
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("providers.statusChangeArchived")}</p>
          )}
        </div>
      </DetailBlock>

      <ConfirmModal
        isOpen={showProviderStatusConfirm}
        onClose={() => setShowProviderStatusConfirm(false)}
        title={t("providers.changeProviderStatus")}
        message={
          <>
            {t("providers.changeProviderStatusConfirm")}{" "}
            <span className="font-medium text-gray-800 dark:text-white/90">
              {allowedNextStatuses.find((o) => o.value === profileStatusChoice)?.label ?? profileStatusChoice}
            </span>
            ?{" "}
            {provider.consultationTypeName && (
              <span className="block mt-1 text-gray-500 dark:text-gray-400">
                {t("providers.providerLabel")}: {user.firstName} {user.lastName} ({provider.consultationTypeName})
              </span>
            )}
          </>
        }
        confirmLabel={t("providers.updateStatus")}
        cancelLabel={t("common.actions.cancel")}
        confirmVariant="primary"
        onConfirm={handleSetProviderStatus}
        onError={() => setCertsError("Failed to update provider status.")}
      />

      <div className="w-full min-w-0 sm:col-span-2">
        <DetailBlock title={t("providers.providerAvailability")}>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {t("providers.providerAvailabilityHelp")}
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("providers.date")}
                <Popover
                  open={availabilityDatePickerOpen}
                  onOpenChange={setAvailabilityDatePickerOpen}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                      {availabilityDate ? toYmd(availabilityDate) : t("providers.selectDate")}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="z-[100120] w-auto p-2" align="start">
                    <Calendar
                      mode="single"
                      selected={availabilityDate}
                      onSelect={(date) => {
                        setAvailabilityDate(date);
                        setAvailabilityDatePickerOpen(false);
                      }}
                      numberOfMonths={1}
                    />
                  </PopoverContent>
                </Popover>
              </label>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t("providers.time")}
                  <input
                    type="time"
                    value={availabilityTime}
                    onChange={(e) => setAvailabilityTime(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                  />
                </label>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t("providers.shiftDurationHours")}
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={availabilityShiftDuration}
                    onChange={(e) => setAvailabilityShiftDuration(e.target.value)}
                    className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                  />
                </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCheckAvailability()}
                disabled={availabilityLoading || !availabilityDate}
                className="rounded bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-700 dark:hover:bg-brand-800"
              >
                {availabilityLoading ? t("providers.checking") : t("providers.checkAvailability")}
              </button>
            </div>
            {availabilityError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{availabilityError}</p>
            ) : null}
            {availabilitySlots.length > 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800/40 dark:bg-emerald-900/20">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  {t("providers.availableSlots")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {availabilitySlots.map((slot) => (
                    <span
                      key={slot}
                      className="rounded-full border border-emerald-300 bg-white px-2.5 py-1 text-xs text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                    >
                      {slot}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </DetailBlock>
      </div>

      <div className="w-full min-w-0 sm:col-span-2">
        <DetailBlock title={t("providers.consultationTypeServices")}>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {t("providers.consultationTypeServicesHelp")}
          </p>
          {consultationTypeServices.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">{t("providers.noConsultationServices")}</p>
          ) : servicesEditMode ? (
            <div className="space-y-3">
              {consultationTypeServices
                .slice()
                .sort((a, b) => (a.displayOrder - b.displayOrder) || (a.id - b.id))
                .map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800/50"
                  >
                    <input
                      type="checkbox"
                      checked={servicesOffered[s.id] ?? s.offered}
                      onChange={(e) =>
                        setServicesOffered((prev) => ({ ...prev, [s.id]: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm font-medium text-gray-800 dark:text-white/90">{s.label}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {servicesOffered[s.id] ?? s.offered ? t("providers.offered") : t("providers.excluded")}
                    </span>
                  </label>
                ))}
              {servicesError && (
                <p className="text-sm text-red-600 dark:text-red-400">{servicesError}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={servicesSaving}
                  onClick={handleSaveConsultationServices}
                  className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-700 dark:hover:bg-brand-800"
                >
                  {servicesSaving ? t("supervisor.saving") : t("common.actions.save")}
                </button>
                <button
                  type="button"
                  disabled={servicesSaving}
                  onClick={() => {
                    setServicesEditMode(false);
                    setServicesError(null);
                    const next: Record<number, boolean> = {};
                    consultationTypeServices.forEach((s) => {
                      next[s.id] = s.offered;
                    });
                    setServicesOffered(next);
                  }}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  {t("common.actions.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {consultationTypeServices
                .slice()
                .sort((a, b) => (a.displayOrder - b.displayOrder) || (a.id - b.id))
                .map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800/50"
                  >
                    <span className="font-medium text-gray-800 dark:text-white/90">{s.label}</span>
                    <Badge size="sm" color={s.offered ? "success" : "light"}>
                      {s.offered ? t("providers.offered") : t("providers.excluded")}
                    </Badge>
                  </div>
                ))}
              <button
                type="button"
                onClick={() => setServicesEditMode(true)}
                className="mt-2 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {t("providers.updateList")}
              </button>
            </div>
          )}
        </DetailBlock>
      </div>

      <div className="w-full min-w-0 sm:col-span-2">
        <DetailBlock title={t("providers.certificationsAndDocuments")}>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {t("providers.certificationsHelp")}
          </p>
          {certsLoading ? (
            <p className="text-gray-500 dark:text-gray-400">{t("systemConfig.loading")}</p>
          ) : certsError ? (
            <p className="text-red-600 dark:text-red-400">{certsError}</p>
          ) : !certifications.length ? (
            <p className="text-gray-500 dark:text-gray-400">{t("providers.noCertifications")}</p>
          ) : (
            <div className="w-full min-w-0 max-h-64 overflow-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">{t("providers.type")}</th>
                    <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">{t("providers.certNumber")}</th>
                    <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">{t("users.status")}</th>
                    <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">{t("providers.approvedBy")}</th>
                    <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">{t("providers.seeDocument")}</th>
                    <th className="w-10 py-2 font-medium text-gray-500 dark:text-gray-400" aria-label={t("providers.showMore")} />
                  </tr>
                </thead>
                <tbody>
                  {certifications.map((cert) => {
                    const isExpanded = expandedCertId === cert.id;
                    return (
                      <React.Fragment key={cert.id}>
                        <tr className="border-b border-gray-100 dark:border-gray-800">
                          <td className="py-1.5 pr-2">
                            <span className="font-medium text-gray-800 dark:text-white/90">{cert.certificationTypeName}</span>
                            <span className="ml-1 text-gray-500 dark:text-gray-400">({cert.certificationTypeCode})</span>
                          </td>
                          <td className="py-1.5 pr-2 text-gray-700 dark:text-gray-300">{cert.certificationNumber}</td>
                          <td className="py-1.5 pr-2">
                            <Badge size="sm" color={cert.status === "APPROVED" ? "success" : cert.status === "REJECTED" ? "error" : "warning"}>
                              {cert.status}
                            </Badge>
                          </td>
                          <td className="py-1.5 pr-2 text-gray-700 dark:text-gray-300">{cert.approvedByName ?? "—"}</td>
                          <td className="py-1.5 pr-2">
                            {cert.documentUrl ? (
                              <a
                                href={getAssetUrl(cert.documentUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-brand-600 hover:underline dark:text-brand-400"
                              >
                                {t("providers.seeDocument")}
                              </a>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">—</span>
                            )}
                          </td>
                          <td className="py-1.5">
                            <button
                              type="button"
                              onClick={() => setExpandedCertId(isExpanded ? null : cert.id)}
                              className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                              title={isExpanded ? t("providers.collapse") : t("providers.showMore")}
                              aria-expanded={isExpanded}
                            >
                              <svg
                                className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-b border-gray-100 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-800/40">
                            <td colSpan={6} className="px-3 py-2">
                              <div className="flex flex-wrap items-start gap-4 text-xs">
                                <div>
                                  <span className="font-medium text-gray-500 dark:text-gray-400">{t("providers.requestedAt")}: </span>
                                  <span className="text-gray-700 dark:text-gray-300">
                                    {cert.createdAt ? formatDate(cert.createdAt) : "—"}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-500 dark:text-gray-400">{t("providers.approvedAt")}: </span>
                                  <span className="text-gray-700 dark:text-gray-300">
                                    {cert.approvedAt ? formatDate(cert.approvedAt) : "—"}
                                  </span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-500 dark:text-gray-400">{t("providers.approvedBy")}: </span>
                                  <span className="text-gray-700 dark:text-gray-300">{cert.approvedByName ?? "—"}</span>
                                </div>
                                <div>
                                  <span className="font-medium text-gray-500 dark:text-gray-400">{t("providers.adminComment")}: </span>
                                  <span className="text-gray-700 dark:text-gray-300">{cert.adminComment ?? "—"}</span>
                                </div>
                                {cert.status === "PENDING" && (
                                  <span className="flex flex-wrap gap-1">
                                    <button
                                      type="button"
                                      disabled={verifyingId === cert.id}
                                      onClick={() => handleVerifyCertification(cert.id, "APPROVED")}
                                      className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-700 dark:hover:bg-green-800"
                                    >
                                      {verifyingId === cert.id ? "…" : t("upgradeRequests.approve")}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={verifyingId === cert.id}
                                      onClick={() => handleVerifyCertification(cert.id, "REJECTED")}
                                      className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-800"
                                    >
                                      {t("upgradeRequests.reject")}
                                    </button>
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DetailBlock>
      </div>

      {/*
      <div className="w-full min-w-0 sm:col-span-2">
        <DetailBlock title="Reference Check - Minimum 2 references">
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            UI preview only for reference-verification workflow. API integration can be added later.
          </p>
          <div className="w-full min-w-0 max-h-48 overflow-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">Reference</th>
                  <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">Relation</th>
                  <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">Contact</th>
                  <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">Status</th>
                  <th className="py-2 font-medium text-gray-500 dark:text-gray-400">Note</th>
                </tr>
              </thead>
              <tbody>
                {referenceChecks.map((ref) => (
                  <tr key={ref.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-1.5 pr-2 font-medium text-gray-800 dark:text-white/90">{ref.refName}</td>
                    <td className="py-1.5 pr-2 text-gray-700 dark:text-gray-300">{ref.relation}</td>
                    <td className="py-1.5 pr-2 text-gray-700 dark:text-gray-300">{ref.contact}</td>
                    <td className="py-1.5 pr-2">
                      <Badge size="sm" color={ref.status === "VERIFIED" ? "success" : "warning"}>
                        {ref.status}
                      </Badge>
                    </td>
                    <td className="py-1.5 text-gray-600 dark:text-gray-400">{ref.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailBlock>
      </div>
      */}

      <div className="w-full min-w-0 sm:col-span-2">
        <DetailBlock title={t("providers.userDocuments")}>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {t("providers.userDocumentsHelp")}
          </p>
          {userDocsLoading ? (
            <p className="text-gray-500 dark:text-gray-400">{t("systemConfig.loading")}</p>
          ) : userDocsError ? (
            <p className="text-red-600 dark:text-red-400">{userDocsError}</p>
          ) : !userDocuments.length ? (
            <p className="text-gray-500 dark:text-gray-400">{t("providers.noDocuments")}</p>
          ) : (
            <div className="w-full min-w-0 max-h-48 overflow-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">{t("providers.type")}</th>
                    <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">{t("users.status")}</th>
                    <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">{t("users.created")}</th>
                    <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">{t("providers.document")}</th>
                    <th className="w-24 py-2 font-medium text-gray-500 dark:text-gray-400">{t("providers.verify")}</th>
                  </tr>
                </thead>
                <tbody>
                  {userDocuments.map((doc) => (
                    <tr key={doc.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-1.5 pr-2 font-medium text-gray-800 dark:text-white/90">{doc.type}</td>
                      <td className="py-1.5 pr-2">
                        <Badge size="sm" color={doc.status === "APPROVED" ? "success" : doc.status === "REJECTED" ? "error" : "warning"}>
                          {doc.status}
                        </Badge>
                      </td>
                      <td className="py-1.5 pr-2 text-gray-700 dark:text-gray-300">{formatDate(doc.createdAt)}</td>
                      <td className="py-1.5 pr-2">
                        <span className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            disabled={!(doc.filePath ?? doc.path)}
                            onClick={() => viewDocument(doc.filePath ?? doc.path)}
                            title={t("common.actions.view")}
                            className="rounded border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={!(doc.filePath ?? doc.path)}
                            onClick={() => downloadDocument(doc.filePath ?? doc.path, `${doc.type}_${doc.id}.pdf`)}
                            title={t("upgradeRequests.download")}
                            className="rounded border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                          >
                            <DownloadIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={!(doc.filePath ?? doc.path)}
                            onClick={() => printDocument(doc.filePath ?? doc.path)}
                            title={t("upgradeRequests.print")}
                            className="rounded border border-gray-300 bg-white p-1.5 text-gray-600 hover:bg-gray-50 hover:text-gray-800 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                          >
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" />
                            </svg>
                          </button>
                        </span>
                      </td>
                      <td className="py-1.5">
                        {String(doc.status).toUpperCase() === "PENDING" ? (
                          <span className="flex flex-wrap gap-1">
                            <button
                              type="button"
                              disabled={verifyingDocId === doc.id}
                              onClick={() => handleVerifyDocument(doc.id, "APPROVED")}
                              className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-700 dark:hover:bg-green-800"
                            >
                              {verifyingDocId === doc.id ? "…" : t("upgradeRequests.approve")}
                            </button>
                            <button
                              type="button"
                              disabled={verifyingDocId === doc.id}
                              onClick={() => handleVerifyDocument(doc.id, "REJECTED")}
                              className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-700 dark:hover:bg-red-800"
                            >
                              {t("upgradeRequests.reject")}
                            </button>
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DetailBlock>
      </div>

      <div className={`w-full min-w-0 sm:col-span-2 ${isProviderPending ? "relative opacity-60" : ""}`}>
        <DetailBlock title={t("providers.serviceRequests")}>
          {isProviderPending && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              {t("providers.pendingProviderLocked")}
            </div>
          )}
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {isProviderPending
              ? t("providers.verifyProviderToManageRequests")
              : t("providers.clickStatusToViewRequests")}
          </p>
          <div className={`grid w-full min-w-0 grid-cols-2 gap-3 text-sm sm:grid-cols-3 md:grid-cols-6 ${isProviderPending ? "pointer-events-none" : ""}`}>
            {SERVICE_REQUEST_STATUSES.map((status) => (
              <ServiceRequestStatusCard
                key={status}
                status={status}
                count={
                  status === "PENDING"
                    ? serviceRequestsByStatus.PENDING?.length ?? 0
                    : status === "ACCEPTED"
                      ? serviceRequestsByStatus.ACCEPTED?.length ?? 0
                      : status === "REJECTED"
                        ? serviceRequestsByStatus.REJECTED?.length ?? 0
                        : status === "IN_PROGRESS"
                          ? serviceRequestsByStatus.IN_PROGRESS?.length ?? 0
                          : status === "COMPLETED"
                            ? serviceRequestsByStatus.COMPLETED?.length ?? 0
                            : serviceRequestsByStatus.CANCELLED?.length ?? 0
                }
                onOpen={setOpenStatus}
                disabled={isProviderPending}
              />
            ))}
          </div>
          <p className="mt-3 text-gray-500 dark:text-gray-400">{t("providers.totalRequests", { count: totalRequests })}</p>
        </DetailBlock>
      </div>

      <ServiceRequestsListModal
        isOpen={openStatus != null}
        onClose={() => setOpenStatus(null)}
        entityLabel={t("providers.providerLabel")}
        entityId={provider.id}
        status={openStatus}
        variant="provider"
      />

      <div className={`w-full min-w-0 grid grid-cols-1 gap-4 lg:grid-cols-2 sm:col-span-2 ${isProviderPending ? "relative opacity-60 pointer-events-none" : ""}`}>
        <DetailBlock title={t("providers.wallet")}>
          {isProviderPending && (
            <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
              {t("providers.availableAfterActive")}
            </p>
          )}
          <DetailBlockRow
            label={t("providers.totalBalance")}
            value={totalBalance != null && totalBalance !== "" ? totalBalance : wallet ? `${wallet.balance} ${wallet.currency}` : t("common.noValue")}
          />
          <DetailBlockRow label={t("providers.claimableBalance")} value={claimableBalance ?? t("common.noValue")} />
          <DetailBlockRow label={t("providers.nonClaimableBalance")} value={nonClaimableBalance ?? t("common.noValue")} />
          <DetailBlockRow label={t("providers.cashCommissionDue")} value={cashCommissionDue ?? t("common.noValue")} />
          <DetailBlockRow label={t("providers.pendingWithdrawal")} value={pendingWithdrawal ?? t("common.noValue")} />
          {wallet && (
            <DetailBlockRow label={t("users.created")} value={formatDate(wallet.createdAt)} />
          )}
        </DetailBlock>

        <DetailBlock title={t("providers.walletHistory")}>
          {isProviderPending && (
            <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
              {t("providers.availableAfterActive")}
            </p>
          )}
          {!walletHistory?.length ? (
            <p className="text-gray-500 dark:text-gray-400">{t("providers.noHistory")}</p>
          ) : (
            <div className="w-full min-w-0 max-h-48 overflow-auto">
              <table className="w-full min-w-[20rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">{t("providers.date")}</th>
                    <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">{t("providers.amount")}</th>
                    <th className="py-2 pr-2 font-medium text-gray-500 dark:text-gray-400">{t("providers.balanceAfter")}</th>
                    <th className="py-2 font-medium text-gray-500 dark:text-gray-400">{t("providers.description")}</th>
                  </tr>
                </thead>
                <tbody>
                  {walletHistory.map((entry: WalletHistoryEntryDto) => (
                    <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-1.5 pr-2 text-gray-700 dark:text-gray-300">{formatDate(entry.createdAt)}</td>
                      <td className="py-1.5 pr-2 font-medium text-gray-800 dark:text-white/90">{entry.amount}</td>
                      <td className="py-1.5 pr-2 text-gray-700 dark:text-gray-300">{entry.balanceAfter}</td>
                      <td className="py-1.5 text-gray-600 dark:text-gray-400">{entry.description ?? t("common.noValue")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DetailBlock>
      </div>

      <div className="w-full min-w-0 sm:col-span-2 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DetailBlock title={t("providers.walletFundingAdmin")}>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {t("providers.walletFundingHelp")}
          </p>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <input
              type="number"
              min={0}
              step={0.01}
              value={manualCreditAmount}
              onChange={(e) => setManualCreditAmount(e.target.value)}
              placeholder={t("providers.amount")}
              className="w-28 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            />
            <input
              type="text"
              value={manualCreditReason}
              onChange={(e) => setManualCreditReason(e.target.value)}
              placeholder={t("providers.reasonOptional")}
              className="w-48 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            />
            <input
              type="text"
              value={manualCreditReference}
              onChange={(e) => setManualCreditReference(e.target.value)}
              placeholder={t("providers.referenceOptional")}
              className="w-48 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            />
            <button
              type="button"
              disabled={manualCreditLoading || !manualCreditAmount.trim()}
              onClick={handleManualCredit}
              className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-700 dark:hover:bg-brand-800"
            >
              {manualCreditLoading ? t("providers.applying") : t("providers.manualCredit")}
            </button>
          </div>
          {fundingHistoryError && (
            <p className="mb-2 text-xs text-rose-600 dark:text-rose-400">{fundingHistoryError}</p>
          )}
          {fundingHistoryLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("providers.loadingFundingHistory")}</p>
          ) : !fundingHistory?.data?.length ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t("providers.noFundingRecords")}</p>
          ) : (
            <>
              <div className="max-h-56 overflow-auto rounded border border-gray-200 dark:border-gray-700">
                <table className="w-full min-w-[42rem] text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2 px-2 font-medium text-gray-500 dark:text-gray-400">{t("providers.date")}</th>
                      <th className="py-2 px-2 font-medium text-gray-500 dark:text-gray-400">{t("providers.purpose")}</th>
                      <th className="py-2 px-2 font-medium text-gray-500 dark:text-gray-400">{t("users.status")}</th>
                      <th className="py-2 px-2 font-medium text-gray-500 dark:text-gray-400">{t("providers.method")}</th>
                      <th className="py-2 px-2 font-medium text-gray-500 dark:text-gray-400">{t("providers.amount")}</th>
                      <th className="py-2 px-2 font-medium text-gray-500 dark:text-gray-400">{t("providers.description")}</th>
                      <th className="py-2 px-2 font-medium text-gray-500 dark:text-gray-400">{t("providers.reference")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(fundingHistory.data ?? []).map((entry) => (
                      <tr key={entry.transactionId} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-1.5 px-2 text-gray-700 dark:text-gray-300">{entry.createdAt ? formatDate(entry.createdAt) : t("common.noValue")}</td>
                        <td className="py-1.5 px-2 text-gray-700 dark:text-gray-300">{entry.purpose}</td>
                        <td className="py-1.5 px-2 text-gray-700 dark:text-gray-300">{entry.status}</td>
                        <td className="py-1.5 px-2 text-gray-700 dark:text-gray-300">{entry.paymentMethod ?? t("common.noValue")}</td>
                        <td className="py-1.5 px-2 font-medium text-gray-800 dark:text-white/90">{entry.amount}</td>
                        <td className="py-1.5 px-2 text-gray-600 dark:text-gray-400">{entry.reason ?? t("common.noValue")}</td>
                        <td className="py-1.5 px-2 text-gray-600 dark:text-gray-400">{entry.reference ?? t("common.noValue")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>
                  {t("providers.pageOfTotal", {
                    page: fundingHistory.meta.page,
                    totalPages: fundingHistory.meta.totalPages,
                    total: fundingHistory.meta.total,
                  })}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={fundingHistoryPage <= 1 || fundingHistoryLoading}
                    onClick={() => setFundingHistoryPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50 dark:border-gray-600"
                  >
                    {t("common.actions.previous")}
                  </button>
                  <button
                    type="button"
                    disabled={
                      fundingHistoryLoading ||
                      fundingHistoryPage >= (fundingHistory.meta.totalPages || 1)
                    }
                    onClick={() => setFundingHistoryPage((p) => p + 1)}
                    className="rounded border border-gray-300 px-2 py-1 disabled:opacity-50 dark:border-gray-600"
                  >
                    {t("common.actions.next")}
                  </button>
                </div>
              </div>
            </>
          )}
        </DetailBlock>
        <DetailBlock title={t("providers.salaryAdmin")}>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {t("providers.salaryHelp")}
          </p>
          {salaryLoading ? (
            <p className="text-gray-500 dark:text-gray-400">{t("systemConfig.loading")}</p>
          ) : (
            <>
              {salaryHistory?.currentSalary && (
                <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
                  {t("providers.currentSalary", {
                    amount: salaryHistory.currentSalary.amount,
                    frequency: salaryHistory.currentSalary.frequency,
                    date: formatDate(salaryHistory.currentSalary.validFrom),
                  })}
                </p>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={salaryAmount}
                  onChange={(e) => setSalaryAmount(e.target.value)}
                  placeholder={t("providers.amount")}
                  className="w-28 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                />
                <select
                  value={salaryFrequency}
                  onChange={(e) => setSalaryFrequency(e.target.value as "MONTHLY" | "WEEKLY")}
                  className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                >
                  <option value="MONTHLY">{t("providers.monthly")}</option>
                  <option value="WEEKLY">{t("providers.weekly")}</option>
                </select>
                <button
                  type="button"
                  disabled={salarySaving || !salaryAmount.trim()}
                  onClick={handleSetSalary}
                  className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-700 dark:hover:bg-brand-800"
                >
                  {salarySaving ? t("supervisor.saving") : t("providers.setSalary")}
                </button>
              </div>
              {(salaryHistory?.history?.length ?? 0) > 0 && (
                <div className="mt-3 max-h-32 overflow-auto">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("providers.history")}</p>
                  <ul className="mt-1 list-inside list-disc text-xs text-gray-600 dark:text-gray-400">
                    {(salaryHistory?.history ?? []).slice(0, 10).map((r, i) => (
                      <li key={i}>{r.amount} / {r.frequency} from {formatDate(r.validFrom)}{r.validTo ? ` to ${formatDate(r.validTo)}` : ` ${t("providers.currentMarker")}`}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </DetailBlock>
        <DetailBlock title={t("providers.billingRateAdmin")}>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {t("providers.billingRateHelp")}
          </p>
          {billingRateLoading ? (
            <p className="text-gray-500 dark:text-gray-400">{t("systemConfig.loading")}</p>
          ) : (
            <>
              {billingRateHistory?.currentRate && (
                <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
                  {t("providers.currentRate", {
                    amount: billingRateHistory.currentRate.amount,
                    type: billingRateHistory.currentRate.type,
                    date: formatDate(billingRateHistory.currentRate.validFrom),
                  })}
                </p>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={billingRateAmount}
                  onChange={(e) => setBillingRateAmount(e.target.value)}
                  placeholder={t("providers.amount")}
                  className="w-28 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                />
                <select
                  value={billingRateType}
                  onChange={(e) => setBillingRateType(e.target.value as "CONSULTATION" | "HOURLY")}
                  className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                >
                  <option value="CONSULTATION">{t("providers.consultation")}</option>
                  <option value="HOURLY">{t("providers.hourly")}</option>
                </select>
                <button
                  type="button"
                  disabled={billingRateSaving || !billingRateAmount.trim()}
                  onClick={handleSetBillingRate}
                  className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-700 dark:hover:bg-brand-800"
                >
                  {billingRateSaving ? t("supervisor.saving") : t("providers.setRate")}
                </button>
              </div>
              {(billingRateHistory?.history?.length ?? 0) > 0 && (
                <div className="mt-3 max-h-32 overflow-auto">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{t("providers.history")}</p>
                  <ul className="mt-1 list-inside list-disc text-xs text-gray-600 dark:text-gray-400">
                    {(billingRateHistory?.history ?? []).slice(0, 10).map((r, i) => (
                      <li key={i}>{r.amount} ({r.type}) from {formatDate(r.validFrom)}{r.validTo ? ` to ${formatDate(r.validTo)}` : ` ${t("providers.currentMarker")}`}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </DetailBlock>
      </div>

    </div>
  );
}
