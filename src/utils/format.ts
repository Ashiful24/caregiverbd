/**
 * Shared formatting utilities for consistent display across the app.
 * All user-facing dates/times use Bangladesh (Asia/Dhaka); business runs in Bangladesh.
 */

/** IANA timezone used for every formatted date/time in the UI. */
export const DISPLAY_TIME_ZONE = "Asia/Dhaka";

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const dhakaDateFormatOptions = {
  day: "2-digit" as const,
  month: "short" as const,
  year: "numeric" as const,
  timeZone: DISPLAY_TIME_ZONE,
};

const dhakaDateTimeFormatOptions = {
  ...dhakaDateFormatOptions,
  hour: "2-digit" as const,
  minute: "2-digit" as const,
};

const dhakaTimeFormatOptions = {
  hour: "2-digit" as const,
  minute: "2-digit" as const,
  hour12: true as const,
  timeZone: DISPLAY_TIME_ZONE,
};

/** Bare `YYYY-MM-DD` from APIs: calendar date only — format without TZ shift so the day stays correct */
function formatBareCalendarDate(raw: string): string | null {
  const trimmed = raw.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!m) return null;
  const y = m[1];
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${String(d).padStart(2, "0")} ${MONTHS_SHORT[mo - 1]} ${y}`;
}

/** Fixed offset for Bangladesh Standard Time (no DST), for API query bounds. */
export const BANGLADESH_API_OFFSET = "+06:00";

/**
 * Inclusive Bangladesh calendar range (`YYYY-MM-DD`) as ISO instants for backends that use `new Date(iso)`.
 * Start = 00:00:00.000, end = 23:59:59.999 in Asia/Dhaka.
 */
export function bangladeshCalendarRangeToApiParams(
  dateOnlyStart: string,
  dateOnlyEnd: string
): { startDate: string; endDate: string } {
  const a = dateOnlyStart.trim();
  const b = dateOnlyEnd.trim();
  return {
    startDate: `${a}T00:00:00.000${BANGLADESH_API_OFFSET}`,
    endDate: `${b}T23:59:59.999${BANGLADESH_API_OFFSET}`,
  };
}

export function toBangladeshISODate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Same as {@link toBangladeshISODate} but accepts null → `undefined`. */
export function toBangladeshISODateOptional(
  date: Date | null | undefined
): string | undefined {
  if (!date) return undefined;
  return toBangladeshISODate(date);
}

/** Format ISO date string to locale (e.g. "15 Jan 2024"). */
export function formatDate(iso: string): string {
  try {
    const bare = formatBareCalendarDate(iso);
    if (bare) return bare;
    return new Date(iso).toLocaleDateString("en-GB", dhakaDateFormatOptions);
  } catch {
    return iso;
  }
}

/** Format ISO date-time string to locale with time (e.g. "15 Jan 2024, 14:30"). */
export function formatDateTime(iso: string): string {
  try {
    const bare = formatBareCalendarDate(iso);
    if (bare) return bare;
    return new Date(iso).toLocaleString("en-GB", dhakaDateTimeFormatOptions);
  } catch {
    return iso;
  }
}

/** Format ISO date-time to time only (e.g. "2:30 PM"). */
export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", dhakaTimeFormatOptions);
  } catch {
    return "";
  }
}

/** Format ISO date-time to relative time (e.g. "5 min ago", "2 hr ago"). */
export function formatRelativeTime(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const sec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hr ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
    return formatDate(iso);
  } catch {
    return iso;
  }
}

/** English labels for account active flag (domain convention; not localized in data cells). */
export function formatAccountActiveLabel(isActive: boolean): "Active" | "Inactive" {
  return isActive ? "Active" : "Inactive";
}

/**
 * Format enum-like status labels for UI (e.g. "IN_PROGRESS" -> "In progress").
 * Keeps existing spacing and normalizes underscores to spaces.
 */
export function formatStatusLabel(status: string): string {
  if (!status) return "";
  const normalized = status.replace(/_/g, " ").toLowerCase().trim();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
