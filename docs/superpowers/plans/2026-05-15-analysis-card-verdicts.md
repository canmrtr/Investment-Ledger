# Karmaşık Kartlara Önce Sonuç Cümlesi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single plain-language verdict sentence at the top of three AnalysisTab cards (Portföy Sağlık, Konsantrasyon Riski, Kur Riski) so users see the answer before reading the visualization.

**Architecture:** Three inline JSX edits to `src/components/AnalysisTab.js`. Each verdict reuses signals/values already computed in the existing IIFE blocks — no new state, no new fetches. All verdicts follow the same micropattern: icon + body text + signal-colored verdict word.

**Tech Stack:** React 18 UMD + Babel Standalone (no build step). Validation via `npm run check:babel`. Visual testing via `npx serve .` on http://localhost:3000.

**Spec:** `docs/superpowers/specs/2026-05-15-analysis-card-verdicts-design.md`

---

## File Map

| File | Change |
|------|--------|
| `src/components/AnalysisTab.js` | All changes — 3 inline JSX edits totaling ~50 lines |

---

## Shared Visual Pattern

Every verdict uses the same wrapper, matching the existing 6-metric-sentence treatment at line 1101:

```jsx
<div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--text2)"}}>
  <span style={{fontSize:13}}>{icon}</span>
  <span>
    {/* body text */}
    {" "}<strong style={{color:"var(--text)",fontWeight:500}}>{nounPhrase}</strong>
    {" "}<span style={{color: signal==="good"?"var(--ok)":signal==="neutral"?"var(--warn)":"var(--err)"}}>{verdictWord}</span>
    {/* optional trailing text */}
  </span>
</div>
```

Signal → color mapping: `good→var(--ok)`, `neutral→var(--warn)`, `bad→var(--err)`.

---

## Task 1: Portföy Sağlık aggregate verdict

**Files:**
- Modify: `src/components/AnalysisTab.js` lines 1099-1112 (replace the existing `sentences.map(...)` render block)

### Context

The existing IIFE at lines 1054-1114 computes a `sentences` array of 6 portfolio-level metric signals (Borçlanma, Kârlılık, Gelir büyümesi, Özkaynak verimliliği, Operasyonel kârlılık, Borç/Nakit akışı). Each item has `{icon, label, adj, tip, signal}` where `signal ∈ {good, neutral, bad}`.

We keep the `sentences` array computation but replace the 6-sentence rendering with a single aggregate verdict that counts how many metrics resolved to each signal.

### Verdict thresholds (out of 6 metrics)

| Condition | Verdict word | Signal |
|-----------|--------------|--------|
| `goodCount >= 4` | güçlü | good |
| `badCount >= 3` | zayıf | bad |
| otherwise | orta | neutral |

### Copy template

> 🟢 X metrik sağlıklı, Y dikkat gerektiriyor — **portföyün genel fundamentali** **güçlü**.

- X = goodCount, Y = badCount
- Only the final word ("güçlü"/"orta"/"zayıf") gets the signal color

---

- [ ] **Step 1: Replace the existing render block**

In `src/components/AnalysisTab.js`, find this block (lines 1099-1112):

```jsx
            if (sentences.length === 0) return null;
            return (
              <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:6}}>
                {sentences.map((s, i) => (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--text2)"}}
                    data-tip={s.tip}>
                    <span style={{fontSize:13}}>{s.icon}</span>
                    <span><strong style={{color:"var(--text)",fontWeight:500}}>{s.label}</strong>
                      {" "}<span style={{color: s.signal==="good"?"var(--ok)":s.signal==="neutral"?"var(--warn)":"var(--err)"}}>{s.adj}</span>
                    </span>
                  </div>
                ))}
              </div>
            );
```

Replace with:

```jsx
            if (sentences.length === 0) return null;
            const goodCount = sentences.filter(s => s.signal === "good").length;
            const badCount = sentences.filter(s => s.signal === "bad").length;
            const verdictSignal = goodCount >= 4 ? "good" : badCount >= 3 ? "bad" : "neutral";
            const verdictWord = verdictSignal === "good" ? "güçlü" : verdictSignal === "bad" ? "zayıf" : "orta";
            const verdictIcon = verdictSignal === "good" ? "🟢" : verdictSignal === "bad" ? "🔴" : "🟡";
            const verdictColor = verdictSignal === "good" ? "var(--ok)" : verdictSignal === "bad" ? "var(--err)" : "var(--warn)";
            return (
              <div style={{marginTop:12,display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--text2)"}}>
                <span style={{fontSize:13}}>{verdictIcon}</span>
                <span>
                  {goodCount} metrik sağlıklı, {badCount} dikkat gerektiriyor — <strong style={{color:"var(--text)",fontWeight:500}}>portföyün genel fundamentali</strong>{" "}
                  <span style={{color:verdictColor}}>{verdictWord}</span>.
                </span>
              </div>
            );
```

- [ ] **Step 2: Run babel check**

```bash
npm run check:babel
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AnalysisTab.js
git commit -m "feat(analysis): replace 6 health sentences with aggregate verdict"
```

---

## Task 2: Konsantrasyon Riski verdict at top

**Files:**
- Modify: `src/components/AnalysisTab.js` lines 1358-1361 (insert verdict between `return(<div>` and the top3% number row)

### Context

The existing IIFE at lines 1343-1395 computes `top3wStocks`, `level`, and `color` for the Konsantrasyon Riski card. We add a verdict sentence at the top of the card body, before the big top3% number block.

### Verdict thresholds (reuse existing `top3wStocks`)

| Condition | Verdict | Signal | Icon |
|-----------|---------|--------|------|
| `top3wStocks > 60` | yüksek konsantrasyon | bad | 🔴 |
| `top3wStocks > 40` (and ≤ 60) | orta düzey | neutral | 🟡 |
| otherwise (≤ 40) | iyi | good | 🟢 |

### Copy template

> 🟢 **Portföyün çeşitlendirme düzeyi** **iyi**.

---

- [ ] **Step 1: Insert verdict JSX inside the IIFE return**

Find this block (lines 1358-1361):

```jsx
          return(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <div>
```

Replace with:

```jsx
          const verdictSignal = top3wStocks > 60 ? "bad" : top3wStocks > 40 ? "neutral" : "good";
          const verdictWord = verdictSignal === "bad" ? "yüksek konsantrasyon" : verdictSignal === "neutral" ? "orta düzey" : "iyi";
          const verdictIcon = verdictSignal === "bad" ? "🔴" : verdictSignal === "neutral" ? "🟡" : "🟢";
          const verdictColor = verdictSignal === "bad" ? "var(--err)" : verdictSignal === "neutral" ? "var(--warn)" : "var(--ok)";
          return(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--text2)",marginBottom:12}}>
                <span style={{fontSize:13}}>{verdictIcon}</span>
                <span>
                  <strong style={{color:"var(--text)",fontWeight:500}}>Portföyün çeşitlendirme düzeyi</strong>{" "}
                  <span style={{color:verdictColor}}>{verdictWord}</span>.
                </span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <div>
```

- [ ] **Step 2: Run babel check**

```bash
npm run check:babel
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AnalysisTab.js
git commit -m "feat(analysis): add konsantrasyon riski verdict sentence at top"
```

---

## Task 3: Kur Riski verdict replaces fxSubText

**Files:**
- Modify: `src/components/AnalysisTab.js` lines 1761-1769 (replace `fxSubText` const and its render with verdict JSX)

### Context

The existing `fxSubText` const at line 1761 is a plain string assigned to one of three templates:
- "Portföyünün %X'i dolar/euro kuru riskine açık" (when `dominantFrac > 0.05`)
- "Kur dağılımı dengeli" (when `dominantFrac ≤ 0.05`)
- "Fiyat verisi bekleniyor" (when `fxTotal === 0`)

It's then rendered at line 1769: `<div style={{fontSize:11,color:"var(--text3)",marginBottom:14}}>{fxSubText}</div>`.

We replace both with a JSX-based verdict (since the verdict word needs signal coloring inside a span). The "Fiyat verisi bekleniyor" fallback for `fxTotal===0` is preserved.

### Verdict thresholds

`nonTryFrac = (fxGroups.USD + fxGroups.EUR) / fxTotal`

| Condition | Verdict | Signal | Icon |
|-----------|---------|--------|------|
| `nonTryFrac > 0.70` | yüksek | bad | 🔴 |
| `nonTryFrac >= 0.30` (and ≤ 0.70) | orta | neutral | 🟡 |
| `nonTryFrac > 0` (and < 0.30) | düşük | good | 🟢 |
| `nonTryFrac === 0` | — special-case "Portföy tamamen TRY — kur riski yok." | good | 🟢 |
| `fxTotal === 0` | — keep "Fiyat verisi bekleniyor." string | (no signal) | — |

### Copy template (the 3 main cases)

> 🟢 Portföyün **%X'i yabancı para** cinsinden — kur değişimine **düşük** maruz.

---

- [ ] **Step 1: Replace fxSubText const + render with verdict JSX**

Find this block (lines 1761-1769):

```jsx
        const fxSubText = fxTotal > 0
          ? dominantFrac > 0.05
            ? `Portföyünün %${(dominantFrac * 100).toFixed(0)}'${dominantCur === "USD" ? "i dolar" : "i euro"} kuru riskine açık.`
            : "Kur dağılımı dengeli."
          : "Fiyat verisi bekleniyor.";
        return (
          <div className="card" style={{marginBottom:14,padding:"16px 18px"}}>
            <div className="stitle" style={{marginBottom:4}}>Kur Riski</div>
            <div style={{fontSize:11,color:"var(--text3)",marginBottom:14}}>{fxSubText}</div>
```

Replace with:

```jsx
        const nonTryFrac = fxTotal > 0 ? (fxGroups.USD + fxGroups.EUR) / fxTotal : 0;
        const nonTryPct = Math.round(nonTryFrac * 100);
        const verdictRender = fxTotal === 0
          ? <div style={{fontSize:11,color:"var(--text3)",marginBottom:14}}>Fiyat verisi bekleniyor.</div>
          : nonTryFrac === 0
            ? (
              <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--text2)",marginBottom:14}}>
                <span style={{fontSize:13}}>🟢</span>
                <span><strong style={{color:"var(--text)",fontWeight:500}}>Portföy tamamen TRY</strong> — kur riski yok.</span>
              </div>
            )
            : (()=>{
              const verdictSignal = nonTryFrac > 0.70 ? "bad" : nonTryFrac >= 0.30 ? "neutral" : "good";
              const verdictWord = verdictSignal === "bad" ? "yüksek" : verdictSignal === "neutral" ? "orta" : "düşük";
              const verdictIcon = verdictSignal === "bad" ? "🔴" : verdictSignal === "neutral" ? "🟡" : "🟢";
              const verdictColor = verdictSignal === "bad" ? "var(--err)" : verdictSignal === "neutral" ? "var(--warn)" : "var(--ok)";
              return (
                <div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--text2)",marginBottom:14}}>
                  <span style={{fontSize:13}}>{verdictIcon}</span>
                  <span>
                    Portföyün <strong style={{color:"var(--text)",fontWeight:500}}>%{nonTryPct}'i yabancı para</strong> cinsinden — kur değişimine{" "}
                    <span style={{color:verdictColor}}>{verdictWord}</span> maruz.
                  </span>
                </div>
              );
            })();
        return (
          <div className="card" style={{marginBottom:14,padding:"16px 18px"}}>
            <div className="stitle" style={{marginBottom:4}}>Kur Riski</div>
            {verdictRender}
```

- [ ] **Step 2: Run babel check**

```bash
npm run check:babel
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/AnalysisTab.js
git commit -m "feat(analysis): replace kur riski subText with explicit verdict sentence"
```

---

## Task 4: Visual verification + ui-builder sign-off

**Files:** None (verification only)

- [ ] **Step 1: Start local server**

```bash
npx serve .
```
Open http://localhost:3000 → log in → Analiz tab.

- [ ] **Step 2: Verify Portföy Sağlık**

- Single verdict line replaces the previous 6 per-metric sentences
- Icon + verdict word colored to signal (🟢 güçlü / 🟡 orta / 🔴 zayıf)
- X / Y numbers match the existing rozet counts' underlying metric-level signals
- Rozet counts (top-right) and the F/K KPI and the collapsible Detay table are unchanged

- [ ] **Step 3: Verify Konsantrasyon Riski**

- New verdict line appears at the TOP of the card body, before the big top3% number
- Verdict matches existing `level` badge (Yüksek konc ↔ Yüksek, Orta ↔ Orta, İyi ↔ Düşük)
- Existing closing sentence at the bottom is unchanged

- [ ] **Step 4: Verify Kur Riski**

- For a TRY-only portfolio (`nonTryFrac=0`): shows "🟢 Portföy tamamen TRY — kur riski yok."
- For a mixed portfolio with USD+EUR exposure: shows "🟢/🟡/🔴 Portföyün %X'i yabancı para cinsinden — kur değişimine düşük/orta/yüksek maruz."
- For no price data (`fxTotal=0`): shows "Fiyat verisi bekleniyor." (unchanged)
- The USD/TRY/EUR bar chart and the bottom `warn-card` callouts are unchanged

- [ ] **Step 5: Verify no regression on other AnalysisTab cards**

- Break-Even, Komisyon, Kazanan/Kaybeden, FX Risk (currency exposure table), 6 Aylık Performans, Temettü Özeti — all render normally

- [ ] **Step 6: Final babel check**

```bash
npm run check:babel
```
Expected: no errors.

- [ ] **Step 7: ui-builder sign-off**

Dispatch `ui-builder` agent with: "Review the 3 new verdict sentences added to AnalysisTab cards (Portföy Sağlık aggregate verdict at line ~1099, Konsantrasyon Riski verdict at line ~1358, Kur Riski verdict replacing fxSubText at line ~1761). Verify against spec `docs/superpowers/specs/2026-05-15-analysis-card-verdicts-design.md`. Check that the shared visual pattern (icon + body + signal-colored verdict word) is used consistently across all 3, verdict thresholds match the spec, and edge states (empty/no-data) render correctly. Report only — do not modify files."
