import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { ScheduleCalendar } from "../components/schedule/ScheduleCalendar";
import {
  adminLongTermOpportunitiesApi,
  normalizeLongTermOpportunityRow,
  type LongTermOpportunityListItem,
} from "../services/api";
import { formatDate } from "../utils/format";
import type { ScheduleEventRecord } from "../data/nurseScheduleSeed";

function resolveOpportunityFromScheduleDetails(data: unknown): LongTermOpportunityListItem {
  const candidates: unknown[] = [];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    candidates.push(
      o,
      o.data,
      o.opportunity,
      o.longTermOpportunity,
      o.serviceRequest,
      o.request,
      o.scheduleDetails
    );
  } else {
    candidates.push(data);
  }
  for (const candidate of candidates) {
    const normalized = normalizeLongTermOpportunityRow(candidate);
    if (normalized.id > 0) return normalized;
  }
  return { id: 0, status: "" };
}

function buildEventsFromScheduleDetails(
  data: unknown,
  requestId: string
): ScheduleEventRecord[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;

  const collectSlots = (node: unknown): unknown[] => {
    if (!node || typeof node !== "object") return [];
    const o = node as Record<string, unknown>;
    const directKeys = [
      "schedule",
      "slots",
      "scheduleSlots",
      "providerSchedules",
      "schedules",
      "scheduleDetails",
      "providerScheduleSlots",
      "events",
      "data",
      "items",
      "results",
    ] as const;
    for (const key of directKeys) {
      const val = o[key];
      if (Array.isArray(val)) return val;
      if (val && typeof val === "object") {
        const nested = collectSlots(val);
        if (nested.length > 0) return nested;
      }
    }
    return [];
  };

  const toIsoFromParts = (dateLike: string, timeLike: string): string | null => {
    const date = dateLike.trim();
    const time = timeLike.trim();
    if (!date || !time) return null;
    if (date.includes("T")) return date;
    if (time.includes("T")) return time;
    const hhmm = time.length >= 5 ? time.slice(0, 5) : time;
    return `${date}T${hhmm}:00`;
  };

  const formatFee = (feeRaw: unknown): string | null => {
    const raw = String(feeRaw ?? "").trim();
    if (!raw) return null;
    const amount = Number(raw);
    if (Number.isFinite(amount)) {
      const formatted = amount.toLocaleString(undefined, {
        minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      });
      return `${formatted} ৳`;
    }
    return `${raw} ৳`;
  };

  const slotsRaw = collectSlots(root);
  if (!slotsRaw.length) return [];
  const events = slotsRaw
    .map((slot, idx): ScheduleEventRecord | null => {
      if (!slot || typeof slot !== "object") return null;
      const raw = slot as Record<string, unknown>;
      const providerSchedule =
        raw.providerSchedule && typeof raw.providerSchedule === "object"
          ? (raw.providerSchedule as Record<string, unknown>)
          : null;
      const serviceRequest =
        raw.serviceRequest && typeof raw.serviceRequest === "object"
          ? (raw.serviceRequest as Record<string, unknown>)
          : null;
      const s = providerSchedule ?? raw;
      const providerScheduleStatus = String(s.status ?? "").trim().toUpperCase();
      const serviceRequestStatus = String(serviceRequest?.status ?? "").trim().toUpperCase();
      const isUnavailableSchedule =
        providerScheduleStatus === "UNAVAILABLE" ||
        providerScheduleStatus === "REJECTED" ||
        providerScheduleStatus === "CANCELLED";
      const isRejectedServiceRequest =
        serviceRequestStatus === "REJECTED" || serviceRequestStatus === "CANCELLED";
      if (isUnavailableSchedule || isRejectedServiceRequest) return null;
      const date = String(
        s.date ?? s.scheduleDate ?? s.schedule_date ?? s.day ?? s.slotDate ?? ""
      ).trim();
      const startTime = String(
        s.startTime ?? s.start_time ?? s.from ?? s.slotStartTime ?? ""
      ).trim();
      const endTime = String(
        s.endTime ?? s.end_time ?? s.to ?? s.slotEndTime ?? ""
      ).trim();
      const startAtRaw = String(
        s.start ?? s.startAt ?? s.start_at ?? s.startDateTime ?? s.start_datetime ?? ""
      ).trim();
      const endAtRaw = String(
        s.end ?? s.endAt ?? s.end_at ?? s.endDateTime ?? s.end_datetime ?? ""
      ).trim();

      const startIso =
        startAtRaw ||
        (date && startTime ? toIsoFromParts(date, startTime) : null);
      const endIso =
        endAtRaw ||
        (date && endTime ? toIsoFromParts(date, endTime) : null);
      if (!startIso || !endIso) return null;

      const providerId = String(
        s.providerId ??
          s.provider_id ??
          serviceRequest?.providerId ??
          serviceRequest?.provider_id ??
          s.id ??
          `provider-${idx}`
      );
      const providerObj =
        s.provider && typeof s.provider === "object"
          ? (s.provider as Record<string, unknown>)
          : null;
      const providerName =
        String(
          s.providerName ??
            s.provider_name ??
            s.nurseName ??
            s.nurse_name ??
            (providerObj
              ? `${String(providerObj.firstName ?? "").trim()} ${String(
                  providerObj.lastName ?? ""
                ).trim()}`.trim() || providerObj.name
              : "") ??
            s.name ??
            "Nurse"
        ).trim() || "Nurse";
      const feeLabel = formatFee(serviceRequest?.fee ?? raw.fee);
      const event: ScheduleEventRecord = {
        id: String(
          serviceRequest?.longTermCalendarSlotId ??
            serviceRequest?.long_term_calendar_slot_id ??
            s.id ??
            `evt-${requestId}-${providerId}-${date}-${startTime}-${idx}`
        ),
        requestId,
        nurseId: providerId,
        nurseName: providerName,
        title: `${providerName.split(" ")[0]} - Visit`,
        feeLabel: feeLabel ?? undefined,
        start: startIso,
        end: endIso,
        type: "visit",
        scheduleSlotId: Number(
          serviceRequest?.scheduleSlotId ??
            serviceRequest?.schedule_slot_id ??
            s.id ??
            0
        ) || undefined,
      };
      return event;
    })
    .filter((x) => x != null);
  return events;
}

export default function NurseScheduleCalendarPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const location = useLocation();
  const routeRequest =
    (location.state as { request?: LongTermOpportunityListItem; scheduleDetails?: unknown } | null)
      ?.request;
  const routeScheduleDetails =
    (location.state as { request?: LongTermOpportunityListItem; scheduleDetails?: unknown } | null)
      ?.scheduleDetails;
  const [request, setRequest] = useState<LongTermOpportunityListItem | null>(routeRequest ?? null);
  const [initialEvents, setInitialEvents] = useState<ScheduleEventRecord[]>(
    requestId && routeScheduleDetails
      ? buildEventsFromScheduleDetails(routeScheduleDetails, requestId)
      : []
  );
  const [loading, setLoading] = useState(!routeRequest && Boolean(requestId));

  useEffect(() => {
    if (!requestId) {
      setRequest(null);
      setLoading(false);
      return;
    }
    if (routeRequest && String(routeRequest.id) === requestId) {
      setRequest(routeRequest);
      if (routeScheduleDetails) {
        setInitialEvents(buildEventsFromScheduleDetails(routeScheduleDetails, requestId));
      }
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    void (async () => {
      try {
        const res = await adminLongTermOpportunitiesApi.getScheduleDetails(requestId, {
          signal: ac.signal,
        });
        const row = resolveOpportunityFromScheduleDetails(res.data);
        setRequest(row.id > 0 ? row : null);
        setInitialEvents(buildEventsFromScheduleDetails(res.data, requestId));
      } catch {
        try {
          const res = await adminLongTermOpportunitiesApi.getById(requestId, {
            signal: ac.signal,
          });
          const row = normalizeLongTermOpportunityRow(res.data);
          setRequest(row.id > 0 ? row : null);
          setInitialEvents([]);
        } catch {
          setRequest(null);
          setInitialEvents([]);
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [requestId, routeRequest, routeScheduleDetails]);

  const title = useMemo(() => {
    if (!request) return "Service request";
    const no = request.requestNo?.trim() || `SR-${request.id}`;
    const patient = request.patientName?.trim() || "Unknown";
    return `${no} - ${patient}`;
  }, [request]);

  const subtitle = useMemo(() => {
    if (!request) return "Service request schedule";
    const parts: string[] = [];
    if (request.startDate && request.endDate) {
      parts.push(`${formatDate(request.startDate)} - ${formatDate(request.endDate)}`);
    } else if (request.startDate) {
      parts.push(formatDate(request.startDate));
    } else if (request.endDate) {
      parts.push(formatDate(request.endDate));
    }
    if (request.timeRange?.trim()) {
      parts.push(`Time: ${request.timeRange.trim()}`);
    }
    if (request.assignedNursesLabel?.trim()) {
      parts.push(`Nurses: ${request.assignedNursesLabel.trim()}`);
    }
    return parts.join(" | ") || "Service request schedule";
  }, [request]);

  const requestStartDate = request?.startDate ?? new Date().toISOString();
  const requestEndDate =
    request?.endDate ??
    new Date(new Date(requestStartDate).getTime() + 24 * 60 * 60 * 1000).toISOString();

  if (loading) {
    return (
      <>
        <PageMeta title="Service request | Hope - BMQAS" description="Service request" />
        <PageBreadcrumb pageTitle="Service request" />
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-gray-600 dark:text-gray-400">Loading service request…</p>
        </div>
      </>
    );
  }

  if (!requestId || !request) {
    return (
      <>
        <PageMeta title="Service request not found | Hope - BMQAS" description="Service request" />
        <PageBreadcrumb pageTitle="Service request" />
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-gray-600 dark:text-gray-400">
            This service request was not found.
          </p>
          <Link
            to="/schedule"
            className="mt-4 inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            Back to request list
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title={`${request.requestNo ?? `SR-${request.id}`} — Service request | Hope - BMQAS`}
        description={`Calendar for ${request.patientName ?? "patient"}`}
      />
      <PageBreadcrumb pageTitle="Service request" />
      <div className="mb-4">
        <Link
          to="/schedule"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          <span aria-hidden>←</span> All service requests
        </Link>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
        <ScheduleCalendar
          requestId={String(request.id)}
          title={title}
          subtitle={subtitle}
          requestStartDate={requestStartDate}
          requestEndDate={requestEndDate}
          initialEvents={initialEvents}
        />
      </div>
    </>
  );
}
