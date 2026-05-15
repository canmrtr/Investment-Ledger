# Karmaşık Kartlara Önce Sonuç Cümlesi — Design Spec

**Date:** 2026-05-15
**Sprint:** 19 Item 2
**Status:** Approved

## Context

AnalysisTab has three "complex" cards where the user needs to scan a chart/table/big number to understand the result. Sprint 17 cleaned up jargon (B1) and hid raw formulas (B2). B3 is the last step: each card opens with a single plain-language verdict so the user knows the answer without reading the visualization underneath.

Three cards in scope: **Portföy Sağlık**, **Konsantrasyon Riski**, **Kur Riski**. All edits in `src/components/AnalysisTab.js`. No new fetches, no state changes.

## Visual Pattern (shared across all 3)

Matches the existing 6-metric sentence micropattern at `AnalysisTab.js:1101-1108`:

```jsx
<div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--text2)"}}>
  <span style={{fontSize:13}}>{icon}</span>
  <span>
    [body text]
    {" "}<strong style={{color:"var(--text)",fontWeight:500}}>{nounPhrase}</strong>
    {" "}<span style={{color: signal==="good"?"var(--ok)":signal==="neutral"?"var(--warn)":"var(--err)"}}>{verdictWord}</span>
    [optional trailing text]
  </span>
</div>
```

- Icon: 🟢 / 🟡 / 🔴
- Body wrapper: `fontSize:12, color:var(--text2)`
- `<strong>` (noun phrase): bold but plain text color — used for "yabancı para" in Kur Riski
- Final `<span>` (verdict word): signal-colored — `var(--ok)` / `var(--warn)` / `var(--err)`

Only the final verdict word gets the signal color. Numbers (X/Y, %X) are inline plain text inside the body wrapper.

Inline JSX per card (no shared helper — three use sites with different data sources).

## Card 1: Portföy Sağlık

### Change
**Replace** the existing block of 6 per-metric sentences (`src/components/AnalysisTab.js` lines ~1054-1114) with a **single aggregate verdict sentence**. The 🟢🟡🔴 rozet counts at the top of the card stay. The collapsible detail table stays. The portfolio F/K KPI stays. Only the 6 sentence block is replaced.

### Signal counting
Reuse the per-metric signal computation already inside the existing IIFE. Iterate the 6 portfolio-level metrics; for each, the existing code derives `signal ∈ {good, neutral, bad}`. Count:

```
goodCount = sentences.filter(s => s.signal === "good").length
neutralCount = sentences.filter(s => s.signal === "neutral").length
badCount = sentences.filter(s => s.signal === "bad").length
total = goodCount + neutralCount + badCount   // ≤ 6
```

### Verdict thresholds (out of 6 metrics)

| Condition | Verdict | Signal |
|-----------|---------|--------|
| `goodCount >= 4` | güçlü | good |
| `badCount >= 3` | zayıf | bad |
| otherwise | orta | neutral |

### Copy template

> 🟢 X metrik sağlıklı, Y dikkat gerektiriyor — portföyün genel fundamentali **güçlü**.

- X = `goodCount`
- Y = `badCount`
- Icon + final verdict word colored per signal

### Empty/edge state
- If `total === 0` (no fundamental data): render nothing (the card itself only renders when `healthEligible.length > 0`, but inside the IIFE return null when no metrics resolved).

---

## Card 2: Konsantrasyon Riski

### Change
**Add** a new verdict sentence at the **TOP** of the card body (immediately under the card title, before the big top3% number block). Keep the existing closing explanation sentence at the bottom unchanged.

### Verdict thresholds (reuse existing `top3wStocks` value at line ~1356)

| Condition | Verdict | Signal |
|-----------|---------|--------|
| `top3wStocks > 60` | yüksek konsantrasyon | bad |
| `top3wStocks > 40` (and ≤ 60) | orta düzey | neutral |
| otherwise (≤ 40) | iyi | good |

Reuses the existing `level` / `color` variables — no new threshold definitions.

### Copy template

> 🟢 Portföyün çeşitlendirme düzeyi **iyi**.
> 🟡 Portföyün çeşitlendirme düzeyi **orta düzey**.
> 🔴 Portföyün çeşitlendirme düzeyi **yüksek konsantrasyon**.

### Placement
Inside the existing IIFE return, immediately after the opening `<div>` and before the existing `<div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>` (the top3% number row).

### Empty/edge state
Existing card already returns `<div className="empty">Yeterli pozisyon yok</div>` before reaching the verdict computation. No new edge cases.

---

## Card 3: Kur Riski

### Change
**Replace** the existing `fxSubText` line (the small subtitle at line ~1769 directly under the card title) with the new verdict sentence. Same position, same styling shell.

### Exposure metric

```
nonTryFrac = (fxGroups.USD + fxGroups.EUR) / fxTotal
```

Combined non-TRY share. Labeled **"yabancı para"** in the sentence (covers users with USD-only, EUR-only, or mixed exposure with one number).

### Verdict thresholds

| Condition | Verdict | Signal |
|-----------|---------|--------|
| `nonTryFrac > 0.70` | yüksek | bad |
| `nonTryFrac >= 0.30` (and ≤ 0.70) | orta | neutral |
| otherwise (< 0.30, but > 0) | düşük | good |

### Copy template

> 🟢 Portföyün **%X'i yabancı para** cinsinden — kur değişimine **düşük** maruz.
> 🟡 Portföyün **%X'i yabancı para** cinsinden — kur değişimine **orta** maruz.
> 🔴 Portföyün **%X'i yabancı para** cinsinden — kur değişimine **yüksek** maruz.

Where `X = Math.round(nonTryFrac * 100)`.

### Edge cases

| Condition | Render |
|-----------|--------|
| `fxTotal === 0` (no price data) | "Fiyat verisi bekleniyor." (existing fallback — keep) |
| `nonTryFrac === 0` (all TRY) | "🟢 Portföy tamamen TRY — kur riski yok." |
| `nonTryFrac > 0` | Verdict sentence as above |

### Unchanged behavior
The two `warn-card` callouts further down ("USDTRY +%10..." and "...euro çeşitlendirmesi") stay as-is — they're educational supplementary notes, not the verdict.

---

## Implementation Approach

Single file change: `src/components/AnalysisTab.js`.

Three inline JSX edits:
1. Replace the `{sentences.map(...)}` block in Portföy Sağlık with the single verdict block (still uses `sentences` array's signal counts).
2. Insert new verdict JSX at the top of Konsantrasyon Riski card body.
3. Replace the `fxSubText` value (it's a const string assignment, not JSX) and the `<div>{fxSubText}</div>` render with the new verdict JSX (which needs to render JSX for the colored verdict word).

No new state, no new fetches, no new helpers.

## Out of Scope

- Dayanıklılık kartı (alt-task 2d in sprint-19.md) — depends on Piyasa Dayanıklılık Skoru which is Sprint 20.
- Threshold tunability / per-user settings.
- Tooltip on the verdict sentence (the existing rozet counts in Portföy Sağlık already have their own tooltips; Konsantrasyon and Kur Riski explanations exist elsewhere on the card).

## Definition of Done

- Portföy Sağlık card shows a single aggregate verdict sentence in place of the 6 per-metric sentences. Rozet counts and detail table unchanged.
- Konsantrasyon Riski card shows a verdict sentence at the top of its body, above the top3% number.
- Kur Riski card shows the new verdict in place of the current `fxSubText`, with TRY-only and no-data cases handled.
- `npm run check:babel` passes.
- `ui-builder` sign-off complete.
- No visual regression on other AnalysisTab cards (Break-Even, Komisyon, Kazanan/Kaybeden, Temettü Özeti, etc.).
