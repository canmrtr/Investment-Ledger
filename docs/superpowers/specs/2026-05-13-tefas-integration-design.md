# TEFAS Integration Design

**Date:** 2026-05-13  
**Status:** Approved  
**Scope:** Add Turkish mutual fund (TEFAS) support as a new asset type with daily NAV price fetching, fund catalog search, and full portfolio tracking.

---

## 1. Asset Type & Color

A new `TEFAS` type is added alongside the existing 9 asset types.

| Constant | TL Label | Color |
|---|---|---|
| `TEFAS` | `"TEFAS Fonu"` | `#84CC16` (lime) |

- `tokens.css`: new `--category-tefas: #84CC16` token
- `constants.js` → `TL`: add `TEFAS: "TEFAS Fonu"`
- `constants.js` → `TYPE_COLORS`: add `TEFAS: "#84CC16"`
- Currency: always **TRY** (`₺`). `fmtSign(n, "₺")` everywhere — never `fmtD`.
- Price semantics: daily **NAV** (birim pay değeri), set once per day after ~18:30 Istanbul. No intraday ticks.
- P&L: `(currentNAV - avg_cost) × shares`. No stopaj deduction (unlike DEPOSIT).
- NOT in `MANUEL_ONLY_TYPES` — price is auto-fetched.

---

## 2. Price Routing — `fetch-prices` Edge Function

New routing flag added after existing `isBist` / `isCrypto` / `isGold` checks:

```js
const isTefas = asset_type === "TEFAS";
```

### Primary source — TEFAS direct API

```
POST https://www.tefas.gov.tr/api/DB/BindHistoryInfo
Content-Type: application/x-www-form-urlencoded
Headers: X-Requested-With: XMLHttpRequest
         User-Agent: Mozilla/5.0 (compatible browser-like string)

Body: fonkod=AAK&bastarih=13.05.2026&bittarih=13.05.2026
```

Response fields used: `TARIH` (date), `FIYAT` (NAV in TRY).

### Fallback source

If primary returns non-2xx or empty result array: retry via `fonbul.com` or `isyatirim.com.tr` (same TEFAS fund codes, no WAF). Exact endpoint determined during implementation after WAF test.

### Modes

| Mode | Behavior |
|---|---|
| `price` | Latest NAV (last available trading day) |
| `hist` | Date-range NAV series for TickerDetailTab chart |
| `meta` | Fund name + category (write to `tefas_funds`, not `price_cache`) |

### `price_cache` entry

- `currency = "TRY"`
- `source = "tefas"`
- `d1` / `w1` / `m1` / `y1` change percentages: computed from historical series (same method as BIST — no native delta from TEFAS API)

---

## 3. Fund Catalog — `tefas_funds` Table

### Schema

```sql
create table tefas_funds (
  code        text primary key,
  name        text not null,
  category    text,
  updated_at  timestamptz default now()
);

-- Public read (shared catalog, no user data)
alter table tefas_funds enable row level security;
create policy "public read" on tefas_funds for select using (true);
-- No insert/update policy for anon/authenticated — service_role only
```

Access pattern mirrors `fund_cache`: frontend read-only (anon + authenticated); all writes via `fetch-fundamentals` service_role.

### Population

`fetch-fundamentals` gets a new `mode: "tefas-catalog"`:
- POSTs to TEFAS `BindFundInfo` list endpoint
- Upserts all ~1000 funds into `tefas_funds` (code, name, category)
- Runs once on deploy; re-triggerable manually from Settings → Veri tab
- No pg_cron needed (fund catalog changes infrequently)

### SearchTab Integration

- On load, SearchTab fetches `tefas_funds` (code + name) in parallel with existing `ticker_db` load
- Unified in-memory search: results from both sources merged; TEFAS rows tagged `asset_type: "TEFAS"`
- TEFAS results display with lime `#84CC16` badge in search results
- "+ İzle" / "✓ İzleniyor" toggle uses existing `watchlist` table with `asset_type: "TEFAS"` — no schema change needed
- Tapping a result opens `TickerDetailTab` with `asset_type: "TEFAS"`

---

## 4. Add Flow

### AddTab picker entry

```js
{type:"TEFAS", label:"TEFAS Fonu", desc:"Yatırım fonu — AAK, MAC, YKB"}
```

Inserted after `BES`, before `CASH` (keeps TRY-native types together: BES → TEFAS → CASH → DEPOSIT).

### Mode availability

All four modes enabled: Text / Image / CSV / Manuel. No `MANUEL_ONLY_TYPES` restriction.

### Manuel entry

Standard `ManuelPosForm`. Fund code field (e.g. `AAK`). No special extra fields (unlike DEPOSIT's `interest_rate` / `maturity_date`).

### Text / Image parse

`parse-transaction` (Claude Haiku 4.5) handles TEFAS codes as-is — 2–4 char alphanumeric codes pass through the existing generic ticker parser. `asset_type` is set from picker context; no prompt change needed.

### Post-save flow

`rebuildPositions` → `loadData` → price fetched via `isTefas` branch in `fetch-prices`. Identical to BIST flow.

---

## 5. Dashboard & Display

### Dashboard position block

- New `BLOCK_TYPE` entry: label `"TEFAS Fonu"`, color `#84CC16`
- Positions render in TRY (₺), same row layout as BIST
- Block collapsed by default (same as all other blocks)

### TickerDetailTab

- **Held mode**: price + hist fetched via `isTefas` branch; fund name from `tefas_funds`
- **Discovery mode** (from SearchTab): same flow
- Fund category shown as a small badge below the fund name (e.g. "Hisse Senedi Yoğun", "Para Piyasası")

### AnalysisTab

| Section | TEFAS behavior |
|---|---|
| Varlık Dağılımı | Own lime slice |
| Bölge Dağılımı | Mapped to `tr` (Turkish-domiciled funds) |
| Portföy Sağlık / Fundamentals | **Hidden** (no fundamental data for funds) |
| Sektör Dağılımı | **Hidden** |
| Komisyon, Kazanan/Kaybeden, Break-Even | Standard (no changes needed) |

### WatchlistTab

TEFAS tickers show price + daily change in the standard row format. No changes needed.

---

## 6. Risk & Rollout

| Risk | Mitigation |
|---|---|
| TEFAS WAF still blocking Supabase cloud IPs | Fallback to fonbul.com / isyatirim.com.tr automatically |
| TEFAS API response format changes | `source="tefas"` in price_cache — easy to identify stale data; add error logging |
| Fund catalog (~1000 funds) load time in SearchTab | Fetch in parallel with `ticker_db`; store in same LS cache format (`tefas_fund_db_v1`, 24h TTL) |

---

## 7. Out of Scope (this sprint)

- Fundamental data for TEFAS funds (fund manager, expense ratio, portfolio breakdown)
- pg_cron for automatic catalog refresh
- ETF underlying / region drill-down for TEFAS funds in Bölge Dağılımı
