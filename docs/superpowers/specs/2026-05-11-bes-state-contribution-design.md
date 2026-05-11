# BES Devlet Katkısı — Design Spec

**Date:** 2026-05-11  
**Status:** Approved

## Problem

The current BES position model hints that state contributions (devlet katkısı, DK) should be added as a separate fund position (e.g., `AH_DK`). This is incorrect:

- Adding DK as a separate position treats DK principal as *cost*, not *gain*.
- Only DK's market gain appears as return; the DK principal itself is invisible as a gain.
- The correct model: cost basis = personal contributions only; DK principal + DK gain + personal gain = total return.

Additionally, the 4 BES statement components are not captured explicitly, making future breakdown displays impossible.

## BES Model: 4 Components

| Component | Symbol | Description |
|---|---|---|
| Kişisel yatırılan | X | Personal contributions (cost basis) |
| Kişisel portföy güncel | X+X_g | Personal portfolio current value |
| DK anaparası | Y | State contribution principal |
| DK portföy güncel | Y+Y_g | DK portfolio current value |

**P&L = (X+X_g + Y+Y_g) − X = X_g + Y + Y_g**

All of DK principal (Y) counts as gain, which is the correct treatment.

## Data Model

### Schema Migration

Add 2 nullable columns to `positions` table:

```sql
ALTER TABLE positions ADD COLUMN dk_principal numeric DEFAULT NULL;
ALTER TABLE positions ADD COLUMN dk_current  numeric DEFAULT NULL;
```

Existing columns are NOT repurposed:
- `interest_rate` keeps DEPOSIT annual rate semantics
- `reserve_ratio` keeps DEPOSIT reserve fraction semantics

### Storage Map

| Value | Column / Store |
|---|---|
| X | `positions.avg_cost` |
| Y | `positions.dk_principal` |
| Y+Y_g | `positions.dk_current` |
| X+X_g + Y+Y_g (total) | `price_cache.price` (via `set-manual-price`) |

### Derived Values (no extra storage needed)

| Derived | Formula |
|---|---|
| Kişisel portföy güncel (X+X_g) | `price_cache − dk_current` |
| Kişisel getiri (X_g) | `price_cache − dk_current − avg_cost` |
| DK getirisi (Y_g) | `dk_current − dk_principal` |
| Toplam getiri | `price_cache − avg_cost` |
| Toplam getiri % | `(price_cache − avg_cost) / avg_cost` |

## Form Changes (ManuelPosForm.js)

### Remove
- Hint line: *"Devlet katkısı için farklı bir hesap kodu ile ayrı pozisyon ekleyin (örn: AH_DK)."* (line 391)

### Rename
- "Yatırılan Toplam Tutar (₺)" → **"Kişisel Yatırılan (₺)"** — label only, field behaviour unchanged
- "Güncel Değer (₺) — opsiyonel" → **"Kişisel Portföy Güncel Değeri (₺)"** — now required (same as before but renamed)

### Add (BES-only fields, shown after kişisel güncel)
1. **Devlet Katkısı Anaparası (₺)** (`form.dkPrincipal`) — required
2. **DK Portföy Güncel Değeri (₺)** (`form.dkCurrent`) — required

### Form Preview (shown when all 4 values > 0)

```
Kişisel katkı: ₺X  ·  DK: ₺Y
Toplam hesap değeri: ₺(X+X_g + Y+Y_g)
Toplam getiri: +₺(X_g + Y + Y_g)  (+%R)
```

### Validation

Both `dkPrincipal` and `dkCurrent` must be > 0 when BES type is selected. `dkCurrent >= dkPrincipal` (DK cannot have lost value — it's managed funds with floor guarantees; show warn, don't block save if violated).

### savePos Logic

```
total = kişisel_güncel + dk_güncel
set-manual-price(ticker, total, "BES")   // price_cache ← total
extraMeta = { [tk]: { dk_principal: Y, dk_current: Y+Y_g } }
rebuildPositions(userId, pid, extraMeta)
```

## rebuildPositions / utils.js Changes

### Snapshot select
Extend the `positions` select query to also read `dk_principal` and `dk_current`.

### Snapshot map (BES entries)
Alongside DEPOSIT's `depositSnapMap`, build a `besSnapMap`:
```js
if (p.type === "BES") {
  besSnapMap[p.ticker] = { dk_principal: p.dk_principal, dk_current: p.dk_current };
}
```

Merge with extraMeta (extraMeta wins):
```js
const besMap = { ...besSnapMap, ...extraMeta_bes_portion };
```

### Position object output
Add to the mapped position object:
```js
dk_principal: besMap[p.ticker]?.dk_principal ?? null,
dk_current:   besMap[p.ticker]?.dk_current   ?? null,
```

### RPC payload
`dk_principal` and `dk_current` are included in the JSON passed to `rebuild_positions_atomic`. The RPC inserts them into the new columns.

## App.js / loadData Changes

No change to market value (MV) computation — `price_cache` already stores the total account value for BES positions.

`loadData` reads the updated `positions` fields; `p.dk_principal` and `p.dk_current` are available for future UI use.

## Position List Display (ManuelPosForm.js)

Current:
```
AH   ₺10,000 yatırılan
```

New (when dk fields present):
```
AH   ₺10,000 kişisel · DK: ₺2,500 · Toplam: ₺14,200
```

## Edit Mode Pre-population

| Form field | Source |
|---|---|
| `avgCost` (X) | `p.avg_cost` |
| `dkPrincipal` (Y) | `p.dk_principal` |
| `dkCurrent` (Y+Y_g) | `p.dk_current` |
| `currentValue` (X+X_g) | `price_cache − p.dk_current` (fetch price_cache on edit load) |

## Future Work (out of scope here)

- TickerDetailTab BES breakdown card: show X, X_g, Y, Y_g as separate rows
- AnalysisTab: DK return as a distinct return attribution
- Existing BES positions (pre-migration): dk_principal and dk_current will be NULL; displayed as before with a hint to update

## Files to Change

| File | Change |
|---|---|
| Supabase migration | Add `dk_principal`, `dk_current` columns to `positions`; update `rebuild_positions_atomic` RPC to include new columns in INSERT |
| `src/utils.js` | Extend `rebuildPositions` snapshot select + position object output |
| `src/components/ManuelPosForm.js` | Form fields, savePos, position list display, edit pre-population |
| `src/components/App.js` | `loadData` reads new fields (no MV logic change) |

### RPC Note
`rebuild_positions_atomic` does `DELETE + INSERT FROM jsonb_to_recordset(p_positions)`. The INSERT column list must be extended to include `dk_principal` and `dk_current`. The migration updates both the table and the RPC in a single SQL file.

No edge function changes needed.
