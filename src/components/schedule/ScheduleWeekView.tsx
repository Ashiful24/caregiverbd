import { Fragment } from "react";
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
/** Fixed width so time labels align with grid; must match overlay `left` offset */
const TIME_COL_WIDTH = 52;

type Props = {
  weekAnchor: Date;
  events: ScheduleEventRecord[];
  dayInRange: (day: Date) => boolean;
  onSelectHour: (day: Date, hour24: number) => void;
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

const cellBorder = "border-b border-r border-gray-300 dark:border-gray-600";
const timeCellClass = `${cellBorder} box-border flex items-start justify-end bg-white pr-2 pt-0.5 text-right text-[10px] text-gray-400 dark:bg-gray-900/40 dark:text-gray-500`;

export function ScheduleWeekView({ weekAnchor, events, dayInRange, onSelectHour }: Props) {
  const ws = startOfWeek(weekAnchor, { weekStartsOn: 1 });
  const we = endOfWeek(weekAnchor, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: ws, end: we });
  const hours = Array.from({ length: HOUR_COUNT }, (_, i) => START_HOUR + i);
  const gridHeight = HOUR_COUNT * PX_PER_HOUR;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[880px]">
        <div className="flex border-b-2 border-gray-300 dark:border-gray-600">
          <div className="shrink-0" style={{ width: TIME_COL_WIDTH }} />
          <div className="grid min-w-0 flex-1 grid-cols-7">
            {days.map((d) => (
              <div
                key={format(d, "yyyy-MM-dd")}
                className="border-r border-gray-300 px-1 py-2 text-center last:border-r-0 dark:border-gray-600"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {format(d, "EEE")}
                </p>
                <p className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-white">{format(d, "d")}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          {/* One grid row per hour: time | day1 … day7 — shared row height guarantees line alignment */}
          <div
            className="grid w-full box-border bg-white dark:bg-gray-900/40"
            style={{
              gridTemplateColumns: `${TIME_COL_WIDTH}px repeat(7, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${HOUR_COUNT}, ${PX_PER_HOUR}px)`,
            }}
          >
            {hours.map((h) => (
              <Fragment key={h}>
                <div className={timeCellClass} style={{ height: PX_PER_HOUR, minHeight: PX_PER_HOUR }}>
                  {format(new Date(2000, 0, 1, h), "h a")}
                </div>
                {days.map((day, dayIdx) => {
                  const inRange = dayInRange(day);
                  const isLastDayCol = dayIdx === days.length - 1;
                  return (
                    <button
                      key={`${format(day, "yyyy-MM-dd")}-${h}`}
                      type="button"
                      disabled={!inRange}
                      onClick={() => onSelectHour(day, h)}
                      className={`box-border border-b border-gray-300 text-left transition-colors dark:border-gray-600 ${
                        isLastDayCol ? "border-r-0" : "border-r"
                      } ${
                        inRange
                          ? "cursor-pointer bg-white hover:bg-brand-50/50 dark:bg-gray-900/40 dark:hover:bg-brand-950/20"
                          : "cursor-not-allowed border-dashed border-gray-400 bg-gray-200/90 opacity-100 dark:border-gray-500 dark:bg-gray-800/90"
                      }`}
                      style={{ height: PX_PER_HOUR, minHeight: PX_PER_HOUR }}
                      title={inRange ? `Schedule from ${format(new Date(2000, 0, 1, h), "h a")}` : "Outside request window"}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>

          {/* Events sit above day columns only; same column widths as grid */}
          <div
            className="pointer-events-none absolute top-0 grid box-border"
            style={{
              left: TIME_COL_WIDTH,
              width: `calc(100% - ${TIME_COL_WIDTH}px)`,
              height: gridHeight,
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            }}
          >
            {days.map((day) => {
              const dayEvents = eventsForDay(events, day);
              return (
                <div
                  key={`overlay-${format(day, "yyyy-MM-dd")}`}
                  className="relative h-full border-r border-gray-300 last:border-r-0 dark:border-gray-600"
                >
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
