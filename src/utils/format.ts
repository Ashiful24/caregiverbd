/**
 * Shared formatting utilities for consistent display across the app.
 */

/** Format ISO date string to locale (e.g. "15 Jan 2024"). */
export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Format ISO date-time string to locale with time (e.g. "15 Jan 2024, 14:30"). */
export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Format ISO date-time to time only (e.g. "2:30 PM"). */
export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
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
