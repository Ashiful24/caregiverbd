import { useCallback, useEffect, useRef, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { ActionsMenu } from "../components/common/ActionsMenu";
import { DropdownItem } from "../components/ui/dropdown/DropdownItem";
import { SupervisorAssignNursesModal } from "../components/supervisors/SupervisorAssignNursesModal";
import { SupervisorCreateModal } from "../components/supervisors/SupervisorCreateModal";
import { SupervisorViewModal } from "../components/supervisors/SupervisorViewModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { PlusIcon, TaskIcon } from "../icons";
import type { SupervisorFullDetails } from "../data/supervisorSeed";
import {
  adminSupervisorsApi,
  normalizeAdminSupervisorsResponse,
  normalizeUserByIdResponse,
  userApi,
  type AdminSupervisorDto,
  type UserByIdDto,
} from "../services/api";

function mapAdminSupervisorDtoToFull(d: AdminSupervisorDto): SupervisorFullDetails {
  const first = d.firstName?.trim() ?? "";
  const last = d.lastName?.trim() ?? "";
  const name = [first, last].filter(Boolean).join(" ") || d.email?.trim() || "—";
  const rawDate = d.joinedAt?.trim() || d.createdAt?.trim() || "";
  const joinedDay =
    rawDate.length >= 10 ? rawDate.slice(0, 10) : new Date().toISOString().slice(0, 10);

  let status: SupervisorFullDetails["status"] = "ACTIVE";
  const st = (d.status ?? "").toUpperCase().replace(/\s+/g, "_");
  if (st === "ON_LEAVE") status = "ON_LEAVE";
  else if (st === "INACTIVE" || d.isActive === false) status = "INACTIVE";
  else if (st === "ACTIVE" || d.isActive === true) status = "ACTIVE";

  return {
    id: String(d.id),
    userId: d.userId ?? d.id,
    username: d.username,
    firstName: first,
    lastName: last,
    name,
    email: d.email ?? "",
    phone: d.phone != null && String(d.phone).trim() ? String(d.phone).trim() : "—",
    region: d.region?.trim() || "—",
    status,
    joinedAt: joinedDay,
    teamSize: d.teamSize ?? 0,
    dateOfBirth: "",
    gender: "",
    designation: "Supervisor",
    department: "",
    yearsOfExperience: 0,
    addressLine: "",
    city: "",
    areaLocation: "",
    nationalId: "",
    emergencyContact: "",
    notes: "",
  };
}

function formatJoinedDate(iso: string): string {
  if (!iso?.trim()) return "—";
  const d = parseISO(iso.length >= 10 ? iso.slice(0, 10) : iso);
  return isValid(d) ? format(d, "d MMM yyyy") : "—";
}

/** Merge GET /users/:id into list row for view / richer display. */
function mergeUserByIdIntoSupervisor(
  listRow: SupervisorFullDetails,
  u: UserByIdDto
): SupervisorFullDetails {
  const first =
    (typeof u.firstName === "string" && u.firstName.trim()) ||
    (typeof u.first_name === "string" && u.first_name.trim()) ||
    listRow.firstName ||
    "";
  const last =
    (typeof u.lastName === "string" && u.lastName.trim()) ||
    (typeof u.last_name === "string" && u.last_name.trim()) ||
    listRow.lastName ||
    "";
  const name = [first, last].filter(Boolean).join(" ") || listRow.name;
  const phoneRaw =
    (u.phone != null && String(u.phone).trim()) ||
    (u.mobileNumber != null && String(u.mobileNumber).trim()) ||
    listRow.phone;

  let status = listRow.status;
  if (u.isActive === false) status = "INACTIVE";
  else if (u.isActive === true) status = "ACTIVE";

  const joined =
    u.createdAt && u.createdAt.length >= 10 ? u.createdAt.slice(0, 10) : listRow.joinedAt;

  return {
    ...listRow,
    id: u.id != null ? String(u.id) : listRow.id,
    userId: typeof u.id === "number" ? u.id : listRow.userId,
    username: u.username ?? listRow.username,
    firstName: first,
    lastName: last,
    name,
    email: u.email ?? listRow.email,
    phone: phoneRaw || "—",
    joinedAt: joined,
    status,
  };
}

function statusBadge(status: SupervisorFullDetails["status"]) {
  const map = {
    ACTIVE: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    ON_LEAVE: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    INACTIVE: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  };
  const label = status.replace("_", " ");
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status]}`}>
      {label}
    </span>
  );
}

export default function SupervisorList() {
  const [supervisors, setSupervisors] = useState<SupervisorFullDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editTarget, setEditTarget] = useState<SupervisorFullDetails | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState<SupervisorFullDetails | null>(null);
  const [viewDetailLoading, setViewDetailLoading] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<SupervisorFullDetails | null>(null);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement>(null);

  const fetchSupervisors = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await adminSupervisorsApi.getAll();
      const rows = normalizeAdminSupervisorsResponse(res.data);
      setSupervisors(rows.map(mapAdminSupervisorDtoToFull));
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to load supervisors.";
      setLoadError(message);
      setSupervisors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSupervisors();
  }, [fetchSupervisors]);

  const openCreate = () => {
    setOpenActionsId(null);
    setFormMode("create");
    setEditTarget(null);
    setCreateOpen(true);
  };

  const openEdit = (s: SupervisorFullDetails) => {
    setOpenActionsId(null);
    setFormMode("edit");
    setEditTarget(s);
    setCreateOpen(true);
  };

  const openView = async (s: SupervisorFullDetails) => {
    setOpenActionsId(null);
    setViewing(s);
    setViewOpen(true);
    if (s.userId == null) {
      setViewDetailLoading(false);
      return;
    }
    setViewDetailLoading(true);
    try {
      const res = await userApi.getProfile(String(s.userId));
      const u = normalizeUserByIdResponse(res.data);
      if (u) {
        setViewing(mergeUserByIdIntoSupervisor(s, u));
      }
    } catch {
      /* keep list row */
    } finally {
      setViewDetailLoading(false);
    }
  };

  const closeForm = () => {
    setCreateOpen(false);
    setEditTarget(null);
  };

  const closeView = () => {
    setViewOpen(false);
    setViewing(null);
    setViewDetailLoading(false);
  };

  const openAssign = (s: SupervisorFullDetails) => {
    setOpenActionsId(null);
    setAssignTarget(s);
    setAssignOpen(true);
  };

  const closeAssign = () => {
    setAssignOpen(false);
    setAssignTarget(null);
  };

  return (
    <>
      <PageMeta title="Supervisors | Hope - BMQAS" description="Supervisor directory" />
      <PageBreadcrumb pageTitle="Supervisors" />
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border-gray-800">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
              <TaskIcon className="size-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Supervisors</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Field and regional supervisors .
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            <PlusIcon className="size-4" />
            Create supervisor
          </button>
        </div>

        <div className="px-4 py-4 sm:px-6 lg:py-6">
          {loadError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {loadError}
            </div>
          )}
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading supervisors…</div>
          ) : null}
          {!loading && supervisors.length === 0 && !loadError ? (
            <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              No supervisors found.
            </div>
          ) : null}
          {!loading && supervisors.length > 0 ? (
            <>
          <div className="space-y-3 md:hidden">
            {supervisors.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800 dark:text-white/90">{s.name}</p>
                    <p className="mt-0.5 break-words text-sm text-gray-500 dark:text-gray-400">{s.email}</p>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    {statusBadge(s.status)}
                    <ActionsMenu
                      isOpen={openActionsId === s.id}
                      onClose={() => setOpenActionsId(null)}
                      onButtonClick={() =>
                        setOpenActionsId(openActionsId === s.id ? null : s.id)
                      }
                      buttonRef={openActionsId === s.id ? actionsButtonRef : undefined}
                    >
                      <DropdownItem
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openView(s);
                        }}
                        className="dark:hover:bg-gray-700 dark:text-gray-200"
                      >
                        View
                      </DropdownItem>
                      <DropdownItem
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openEdit(s);
                        }}
                        className="dark:hover:bg-gray-700 dark:text-gray-200"
                      >
                        Edit
                      </DropdownItem>
                      <DropdownItem
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openAssign(s);
                        }}
                        className="dark:hover:bg-gray-700 dark:text-gray-200"
                      >
                        Assign nurse
                      </DropdownItem>
                    </ActionsMenu>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-gray-500 dark:text-gray-400">Phone</dt>
                    <dd className="min-w-0 break-words text-right text-gray-800 dark:text-gray-200">{s.phone}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 dark:text-gray-400">Region</dt>
                    <dd className="text-gray-800 dark:text-gray-200">{s.region}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 dark:text-gray-400">Team size</dt>
                    <dd className="text-gray-800 dark:text-gray-200">{s.teamSize}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500 dark:text-gray-400">Joined</dt>
                    <dd className="text-gray-800 dark:text-gray-200">{formatJoinedDate(s.joinedAt)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[22%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[7%]" />
                <col className="w-[9%]" />
                <col className="w-[10%]" />
              </colgroup>
              <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                <TableRow>
                  <TableCell
                    isHeader
                    className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    Name
                  </TableCell>
                  <TableCell
                    isHeader
                    className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    Email
                  </TableCell>
                  <TableCell
                    isHeader
                    className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    Phone
                  </TableCell>
                  <TableCell
                    isHeader
                    className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    Region
                  </TableCell>
                  <TableCell
                    isHeader
                    className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    Status
                  </TableCell>
                  <TableCell
                    isHeader
                    className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    Team
                  </TableCell>
                  <TableCell
                    isHeader
                    className="py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                  >
                    Joined
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
                {supervisors.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="min-w-0 py-3 align-top font-medium text-gray-800 dark:text-white/90">
                      {s.name}
                    </TableCell>
                    <TableCell
                      className="min-w-0 py-3 align-top text-theme-sm text-gray-600 dark:text-gray-400"
                      title={s.email}
                    >
                      <span className="block break-words">{s.email}</span>
                    </TableCell>
                    <TableCell
                      className="min-w-0 py-3 align-top text-theme-sm text-gray-600 dark:text-gray-400"
                      title={s.phone}
                    >
                      <span className="block whitespace-nowrap">{s.phone}</span>
                    </TableCell>
                    <TableCell className="min-w-0 py-3 align-top text-theme-sm text-gray-600 dark:text-gray-400">
                      {s.region}
                    </TableCell>
                    <TableCell className="min-w-0 py-3 align-top">{statusBadge(s.status)}</TableCell>
                    <TableCell className="min-w-0 py-3 align-top text-theme-sm text-gray-600 dark:text-gray-400">
                      {s.teamSize}
                    </TableCell>
                    <TableCell className="min-w-0 py-3 align-top text-theme-sm text-gray-600 dark:text-gray-400">
                      {formatJoinedDate(s.joinedAt)}
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <ActionsMenu
                        isOpen={openActionsId === s.id}
                        onClose={() => setOpenActionsId(null)}
                        onButtonClick={() =>
                          setOpenActionsId(openActionsId === s.id ? null : s.id)
                        }
                        buttonRef={openActionsId === s.id ? actionsButtonRef : undefined}
                      >
                        <DropdownItem
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openView(s);
                          }}
                          className="dark:hover:bg-gray-700 dark:text-gray-200"
                        >
                          View
                        </DropdownItem>
                        <DropdownItem
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openEdit(s);
                          }}
                          className="dark:hover:bg-gray-700 dark:text-gray-200"
                        >
                          Edit
                        </DropdownItem>
                        <DropdownItem
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openAssign(s);
                          }}
                          className="dark:hover:bg-gray-700 dark:text-gray-200"
                        >
                          Assign nurse
                        </DropdownItem>
                      </ActionsMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
            </>
          ) : null}
        </div>
      </div>

      <SupervisorCreateModal
        isOpen={createOpen}
        onClose={closeForm}
        mode={formMode}
        editSupervisor={editTarget}
        onCreated={() => void fetchSupervisors()}
        onUpdated={() => void fetchSupervisors()}
      />

      <SupervisorViewModal
        isOpen={viewOpen}
        onClose={closeView}
        supervisor={viewing}
        profileLoading={viewDetailLoading}
      />

      <SupervisorAssignNursesModal
        isOpen={assignOpen}
        onClose={closeAssign}
        supervisor={assignTarget}
        onAssigned={() => void fetchSupervisors()}
      />
    </>
  );
}
