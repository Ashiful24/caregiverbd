import { Link } from "react-router";
import { AlertIcon, DocsIcon, ArrowRightIcon } from "../../icons";

export interface PendingActionsPanelProps {
  pendingProviders: number;
  pendingCertifications: number;
  loading?: boolean;
}

export function PendingActionsPanel({
  pendingProviders,
  pendingCertifications,
  loading = false,
}: PendingActionsPanelProps) {
  const items = [
    {
      label: "Pending providers",
      count: pendingProviders,
      href: "/providers?status=pending",
      icon: <AlertIcon className="size-5 text-amber-500" />,
    },
    {
      label: "Pending certifications",
      count: pendingCertifications,
      href: "/providers",
      icon: <DocsIcon className="size-5 text-teal-500" />,
    },
  ];

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/50 md:p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Pending actions
        </h3>
        <ul className="mt-4 space-y-3">
          {[1, 2].map((i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-gray-100 dark:bg-gray-700/50 py-3 px-4 animate-pulse">
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-600" />
              <div className="h-5 w-8 rounded bg-gray-200 dark:bg-gray-600" />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const hasAny = pendingProviders > 0 || pendingCertifications > 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/50 md:p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Pending actions
      </h3>
      {!hasAny ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">No pending items.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.label}>
              <Link
                to={item.href}
                className="flex items-center justify-between rounded-lg border border-gray-100 py-3 px-4 transition-colors hover:bg-gray-50 hover:border-gray-200 dark:border-gray-700 dark:hover:bg-gray-700/30 dark:hover:border-gray-600"
              >
                <span className="flex items-center gap-3">
                  {item.icon}
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.label}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-semibold text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                    {item.count}
                  </span>
                  <ArrowRightIcon className="size-4 text-gray-400" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
