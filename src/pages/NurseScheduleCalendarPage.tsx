import { Link, useParams } from "react-router";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { ScheduleCalendar } from "../components/schedule/ScheduleCalendar";
import {
  formatRequestWindow,
  getAssignedNurseNames,
  getServiceRequestById,
} from "../data/nurseScheduleSeed";

export default function NurseScheduleCalendarPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const request = requestId ? getServiceRequestById(requestId) : undefined;

  if (!requestId || !request) {
    return (
      <>
        <PageMeta title="Schedule not found | Hope - BMQAS" description="Service request schedule" />
        <PageBreadcrumb pageTitle="Schedule" />
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-gray-600 dark:text-gray-400">
            This service request was not found in the demo list.
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

  const title = `${request.requestNo} - ${request.patientName}`;
  const subtitle = `${formatRequestWindow(request)} | Nurses: ${getAssignedNurseNames(request).join(", ")}`;

  return (
    <>
      <PageMeta
        title={`${request.requestNo} — Schedule | Hope - BMQAS`}
        description={`Schedule calendar for ${request.patientName}`}
      />
      <PageBreadcrumb pageTitle="Schedule" />
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
          requestId={request.id}
          title={title}
          subtitle={subtitle}
          requestStartDate={request.startDate}
          requestEndDate={request.endDate}
          requestedSlotHours={request.requestedSlotHours}
        />
      </div>
    </>
  );
}
