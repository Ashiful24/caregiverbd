const READONLY_SCHEDULE_STATUSES = new Set(["PAID", "CANCELLED", "EXPIRED"]);

export function isScheduleCalendarReadOnly(status?: string | null): boolean {
  const normalized = String(status ?? "").trim().toUpperCase();
  return READONLY_SCHEDULE_STATUSES.has(normalized);
}
