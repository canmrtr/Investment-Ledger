# Audit Notes

Date: 2026-05-17

Scope: Static review of the current working tree for the Portfoi / Investment Ledger React + Supabase app. Focus areas were shared-data security boundaries, RLS/edge-function behavior, portfolio privacy, ledger math, and deploy/test hygiene. No production database state or live Supabase project settings were inspected.

## Summary

- Existing static checks pass:
  - `npm run check:babel`
  - `npm run check:edge`
  - `npm run check:edge-drift`
- No source files were changed as part of this audit.
- Findings below are code-review findings only; database policies were evaluated from migrations in the repo, not from live `pg_policies`.

## Findings

### High: Authenticated users can overwrite shared `price_cache` values through `set-manual-price`

**Status:** Fixed 2026-05-19 — `fetch-prices` set-manual-price branch now requires `asset_type==="BES"` and verifies the caller owns a matching BES position before the service-role upsert; non-BES tickers and non-owners get 403. Atomic flow (`bes_update_atomic` migration 019) supersedes this mode for ongoing updates.

Evidence:
- `src/components/BesUpdateModal.js:25` and `src/components/ManuelPosForm.js:134` call `fetch-prices` with `mode:"set-manual-price"`.
- `supabase/functions/fetch-prices/index.ts:325-336` accepts any authenticated request, then uses `SUPABASE_SERVICE_ROLE_KEY` to upsert `{ ticker, price }` into the global `price_cache`.
- The handler does not verify that:
  - `asset_type === "BES"` or another explicitly manual-only type,
  - the ticker belongs to the caller,
  - the ticker is user-scoped,
  - the caller is updating only their active portfolio.

Impact:
- Any logged-in user can call the edge function directly and overwrite globally shared prices such as `AAPL`, `THYAO`, `USDTRY`, or another user's BES ticker if they know the symbol.
- Because `price_cache` is shared and read by all clients, this can distort portfolio values, allocation views, public portfolio percentages, and dashboard performance for other users.

Recommended fix:
- Do not store user-entered manual asset values in shared `price_cache`.
- Move BES/manual valuations to a user/portfolio-scoped table or scoped columns on `positions`.
- If this mode remains temporarily, enforce server-side checks before the service-role write: allow only manual asset types, verify a matching `positions` row for `auth.uid()` and `portfolio_id`, and reject tickers used by market-data-backed assets.

### Medium: Public `full` portfolio view still hides details and computes allocation from cost basis

**Status:** Fixed 2026-05-19 — public view load logic now always calls `get_allocation_only_positions` regardless of `privacy_level`; cost-basis pct fallback removed. `privacy_level='full'` column + RLS preserved for the future social full-detail UI (settings "Tam Detay" button remains intentionally disabled).

Evidence:
- `src/components/App.js:1117-1126` branches on `privacy_level === "full"` but derives `pct` from `avg_cost * shares`, not current market value.
- `src/components/App.js:1130-1132` always shows "tutar ve maliyet bilgileri gizlidir", even in `full` mode.
- `src/components/App.js:1152-1165` renders the same ticker/name/bar/percent row for both privacy modes and does not display shares, avg cost, current value, or transactions.

Impact:
- The product contract for `full` sharing is misleading: database RLS may expose raw position fields for full public portfolios, but the UI still behaves like allocation-only.
- Allocation percentages can be stale or wrong versus current market value because they use cost basis.

Recommended fix:
- Either disable/hide `full` sharing until Social Portfolio full-detail UI is implemented, or implement a distinct full-detail public view.
- For public full mode, compute allocation using current prices or clearly label it as cost-basis allocation.

### Medium: Manual BES price update can partially commit and leave inconsistent state

**Status:** Fixed 2026-05-19 — new `bes_update_atomic` RPC (migration 019, SECURITY DEFINER) updates `positions.dk_current` + `price_cache.price` in a single transaction. `BesUpdateModal` now calls the RPC; either both writes succeed or both roll back.

Evidence:
- `src/components/BesUpdateModal.js:24-36` first calls `set-manual-price`, then updates `positions.dk_current`.
- If the second Supabase update fails, the code reports "DK güncel kaydedilemedi (fiyat güncellendi)" after the shared/global price has already changed.

Impact:
- BES total value and DK breakdown can diverge. Because the price update currently writes shared `price_cache`, the inconsistent state can also affect other users until corrected.

Recommended fix:
- Make the operation atomic behind one server-side RPC/edge function that verifies ownership and updates the scoped value and DK fields in one transaction.
- This should be addressed together with the High finding by removing manual values from global `price_cache`.

### Medium: Deposit interest uses current principal for valuation after partial withdrawals

**Status:** Fixed 2026-05-19 — `computeDepositGrossInterest` now scales accumulated `grossInterest` by `newBalance/oldBalance` at each SELL. Semantics: a withdrawal pays out the withdrawn principal plus its proportional share of accrued interest; remaining balance keeps only its proportional share going forward.

Evidence:
- `src/components/App.js:5-24` computes cumulative gross interest segment-by-segment from transaction cash balances.
- `src/components/App.js:260-265` sets synthetic price factor to `(current principal + cumulative grossInterest) / current principal`.
- Market value is later calculated as `shares * price`, where `shares` is the current principal.

Impact:
- After partial withdrawals, interest accrued on withdrawn principal before withdrawal remains included in `grossInterest`, then is added to the remaining principal. This can overstate the remaining deposit value unless the product intentionally carries accrued interest separately after withdrawal.

Recommended fix:
- Define the deposit accounting model explicitly:
  - If withdrawal pays out accrued interest, reduce/realize interest at withdrawal time.
  - If interest remains attached to the account, persist an accrued-interest balance separately.
- Add unit coverage for partial withdrawal cases: buy 100, accrue, sell 50, accrue, compare expected current value.

### Low: `price_snapshots` RLS policy is broader than its comment

**Status:** Fixed 2026-05-19 — migration 020 drops the implicit-role policy and recreates with explicit `TO anon, authenticated`. Matches the pattern used by `fund_cache` (009) and `adr_bist_map`.

Evidence:
- `supabase/migrations/013_price_snapshots.sql:19-21` says "anon and authenticated can SELECT" but creates `FOR SELECT USING (true)` without `TO anon, authenticated`.

Impact:
- In normal Supabase roles this behaves close to the intended public read model, but the migration is less explicit than the comment and backlog item suggest.

Recommended fix:
- Replace with an explicit role-scoped policy:
  - `CREATE POLICY ... FOR SELECT TO anon, authenticated USING (true);`

## Verification

Commands run on 2026-05-17:

```text
npm run check:babel
14 OK, 0 hata

npm run check:edge
All edge function files pass node --check.

npm run check:edge-drift
All edge functions in sync — safe to deploy.
```

## Notes

- The worktree had pre-existing unrelated changes before this audit. They were not modified.
- Live RLS verification should still be run against Supabase before shipping privacy-related changes, especially for public portfolio and service-role edge-function paths.
