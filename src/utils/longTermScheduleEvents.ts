import type { ScheduleEventRecord } from "../data/nurseScheduleSeed";

/**
 * Maps GET /long-term-opportunities/schedule-details/:id (and similar payloads)
 * into calendar events. Kept permissive to tolerate nested API shapes.
 */
export function buildEventsFromScheduleDetails(
  data: unknown,
  requestId: string,
  nurseFallback = "Nurse"
): ScheduleEventRecord[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;

  const collectSlots = (node: unknown): unknown[] => {
    if (!node || typeof node !== "object") return [];
    const o = node as Record<string, unknown>;
    const directKeys = [
      "schedule",
      "slots",
      "scheduleSlots",
      "providerSchedules",
      "schedules",
      "scheduleDetails",
      "providerScheduleSlots",
      "events",
      "data",
      "items",
      "results",
    ] as const;
    for (const key of directKeys) {
      const val = o[key];
      if (Array.isArray(val)) return val;
      if (val && typeof val === "object") {
        const nested = collectSlots(val);
        if (nested.length > 0) return nested;
      }
    }
    return [];
  };

  const toIsoFromParts = (dateLike: string, timeLike: string): string | null => {
    const date = dateLike.trim();
    const time = timeLike.trim();
    if (!date || !time) return null;
    if (date.includes("T")) return date;
    if (time.includes("T")) return time;
    const hhmm = time.length >= 5 ? time.slice(0, 5) : time;
    return `${date}T${hhmm}:00`;
  };

  const formatFee = (feeRaw: unknown): string | null => {
    const raw = String(feeRaw ?? "").trim();
    if (!raw) return null;
    const amount = Number(raw);
    if (Number.isFinite(amount)) {
      const formatted = amount.toLocaleString(undefined, {
        minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      });
      return `${formatted} ৳`;
    }
    return `${raw} ৳`;
  };

  const slotsRaw = collectSlots(root);
  if (!slotsRaw.length) return [];
  const events = slotsRaw
    .map((slot, idx): ScheduleEventRecord | null => {
      if (!slot || typeof slot !== "object") return null;
      const raw = slot as Record<string, unknown>;
      const providerSchedule =
        raw.providerSchedule && typeof raw.providerSchedule === "object"
          ? (raw.providerSchedule as Record<string, unknown>)
          : null;
      const serviceRequest =
        raw.serviceRequest && typeof raw.serviceRequest === "object"
          ? (raw.serviceRequest as Record<string, unknown>)
          : null;
      const s = providerSchedule ?? raw;
      const providerScheduleStatus = String(s.status ?? "").trim().toUpperCase();
      const serviceRequestStatus = String(serviceRequest?.status ?? "").trim().toUpperCase();
      const isUnavailableSchedule =
        providerScheduleStatus === "UNAVAILABLE" ||
        providerScheduleStatus === "REJECTED" ||
        providerScheduleStatus === "CANCELLED";
      const isRejectedServiceRequest =
        serviceRequestStatus === "REJECTED" || serviceRequestStatus === "CANCELLED";
      if (isUnavailableSchedule || isRejectedServiceRequest) return null;
      const date = String(
        s.date ?? s.scheduleDate ?? s.schedule_date ?? s.day ?? s.slotDate ?? ""
      ).trim();
      const startTime = String(
        s.startTime ?? s.start_time ?? s.from ?? s.slotStartTime ?? ""
      ).trim();
      const endTime = String(s.endTime ?? s.end_time ?? s.to ?? s.slotEndTime ?? "").trim();
      const startAtRaw = String(
        s.start ?? s.startAt ?? s.start_at ?? s.startDateTime ?? s.start_datetime ?? ""
      ).trim();
      const endAtRaw = String(
        s.end ?? s.endAt ?? s.end_at ?? s.endDateTime ?? s.end_datetime ?? ""
      ).trim();

      const startIso =
        startAtRaw || (date && startTime ? toIsoFromParts(date, startTime) : null);
      const endIso = endAtRaw || (date && endTime ? toIsoFromParts(date, endTime) : null);
      if (!startIso || !endIso) return null;

      const providerId = String(
        s.providerId ??
          s.provider_id ??
          serviceRequest?.providerId ??
          serviceRequest?.provider_id ??
          s.id ??
          `provider-${idx}`
      );
      const providerObj =
        s.provider && typeof s.provider === "object"
          ? (s.provider as Record<string, unknown>)
          : null;
      const providerName =
        String(
          s.providerName ??
            s.provider_name ??
            s.nurseName ??
            s.nurse_name ??
            (providerObj
              ? `${String(providerObj.firstName ?? "").trim()} ${String(
                  providerObj.lastName ?? ""
                ).trim()}`.trim() || providerObj.name
              : "") ??
            s.name ??
            nurseFallback
        ).trim() || nurseFallback;
      const feeLabel = formatFee(
        serviceRequest?.fee ??
          raw.fee ??
          s.fee ??
          serviceRequest?.providerFee ??
          serviceRequest?.provider_fee ??
          raw.providerFee ??
          raw.provider_fee
      );
      const slotIdCandidate =
        serviceRequest?.scheduleSlotId ??
        serviceRequest?.schedule_slot_id ??
        raw.scheduleSlotId ??
        raw.schedule_slot_id;
      const providerRowId = s.id ?? s.providerScheduleId ?? s.provider_schedule_id;
      const scheduleSlotNum = Number(slotIdCandidate ?? providerRowId ?? 0);

      const event: ScheduleEventRecord = {
        id: String(
          serviceRequest?.longTermCalendarSlotId ??
            serviceRequest?.long_term_calendar_slot_id ??
            s.id ??
            `evt-${requestId}-${providerId}-${date}-${startTime}-${idx}`
        ),
        requestId,
        nurseId: providerId,
        nurseName: providerName,
        title: providerName,
        feeLabel: feeLabel ?? undefined,
        start: startIso,
        end: endIso,
        type: "visit",
        scheduleSlotId: Number.isFinite(scheduleSlotNum) && scheduleSlotNum > 0 ? scheduleSlotNum : undefined,
      };
      return event;
    })
    .filter((x) => x != null);
  return events;
}
