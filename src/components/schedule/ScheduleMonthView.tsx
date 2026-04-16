import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { ScheduleEventRecord } from "../../data/nurseScheduleSeed";
import { parseEventRange } from "../../data/nurseScheduleSeed";
import { eventTypeClasses, eventTypeDotClass } from "./scheduleEventStyles";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  visibleMonth: Date;
  events: ScheduleEventRecord[];
  dayInRange: (day: Date) => boolean;
  onSelectDay: (day: Date) => void;
};

function eventsForDay(events: ScheduleEventRecord[], day: Date): ScheduleEventRecord[] {
  return events.filter((e) => {
    const { start } = parseEventRange(e);
    return isSameDay(start, day);
  });
}

export function ScheduleMonthView({ visibleMonth, events, dayInRange, onSelectDay }: Props) {
  const monthStart = startOfMonth(visibleMonth);
  const monthEnd = endOfMonth(visibleMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 border-b-2 border-gray-300 dark:border-gray-600">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="border-r border-gray-300 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 last:border-r-0 dark:border-gray-600 dark:text-gray-400"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayEvents = eventsForDay(events, day);
            const inMonth = isSameMonth(day, visibleMonth);
            const today = isToday(day);
            const show = dayEvents.slice(0, 3);
            const more = dayEvents.length - show.length;

            const selectable = dayInRange(day);

            return (
              <div
                key={day.toISOString()}
                role="button"
                tabIndex={selectable ? 0 : -1}
                onClick={() => selectable && onSelectDay(day)}
                onKeyDown={(ev) => {
                  if (!selectable) return;
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    onSelectDay(day);
                  }
                }}
                className={`min-h-[100px] border-b border-r border-gray-300 p-1.5 last:border-r-0 dark:border-gray-600 sm:min-h-[120px] sm:p-2 ${
                  !inMonth ? "bg-gray-50/80 dark:bg-gray-900/40" : ""
                } ${selectable ? "cursor-pointer hover:bg-brand-50/40 dark:hover:bg-brand-950/15" : "cursor-default opacity-70"}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-medium ${
                      today
                        ? "bg-brand-500 text-white"
                        : inMonth
                          ? "text-gray-900 dark:text-gray-100"
                          : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <div className="mt-1 space-y-1">
                  {show.map((e) => (
                    <div
                      key={e.id}
                      onClick={(ev) => ev.stopPropagation()}
                      title={`${e.title} (${format(parseEventRange(e).start, "HH:mm")}–${format(parseEventRange(e).end, "HH:mm")})`}
                      className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight sm:text-xs ${eventTypeClasses(e.type)}`}
                    >
                      <span className={`mr-1 inline-block size-1.5 rounded-full align-middle ${eventTypeDotClass(e.type)}`} />
                      {e.title}
                    </div>
                  ))}
                  {more > 0 && (
                    <p className="pl-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">+{more} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
