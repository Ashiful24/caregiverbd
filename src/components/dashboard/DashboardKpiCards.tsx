import { Link } from "react-router";
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
  "rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/50 md:p-6 transition-shadow hover:shadow-md";

export function DashboardKpiCards({
  totalPatients,
  totalProviders,
  pendingProviders,
  activeRequestsCount,
  pendingCertifications,
  loading = false,
}: DashboardKpiCardsProps) {
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
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <UserIcon className="size-6 text-blue-600 dark:text-blue-400" />
        </div>
        <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">Total patients</p>
        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totalPatients.toLocaleString()}</p>
      </Link>

      <Link to="/providers" className={cardBase}>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
          <GroupIcon className="size-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">Total providers</p>
        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{totalProviders.toLocaleString()}</p>
      </Link>

      <Link to="/providers?status=pending" className={cardBase}>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
          <AlertIcon className="size-6 text-amber-600 dark:text-amber-400" />
        </div>
        <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">Pending providers</p>
        <p className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-400">{pendingProviders.toLocaleString()}</p>
      </Link>

      <div className={cardBase}>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
          <TaskIcon className="size-6 text-violet-600 dark:text-violet-400" />
        </div>
        <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">Active requests</p>
        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
          {activeRequestsCount.toLocaleString()}
        </p>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Pending + In progress</p>
      </div>

      <div className={cardBase}>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
          <DocsIcon className="size-6 text-teal-600 dark:text-teal-400" />
        </div>
        <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">Pending certifications</p>
        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
          {pendingCertifications.toLocaleString()}
        </p>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">To review</p>
      </div>
    </div>
  );
}
