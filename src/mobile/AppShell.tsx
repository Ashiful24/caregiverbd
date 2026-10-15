import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { BadgeCheck, Bell } from "lucide-react";
import { Avatar } from "./ui";

/** Greeting bar (top) + bottom menu that stay on every screen of a signed-in app. */
export function AppShell({
  name,
  subtitle,
  verified,
  unread,
  base,
  nav,
  children,
}: {
  name: string;
  subtitle: ReactNode;
  verified?: boolean;
  unread: number;
  base: string;
  nav: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Name bar only on the home screen; the bottom menu stays everywhere.
  const isHome = pathname.replace(/\/+$/, "") === base;
  return (
    <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-950">
      {isHome && (
      <div className="flex shrink-0 items-center gap-3 bg-white px-4 py-2.5 dark:bg-gray-900">
        <button type="button" aria-label="Profile" onClick={() => navigate(`${base}/profile`)}>
          <Avatar name={name} size={40} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-gray-900 dark:text-white">{name}</p>
          <p className="flex items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400">
            {verified && <BadgeCheck size={13} className="shrink-0 text-brand-500" />}
            {subtitle}
          </p>
        </div>
        <button
          type="button"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          onClick={() => navigate(`${base}/notifications`)}
          className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Bell size={21} />
          {unread > 0 && (
            <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] leading-4 text-white">{unread > 9 ? "9+" : unread}</span>
          )}
        </button>
      </div>
      )}
      <div className="relative min-h-0 flex-1">{children}</div>
      {nav}
    </div>
  );
}
