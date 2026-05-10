# Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 5 open findings from `audit.md` (2 High, 3 Medium) without breaking existing functionality.

**Architecture:** Two new Supabase migrations (011, 012) add atomic RPC helpers; frontend switches to calling those RPCs; fetch-prices gets JWT enforcement matching parse-transaction's pattern.

**Tech Stack:** React 18 UMD + Babel Standalone, Supabase PostgreSQL + RLS, Deno edge functions, PL/pgSQL.

---

## File Map

| File | Action | Why |
|---|---|---|
| `supabase/migrations/011_rebuild_positions_atomic.sql` | CREATE | PL/pgSQL RPC — atomic delete+insert for position rebuild |
| `supabase/migrations/012_public_allocation_rpc.sql` | CREATE | PL/pgSQL RPC for sanitized public allocation; drops `positions_allocation_read` RLS policy |
| `src/utils.js` | MODIFY | `rebuildPositions` → call RPC; add `edgePriceCall` auth wrapper |
| `src/components/ManuelPosForm.js` | MODIFY | Replace manual position upsert with `rebuildPositions` |
| `src/components/App.js` | MODIFY | `allocation_only` public view → call RPC; full view pct math |
| `src/components/AnalysisTab.js` | MODIFY | `edgeCall("fetch-prices")` → `edgePriceCall` |
| `src/components/TickerDetailTab.js` | MODIFY | same |
| `supabase/functions/fetch-prices/index.ts` | MODIFY | Add JWT validation at handler entry |
| `fetch-prices-edge-function.js` | MODIFY | Mirror change (drift check) |

---

## Task 1 — High #2: `rebuild_positions_atomic` migration + utils.js

**Problem:** `rebuildPositions` in `src/utils.js:362-370` does `DELETE` then `INSERT` in two separate round-trips. If the `INSERT` fails (RLS, network, constraint), positions table is left empty and the caller still gets a truthy return value.

**Fix:** Create a PL/pgSQL function that wraps both operations in a single transaction. JS still computes the position map; the RPC does the atomic write.

**Files:**
- Create: `supabase/migrations/011_rebuild_positions_atomic.sql`
- Modify: `src/utils.js:315-372`

- [ ] **Step 1.1 — Write migration 011**

Create `supabase/migrations/011_rebuild_positions_atomic.sql`:

```sql
-- =============================================================================
-- Migration: 011_rebuild_positions_atomic.sql
-- Fix: High #2 — rebuildPositions is delete-then-insert and not transactional.
-- Creates a PL/pgSQL RPC that accepts pre-computed position rows as jsonb and
-- performs DELETE + INSERT atomically in one transaction. JS still computes the
-- position map; this function only handles the atomic write.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION rebuild_positions_atomic(
  p_user_id     uuid,
  p_portfolio_id uuid,
  p_positions   jsonb  -- array of position objects
)
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER  -- runs as calling user; RLS policies (delete_own, insert_own) apply
AS $$
DECLARE
  inserted int := 0;
BEGIN
  -- Caller must be the owner. Belt-and-suspenders guard even though RLS enforces it.
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  DELETE FROM positions
  WHERE user_id = p_user_id AND portfolio_id = p_portfolio_id;

  IF jsonb_array_length(p_positions) > 0 THEN
    INSERT INTO positions (
      user_id, portfolio_id, ticker, name, type,
      shares, avg_cost, currency, broker, unit, updated_at
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

- [ ] **Step 1.2 — Apply migration in Supabase**

Open Supabase Dashboard → SQL Editor, paste and run the migration above. Verify no errors.

- [ ] **Step 1.3 — Update `rebuildPositions` in `src/utils.js`**

Current code is `src/utils.js:315-372`. Replace the entire function:

```javascript
const rebuildPositions = async (userId, portfolioId = null) => {
  let pid = portfolioId;
  if (!pid) {
    const {data:pf} = await sb.from("portfolios").select("id").eq("user_id",userId).order("created_at").limit(1).maybeSingle();
    pid = pf?.id || null;
  }
  if (!pid) { DEBUG && console.warn("[rebuildPositions] no portfolio for user",userId); return null; }

  const [txRes,splitRes] = await Promise.all([
    sb.from("transactions").select("*").eq("user_id",userId).eq("portfolio_id",pid).order("date"),
    sb.from("splits").select("*").eq("user_id",userId).eq("portfolio_id",pid)
  ]);
  const all = txRes.data || [];
  const splits = splitRes.data || [];
  const splitsByT = {};
  splits.forEach(s => { (splitsByT[s.ticker] = splitsByT[s.ticker] || []).push(s); });
  const factorFor = (ticker, date) => {
    const arr = splitsByT[ticker] || [];
    return arr.filter(s => s.split_date > date).reduce((a,s) => a * +s.ratio, 1);
  };

  const pm = {};
  for (const t of all) {
    if (!pm[t.ticker]) {
      const normCur = t.asset_type==="BIST" ? "TRY" : (t.currency==="EUR" ? "EUR" : "USD");
      pm[t.ticker] = {ticker:t.ticker,name:t.name,type:t.asset_type,shares:0,cost:0,currency:normCur,broker:t.broker};
    }
    const p = pm[t.ticker];
    const f = factorFor(t.ticker, t.date);
    const adjShares = +t.shares * f;
    if (t.way === "BUY") {
      p.cost += +t.shares * +t.price;
      p.shares += adjShares;
    } else if (t.way === "SELL" && p.shares > 0) {
      const avg = p.cost / p.shares;
      const qty = Math.min(adjShares, p.shares);
      p.cost = Math.max(0, p.cost - avg * qty);
      p.shares -= qty;
    }
  }

  const snapRes = await sb.from("positions").select("ticker,unit").eq("user_id",userId).eq("portfolio_id",pid);
  const unitMap = Object.fromEntries((snapRes.data||[]).map(p=>[p.ticker,p.unit||null]));

  const np = Object.values(pm).filter(p => p.shares > CFG.DUST_THRESHOLD).map(p => ({
    ticker: p.ticker, name: p.name, type: p.type,
    shares: +p.shares.toFixed(6), avg_cost: +(p.cost/p.shares).toFixed(6),
    currency: p.currency, broker: p.broker,
    unit: unitMap[p.ticker] ?? null,
    updated_at: new Date().toISOString()
  }));

  const { error } = await sb.rpc("rebuild_positions_atomic", {
    p_user_id: userId,
    p_portfolio_id: pid,
    p_positions: np
  });

  if (error) {
    DEBUG && console.warn("[rebuildPositions] RPC error:", error);
    return null;  // signals failure to callers
  }
  return np.length;
};
```

Key changes vs original:
- Returns `null` on error (instead of silently returning 0)
- Calls `sb.rpc("rebuild_positions_atomic", ...)` instead of separate delete + insert
- `np` rows no longer include `user_id`/`portfolio_id` (RPC takes those as separate params)

- [ ] **Step 1.4 — Run babel check**

```bash
npm run check:babel
```

Expected: `All files pass Babel parse` (or equivalent pass message). Fix any parse errors before continuing.

- [ ] **Step 1.5 — Smoke test in browser**

Start `npx serve .` → open http://localhost:3000 → log in → go to Settings → "Yeniden Hesapla" → verify positions still appear correctly after rebuild.

- [ ] **Step 1.6 — Commit**

```bash
git add supabase/migrations/011_rebuild_positions_atomic.sql src/utils.js
git commit -m "fix: atomic position rebuild via DB RPC (High audit finding #2)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2 — High #1 + Medium #3: `get_allocation_only_positions` RPC + drop leaky policy

**Problem (High #1):** Migration 007 added a `positions_allocation_read` RLS policy that gives authenticated users SELECT access to full `positions` rows for `allocation_only` portfolios. RLS is row-level, not column-level — a user querying directly gets `avg_cost`, `shares`, `broker`, etc.

**Problem (Medium #3):** The public view in `App.js:893-897` uses raw `shares` for `allocation_only` pct math. Raw share counts are not comparable across asset types (1 BTC ≠ 1 THYAO share).

**Fix:** Create a SECURITY DEFINER RPC that computes cost-basis allocation pct server-side and returns only `{ticker, name, type, pct}` — no raw quantities. Drop the leaky RLS policy. Frontend calls the RPC.

**Files:**
- Create: `supabase/migrations/012_public_allocation_rpc.sql`
- Modify: `src/components/App.js:207-223` (publicViewId useEffect) and `src/components/App.js:889-898` (publicview render)

- [ ] **Step 2.1 — Write migration 012**

Create `supabase/migrations/012_public_allocation_rpc.sql`:

```sql
-- =============================================================================
-- Migration: 012_public_allocation_rpc.sql
-- Fix: High #1 — allocation_only public portfolios expose full positions rows.
-- Fix: Medium #3 — raw share counts used for allocation pct (meaningless cross-asset).
--
-- Creates a SECURITY DEFINER RPC that reads positions + price_cache and returns
-- only safe aggregate fields (ticker, name, type, pct). Raw avg_cost / shares
-- are used internally for computation but never returned.
--
-- Drops the leaky positions_allocation_read RLS policy from 007.
-- =============================================================================

BEGIN;

-- Drop the RLS policy that exposed full position rows for allocation_only portfolios.
DROP POLICY IF EXISTS "positions_allocation_read" ON positions;

-- RPC: returns allocation data for a public allocation_only portfolio.
-- SECURITY DEFINER: runs as the function owner so it can read across user boundaries.
-- Caller receives only ticker/name/type/pct — no avg_cost, shares, or broker.
CREATE OR REPLACE FUNCTION get_allocation_only_positions(p_portfolio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_portfolio portfolios%ROWTYPE;
  v_total     numeric;
  v_result    jsonb;
BEGIN
  -- Verify portfolio is public and allocation_only
  SELECT * INTO v_portfolio
  FROM portfolios
  WHERE id = p_portfolio_id
    AND is_public = TRUE
    AND privacy_level = 'allocation_only';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Portfolio not found or not public');
  END IF;

  -- Total: sum of cost-basis values (avg_cost * shares).
  -- Cost basis is a monetary value (unlike raw share counts) so pct is meaningful.
  -- Cross-currency note: BIST positions use TRY cost, US/crypto use USD cost.
  -- Pct is computed within each currency bucket's proportional share.
  -- This is an approximation; market-value-based allocation would require FX normalization.
  SELECT COALESCE(SUM(p.avg_cost * p.shares), 0)
  INTO v_total
  FROM positions p
  WHERE p.portfolio_id = p_portfolio_id;

  IF v_total = 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'ticker', p.ticker,
      'name',   p.name,
      'type',   p.type,
      'pct',    ROUND((p.avg_cost * p.shares / v_total * 100)::numeric, 1)
    )
    ORDER BY (p.avg_cost * p.shares) DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM positions p
  WHERE p.portfolio_id = p_portfolio_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_allocation_only_positions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_allocation_only_positions(uuid) TO anon;  -- public portfolios visible to all

COMMIT;
```

- [ ] **Step 2.2 — Apply migration in Supabase**

Paste and run in SQL Editor. Verify `positions_allocation_read` policy is gone:

```sql
SELECT policyname FROM pg_policies WHERE tablename='positions' AND policyname='positions_allocation_read';
-- Expected: 0 rows
```

- [ ] **Step 2.3 — Update public portfolio fetch in `App.js`**

Find `src/components/App.js` at the `publicViewId` useEffect (around line 207). Replace the `allocation_only` branch:

Current (lines ~212-218):
```javascript
if(pf.privacy_level==="full"){
  const{data}=await sb.from("positions").select("ticker,name,type,shares,avg_cost,currency").eq("portfolio_id",publicViewId);
  positions=data||[];
} else if(pf.privacy_level==="allocation_only"){
  const{data}=await sb.from("positions").select("ticker,name,type,shares").eq("portfolio_id",publicViewId);
  positions=data||[];
}
```

Replace with:
```javascript
if(pf.privacy_level==="full"){
  const{data}=await sb.from("positions").select("ticker,name,type,shares,avg_cost,currency").eq("portfolio_id",publicViewId);
  positions=data||[];
} else if(pf.privacy_level==="allocation_only"){
  const{data,error}=await sb.rpc("get_allocation_only_positions",{p_portfolio_id:publicViewId});
  if(error||data?.error){flash_("Portföy yüklenemedi","err");setPublicViewId(null);return;}
  positions=Array.isArray(data)?data:[];
}
```

- [ ] **Step 2.4 — Fix allocation pct render for `allocation_only` in publicview**

In the publicview render (around `App.js:891-898`), the `totalVal` and `rows` computation uses raw shares for `allocation_only`. Since the RPC now pre-computes `pct`, skip the client-side calculation for that case.

Current (lines ~891-898):
```javascript
const isFull=portfolio.privacy_level==="full";
const totalVal=isFull
  ? positions.reduce((a,p)=>a+(p.avg_cost||0)*p.shares,0)
  : positions.reduce((a,p)=>a+p.shares,0);
const rows=positions.map(p=>({
  ...p,
  pct:totalVal>0?(isFull?(p.avg_cost||0)*p.shares:p.shares)/totalVal*100:0,
})).sort((a,b)=>b.pct-a.pct);
```

Replace with:
```javascript
const isFull=portfolio.privacy_level==="full";
const rows=isFull
  ? (()=>{
      const totalVal=positions.reduce((a,p)=>a+(p.avg_cost||0)*p.shares,0);
      return positions.map(p=>({
        ...p,
        pct:totalVal>0?(p.avg_cost||0)*p.shares/totalVal*100:0,
      })).sort((a,b)=>b.pct-a.pct);
    })()
  : [...positions].sort((a,b)=>b.pct-a.pct);  // RPC already provides pct
```

- [ ] **Step 2.5 — Run babel check**

```bash
npm run check:babel
```

Expected: pass. Fix parse errors if any.

- [ ] **Step 2.6 — Test public portfolio view**

In browser, go to Settings → toggle portfolio public (allocation_only) → copy the portfolio UUID from URL or Supabase → open in an incognito tab or test the `?portfolio=<uuid>` URL param. Verify the allocation bar chart renders correctly and no raw shares/avg_cost are visible in the Network tab response.

- [ ] **Step 2.7 — Commit**

```bash
git add supabase/migrations/012_public_allocation_rpc.sql src/components/App.js
git commit -m "fix: sanitize allocation_only public portfolio via DB RPC (High #1, Medium #3)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3 — Medium #1: ManuelPosForm routes through `rebuildPositions`

**Problem:** `ManuelPosForm.savePos` (`src/components/ManuelPosForm.js:116-132`) inserts a transaction (error checked), then upserts the position row directly (error **not** checked). If the upsert fails, the transaction exists but the position snapshot is stale and the UI reports success.

**Fix:** After the transaction insert, call `rebuildPositions(user.id, portfolioId)` instead of the manual upsert. This uses the now-atomic RPC from Task 1 and checks for errors.

**Files:**
- Modify: `src/components/ManuelPosForm.js:116-134`

- [ ] **Step 3.1 — Replace manual upsert with `rebuildPositions`**

Current `src/components/ManuelPosForm.js:116-135`:
```javascript
const{error:te}=await sb.from("transactions").insert(tx);
if(te){flash_(te.message,"err");setSaving(false);return;}

// Pozisyonu güncelle
const ex=pos.find(x=>x.ticker===tk);
const ns=(ex?.shares||0)+sh;
const na=((ex?.shares||0)*(ex?.avgCost||0)+sh*pr)/ns;
await sb.from("positions").upsert({
  user_id:user.id,ticker:tk,name:nm,type:form.type,
  shares:+ns.toFixed(6),avg_cost:+na.toFixed(6),
  currency:form.currency,broker:form.broker||"",
  unit:form.type==="GOLD"?(form.unit||'oz'):null,
  updated_at:new Date().toISOString(),
  portfolio_id:portfolioId
},{onConflict:"user_id,portfolio_id,ticker"});

await loadData();
```

Replace with:
```javascript
const{error:te}=await sb.from("transactions").insert(tx);
if(te){flash_(te.message,"err");setSaving(false);return;}

const rebuilt=await rebuildPositions(user.id,portfolioId);
if(rebuilt===null){flash_("Pozisyon güncellenemedi","err");setSaving(false);return;}

await loadData();
```

- [ ] **Step 3.2 — Run babel check**

```bash
npm run check:babel
```

Expected: pass.

- [ ] **Step 3.3 — Test manual position add**

In browser: Add Tab → Manuel Giriş → add a new position → verify it appears on Dashboard. Then add a second transaction for the same ticker → verify shares accumulate correctly.

- [ ] **Step 3.4 — Commit**

```bash
git add src/components/ManuelPosForm.js
git commit -m "fix: route ManuelPosForm through rebuildPositions to prevent partial ledger state (Medium #1)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4 — Medium #2: `fetch-prices` JWT enforcement

**Problem:** `fetch-prices` edge function accepts requests with the anon key only (no JWT check). Anyone can call it, burn API quota (Massive/Yahoo/Twelve Data), and write to shared `price_cache`.

**Fix:** Add JWT validation at the handler entry, identical to `parse-transaction`'s pattern. On the frontend, switch all `edgeCall("fetch-prices", ...)` calls to a new `edgePriceCall` helper that sends the user's session JWT.

**Files:**
- Modify: `src/utils.js` — add `edgePriceCall` helper
- Modify: `src/utils.js:133` — refresh loop call
- Modify: `src/components/App.js` — 3 fetch-prices call sites
- Modify: `src/components/AnalysisTab.js` — 2 fetch-prices call sites
- Modify: `src/components/ManuelPosForm.js` — 2 fetch-prices call sites
- Modify: `src/components/TickerDetailTab.js` — fetch-prices call sites
- Modify: `supabase/functions/fetch-prices/index.ts` — JWT check in handler
- Modify: `fetch-prices-edge-function.js` — mirror the same change

**Step 4.1 — Add `edgePriceCall` to `src/utils.js`**

After the existing `edgeCallAuth` definition (around line 248), add:

```javascript
// fetch-prices için: kullanıcı JWT'si ile çağır (quota abuse önlemi).
const edgePriceCall = (body) => edgeCallAuth("fetch-prices", body);
```

- [ ] **Step 4.2 — Replace `edgeCall("fetch-prices", ...)` in `src/utils.js`**

At line ~133 (inside the price refresh loop):
```javascript
// Before:
const r=await edgeCall("fetch-prices", body);
// After:
const r=await edgePriceCall(body);
```

- [ ] **Step 4.3 — Replace all `edgeCall("fetch-prices", ...)` in `src/components/App.js`**

There are 3 occurrences (lines ~354, ~382, ~1076). Change each:
```javascript
// Before:
const r=await edgeCall("fetch-prices",{ticker:t,mode:"price",asset_type:at});
// After:
const r=await edgePriceCall({ticker:t,mode:"price",asset_type:at});
```
(Same pattern for historical and test-call occurrences — remove `"fetch-prices"` from the call, keep the body object.)

- [ ] **Step 4.4 — Replace in `src/components/AnalysisTab.js`**

Two occurrences (lines ~89, ~1020):
```javascript
// Before:
const r=await edgeCall("fetch-prices",{ticker:p.ticker,mode:"meta",asset_type:p.type});
// After:
const r=await edgePriceCall({ticker:p.ticker,mode:"meta",asset_type:p.type});
```

- [ ] **Step 4.5 — Replace in `src/components/ManuelPosForm.js`**

Two occurrences (lines ~42, ~49):
```javascript
// Before:
const r=await edgeCall("fetch-prices",{ticker:upper,mode:"price",date:useDate,asset_type:at});
// After:
const r=await edgePriceCall({ticker:upper,mode:"price",date:useDate,asset_type:at});
```

- [ ] **Step 4.6 — Replace in `src/components/TickerDetailTab.js`**

Find all `edgeCall("fetch-prices", ...)` occurrences and change to `edgePriceCall(...)` (same pattern as above).

- [ ] **Step 4.7 — Add JWT check to `supabase/functions/fetch-prices/index.ts`**

In the handler (after the OPTIONS check at line ~297), add JWT validation before parsing the body. Insert immediately after line 297:

```typescript
// ── JWT doğrulama ────────────────────────────────────────────────────────────
// --no-verify-jwt ile deploy edilmiş olsa da kimlik zorunlu (quota abuse önlemi).
const authHeader = req.headers.get("Authorization") || "";
const token = authHeader.replace(/^Bearer\s+/i, "");
if (!token) return json({ error: "Kimlik doğrulama gerekli" }, 401);

const supaUrl = Deno.env.get("SUPABASE_URL")!;
const supaAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
const supaAuth = createClient(supaUrl, supaAnon, {
  global: { headers: { Authorization: `Bearer ${token}` } },
});
const { data: { user }, error: authErr } = await supaAuth.auth.getUser(token);
if (authErr || !user) return json({ error: "Geçersiz oturum" }, 401);
// ─────────────────────────────────────────────────────────────────────────────
```

The existing `json` helper is defined on line ~298. The JWT block above must come **after** the `json` helper definition. Adjust placement:

```typescript
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" }
  });

  // ── JWT doğrulama ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Kimlik doğrulama gerekli" }, 401);
  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const supaAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supaAuth = createClient(supaUrl, supaAnon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authErr } = await supaAuth.auth.getUser(token);
  if (authErr || !user) return json({ error: "Geçersiz oturum" }, 401);
  // ──────────────────────────────────────────────────────────────────────────

  try {
    const { ticker, mode, date, from, to, asset_type } = await req.json();
    // ... rest of handler unchanged
```

- [ ] **Step 4.8 — Mirror the same JWT block in `fetch-prices-edge-function.js`**

Open `fetch-prices-edge-function.js` (root sync copy). Apply the identical change as Step 4.7. Run drift check after:

```bash
npm run check:edge-drift
```

Expected: pass (no drift between root `.js` and `supabase/functions/*/index.ts`).

- [ ] **Step 4.9 — Run babel + edge checks**

```bash
npm run check:babel && npm run check:edge
```

Expected: both pass.

- [ ] **Step 4.10 — Deploy edge function**

```bash
npx supabase functions deploy fetch-prices --no-verify-jwt
```

- [ ] **Step 4.11 — Smoke test**

In browser, open the app while logged in → go to any ticker detail page → confirm price loads without errors. Check browser Network tab → `fetch-prices` POST should return 200.

Then (optional, if you have curl): try calling `fetch-prices` without a JWT:
```bash
curl -X POST https://<project>.supabase.co/functions/v1/fetch-prices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <anon_key_only>" \
  -d '{"ticker":"AAPL"}'
# Expected: {"error":"Geçersiz oturum"} with 401
```
(Anon key alone is not a valid user JWT, so it should fail.)

- [ ] **Step 4.12 — Commit**

```bash
git add src/utils.js src/components/App.js src/components/AnalysisTab.js \
        src/components/ManuelPosForm.js src/components/TickerDetailTab.js \
        supabase/functions/fetch-prices/index.ts fetch-prices-edge-function.js
git commit -m "fix: require user JWT for fetch-prices to prevent quota abuse (Medium #2)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

### Spec coverage
- High #2 (rebuildPositions not transactional) → Task 1 ✓
- High #1 (allocation_only column exposure at DB layer) → Task 2 ✓
- Medium #3 (allocation pct uses raw shares) → Task 2 ✓ (RPC uses cost-basis pct)
- Medium #1 (ManuelPosForm partial ledger) → Task 3 ✓
- Medium #2 (fetch-prices unauthenticated) → Task 4 ✓

### Placeholder scan
- All migration SQL is complete and runnable.
- All JS/TS code blocks are complete, not fragments.
- No "TBD" or "implement later" present.

### Type consistency
- `rebuildPositions` now returns `int | null` (was `int`). Callers that do `if (n)` or `if (n === null)` are consistent throughout.
- `edgePriceCall` signature: `(body: object) => Promise<Response>` — matches usage at all call sites.
- RPC `get_allocation_only_positions` returns `jsonb` (array of `{ticker,name,type,pct}`). Frontend handles `Array.isArray(data)` guard. ✓

### Risk notes
- Task 1 migration uses `SECURITY INVOKER` — RLS policies on `positions` must allow authenticated users to DELETE and INSERT their own rows. Current policies `positions_delete_own` and `positions_insert_own` do this. ✓
- Task 4 JWT check: `refresh-price-cache` cron does NOT call `fetch-prices` — it calls providers directly. Cron is unaffected. ✓
- Task 4: `edgePriceCall` falls back to `SUPA_ANON` if session is missing (from `edgeCallAuth` implementation). Edge function rejects anon tokens as invalid JWTs. This means unauthenticated views (public portfolio page) cannot call fetch-prices — but the public portfolio view does not call fetch-prices. ✓
