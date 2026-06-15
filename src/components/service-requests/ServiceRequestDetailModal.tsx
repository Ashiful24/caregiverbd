import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../ui/modal";
import Badge from "../ui/badge/Badge";
import {
  adminServiceRequestsApi,
  normalizeServiceRequestTimeline,
  type AdminServiceRequestListDto,
  type ServiceRequestEventLogDto,
} from "../../services/api";
import { formatDate, formatDateTime, formatStatusLabel } from "../../utils/format";
import { ServiceRequestLifecycleStepper } from "./ServiceRequestLifecycleStepper";
import {
  lifecycleActiveIndexForTimeline,
  mapEventLogToLifecycleStep,
} from "./mapEventLogToLifecycleStep";

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
    case "EXPIRED":
      return "light";
    default:
      return "light";
  }
}

type TimelineView =
  | { kind: "pending" }
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "api"; steps: ReturnType<typeof mapEventLogToLifecycleStep>[]; activeIndex: number };

export function ServiceRequestDetailModal({
  item,
  isOpen,
  onClose,
}: ServiceRequestDetailModalProps) {
  const { t } = useTranslation();
  const [eventLogs, setEventLogs] = useState<ServiceRequestEventLogDto[]>([]);
  const [eventLogsIsTerminal, setEventLogsIsTerminal] = useState(false);
  const [eventLogsLoading, setEventLogsLoading] = useState(false);
  const [eventLogsError, setEventLogsError] = useState<string | null>(null);
  const [eventLogsFetched, setEventLogsFetched] = useState(false);

  useEffect(() => {
    if (!item || !isOpen) {
      setEventLogs([]);
      setEventLogsIsTerminal(false);
      setEventLogsError(null);
      setEventLogsLoading(false);
      setEventLogsFetched(false);
      return;
    }

    const controller = new AbortController();
    setEventLogs([]);
    setEventLogsIsTerminal(false);
    setEventLogsError(null);
    setEventLogsFetched(false);
    setEventLogsLoading(true);

    adminServiceRequestsApi
      .getEventLogs(
        {
          serviceRequestId: item.id,
          longTermOpportunityId: item.longTermOpportunityId ?? undefined,
        },
        { signal: controller.signal }
      )
      .then((res) => {
        const parsed = normalizeServiceRequestTimeline(res.data);
        setEventLogs(parsed.timeline);
        setEventLogsIsTerminal(parsed.isTerminal);
        setEventLogsFetched(true);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: string }).message)
            : t("appointments.eventLogsLoadError");
        setEventLogsError(message);
        setEventLogsFetched(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setEventLogsLoading(false);
      });

    return () => controller.abort();
  }, [item?.id, isOpen]);

  const timelineView = useMemo((): TimelineView => {
    if (!item) return { kind: "pending" };
    if (!eventLogsFetched) return { kind: "pending" };
    if (eventLogsError) return { kind: "error", message: eventLogsError };
    if (eventLogs.length === 0) return { kind: "empty" };
    const steps = eventLogs.map((log) => mapEventLogToLifecycleStep(log, t));
    const activeIndex = lifecycleActiveIndexForTimeline(eventLogs, eventLogsIsTerminal);
    return { kind: "api", steps, activeIndex };
  }, [item, eventLogs, eventLogsIsTerminal, eventLogsFetched, eventLogsError, t]);

  const showLifecycleSection = eventLogsLoading || eventLogsFetched;

  return (
    <Modal
      isOpen={Boolean(item) && isOpen}
      onClose={onClose}
      className="max-w-xl p-6 sm:p-8 md:max-w-2xl"
    >
      {item ? (
        <div className="flex max-h-[85vh] flex-col">
          <div className="shrink-0 border-b border-gray-200 pb-4 pt-1 dark:border-gray-800">
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

            {showLifecycleSection && (
              <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-800">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {t("appointments.lifecycleHeading")}
                </h4>

                {eventLogsLoading && (
                  <div className="mt-5 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <div className="h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                    {t("appointments.eventLogsLoading")}
                  </div>
                )}

                {!eventLogsLoading && timelineView.kind === "error" && (
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200">
                    {timelineView.message}
                  </p>
                )}

                {!eventLogsLoading && timelineView.kind === "empty" && (
                  <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    {t("appointments.eventLogsEmpty")}
                  </p>
                )}

                {!eventLogsLoading && timelineView.kind === "api" && (
                  <>
                    <div className="mt-5">
                      <ServiceRequestLifecycleStepper
                        steps={timelineView.steps}
                        activeIndex={timelineView.activeIndex}
                      />
                    </div>
                    <p className="mt-6 text-xs leading-relaxed text-gray-400 dark:text-gray-500">
                      {t("appointments.lifecycleFromEventLogs")}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
