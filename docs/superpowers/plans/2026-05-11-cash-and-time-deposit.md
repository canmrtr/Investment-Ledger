# Cash & Time Deposit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `CASH` and `DEPOSIT` as first-class asset types — a bank account balance (no interest) and a term deposit (principal × accrual factor) — included in KPIs, XIRR, and allocation pie.

**Architecture:** Two new nullable columns (`interest_rate`, `maturity_date`) on `positions`. `rebuild_positions_atomic` RPC is extended to persist them. Prices are synthetic (never fetched externally): CASH = 1.0, DEPOSIT = `1 + rate × elapsed_days/360`. All other pipes (XIRR, allDisp, pie) work automatically once prc contains the synthetic prices.

**Tech Stack:** Supabase SQL (migration + RPC), React 18 JSX (Babel standalone), no build step. Run `npm run check:babel` after every JS file edit. Verify at `http://localhost:3000` via `npx serve .`.

**Spec:** `docs/superpowers/specs/2026-05-11-cash-and-time-deposit-design.md`

---

## File Map

| File | Change |
|---|---|
| `supabase/migrations/016_cash_deposit.sql` | **Create** — new columns + updated RPC |
| `src/constants.js` | **Modify** — add CASH/DEPOSIT to TL, TYPE_COLORS |
| `src/utils.js` | **Modify** — ASSET_ICONS, BLOCK_TYPES, rebuildPositions |
| `src/components/App.js` | **Modify** — setPos mapping, priceCur, synthetic price injection, fetchPrices/fetchHist exclusions, block renderer |
| `src/components/AddTab.js` | **Modify** — ADD_TYPES, Manuel-only restriction |
| `src/components/ManuelPosForm.js` | **Modify** — CASH/DEPOSIT mode fields, save logic |
| `src/components/AnalysisTab.js` | **Modify** — exclude from HHI concentration risk |

---

## Task 1: DB Migration — new columns + updated RPC

**Files:**
- Create: `supabase/migrations/016_cash_deposit.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/016_cash_deposit.sql
-- Add interest_rate and maturity_date to positions for CASH/DEPOSIT types.
-- Update rebuild_positions_atomic to persist the new columns.

BEGIN;

ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS interest_rate numeric,
  ADD COLUMN IF NOT EXISTS maturity_date  date;

CREATE OR REPLACE FUNCTION rebuild_positions_atomic(
  p_user_id      uuid,
  p_portfolio_id uuid,
  p_positions    jsonb
)
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  inserted int := 0;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  DELETE FROM positions
  WHERE user_id = p_user_id AND portfolio_id = p_portfolio_id;

  IF p_positions IS NOT NULL AND jsonb_array_length(p_positions) > 0 THEN
    INSERT INTO positions (
      user_id, portfolio_id, ticker, name, type,
      shares, avg_cost, currency, broker, unit,
      interest_rate, maturity_date,
      updated_at
    )
    SELECT
      p_user_id,
      p_portfolio_id,
      el->>'ticker',
      el->>'name',
      el->>'type',
      (el->>'shares')::numeric,
      (el->>'avg_cost')::numeric,
      el->>'currency',
      el->>'broker',
      el->>'unit',
      NULLIF(el->>'interest_rate', '')::numeric,
      NULLIF(el->>'maturity_date', '')::date,
      (el->>'updated_at')::timestamptz
    FROM jsonb_array_elements(p_positions) AS el;

    GET DIAGNOSTICS inserted = ROW_COUNT;
  END IF;

  RETURN inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION rebuild_positions_atomic(uuid, uuid, jsonb) TO authenticated;

COMMIT;
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `mcp__supabase__apply_migration` with:
- `name`: `016_cash_deposit`
- `query`: the full SQL from Step 1

Expected: migration applies cleanly, no errors. Verify with `mcp__supabase__list_tables` that `positions` now has `interest_rate` and `maturity_date` columns (or check via `mcp__supabase__execute_sql`: `SELECT column_name FROM information_schema.columns WHERE table_name='positions' ORDER BY ordinal_position;`).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/016_cash_deposit.sql
git commit -m "feat(db): add interest_rate, maturity_date to positions; extend rebuild_positions_atomic RPC"
```

---

## Task 2: Type constants — TL, TYPE_COLORS, ASSET_ICONS

**Files:**
- Modify: `src/constants.js` (line 23 — TL; line 25 — TYPE_COLORS)
- Modify: `src/utils.js` (line 493 — ASSET_ICONS; line 156 — BLOCK_TYPES)

- [ ] **Step 1: Add CASH and DEPOSIT to TL (src/constants.js line 23)**

Old:
```js
const TL = {US_STOCK:"Hisse",FUND:"ETF/Fon",CRYPTO:"Kripto",BIST:"BIST",GOLD:"Altın",FX:"Döviz",BES:"BES Fonu"};
```
New:
```js
const TL = {US_STOCK:"Hisse",FUND:"ETF/Fon",CRYPTO:"Kripto",BIST:"BIST",GOLD:"Altın",FX:"Döviz",BES:"BES Fonu",CASH:"Nakit",DEPOSIT:"Vadeli Mevduat"};
```

- [ ] **Step 2: Add CASH and DEPOSIT to TYPE_COLORS (src/constants.js line 25)**

Old ends at:
```js
  BES:      "#EC4899",  // bireysel emeklilik
```
New (add two lines):
```js
  BES:      "#EC4899",  // bireysel emeklilik
  CASH:     "#64748B",  // slate — nakit
  DEPOSIT:  "#6366F1",  // indigo — vadeli mevduat
```

- [ ] **Step 3: Add CASH and DEPOSIT icons to ASSET_ICONS (src/utils.js after BES icon, ~line 500)**

Old ends at:
```js
  BES:      (s=24)=><svg ...></svg>,
};
```
New (add before the closing `}`):
```js
  BES:      (s=24)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6L12 2z"/><path d="M9 12l2 2 4-4"/></svg>,
  CASH:     (s=24)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>,
  DEPOSIT:  (s=24)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 14h2m2 0h4"/><path d="M8 17h2"/></svg>,
};
```

- [ ] **Step 4: Add CASH and DEPOSIT to BLOCK_TYPES (src/utils.js after BES entry, ~line 163)**

Old ends at:
```js
  {type:"BES",      label:"BES Fonları",cur:"TRY", sym:"₺", badge:"bes", icon:(s=14)=>ASSET_ICONS.BES(s)},
];
```
New (add before the `]`):
```js
  {type:"BES",      label:"BES Fonları",cur:"TRY", sym:"₺", badge:"bes",  icon:(s=14)=>ASSET_ICONS.BES(s)},
  {type:"CASH",     label:"Nakit",      cur:"",    sym:"",  mixed:true, badge:null, icon:(s=14)=>ASSET_ICONS.CASH(s)},
  {type:"DEPOSIT",  label:"Vadeli Mevduat",cur:"", sym:"",  mixed:true, badge:null, icon:(s=14)=>ASSET_ICONS.DEPOSIT(s)},
];
```

`mixed:true` signals the block renderer to convert totals to display currency (handled in Task 5).

- [ ] **Step 5: Run babel check**

```bash
npm run check:babel
```
Expected: all files parse OK, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/constants.js src/utils.js
git commit -m "feat(types): add CASH and DEPOSIT asset types — constants, icons, block definitions"
```

---

## Task 3: rebuildPositions — preserve interest_rate and maturity_date

**Files:**
- Modify: `src/utils.js` — `rebuildPositions` function (~line 290–380)

The function currently snapshots `ticker,unit` from existing positions and restores them. We extend it to also snapshot `interest_rate` and `maturity_date`, and accept an optional `extraMeta` map so `ManuelPosForm` can pass these values for newly-created DEPOSIT positions (before any snapshot exists).

- [ ] **Step 1: Update the snapshot SELECT to include new columns (~line 358)**

Old:
```js
  const snapRes = await sb.from("positions").select("ticker,unit").eq("user_id",userId).eq("portfolio_id",pid);
  const unitMap = Object.fromEntries((snapRes.data||[]).map(p=>[p.ticker,p.unit||null]));
```
New:
```js
  const snapRes = await sb.from("positions").select("ticker,unit,interest_rate,maturity_date").eq("user_id",userId).eq("portfolio_id",pid);
  const unitMap = Object.fromEntries((snapRes.data||[]).map(p=>[p.ticker,p.unit||null]));
  const depositSnapMap = {};
  for(const p of (snapRes.data||[])){
    if(p.interest_rate!=null||p.maturity_date!=null){
      depositSnapMap[p.ticker]={interest_rate:p.interest_rate,maturity_date:p.maturity_date};
    }
  }
```

- [ ] **Step 2: Accept optional extraMeta parameter and merge with snapshot**

Old function signature:
```js
const rebuildPositions = async (userId, pid) => {
```
New:
```js
const rebuildPositions = async (userId, pid, extraMeta = {}) => {
```

After building `depositSnapMap`, merge:
```js
  const depositMap = {...depositSnapMap, ...extraMeta};
```

(extraMeta keys override the snapshot — e.g., when user edits an existing deposit with a new rate.)

- [ ] **Step 3: Include interest_rate and maturity_date in the np array (~line 361)**

Old:
```js
  const np = Object.values(pm).filter(p => p.shares > CFG.DUST_THRESHOLD).map(p => ({
    ticker: p.ticker, name: p.name, type: p.type,
    shares: +p.shares.toFixed(6), avg_cost: +(p.cost/p.shares).toFixed(6),
    currency: p.currency, broker: p.broker,
    unit: unitMap[p.ticker] ?? null,
    updated_at: new Date().toISOString()
  }));
```
New:
```js
  const np = Object.values(pm).filter(p => p.shares > CFG.DUST_THRESHOLD).map(p => ({
    ticker: p.ticker, name: p.name, type: p.type,
    shares: +p.shares.toFixed(6), avg_cost: +(p.cost/p.shares).toFixed(6),
    currency: p.currency, broker: p.broker,
    unit: unitMap[p.ticker] ?? null,
    interest_rate: depositMap[p.ticker]?.interest_rate ?? null,
    maturity_date: depositMap[p.ticker]?.maturity_date ?? null,
    updated_at: new Date().toISOString()
  }));
```

- [ ] **Step 4: Run babel check**

```bash
npm run check:babel
```
Expected: OK.

- [ ] **Step 5: Commit**

```bash
git add src/utils.js
git commit -m "feat(rebuildPositions): preserve interest_rate and maturity_date; accept extraMeta for new deposits"
```

---

## Task 4: App.js — setPos mapping, priceCur, synthetic price injection

**Files:**
- Modify: `src/components/App.js`

Three related changes in `loadData`:
1. Map `interest_rate`/`maturity_date` from DB into position objects
2. Fix `priceCur` for CASH/DEPOSIT in `allDisp`
3. Inject synthetic prices for CASH/DEPOSIT after loading price_cache

- [ ] **Step 1: Extend setPos to include new fields (~line 199)**

Old:
```js
    if(pr.data)setPos(pr.data.map(p=>({ticker:p.ticker,name:p.name,type:p.type,shares:+p.shares,avgCost:+p.avg_cost,currency:p.currency,broker:p.broker,unit:p.unit||null})));
```
New:
```js
    if(pr.data)setPos(pr.data.map(p=>({ticker:p.ticker,name:p.name,type:p.type,shares:+p.shares,avgCost:+p.avg_cost,currency:p.currency,broker:p.broker,unit:p.unit||null,interestRate:p.interest_rate!=null?+p.interest_rate:null,maturityDate:p.maturity_date||null})));
```

- [ ] **Step 2: Inject synthetic prices after the price_cache block (~line 217, after the closing `}` of the `if(pc.data&&pc.data.length)` block)**

Add this block immediately after `setBusy(b=>({...b,d:false}));` is NOT right — add it right after the `if(pc.data&&pc.data.length){...}` closing brace, before `setBusy`:

```js
    // Synthetic prices for CASH/DEPOSIT — computed locally, never fetched from price_cache
    const synthPos = (pr.data||[]).filter(p=>p.type==="CASH"||p.type==="DEPOSIT");
    if(synthPos.length){
      const np2={};
      for(const p of synthPos){
        if(p.type==="CASH"){
          np2[p.ticker]=1.0;
        } else if(p.interest_rate!=null){
          const ir=+p.interest_rate;
          const buyTxs=(tr.data||[]).filter(t=>t.ticker===p.ticker&&t.way==="BUY");
          const earliest=buyTxs.length?buyTxs.map(t=>new Date(t.date).getTime()).reduce((a,b)=>Math.min(a,b)):Date.now();
          const maturityMs=p.maturity_date?new Date(p.maturity_date).getTime():earliest;
          const days=Math.max(0,(Math.min(Date.now(),maturityMs)-earliest)/86400000);
          np2[p.ticker]=1+ir*(days/360);
        }
      }
      setPrc_(prev=>({...prev,...np2}));
    }
```

- [ ] **Step 3: Fix priceCur for CASH/DEPOSIT in allDisp (~line 319)**

Old:
```js
    const priceCur = (p.type==="BIST"||p.type==="BES") ? "TRY" : "USD";
```
New:
```js
    const priceCur = (p.type==="BIST"||p.type==="BES") ? "TRY" :
                     (p.type==="CASH"||p.type==="DEPOSIT") ? (p.currency||"TRY") : "USD";
```

- [ ] **Step 4: Run babel check**

```bash
npm run check:babel
```
Expected: OK.

- [ ] **Step 5: Commit**

```bash
git add src/components/App.js
git commit -m "feat(app): map interest_rate/maturity_date in setPos; synthetic prices for CASH/DEPOSIT; priceCur fix"
```

---

## Task 5: App.js — exclude CASH/DEPOSIT from fetchPrices and fetchHist

**Files:**
- Modify: `src/components/App.js`

CASH/DEPOSIT tickers should never be passed to the `fetch-prices` edge function. They could accidentally match the `currency==="USD"` filter in `fetchPrices`.

- [ ] **Step 1: Exclude from fetchPrices (~line 376)**

Old:
```js
    const posFetchable=pos.filter(p=>p.currency==="USD"||p.type==="BIST"||p.type==="GOLD"||p.type==="CRYPTO")
      .map(p=>({ticker:p.ticker,type:p.type}));
```
New:
```js
    const posFetchable=pos.filter(p=>p.type!=="CASH"&&p.type!=="DEPOSIT"&&(p.currency==="USD"||p.type==="BIST"||p.type==="GOLD"||p.type==="CRYPTO"))
      .map(p=>({ticker:p.ticker,type:p.type}));
```

- [ ] **Step 2: Exclude from auto fetchHist trigger (~line 277)**

Old:
```js
    const posTickers=pos.filter(p=>p.currency==="USD"||p.type==="BIST"||p.type==="GOLD"||p.type==="CRYPTO").map(p=>p.ticker);
```
New:
```js
    const posTickers=pos.filter(p=>p.type!=="CASH"&&p.type!=="DEPOSIT"&&(p.currency==="USD"||p.type==="BIST"||p.type==="GOLD"||p.type==="CRYPTO")).map(p=>p.ticker);
```

- [ ] **Step 3: Exclude from fetchHist when building fetchable list (~line 408)**

Old:
```js
      : pos.filter(p=>p.currency==="USD"||p.type==="BIST"||p.type==="GOLD"||p.type==="CRYPTO").map(p=>({ticker:p.ticker,type:p.type}));
```
New:
```js
      : pos.filter(p=>p.type!=="CASH"&&p.type!=="DEPOSIT"&&(p.currency==="USD"||p.type==="BIST"||p.type==="GOLD"||p.type==="CRYPTO")).map(p=>({ticker:p.ticker,type:p.type}));
```

- [ ] **Step 4: Run babel check**

```bash
npm run check:babel
```
Expected: OK.

- [ ] **Step 5: Commit**

```bash
git add src/components/App.js
git commit -m "fix(app): exclude CASH/DEPOSIT from fetchPrices and fetchHist edge function calls"
```

---

## Task 6: App.js — block renderer mixed-currency support

**Files:**
- Modify: `src/components/App.js` (~lines 779–810)

Blocks with `cfg.mixed:true` (CASH, DEPOSIT) hold positions in different currencies. `totMv` must be converted to display currency, and `dSym` used as the block header symbol.

- [ ] **Step 1: Update mvOf sort function to handle mixed blocks (~line 780)**

Old:
```js
              const mvOf=t=>filteredPos.filter(p=>p.type===t).map(wrapPos).reduce((s,p)=>s+(p.mv??p.cost),0);
              const toUsd=(mv,t)=>(t==="BIST"||t==="BES")?(convert(mv,"TRY","USD",fxRates)??0):mv;
```
New:
```js
              const mvOf=t=>{
                const ps=filteredPos.filter(p=>p.type===t).map(wrapPos);
                const bt=BLOCK_TYPES.find(b=>b.type===t);
                if(bt?.mixed) return ps.reduce((s,p)=>s+(cnv(p.mv??p.cost,p.currency||"TRY")??0),0);
                return ps.reduce((s,p)=>s+(p.mv??p.cost),0);
              };
              const toUsd=(mv,t)=>(t==="BIST"||t==="BES")?(convert(mv,"TRY","USD",fxRates)??0):
                           (t==="CASH"||t==="DEPOSIT")?(convert(mv,displayCur,"USD",fxRates)??0):mv;
```

- [ ] **Step 2: Update totMv calculation to convert mixed blocks (~line 787)**

Old:
```js
              const totMv = items.reduce((a,p)=>a+(p.mv ?? p.cost),0);
```
New:
```js
              const totMv = cfg.mixed
                ? items.reduce((a,p)=>a+(cnv(p.mv??p.cost,p.currency||"TRY")??0),0)
                : items.reduce((a,p)=>a+(p.mv ?? p.cost),0);
```

- [ ] **Step 3: Use dSym for mixed block header total (~line 809)**

Old:
```js
                      {!hide&&<span style={{fontSize:15,fontWeight:500,fontFamily:"var(--font-numeric)",color:"var(--text)"}}>{mask(cfg.sym+fmt(totMv,0))}</span>}
```
New:
```js
                      {!hide&&<span style={{fontSize:15,fontWeight:500,fontFamily:"var(--font-numeric)",color:"var(--text)"}}>{mask((cfg.mixed?dSym:cfg.sym)+fmt(totMv,0))}</span>}
```

- [ ] **Step 4: Use position currency for price cell in mixed block rows (~line 835)**

Old:
```js
                            {!hide&&<td className="r mono" style={{color:"var(--text2)"}}>{curPrc!=null?mask(cfg.sym+fmt(curPrc*ozF2,2)):"—"}</td>}
```
New:
```js
                            {!hide&&<td className="r mono" style={{color:"var(--text2)"}}>{curPrc!=null?mask((cfg.mixed?displaySym(p.currency):cfg.sym)+fmt(curPrc*ozF2,2)):"—"}</td>}
```

Same fix for the "Değer" (mv) cell (~line 836):
Old:
```js
                            {!hide&&<td className="r">{p.mv?mask(cfg.sym+fmt(p.mv,0)):"—"}</td>}
```
New:
```js
                            {!hide&&<td className="r">{p.mv?mask((cfg.mixed?displaySym(p.currency):cfg.sym)+fmt(p.mv,0)):"—"}</td>}
```

- [ ] **Step 5: Add maturity date badge to DEPOSIT rows in the desktop table (~line 833)**

In the `<td className="l">` cell that renders `p.ticker` and `p.name`, add a conditional badge after the `<span className="tname">`:

```jsx
<td className="l">
  <div className="tcell">
    <span className="tsym">{p.ticker}</span>
    <span className="tname">{p.name}</span>
    {p.type==="DEPOSIT"&&p.maturityDate&&(()=>{
      const ms=new Date(p.maturityDate)-Date.now();
      const past=ms<0,soon=ms<30*86400000;
      const bg=past?"rgba(255,51,102,0.15)":soon?"rgba(255,184,0,0.15)":"rgba(0,217,126,0.08)";
      const col=past?"var(--err)":soon?"var(--warn)":"var(--ok)";
      return <span style={{fontSize:9,padding:"1px 5px",borderRadius:8,marginLeft:4,background:bg,color:col,whiteSpace:"nowrap"}}>Vade {fmtDateTR(p.maturityDate)}</span>;
    })()}
  </div>
</td>
```

- [ ] **Step 6: Same fix for mobile card list (~line 859, 870)**

In the mobile card renderer, replace:
```js
                      const priceStr=curPrice!=null?cfg.sym+fmt(curPrice*ozF,2):"—";
```
With:
```js
                      const priceStr=curPrice!=null?(cfg.mixed?displaySym(p.currency):cfg.sym)+fmt(curPrice*ozF,2):"—";
```

And (~line 870):
```js
                            <span className="pcr-mv">{p.mv!=null?mask(cfg.sym+fmt(p.mv,0)):"—"}</span>
```
With:
```js
                            <span className="pcr-mv">{p.mv!=null?mask((cfg.mixed?displaySym(p.currency):cfg.sym)+fmt(p.mv,0)):"—"}</span>
```

- [ ] **Step 6: Run babel check**

```bash
npm run check:babel
```
Expected: OK.

- [ ] **Step 7: Commit**

```bash
git add src/components/App.js
git commit -m "feat(dashboard): mixed-currency block rendering for CASH/DEPOSIT positions"
```

---

## Task 7: AddTab — CASH and DEPOSIT types with Manuel-only mode

**Files:**
- Modify: `src/components/AddTab.js` (lines 5–13 and the mode tabs section ~line 194)

- [ ] **Step 1: Add entries to ADD_TYPES (~line 12)**

Old ends at:
```js
  {type:"BES",      label:"BES Fonu",   desc:"Bireysel Emeklilik — AGS001, PEB011"},
];
```
New:
```js
  {type:"BES",      label:"BES Fonu",        desc:"Bireysel Emeklilik — AGS001, PEB011"},
  {type:"CASH",     label:"Nakit",           desc:"Banka hesabı — TRY, USD, EUR"},
  {type:"DEPOSIT",  label:"Vadeli Mevduat",  desc:"Faizli sabit vadeli hesap"},
];
```

- [ ] **Step 2: Restrict CASH/DEPOSIT to Manuel mode only (~line 194)**

Find the line that renders mode tabs. It looks like:
```js
  const MODES=[["text","📝 Metin"],["image","📷 Görüntü"],["csv","📋 CSV"],["manuel","📌 Manuel"]];
```

After that line, find where modes are rendered (they appear as tab buttons). The modes are rendered in a `<div>` with `.mtab` buttons. Add a constant for Manuel-only types and render accordingly.

Add before `const MODES=[...]`:
```js
  const MANUEL_ONLY_TYPES = new Set(["CASH","DEPOSIT"]);
```

Then when rendering mode tabs, filter them:
```js
  const visibleModes = pickedType && MANUEL_ONLY_TYPES.has(pickedType)
    ? MODES.filter(([m])=>m==="manuel")
    : MODES;
```

Replace `MODES.map(...)` (in the tab button render) with `visibleModes.map(...)`.

Also, when `pickedType` is set to a MANUEL_ONLY type, auto-set mode to "manuel":
In the type picker `onClick` handler:
```js
onClick={()=>{setPickedType(type); if(MANUEL_ONLY_TYPES.has(type)) setMode("manuel");}}
```

- [ ] **Step 3: Run babel check**

```bash
npm run check:babel
```
Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add src/components/AddTab.js
git commit -m "feat(addtab): add CASH and DEPOSIT types; restrict to Manuel mode only"
```

---

## Task 8: ManuelPosForm — CASH and DEPOSIT mode fields

**Files:**
- Modify: `src/components/ManuelPosForm.js`

Key design:
- For CASH: ticker label = "Hesap Etiketi", amount label = "Bakiye", avg_cost hidden (always 1.0), no price fetch, currency picker TRY/USD/EUR.
- For DEPOSIT: same as CASH + "Faiz Oranı (%)" + "Vade Tarihi" fields.
- On save: `shares = +form.shares` (balance), `price = 1.0`, pass `extraMeta` to `rebuildPositions`.
- Skip price fetch for CASH/DEPOSIT (same pattern as BES).
- `startEdit` must include `interestRate` and `maturityDate`.

- [ ] **Step 1: Add CASH/DEPOSIT fields to form initial state (~line 9)**

Old:
```js
  const E={ticker:"",name:"",type:initType,shares:"",avgCost:"",currency:initCurrency,broker:"",commission:"",date:today(),unit:"oz"};
```
New:
```js
  const E={ticker:"",name:"",type:initType,shares:"",avgCost:"",currency:initCurrency,broker:"",commission:"",date:today(),unit:"oz",interestRate:"",maturityDate:""};
```

- [ ] **Step 2: Update initCurrency default for CASH/DEPOSIT (~line 8)**

Old:
```js
  const initCurrency = (initType==="BIST"||initType==="BES") ? "TRY" : "USD";
```
New:
```js
  const initCurrency = (initType==="BIST"||initType==="BES"||initType==="CASH"||initType==="DEPOSIT") ? "TRY" : "USD";
```

- [ ] **Step 3: Skip price fetch for CASH/DEPOSIT (~line 37, same pattern as BES)**

Old:
```js
    if(at==="BES")return;  // BES: NAV manuel girilir, auto-fetch atla
```
New:
```js
    if(at==="BES"||at==="CASH"||at==="DEPOSIT")return;
```

- [ ] **Step 4: Update startEdit to populate DEPOSIT fields (~line 83)**

Old:
```js
  const startEdit=p=>{
    setEditTk(p.ticker);
    setForm({...E,ticker:p.ticker,name:p.name,type:p.type,shares:p.shares,avgCost:p.avgCost,currency:p.currency,broker:p.broker||""});
    fetchPrice(p.ticker);
  };
```
New:
```js
  const startEdit=p=>{
    setEditTk(p.ticker);
    setForm({...E,ticker:p.ticker,name:p.name,type:p.type,shares:p.shares,avgCost:p.avgCost,currency:p.currency,broker:p.broker||"",
      interestRate:p.interestRate!=null?(p.interestRate*100).toString():"",
      maturityDate:p.maturityDate||""});
    fetchPrice(p.ticker);
  };
```

- [ ] **Step 5: Update savePos to handle CASH/DEPOSIT — save with price=1.0 and pass extraMeta (~line 89)**

Add validation for DEPOSIT fields. Find the `validate` function and extend it:

Old:
```js
  const validate=()=>{
    const e={};
    if(+form.shares<=0||isNaN(+form.shares))e.shares="Adet 0'dan büyük olmalı";
    if(+form.avgCost<=0||isNaN(+form.avgCost))e.avgCost="Fiyat 0'dan büyük olmalı";
    setErrs(e);
    return Object.keys(e).length===0;
  };
```
New:
```js
  const validate=()=>{
    const e={};
    if(+form.shares<=0||isNaN(+form.shares))e.shares="Adet 0'dan büyük olmalı";
    if(form.type!=="CASH"&&form.type!=="DEPOSIT"){
      if(+form.avgCost<=0||isNaN(+form.avgCost))e.avgCost="Fiyat 0'dan büyük olmalı";
    }
    if(form.type==="DEPOSIT"){
      if(!form.interestRate||+form.interestRate<=0)e.interestRate="Faiz oranı 0'dan büyük olmalı";
      if(!form.maturityDate)e.maturityDate="Vade tarihi gerekli";
    }
    setErrs(e);
    return Object.keys(e).length===0;
  };
```

In `savePos`, before the tx insert, add CASH/DEPOSIT special handling:

Old (around line 93–116):
```js
    const ozFactor = form.type==="GOLD" ? goldOzPerUnit(form.unit||'oz') : 1;
    const sh = +form.shares * ozFactor;
    const pr = +form.avgCost / ozFactor;
    const goldUnitNote = form.type==="GOLD"&&form.unit&&form.unit!=="oz" ? `Manuel giriş (${form.unit})` : "Manuel giriş";
    const tx={
      ...
      shares:sh,price:pr,
      ...
      notes:goldUnitNote,
      ...
    };
```
New (insert right before the ozFactor line):
```js
    const isCashType = form.type==="CASH"||form.type==="DEPOSIT";
    const ozFactor = form.type==="GOLD" ? goldOzPerUnit(form.unit||'oz') : 1;
    const sh = isCashType ? +form.shares : +form.shares * ozFactor;
    const pr = isCashType ? 1.0 : +form.avgCost / ozFactor;
    const goldUnitNote = form.type==="GOLD"&&form.unit&&form.unit!=="oz" ? `Manuel giriş (${form.unit})` : "Manuel giriş";
    const cashNote = isCashType ? (form.type==="CASH"?"Nakit hesap":"Vadeli mevduat") : null;
    const tx={
      user_id:user.id,
      date:form.date||today(),
      ticker:tk,name:nm,
      asset_type:form.type,
      way:"BUY",
      shares:sh,price:pr,
      currency:form.currency,
      total:+(sh*pr).toFixed(4),
      broker:form.broker||"",
      commission:+(form.commission||0),exchange:"",notes:cashNote||goldUnitNote,
      portfolio_id:portfolioId
    };
```

After the tx insert, update the `rebuildPositions` call to pass extraMeta for DEPOSIT:

Old:
```js
    const rebuilt=await rebuildPositions(user.id,portfolioId);
```
New:
```js
    const depositMeta = form.type==="DEPOSIT"?{[tk]:{interest_rate:+form.interestRate/100,maturity_date:form.maturityDate}}:{};
    const rebuilt=await rebuildPositions(user.id,portfolioId,depositMeta);
```

- [ ] **Step 6: Add CASH/DEPOSIT UI fields to the form JSX**

The form has these grid sections in order: date+ticker → type+currency → shares+avgCost → broker+commission → Save button. DEPOSIT-specific fields go **after the broker/commission row and before the Save button**.

In the form JSX, the ticker field label currently checks for BES (`form.type==="BES"?"Fon Kodu *":"Ticker *"`). Update:

Old:
```js
            <div className="kk" style={{marginBottom:4}}>{form.type==="BES"?"Fon Kodu *":"Ticker *"}</div>
```
New:
```js
            <div className="kk" style={{marginBottom:4}}>
              {form.type==="BES"?"Fon Kodu *":
               form.type==="CASH"||form.type==="DEPOSIT"?"Hesap Etiketi *":"Ticker *"}
            </div>
```

Update placeholder for CASH/DEPOSIT:
```js
                placeholder={form.type==="BES"?"AGS, EAF...":
                             form.type==="CASH"?"ZIRAAT_TRY":
                             form.type==="DEPOSIT"?"AKBANK_VAD_1":"AAPL"}
```

Hide the refresh button for CASH/DEPOSIT (same as BES):
```js
              {form.type!=="BES"&&form.type!=="CASH"&&form.type!=="DEPOSIT"&&(
                <button ...>...</button>
              )}
```

Update shares label for CASH/DEPOSIT:
Find where "Adet" label is rendered and wrap:
```js
            <div className="kk" style={{marginBottom:4}}>
              {form.type==="CASH"||form.type==="DEPOSIT"?"Bakiye *":"Adet *"}
            </div>
```

Hide avgCost field for CASH/DEPOSIT. The avgCost field is in the grid alongside shares. Wrap it:
```js
            {form.type!=="CASH"&&form.type!=="DEPOSIT"&&(
              <div>
                <div className="kk" style={{marginBottom:4}}>Ort. Maliyet *</div>
                <input .../>
                {errs.avgCost&&<div className="err-txt">{errs.avgCost}</div>}
              </div>
            )}
```

After the broker/commission fields (find a suitable spot, e.g., after the currency/broker row), add DEPOSIT-specific fields:
```jsx
            {form.type==="DEPOSIT"&&(
              <>
                <div>
                  <div className="kk" style={{marginBottom:4}}>Faiz Oranı (%) *</div>
                  <input className="finp" type="number" min="0" step="0.1" value={form.interestRate}
                    onChange={e=>set({interestRate:e.target.value})}
                    placeholder="45"/>
                  {errs.interestRate&&<div style={{fontSize:11,color:"var(--err)",marginTop:3}}>{errs.interestRate}</div>}
                </div>
                <div>
                  <div className="kk" style={{marginBottom:4}}>Vade Tarihi *</div>
                  <input className="finp" type="date" value={form.maturityDate}
                    min={today()}
                    onChange={e=>set({maturityDate:e.target.value})}/>
                  {errs.maturityDate&&<div style={{fontSize:11,color:"var(--err)",marginTop:3}}>{errs.maturityDate}</div>}
                </div>
              </>
            )}
```

Update the "broker" field label for CASH/DEPOSIT:
```js
            <div className="kk" style={{marginBottom:4}}>
              {form.type==="CASH"||form.type==="DEPOSIT"?"Banka (isteğe bağlı)":"Aracı Kurum"}
            </div>
```

- [ ] **Step 7: Update type onChange handler to set correct currency default and also reset DEPOSIT fields**

Find where `type` changes in the form (likely in the type dropdown's `onChange`). Add:
```js
onChange={e=>{
  const t=e.target.value;
  const cur=(t==="BIST"||t==="BES"||t==="CASH"||t==="DEPOSIT")?"TRY":"USD";
  set({type:t,currency:cur,avgCost:"",ticker:"",name:"",interestRate:"",maturityDate:""});
  setCurPrice(null);setPriceNote(null);
}}
```

- [ ] **Step 8: Run babel check**

```bash
npm run check:babel
```
Expected: OK.

- [ ] **Step 9: Commit**

```bash
git add src/components/ManuelPosForm.js
git commit -m "feat(form): CASH and DEPOSIT mode — hesap etiketi, bakiye, faiz oranı, vade tarihi fields"
```

---

## Task 9: AnalysisTab — exclude CASH/DEPOSIT from concentration risk

**Files:**
- Modify: `src/components/AnalysisTab.js` (~line 1341–1398)

CASH and DEPOSIT are not equity/crypto positions — they don't add concentration risk. Exclude them from HHI and the top-3 weight calculation (same as ETFs are handled separately).

- [ ] **Step 1: Filter out CASH/DEPOSIT from concentration risk inputs (~line 1345)**

Old:
```js
          const posWithMv=filteredPos.map(p=>({...p,dispMv:mvDisp(p)})).filter(p=>p.dispMv>0);
```
New:
```js
          const posWithMv=filteredPos
            .filter(p=>p.type!=="CASH"&&p.type!=="DEPOSIT")
            .map(p=>({...p,dispMv:mvDisp(p)})).filter(p=>p.dispMv>0);
```

- [ ] **Step 2: Run babel check**

```bash
npm run check:babel
```
Expected: OK.

- [ ] **Step 3: Commit**

```bash
git add src/components/AnalysisTab.js
git commit -m "feat(analysis): exclude CASH/DEPOSIT from concentration risk HHI"
```

---

## Task 10: End-to-end verification

- [ ] **Step 1: Start local server**

```bash
npx serve .
```
Open `http://localhost:3000`.

- [ ] **Step 2: Add a CASH position**

Go to `+ Ekle` → "Nakit" → "Manuel" mode.
- Hesap Etiketi: `ZIRAAT_TRY`
- Bakiye: `50000`
- Currency: TRY
- Banka: `Ziraat Bankası`
- Date: today
- Save

Expected:
- Flash: "ZIRAAT_TRY işlem geçmişine ve pozisyona eklendi ✓"
- Dashboard → "Nakit" block appears with ₺50,000
- KPI "Piyasa Değeri" increases by ₺50,000 equivalent
- P&L% shows 0.0%
- Allocation pie shows a new "Nakit" slice

- [ ] **Step 3: Add a DEPOSIT position**

Go to `+ Ekle` → "Vadeli Mevduat" → "Manuel" mode.
- Hesap Etiketi: `AKBANK_VAD_1`
- Bakiye: `100000`
- Currency: TRY
- Faiz Oranı: `45` (%)
- Vade Tarihi: 6 months from today
- Banka: `Akbank`
- Date: today
- Save

Expected:
- Flash: "AKBANK_VAD_1 işlem geçmişine ve pozisyona eklendi ✓"
- Dashboard → "Vadeli Mevduat" block shows AKBANK_VAD_1 with `mv ≈ ₺100,000 + small accrual` (very small since date = today)
- P&L% ≈ 0.0% on day 1 (increases over time)

- [ ] **Step 4: Check after 90 days (manual date test)**

In the browser console, temporarily override `Date.now` to simulate 90 days later — OR simply set the transaction date to 90 days ago:
- Add another deposit with date = today - 90 days (set in the date picker)
- 45% annual rate × 90/360 = 11.25% expected P&L%

Expected: P&L% ≈ +11.25% on the simulated deposit.

- [ ] **Step 5: Verify fetchPrices doesn't include CASH/DEPOSIT**

In Settings → "Fiyat&Veri" → "Şimdi çek" (fetch prices).
Expected: Flash shows count that excludes CASH/DEPOSIT tickers. No edge function error for ZIRAAT_TRY.

- [ ] **Step 6: Verify AnalysisTab allocation pie**

Go to Analysis tab → Varlık Dağılımı.
Expected: "Nakit" and "Vadeli Mevduat" slices appear in the pie.
Expected: Konsantrasyon Riski section does NOT include ZIRAAT_TRY or AKBANK_VAD_1 in the top-3.

- [ ] **Step 7: Verify XIRR**

Go to Dashboard KPI → period = YTD (or 1Y to show XIRR).
Expected: XIRR is non-null and includes cash flows from CASH and DEPOSIT positions.

- [ ] **Step 8: Delete DEPOSIT and verify cleanup**

Delete AKBANK_VAD_1 from the position list.
Expected: Position removed, Dashboard "Vadeli Mevduat" block disappears (or shows only other deposits if any).

---

## Summary

| Task | File(s) | Scope |
|---|---|---|
| 1 — DB Migration | `supabase/migrations/016_cash_deposit.sql` | New columns + RPC update |
| 2 — Type constants | `src/constants.js`, `src/utils.js` | TL, TYPE_COLORS, ASSET_ICONS, BLOCK_TYPES |
| 3 — rebuildPositions | `src/utils.js` | Preserve/restore interest_rate/maturity_date |
| 4 — App loadData | `src/components/App.js` | setPos, synthetic price injection, priceCur |
| 5 — Price exclusions | `src/components/App.js` | fetchPrices/fetchHist guards |
| 6 — Block renderer | `src/components/App.js` | Mixed-currency block header + rows |
| 7 — AddTab | `src/components/AddTab.js` | New types, Manuel-only |
| 8 — ManuelPosForm | `src/components/ManuelPosForm.js` | CASH/DEPOSIT fields + save logic |
| 9 — AnalysisTab | `src/components/AnalysisTab.js` | HHI exclusion |
| 10 — E2E verify | Browser | Full golden path |
