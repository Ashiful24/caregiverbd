import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router";
import clsx from "clsx";
import { ChevronLeft, Loader2, Star, X } from "lucide-react";
import { initials, statusMeta, type Tone } from "./format";

// ------------------------------------------------------------------ toast

type ToastMsg = { id: number; text: string; kind: "ok" | "err" };
const ToastCtx = createContext<(text: string, kind?: "ok" | "err") => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([]);
  const push = useCallback((text: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, kind }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === "err" ? 5000 : 2800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none absolute inset-x-0 top-14 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={clsx(
              "pointer-events-auto w-full rounded-xl px-4 py-3 text-sm font-medium shadow-lg",
              t.kind === "ok" ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-red-600 text-white"
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// ------------------------------------------------------------------ layout

export function Screen({
  title,
  back,
  right,
  children,
  footer,
  nav,
  subtitle,
}: {
  title?: ReactNode;
  back?: boolean | string;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  nav?: ReactNode;
  subtitle?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-950">
      {(title || back || right) && (
      <header className="sticky top-0 z-20 flex min-h-12 items-center gap-2 border-y border-gray-200 bg-white/95 px-3 py-1.5 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
        {back && (
          <button
            type="button"
            aria-label="Back"
            onClick={() => (typeof back === "string" ? navigate(back) : navigate(-1))}
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-gray-900 dark:text-white">{title}</h1>
          {subtitle && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        {right}
      </header>
      )}
      <main className="flex-1 overflow-y-auto px-4 py-4">{children}</main>
      {footer && <div className="border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">{footer}</div>}
      {nav}
    </div>
  );
}

export function BottomNav({ items }: { items: Array<{ to: string; label: string; icon: ReactNode; badge?: number; end?: boolean }> }) {
  return (
    <nav className="grid border-t border-gray-200 bg-white pb-1 dark:border-gray-800 dark:bg-gray-900" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            clsx(
              "relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
              isActive ? "text-brand-600 dark:text-brand-400" : "text-gray-500 dark:text-gray-400"
            )
          }
        >
          <span className="relative">
            {it.icon}
            {!!it.badge && (
              <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] leading-4 text-white">
                {it.badge > 9 ? "9+" : it.badge}
              </span>
            )}
          </span>
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}

// ------------------------------------------------------------------ building blocks

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx(
        "block w-full rounded-2xl border border-gray-200 bg-white p-4 text-left dark:border-gray-800 dark:bg-gray-900",
        onClick && "transition hover:border-brand-300 active:scale-[0.99]",
        className
      )}
    >
      {children}
    </Comp>
  );
}

export function Section({ title, action, children, className }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("mb-5", className)}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

type BtnVariant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  children,
  variant = "primary",
  busy,
  disabled,
  onClick,
  type = "button",
  className,
  size = "md",
}: {
  children: ReactNode;
  variant?: BtnVariant;
  busy?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "md" ? "h-11 px-4 text-sm" : "h-8 px-3 text-xs",
        variant === "primary" && "bg-brand-500 text-white hover:bg-brand-600",
        variant === "secondary" && "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800",
        variant === "danger" && "border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-gray-900 dark:text-red-400",
        variant === "ghost" && "text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-gray-800",
        className
      )}
    >
      {busy && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

const TONES: Record<Tone, string> = {
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: Tone }) {
  return <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", TONES[tone])}>{children}</span>;
}

export function StatusBadge({ status, label }: { status: unknown; label?: string }) {
  const m = statusMeta(status);
  return <Badge tone={m.tone}>{label ?? m.label}</Badge>;
}

export function Avatar({ name, size = 44, tone = "brand" }: { name: unknown; size?: number; tone?: "brand" | "blue" }) {
  return (
    <div
      aria-hidden
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        tone === "brand" ? "bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </div>
  );
}

export function Stars({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
      <Star size={13} className="fill-amber-400 text-amber-400" />
      <span className="font-semibold">{Number(value || 0).toFixed(1)}</span>
      {count != null && <span className="text-gray-400">({count})</span>}
    </span>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} stars`} onClick={() => onChange(n)}>
          <Star size={30} className={n <= value ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"} />
        </button>
      ))}
    </div>
  );
}

export function KV({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-right font-medium text-gray-900 dark:text-gray-100">{children}</span>
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex justify-center py-16 text-gray-400">
      <Loader2 className="animate-spin" />
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {message}
      {onRetry && (
        <button type="button" className="ml-2 font-semibold underline" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 text-gray-300 dark:text-gray-600">{icon}</div>}
      <p className="font-semibold text-gray-800 dark:text-gray-100">{title}</p>
      {text && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "amber", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={clsx("rounded-xl px-3 py-2.5 text-sm", TONES[tone])}>{children}</div>;
}

// ------------------------------------------------------------------ forms

const inputCls =
  "h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputCls, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx(inputCls, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={clsx(inputCls, "h-auto py-2", props.className)} />;
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode }> }) {
  return (
    <div className="mb-4 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx(
            "flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition",
            value === o.value ? "bg-white text-gray-900 shadow-sm dark:bg-gray-950 dark:text-white" : "text-gray-500 dark:text-gray-400"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active ? "border-brand-500 bg-brand-500 text-white" : "border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      )}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ bottom sheet

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88%] overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-gray-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ timeline

export function Timeline({ steps }: { steps: Array<{ label: string; at?: string | null; done: boolean; note?: string | null; danger?: boolean }> }) {
  return (
    <ol className="relative ml-2 border-l border-gray-200 dark:border-gray-700">
      {steps.map((s, i) => (
        <li key={i} className="mb-3 ml-4 last:mb-0">
          <span
            className={clsx(
              "absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full",
              s.danger ? "bg-red-500" : s.done ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"
            )}
          />
          <p className={clsx("text-sm", s.done ? "font-medium text-gray-900 dark:text-gray-100" : "text-gray-400")}>{s.label}</p>
          {s.note && <p className="text-xs text-gray-500 dark:text-gray-400">{s.note}</p>}
          {s.at && <p className="text-[11px] text-gray-400">{s.at}</p>}
        </li>
      ))}
    </ol>
  );
}
