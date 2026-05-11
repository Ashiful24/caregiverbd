import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
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
import { Dropdown } from "../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../components/ui/dropdown/DropdownItem";
import ThemedSelect from "../components/form/ThemedSelect";
import { Modal } from "../components/ui/modal";
import { CheckLineIcon, CloseLineIcon, LockIcon } from "../icons";
import {
  usersListApi,
  userApi,
  adminUsersApi,
  type UserListItem,
  type UserListStatusFilter,
} from "../services/api";
import { formatAccountActiveLabel, formatDate } from "../utils/format";

/** Full user profile from GET /users/:id (may include extra fields from backend) */
interface UserProfileDetail extends UserListItem {
  [key: string]: unknown;
}

const LIMIT_OPTIONS = [10, 20, 50];
const SEARCH_DEBOUNCE_MS = 300;

/** Status tabs: All | Active | Deactivated */
const STATUS_TABS: { value: UserListStatusFilter }[] = [
  { value: "all" },
  { value: "active" },
  { value: "inactive" },
];

/** Role/type dropdown: All | Admin | Provider | Patient */
const ROLE_OPTIONS: { value: string }[] = [
  { value: "all" },
  { value: "ADMIN" },
  { value: "PROVIDER" },
  { value: "PATIENT" },
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
  const { t } = useTranslation();
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
  const [roleFilterOpen, setRoleFilterOpen] = useState(false);
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
  const roleFilterButtonRef = useRef<HTMLButtonElement | null>(null);

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
          : t("users.failedLoad");
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
  };

  const closeDeactivateConfirm = () => {
    setConfirmDeactivateUser(null);
  };

  const openActivateConfirm = (user: UserListItem) => {
    if (isUserActive(user)) return;
    setConfirmActivateUser(user);
  };

  const closeActivateConfirm = () => {
    setConfirmActivateUser(null);
  };

  const openPasswordChange = (user: UserListItem) => {
    setPasswordChangeUser(user);
    setPasswordNew("");
    setPasswordConfirm("");
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
    if (detailModalOpen && detailUserId === confirmDeactivateUser.id) {
      void loadUserDetail(confirmDeactivateUser.id);
    }
  };

  const handleConfirmActivate = async () => {
    if (!confirmActivateUser) return;
    setError("");
    await adminUsersApi.updateStatus(String(confirmActivateUser.id), { isActive: true });
    await fetchUsers();
    if (detailModalOpen && detailUserId === confirmActivateUser.id) {
      void loadUserDetail(confirmActivateUser.id);
    }
  };

  const handleSubmitPasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordChangeUser) return;
    const newP = passwordNew.trim();
    const conf = passwordConfirm.trim();
    if (newP.length < 6) {
      setError(t("users.passwordTooShort"));
      return;
    }
    if (newP !== conf) {
      setError(t("users.passwordMismatch"));
      return;
    }
    setError("");
    setPasswordChangeLoading(true);
    try {
      await adminUsersApi.updatePassword(String(passwordChangeUser.id), { newPassword: newP });
      closePasswordChange();
    } catch {
      setError(t("users.failedChangePassword"));
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
        title={t("users.metaTitle")}
        description={t("users.metaDescription")}
      />
      <PageBreadcrumb pageTitle={t("users.pageTitle")} />
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {t("users.heading")}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("users.subheading")}
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
                placeholder={t("users.searchUsers")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full min-w-[200px] rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500 sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* Status tabs (users only) + Type dropdown */}
        <div className="flex flex-col gap-4 border-b border-gray-200 px-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <nav
            className="-mb-px flex gap-4 overflow-x-auto pb-px sm:gap-8"
            aria-label={t("users.statusFilter")}
          >
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setStatusTab(tab.value);
                  setPage(1);
                }}
                className={`whitespace-nowrap border-b-2 py-4 text-sm font-medium transition-colors ${
                  statusTab === tab.value
                    ? "border-brand-500 text-brand-500 dark:border-brand-500 dark:text-brand-500"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300"
                }`}
              >
                {tab.value === "all"
                  ? t("users.all")
                  : tab.value === "active"
                  ? t("users.active")
                  : t("users.deactivated")}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 pb-4 sm:pb-0">
            <label htmlFor="user-type-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("users.typeLabel")}:
            </label>
            <div className="relative">
              <button
                id="user-type-filter"
                ref={roleFilterButtonRef}
                type="button"
                className="dropdown-toggle inline-flex min-w-32 items-center justify-between rounded-lg border border-brand-400 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-brand-600 dark:bg-gray-800 dark:text-gray-200"
                onClick={() => setRoleFilterOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={roleFilterOpen}
              >
                <span>
                  {roleFilter === "all"
                    ? t("users.all")
                    : roleFilter === "ADMIN"
                    ? t("users.admin")
                    : roleFilter === "PROVIDER"
                    ? t("users.provider")
                    : t("users.patient")}
                </span>
                <svg className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              <Dropdown
                isOpen={roleFilterOpen}
                onClose={() => setRoleFilterOpen(false)}
                anchorRef={roleFilterButtonRef}
                className="w-44 p-1"
              >
                {ROLE_OPTIONS.map((opt) => {
                  const isSelected = roleFilter === opt.value;
                  const label =
                    opt.value === "all"
                      ? t("users.all")
                      : opt.value === "ADMIN"
                      ? t("users.admin")
                      : opt.value === "PROVIDER"
                      ? t("users.provider")
                      : t("users.patient");
                  return (
                    <DropdownItem
                      key={opt.value}
                      onClick={() => {
                        setRoleFilter(opt.value);
                        setPage(1);
                        setRoleFilterOpen(false);
                      }}
                      className={`rounded-lg ${isSelected ? "bg-brand-500 text-white hover:bg-brand-600 hover:text-white dark:bg-brand-500 dark:text-white" : ""}`}
                    >
                      {label}
                    </DropdownItem>
                  );
                })}
              </Dropdown>
            </div>
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
              {statusTab === "all" && t("users.noUsersFound")}
              {statusTab === "active" && t("users.noActiveUsersFound")}
              {statusTab === "inactive" && t("users.noDeactivatedUsersFound")}
            </div>
          ) : (
            <>
              {/* Users: Mobile card list */}
              <div className="space-y-3 md:hidden">
                {users.map((user, index) => (
                  <div
                    key={user.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDetails(user.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openDetails(user.id);
                      }
                    }}
                    className="cursor-pointer rounded-xl border border-gray-200 bg-gray-50/50 p-4 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800/30 dark:hover:bg-white/[0.02]"
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
                          {formatAccountActiveLabel(isUserActive(user))}
                        </Badge>
                        <button
                          type="button"
                          title={t("users.changePassword")}
                          aria-label={t("users.changePassword")}
                          onClick={(e) => {
                            e.stopPropagation();
                            openPasswordChange(user);
                          }}
                          className="rounded-md border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          <LockIcon className="size-4" />
                        </button>
                        <button
                          type="button"
                          title={isUserActive(user) ? t("users.deactivateUser") : t("users.activateUser")}
                          aria-label={isUserActive(user) ? t("users.deactivateUser") : t("users.activateUser")}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleUserActive(user);
                          }}
                          className="rounded-md border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          {isUserActive(user) ? (
                            <CloseLineIcon className="size-4" />
                          ) : (
                            <CheckLineIcon className="size-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">#</dt>
                        <dd className="text-gray-800 dark:text-gray-200">{(page - 1) * limit + index + 1}</dd>
                      </div>
                      {user.role === "PROVIDER" && (
                        <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">{t("users.consultationType")}</dt>
                          <dd className="text-gray-800 dark:text-gray-200">{user.consultationTypeName ?? "—"}</dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">{t("users.email")}</dt>
                        <dd className="truncate text-right text-gray-800 dark:text-gray-200">{user.email ?? "—"}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">{t("users.usernameOrMobile")}</dt>
                        <dd className="truncate text-right text-gray-800 dark:text-gray-200">{user.username}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-gray-500 dark:text-gray-400">{t("users.created")}</dt>
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
                        {t("users.name")}
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[18%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        {t("users.email")}
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[18%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        {t("users.usernameOrMobile")}
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[10%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        {t("users.role")}
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[14%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        {t("users.consultationType")}
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[10%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        {t("users.status")}
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[10%] py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        {t("users.created")}
                      </TableCell>
                      <TableCell
                        isHeader
                        className="w-[10%] py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                      >
                        {t("users.actions")}
                      </TableCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {users.map((user, index) => (
                      <TableRow
                        key={user.id}
                        onClick={() => openDetails(user.id)}
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                      >
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
                            {formatAccountActiveLabel(isUserActive(user))}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-theme-sm text-gray-600 dark:text-gray-400">
                          {formatDate(user.createdAt)}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title={t("users.changePassword")}
                              aria-label={t("users.changePassword")}
                              onClick={(e) => {
                                e.stopPropagation();
                                openPasswordChange(user);
                              }}
                              className="rounded-md border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                              <LockIcon className="size-4" />
                            </button>
                            <button
                              type="button"
                              title={isUserActive(user) ? t("users.deactivateUser") : t("users.activateUser")}
                              aria-label={isUserActive(user) ? t("users.deactivateUser") : t("users.activateUser")}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleUserActive(user);
                              }}
                              className="rounded-md border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                              {isUserActive(user) ? (
                                <CloseLineIcon className="size-4" />
                              ) : (
                                <CheckLineIcon className="size-4" />
                              )}
                            </button>
                          </div>
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
                {t("pagination.rowsPerPage")}
                <ThemedSelect
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
                </ThemedSelect>
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t("pagination.showingRangeOf", {
                  from,
                  to,
                  total,
                  entity: t("users.usersEntity"),
                })}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                {t("common.actions.previous")}
              </button>
              <span className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                {t("pagination.pageOf", { page, totalPages })}
              </span>
              <button
                type="button"
                className="min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                {t("common.actions.next")}
              </button>
            </div>
          </div>
        )}
      </div>

      <DetailModal
        title={t("users.userDetails")}
        isOpen={detailModalOpen}
        onClose={closeDetailModal}
        loading={detailLoading}
        errorMessage={!detailLoading && !detailData ? t("users.couldNotLoadDetails") : null}
        className="max-w-lg p-6 sm:p-8"
      >
        {detailData && (
          <div className="space-y-3">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="font-medium text-gray-500 dark:text-gray-400">{t("users.id")}</dt>
              <dd className="text-gray-800 dark:text-gray-200">{detailData.id}</dd>
              <dt className="font-medium text-gray-500 dark:text-gray-400">{t("users.firstName")}</dt>
              <dd className="text-gray-800 dark:text-gray-200">{detailData.firstName ?? "—"}</dd>
              <dt className="font-medium text-gray-500 dark:text-gray-400">{t("users.lastName")}</dt>
              <dd className="text-gray-800 dark:text-gray-200">{detailData.lastName ?? "—"}</dd>
              <dt className="font-medium text-gray-500 dark:text-gray-400">{t("users.email")}</dt>
              <dd className="text-gray-800 dark:text-gray-200">{detailData.email ?? "—"}</dd>
              <dt className="font-medium text-gray-500 dark:text-gray-400">{t("users.usernameOrMobile")}</dt>
              <dd className="text-gray-800 dark:text-gray-200">{detailData.username ?? "—"}</dd>
              <dt className="font-medium text-gray-500 dark:text-gray-400">{t("users.role")}</dt>
              <dd className="text-gray-800 dark:text-gray-200">{detailData.role ?? "—"}</dd>
              <dt className="font-medium text-gray-500 dark:text-gray-400">{t("users.status")}</dt>
              <dd className="text-gray-800 dark:text-gray-200">
                <Badge size="sm" color={detailData.isActive !== false ? "success" : "error"}>
                  {formatAccountActiveLabel(detailData.isActive !== false)}
                </Badge>
              </dd>
              <dt className="font-medium text-gray-500 dark:text-gray-400">{t("users.created")}</dt>
              <dd className="text-gray-800 dark:text-gray-200">{formatDate(detailData.createdAt)}</dd>
              {detailData.updatedAt && (
                <>
                  <dt className="font-medium text-gray-500 dark:text-gray-400">{t("users.updated")}</dt>
                  <dd className="text-gray-800 dark:text-gray-200">{formatDate(detailData.updatedAt)}</dd>
                </>
              )}
            </dl>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
              <button
                type="button"
                onClick={() => openPasswordChange(detailData)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {t("users.changePassword")}
              </button>
              <button
                type="button"
                onClick={() => toggleUserActive(detailData)}
                className={`rounded-lg px-3 py-2 text-sm font-medium text-white ${
                  isUserActive(detailData)
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-brand-600 hover:bg-brand-700"
                }`}
              >
                {isUserActive(detailData) ? t("users.deactivateUser") : t("users.activateUser")}
              </button>
            </div>
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
          {t("users.changePassword")}
        </h3>
        {passwordChangeUser && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("users.setNewPasswordFor")}{" "}
            <span className="font-medium text-gray-800 dark:text-white/90">
              {passwordChangeUser.firstName} {passwordChangeUser.lastName}
            </span>
            .
          </p>
        )}
        <form onSubmit={handleSubmitPasswordChange} className="mt-4 space-y-4">
          <div>
            <label htmlFor="password-new" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("users.newPassword")}
            </label>
            <input
              id="password-new"
              type="password"
              value={passwordNew}
              onChange={(e) => setPasswordNew(e.target.value)}
              placeholder={t("users.atLeastSixChars")}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              autoComplete="new-password"
              minLength={6}
            />
          </div>
          <div>
            <label htmlFor="password-confirm" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("users.confirmNewPassword")}
            </label>
            <input
              id="password-confirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder={t("users.reenterNewPassword")}
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
              {t("common.actions.cancel")}
            </button>
            <button
              type="submit"
              disabled={passwordChangeLoading}
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              {passwordChangeLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t("users.changing")}
                </span>
              ) : (
                t("users.changePassword")
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Global confirmation modal for deactivate */}
      <ConfirmModal
        isOpen={!!confirmDeactivateUser}
        onClose={closeDeactivateConfirm}
        title={t("users.deactivateTitle")}
        message={
          confirmDeactivateUser ? (
            <>
              {t("users.deactivateConfirmPrefix")}{" "}
              <span className="font-medium text-gray-800 dark:text-white/90">
                {confirmDeactivateUser.firstName} {confirmDeactivateUser.lastName}
              </span>
              ? {t("users.deactivateConfirmSuffix")}
            </>
          ) : (
            ""
          )
        }
        confirmLabel={t("users.deactivate")}
        cancelLabel={t("common.actions.cancel")}
        confirmVariant="danger"
        onConfirm={handleConfirmDeactivate}
        onError={() => setError(t("users.failedDeactivate"))}
      />

      {/* Global confirmation modal for activate */}
      <ConfirmModal
        isOpen={!!confirmActivateUser}
        onClose={closeActivateConfirm}
        title={t("users.activateTitle")}
        message={
          confirmActivateUser ? (
            <>
              {t("users.activateConfirmPrefix")}{" "}
              <span className="font-medium text-gray-800 dark:text-white/90">
                {confirmActivateUser.firstName} {confirmActivateUser.lastName}
              </span>
              ? {t("users.activateConfirmSuffix")}
            </>
          ) : (
            ""
          )
        }
        confirmLabel={t("users.activate")}
        cancelLabel={t("common.actions.cancel")}
        confirmVariant="primary"
        onConfirm={handleConfirmActivate}
        onError={() => setError(t("users.failedActivate"))}
      />
    </>
  );
}
