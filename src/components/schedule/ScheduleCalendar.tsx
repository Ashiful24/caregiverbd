import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  differenceInMinutes,
  format,
  isAfter,
  isBefore,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { AngleLeftIcon, AngleRightIcon, ArrowRightIcon, TimeIcon } from "../../icons";
import {
  parseEventRange,
  rangesOverlap,
  type ScheduleEventRecord,
} from "../../data/nurseScheduleSeed";
import {
  adminLongTermOpportunitiesApi,
  providersApi,
  type ProviderListItem,
} from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { ScheduleMonthView } from "./ScheduleMonthView";
import { ScheduleWeekView } from "./ScheduleWeekView";
import { ScheduleDayView } from "./ScheduleDayView";

export type ScheduleViewMode = "month" | "week" | "day";

type Props = {
  requestId: string;
  title: string;
  subtitle: string;
  requestStartDate: string;
  requestEndDate: string;
  initialEvents?: ScheduleEventRecord[];
};

type ModalDraft = {
  startDateStr: string;
  startHour: number;
  endDateStr: string;
  endHour: number;
};

function combineDateHour(dateStr: string, hour: number): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

function formatDurationLabel(start: Date, end: Date): string {
  const mins = differenceInMinutes(end, start);
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label: format(new Date(2000, 0, 1, hour, 0, 0, 0), "h:mm a"),
}));

const modalTimeInputClass =
  "rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white disabled:cursor-not-allowed disabled:border-dashed disabled:border-gray-400 disabled:bg-gray-200/90 disabled:text-gray-500 disabled:opacity-100 dark:disabled:border-gray-500 dark:disabled:bg-gray-800/90 dark:disabled:text-gray-400";

function eventOverlapsNurse(
  events: ScheduleEventRecord[],
  nurseId: string,
  start: Date,
  end: Date,
  excludeId?: string
): boolean {
  return events.some((e) => {
    if (e.id === excludeId) return false;
    if (e.nurseId !== nurseId) return false;
    const { start: s, end: ed } = parseEventRange(e);
    return rangesOverlap(start, end, s, ed);
  });
}

export function ScheduleCalendar({
  requestId,
  title,
  subtitle,
  requestStartDate,
  requestEndDate,
  initialEvents = [],
}: Props) {
  const { user } = useAuth();
  const currentRole = String(user?.role ?? "").toUpperCase();
  const supervisorId =
    currentRole === "SUPERVISOR" && Number.isFinite(Number(user?.id)) && Number(user?.id) > 0
      ? Number(user?.id)
      : undefined;

  const [view, setView] = useState<ScheduleViewMode>("month");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState<ScheduleEventRecord[]>(initialEvents);
  const [modalDraft, setModalDraft] = useState<ModalDraft | null>(null);
  const [selectedNurseId, setSelectedNurseId] = useState<number | null>(null);
  const [nurses, setNurses] = useState<ProviderListItem[]>([]);
  const [nursesLoading, setNursesLoading] = useState(false);
  const [availabilityLoadingId, setAvailabilityLoadingId] = useState<number | null>(null);
  const [availabilityByNurse, setAvailabilityByNurse] = useState<Record<number, string[]>>({});
  const [availabilityErrorByNurse, setAvailabilityErrorByNurse] = useState<Record<number, string>>(
    {}
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ScheduleEventRecord | null>(null);
  const [removingEvent, setRemovingEvent] = useState(false);
  const [removeReason, setRemoveReason] = useState("");
  const [removeError, setRemoveError] = useState<string | null>(null);
  const isScheduleModalOpen = modalDraft != null;

  const requestStart = useMemo(() => new Date(requestStartDate), [requestStartDate]);
  const requestEnd = useMemo(() => new Date(requestEndDate), [requestEndDate]);

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents, requestId]);

  const dayInRange = useCallback(
    (day: Date) => {
      const d = startOfDay(day);
      return !isBefore(d, startOfDay(requestStart)) && !isAfter(d, startOfDay(requestEnd));
    },
    [requestStart, requestEnd]
  );

  const computedRange = useMemo(() => {
    if (!modalDraft) return null;
    const start = combineDateHour(modalDraft.startDateStr, modalDraft.startHour);
    const end = combineDateHour(modalDraft.endDateStr, modalDraft.endHour);
    return { start, end };
  }, [modalDraft]);

  const rangeValidForSave = useMemo(() => {
    if (!computedRange) return false;
    const { start, end } = computedRange;
    if (differenceInMinutes(end, start) < 60) return false;
    if (start.getTime() < requestStart.getTime() || end.getTime() > requestEnd.getTime()) return false;
    return true;
  }, [computedRange, requestStart, requestEnd]);

  useEffect(() => {
    if (!isScheduleModalOpen) {
      setNurses([]);
      setNursesLoading(false);
      return;
    }

    const ac = new AbortController();
    setNursesLoading(true);
    providersApi
      .getList(
        {
          page: 1,
          limit: 10,
          ...(supervisorId != null ? { supervisorId } : {}),
        },
        { signal: ac.signal }
      )
      .then((res) => {
        const payload = res.data as { providers?: ProviderListItem[] } | null;
        const list = Array.isArray(payload?.providers) ? payload.providers : [];
        setNurses(list);
        setSelectedNurseId((prev) => (prev != null && list.some((n) => n.id === prev) ? prev : null));
      })
      .catch(() => {
        setNurses([]);
      })
      .finally(() => {
        setNursesLoading(false);
      });

    return () => ac.abort();
  }, [isScheduleModalOpen, supervisorId]);

  const closeModal = () => {
    setModalDraft(null);
    setSelectedNurseId(null);
    setFormError(null);
    setNurses([]);
    setAvailabilityByNurse({});
    setAvailabilityErrorByNurse({});
    setAvailabilityLoadingId(null);
  };

  const handleOpenRemove = (event: ScheduleEventRecord) => {
    setRemoveTarget(event);
    setRemoveReason("");
    setRemoveError(null);
  };

  const handleCloseRemove = () => {
    setRemoveTarget(null);
    setRemovingEvent(false);
    setRemoveReason("");
    setRemoveError(null);
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget?.scheduleSlotId) {
      setRemoveError("Missing schedule slot ID for this event.");
      return;
    }
    setRemovingEvent(true);
    setRemoveError(null);
    try {
      await adminLongTermOpportunitiesApi.rejectScheduleSlot(
        requestId,
        removeTarget.scheduleSlotId,
        { reason: removeReason.trim() || "Removed from calendar by admin" }
      );
      setEvents((prev) => prev.filter((e) => e.id !== removeTarget.id));
      handleCloseRemove();
    } catch {
      setRemoveError("Failed to remove slot. Please try again.");
    } finally {
      setRemovingEvent(false);
    }
  };

  const openModalFromHour = (day: Date, hour24: number) => {
    if (!dayInRange(day)) return;
    const start = addHours(startOfDay(day), hour24);
    const end = addHours(start, 1);
    setFormError(null);
    setModalDraft({
      startDateStr: format(start, "yyyy-MM-dd"),
      startHour: hour24,
      endDateStr: format(end, "yyyy-MM-dd"),
      endHour: end.getHours(),
    });
    setSelectedNurseId(null);
  };

  const openModalFromDay = (day: Date) => {
    if (!dayInRange(day)) return;
    const start = addHours(startOfDay(day), 9);
    const end = addHours(start, 1);
    setFormError(null);
    setModalDraft({
      startDateStr: format(start, "yyyy-MM-dd"),
      startHour: 9,
      endDateStr: format(end, "yyyy-MM-dd"),
      endHour: end.getHours(),
    });
    setSelectedNurseId(null);
  };

  const ensureEndAfterStart = (next: ModalDraft): ModalDraft => {
    const start = combineDateHour(next.startDateStr, next.startHour);
    const end = combineDateHour(next.endDateStr, next.endHour);
    if (differenceInMinutes(end, start) < 60) {
      const fixed = addHours(start, 1);
      return {
        ...next,
        endDateStr: format(fixed, "yyyy-MM-dd"),
        endHour: fixed.getHours(),
      };
    }
    return next;
  };

  const patchDraft = (partial: Partial<ModalDraft>) => {
    setModalDraft((d) => (d ? ensureEndAfterStart({ ...d, ...partial }) : d));
    setFormError(null);
  };

  const providerLabel = (p: ProviderListItem): string => {
    const full = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
    if (full) return full;
    return p.name?.trim() || p.fullName?.trim() || p.providerName?.trim() || p.email || p.username || "Nurse";
  };

  const handleCheckAvailability = async (providerId: number) => {
    if (!modalDraft?.startDateStr) return;
    setAvailabilityLoadingId(providerId);
    setAvailabilityErrorByNurse((prev) => ({ ...prev, [providerId]: "" }));
    try {
      const res = await providersApi.getAvailability(providerId, modalDraft.startDateStr);
      const data = res.data as unknown;
      const slotsRaw =
        Array.isArray(data)
          ? data
          : data && typeof data === "object"
            ? ((data as Record<string, unknown>).slots ??
              (data as Record<string, unknown>).availableSlots ??
              (data as Record<string, unknown>).data)
            : null;
      const slots = Array.isArray(slotsRaw)
        ? slotsRaw
            .map((x) => {
              if (x && typeof x === "object") {
                const o = x as Record<string, unknown>;
                const from = String(o.from ?? "").trim();
                const to = String(o.to ?? "").trim();
                if (from && to) return `${from} - ${to}`;
                if (from) return from;
                if (to) return to;
                return "";
              }
              const s = String(x ?? "").trim();
              return s;
            })
            .filter((x) => x.length > 0)
        : [];
      setAvailabilityByNurse((prev) => ({ ...prev, [providerId]: slots }));
      if (slots.length === 0) {
        setAvailabilityErrorByNurse((prev) => ({
          ...prev,
          [providerId]: "No slots available for this date.",
        }));
      }
    } catch {
      setAvailabilityByNurse((prev) => ({ ...prev, [providerId]: [] }));
      setAvailabilityErrorByNurse((prev) => ({
        ...prev,
        [providerId]: "Failed to load availability.",
      }));
    } finally {
      setAvailabilityLoadingId(null);
    }
  };

  const saveEvent = async () => {
    if (!modalDraft || !computedRange || !selectedNurseId) return;
    const { start, end } = computedRange;
    if (differenceInMinutes(end, start) < 60) {
      setFormError("The visit must be at least 1 hour.");
      return;
    }
    if (start.getTime() < requestStart.getTime() || end.getTime() > requestEnd.getTime()) {
      setFormError("Time must fall within the service request window.");
      return;
    }
    const nurse = nurses.find((n) => n.id === selectedNurseId);
    if (!nurse) {
      setFormError("Select a nurse.");
      return;
    }
    const nurseId = String(nurse.id);
    if (eventOverlapsNurse(events, nurseId, start, end)) {
      setFormError("This nurse is already assigned in an overlapping time range.");
      return;
    }
    setSavingEvent(true);
    setFormError(null);
    try {
      await adminLongTermOpportunitiesApi.createProviderSchedule(requestId, {
        slots: [
          {
            providerId: nurse.id,
            date: format(start, "yyyy-MM-dd"),
            startTime: format(start, "HH:mm"),
            endTime: format(end, "HH:mm"),
          },
        ],
      });

      const newEvent: ScheduleEventRecord = {
        id: `evt-${requestId}-${Date.now()}`,
        requestId,
        nurseId,
        nurseName: providerLabel(nurse),
        title: `${providerLabel(nurse).split(" ")[0]} - Visit`,
        start: start.toISOString(),
        end: end.toISOString(),
        type: "visit",
      };
      setEvents((prev) => [...prev, newEvent]);
      closeModal();
    } catch {
      setFormError("Failed to create schedule. Please try again.");
    } finally {
      setSavingEvent(false);
    }
  };

  const rangeTitle = useMemo(() => {
    if (view === "month") return format(anchor, "MMMM yyyy");
    if (view === "week") {
      const ws = startOfWeek(anchor, { weekStartsOn: 1 });
      const we = addDays(ws, 6);
      return `${format(ws, "MMM d")} – ${format(we, "MMM d, yyyy")}`;
    }
    return format(anchor, "EEEE, MMM d, yyyy");
  }, [view, anchor]);

  const visibleMonth = view === "month" ? anchor : startOfMonth(anchor);

  const durationLabel = computedRange ? formatDurationLabel(computedRange.start, computedRange.end) : "—";

  const goPrev = () => {
    if (view === "month") setAnchor((d) => subMonths(d, 1));
    else if (view === "week") setAnchor((d) => subWeeks(d, 1));
    else setAnchor((d) => subDays(d, 1));
  };

  const goNext = () => {
    if (view === "month") setAnchor((d) => addMonths(d, 1));
    else if (view === "week") setAnchor((d) => addWeeks(d, 1));
    else setAnchor((d) => addDays(d, 1));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800/80">
            {(["month", "week", "day"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
                  view === mode
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                {mode[0].toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-1 dark:border-gray-700 dark:bg-gray-900/40">
            <button
              type="button"
              onClick={goPrev}
              className="inline-flex size-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label="Previous"
            >
              <AngleLeftIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setAnchor(startOfDay(new Date()))}
              className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/40"
            >
              Today
            </button>
            <button
              type="button"
              onClick={goNext}
              className="inline-flex size-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label="Next"
            >
              <AngleRightIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border-2 border-gray-300 bg-white pt-3 shadow-sm dark:border-gray-600 dark:bg-gray-900/30 sm:pt-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-300 pb-3 dark:border-gray-600">
          <p className="text-base font-semibold text-gray-900 dark:text-white">{rangeTitle}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Click any hour to schedule (minimum 1 hour, full-hour times only)</p>
        </div>

        {view === "month" && (
          <ScheduleMonthView
            visibleMonth={visibleMonth}
            events={events}
            dayInRange={dayInRange}
            onSelectDay={openModalFromDay}
            onEventClick={handleOpenRemove}
          />
        )}
        {view === "week" && (
          <ScheduleWeekView
            weekAnchor={anchor}
            events={events}
            dayInRange={dayInRange}
            onSelectHour={openModalFromHour}
            onEventClick={handleOpenRemove}
          />
        )}
        {view === "day" && (
          <ScheduleDayView
            day={anchor}
            events={events}
            dayInRange={dayInRange}
            onSelectHour={openModalFromHour}
            onEventClick={handleOpenRemove}
          />
        )}
      </div>

      {modalDraft && computedRange && (
        <div className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Schedule visit</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Choose start and end (full hours only), then pick a nurse and check availability by date.</p>

            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <TimeIcon className="size-5 shrink-0 text-gray-400" aria-hidden />
                <input
                  type="date"
                  value={modalDraft.startDateStr}
                  onChange={(e) => patchDraft({ startDateStr: e.target.value })}
                  className={modalTimeInputClass}
                />
                <select
                  value={modalDraft.startHour}
                  onChange={(e) => patchDraft({ startHour: Number(e.target.value) })}
                  className={modalTimeInputClass}
                >
                  {HOUR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ArrowRightIcon className="size-4 shrink-0 text-gray-400" aria-hidden />
                <input
                  type="date"
                  value={modalDraft.endDateStr}
                  onChange={(e) => patchDraft({ endDateStr: e.target.value })}
                  className={modalTimeInputClass}
                />
                <select
                  value={modalDraft.endHour}
                  onChange={(e) => patchDraft({ endHour: Number(e.target.value) })}
                  className={modalTimeInputClass}
                >
                  {HOUR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{durationLabel}</span>
              </div>

              {/* <div className="flex flex-wrap items-center gap-2">
                <TaskIcon className="size-5 shrink-0 text-gray-400" aria-hidden />
                <select
                  disabled
                  className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                  value="none"
                >
                  <option value="none">Does not repeat</option>
                </select>
              </div> */}
            </div>

            {!rangeValidForSave && (
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
                Select a range of at least 1 hour that stays within the service request dates ({format(requestStart, "P")} – {format(requestEnd, "P")}).
              </p>
            )}

            <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Nurse list</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {currentRole === "SUPERVISOR"
                  ? "Showing nurses filtered by your supervisor account."
                  : "Showing all nurses."}
              </p>

              <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
                {nursesLoading && <p className="text-sm text-gray-500">Loading…</p>}
                {!nursesLoading && nurses.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No nurses found.</p>
                )}
                {!nursesLoading &&
                  nurses.map((nurse) => (
                    <div
                      key={nurse.id}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        selectedNurseId === nurse.id
                          ? "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/40"
                          : "border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="schedule-nurse"
                            checked={selectedNurseId === nurse.id}
                            onChange={() => setSelectedNurseId(nurse.id)}
                          />
                          <span className="text-gray-800 dark:text-gray-200">
                            {providerLabel(nurse)}
                            <span className="ml-1 text-gray-500">
                              ({nurse.consultationTypeName ?? nurse.username ?? "Nurse"})
                            </span>
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => void handleCheckAvailability(nurse.id)}
                          disabled={availabilityLoadingId === nurse.id}
                          className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          {availabilityLoadingId === nurse.id ? "Checking..." : "Availability check"}
                        </button>
                      </div>

                      {availabilityErrorByNurse[nurse.id] ? (
                        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                          {availabilityErrorByNurse[nurse.id]}
                        </p>
                      ) : null}

                      {availabilityByNurse[nurse.id]?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {availabilityByNurse[nurse.id].map((slot) => (
                            <span
                              key={`${nurse.id}-${slot}`}
                              className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                            >
                              {slot}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
              </div>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p>}

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedNurseId || !rangeValidForSave || savingEvent}
                onClick={() => void saveEvent()}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingEvent ? "Creating..." : "Create event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {removeTarget && (
        <div className="fixed inset-0 z-[10070] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Remove schedule slot
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to remove this slot?
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {removeTarget.title} ({format(parseEventRange(removeTarget).start, "PPp")} -{" "}
              {format(parseEventRange(removeTarget).end, "p")})
            </p>
            <label className="mt-3 block text-xs font-medium text-gray-500 dark:text-gray-400">
              Reason
              <input
                type="text"
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                placeholder="Optional reason"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
            </label>
            {removeError ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{removeError}</p>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
              <button
                type="button"
                onClick={handleCloseRemove}
                disabled={removingEvent}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmRemove()}
                disabled={removingEvent}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {removingEvent ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
