import { format, isSameDay } from "date-fns";
import type { ScheduleEventRecord } from "../../data/nurseScheduleSeed";
import { parseEventRange } from "../../data/nurseScheduleSeed";
import { eventTypeClasses } from "./scheduleEventStyles";

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_COUNT = END_HOUR - START_HOUR;
const PX_PER_HOUR = 36;

function formatHourLabel(hour24: number): string {
  const normalized = ((hour24 % 24) + 24) % 24;
  const suffix = normalized < 12 ? "AM" : "PM";
  const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${hour12} ${suffix}`;
}

type Props = {
  day: Date;
  events: ScheduleEventRecord[];
  slotHours: 4 | 8 | 12;
  slotCapacity: number;
  getAssignedCount: (dateKey: string, slotIndex: number) => number;
  onSelectSlot: (day: Date, slotIndex: number) => void;
};

function eventsForDay(events: ScheduleEventRecord[], day: Date): ScheduleEventRecord[] {
  return events.filter((e) => {
    const { start } = parseEventRange(e);
    return isSameDay(start, day);
  });
}

function layoutEvent(day: Date, e: ScheduleEventRecord) {
  const { start, end } = parseEventRange(e);
  const dayStart = new Date(day);
  dayStart.setHours(START_HOUR, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(END_HOUR, 0, 0, 0);

  const clipStart = start < dayStart ? dayStart : start;
  const clipEnd = end > dayEnd ? dayEnd : end;
  if (clipEnd <= clipStart) return null;

  const totalMin = HOUR_COUNT * 60;
  const startMin = (clipStart.getTime() - dayStart.getTime()) / 60000;
  const endMin = (clipEnd.getTime() - dayStart.getTime()) / 60000;
  const topPct = Math.max(0, (startMin / totalMin) * 100);
  const heightPct = Math.max(3, ((endMin - startMin) / totalMin) * 100);

  return { topPct, heightPct };
}

export function ScheduleDayView({
  day,
  events,
  slotHours,
  slotCapacity,
  getAssignedCount,
  onSelectSlot,
}: Props) {
  const hours = Array.from({ length: HOUR_COUNT }, (_, i) => START_HOUR + i);
  const dayEvents = eventsForDay(events, day);
  const dateKey = format(day, "yyyy-MM-dd");

  return (
    <div className="overflow-x-auto">
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 text-center sm:text-left">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{format(day, "EEEE, MMMM d, yyyy")}</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {Array.from({ length: 24 / slotHours }, (_, slotIndex) => {
              const assigned = getAssignedCount(dateKey, slotIndex);
              const from = slotIndex * slotHours;
              const to = from + slotHours - 1;
              const slotLabel = `${formatHourLabel(from)} to ${formatHourLabel(to)}`;
              return (
                <button
                  key={slotIndex}
                  type="button"
                  onClick={() => onSelectSlot(day, slotIndex)}
                  className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  {slotLabel} ({assigned}/{slotCapacity})
                </button>
              );
            })}
          </div>
        </div>
        <div className="relative flex rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900/40">
          <div className="w-14 shrink-0 border-r border-gray-100 dark:border-gray-800">
            {hours.map((h) => (
              <div
                key={h}
                className="border-b border-gray-100 pr-2 text-right text-[11px] text-gray-400 dark:border-gray-800 dark:text-gray-500"
                style={{ height: PX_PER_HOUR }}
              >
                {format(new Date(2000, 0, 1, h), "h a")}
              </div>
            ))}
          </div>
          <div className="relative min-h-0 flex-1" style={{ height: HOUR_COUNT * PX_PER_HOUR }}>
            {hours.map((h) => (
              <div
                key={h}
                className="border-b border-gray-100 dark:border-gray-800/80"
                style={{ height: PX_PER_HOUR }}
              />
            ))}
            {dayEvents.map((e) => {
              const layout = layoutEvent(day, e);
              if (!layout) return null;
              const { start, end } = parseEventRange(e);
              const endDisplay =
                end.getHours() === 0 && end > start ? new Date(end.getTime() - 60_000) : end;
              return (
                <div
                  key={e.id}
                  className={`absolute left-2 right-3 overflow-hidden rounded-lg border px-2 py-1.5 shadow-sm sm:left-3 sm:right-4 ${eventTypeClasses(e.type)}`}
                  style={{
                    top: `${layout.topPct}%`,
                    height: `${layout.heightPct}%`,
                    minHeight: 40,
                  }}
                >
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{e.title}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    {format(start, "h a")} – {format(endDisplay, "h a")}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
