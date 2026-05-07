import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface InfoTooltipProps {
  /** Plain-language explanation of what the field means */
  text: string;
  /** Accessible label override (defaults to "More info") */
  label?: string;
  /** Tooltip alignment relative to the icon */
  align?: "start" | "center" | "end";
  /** Tooltip side */
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Small "i" icon that opens a popover with help text on click/tap.
 * Click-only (not hover) — works the same on touch devices and desktop,
 * and won't trip on stray pointer movements.
 */
export function InfoTooltip({
  text,
  label = "More info",
  align = "start",
  side = "top",
}: InfoTooltipProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-gray-300 text-[10px] font-semibold leading-none text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          i
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="max-w-xs px-3 py-2 text-xs leading-relaxed text-gray-700 dark:text-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {text}
      </PopoverContent>
    </Popover>
  );
}
