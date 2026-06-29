import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router";
import { format, isValid, parseISO } from "date-fns";
import { bn } from "date-fns/locale/bn";
import { enUS } from "date-fns/locale/en-US";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { ScheduleCalendar } from "../components/schedule/ScheduleCalendar";
import {
  adminLongTermOpportunitiesApi,
  normalizeLongTermOpportunityRow,
  type LongTermOpportunityListItem,
} from "../services/api";
import type { ScheduleEventRecord } from "../data/nurseScheduleSeed";
import { formatDate } from "../utils/format";
import { buildEventsFromScheduleDetails } from "../utils/longTermScheduleEvents";

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

export default function NurseScheduleCalendarPage() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language?.startsWith("bn") ? bn : enUS;
  const nurseFallback = t("scheduleCalendar.nurseFallback");

  const fmtRangeDate = useCallback((iso: string) => {
    try {
      const raw = iso.trim();
      const d = parseISO(raw.length >= 10 ? raw.slice(0, 10) : raw);
      return isValid(d) ? format(d, "d MMM yyyy", { locale: dateLocale }) : formatDate(iso);
    } catch {
      return formatDate(iso);
    }
  }, [dateLocale]);

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
      ? buildEventsFromScheduleDetails(routeScheduleDetails, requestId, nurseFallback)
      : []
  );
  const [loading, setLoading] = useState(!routeRequest && Boolean(requestId));

  useEffect(() => {
    if (!requestId) {
      setRequest(null);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    const fromList = routeRequest && String(routeRequest.id) === requestId;

    // Paint immediately from router state when present; always refetch so refresh / post-create match server.
    if (fromList) {
      setRequest(routeRequest);
      if (routeScheduleDetails) {
        setInitialEvents(buildEventsFromScheduleDetails(routeScheduleDetails, requestId, nurseFallback));
      }
    } else {
      setLoading(true);
    }

    void (async () => {
      try {
        const res = await adminLongTermOpportunitiesApi.getScheduleDetails(requestId, {
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        const row = resolveOpportunityFromScheduleDetails(res.data);
        setRequest(row.id > 0 ? row : fromList ? routeRequest : null);
        setInitialEvents(buildEventsFromScheduleDetails(res.data, requestId, nurseFallback));
      } catch {
        if (ac.signal.aborted) return;
        try {
          const res = await adminLongTermOpportunitiesApi.getById(requestId, {
            signal: ac.signal,
          });
          if (ac.signal.aborted) return;
          const row = normalizeLongTermOpportunityRow(res.data);
          setRequest(row.id > 0 ? row : fromList ? routeRequest : null);
          setInitialEvents([]);
        } catch {
          if (ac.signal.aborted) return;
          setRequest(fromList ? routeRequest : null);
          setInitialEvents(
            fromList && routeScheduleDetails
              ? buildEventsFromScheduleDetails(routeScheduleDetails, requestId, nurseFallback)
              : []
          );
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [requestId, routeRequest, routeScheduleDetails, nurseFallback]);

  const title = useMemo(() => {
    if (!request) return t("scheduleCalendar.titleFallback");
    const no = request.requestNo?.trim() || `SR-${request.id}`;
    const patient = request.patientName?.trim() || t("scheduleCalendar.unknownPatient");
    return t("scheduleCalendar.requestTitle", { no, name: patient });
  }, [request, t]);

  const subtitle = useMemo(() => {
    if (!request) return t("scheduleCalendar.subtitleDefault");
    const parts: string[] = [];
    if (request.startDate && request.endDate) {
      parts.push(`${fmtRangeDate(request.startDate)} - ${fmtRangeDate(request.endDate)}`);
    } else if (request.startDate) {
      parts.push(fmtRangeDate(request.startDate));
    } else if (request.endDate) {
      parts.push(fmtRangeDate(request.endDate));
    }
    if (request.timeRange?.trim()) {
      parts.push(`${t("scheduleCalendar.timePrefix")}: ${request.timeRange.trim()}`);
    }
    if (request.assignedNursesLabel?.trim()) {
      parts.push(`${t("scheduleCalendar.nursesPrefix")}: ${request.assignedNursesLabel.trim()}`);
    }
    return parts.join(" | ") || t("scheduleCalendar.subtitleDefault");
  }, [request, t, fmtRangeDate]);

  const handleScheduleDetailsSynced = useCallback(
    (raw: unknown) => {
      if (!requestId) return;
      const row = resolveOpportunityFromScheduleDetails(raw);
      if (row.id > 0) {
        setRequest((prev) => (prev ? { ...prev, ...row } : row));
      }
      setInitialEvents(buildEventsFromScheduleDetails(raw, requestId, nurseFallback));
    },
    [requestId, nurseFallback]
  );

  const requestStartDate = request?.startDate ?? new Date().toISOString();
  const requestEndDate =
    request?.endDate ??
    new Date(new Date(requestStartDate).getTime() + 24 * 60 * 60 * 1000).toISOString();

  if (loading) {
    return (
      <>
        <PageMeta title={t("scheduleCalendar.metaTitle")} description={t("schedule.pageTitle")} />
        <PageBreadcrumb pageTitle={t("scheduleCalendar.pageBreadcrumb")} />
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-gray-600 dark:text-gray-400">{t("scheduleCalendar.loading")}</p>
        </div>
      </>
    );
  }

  if (!requestId || !request) {
    return (
      <>
        <PageMeta title={t("scheduleCalendar.metaNotFoundTitle")} description={t("schedule.pageTitle")} />
        <PageBreadcrumb pageTitle={t("scheduleCalendar.pageBreadcrumb")} />
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-gray-600 dark:text-gray-400">{t("scheduleCalendar.notFound")}</p>
          <Link
            to="/schedule"
            className="mt-4 inline-flex text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            {t("scheduleCalendar.backToList")}
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title={t("scheduleCalendar.metaTitleWithNo", {
          requestNo: request.requestNo ?? `SR-${request.id}`,
        })}
        description={t("scheduleCalendar.metaDescriptionPatient", {
          name: request.patientName?.trim() || t("schedule.patient"),
        })}
      />
      <PageBreadcrumb pageTitle={t("scheduleCalendar.pageBreadcrumb")} />
      <div className="mb-4">
        <Link
          to="/schedule"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          <span aria-hidden>←</span> {t("scheduleCalendar.allRequests")}
        </Link>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
        <ScheduleCalendar
          requestId={String(request.id)}
          title={title}
          subtitle={subtitle}
          requestStartDate={requestStartDate}
          requestEndDate={requestEndDate}
          baseServiceAmount={request.amount}
          consultationTypeId={request.consultationTypeId}
          supervisorName={request.supervisorName}
          defaultShiftDurationHours={request.shiftDurationHours}
          defaultPreferredStartTime={request.preferredStartTime}
          requestStatus={request.status}
          initialEvents={initialEvents}
          onScheduleDetailsSynced={handleScheduleDetailsSynced}
        />
      </div>
    </>
  );
}
