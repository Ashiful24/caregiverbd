import {
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  startOfWeek,
} from "date-fns";
import type { ScheduleEventRecord } from "../../data/nurseScheduleSeed";
import { parseEventRange } from "../../data/nurseScheduleSeed";
import { eventTypeClasses } from "./scheduleEventStyles";

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_COUNT = END_HOUR - START_HOUR;
const PX_PER_HOUR = 32;

function formatHourLabel(hour24: number): string {
  const normalized = ((hour24 % 24) + 24) % 24;
  const suffix = normalized < 12 ? "AM" : "PM";
  const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${hour12} ${suffix}`;
}

type Props = {
  weekAnchor: Date;
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
  const heightPct = Math.max(2, ((endMin - startMin) / totalMin) * 100);

  return { topPct, heightPct };
}

export function ScheduleWeekView({
  weekAnchor,
  events,
  slotHours,
  slotCapacity,
  getAssignedCount,
  onSelectSlot,
}: Props) {
  const ws = startOfWeek(weekAnchor, { weekStartsOn: 1 });
  const we = endOfWeek(weekAnchor, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: ws, end: we });
  const hours = Array.from({ length: HOUR_COUNT }, (_, i) => START_HOUR + i);
  const gridHeight = HOUR_COUNT * PX_PER_HOUR;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[880px]">
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          <div className="w-[52px] shrink-0" />
          <div className="grid flex-1 grid-cols-7">
            {days.map((d) => (
              <div
                key={d.toISOString()}
                className="border-r border-gray-200 px-1 py-2 text-center last:border-r-0 dark:border-gray-800"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {format(d, "EEE")}
                </p>
                <p className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-white">
                  {format(d, "d")}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
                  {Array.from({ length: 24 / slotHours }, (_, slotIndex) => {
                    const dateKey = format(d, "yyyy-MM-dd");
                    const assigned = getAssignedCount(dateKey, slotIndex);
                    const from = slotIndex * slotHours;
                    const to = from + slotHours - 1;
                    const slotLabel = `${formatHourLabel(from)} to ${formatHourLabel(to)}`;
                    return (
                      <button
                        key={slotIndex}
                        type="button"
                        onClick={() => onSelectSlot(d, slotIndex)}
                        className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        title={`${slotLabel} (${assigned}/${slotCapacity})`}
                      >
                        {slotLabel} ({assigned}/{slotCapacity})
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex">
          <div
            className="w-[52px] shrink-0 border-r border-gray-200 dark:border-gray-800"
            style={{ height: gridHeight }}
          >
            {hours.map((h) => (
              <div
                key={h}
                className="border-b border-gray-100 pr-2 text-right text-[10px] text-gray-400 dark:border-gray-800 dark:text-gray-500"
                style={{ height: PX_PER_HOUR }}
              >
                {format(new Date(2000, 0, 1, h), "h a")}
              </div>
            ))}
          </div>

          <div className="grid flex-1 grid-cols-7" style={{ height: gridHeight }}>
            {days.map((day) => {
              const dayEvents = eventsForDay(events, day);
              return (
                <div
                  key={`col-${day.toISOString()}`}
                  className="relative border-r border-gray-100 last:border-r-0 dark:border-gray-800"
                >
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
                        className={`absolute left-0.5 right-0.5 overflow-hidden rounded-md border px-1 py-0.5 text-[10px] leading-tight shadow-sm sm:left-1 sm:right-1 sm:text-xs ${eventTypeClasses(e.type)}`}
                        style={{
                          top: `${layout.topPct}%`,
                          height: `${layout.heightPct}%`,
                          minHeight: 22,
                        }}
                        title={`${e.title} (${format(start, "h a")}–${format(endDisplay, "h a")})`}
                      >
                        <p className="truncate font-semibold">{e.title}</p>
                        <p className="truncate text-[10px] opacity-90">
                          {format(start, "h a")} – {format(endDisplay, "h a")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
