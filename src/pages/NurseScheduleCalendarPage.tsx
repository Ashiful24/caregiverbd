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

export default function NurseScheduleCalendarPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const location = useLocation();
  const routeRequest = (location.state as { request?: LongTermOpportunityListItem } | null)?.request;
  const [request, setRequest] = useState<LongTermOpportunityListItem | null>(routeRequest ?? null);
  const [loading, setLoading] = useState(!routeRequest && Boolean(requestId));

  useEffect(() => {
    if (!requestId) {
      setRequest(null);
      setLoading(false);
      return;
    }
    if (routeRequest && String(routeRequest.id) === requestId) {
      setRequest(routeRequest);
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    adminLongTermOpportunitiesApi
      .getById(requestId, { signal: ac.signal })
      .then((res) => {
        const row = normalizeLongTermOpportunityRow(res.data);
        setRequest(row.id > 0 ? row : null);
      })
      .catch(() => {
        setRequest(null);
      })
      .finally(() => {
        setLoading(false);
      });
    return () => ac.abort();
  }, [requestId, routeRequest]);

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
        />
      </div>
    </>
  );
}
