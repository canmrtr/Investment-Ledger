# Audit Notes

## Follow-up Audit

Date: 2026-05-10 | **All findings resolved: 2026-05-10**

Scope: Static review of the current working tree for the React/Supabase app, focused on ledger correctness, public-sharing privacy, Edge Function exposure, and mutation error handling. No production database state was inspected.

### Status of Prior Findings

- `loadData` portfolio scoping appears fixed in the current working tree: `positions` and `transactions` are now filtered by `portfolio_id`.
- Manual position upsert conflict target appears fixed: `ManuelPosForm` now uses `onConflict:"user_id,portfolio_id,ticker"`.
- Watchlist `asset_type` selection appears fixed: `loadData` now selects `id,ticker,asset_type,added_at`.
- Public-sharing behavior was changed to default to `allocation_only`, but a deeper data-layer exposure remains. See the new high-severity finding below.

### Resolution (2026-05-10)

All findings below were resolved in the same session via migrations 011–012, src/ edits, and edge function update:

| Finding | Resolution |
|---------|-----------|
| High: `allocation_only` column exposure | `012_public_allocation_rpc.sql`: SECURITY DEFINER `get_allocation_only_positions(uuid)` returns only `{ticker,name,type,pct}`; `positions_allocation_read` RLS policy dropped |
| High: `rebuildPositions` not transactional | `011_rebuild_positions_atomic.sql`: PL/pgSQL RPC wraps DELETE+INSERT atomically; `src/utils.js` calls `sb.rpc()` instead of separate round-trips; callers check `null` return on error |
| Medium: ManuelPosForm partial ledger | `src/components/ManuelPosForm.js`: `savePos` now routes through `rebuildPositions` (was direct upsert, error ignored); `delPos` now deletes transactions + rebuilds (was position-row-only delete) |
| Medium: `fetch-prices` unauthenticated | JWT validation added to `supabase/functions/fetch-prices/index.ts`; all frontend callers use new `edgePriceCall()` auth wrapper; `edgeCallAuth` anon fallback removed |
| Medium: allocation pct uses raw shares | Resolved by `get_allocation_only_positions` RPC: cost-basis pct (`avg_cost*shares`) computed server-side, not raw share counts |

### Findings

#### High: `allocation_only` public sharing still exposes full `positions` rows at the database layer

Migration `007_audit_fixes.sql` adds a SELECT policy for `allocation_only` public portfolios. RLS controls rows, not columns, so any authenticated client that can read an allocation-only position row can request sensitive columns such as `avg_cost`, `shares`, `broker`, and other position fields. The frontend only selects `ticker,name,type,shares`, but that projection is not a privacy boundary.

Impact: the UI and confirmation copy promise "ticker + yüzdeler" style sharing, but the data layer allows authenticated users to query raw allocation-only position rows directly.

References:
- `supabase/migrations/007_audit_fixes.sql:70`
- `supabase/migrations/007_audit_fixes.sql:61`
- `src/components/App.js:961`
- `src/components/App.js:217`

Recommended fix: remove direct public SELECT access to `positions` for `allocation_only` portfolios. Serve public allocation data through a sanitized view/RPC that returns only safe aggregate fields, for example `ticker`, `type`, and `allocation_pct`, and does not expose cost basis or raw quantities.

#### High: `rebuildPositions` is delete-then-insert and not transactional

`rebuildPositions` deletes all current positions for the portfolio, then inserts rebuilt rows. It does not check the delete or insert errors. If the insert fails because of RLS, constraint drift, network interruption, or a transient Supabase issue, the position table can be left empty or stale while callers still show a success message.

Impact: a routine "Pozisyonları Yeniden Hesapla", transaction edit/delete, CSV import, or inline add can destroy the visible position snapshot even though the transaction ledger still exists.

References:
- `src/utils.js:325`
- `src/utils.js:362`
- `src/utils.js:370`
- `src/components/App.js:1108`

Recommended fix: move position rebuild into a database RPC wrapped in a transaction. The RPC should read portfolio transactions, delete/reinsert positions, and return an error atomically. If kept client-side temporarily, check every Supabase error and stop showing success when any mutation fails.

#### Medium: Manual add can create partial ledger state

`ManuelPosForm.savePos` inserts a transaction, then upserts the position row separately. The transaction insert error is checked, but the position upsert result is ignored.

Impact: if the upsert fails, the transaction exists but the position snapshot remains stale, and the UI still reports that the position was added.

References:
- `src/components/ManuelPosForm.js:116`
- `src/components/ManuelPosForm.js:123`
- `src/components/ManuelPosForm.js:132`

Recommended fix: route manual adds through the same transaction insert plus checked `rebuildPositions` path used by other add flows, or make the whole operation a transactional RPC.

#### Medium: `fetch-prices` is unauthenticated but can consume provider quota and write shared cache

The `fetch-prices` Edge Function accepts arbitrary POST requests with the anon key and does not verify a user JWT. For historical requests, it writes successful results to `price_cache` using the service role key.

Impact: anyone can call the function outside the app, burn Massive/Yahoo/Twelve Data quota, and populate shared cache rows for arbitrary valid ticker strings. CORS is not an authentication boundary.

References:
- `supabase/functions/fetch-prices/index.ts:302`
- `supabase/functions/fetch-prices/index.ts:306`
- `supabase/functions/fetch-prices/index.ts:438`
- `supabase/functions/fetch-prices/index.ts:445`

Recommended fix: require a valid user JWT for interactive price fetches and add per-user or per-IP rate limiting. Limit cache writes to held/watchlisted tickers, or move shared cache writes exclusively to the protected cron function.

#### Medium: Public portfolio allocation math is not market-value allocation

The public portfolio view uses `avg_cost * shares` for `full` portfolios and raw `shares` for `allocation_only` portfolios to compute percentages. Raw share counts are not comparable across assets, and cost basis is not current allocation.

Impact: public "allocation" can be materially misleading, especially across stocks, funds, crypto, gold, and BIST assets. For allocation-only sharing, raw shares can also reveal a quantity proxy.

References:
- `src/components/App.js:892`
- `src/components/App.js:895`
- `src/components/App.js:925`

Recommended fix: compute public allocation from current market value in a sanitized backend view/RPC. If market values are unavailable, label the view explicitly as count-based or cost-basis-based instead of allocation.

### Verification Run

- `npm run check:babel` passed.
- `npm run check:edge` passed.
- `npm run check:edge-drift` passed.

---

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
