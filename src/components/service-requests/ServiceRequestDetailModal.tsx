import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../ui/modal";
import Badge from "../ui/badge/Badge";
import type { AdminServiceRequestListDto } from "../../services/api";
import { formatDate, formatDateTime, formatStatusLabel } from "../../utils/format";
import {
  ServiceRequestLifecycleStepper,
  type LifecycleStepItem,
} from "./ServiceRequestLifecycleStepper";

export interface ServiceRequestDetailModalProps {
  item: AdminServiceRequestListDto | null;
  isOpen: boolean;
  onClose: () => void;
}

function serviceRequestStatusBadgeColor(
  status: string
): "success" | "warning" | "error" | "light" {
  const s = String(status).toUpperCase();
  switch (s) {
    case "COMPLETED":
    case "ACCEPTED":
      return "success";
    case "PENDING":
      return "warning";
    case "REJECTED":
    case "CANCELLED":
      return "error";
    case "IN_PROGRESS":
    case "PAYMENT_PENDING":
      return "light";
    default:
      return "light";
  }
}

/** Maps API status to the active step index (0-based). `steps.length` means all steps completed. */
function lifecycleActiveIndex(status: string, stepCount: number): number {
  const s = String(status).toUpperCase();
  if (s === "COMPLETED") return stepCount;
  if (s === "IN_PROGRESS" || s === "PAYMENT_PENDING") return 2;
  if (s === "ACCEPTED") return 1;
  if (s === "REJECTED" || s === "CANCELLED") return 2;
  if (s === "PENDING") return 0;
  return 1;
}

export function ServiceRequestDetailModal({
  item,
  isOpen,
  onClose,
}: ServiceRequestDetailModalProps) {
  const { t } = useTranslation();

  const baseSteps: LifecycleStepItem[] = useMemo(
    () => [
      {
        title: t("appointments.lifecycle.submittedTitle"),
        description: t("appointments.lifecycle.submittedDesc"),
      },
      {
        title: t("appointments.lifecycle.acceptedTitle"),
        description: t("appointments.lifecycle.acceptedDesc"),
      },
      {
        title: t("appointments.lifecycle.inProgressTitle"),
        description: t("appointments.lifecycle.inProgressDesc"),
      },
      {
        title: t("appointments.lifecycle.completedTitle"),
        description: t("appointments.lifecycle.completedDesc"),
      },
    ],
    [t]
  );

  const { steps, activeIndex } = useMemo(() => {
    if (!item) {
      return { steps: baseSteps, activeIndex: 0 };
    }
    const s = String(item.status).toUpperCase();
    const idx = lifecycleActiveIndex(item.status, baseSteps.length);
    if (s === "REJECTED" || s === "CANCELLED") {
      const copy = [...baseSteps];
      copy[2] = {
        title: t("appointments.lifecycle.closedTitle"),
        description: t("appointments.lifecycle.closedDesc"),
      };
      return { steps: copy, activeIndex: idx };
    }
    return { steps: baseSteps, activeIndex: idx };
  }, [item, baseSteps, t]);

  return (
    <Modal
      isOpen={Boolean(item) && isOpen}
      onClose={onClose}
      className="max-w-xl p-6 sm:p-8 md:max-w-2xl"
    >
      {item ? (
        <div className="flex max-h-[85vh] flex-col pe-10 pt-1 sm:pe-14">
          <div className="shrink-0 border-b border-gray-200 pb-4 dark:border-gray-800">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white/95">
              {t("appointments.detailTitle", { id: item.id })}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {item.consultationTypeName ?? t("appointments.type")}
            </p>
            <div className="mt-3">
              <Badge size="sm" color={serviceRequestStatusBadgeColor(item.status)}>
                {formatStatusLabel(item.status)}
              </Badge>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t("dashboard.patient")}
                </dt>
                <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white/90">
                  {item.patientName ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t("appointments.provider")}
                </dt>
                <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-white/90">
                  {item.providerName ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t("appointments.type")}
                </dt>
                <dd className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                  {item.consultationTypeName ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t("appointments.amount")}
                </dt>
                <dd className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                  {item.amount ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t("appointments.scheduled")}
                </dt>
                <dd className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                  {item.scheduledAt ? formatDateTime(item.scheduledAt) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t("appointments.created")}
                </dt>
                <dd className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                  {item.createdAt ? formatDate(item.createdAt) : "—"}
                </dd>
              </div>
            </dl>

            <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-800">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t("appointments.lifecycleHeading")}
              </h4>
              <div className="mt-5">
                <ServiceRequestLifecycleStepper steps={steps} activeIndex={activeIndex} />
              </div>
              <p className="mt-6 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
                {t("appointments.lifecycleStaticNote")}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
