# BES TickerDetailTab Breakdown Kartı — Design Spec

**Date:** 2026-05-15
**Sprint:** 19 Item 1
**Status:** Approved

## Context

BES positions currently render the generic 4-card grid (Adet / Toplam Maliyet / Piyasa Değeri / Toplam P&L) in TickerDetailTab. These metrics are meaningless for a pension account. Sprint 18 added `dk_principal` and `dk_current` columns to `positions`, enabling a proper BES breakdown. This spec defines what to display.

## BES Data Model (recap)

ManuelPosForm captures 4 user-entered values for BES:

| Field | Stored As | Value |
|-------|-----------|-------|
| Kişisel Yatırılan | `positions.avg_cost` | X |
| Kişisel Portföy Güncel | `price_cache.price` (partial, combined) | X+X_g (entered, not stored separately) |
| DK Anaparası | `positions.dk_principal` | Y |
| DK Portföy Güncel | `positions.dk_current` | Y+Y_g |

Save logic: `price_cache.price = currentValue + dkCurrent` (total). `shares = 1` for all BES positions.

Derived in TickerDetailTab:
- `prc[ticker]` = total account value (X+X_g + Y+Y_g)
- Kişisel Güncel = `prc[ticker] - p.dkCurrent`
- Yatırım Getirisi = Kişisel Güncel − `p.avgCost`
- DK Getirisi = `p.dkCurrent − p.dkPrincipal`

## Card Design

Layout B (two-section), inline `isBes` branch in `TickerDetailTab.js` alongside `isDeposit`.

### Kişisel Portföy section

| Row | Label | Formula | Weight |
|-----|-------|---------|--------|
| 1 | Yatırılan Tutar | `p.avgCost` | normal |
| 2 | Kişisel Güncel | `prc[ticker] - p.dkCurrent` | normal |
| 3 | Yatırım Getirisi | Kişisel Güncel − Yatırılan | sub-row: `font-size:12px`, kk label `font-size:9px` |

### Devlet Katkısı section (tinted box, `rgba(201,168,76,0.05)` + gold border)

| Row | Label | Formula | Weight |
|-----|-------|---------|--------|
| 4 | DK Anaparası | `p.dkPrincipal` | normal |
| 5 | DK Güncel | `p.dkCurrent` | normal |
| 6 | DK Getirisi | `p.dkCurrent − p.dkPrincipal` | sub-row: `font-size:12px`, kk label `font-size:9px` |

### Footer

**Toplam Değer** = `prc[ticker]` — 16px bold, `var(--info)` (gold). Always shown.

## NULL Guard

Trigger: `p.dkCurrent === null` (old BES position entered before Sprint 18).

| Row | NULL behavior |
|-----|---------------|
| Yatırılan Tutar | Always shown — `p.avgCost` always present |
| Kişisel Güncel | "⚠ DK bilgisi güncellenmeli" in `var(--warn)` |
| Yatırım Getirisi | "—" |
| DK Anaparası | "—" |
| DK Güncel | "—" |
| DK Getirisi | "—" |
| Toplam Değer | Always shown — `prc[ticker]` always present |

App never crashes. No error thrown.

## What Gets Hidden for BES

When `p.type === "BES"`, suppress:
- Generic 4-card grid (Adet / Toplam Maliyet / Piyasa Değeri / Toplam P&L)
- Fundamentals section (`supportsFund` is false for BES — already excluded by `effectiveType`)
- Dividend income / calendar sections
- Şirket Bilgisi, exchange, `meta.type` display
- "Invalid ticker" / cost currency warning card

## Implementation Approach

Single file change: `src/components/TickerDetailTab.js`.

Add `const isBes = p?.type === "BES"` alongside the existing `const isDeposit = p?.type === "DEPOSIT"`.

Skip meta fetch for BES: add `if (isBes) return;` guard at the top of the `fetchMeta` useEffect. BES tickers (e.g. "AH", "GARANTI") are not real market tickers; the edge call would either fail or return irrelevant data. The ticker+name header still renders from `p.name`.

In the position summary block:
```
{isDeposit && <MevduatOzetiCard ... />}
{isBes && <BesOzetiCard ... />}          ← new inline JSX block
{!isDeposit && !isBes && <GenericGrid />} ← add !isBes guard
```

The BES card is ~70 lines of inline JSX. No new component file.

## Out of Scope

- "Güncelle" button / re-entry flow → Sprint 20 Item 2
- New fetches or state changes → none
- Changes to ManuelPosForm, App.js, utils.js → none

## Definition of Done

- BES position TickerDetailTab shows 7 rows across 2 sections + Toplam footer
- Generic grid, fundamentals, dividends hidden for BES
- `dk_principal=NULL` positions render without crash; DK rows show "—", Kişisel Güncel shows nudge
- `npm run check:babel` passes
- `ui-builder` sign-off complete
- No visual regression on DEPOSIT, US_STOCK, BIST positions
