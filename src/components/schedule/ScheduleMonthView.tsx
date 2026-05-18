import { useMemo } from "react";
import { useTranslation } from "react-i18next";
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
import { eventDisplayClasses, eventTypeDotClass } from "./scheduleEventStyles";

type Props = {
  visibleMonth: Date;
  events: ScheduleEventRecord[];
  dayInRange: (day: Date) => boolean;
  onSelectDay: (day: Date) => void;
  onEventClick: (event: ScheduleEventRecord) => void;
};

function eventsForDay(events: ScheduleEventRecord[], day: Date): ScheduleEventRecord[] {
  return events.filter((e) => {
    const { start } = parseEventRange(e);
    return isSameDay(start, day);
  });
}

export function ScheduleMonthView({
  visibleMonth,
  events,
  dayInRange,
  onSelectDay,
  onEventClick,
}: Props) {
  const { t } = useTranslation();
  const weekdayLabels = useMemo(
    () => [
      t("scheduleCalendar.weekdayMon"),
      t("scheduleCalendar.weekdayTue"),
      t("scheduleCalendar.weekdayWed"),
      t("scheduleCalendar.weekdayThu"),
      t("scheduleCalendar.weekdayFri"),
      t("scheduleCalendar.weekdaySat"),
      t("scheduleCalendar.weekdaySun"),
    ],
    [t]
  );

  const monthStart = startOfMonth(visibleMonth);
  const monthEnd = endOfMonth(visibleMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 border-b-2 border-gray-300 dark:border-gray-600">
          {weekdayLabels.map((d) => (
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
                } ${
                  selectable
                    ? "cursor-pointer hover:bg-brand-50/40 dark:hover:bg-brand-950/15"
                    : "cursor-not-allowed border-dashed border-gray-400 bg-gray-200/80 opacity-100 dark:border-gray-500 dark:bg-gray-800/85"
                }`}
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
                      role="button"
                      tabIndex={0}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onEventClick(e);
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" || ev.key === " ") {
                          ev.preventDefault();
                          ev.stopPropagation();
                          onEventClick(e);
                        }
                      }}
                      title={`${e.title}${e.feeLabel ? ` | ${t("scheduleCalendar.feeLine", { amount: e.feeLabel })}` : ""} (${format(parseEventRange(e).start, "HH:mm")}–${format(parseEventRange(e).end, "HH:mm")})`}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight sm:text-xs cursor-pointer ${eventDisplayClasses(e.type, e.pending)}`}
                    >
                      <div className="truncate">
                        <span className={`mr-1 inline-block size-1.5 rounded-full align-middle ${eventTypeDotClass(e.type)}`} />
                        {e.title}
                      </div>
                      {e.feeLabel ? (
                        <div className="truncate">{t("scheduleCalendar.feeLine", { amount: e.feeLabel })}</div>
                      ) : null}
                    </div>
                  ))}
                  {more > 0 && (
                    <p className="pl-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                      {t("scheduleCalendar.moreCount", { count: more })}
                    </p>
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
