import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { ActionsMenu } from "../components/common/ActionsMenu";
import { DropdownItem } from "../components/ui/dropdown/DropdownItem";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { CalenderIcon } from "../icons";
import {
  formatRequestWindow,
  getAssignedNurseNames,
  getServiceRequests,
} from "../data/nurseScheduleSeed";

export default function NurseScheduleList() {
  const navigate = useNavigate();
  const requests = getServiceRequests();
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement>(null);

  const goToCalendar = (requestId: string) => {
    setOpenActionsId(null);
    navigate(`/schedule/${requestId}`);
  };

  return (
    <>
      <PageMeta
        title="Service Request Schedule | Hope - BMQAS"
        description="Service-request schedules (demo data) - Hope Pro"
      />
      <PageBreadcrumb pageTitle="Schedule" />
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border-gray-800">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
              <CalenderIcon className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Service request schedule</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Open a service request to view assigned nurse schedules. Data is placeholder until the API is connected.
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6 lg:py-6">
          <div className="space-y-3 md:hidden">
            {requests.map((request) => (
              <div
                key={request.id}
                className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/30"
              >
                <div className="flex items-start justify-between gap-2 border-b border-gray-200 pb-3 dark:border-gray-700">
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-white/90">{request.requestNo} - {request.patientName}</p>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{request.location}</p>
                  </div>
                  <ActionsMenu
                    isOpen={openActionsId === request.id}
                    onClose={() => setOpenActionsId(null)}
                    onButtonClick={() =>
                      setOpenActionsId(openActionsId === request.id ? null : request.id)
                    }
                    buttonRef={openActionsId === request.id ? actionsButtonRef : undefined}
                  >
                    <DropdownItem
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        goToCalendar(request.id);
                      }}
                      className="dark:hover:bg-gray-700 dark:text-gray-200"
                    >
                      View calendar
                    </DropdownItem>
                  </ActionsMenu>
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 dark:text-gray-400">Requested window</dt>
                    <dd className="text-gray-800 dark:text-gray-200">{formatRequestWindow(request)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 dark:text-gray-400">Assigned nurses</dt>
                    <dd className="text-right text-gray-800 dark:text-gray-200">{getAssignedNurseNames(request).join(", ")}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                <TableRow>
                  <TableCell
                    isHeader
                    className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    Service request
                  </TableCell>
                  <TableCell
                    isHeader
                    className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    Requested window
                  </TableCell>
                  <TableCell
                    isHeader
                    className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    Assigned nurses
                  </TableCell>
                  <TableCell
                    isHeader
                    className="w-[120px] py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="py-3 font-medium text-gray-800 dark:text-white/90">
                      {request.requestNo} - {request.patientName}
                    </TableCell>
                    <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                      {formatRequestWindow(request)}
                    </TableCell>
                    <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                      {getAssignedNurseNames(request).join(", ")}
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <ActionsMenu
                        isOpen={openActionsId === request.id}
                        onClose={() => setOpenActionsId(null)}
                        onButtonClick={() =>
                          setOpenActionsId(openActionsId === request.id ? null : request.id)
                        }
                        buttonRef={openActionsId === request.id ? actionsButtonRef : undefined}
                      >
                        <DropdownItem
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            goToCalendar(request.id);
                          }}
                          className="dark:hover:bg-gray-700 dark:text-gray-200"
                        >
                          View calendar
                        </DropdownItem>
                      </ActionsMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
}
