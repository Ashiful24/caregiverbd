import { useEffect, useMemo, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

export interface SearchableSelectOption<T> {
  value: T;
  label: string;
  /** Optional secondary text shown muted under the label */
  hint?: string;
}

interface SearchableSelectProps<T> {
  options: SearchableSelectOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  placeholder?: string;
  /** Text shown for the "clear" / unset option (omit to disable clearing) */
  clearLabel?: string;
  /** Search box placeholder */
  searchPlaceholder?: string;
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Lightweight searchable select. Filters options as you type.
 * Built on Radix Popover — keyboard accessible, mobile-friendly,
 * no heavy combobox dependency required.
 */
export function SearchableSelect<T extends string | number>({
  options,
  value,
  onChange,
  placeholder = "Select...",
  clearLabel = "All",
  searchPlaceholder = "Search...",
  className = "",
  disabled = false,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset query when popover closes
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Auto-focus the search box when popover opens
  useEffect(() => {
    if (open && inputRef.current) {
      // Defer to next tick so Radix has finished mounting the content
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  const selectedLabel = useMemo(() => {
    if (value == null || value === "") return null;
    return options.find((o) => o.value === value)?.label ?? null;
  }, [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.hint?.toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <Popover open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-800 transition hover:border-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-600 ${className}`}
        >
          <span className="truncate">
            {selectedLabel ?? (
              <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
            )}
          </span>
          <span className="shrink-0 text-gray-400">▾</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <div className="p-2">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          />
        </div>
        <div className="max-h-64 overflow-y-auto pb-1">
          {clearLabel ? (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={`flex w-full items-center px-3 py-2 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-gray-800 ${
                value == null
                  ? "font-medium text-brand-600 dark:text-brand-400"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              {clearLabel}
            </button>
          ) : null}
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
              No matches.
            </p>
          ) : (
            filtered.map((o) => (
              <button
                key={String(o.value)}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  value === o.value
                    ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
                    : "text-gray-700 dark:text-gray-200"
                }`}
              >
                <span className="truncate">{o.label}</span>
                {o.hint ? (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {o.hint}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
