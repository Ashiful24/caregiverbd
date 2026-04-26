import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import type { DayPickerProps } from "react-day-picker";
import { cn } from "../../lib/utils";

export type CalendarProps = DayPickerProps;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2", className)}
      classNames={{
        ...defaultClassNames,
        root: cn("w-fit max-w-full", defaultClassNames.root),
        months: cn("relative flex flex-col gap-3", defaultClassNames.months),
        month: cn("flex w-full min-w-0 flex-col gap-2", defaultClassNames.month),
        month_caption: cn(
          "flex h-8 items-center justify-center px-8 text-xs font-medium text-gray-900 dark:text-gray-100",
          defaultClassNames.month_caption
        ),
        caption_label: cn("text-xs font-medium", defaultClassNames.caption_label),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1 px-0.5",
          defaultClassNames.nav
        ),
        button_previous: cn(
          "inline-flex size-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          "inline-flex size-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800",
          defaultClassNames.button_next
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "w-8 text-center text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400",
          defaultClassNames.weekday
        ),
        week: cn("mt-0.5 flex w-full", defaultClassNames.week),
        day: cn("relative p-0 text-center text-xs focus-within:relative", defaultClassNames.day),
        day_button: cn(
          "inline-flex size-8 items-center justify-center rounded-md text-gray-900 hover:bg-gray-100 aria-selected:opacity-100 dark:text-gray-100 dark:hover:bg-gray-800",
          defaultClassNames.day_button
        ),
        selected: cn(
          "rounded-md bg-brand-500 text-white hover:bg-brand-500 hover:text-white focus:bg-brand-500 focus:text-white dark:bg-brand-600 dark:hover:bg-brand-600",
          defaultClassNames.selected
        ),
        today: cn("font-semibold text-brand-600 dark:text-brand-400", defaultClassNames.today),
        outside: cn("text-gray-400 opacity-50 dark:text-gray-500", defaultClassNames.outside),
        disabled: cn("text-gray-300 dark:text-gray-600", defaultClassNames.disabled),
        range_start: cn("rounded-l-md bg-brand-500 text-white", defaultClassNames.range_start),
        range_middle: cn(
          "rounded-none bg-brand-100 text-gray-900 dark:bg-brand-900/40 dark:text-gray-100",
          defaultClassNames.range_middle
        ),
        range_end: cn("rounded-r-md bg-brand-500 text-white", defaultClassNames.range_end),
        ...classNames,
      }}
      components={{
        ...components,
        Chevron: ({ orientation, className: chevronClass, ...chevronProps }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className={cn("size-3.5 shrink-0", chevronClass)} {...chevronProps} />;
        },
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
