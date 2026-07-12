import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import type { SearchableSelectOption } from "./SearchableSelect";

export type PaginatedFetchResult<T> = {
  items: SearchableSelectOption<T>[];
  total: number;
};

export type PaginatedFetchFn<T> = (
  params: { page: number; limit: number; search?: string },
  signal?: AbortSignal
) => Promise<PaginatedFetchResult<T>>;

interface PaginatedSearchableSelectProps<T extends string | number> {
  value: T | null;
  onChange: (value: T | null) => void;
  fetchPage: PaginatedFetchFn<T>;
  pageSize?: number;
  placeholder?: string;
  clearLabel?: string;
  searchPlaceholder?: string;
  seeMoreLabel?: string;
  loadingLabel?: string;
  loadingMoreLabel?: string;
  noMatchesLabel?: string;
  className?: string;
  disabled?: boolean;
}

const DEFAULT_PAGE_SIZE = 10;

export function PaginatedSearchableSelect<T extends string | number>({
  value,
  onChange,
  fetchPage,
  pageSize = DEFAULT_PAGE_SIZE,
  placeholder = "Select...",
  clearLabel = "All",
  searchPlaceholder = "Search...",
  seeMoreLabel = "See more",
  loadingLabel = "Loading...",
  loadingMoreLabel = "Loading more...",
  noMatchesLabel = "No matches.",
  className = "",
  disabled = false,
}: PaginatedSearchableSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [options, setOptions] = useState<SearchableSelectOption<T>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastBatchSize, setLastBatchSize] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SearchableSelectOption<T> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastLoadedSearchRef = useRef<string | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadFirstPage = useCallback(
    async (searchTerm: string) => {
      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;
      lastLoadedSearchRef.current = searchTerm.trim();
      setLoading(true);
      try {
        const result = await fetchPage(
          { page: 1, limit: pageSize, search: searchTerm.trim() || undefined },
          controller.signal
        );
        if (controller.signal.aborted) return;
        setOptions(result.items);
        setTotal(result.total);
        setPage(1);
        setLastBatchSize(result.items.length);
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setOptions([]);
        setTotal(0);
        setLastBatchSize(0);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [fetchPage, pageSize]
  );

  const loadMore = useCallback(async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const result = await fetchPage({
        page: nextPage,
        limit: pageSize,
        search: searchQuery.trim() || undefined,
      });
      setTotal(result.total);
      setPage(nextPage);
      setLastBatchSize(result.items.length);
      setOptions((prev) => {
        const existing = new Set(prev.map((item) => String(item.value)));
        const extra = result.items.filter((item) => !existing.has(String(item.value)));
        return [...prev, ...extra];
      });
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, page, pageSize, searchQuery]);

  useEffect(() => {
    if (!open) {
      setSearchInput("");
      setSearchQuery("");
      lastLoadedSearchRef.current = null;
      return;
    }
    void loadFirstPage("");
  }, [open, loadFirstPage]);

  useEffect(() => {
    if (!open) return;
    if (lastLoadedSearchRef.current === searchQuery.trim()) return;
    void loadFirstPage(searchQuery);
  }, [open, searchQuery, loadFirstPage]);

  useEffect(() => {
    if (open && inputRef.current) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (value == null) {
      setSelectedSnapshot(null);
      return;
    }
    const match = options.find((option) => option.value === value);
    if (match) setSelectedSnapshot(match);
  }, [value, options]);

  const displayOptions = useMemo(() => {
    if (value == null || selectedSnapshot == null) return options;
    if (options.some((option) => option.value === value)) return options;
    return [selectedSnapshot, ...options];
  }, [options, selectedSnapshot, value]);

  const selectedLabel = useMemo(() => {
    if (value == null || value === "") return null;
    return (
      displayOptions.find((option) => option.value === value)?.label ??
      selectedSnapshot?.label ??
      null
    );
  }, [displayOptions, selectedSnapshot, value]);

  const canLoadMore =
    !loading &&
    !loadingMore &&
    lastBatchSize > 0 &&
    (total > 0 ? displayOptions.length < total : lastBatchSize >= pageSize);

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
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
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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
                setSelectedSnapshot(null);
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

          {loading ? (
            <p className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">{loadingLabel}</p>
          ) : displayOptions.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">{noMatchesLabel}</p>
          ) : (
            displayOptions.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setSelectedSnapshot(option);
                  setOpen(false);
                }}
                className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm transition hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  value === option.value
                    ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
                    : "text-gray-700 dark:text-gray-200"
                }`}
              >
                <span className="truncate">{option.label}</span>
                {option.hint ? (
                  <span className="text-xs text-gray-500 dark:text-gray-400">{option.hint}</span>
                ) : null}
              </button>
            ))
          )}

          {canLoadMore ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="flex w-full items-center justify-center border-t border-gray-100 px-3 py-2.5 text-sm font-medium text-brand-600 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-800 dark:text-brand-400 dark:hover:bg-gray-800"
            >
              {loadingMore ? loadingMoreLabel : seeMoreLabel}
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
