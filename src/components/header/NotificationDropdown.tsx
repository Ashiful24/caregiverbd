import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import {
  notificationsApi,
  type NotificationHistoryItem,
  type NotificationHistoryListResponse,
} from "../../services/api";
import { formatRelativeTime } from "../../utils/format";
import { requestPermissionAndRegister, canUsePushNotifications } from "../../services/fcm";

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [list, setList] = useState<NotificationHistoryItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [markAllLoading, setMarkAllLoading] = useState(false);
  const [pushPermission, setPushPermission] = useState<string>("default");
  const [enablePushLoading, setEnablePushLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) setPushPermission(Notification.permission);
  }, [isOpen]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.list({ page: 1, limit: 20, status: "ACTIVE" });
      const body = (res as { data?: NotificationHistoryListResponse })?.data ?? res;
      const payload = body as NotificationHistoryListResponse;
      setList(Array.isArray(payload?.data) ? payload.data : []);
      setUnreadCount(payload?.meta?.unreadCount ?? 0);
    } catch {
      setList([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen, fetchNotifications]);

  const handleItemClick = useCallback(
    async (item: NotificationHistoryItem) => {
      if (item.readAt) return;
      setMarkingId(item.id);
      try {
        await notificationsApi.markAsRead(item.id);
        setList((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } finally {
        setMarkingId(null);
      }
    },
    []
  );

  const handleMarkAllRead = useCallback(async () => {
    setMarkAllLoading(true);
    try {
      await notificationsApi.markAllAsRead();
      setList((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnreadCount(0);
    } finally {
      setMarkAllLoading(false);
    }
  }, []);

  const hasUnread = unreadCount > 0;
  const showEnablePush =
    pushPermission === "default" && canUsePushNotifications();

  const handleEnablePush = useCallback(() => {
    setEnablePushLoading(true);
    requestPermissionAndRegister({
      onForegroundMessage: (payload) => {
        if (payload?.title && "Notification" in window && Notification.permission === "granted") {
          try {
            new Notification(String(payload.title), {
              body: payload?.body ? String(payload.body) : undefined,
              icon: "/favicon.png",
            });
          } catch {
            // ignore
          }
        }
      },
    })
      .then(() => {
        if (typeof window !== "undefined" && "Notification" in window) setPushPermission(Notification.permission);
      })
      .finally(() => setEnablePushLoading(false));
  }, []);

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <button
        className="relative flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full dropdown-toggle hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={toggleDropdown}
        aria-label="Notifications"
      >
        {hasUnread && (
          <span className="absolute right-0 top-0.5 z-10 flex h-2 w-2 rounded-full bg-orange-400">
            <span className="absolute inline-flex w-full h-full bg-orange-400 rounded-full opacity-75 animate-ping"></span>
          </span>
        )}
        <svg
          className="fill-current"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:right-0"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Notifications
          </h5>
          <div className="flex items-center gap-2">
            {hasUnread && (
              <button
                type="button"
                disabled={markAllLoading}
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50 dark:text-brand-400"
              >
                {markAllLoading ? "…" : "Mark all read"}
              </button>
            )}
            <button
              onClick={toggleDropdown}
              className="text-gray-500 transition dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              aria-label="Close"
            >
              <svg
                className="fill-current"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>
        {showEnablePush && (
          <div className="mb-3 rounded-lg border border-brand-200 bg-brand-50/50 px-3 py-2 dark:border-brand-800 dark:bg-brand-900/20">
            <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">
              Enable push notifications to receive alerts here.
            </p>
            <button
              type="button"
              disabled={enablePushLoading}
              onClick={handleEnablePush}
              className="w-full rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              {enablePushLoading ? "Enabling…" : "Enable push notifications"}
            </button>
          </div>
        )}
        <ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar min-h-0 flex-1">
          {loading ? (
            <li className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Loading…
            </li>
          ) : list.length === 0 ? (
            <li className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No notifications
            </li>
          ) : (
            list.map((item) => (
              <li key={item.id}>
                <DropdownItem
                  onItemClick={() => {
                    closeDropdown();
                    handleItemClick(item);
                  }}
                  className={`flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5 ${!item.readAt ? "bg-brand-50/50 dark:bg-brand-900/10" : ""}`}
                >
                  <span className="relative block w-10 h-10 flex-shrink-0 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-gray-500 dark:text-gray-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
                    </svg>
                    {!item.readAt && (
                      <span className="absolute bottom-0 right-0 z-10 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500 dark:border-gray-900" />
                    )}
                  </span>
                  <span className="block min-w-0 flex-1">
                    <span className="mb-1 block text-theme-sm text-gray-800 dark:text-white/90 font-medium">
                      {item.title || "Notification"}
                    </span>
                    {item.body && (
                      <span className="mb-1 block text-theme-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                        {item.body}
                      </span>
                    )}
                    <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                      {item.type && <span>{item.type.replace(/_/g, " ")}</span>}
                      {item.type && <span className="w-1 h-1 bg-gray-400 rounded-full" />}
                      <span>{formatRelativeTime(item.createdAt)}</span>
                      {markingId === item.id && <span>Marking…</span>}
                    </span>
                  </span>
                </DropdownItem>
              </li>
            ))
          )}
        </ul>
        <Link
          to="/notifications"
          className="block px-4 py-2 mt-3 text-sm font-medium text-center text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
          onClick={closeDropdown}
        >
          View all notifications
        </Link>
      </Dropdown>
    </div>
  );
}
