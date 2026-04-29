import { Fragment } from "react";
import { format, isSameDay } from "date-fns";
import type { ScheduleEventRecord } from "../../data/nurseScheduleSeed";
import { parseEventRange } from "../../data/nurseScheduleSeed";
import { eventTypeClasses } from "./scheduleEventStyles";

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_COUNT = END_HOUR - START_HOUR;
const PX_PER_HOUR = 36;
const TIME_COL_WIDTH = 52;

type Props = {
  day: Date;
  events: ScheduleEventRecord[];
  dayInRange: (day: Date) => boolean;
  onSelectHour: (day: Date, hour24: number) => void;
  onEventClick: (event: ScheduleEventRecord) => void;
};

function eventsForDay(events: ScheduleEventRecord[], d: Date): ScheduleEventRecord[] {
  return events.filter((e) => {
    const { start } = parseEventRange(e);
    return isSameDay(start, d);
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

const cellBorder = "border-b border-r border-gray-300 dark:border-gray-600";
const timeCellClass = `${cellBorder} box-border flex items-start justify-end bg-white pr-2 pt-0.5 text-right text-[11px] text-gray-400 dark:bg-gray-900/40 dark:text-gray-500`;

export function ScheduleDayView({
  day,
  events,
  dayInRange,
  onSelectHour,
  onEventClick,
}: Props) {
  const hours = Array.from({ length: HOUR_COUNT }, (_, i) => START_HOUR + i);
  const dayEvents = eventsForDay(events, day);
  const inRange = dayInRange(day);

  return (
    <div className="overflow-x-auto">
      <div className="mx-auto max-w-3xl">
        <div className="mb-3 text-center sm:text-left">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{format(day, "EEEE, MMMM d, yyyy")}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {inRange ? "Click an hour row to add a visit (minimum 1 hour)." : "This day is outside the service request window."}
          </p>
        </div>
        <div className="relative rounded-xl border-2 border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900/40">
          <div
            className="grid w-full box-border"
            style={{
              gridTemplateColumns: `${TIME_COL_WIDTH}px minmax(0, 1fr)`,
              gridTemplateRows: `repeat(${HOUR_COUNT}, ${PX_PER_HOUR}px)`,
            }}
          >
            {hours.map((h) => (
              <Fragment key={h}>
                <div className={timeCellClass} style={{ height: PX_PER_HOUR, minHeight: PX_PER_HOUR }}>
                  {format(new Date(2000, 0, 1, h), "h a")}
                </div>
                <button
                  type="button"
                  disabled={!inRange}
                  onClick={() => onSelectHour(day, h)}
                  className={`box-border border-b border-gray-300 text-left transition-colors dark:border-gray-600 ${
                    inRange
                      ? "cursor-pointer bg-white hover:bg-brand-50/50 dark:bg-gray-900/40 dark:hover:bg-brand-950/20"
                      : "cursor-not-allowed border-dashed border-gray-400 bg-gray-200/90 opacity-100 dark:border-gray-500 dark:bg-gray-800/90"
                  }`}
                  style={{ height: PX_PER_HOUR, minHeight: PX_PER_HOUR }}
                />
              </Fragment>
            ))}
          </div>

          <div
            className="pointer-events-none absolute inset-0 box-border"
            style={{ paddingLeft: TIME_COL_WIDTH }}
          >
            <div className="relative h-full">
              {dayEvents.map((e) => {
                const layout = layoutEvent(day, e);
                if (!layout) return null;
                const { start, end } = parseEventRange(e);
                const endDisplay =
                  end.getHours() === 0 && end > start ? new Date(end.getTime() - 60_000) : end;
                return (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onEventClick(e)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        onEventClick(e);
                      }
                    }}
                    key={e.id}
                    className={`pointer-events-auto absolute left-2 right-3 overflow-hidden rounded-lg border px-2 py-1.5 shadow-sm sm:left-3 sm:right-4 cursor-pointer ${eventTypeClasses(e.type)}`}
                    style={{
                      top: `${layout.topPct}%`,
                      height: `${layout.heightPct}%`,
                      minHeight: 40,
                    }}
                  >
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{e.title}</p>
                    {e.feeLabel ? (
                      <p className="text-xs text-gray-600 dark:text-gray-300">Fee: {e.feeLabel}</p>
                    ) : null}
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
    </div>
  );
}
