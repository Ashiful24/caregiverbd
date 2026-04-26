import type { ScheduleEventType } from "../../data/nurseScheduleSeed";

export function eventTypeClasses(type: ScheduleEventType): string {
  switch (type) {
    case "visit":
      return "bg-brand-100 text-brand-900 border border-brand-200/80 dark:bg-brand-950/50 dark:text-brand-100 dark:border-brand-800/80";
    case "break":
      return "bg-gray-100 text-gray-800 border border-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700";
    case "training":
      return "bg-violet-100 text-violet-900 border border-violet-200/80 dark:bg-violet-950/40 dark:text-violet-100 dark:border-violet-800/80";
    case "on_call":
      return "bg-amber-100 text-amber-950 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800/80";
    default:
      return "bg-gray-100 text-gray-800 border border-gray-200";
  }
}

export function eventTypeDotClass(type: ScheduleEventType): string {
  switch (type) {
    case "visit":
      return "bg-brand-500";
    case "break":
      return "bg-gray-400";
    case "training":
      return "bg-violet-500";
    case "on_call":
      return "bg-amber-500";
    default:
      return "bg-gray-400";
  }
}
