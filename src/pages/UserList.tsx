import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import { ActionsMenu } from "../components/common/ActionsMenu";
import { DetailModal } from "../components/common/DetailModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import Badge from "../components/ui/badge/Badge";
import { ConfirmModal } from "../components/ui/confirm-modal";
import { DropdownItem } from "../components/ui/dropdown/DropdownItem";
import { Modal } from "../components/ui/modal";
import {
  usersListApi,
  userApi,
  adminUsersApi,
  type UserListItem,
  type UserListStatusFilter,
} from "../services/api";
import { formatDate } from "../utils/format";

/** Full user profile from GET /users/:id (may include extra fields from backend) */
interface UserProfileDetail extends UserListItem {
  [key: string]: unknown;
}

const LIMIT_OPTIONS = [10, 20, 50];
const SEARCH_DEBOUNCE_MS = 300;

/** Status tabs: All | Active | Deactivated */
const STATUS_TABS: { value: UserListStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Deactivated" },
];

/** Role/type dropdown: All | Admin | Provider | Patient */
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ADMIN", label: "Admin" },
  { value: "PROVIDER", label: "Provider" },
  { value: "PATIENT", label: "Patient" },
];

function roleBadgeColor(role: string) {
  switch (role?.toUpperCase()) {
    case "ADMIN":
      return "error";
    case "PROVIDER":
      return "warning";
    case "PATIENT":
      return "success";
    default:
      return "warning";
  }
}

/** User is active when isActive or is_active (API snake_case) is explicitly true */
function isUserActive(user: UserListItem): boolean {
  return user.isActive === true || user.is_active === true;
}

export default function UserList() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState<UserListStatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [openActionsId, setOpenActionsId] = useState<number | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailUserId, setDetailUserId] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<UserProfileDetail | null>(null);
  const [confirmDeactivateUser, setConfirmDeactivateUser] = useState<UserListItem | null>(null);
  const [confirmActivateUser, setConfirmActivateUser] = useState<UserListItem | null>(null);
  const [passwordChangeUser, setPasswordChangeUser] = useState<UserListItem | null>(null);
  const [passwordNew, setPasswordNew] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null);

  // Debounce search: update searchQuery (and reset to page 1) after user stops typing
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchUsers = async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    let aborted = false;
    try {
      const roleParam = roleFilter === "all" ? undefined : roleFilter;
      const response = await usersListApi.getList(
        {
          page,
          limit,
          search: searchQuery || undefined,
          status: statusTab === "all" ? undefined : statusTab,
          role: roleParam,
        },
        { signal }
      );
      const payload = response.data as { users?: UserListItem[]; total?: number; page?: number; limit?: number } | null;
      const list = payload?.users ?? [];
      const limitVal = payload?.limit ?? limit;
      const filtered =
        roleParam && Array.isArray(list)
          ? list.filter((u) => u.role?.toUpperCase() === roleParam)
          : list;
      const backendFilteredByRole = !roleParam || filtered.length === list.length;
      const displayList = backendFilteredByRole ? list : filtered;
      const totalCount = backendFilteredByRole ? (payload?.total ?? 0) : filtered.length;
      const displayPages = limitVal > 0 ? Math.ceil(totalCount / limitVal) || 1 : 1;
      setUsers(Array.isArray(displayList) ? displayList : []);
      setTotal(totalCount);
      setTotalPages(displayPages);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        aborted = true;
        return;
      }
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to load users.";
      setError(message);
      setUsers([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      if (!aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchUsers(controller.signal);
    return () => controller.abort();
  }, [page, limit, searchQuery, statusTab, roleFilter]);

  // Fetch full user details when detail modal is opened
  const loadUserDetail = useCallback(async (userId: number) => {
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await userApi.getProfile(String(userId));
      const data = (res?.data ?? res) as UserProfileDetail | null;
      setDetailData(data);
    } catch {
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (detailModalOpen && detailUserId != null) {
      loadUserDetail(detailUserId);
    } else {
      setDetailData(null);
    }
  }, [detailModalOpen, detailUserId, loadUserDetail]);

  const openDetails = (userId: number) => {
    setOpenActionsId(null);
    setDetailUserId(userId);
    setDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setDetailUserId(null);
    setDetailData(null);
  };

  const openDeactivateConfirm = (user: UserListItem) => {
    if (!isUserActive(user)) return;
    setConfirmDeactivateUser(user);
    setOpenActionsId(null);
  };

  const closeDeactivateConfirm = () => {
    setConfirmDeactivateUser(null);
  };

  const openActivateConfirm = (user: UserListItem) => {
    if (isUserActive(user)) return;
    setConfirmActivateUser(user);
    setOpenActionsId(null);
  };

  const closeActivateConfirm = () => {
    setConfirmActivateUser(null);
  };

  const openPasswordChange = (user: UserListItem) => {
    setPasswordChangeUser(user);
    setPasswordNew("");
    setPasswordConfirm("");
    setOpenActionsId(null);
  };

  const closePasswordChange = () => {
    setPasswordChangeUser(null);
    setPasswordNew("");
    setPasswordConfirm("");
  };

  const handleConfirmDeactivate = async () => {
    if (!confirmDeactivateUser) return;
    setError("");
    await adminUsersApi.updateStatus(String(confirmDeactivateUser.id), { isActive: false });
    await fetchUsers();
  };

  const handleConfirmActivate = async () => {
    if (!confirmActivateUser) return;
    setError("");
    await adminUsersApi.updateStatus(String(confirmActivateUser.id), { isActive: true });
    await fetchUsers();
  };

  const handleSubmitPasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordChangeUser) return;
    const newP = passwordNew.trim();
    const conf = passwordConfirm.trim();
    if (newP.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newP !== conf) {
      setError("New password and confirmation do not match.");
      return;
    }
    setError("");
    setPasswordChangeLoading(true);
    try {
      await adminUsersApi.updatePassword(String(passwordChangeUser.id), { newPassword: newP });
      closePasswordChange();
    } catch {
      setError("Failed to change password.");
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  const toggleUserActive = (user: UserListItem) => {
    if (isUserActive(user)) {
      openDeactivateConfirm(user);
    } else {
      openActivateConfirm(user);
    }
  };

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <>
      <PageMeta
        title="All Users | Hope - BMQAS"
        description="Admin view of all users for Hope Pro by BMQAS"
      />
      <PageBreadcrumb pageTitle="All Users" />
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              All Users
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Admin view of all users (Admin, Provider, Patient) with server-side pagination
            </p>
          </div>
          <div className="flex shrink-0 sm:ml-auto">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="search"
                placeholder="Search users..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full min-w-[200px] rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500 sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* Status tabs (users only) + Type dropdown */}
        <div className="flex flex-col gap-4 border-b border-gray-200 px-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <nav className="-mb-px flex gap-6 sm:gap-8" aria-label="Status filter">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setStatusTab(t.value);
                  setPage(1);
                }}
                className={`whitespace-nowrap border-b-2 py-4 text-sm font-medium transition-colors ${
                  statusTab === t.value
                    ? "border-brand-500 text-brand-500 dark:border-brand-500 dark:text-brand-500"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 pb-4 sm:pb-0">
            <label htmlFor="user-type-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Type:
            </label>
            <select
              id="user-type-filter"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mx-4 mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 sm:mx-6">
            {error}
          </div>
        )}

        <div className="px-4 sm:px-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-gray-500 dark:text-gray-400">
              {statusTab === "all" && "No users found."}
              {statusTab === "active" && "No active users found."}
              {statusTab === "inactive" && "No deactivated users found."}
            </div>
          ) : (
            <>
              {/* Users: Mobile card list */}
              <div className="space-y-3 md:hidden">
                {users.map((user, index) => (
                  <div
                    key={user.id}
                    className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-800/30"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-200 pb-3 dark:border-gray-700">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                        {user.firstName} {user.lastName}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge size="sm" color={roleBadgeColor(user.role)}>
                          {user.role}
                        </Badge>
                        <Badge
                          size="sm"
                          color={isUserActive(user) ? "success" : "error"}
                        >
                          {isUserActive(user) ? "Active" : "Inactive"}
                        </Badge>
                        <ActionsMenu
                          isOpen={openActionsId === user.id}
                          onClose={() => setOpenActionsId(null)}
                          onButtonClick={() => setOpenActionsId(openActionsId === user.id ? null : user.id)}
                          buttonRef={openActionsId === user.id ? actionsButtonRef : undefined}
                          buttonClassName="dropdown-toggle inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                          dropdownClassName="min-w-[160px] py-1 right-0 left-auto"
                        >
                          <DropdownItem
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openDetails(user.id);
                            }}
                            className="dark:hover:bg-gray-700 dark:text-gray-200"
                          >
                            View full details
                          </DropdownItem>
                          <DropdownItem
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openPasswordChange(user);
                            }}
                            className="dark:hover:bg-gray-700 dark:text-gray-200"
                          >
                            Change password
                          </DropdownItem>
                          <DropdownItem
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (isUserActive(user)) {
                                openDeactivateConfirm(user);
                              } else {
                                toggleUserActive(user);
                              }
                            }}
                            className="dark:hover:bg-gray-700 dark:text-gray-200"
                          >
                            {isUserActive(user)
                              ? "Deactivate user"
                              : "Activate user"}
                          </DropdownItem>
                        </ActionsMenu>
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">#</dt>
                        <dd className="text-gray-800 dark:text-gray-200">{(page - 1) * limit + index + 1}</dd>
                      </div>
                      {user.role === "PROVIDER" && (
                        <div className="flex justify-between gap-2">
                          <dt className="text-gray-500 dark:text-gray-400">Consultation type</dt>
                          <dd className="text-gray-800 dark:text-gray-200">{user.consultationTypeName ?? "—"}</dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">Email</dt>
                        <dd className="truncate text-right text-gray-800 dark:text-gray-200">{user.email ?? "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">Username / Mobile</dt>
                        <dd className="truncate text-right text-gray-800 dark:text-gray-200">{user.username}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">Created</dt>
                        <dd className="text-gray-800 dark:text-gray-200">{formatDate(user.createdAt)}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>

              {/* Desktop: table (scrollable on small tablets if needed) */}
              <div className="hidden overflow-x-auto md:block" style={{ WebkitOverflowScrolling: "touch" }}>
                <Table>
                  <TableHeader className="border-b border-gray-200 dark:border-gray-800">
                    <TableRow>
                      <TableCell
                        isHeader
                        className="w-[5%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        #
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[16%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Name
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[18%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Email
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[18%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Username / Mobile
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[10%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Role
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[14%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Consultation type
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[10%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Status
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[10%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Created
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[8%] py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {users.map((user, index) => (
                      <TableRow key={user.id}>
                        <TableCell className="py-3 text-theme-sm text-gray-700 dark:text-gray-300">
                          {(page - 1) * limit + index + 1}
                        </TableCell>
                        <TableCell className="py-3 font-medium text-gray-800 dark:text-white/90">
                          {user.firstName} {user.lastName}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {user.email ?? "—"}
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {user.username}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge size="sm" color={roleBadgeColor(user.role)}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {user.role === "PROVIDER" && user.consultationTypeName
                            ? user.consultationTypeName
                            : "—"}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            size="sm"
                            color={isUserActive(user) ? "success" : "error"}
                          >
                            {isUserActive(user) ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {formatDate(user.createdAt)}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <ActionsMenu
                            isOpen={openActionsId === user.id}
                            onClose={() => setOpenActionsId(null)}
                            onButtonClick={() => setOpenActionsId(openActionsId === user.id ? null : user.id)}
                            buttonRef={openActionsId === user.id ? actionsButtonRef : undefined}
                          >
                            <DropdownItem
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openDetails(user.id);
                              }}
                              className="dark:hover:bg-gray-700 dark:text-gray-200"
                            >
                              View full details
                            </DropdownItem>
                            <DropdownItem
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openPasswordChange(user);
                              }}
                              className="dark:hover:bg-gray-700 dark:text-gray-200"
                            >
                              Change password
                            </DropdownItem>
                            <DropdownItem
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (isUserActive(user)) {
                                  openDeactivateConfirm(user);
                                } else {
                                  toggleUserActive(user);
                                }
                              }}
                              className="dark:hover:bg-gray-700 dark:text-gray-200"
                            >
                              {isUserActive(user)
                                ? "Deactivate user"
                                : "Activate user"}
                            </DropdownItem>
                          </ActionsMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        {!loading && users.length > 0 && totalPages > 0 && (
          <div className="flex flex-col gap-4 border-t border-gray-200 px-4 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                Rows per page
                <select
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  {LIMIT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing <span className="font-medium">{from}</span> to{" "}
                <span className="font-medium">{to}</span> of{" "}
                <span className="font-medium">{total}</span> users
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <DetailModal
        title="User details"
        isOpen={detailModalOpen}
        onClose={closeDetailModal}
        loading={detailLoading}
        errorMessage={!detailLoading && !detailData ? "Could not load user details." : null}
        className="max-w-lg p-6 sm:p-8"
      >
        {detailData && (
          <div className="space-y-3">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="font-medium text-gray-500 dark:text-gray-400">ID</dt>
              <dd className="text-gray-800 dark:text-gray-200">{detailData.id}</dd>
              <dt className="font-medium text-gray-500 dark:text-gray-400">First name</dt>
              <dd className="text-gray-800 dark:text-gray-200">{detailData.firstName ?? "—"}</dd>
              <dt className="font-medium text-gray-500 dark:text-gray-400">Last name</dt>
              <dd className="text-gray-800 dark:text-gray-200">{detailData.lastName ?? "—"}</dd>
              <dt className="font-medium text-gray-500 dark:text-gray-400">Email</dt>
              <dd className="text-gray-800 dark:text-gray-200">{detailData.email ?? "—"}</dd>
              <dt className="font-medium text-gray-500 dark:text-gray-400">Username / Mobile</dt>
              <dd className="text-gray-800 dark:text-gray-200">{detailData.username ?? "—"}</dd>
              <dt className="font-medium text-gray-500 dark:text-gray-400">Role</dt>
              <dd className="text-gray-800 dark:text-gray-200">{detailData.role ?? "—"}</dd>
              <dt className="font-medium text-gray-500 dark:text-gray-400">Status</dt>
              <dd className="text-gray-800 dark:text-gray-200">
                <Badge size="sm" color={detailData.isActive !== false ? "success" : "error"}>
                  {detailData.isActive !== false ? "Active" : "Inactive"}
                </Badge>
              </dd>
              <dt className="font-medium text-gray-500 dark:text-gray-400">Created</dt>
              <dd className="text-gray-800 dark:text-gray-200">{formatDate(detailData.createdAt)}</dd>
              {detailData.updatedAt && (
                <>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">Updated</dt>
                  <dd className="text-gray-800 dark:text-gray-200">{formatDate(detailData.updatedAt)}</dd>
                </>
              )}
            </dl>
          </div>
        )}
      </DetailModal>

      {/* Change password modal */}
      <Modal
        isOpen={!!passwordChangeUser}
        onClose={closePasswordChange}
        className="max-w-md p-6 sm:p-8"
      >
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          Change password
        </h3>
        {passwordChangeUser && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Set a new password for{" "}
            <span className="font-medium text-gray-800 dark:text-white/90">
              {passwordChangeUser.firstName} {passwordChangeUser.lastName}
            </span>
            .
          </p>
        )}
        <form onSubmit={handleSubmitPasswordChange} className="mt-4 space-y-4">
          <div>
            <label htmlFor="password-new" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              New password
            </label>
            <input
              id="password-new"
              type="password"
              value={passwordNew}
              onChange={(e) => setPasswordNew(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              autoComplete="new-password"
              minLength={6}
            />
          </div>
          <div>
            <label htmlFor="password-confirm" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Confirm new password
            </label>
            <input
              id="password-confirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              autoComplete="new-password"
              minLength={6}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closePasswordChange}
              disabled={passwordChangeLoading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={passwordChangeLoading}
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              {passwordChangeLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Changing…
                </span>
              ) : (
                "Change password"
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Global confirmation modal for deactivate */}
      <ConfirmModal
        isOpen={!!confirmDeactivateUser}
        onClose={closeDeactivateConfirm}
        title="Deactivate user"
        message={
          confirmDeactivateUser ? (
            <>
              Are you sure you want to deactivate{" "}
              <span className="font-medium text-gray-800 dark:text-white/90">
                {confirmDeactivateUser.firstName} {confirmDeactivateUser.lastName}
              </span>
              ? They will not be able to sign in until activated again.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={handleConfirmDeactivate}
        onError={() => setError("Failed to deactivate user.")}
      />

      {/* Global confirmation modal for activate */}
      <ConfirmModal
        isOpen={!!confirmActivateUser}
        onClose={closeActivateConfirm}
        title="Activate user"
        message={
          confirmActivateUser ? (
            <>
              Are you sure you want to activate{" "}
              <span className="font-medium text-gray-800 dark:text-white/90">
                {confirmActivateUser.firstName} {confirmActivateUser.lastName}
              </span>
              ? They will be able to sign in again.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Activate"
        cancelLabel="Cancel"
        confirmVariant="primary"
        onConfirm={handleConfirmActivate}
        onError={() => setError("Failed to activate user.")}
      />
    </>
  );
}
