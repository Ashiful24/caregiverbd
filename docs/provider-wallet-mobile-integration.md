# Provider wallet screen — mobile integration

Contract: `GET /v1/financial/wallet/me` (provider JWT). Types: `WalletResponse`, `WalletOverviewDto` in `hopeweb/src/services/api.ts`.

## Single request on open

Call **`GET /financial/wallet/me` once** when the wallet screen mounts. Do **not** aggregate overview from `GET /financial/transactions/me` (paginated).

Load **Recent activity** separately with `GET /financial/transactions/me?page=1&limit=10` when that section is shown.

## UI binding

| UI | Source |
|----|--------|
| Hero “Total balance” label | Product copy; amount = **`claimableBalance`** only |
| Withdraw CTA | Enabled when `availableToWithdraw > 0`; show pending note if `pendingWithdrawal > 0` |
| Total earned | `overview.totalEarnedLifetime` |
| Total hours | `overview.totalServiceHoursLifetime` (+ “hours” suffix) |
| This month | `overview.currentMonthEarnings`; subtitle from `overview.monthOverMonthPercent` |
| Avg./job | `overview.avgEarningsPerCompletedJob` or “—” when `completedJobsCount === 0` |
| Cash / USER wallet (optional footnote) | `walletBalance` |

Shared formatters (mirror in Flutter): `hopeweb/src/utils/providerWallet.ts` — `walletHeroClaimableAmount`, `mapWalletOverviewTiles`, `formatProviderWalletBdt`, `canRequestWithdrawal`.

## Backward compatibility

If `overview` is missing (older API), show balances from top-level fields and hide the 2×2 grid or show “Stats unavailable”.

## Backend performance

Overview is **not** computed by scanning all `service_requests` on each wallet open. The API reads `provider_wallet_overview_stats` (maintained by a DB trigger on `COMPLETED`). Deploy hope-backend migration `0062_provider_wallet_overview_stats` (table + index), then run **`pnpm db:seed`** in hope-backend so the trigger is installed (`install-provider-wallet-overview-trigger.ts`).

## Known limitations (audit)

| Topic | Behaviour |
|-------|-----------|
| **Balances vs overview** | `claimableBalance` / withdraw / pending come from wallets + withdrawal requests. `overview` is earnings from COMPLETED jobs only — numbers will differ by design. |
| **Refunds / cancel after COMPLETED** | Stats are **not** decremented; trigger skips rows already COMPLETED. Use transactions list for refunds; reconcile stats separately if needed. |
| **Soft-delete COMPLETED SR** | Trigger exits when `deleted_at` is set; stats are **not** reduced. |
| **Fee correction after COMPLETED** | Updating `provider_fee` on an already-COMPLETED row does not re-run stats (anti double-count). |
| **Cache** | 60s in-process cache per API instance; invalidated on month change or when `provider_wallet_overview_stats.updated_at` changes. |
| **First deploy** | Historical stats appear after per-provider backfill (first wallet open) or batch `backfillProviderWalletOverviewStats`. |

## QA checklist (vs admin Master Financial Report)

For a sample provider with completed online jobs:

1. **Total earned** — Sum of `provider_fee` on **COMPLETED** service requests for that provider matches `overview.totalEarnedLifetime` (admin report filtered to provider + completed).
2. **This month** — Filter admin report to current **Asia/Dhaka** calendar month on completion date; matches `currentMonthEarnings`.
3. **MoM %** — When previous month earnings > 0: `(current − previous) / previous × 100` matches `monthOverMonthPercent`; when previous = 0, API returns `null` (show “—”).
4. **Zero jobs** — New provider: `avgEarningsPerCompletedJob` null, hours 0.
5. **Pending withdrawal** — `availableToWithdraw = claimableBalance − pendingWithdrawal`; withdraw disabled when ≤ 0.
6. **Cash jobs** — Hero still claimable only; `walletBalance` reflects USER/cash side unchanged.
