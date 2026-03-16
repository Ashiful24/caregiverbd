import { Link } from "react-router";
import { UserIcon, GroupIcon, FolderIcon, ArrowRightIcon } from "../../icons";

const links = [
  { to: "/patients", label: "View all patients", icon: <UserIcon className="size-5" /> },
  { to: "/providers", label: "View all providers", icon: <GroupIcon className="size-5" /> },
  { to: "/providers?status=pending", label: "Pending providers", icon: <GroupIcon className="size-5" /> },
  { to: "/upgrade-requests", label: "Upgrade requests", icon: <GroupIcon className="size-5" /> },
  { to: "/consultation-types", label: "Consultation types", icon: <FolderIcon className="size-5" /> },
];

export function QuickLinks() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/50 md:p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Quick links
      </h3>
      <div className="mt-4 flex flex-wrap gap-3">
        {links.map((link) => (
          <Link
            key={link.to + link.label}
            to={link.to}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-200 dark:hover:bg-brand-900/20 dark:hover:border-brand-800 dark:hover:text-brand-300"
          >
            {link.icon}
            {link.label}
            <ArrowRightIcon className="size-4 opacity-70" />
          </Link>
        ))}
      </div>
    </div>
  );
}
