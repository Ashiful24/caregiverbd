import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAuth } from "../../context/AuthContext";
import {
  type NavCommand,
  commandMatchesQuery,
  filterCommandsForRole,
  sortCommandsByGroup,
} from "../../navigation/commandRegistry";

const RECENTS_KEY = "hope_cmd_recents_v1";
const MAX_RECENTS = 8;

function loadRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function saveRecentIds(ids: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(ids.slice(0, MAX_RECENTS)));
  } catch {
    /* ignore quota */
  }
}

function pushRecent(id: string) {
  const cur = loadRecentIds().filter((x) => x !== id);
  saveRecentIds([id, ...cur].slice(0, MAX_RECENTS));
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CommandPalette({ open, onClose }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = String(user?.role ?? "").toUpperCase();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const visibleBase = useMemo(
    () => sortCommandsByGroup(filterCommandsForRole(role)),
    [role],
  );

  const { rows, flatCommands } = useMemo(() => {
    const q = query.trim();
    if (q.length > 0) {
      const matched = visibleBase.filter((cmd) =>
        commandMatchesQuery(cmd, q, t(cmd.titleKey)),
      );
      const sorted = sortCommandsByGroup(matched);
      return {
        rows: [
          {
            type: "heading" as const,
            key: "results",
            label: t("common.commandPalette.sectionResults"),
          },
          ...sorted.map((cmd) => ({ type: "item" as const, key: cmd.id, cmd })),
        ],
        flatCommands: sorted,
      };
    }

    const recentIds = loadRecentIds();
    const recentCommands: NavCommand[] = [];
    const seen = new Set<string>();
    for (const rid of recentIds) {
      const c = visibleBase.find((x) => x.id === rid);
      if (c && !seen.has(c.id)) {
        recentCommands.push(c);
        seen.add(c.id);
      }
    }

    const rest = visibleBase.filter((c) => !seen.has(c.id));

    const sectionLabel = (group: NavCommand["group"]) =>
      t(`common.commandPalette.group_${group}`);

    const rowsBuild: (
      | { type: "heading"; key: string; label: string }
      | { type: "item"; key: string; cmd: NavCommand }
    )[] = [];

    if (recentCommands.length > 0) {
      rowsBuild.push({
        type: "heading",
        key: "recent",
        label: t("common.commandPalette.group_recent"),
      });
      for (const cmd of recentCommands) {
        rowsBuild.push({ type: "item", key: cmd.id, cmd });
      }
    }

    let currentGroup: NavCommand["group"] | null = null;
    for (const cmd of rest) {
      if (cmd.group !== currentGroup) {
        currentGroup = cmd.group;
        rowsBuild.push({
          type: "heading",
          key: `g-${cmd.group}-${rowsBuild.length}`,
          label: sectionLabel(cmd.group),
        });
      }
      rowsBuild.push({ type: "item", key: cmd.id, cmd });
    }

    const flat = rowsBuild
      .filter(
        (r): r is { type: "item"; key: string; cmd: NavCommand } =>
          r.type === "item",
      )
      .map((r) => r.cmd);

    return { rows: rowsBuild, flatCommands: flat };
  }, [query, t, visibleBase]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, open, role]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const tId = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(tId);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const active = listRef.current?.querySelector<HTMLElement>(
      `[data-cmd-index="${selectedIndex}"]`,
    );
    active?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, open, flatCommands.length]);

  const runCommand = useCallback(
    (cmd: NavCommand) => {
      pushRecent(cmd.id);
      navigate(cmd.path);
      onClose();
      setQuery("");
    },
    [navigate, onClose],
  );

  useEffect(() => {
    if (!open) return;

    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", onDocKey, true);
    return () => document.removeEventListener("keydown", onDocKey, true);
  }, [open, onClose]);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) =>
        flatCommands.length === 0 ? 0 : (i + 1) % flatCommands.length,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) =>
        flatCommands.length === 0
          ? 0
          : (i - 1 + flatCommands.length) % flatCommands.length,
      );
    } else if (e.key === "Enter" && flatCommands[selectedIndex]) {
      e.preventDefault();
      runCommand(flatCommands[selectedIndex]);
    }
  };

  if (!open) return null;

  const portal = (
    <div
      className="fixed inset-0 z-[200000] flex items-start justify-center bg-gray-900/50 px-3 py-10 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-heading"
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="command-palette-heading" className="sr-only">
          {t("common.commandPalette.dialogLabel")}
        </h2>
        <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-800">
          <input
            ref={inputRef}
            type="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={t("common.commandPalette.filterPlaceholder")}
            className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-900 outline-none ring-0 placeholder:text-gray-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-white/[0.05] dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
        <div
          ref={listRef}
          className="max-h-[min(60vh,420px)] overflow-y-auto py-2"
          role="listbox"
          aria-label={t("common.commandPalette.listLabel")}
        >
          {flatCommands.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {t("common.commandPalette.noResults")}
            </p>
          ) : (
            (() => {
              let itemIdx = -1;
              return rows.map((row) => {
                if (row.type === "heading") {
                  return (
                    <div
                      key={row.key}
                      className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 first:pt-1 dark:text-gray-500"
                    >
                      {row.label}
                    </div>
                  );
                }
                itemIdx += 1;
                const idx = itemIdx;
                const isSel = idx === selectedIndex;
                return (
                  <button
                    key={row.key}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    data-cmd-index={idx}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                      isSel
                        ? "bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200"
                        : "text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/[0.04]"
                    }`}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => runCommand(row.cmd)}
                  >
                    <span>{t(row.cmd.titleKey)}</span>
                    <span className="ml-2 truncate text-xs text-gray-400 dark:text-gray-500">
                      {row.cmd.path}
                    </span>
                  </button>
                );
              });
            })()
          )}
        </div>
        <div className="border-t border-gray-200 px-4 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
          {t("common.commandPalette.footerHint")}
        </div>
      </div>
    </div>
  );

  return createPortal(portal, document.body);
}
