import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { format, isSameDay, startOfDay } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "../../lib/utils";

/** Committed value: always use `startDate` / `endDate`. Single-day pick sets both to the same date. */
export type DateRangePickerValue = {
  startDate: Date | null;
  endDate: Date | null;
};

export type DateRangePickerSelectionMode = "single" | "range";

export interface DateRangePickerProps {
  value: DateRangePickerValue;
  onChange: (value: DateRangePickerValue) => void;
  className?: string;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  placeholder?: string;
  id?: string;
  /** Initial toggle: single day vs range. Default: single. */
  defaultSelectionMode?: DateRangePickerSelectionMode;
}

const EMPTY_VALUE: DateRangePickerValue = { startDate: null, endDate: null };

export function DateRangePicker({
  value,
  onChange,
  className,
  disabled,
  align = "start",
  placeholder = "Pick a date",
  id,
  defaultSelectionMode = "single",
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState<DateRangePickerSelectionMode>(defaultSelectionMode);
  /** Picked start while waiting for end (range mode only; not committed). */
  const [pendingRangeStart, setPendingRangeStart] = useState<Date | null>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setPendingRangeStart(null);
    }
  };

  const setMode = (mode: DateRangePickerSelectionMode) => {
    if (mode === selectionMode) return;
    setSelectionMode(mode);
    setPendingRangeStart(null);
    onChange(EMPTY_VALUE);
  };

  const rangeCalendarSelected: DateRange | undefined = useMemo(() => {
    if (pendingRangeStart != null) {
      return { from: pendingRangeStart, to: undefined };
    }
    if (value.startDate != null && value.endDate != null) {
      return { from: value.startDate, to: value.endDate };
    }
    return undefined;
  }, [pendingRangeStart, value.startDate, value.endDate]);

  const label = (() => {
    const { startDate, endDate } = value;
    if (!startDate) return placeholder;
    if (!endDate || isSameDay(startDate, endDate)) return format(startDate, "PPP");
    return `${format(startDate, "PPP")} - ${format(endDate, "PPP")}`;
  })();

  const commit = (next: DateRangePickerValue) => {
    flushSync(() => {
      onChange(next);
    });
    setOpen(false);
  };

  /**
   * Range: first click sets start only (no parent onChange → no API). Second click completes
   * the range, then commit (onChange + close popover). Parent state stays unchanged until then.
   */
  const handleRangeSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      setPendingRangeStart(null);
      return;
    }

    const d0 = startOfDay(range.from);
    const d1 = range.to != null ? startOfDay(range.to) : null;

    if (d1 == null) {
      setPendingRangeStart(d0);
      return;
    }

    const start = d0 <= d1 ? d0 : d1;
    const end = d0 <= d1 ? d1 : d0;
    setPendingRangeStart(null);
    commit({ startDate: start, endDate: end });
  };

  /** Single: one tap → startDate and endDate are the same; then close. */
  const handleSingleSelect = (date: Date | undefined) => {
    if (!date) {
      onChange(EMPTY_VALUE);
      return;
    }
    const d = startOfDay(date);
    commit({ startDate: d, endDate: d });
  };

  const defaultMonth = value.startDate ?? value.endDate ?? pendingRangeStart ?? new Date();

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            "inline-flex min-h-[42px] w-full min-w-0 max-w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-800 transition hover:border-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-600 sm:min-w-[220px] sm:max-w-none",
            className
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <CalendarIcon className="size-4 shrink-0 text-gray-500 dark:text-gray-400" aria-hidden />
            <span
              className={cn("min-w-0 truncate", !value.startDate && "text-gray-500 dark:text-gray-400")}
            >
              {label}
            </span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-fit max-w-[calc(100vw-1.5rem)] p-0 sm:max-w-none"
      >
        <div className="flex w-fit max-w-full flex-col">
          <div
            className="flex gap-1 border-b border-gray-200 p-1.5 dark:border-gray-800"
            role="group"
            aria-label="Date selection mode"
          >
            <button
              type="button"
              onClick={() => setMode("single")}
              className={cn(
                "min-h-9 flex-1 rounded-md px-2 py-1.5 text-center text-xs font-medium transition-colors",
                selectionMode === "single"
                  ? "bg-brand-500 text-white shadow-sm dark:bg-brand-600"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              )}
            >
              Single date
            </button>
            <button
              type="button"
              onClick={() => setMode("range")}
              className={cn(
                "min-h-9 flex-1 rounded-md px-2 py-1.5 text-center text-xs font-medium transition-colors",
                selectionMode === "range"
                  ? "bg-brand-500 text-white shadow-sm dark:bg-brand-600"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              )}
            >
              Date range
            </button>
          </div>

          {selectionMode === "range" && pendingRangeStart != null && (
            <p className="border-b border-gray-200 px-2 py-1.5 text-center text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
              Select end date (on or after {format(pendingRangeStart, "MMM d")})
            </p>
          )}

          {selectionMode === "single" ? (
            <Calendar
              key="single"
              mode="single"
              defaultMonth={defaultMonth}
              selected={value.startDate ?? undefined}
              onSelect={handleSingleSelect}
              numberOfMonths={1}
              className="rounded-lg"
            />
          ) : (
            <Calendar
              key="range"
              mode="range"
              resetOnSelect
              defaultMonth={defaultMonth}
              selected={rangeCalendarSelected}
              onSelect={handleRangeSelect}
              numberOfMonths={1}
              className="rounded-lg"
            />
          )}

          <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-2 py-1.5 dark:border-gray-800">
            <button
              type="button"
              className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              onClick={() => {
                setPendingRangeStart(null);
                onChange(EMPTY_VALUE);
                setOpen(false);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
