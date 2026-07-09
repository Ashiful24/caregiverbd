export const providerBillingKeys = {
  rates: (providerId: number) => ["provider-billing", providerId] as const,
  history: (providerId: number) => ["provider-billing-history", providerId] as const,
};
