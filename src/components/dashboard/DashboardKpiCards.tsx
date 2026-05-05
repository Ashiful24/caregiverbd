import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { UserIcon, GroupIcon, AlertIcon, TaskIcon, DocsIcon } from "../../icons";

export interface DashboardKpiCardsProps {
  totalPatients: number;
  totalProviders: number;
  pendingProviders: number;
  activeRequestsCount: number;
  pendingCertifications: number;
  loading?: boolean;
}

const cardBase =
  "group rounded-2xl border border-gray-200/80 bg-white/95 p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800/60 dark:hover:border-brand-700/50 md:p-6";

export function DashboardKpiCards({
  totalPatients,
  totalProviders,
  pendingProviders,
  activeRequestsCount,
  pendingCertifications,
  loading = false,
}: DashboardKpiCardsProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "bn" ? "bn-BD" : "en-US";

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`${cardBase} animate-pulse`}>
            <div className="h-12 w-12 rounded-lg bg-gray-200 dark:bg-gray-700" />
            <div className="mt-4 h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="mt-2 h-8 w-16 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Link to="/patients" className={cardBase}>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400 dark:group-hover:bg-brand-500/25">
          <UserIcon className="size-6" />
        </div>
        <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t("dashboard.totalPatients")}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totalPatients.toLocaleString(locale)}</p>
      </Link>

      <Link to="/providers" className={cardBase}>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:group-hover:bg-emerald-900/40">
          <GroupIcon className="size-6" />
        </div>
        <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t("dashboard.totalProviders")}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totalProviders.toLocaleString(locale)}</p>
      </Link>

      <Link to="/providers?status=pending" className={cardBase}>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition-colors group-hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:group-hover:bg-amber-900/40">
          <AlertIcon className="size-6" />
        </div>
        <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t("dashboard.pendingProviders")}</p>
        <p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-400">{pendingProviders.toLocaleString(locale)}</p>
      </Link>

      <div className={cardBase}>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600 transition-colors group-hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400 dark:group-hover:bg-violet-900/40">
          <TaskIcon className="size-6" />
        </div>
        <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t("dashboard.activeRequests")}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
          {activeRequestsCount.toLocaleString(locale)}
        </p>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t("dashboard.activeRequestsHint")}</p>
      </div>

      <div className={cardBase}>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600 transition-colors group-hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400 dark:group-hover:bg-teal-900/40">
          <DocsIcon className="size-6" />
        </div>
        <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">{t("dashboard.pendingCertifications")}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
          {pendingCertifications.toLocaleString(locale)}
        </p>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{t("dashboard.pendingCertificationsHint")}</p>
      </div>
    </div>
  );
}
