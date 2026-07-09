import { httpService } from "./httpService";
import type {
  BillingRateHistoryResponse,
  BillingRateTier,
  BillingRateType,
  CreateBillingRatePayload,
  UpdateBillingRatePayload,
} from "../types/providerBilling";

function billingBase(providerId: number): string {
  return `/admin/providers/${providerId}/billing-rates`;
}

function normalizeBillingRate(raw: unknown): BillingRateTier {
  const record = (raw ?? {}) as Record<string, unknown>;
  return {
    id: Number(record.id),
    providerId: Number(record.providerId ?? record.provider_id ?? 0),
    amount: String(record.amount ?? ""),
    type: String(record.type ?? "").toUpperCase() as BillingRateType,
    validFrom: String(record.validFrom ?? record.valid_from ?? ""),
    validTo:
      record.validTo != null || record.valid_to != null
        ? String(record.validTo ?? record.valid_to)
        : null,
    createdAt:
      record.createdAt != null || record.created_at != null
        ? String(record.createdAt ?? record.created_at)
        : undefined,
  };
}

function unwrapActiveRates(payload: unknown): BillingRateTier[] {
  let node: unknown = payload;

  for (let depth = 0; depth < 4; depth += 1) {
    if (Array.isArray(node)) {
      return node.map(normalizeBillingRate);
    }
    if (!node || typeof node !== "object") break;

    const record = node as Record<string, unknown>;
    for (const key of ["rates", "items", "history"]) {
      if (Array.isArray(record[key])) {
        return (record[key] as unknown[]).map(normalizeBillingRate);
      }
    }

    if (record.data != null) {
      node = record.data;
      continue;
    }
    break;
  }

  return [];
}

function parseBillingHistoryResponse(payload: unknown): BillingRateTier[] {
  let node: unknown = payload;

  for (let depth = 0; depth < 4; depth += 1) {
    if (!node || typeof node !== "object" || Array.isArray(node)) break;

    const record = node as Record<string, unknown>;
    if (Array.isArray(record.history)) {
      return record.history.map(normalizeBillingRate);
    }

    if (record.data != null) {
      node = record.data;
      continue;
    }
    break;
  }

  return [];
}

export const providerBillingApi = {
  getBillingRates: async (providerId: number, config?: { signal?: AbortSignal }) => {
    const res = await httpService.get<BillingRateTier[] | { data?: BillingRateTier[] }>(
      billingBase(providerId),
      { signal: config?.signal }
    );
    return unwrapActiveRates(res.data ?? res);
  },

  getBillingHistory: async (providerId: number, config?: { signal?: AbortSignal }) => {
    const res = await httpService.get<BillingRateHistoryResponse | { data?: BillingRateHistoryResponse }>(
      `${billingBase(providerId)}/history`,
      { signal: config?.signal }
    );
    return parseBillingHistoryResponse(res.data ?? res);
  },

  createBillingRate: async (providerId: number, payload: CreateBillingRatePayload) => {
    const res = await httpService.post<BillingRateTier>(billingBase(providerId), payload);
    return normalizeBillingRate(res.data ?? res);
  },

  updateBillingRate: async (
    providerId: number,
    rateId: number,
    payload: UpdateBillingRatePayload
  ) => {
    const res = await httpService.put<BillingRateTier>(
      `${billingBase(providerId)}/${rateId}`,
      payload
    );
    return normalizeBillingRate(res.data ?? res);
  },

  deleteBillingRate: async (providerId: number, rateId: number) => {
    await httpService.delete(`${billingBase(providerId)}/${rateId}`);
  },

  createWithModeSwitchConfirm: async (
    providerId: number,
    payload: CreateBillingRatePayload
  ) => {
    return providerBillingApi.createBillingRate(providerId, {
      ...payload,
      confirmReplace: true,
    });
  },
};
