# Cash & Time Deposit Feature — Design Spec

**Date:** 2026-05-11  
**Status:** Approved

---

## Context

The app currently tracks 6 asset types (US_STOCK, FUND, BIST, CRYPTO, GOLD, FX). Users hold meaningful wealth in bank accounts and vadeli mevduat (time deposits) that today are invisible to the portfolio — distorting total net worth, XIRR, and allocation views. This feature adds `CASH` and `DEPOSIT` as first-class asset types so every holding is accounted for.

---

## Requirements

| # | Requirement |
|---|---|
| 1 | CASH: track a TRY/USD/EUR bank account balance with no interest |
| 2 | DEPOSIT: track principal, interest rate, maturity date, and bank name |
| 3 | DEPOSIT accrued value = principal × (1 + rate × elapsed_days/360); capped at maturity |
| 4 | Both types included in total net worth KPI, XIRR, and allocation pie |
| 5 | No external price fetch — values computed locally on the frontend |

---

## Data Layer

### Schema migration (two nullable columns on `positions`)

```sql
ALTER TABLE positions ADD COLUMN interest_rate numeric;   -- annual rate, e.g. 0.45 for 45%
ALTER TABLE positions ADD COLUMN maturity_date  date;     -- NULL for CASH; required for DEPOSIT
```

Both columns are nullable and backward-compatible. No existing rows are affected.

### How positions are stored

| Field | CASH | DEPOSIT |
|---|---|---|
| `ticker` | User-defined label, e.g. `ZIRAAT_TRY` | User-defined label, e.g. `AKBANK_VAD_1` |
| `type` | `CASH` | `DEPOSIT` |
| `shares` | Balance amount | Principal amount |
| `avg_cost` | `1.0` | `1.0` |
| `currency` | TRY / USD / EUR | TRY / USD / EUR |
| `broker` | Bank name (optional) | Bank name (optional) |
| `interest_rate` | `null` | Annual rate, e.g. `0.45` |
| `maturity_date` | `null` | Maturity date, e.g. `2026-08-15` |
| `unit` | `null` | `null` |

The BUY transaction date serves as the deposit start date for accrual calculation.

### `rebuildPositions` update

`src/utils.js:rebuildPositions` must preserve `interest_rate` and `maturity_date` alongside the existing `unit` field in the `unitMap` snapshot before DELETE + INSERT.

---

## Price / Value Computation (frontend only)

No changes to `fetch-prices` edge function or `price_cache` table.

The existing `loadData` / price resolution path in `App.js` must inject synthetic prices for CASH and DEPOSIT positions:

```js
// After loading price_cache from Supabase:
for (const p of positions) {
  if (p.type === "CASH") {
    prc[p.ticker] = 1.0;
  } else if (p.type === "DEPOSIT") {
    const buyDate  = earliestBuyDate(transactions, p.ticker);   // from tx records
    const today    = new Date();
    const maturity = new Date(p.maturity_date);
    const refDate  = today < maturity ? today : maturity;       // cap at maturity
    const days     = daysBetween(buyDate, refDate);
    prc[p.ticker]  = 1 + p.interest_rate * (days / 360);       // simple interest factor
  }
}
```

`daysBetween` already exists in `src/utils.js`. `earliestBuyDate` is a small helper (or use `p.created_at` as a proxy if available).

**P&L:**  
- `cost = shares × 1.0 = principal / balance`  
- `mv = shares × prc[ticker]`  
- `pl = mv - cost` = accrued interest earned so far (CASH always 0, DEPOSIT positive)

**XIRR:** naturally correct — BUY at `-(principal)` on deposit date, terminal cash flow `+mv` today.

---

## UI Changes

### `src/constants.js`

Add to type definitions:
```js
const TL = {..., CASH:"Nakit", DEPOSIT:"Vadeli Mevduat"};
const TYPE_COLORS = {..., CASH:"#64748B", DEPOSIT:"#6366F1"};
```

### `src/components/AddTab.js`

Add two entries to `ADD_TYPES`:
```js
{type:"CASH",    label:"Nakit",          desc:"Banka hesabı — TRY, USD, EUR"},
{type:"DEPOSIT", label:"Vadeli Mevduat", desc:"Faizli sabit vadeli hesap"},
```

Both support **Manuel mode only** — no text/image/CSV parse. When one of these types is selected, only the "Manuel" tab is shown (or the others are disabled).

### `src/components/ManuelPosForm.js`

**CASH mode:**
- Ticker field label → "Hesap Etiketi" (placeholder: `ZIRAAT_TRY`)
- Amount field label → "Bakiye"
- `avg_cost` field: hidden, auto-set to `1.0`
- Currency picker: TRY / USD / EUR
- Broker field label → "Banka (isteğe bağlı)"
- No price fetch on blur (no external ticker)

**DEPOSIT mode:** same as CASH plus:
- "Faiz Oranı (%)" — numeric field, stored as decimal (`45` → `0.45` on save)
- "Vade Tarihi" — `<input type="date">` (required)
- On save: sets `interest_rate = value/100`, `maturity_date = value`

**Validation:**
- CASH: bakiye > 0 required
- DEPOSIT: bakiye > 0, faiz > 0, vade tarihi > today required

### `src/utils.js` — `rebuildPositions`

Before the DELETE step, snapshot `interest_rate` and `maturity_date` per ticker (alongside `unit`). After INSERT, restore them:
```js
const depositMap = {};
for (const p of existing) {
  if (p.interest_rate != null || p.maturity_date != null) {
    depositMap[p.ticker] = { interest_rate: p.interest_rate, maturity_date: p.maturity_date };
  }
}
// ... after rebuild, restore:
newPositions = newPositions.map(p => ({
  ...p,
  ...(depositMap[p.ticker] || {})
}));
```

### Dashboard blocks (`src/utils.js` — `BLOCK_TYPES`)

Add two new blocks:
```js
{type:"CASH",    label:"Nakit",          cur:"",    sym:""},  // currency from position
{type:"DEPOSIT", label:"Vadeli Mevduat", cur:"",    sym:""},
```

Each row in the block shows:
- Label / ticker
- Balance or principal (natural currency)
- Current accrued value (DEPOSIT only — shows growth)
- P&L badge (accrued interest)
- Maturity date badge for DEPOSIT (e.g., "Vade: 15/08/2026", color: warn if within 30 days, ok if future, err if past)

### AnalysisTab (`src/components/AnalysisTab.js`)

- "Varlık Dağılımı" pie and bar: CASH and DEPOSIT automatically included once they appear in positions (no special-casing needed — existing logic groups by `type`).
- Concentration risk: CASH and DEPOSIT excluded from HHI calculation (like ETFs) — they are not equity concentration risks.
- Fundamentals section: skip CASH/DEPOSIT in P/E and other equity metrics.

---

## Out of Scope

- Interest payment recording as DIV transactions (user can do this manually if desired)
- Withdrawal / partial withdrawal flow (model as a SELL transaction at the current accrued price factor, e.g. 1.1875 — not 1.0, otherwise interest disappears from P&L)
- Automatic maturity notifications / alerts
- Multi-currency deposits (one currency per position)

---

## Verification

1. Add a CASH position (₺50,000, Ziraat) → appears in Dashboard "Nakit" block, counts toward KPI total
2. Add a DEPOSIT (₺100,000, 45% annual, matures in 6 months) → accrued value ≈ ₺102,500 after 3 months of elapsed time
3. Allocation pie includes CASH and DEPOSIT slices
4. XIRR reflects the deposit's expected annualized return (~45% for a TRY deposit)
5. Edit and delete DEPOSIT position → interest_rate and maturity_date preserved / cleared correctly
6. Maturity date badge turns warn color when within 30 days of maturity

---

## Files to Modify

| File | Change |
|---|---|
| `supabase/migrations/YYYYMMDD_cash_deposit.sql` | New migration: two new nullable columns on `positions` |
| `src/constants.js` | Add CASH, DEPOSIT to TL and TYPE_COLORS |
| `src/components/AddTab.js` | Add two entries to ADD_TYPES; hide non-Manuel tabs for these types |
| `src/components/ManuelPosForm.js` | Type-specific fields for CASH and DEPOSIT |
| `src/utils.js` | BLOCK_TYPES entries; rebuildPositions preserves interest_rate/maturity_date; synthetic price injection helper |
| `src/components/App.js` | Inject synthetic prc entries for CASH/DEPOSIT after price_cache load |
| `src/components/AnalysisTab.js` | Exclude CASH/DEPOSIT from concentration risk HHI; skip in Fundamentals |
