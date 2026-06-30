/** Only these statuses allow scheduling edits on the service-request calendar. */
const SCHEDULABLE_STATUSES = new Set(["REQUESTED", "SCHEDULE_PROPOSED", "PAYMENT_PENDING"]);

export function isScheduleCalendarReadOnly(status?: string | null): boolean {
  const normalized = String(status ?? "").trim().toUpperCase();
  return !SCHEDULABLE_STATUSES.has(normalized);
}
