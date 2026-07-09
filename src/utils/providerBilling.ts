import type { ApiError } from "../services/httpService";
import type {
  BillingMode,
  BillingModeConflictData,
  BillingRateTier,
  BillingRateType,
} from "../types/providerBilling";

export const CONSULTATION_BILLING_TYPES = ["CONSULTATION"] as const satisfies readonly BillingRateType[];

export const SHIFT_BILLING_TYPES = [
  "HOURLY",
  "SHIFT_4H",
  "SHIFT_8H",
  "SHIFT_12H",
  "SHIFT_24H",
] as const satisfies readonly BillingRateType[];

export const ALL_BILLING_TYPES = [
  ...CONSULTATION_BILLING_TYPES,
  ...SHIFT_BILLING_TYPES,
] as const satisfies readonly BillingRateType[];

export function isConsultationType(type: BillingRateType): boolean {
  return type === "CONSULTATION";
}

export function isShiftType(type: BillingRateType): boolean {
  return SHIFT_BILLING_TYPES.includes(type as (typeof SHIFT_BILLING_TYPES)[number]);
}

export function detectBillingMode(activeRates: BillingRateTier[]): BillingMode {
  if (activeRates.length === 0) return "NOT_CONFIGURED";
  if (activeRates.some((rate) => rate.type === "CONSULTATION")) return "CONSULTATION";
  return "SHIFT_BASED";
}

export function getCreatableBillingTypes(
  mode: BillingMode,
  activeRates: BillingRateTier[]
): BillingRateType[] {
  const activeTypes = new Set(activeRates.map((rate) => rate.type));

  if (mode === "CONSULTATION") {
    return SHIFT_BILLING_TYPES.filter((type) => !activeTypes.has(type));
  }

  if (mode === "SHIFT_BASED") {
    const remainingShiftTypes = SHIFT_BILLING_TYPES.filter((type) => !activeTypes.has(type));
    return activeTypes.has("CONSULTATION") ? remainingShiftTypes : ["CONSULTATION", ...remainingShiftTypes];
  }

  return ALL_BILLING_TYPES.filter((type) => !activeTypes.has(type));
}

/** @deprecated Use getCreatableBillingTypes */
export function getAddableBillingTypes(
  mode: BillingMode,
  activeRates: BillingRateTier[]
): BillingRateType[] {
  return getCreatableBillingTypes(mode, activeRates);
}

export function validateBillingAmount(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "providerBilling.validation.amountRequired";
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) return "providerBilling.validation.amountMin";
  return null;
}

export function parseBillingModeConflict(error: unknown): BillingModeConflictData | null {
  const apiError = error as ApiError;
  if (apiError?.status !== 409) return null;
  if (isDuplicateBillingTypeError(error)) return null;

  const body = apiError.data as Record<string, unknown> | undefined;
  const nested = (body?.data ?? body) as BillingModeConflictData | undefined;

  if (nested?.requiresConfirmation === true) {
    return {
      requiresConfirmation: true,
      conflictingRates: Array.isArray(nested.conflictingRates) ? nested.conflictingRates : [],
    };
  }

  return null;
}

export function isDuplicateBillingTypeError(error: unknown): boolean {
  const apiError = error as ApiError;
  if (apiError?.status !== 409) return false;
  const message = String(apiError.message ?? apiError.data?.message ?? "").toLowerCase();
  return message.includes("already exists");
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const apiError = error as ApiError;
  return String(apiError?.message ?? apiError?.data?.message ?? fallback);
}
