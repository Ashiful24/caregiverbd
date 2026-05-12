import type { TFunction } from "i18next";
import type { ServiceRequestEventLogDto } from "../../services/api";
import { formatDateTime, formatStatusLabel } from "../../utils/format";
import type { LifecycleStepItem } from "./ServiceRequestLifecycleStepper";

function str(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  return s;
}

/** e.g. `SERVICE_REQUESTED` or `service_requested` → `Service Requested`. */
export function humanizeApiEventCode(code: string): string {
  const s = code.trim();
  if (!s) return "";
  const upper = s.toUpperCase();
  if (!/^[A-Z0-9_]+$/.test(upper.replace(/\s/g, ""))) return s;
  return upper
    .split(/_+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function mapEventLogToLifecycleStep(
  log: ServiceRequestEventLogDto,
  t: TFunction
): LifecycleStepItem {
  const rawEventType = str(log.eventType);
  const rawLabel = str(log.label);
  const title =
    str(log.title) ||
    (rawEventType ? humanizeApiEventCode(rawEventType) : "") ||
    (rawLabel ? humanizeApiEventCode(rawLabel) : "") ||
    (str(log.status) ? formatStatusLabel(str(log.status)) : "") ||
    t("appointments.eventLogUntitled");

  const bodyParts = [
    str(log.message),
    str(log.description),
    str(log.details),
    str(log.comment),
    str(log.note),
  ].filter(Boolean);

  const who = str(log.actorName) || str(log.performedBy);
  const whenRaw = log.createdAt ?? log.occurredAt ?? log.timestamp;
  const when = whenRaw ? formatDateTime(String(whenRaw)) : "";

  let description = bodyParts.join(" — ");
  if (who) {
    description = description ? `${description} · ${who}` : who;
  }
  if (when) {
    description = description ? `${description} · ${when}` : when;
  }
  if (!description) {
    description = t("appointments.eventLogNoDetail");
  }

  return { title, description };
}

/** When using API-driven steps: terminal statuses show all steps completed; otherwise highlight the latest event. */
export function lifecycleActiveIndexForEventLogCount(
  status: string,
  stepCount: number
): number {
  if (stepCount <= 0) return 0;
  const s = String(status).toUpperCase();
  const terminal = ["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED"].includes(s);
  if (terminal) return stepCount;
  return stepCount - 1;
}
