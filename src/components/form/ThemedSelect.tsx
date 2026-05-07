import React, { useMemo, useRef, useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";

type OptionLike = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SyntheticSelectEvent = {
  target: { value: string };
};

interface ThemedSelectProps {
  id?: string;
  value: string | number;
  onChange: (e: SyntheticSelectEvent) => void;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}

export default function ThemedSelect({
  id,
  value,
  onChange,
  className = "",
  disabled = false,
  children,
}: ThemedSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const normalizedValue = String(value ?? "");

  const options = useMemo<OptionLike[]>(() => {
    return React.Children.toArray(children)
      .filter(React.isValidElement)
      .map((child) => {
        const c = child as React.ReactElement<{ value?: string | number; disabled?: boolean; children?: React.ReactNode }>;
        return {
          value: String(c.props.value ?? ""),
          label: String(c.props.children ?? ""),
          disabled: Boolean(c.props.disabled),
        };
      });
  }, [children]);

  const selected = options.find((opt) => opt.value === normalizedValue);

  const handleSelect = (nextValue: string) => {
    onChange({ target: { value: nextValue } });
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={`dropdown-toggle inline-flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-800 shadow-theme-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 ${className}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <svg className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <Dropdown isOpen={isOpen} onClose={() => setIsOpen(false)} anchorRef={triggerRef} className="min-w-[12rem] p-1">
        <div style={{ width: `${triggerRef.current?.offsetWidth ?? 192}px` }}>
          {options.map((opt) => {
            const isSelected = opt.value === normalizedValue;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                onClick={() => !opt.disabled && handleSelect(opt.value)}
                className={`mb-0.5 block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors last:mb-0 ${
                  isSelected
                    ? "bg-brand-500 text-white hover:bg-brand-600"
                    : "text-gray-700 hover:bg-brand-50 hover:text-brand-700 dark:text-gray-200 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                } ${opt.disabled ? "cursor-not-allowed opacity-50" : ""}`}
                role="option"
                aria-selected={isSelected}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Dropdown>
    </div>
  );
}

