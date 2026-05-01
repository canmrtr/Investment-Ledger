# Audit Notes

Date: 2026-05-01

Scope: Static audit of the React/Supabase Investment Ledger codebase. No production database state was inspected.

## Findings

### High: `loadData` is not scoped to the active portfolio

`loadData` fetches `positions`, `transactions`, and `splits` by `user_id` only, then separately determines `activePortfolioId`.

Impact: if a user has multiple portfolios, dashboard totals, analysis, search, ticker detail, rebuild flows, and public-sharing decisions can reflect a merged view of all portfolios while the UI says one portfolio is active.

References:
- `src/components/App.js:166`
- `src/components/App.js:167`
- `src/components/App.js:168`
- `src/components/App.js:183`

Recommended fix: determine and validate `activePortfolioId` before loading portfolio-scoped tables, then filter all portfolio data queries with `.eq("portfolio_id", activePortfolioId)`. Make downstream props and rebuild calls consistently use the same portfolio id.

### High: Manual position upsert uses `user_id,ticker` instead of `user_id,portfolio_id,ticker`

Manual position save inserts a transaction with `portfolio_id`, but updates `positions` with an upsert conflict target of `user_id,ticker`.

Impact: the same ticker in different portfolios can be merged into the wrong position row or fail once the database constraint is corrected for multi-portfolio data.

References:
- `src/components/ManuelPosForm.js:120`
- `src/components/ManuelPosForm.js:123`
- `src/components/ManuelPosForm.js:130`

Recommended fix: add or verify a unique constraint on `(user_id, portfolio_id, ticker)` for `positions`, then change frontend upserts to `onConflict:"user_id,portfolio_id,ticker"`. Review any existing older unique constraint on `(user_id,ticker)` before applying.

### Medium: Watchlist `asset_type` is not selected during load

Migration `006_watchlist_asset_type.sql` adds `asset_type`, and watchlist insert writes it, but `loadData` only selects `id,ticker,added_at`.

Impact: after reload, BIST/crypto/gold watchlist rows lose their asset type in memory. Automatic historical fetch falls back to `US_STOCK`, which can route to the wrong provider and return wrong or missing data.

References:
- `src/components/App.js:172`
- `src/components/App.js:257`
- `supabase/migrations/006_watchlist_asset_type.sql:7`

Recommended fix: change the watchlist query to select `id,ticker,asset_type,added_at`. Consider backfilling existing null `asset_type` rows where possible.

### Medium: Public portfolio toggle exposes `full` data while copy promises allocation-style sharing

The "Herkese Aç" flow tells the user that "ticker + dağılım" will be visible, but it sets `privacy_level` to `"full"`. Current RLS public read policies allow authenticated users to query raw positions for full public portfolios.

Impact: users may unintentionally expose position details and cost basis fields at the data layer. The public UI hides some amounts, but RLS still exposes the underlying rows.

References:
- `src/components/App.js:930`
- `src/components/App.js:938`
- `supabase/migrations/002_rls_fixes.sql:87`

Recommended fix: either update the confirmation copy to clearly describe full-detail sharing, or set public portfolios to `allocation_only` by default and add a separate explicit full-detail option. If allocation-only is intended, avoid exposing raw `positions` rows through RLS and provide a sanitized aggregate view/RPC.

## Verification Run

- `npm run check:babel` passed.
- `npm run check:edge` passed.
- `npm run check:edge-drift` passed.

