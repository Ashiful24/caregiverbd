import { useMemo, useState } from "react";
import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
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
import { AngleLeftIcon, AngleRightIcon } from "../../icons";
import {
  getNurses,
  type ScheduleEventRecord,
} from "../../data/nurseScheduleSeed";
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
  requestedSlotHours: 4 | 8 | 12;
};

type AssignmentMap = Record<string, string[]>;
type SlotSelection = { day: Date; slotIndex: number };

function assignmentKey(dateKey: string, slotIndex: number): string {
  return `${dateKey}__slot_${slotIndex}`;
}

function normalizeDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function formatHourLabel(hour24: number): string {
  const normalized = ((hour24 % 24) + 24) % 24;
  const suffix = normalized < 12 ? "AM" : "PM";
  const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${hour12} ${suffix}`;
}

export function ScheduleCalendar({
  requestId,
  title,
  subtitle,
  requestStartDate,
  requestEndDate,
  requestedSlotHours,
}: Props) {
  const [view, setView] = useState<ScheduleViewMode>("month");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [assignments, setAssignments] = useState<AssignmentMap>({});
  const [selection, setSelection] = useState<SlotSelection | null>(null);
  const [selectedNurseIds, setSelectedNurseIds] = useState<string[]>([]);

  const requestStart = useMemo(() => startOfDay(new Date(requestStartDate)), [requestStartDate]);
  const requestEnd = useMemo(() => startOfDay(new Date(requestEndDate)), [requestEndDate]);
  const nurses = useMemo(() => getNurses(), []);
  const slotCapacity = 1;

  const assignmentEvents = useMemo<ScheduleEventRecord[]>(() => {
    const out: ScheduleEventRecord[] = [];
    Object.entries(assignments).forEach(([key, nurseIds]) => {
      const [dateKey, slotKey] = key.split("__");
      const slotIndex = Number((slotKey ?? "").replace("slot_", ""));
      if (!Number.isFinite(slotIndex)) return;
      const day = startOfDay(new Date(`${dateKey}T00:00:00`));
      const slotStart = addHours(day, slotIndex * requestedSlotHours);
      const slotEnd = addHours(slotStart, requestedSlotHours);

      nurseIds.forEach((nurseId) => {
        const nurse = nurses.find((n) => n.id === nurseId);
        if (!nurse) return;
        out.push({
          id: `assignment-${requestId}-${dateKey}-${slotIndex}-${nurseId}`,
          requestId,
          nurseId,
          nurseName: nurse.name,
          title: `${nurse.name.split(" ")[0]} ? Slot ${slotIndex + 1}`,
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          type: "visit",
        });
      });
    });
    return out;
  }, [assignments, nurses, requestId, requestedSlotHours]);

  const allEvents = useMemo(() => [...assignmentEvents], [assignmentEvents]);

  const rangeTitle = useMemo(() => {
    if (view === "month") return format(anchor, "MMMM yyyy");
    if (view === "week") {
      const ws = startOfWeek(anchor, { weekStartsOn: 1 });
      const we = addDays(ws, 6);
      return `${format(ws, "MMM d")} ? ${format(we, "MMM d, yyyy")}`;
    }
    return format(anchor, "EEEE, MMM d, yyyy");
  }, [view, anchor]);

  const visibleMonth = view === "month" ? anchor : startOfMonth(anchor);

  const getAssignedCount = (dateKey: string, slotIndex: number): number => {
    return assignments[assignmentKey(dateKey, slotIndex)]?.length ?? 0;
  };

  const openSlotSelection = (day: Date, slotIndex: number) => {
    const date = startOfDay(day);
    if (isBefore(date, requestStart) || isAfter(date, requestEnd)) return;
    const dateKey = normalizeDateKey(date);
    const key = assignmentKey(dateKey, slotIndex);
    setSelection({ day: date, slotIndex });
    setSelectedNurseIds(assignments[key] ?? []);
  };

  const currentlyBusyIds = useMemo(() => {
    if (!selection) return new Set<string>();
    const dateKey = normalizeDateKey(selection.day);
    const busy = new Set<string>();
    Object.entries(assignments).forEach(([key, ids]) => {
      if (!key.startsWith(`${dateKey}__`)) return;
      ids.forEach((id) => busy.add(id));
    });
    const currentKey = assignmentKey(dateKey, selection.slotIndex);
    (assignments[currentKey] ?? []).forEach((id) => busy.delete(id));
    return busy;
  }, [selection, assignments]);

  const availableNurses = useMemo(
    () => nurses.filter((n) => !currentlyBusyIds.has(n.id)),
    [nurses, currentlyBusyIds]
  );

  const toggleNurse = (nurseId: string) => {
    setSelectedNurseIds((prev) => {
      if (prev.includes(nurseId)) return [];
      return [nurseId];
    });
  };

  const saveSlotAssignment = () => {
    if (!selection) return;
    const dateKey = normalizeDateKey(selection.day);
    const key = assignmentKey(dateKey, selection.slotIndex);
    setAssignments((prev) => ({ ...prev, [key]: selectedNurseIds }));
    setSelection(null);
    setSelectedNurseIds([]);
  };

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
            <button type="button" onClick={goPrev} className="inline-flex size-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800" aria-label="Previous">
              <AngleLeftIcon className="size-4" />
            </button>
            <button type="button" onClick={() => setAnchor(startOfDay(new Date()))} className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/40">
              Today
            </button>
            <button type="button" onClick={goNext} className="inline-flex size-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800" aria-label="Next">
              <AngleRightIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900/30 sm:p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 dark:border-gray-800">
          <p className="text-base font-semibold text-gray-900 dark:text-white">{rangeTitle}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Slots: {requestedSlotHours}h ? Capacity: {slotCapacity} nurse{slotCapacity > 1 ? "s" : ""}
          </p>
        </div>

        {view === "month" && <ScheduleMonthView visibleMonth={visibleMonth} events={allEvents} />}
        {view === "week" && (
          <ScheduleWeekView
            weekAnchor={anchor}
            events={allEvents}
            slotHours={requestedSlotHours}
            slotCapacity={slotCapacity}
            getAssignedCount={getAssignedCount}
            onSelectSlot={openSlotSelection}
          />
        )}
        {view === "day" && (
          <ScheduleDayView
            day={anchor}
            events={allEvents}
            slotHours={requestedSlotHours}
            slotCapacity={slotCapacity}
            getAssignedCount={getAssignedCount}
            onSelectSlot={openSlotSelection}
          />
        )}
      </div>

      {selection && (
        <div className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Assign Nurses</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {format(selection.day, "dd MMM yyyy")} - {formatHourLabel(selection.slotIndex * requestedSlotHours)} to{" "}
              {formatHourLabel((selection.slotIndex + 1) * requestedSlotHours - 1)} - Max {slotCapacity}
            </p>

            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {availableNurses.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No nurses available for this slot.</p>}
              {availableNurses.map((nurse) => {
                const checked = selectedNurseIds.includes(nurse.id);
                const atLimit = !checked && selectedNurseIds.length >= slotCapacity;
                return (
                  <label key={nurse.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${checked ? "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/40" : "border-gray-200 dark:border-gray-700"} ${atLimit ? "opacity-60" : ""}`}>
                    <span className="text-gray-800 dark:text-gray-200">{nurse.name} <span className="text-gray-500">({nurse.unit})</span></span>
                    <input type="checkbox" checked={checked} disabled={atLimit} onChange={() => toggleNurse(nurse.id)} />
                  </label>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">Selected {selectedNurseIds.length} / {slotCapacity}</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setSelection(null); setSelectedNurseIds([]); }} className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">Cancel</button>
                <button type="button" onClick={saveSlotAssignment} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
