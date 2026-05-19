import type { WalletOverviewDto, WalletResponse } from "../services/api";

/** Mobile hero: claimable online balance only (not totalBalance). */
export function walletHeroClaimableAmount(wallet: WalletResponse): string {
  return wallet.claimableBalance;
}

export function canRequestWithdrawal(wallet: WalletResponse): boolean {
  const available = Number(wallet.availableToWithdraw ?? 0);
  return Number.isFinite(available) && available > 0;
}

export function formatProviderWalletBdt(
  value: string | number | null | undefined,
): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `৳${n.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatServiceHours(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours)) return "—";
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Subtitle for “This month” tile, e.g. “+15% vs last month”. */
export function formatMonthOverMonthPercent(
  percent: number | null | undefined,
): string | null {
  if (percent == null || !Number.isFinite(percent)) return null;
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent}%`;
}

export type ProviderWalletOverviewTile = {
  key: "totalEarned" | "totalHours" | "thisMonth" | "avgPerJob";
  value: string;
  subtitle?: string | null;
};

/** Maps API overview to the 2×2 financial grid on the provider wallet screen. */
export function mapWalletOverviewTiles(
  overview: WalletOverviewDto | null | undefined,
): ProviderWalletOverviewTile[] | null {
  if (!overview) return null;

  const mom = formatMonthOverMonthPercent(overview.monthOverMonthPercent);

  return [
    {
      key: "totalEarned",
      value: formatProviderWalletBdt(overview.totalEarnedLifetime),
    },
    {
      key: "totalHours",
      value: formatServiceHours(overview.totalServiceHoursLifetime),
      subtitle: "hours",
    },
    {
      key: "thisMonth",
      value: formatProviderWalletBdt(overview.currentMonthEarnings),
      subtitle: mom ? `${mom} vs last month` : null,
    },
    {
      key: "avgPerJob",
      value:
        overview.completedJobsCount === 0 ||
        overview.avgEarningsPerCompletedJob == null
          ? "—"
          : formatProviderWalletBdt(overview.avgEarningsPerCompletedJob),
      subtitle: "Per completed service",
    },
  ];
}
