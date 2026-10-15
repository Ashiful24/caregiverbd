export function taka(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "৳0";
  return `৳${Math.round(n).toLocaleString("en-IN")}`;
}

export function fmtDate(v: unknown, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  if (!v) return "—";
  const s = String(v);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB", opts);
}

/** "14:00" → "2:00 PM" */
export function fmtTime(hhmm: unknown): string {
  const m = String(hhmm ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(hhmm ?? "—");
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}

export function fmtDateTime(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

export function timeAgo(v: unknown): string {
  const t = new Date(String(v)).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type Tone = "gray" | "brand" | "blue" | "amber" | "red" | "violet";

const STATUS: Record<string, [string, Tone]> = {
  PENDING: ["Waiting for provider", "amber"],
  ACCEPTED: ["Confirmed", "blue"],
  ON_THE_WAY: ["On the way", "violet"],
  IN_PROGRESS: ["In progress", "violet"],
  PAYMENT_PENDING: ["Confirm & pay", "amber"],
  COMPLETED: ["Completed", "brand"],
  REJECTED: ["Rejected", "red"],
  CANCELLED: ["Cancelled", "gray"],
  EXPIRED: ["Expired", "gray"],
  // long-term
  REQUESTED: ["Requested", "amber"],
  SCHEDULE_PROPOSED: ["Schedule proposed", "blue"],
  CHANGE_REQUESTED: ["Change requested", "amber"],
  PAID: ["Paid", "brand"],
  // provider profile / documents
  ACTIVE: ["Active", "brand"],
  APPROVED: ["Approved", "brand"],
  ARCHIVED: ["Archived", "gray"],
  BOOKED: ["Booked", "blue"],
  AVAILABLE: ["Available", "brand"],
  BLOCKED: ["Blocked", "gray"],
};

export function statusMeta(status: unknown): { label: string; tone: Tone } {
  const s = String(status ?? "");
  const [label, tone] = STATUS[s] ?? [s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()), "gray" as Tone];
  return { label, tone };
}

export const EVENT_LABELS: Record<string, string> = {
  REQUEST_CREATED: "Request sent",
  PROVIDER_ACCEPTED: "Provider accepted",
  ON_THE_WAY: "Provider on the way",
  START_OTP_SENT: "Provider arrived, OTP shared",
  SERVICE_STARTED: "Service started",
  COMPLETION_REQUESTED: "Provider marked complete",
  SERVICE_COMPLETED: "Paid & completed",
  REQUEST_REJECTED: "Rejected",
  REQUEST_CANCELLED: "Cancelled",
  REQUEST_EXPIRED: "Expired (no response)",
  PROVIDER_CANCEL_REQUESTED: "Provider asked admin to cancel",
  REQUESTED: "Request sent to Caregiver BD",
  SCHEDULE_PROPOSED: "Caregiver BD proposed a schedule",
  SCHEDULE_ACCEPTED: "You accepted the schedule",
  CHANGE_REQUESTED: "You asked for changes",
  PAID: "Payment received",
  COMPLETED: "All shifts completed",
};

export function initials(name: unknown): string {
  return String(name ?? "?")
    .replace(/^Dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export const CANCEL_REASONS = [
  ["PERSONAL_EMERGENCY", "Personal emergency"],
  ["ILLNESS", "I am sick"],
  ["TRANSPORT_ISSUE", "Transport problem"],
  ["SCHEDULE_CONFLICT", "Schedule conflict"],
  ["OTHER", "Other"],
];
