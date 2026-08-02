import type { SystemConfigItem } from "../../services/api";

export type ConfigGroupId = "features" | "financial" | "registration" | "other";

const BOOLEAN_KEYS = new Set([
  "SMS_ENABLED",
  "EMAIL_ENABLED",
  "NEW_SERVICE_REQUESTS_ENABLED",
  "COMMISSION_INCLUSIVE",
  "TAX_INCLUSIVE",
]);

const PERCENT_KEYS = new Set([
  "SERVICE_TAX_PERCENT",
  "SERVICE_AIT_PERCENT",
]);

const METERS_KEYS = new Set([
  "ARRIVAL_MAX_DISTANCE_METERS",
]);

const SECONDS_KEYS = new Set([
  "OTP_RESEND_COOLDOWN_SECONDS",
]);

export function isBooleanConfigKey(key: string): boolean {
  return BOOLEAN_KEYS.has(key) || key.endsWith("_ENABLED");
}

export function isPercentConfigKey(key: string): boolean {
  return PERCENT_KEYS.has(key) || key.includes("_PERCENT");
}

export function isMetersConfigKey(key: string): boolean {
  return METERS_KEYS.has(key) || key.endsWith("_METERS");
}

export function isDemoOtpConfigKey(key: string): boolean {
  return key.toUpperCase() === "DEMO_OTP";
}

/** True when DEMO_OTP is treated as off (matches backend resolveDemoOtp). */
export function isDemoOtpOff(value: string | null | undefined): boolean {
  const lower = String(value ?? "").trim().toLowerCase();
  return !lower || lower === "off" || lower === "disabled" || lower === "false" || lower === "none";
}

/** Valid fixed demo OTP: 4–8 digits (matches backend). */
export function isValidDemoOtpCode(value: string): boolean {
  return /^\d{4,8}$/.test(value.trim());
}

export function isSecondsConfigKey(key: string): boolean {
  return SECONDS_KEYS.has(key) || key.endsWith("_SECONDS");
}

export function configGroupForKey(key: string): ConfigGroupId {
  const k = key.toUpperCase();
  if (k.includes("REGISTRATION") || k.includes("DEFAULT_")) return "registration";
  if (
    k.includes("COMMISSION") ||
    k.includes("TAX") ||
    k.includes("AIT") ||
    k.includes("PERCENT")
  ) {
    return "financial";
  }
  if (
    k.endsWith("_ENABLED") ||
    k === "DEMO_OTP" ||
    k.includes("OTP") ||
    k.includes("ARRIVAL") ||
    k.endsWith("_METERS") ||
    k.endsWith("_SECONDS")
  ) {
    return "features";
  }
  return "other";
}

export function groupSystemConfigs(items: SystemConfigItem[]): Record<ConfigGroupId, SystemConfigItem[]> {
  const groups: Record<ConfigGroupId, SystemConfigItem[]> = {
    features: [],
    financial: [],
    registration: [],
    other: [],
  };
  for (const item of items) {
    groups[configGroupForKey(item.key)].push(item);
  }
  const sortByKey = (a: SystemConfigItem, b: SystemConfigItem) => a.key.localeCompare(b.key);
  for (const id of Object.keys(groups) as ConfigGroupId[]) {
    groups[id].sort(sortByKey);
  }
  return groups;
}

export function filterSystemConfigs(items: SystemConfigItem[], query: string): SystemConfigItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.key.toLowerCase().includes(q) ||
      item.value.toLowerCase().includes(q) ||
      (item.description ?? "").toLowerCase().includes(q),
  );
}

export function formatIntervalMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    return h === 1 ? "1 hour" : `${h} hours`;
  }
  return `${minutes} min`;
}

/** i18n key under systemConfig.keys.* — falls back to formatted key */
export function configLabelKey(key: string): string {
  return `systemConfig.keys.${key}`;
}

export function formatConfigKeyFallback(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function numMeta(meta: Record<string, unknown>, field: string, fallback: number): number {
  const v = meta[field];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function strMeta(meta: Record<string, unknown>, field: string, fallback = ""): string {
  const v = meta[field];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.join(", ");
  return fallback;
}
