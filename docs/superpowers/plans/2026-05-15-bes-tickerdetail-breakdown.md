# BES TickerDetailTab Breakdown Kartı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "BES Özeti" card to TickerDetailTab that shows 7 rows (Yatırılan Tutar, Kişisel Güncel, Yatırım Getirisi, DK Anaparası, DK Güncel, DK Getirisi, Toplam Değer) and hides all generic metrics for BES positions.

**Architecture:** Single file change to `src/components/TickerDetailTab.js`. Add an `isBes` flag alongside the existing `isDeposit` flag and use it to (a) skip the meta edge call, (b) render the BES card instead of the generic 4-card grid, and (c) suppress dividend income, detail bar, and Şirket Bilgisi sections.

**Tech Stack:** React 18 UMD + Babel Standalone (browser-side JSX, no build step). Validation via `npm run check:babel`. Visual testing via `npx serve .` on http://localhost:3000.

**Spec:** `docs/superpowers/specs/2026-05-15-bes-tickerdetail-breakdown-design.md`

---

## File Map

| File | Change |
|------|--------|
| `src/components/TickerDetailTab.js` | All changes — ~4 line edits + ~70 lines of new JSX |

---

## Task 1: Add `isBes` flag and skip spurious edge calls

**Files:**
- Modify: `src/components/TickerDetailTab.js:403` (isBes constant)
- Modify: `src/components/TickerDetailTab.js:471` (meta useEffect)
- Modify: `src/components/TickerDetailTab.js:475` (divCal useEffect)

### Context

BES tickers (e.g. "AH", "GARANTI_BES") are not real market tickers. Without a guard, TickerDetailTab fires two unnecessary edge calls for every BES position: one to fetch company meta and one to fetch the dividend calendar. Both will fail or return irrelevant data.

- Line 403 currently: `const isDeposit=p?.type==="DEPOSIT";`
- Line 471 currently: `useEffect(()=>{if(!meta)fetchMeta(false);},[ticker,effectiveType]);`
- Line 475 currently: `if(isBist||!p||divCal!==null)return;`

---

- [ ] **Step 1: Add `isBes` constant on line 404 (after `isDeposit`)**

In `src/components/TickerDetailTab.js`, find:
```js
  const isDeposit=p?.type==="DEPOSIT";
```
Change to:
```js
  const isDeposit=p?.type==="DEPOSIT";
  const isBes=p?.type==="BES";
```

- [ ] **Step 2: Guard meta fetch useEffect**

Find:
```js
  useEffect(()=>{if(!meta)fetchMeta(false);},[ticker,effectiveType]);
```
Change to:
```js
  useEffect(()=>{if(isBes||!meta)return;fetchMeta(false);},[ticker,effectiveType]);
```

- [ ] **Step 3: Guard divCal useEffect**

Find:
```js
    if(isBist||!p||divCal!==null)return;
```
Change to:
```js
    if(isBist||isBes||!p||divCal!==null)return;
```

- [ ] **Step 4: Run babel check**

```bash
npm run check:babel
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/TickerDetailTab.js
git commit -m "feat(bes): add isBes flag, skip meta+divCal edge calls for BES"
```

---

## Task 2: Add BES Özeti card

**Files:**
- Modify: `src/components/TickerDetailTab.js` (add ~70-line JSX block after the DEPOSIT card)

### Context

The position summary block starts at the comment `{/* Pozisyon özeti — 4 ana kart (sadece held ticker için) */}`. It currently has:
```jsx
{isDeposit&&( ... DEPOSIT card ... )}
{!isDeposit&&<div className="g4" ...>  ← generic grid
```

We insert the BES card between these two, and later (Task 3) add `!isBes` to the generic grid.

### Data derivations inside the card

```
price        = prc[ticker]                   (total: kişisel_güncel + dk_güncel)
kisGuncel    = price - p.dkCurrent           (kişisel portföy güncel değeri)
kisGetiri    = kisGuncel - p.avgCost         (kişisel portföy kazancı)
dkGetiri     = p.dkCurrent - p.dkPrincipal   (DK kazancı)
dkNull       = p.dkCurrent == null           (eski pozisyon — NULL guard trigger)
```

---

- [ ] **Step 1: Insert BES card after the DEPOSIT card closing `}`**

Find (the closing of the DEPOSIT card block, before the generic grid):
```jsx
        )}
        {!isDeposit&&<div className="g4" style={{marginBottom:8}}>
```
Change to:
```jsx
        )}
        {isBes&&(
          <div className="card" style={{marginBottom:8,padding:"14px 16px"}}>
            <div className="stitle" style={{marginBottom:10}}>BES Özeti</div>
            {(()=>{
              const dkNull=p.dkCurrent==null;
              const kisGuncel=dkNull?null:price-p.dkCurrent;
              const kisGetiri=kisGuncel!=null?kisGuncel-p.avgCost:null;
              const dkGetiri=(p.dkCurrent!=null&&p.dkPrincipal!=null)?p.dkCurrent-p.dkPrincipal:null;
              return(
                <React.Fragment>
                  <div style={{marginBottom:8}}>
                    <div style={{fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"rgba(201,168,76,0.55)",marginBottom:5}}>Kişisel Portföy</div>
                    <div className="kv">
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div className="kk">Yatırılan Tutar</div>
                        <div className="kv_">{mask(sym+fmt(p.avgCost,0))}</div>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div className="kk">Kişisel Güncel</div>
                        <div className="kv_">
                          {dkNull
                            ?<span style={{fontSize:11,color:"var(--warn)"}}>⚠ DK bilgisi güncellenmeli</span>
                            :mask(sym+fmt(kisGuncel,0))}
                        </div>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div className="kk" style={{fontSize:9}}>Yatırım Getirisi</div>
                        <div style={{fontFamily:"var(--font-numeric)",fontSize:12,fontWeight:500}}>
                          {kisGetiri!=null
                            ?<span style={{color:kisGetiri>=0?"var(--ok)":"var(--err)"}}>{mask((kisGetiri>=0?"+":"−")+sym+fmt(Math.abs(kisGetiri),0))}</span>
                            :"—"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{background:"rgba(201,168,76,0.05)",border:"1px solid rgba(201,168,76,0.1)",borderRadius:8,padding:"8px 10px",marginBottom:8}}>
                    <div style={{fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"rgba(201,168,76,0.55)",marginBottom:5}}>Devlet Katkısı</div>
                    <div className="kv">
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div className="kk">DK Anaparası</div>
                        <div className="kv_">{p.dkPrincipal!=null?mask(sym+fmt(p.dkPrincipal,0)):"—"}</div>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div className="kk">DK Güncel</div>
                        <div className="kv_">{p.dkCurrent!=null?mask(sym+fmt(p.dkCurrent,0)):"—"}</div>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div className="kk" style={{fontSize:9}}>DK Getirisi</div>
                        <div style={{fontFamily:"var(--font-numeric)",fontSize:12,fontWeight:500}}>
                          {dkGetiri!=null
                            ?<span style={{color:dkGetiri>=0?"var(--ok)":"var(--err)"}}>{mask((dkGetiri>=0?"+":"−")+sym+fmt(Math.abs(dkGetiri),0))}</span>
                            :"—"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{borderTop:"0.5px solid var(--border)",paddingTop:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",color:"var(--text2)"}}>Toplam Değer</div>
                    <div style={{fontFamily:"var(--font-numeric)",fontSize:16,fontWeight:700,color:"var(--info)"}}>{price!=null?mask(sym+fmt(price,0)):"—"}</div>
                  </div>
                </React.Fragment>
              );
            })()}
          </div>
        )}
        {!isDeposit&&<div className="g4" style={{marginBottom:8}}>
```

- [ ] **Step 2: Run babel check**

```bash
npm run check:babel
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/TickerDetailTab.js
git commit -m "feat(bes): add BES Özeti card with two-section layout"
```

---

## Task 3: Suppress generic sections for BES

**Files:**
- Modify: `src/components/TickerDetailTab.js` (4 guard additions)

### Context

Four sections must be hidden for BES:

1. **Generic 4-card grid** — `{!isDeposit&&<div className="g4"` → add `&&!isBes`
2. **Detail bar** (Ort. Maliyet / Realized / Unrealized / Komisyon) — `{p&&!isDeposit&&(` → add `&&!isBes`
3. **Dividend income** block — `{totalDivIncome>0&&(` → add `!isBes&&`
4. **Şirket Bilgisi** — `{!isDeposit&&(()=>{` → add `&&!isBes`

The cost-currency warning card (`p.avgCost>price*30`) already excludes BES because BES positions have `currency="TRY"`, so `p.currency!=="TRY"` is false. No change needed there.

Fundamentals and grades sections already exclude BES via `supportsFund` (which only includes `US_STOCK` and `BIST`). No change needed there either.

---

- [ ] **Step 1: Guard the generic 4-card grid**

Find:
```jsx
        {!isDeposit&&<div className="g4" style={{marginBottom:8}}>
```
Change to:
```jsx
        {!isDeposit&&!isBes&&<div className="g4" style={{marginBottom:8}}>
```

- [ ] **Step 2: Guard the detail bar (Ort. Maliyet / Realized / Unrealized / Komisyon)**

Find:
```jsx
      {p&&!isDeposit&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:14,padding:"8px 14px",marginBottom:14,fontSize:11,color:"var(--text2)",background:"var(--bg2)",borderRadius:8,border:"0.5px solid var(--border)"}}>
```
Change to:
```jsx
      {p&&!isDeposit&&!isBes&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:14,padding:"8px 14px",marginBottom:14,fontSize:11,color:"var(--text2)",background:"var(--bg2)",borderRadius:8,border:"0.5px solid var(--border)"}}>
```

- [ ] **Step 3: Guard the dividend income block**

Find:
```jsx
        {totalDivIncome>0&&(
          <div style={{marginTop:6,padding:"10px 12px",background:"var(--bg3)",borderRadius:8,border:"1px solid rgba(0,217,126,0.15)"}}>
```
Change to:
```jsx
        {!isBes&&totalDivIncome>0&&(
          <div style={{marginTop:6,padding:"10px 12px",background:"var(--bg3)",borderRadius:8,border:"1px solid rgba(0,217,126,0.15)"}}>
```

- [ ] **Step 4: Guard the Şirket Bilgisi section**

Find:
```jsx
      {!isDeposit&&(()=>{
        const hasDetailMeta = meta && (
```
Change to:
```jsx
      {!isDeposit&&!isBes&&(()=>{
        const hasDetailMeta = meta && (
```

- [ ] **Step 5: Run babel check**

```bash
npm run check:babel
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/TickerDetailTab.js
git commit -m "feat(bes): suppress generic grid, detail bar, dividends, şirket bilgisi for BES"
```

---

## Task 4: Visual verification and ui-builder sign-off

**Files:** None (verification only)

- [ ] **Step 1: Start local server**

```bash
npx serve .
```
Open http://localhost:3000 in browser.

- [ ] **Step 2: Verify BES position — normal case (dk dolu)**

Open a BES position in TickerDetailTab. Confirm:
- "BES Özeti" card visible with 2 sections
- Kişisel Portföy section: Yatırılan Tutar, Kişisel Güncel (₺ value), Yatırım Getirisi (sub-row, +/− colored)
- Devlet Katkısı section (tinted gold box): DK Anaparası, DK Güncel, DK Getirisi (sub-row, +/− colored)
- Toplam Değer footer in gold, 16px bold
- No "Adet", "Toplam Maliyet", "Şirket Bilgisi", "Temettü Geliri", "Ort. Maliyet" rows visible
- No edge call fired for meta (check browser Network tab — no `fetch-fundamentals` request)

- [ ] **Step 3: Verify BES position — NULL guard**

If you have an old BES position without dk_principal/dk_current, open it. Confirm:
- Yatırılan Tutar shows a value
- Kişisel Güncel shows "⚠ DK bilgisi güncellenmeli" in orange/yellow
- Yatırım Getirisi, DK Anaparası, DK Güncel, DK Getirisi all show "—"
- Toplam Değer shows a value
- App does not crash

To simulate a NULL guard case without a real old position: temporarily set `p.dkCurrent` to `null` in browser devtools by pausing at a breakpoint in TickerDetailTab render — or trust that the conditional logic `dkNull=p.dkCurrent==null` is correct given the guard handles all derived values.

- [ ] **Step 4: Verify no regression on non-BES positions**

Open one DEPOSIT, one US_STOCK, and one BIST position. Confirm:
- DEPOSIT: Mevduat Özeti card shows normally
- US_STOCK: Generic 4-card grid + Şirket Bilgisi + Temettü sections show normally
- BIST: Generic 4-card grid shows; Şirket Bilgisi shows (if meta available)

- [ ] **Step 5: Run babel check one final time**

```bash
npm run check:babel
```
Expected: no errors.

- [ ] **Step 6: ui-builder sign-off**

Dispatch `ui-builder` agent with: "Review the BES Özeti card in src/components/TickerDetailTab.js. Verify the two-section layout (Kişisel Portföy + Devlet Katkısı tinted box + Toplam footer) matches the approved design in docs/superpowers/specs/2026-05-15-bes-tickerdetail-breakdown-design.md. Check that derived values (kisGuncel, kisGetiri, dkGetiri) are computed correctly per the spec's data model. Verify NULL guard (dkNull) handles all 5 affected rows. Report only — do not modify files."

- [ ] **Step 7: Final commit**

```bash
git add src/components/TickerDetailTab.js
git commit -m "feat(bes): BES TickerDetailTab breakdown card — Sprint 19 Item 1

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
