import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import {
  notificationsApi,
  type NotificationHistoryItem,
  type NotificationHistoryListResponse,
} from "../services/api";
import { formatRelativeTime } from "../utils/format";

type StatusFilter = "ACTIVE" | "ARCHIVED";

export default function Notifications() {
  const { t } = useTranslation();
  const [list, setList] = useState<NotificationHistoryItem[]>([]);
  const [meta, setMeta] = useState<{ total: number; page: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const [page, setPage] = useState(1);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [markAllLoading, setMarkAllLoading] = useState(false);
  const [testUserId, setTestUserId] = useState("");
  const [testTitle, setTestTitle] = useState(() => t("notificationsPage.defaultTestTitle"));
  const [testBody, setTestBody] = useState(() => t("notificationsPage.defaultTestBody"));
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [testPushResult, setTestPushResult] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await notificationsApi.list({
        page,
        limit: 20,
        status: statusFilter,
      });
      const body = (res as { data?: NotificationHistoryListResponse })?.data ?? res;
      const payload = body as NotificationHistoryListResponse;
      setList(Array.isArray(payload?.data) ? payload.data : []);
      if (payload?.meta) {
        setMeta({
          total: payload.meta.total,
          page: payload.meta.page,
          totalPages: payload.meta.totalPages,
        });
      } else {
        setMeta(null);
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("notificationsPage.failedLoad");
      setError(message);
      setList([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, t]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleMarkAsRead = useCallback(async (id: number) => {
    setMarkingId(id);
    try {
      await notificationsApi.markAsRead(id);
      setList((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } finally {
      setMarkingId(null);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    setMarkAllLoading(true);
    try {
      await notificationsApi.markAllAsRead();
      await fetchList();
    } catch {
      setError(t("notificationsPage.failedMarkAllRead"));
    } finally {
      setMarkAllLoading(false);
    }
  }, [fetchList, t]);

  const unreadCount = list.filter((n) => !n.readAt).length;

  const handleTestPush = useCallback(async () => {
    const userId = parseInt(testUserId, 10);
    if (!Number.isInteger(userId) || userId < 1) {
      setTestPushResult(t("notificationsPage.invalidUserId"));
      return;
    }
    setTestPushLoading(true);
    setTestPushResult(null);
    try {
      const res = await notificationsApi.testPush({
        userId,
        title: testTitle.trim() || undefined,
        body: testBody.trim() || undefined,
      });
      const result = (res?.data ?? res) as { sent?: boolean; message?: string };
      setTestPushResult(
        result?.message ??
          (result?.sent ? t("notificationsPage.sent") : t("notificationsPage.notSent"))
      );
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : t("notificationsPage.failedSendTestPush");
      setTestPushResult(message);
    } finally {
      setTestPushLoading(false);
    }
  }, [testUserId, testTitle, testBody, t]);

  return (
    <>
      <PageMeta
        title={t("notificationsPage.metaTitle")}
        description={t("notificationsPage.metaDescription")}
      />
      <PageBreadcrumb pageTitle={t("notificationsPage.pageTitle")} />
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {t("notificationsPage.heading")}
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter("ACTIVE")}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                statusFilter === "ACTIVE"
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {t("notificationsPage.active")}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ARCHIVED")}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                statusFilter === "ARCHIVED"
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {t("notificationsPage.archived")}
            </button>
            {statusFilter === "ACTIVE" && unreadCount > 0 && (
              <button
                type="button"
                disabled={markAllLoading}
                onClick={handleMarkAllRead}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                {markAllLoading ? "…" : t("notificationsPage.markAllRead")}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            {t("systemConfig.loading")}
          </div>
        ) : list.length === 0 ? (
          <p className="py-8 text-center text-gray-500 dark:text-gray-400">
            {t("notificationsPage.noNotifications")}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {list.map((item) => (
              <li
                key={item.id}
                className={`flex gap-4 py-4 first:pt-0 ${
                  !item.readAt ? "bg-brand-50/30 dark:bg-brand-900/10 -mx-2 px-2 rounded-lg" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-800 dark:text-white/90">
                    {item.title || t("notificationsPage.fallbackNotificationTitle")}
                  </p>
                  {item.body && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{item.body}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {item.type && <span className="mr-2">{item.type.replace(/_/g, " ")}</span>}
                    <span>{formatRelativeTime(item.createdAt)}</span>
                  </p>
                </div>
                {!item.readAt && (
                  <button
                    type="button"
                    disabled={markingId === item.id}
                    onClick={() => handleMarkAsRead(item.id)}
                    className="flex-shrink-0 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 disabled:opacity-50"
                  >
                    {markingId === item.id ? "…" : t("notificationsPage.markRead")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-gray-300 bg-white px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t("notificationsPage.pageOf", { page: meta.page, totalPages: meta.totalPages })}
            </span>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-gray-300 bg-white px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              Next
            </button>
          </div>
        )}

        {/* Send test push (admin) */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
          <h4 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">
            {t("notificationsPage.sendTestPush")}
          </h4>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            {t("notificationsPage.sendTestPushHelp")}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-xs text-gray-500 dark:text-gray-400">{t("notificationsPage.userId")}</span>
              <input
                type="number"
                min={1}
                value={testUserId}
                onChange={(e) => setTestUserId(e.target.value)}
                className="ml-2 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 w-24"
                placeholder="1"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 dark:text-gray-400">{t("notificationsPage.title")}</span>
              <input
                type="text"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                className="ml-2 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 w-40"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 dark:text-gray-400">{t("notificationsPage.body")}</span>
              <input
                type="text"
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                className="ml-2 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 w-56"
              />
            </label>
            <button
              type="button"
              disabled={testPushLoading}
              onClick={handleTestPush}
              className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {testPushLoading ? t("notificationsPage.sending") : t("notificationsPage.sendTestPushAction")}
            </button>
          </div>
          {testPushResult && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{testPushResult}</p>
          )}
        </div>
      </div>
    </>
  );
}
