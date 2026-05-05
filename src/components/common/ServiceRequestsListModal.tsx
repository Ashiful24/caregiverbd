import { useCallback, useEffect, useState } from "react";
import { Modal } from "../ui/modal";
import Badge from "../ui/badge/Badge";
import { formatDate, formatStatusLabel } from "../../utils/format";
import {
  patientsApi,
  providersApi,
  type AdminServiceRequestDetailDto,
  type AdminServiceRequestStatus,
  type ServiceDetailsByConsultationTypeEntryDto,
} from "../../services/api";

export interface ServiceRequestsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** "Provider" or "Patient" for title */
  entityLabel: string;
  /** providerId or patientId */
  entityId: number;
  /** PENDING | ACCEPTED | REJECTED | IN_PROGRESS | COMPLETED | CANCELLED */
  status: AdminServiceRequestStatus | null;
  variant: "provider" | "patient";
}

function statusBadgeColor(status: string): "success" | "warning" | "error" | "light" {
  switch (String(status).toUpperCase()) {
    case "COMPLETED":
    case "ACCEPTED":
      return "success";
    case "PENDING":
    case "IN_PROGRESS":
      return "warning";
    case "REJECTED":
    case "CANCELLED":
      return "error";
    default:
      return "light";
  }
}

export function ServiceRequestsListModal({
  isOpen,
  onClose,
  entityLabel,
  entityId,
  status,
  variant,
}: ServiceRequestsListModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<ServiceDetailsByConsultationTypeEntryDto[]>([]);

  const fetchList = useCallback(async (signal?: AbortSignal) => {
    if (entityId == null || !status) return;
    setLoading(true);
    setError(null);
    setGroups([]);
    let aborted = false;
    try {
      const res =
        variant === "provider"
          ? await providersApi.getServiceRequests(entityId, { status }, { signal })
          : await patientsApi.getServiceRequests(entityId, { status }, { signal });
      const data = (res?.data ?? res) as ServiceDetailsByConsultationTypeEntryDto[] | undefined;
      setGroups(Array.isArray(data) ? data : []);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        aborted = true;
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to load service requests.");
    } finally {
      if (!aborted) setLoading(false);
    }
  }, [entityId, status, variant]);

  useEffect(() => {
    if (!isOpen || !status) {
      setGroups([]);
      setError(null);
      return;
    }
    const controller = new AbortController();
    fetchList(controller.signal);
    return () => controller.abort();
  }, [isOpen, status, fetchList]);

  const totalRequests = groups.reduce((sum, g) => sum + (g.requests?.length ?? 0), 0);
  const title = status ? `Service requests — ${formatStatusLabel(status)}` : "Service requests";

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-4xl p-6 sm:p-8">
      <div className="flex max-h-[85vh] flex-col">
        <h3 className="shrink-0 text-xl font-semibold text-gray-800 dark:text-white/90">
          {title}
        </h3>
        <p className="mt-1 shrink-0 text-sm text-gray-500 dark:text-gray-400">
          {entityLabel} • {totalRequests} request{totalRequests !== 1 ? "s" : ""}
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No service requests found.</p>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <div
                  key={group.consultationTypeId}
                  className="rounded-xl border border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/30"
                >
                  <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {group.consultationTypeName}
                    </h4>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                      {group.requests?.length ?? 0} request{(group.requests?.length ?? 0) !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-100/80 dark:border-gray-700 dark:bg-gray-800/50">
                          <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">ID</th>
                          <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Patient</th>
                          <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Provider</th>
                          <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                          <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Amount</th>
                          <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Distance</th>
                          <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Scheduled</th>
                          <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(group.requests ?? []).map((req: AdminServiceRequestDetailDto) => (
                          <tr
                            key={req.id}
                            className="border-b border-gray-100 transition-colors hover:bg-gray-50/80 dark:border-gray-800 dark:hover:bg-gray-800/50"
                          >
                            <td className="px-4 py-3 font-medium text-gray-800 dark:text-white/90">
                              #{req.id}
                            </td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                              {req.patientName ?? `Patient #${req.patientId}`}
                            </td>
                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                              {req.providerName ?? (req.providerId ? `Provider #${req.providerId}` : "—")}
                            </td>
                            <td className="px-4 py-3">
                              <Badge size="sm" color={statusBadgeColor(req.status)}>
                                {formatStatusLabel(req.status)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-800 dark:text-white/90">
                              {req.amount} BDT
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                              {req.distanceKm != null ? `${req.distanceKm} km` : "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                              {req.scheduledAt ? formatDate(req.scheduledAt) : "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                              {formatDate(req.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
