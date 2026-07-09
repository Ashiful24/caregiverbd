export type BillingRateType =
  | "CONSULTATION"
  | "HOURLY"
  | "SHIFT_4H"
  | "SHIFT_8H"
  | "SHIFT_12H"
  | "SHIFT_24H";

export type BillingMode = "CONSULTATION" | "SHIFT_BASED" | "NOT_CONFIGURED";

export interface BillingRateTier {
  id: number;
  providerId: number;
  amount: string;
  type: BillingRateType;
  validFrom: string;
  validTo: string | null;
  createdAt?: string;
}

export interface BillingRateHistoryResponse {
  currentRate?: BillingRateTier | null;
  history: BillingRateTier[];
}

export interface CreateBillingRatePayload {
  amount: number;
  type: BillingRateType;
  confirmReplace?: boolean;
}

export interface UpdateBillingRatePayload {
  amount: number;
}

export interface BillingModeConflictData {
  requiresConfirmation: boolean;
  conflictingRates: BillingRateTier[];
}

export interface ApiErrorResponse {
  statusCode?: number;
  message?: string;
  data?: BillingModeConflictData;
}
