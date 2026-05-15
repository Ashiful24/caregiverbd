import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2, Search } from "lucide-react";

export const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

export const labelClass =
  "text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400";

export function SettingsAlert({
  variant,
  title,
  message,
  onDismiss,
}: {
  variant: "warning" | "info" | "success" | "error";
  title: string;
  message: string;
  onDismiss?: () => void;
}) {
  const styles = {
    warning: {
      wrap: "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40",
      icon: "text-amber-600 dark:text-amber-400",
      title: "text-amber-950 dark:text-amber-100",
      body: "text-amber-900/90 dark:text-amber-200/90",
    },
    info: {
      wrap: "border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/40",
      icon: "text-blue-600 dark:text-blue-400",
      title: "text-blue-950 dark:text-blue-100",
      body: "text-blue-900/90 dark:text-blue-200/90",
    },
    success: {
      wrap: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/40",
      icon: "text-emerald-600 dark:text-emerald-400",
      title: "text-emerald-950 dark:text-emerald-100",
      body: "text-emerald-900/90 dark:text-emerald-200/90",
    },
    error: {
      wrap: "border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/40",
      icon: "text-rose-600 dark:text-rose-400",
      title: "text-rose-950 dark:text-rose-100",
      body: "text-rose-900/90 dark:text-rose-200/90",
    },
  }[variant];

  const Icon = variant === "success" ? CheckCircle2 : variant === "error" ? AlertCircle : Info;

  return (
    <div
      role="alert"
      className={`mb-6 flex gap-3 rounded-xl border p-4 ${styles.wrap}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${styles.icon}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${styles.title}`}>{title}</p>
        <p className={`mt-1 text-sm leading-relaxed ${styles.body}`}>{message}</p>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-gray-500 hover:bg-black/5 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200"
          aria-label="Dismiss"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export function SettingsToolbar({
  children,
  search,
  onSearchChange,
  searchPlaceholder,
}: {
  children?: ReactNode;
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {onSearchChange != null && search != null ? (
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={`${inputClass} pl-9`}
          />
        </div>
      ) : null}
    </div>
  );
}

export function StatChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "neutral" | "positive" | "warning";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-700 dark:text-amber-400"
        : "text-gray-900 dark:text-white";
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className={labelClass}>{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

export function PanelLoading({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500 dark:text-gray-400">
      <Loader2 className="h-8 w-8 animate-spin text-brand-500" aria-hidden />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function PanelEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-6 py-12 text-center dark:border-gray-700 dark:bg-white/[0.02]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}

export function btnPrimary() {
  return "inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:focus-visible:ring-offset-gray-900";
}

export function btnSecondary() {
  return "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700";
}

export function btnGhost() {
  return "inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700";
}
