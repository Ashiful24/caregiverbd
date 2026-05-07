import { InfoTooltip } from "../../components/common/InfoTooltip";
import type {
  FinancialTxType,
  FinancialTxStatus,
} from "../../services/api";

// ────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ────────────────────────────────────────────────────────────────────────────

export function toISODateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Format BDT amount string. Handles "1234.56" and number. Falls back to em-dash for null. */
export function fmtBDT(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `৳${n.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const TX_TYPES: { value: FinancialTxType; label: string }[] = [
  { value: "CONSULTATION_PAYMENT", label: "Payment" },
  { value: "WITHDRAWAL", label: "Withdrawal" },
  { value: "REFUND", label: "Refund" },
  { value: "COMMISSION", label: "Commission" },
  { value: "ADJUSTMENT", label: "Adjustment" },
];

export const TX_STATUSES: { value: FinancialTxStatus; label: string }[] = [
  { value: "COMPLETED", label: "Completed" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function statusBadgeColor(
  s: FinancialTxStatus,
): "success" | "warning" | "error" | "light" {
  if (s === "COMPLETED") return "success";
  if (s === "PENDING") return "warning";
  if (s === "FAILED" || s === "CANCELLED") return "error";
  return "light";
}

export function txTypeLabel(t: FinancialTxType): string {
  return TX_TYPES.find((x) => x.value === t)?.label ?? t;
}

export const DEFAULT_LIMIT = 20;
export const MAX_RANGE_DAYS = 90;

// ────────────────────────────────────────────────────────────────────────────
// Presentational atoms
// ────────────────────────────────────────────────────────────────────────────

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
  tooltip,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "positive" | "negative" | "neutral";
  tooltip?: string;
}) {
  const toneClasses =
    tone === "positive"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "negative"
      ? "text-rose-700 dark:text-rose-400"
      : tone === "neutral"
      ? "text-gray-700 dark:text-gray-300"
      : "text-gray-900 dark:text-white";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}
        </p>
        {tooltip ? <InfoTooltip text={tooltip} /> : null}
      </div>
      <p className={`mt-1.5 text-xl font-semibold ${toneClasses}`}>{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function HealthDot({ healthy }: { healthy: boolean }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${
        healthy ? "bg-emerald-500" : "bg-rose-500"
      }`}
      title={healthy ? "Healthy" : "Drift detected"}
    />
  );
}
