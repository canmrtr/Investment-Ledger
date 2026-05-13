# TEFAS Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Turkish mutual fund (TEFAS) support as a new asset type with daily NAV price fetching, ~1000-fund catalog search, and full portfolio tracking.

**Architecture:** New `TEFAS` asset type (TRY-denominated, `#84CC16` lime) routes through a new `isTefas` branch in `fetch-prices`; primary source is `tefas.gov.tr` direct API with `fonbul.com`/`isyatirim.com.tr` as WAF fallback. A shared `tefas_funds` Supabase table (populated by `fetch-fundamentals mode:"tefas-catalog"`) powers SearchTab autocomplete alongside the existing `ticker_db`.

**Tech Stack:** Deno edge functions, Supabase PostgREST, React 18 UMD + Babel Standalone, `npm run check:babel` for JSX validation, Playwright e2e (`e2e/smoke.mjs`)

**Spec:** `docs/superpowers/specs/2026-05-13-tefas-integration-design.md`

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/styles/tokens.css` | Modify | Add `--category-tefas: #84CC16` |
| `src/constants.js` | Modify | Add TEFAS to `TL`, `TYPE_COLORS` |
| `src/utils.js` | Modify | Add TEFAS to `BLOCK_TYPES`, `ASSET_ICONS`; add `tefasFundCacheGet/Set` |
| `fetch-prices-edge-function.js` | Modify | Add `isTefas` routing branch (price + historical + meta modes) |
| `supabase/functions/fetch-prices/index.ts` | Modify | Keep in sync with root `.js` (copy) |
| `fetch-fundamentals-edge-function.js` | Modify | Add `mode:"tefas-catalog"` handler |
| `supabase/functions/fetch-fundamentals/index.ts` | Modify | Keep in sync with root `.js` (copy) |
| `src/components/AddTab.js` | Modify | Add TEFAS to `ADD_TYPES` picker |
| `src/components/SearchTab.js` | Modify | Fetch `tefas_funds`, unified search, TEFAS badge |
| `src/components/AnalysisTab.js` | Modify | Add TEFAS to `REGION_OF`; exclude from Portföy Sağlık |

**Migration file:** `supabase/migrations/20260513000000_tefas_funds.sql`

---

## Task 1: WAF Test

Before writing any code, verify whether the TEFAS endpoint is reachable from Supabase cloud IPs. This determines whether the primary or fallback is used.

**Files:** none (test only)

- [ ] **Step 1: Open Supabase Edge Function test tab**

  Go to Supabase Dashboard → Edge Functions → `fetch-prices` → Test tab.
  Send this JSON body and observe the response:

  ```json
  { "ticker": "AAK", "mode": "price", "asset_type": "TEFAS" }
  ```

  Expected at this point: error (TEFAS branch not yet implemented). This is just to confirm the test tab is accessible.

- [ ] **Step 2: Test TEFAS endpoint directly via curl**

  Run from your local terminal to simulate what the edge function would do:

  ```bash
  curl -s -X POST "https://www.tefas.gov.tr/api/DB/BindHistoryInfo" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -H "X-Requested-With: XMLHttpRequest" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
    -d "fonkod=AAK&bastarih=13.05.2026&bittarih=13.05.2026"
  ```

  **If response contains `"data"` array with `FIYAT` field → primary source works, proceed.**
  **If 403/empty/timeout → WAF is blocking, fallback source needed (see Task 3 note).**

- [ ] **Step 3: Note result in GOTCHAS.md**

  Append to `GOTCHAS.md`:

  ```
  ## TEFAS WAF status (2026-05-13)
  - Primary: https://www.tefas.gov.tr/api/DB/BindHistoryInfo
  - Tested: [PASS / BLOCKED]
  - Fallback if blocked: fonbul.com (same fund codes, check endpoint in Task 3)
  ```

---

## Task 2: SQL Migration — `tefas_funds` Table

**Files:**
- Create: `supabase/migrations/20260513000000_tefas_funds.sql`

- [ ] **Step 1: Write the migration**

  Create `supabase/migrations/20260513000000_tefas_funds.sql`:

  ```sql
  -- tefas_funds: shared TEFAS mutual fund catalog (code, name, category)
  -- Public read (anon + authenticated). All writes via fetch-fundamentals service_role.
  create table if not exists tefas_funds (
    code        text primary key,
    name        text not null,
    category    text,
    updated_at  timestamptz default now()
  );

  alter table tefas_funds enable row level security;

  -- Public read — this is a shared catalog with no user-specific data
  create policy "tefas_funds public read"
    on tefas_funds for select
    using (true);
  ```

- [ ] **Step 2: Apply migration via Supabase MCP**

  Use `mcp__supabase__apply_migration` with the SQL above.

- [ ] **Step 3: Verify table exists**

  Use `mcp__supabase__execute_sql`:
  ```sql
  select count(*) from tefas_funds;
  ```
  Expected: `count = 0` (empty, not yet populated).

- [ ] **Step 4: Commit**

  ```bash
  git add supabase/migrations/20260513000000_tefas_funds.sql
  git commit -m "feat(tefas): add tefas_funds catalog table with public-read RLS"
  ```

---

## Task 3: Frontend Constants — TYPE_COLORS, TL, BLOCK_TYPES, ASSET_ICONS

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/constants.js`
- Modify: `src/utils.js`

- [ ] **Step 1: Add color token to `src/styles/tokens.css`**

  After line `--category-fx: #10B981;` (line ~30), add:

  ```css
    --category-tefas:     #84CC16;  /* TEFAS yatırım fonları */
  ```

- [ ] **Step 2: Add TEFAS to `TL` and `TYPE_COLORS` in `src/constants.js`**

  In `src/constants.js`, line 23, update `TL`:
  ```js
  const TL = {US_STOCK:"Hisse",FUND:"ETF/Fon",CRYPTO:"Kripto",BIST:"BIST",GOLD:"Altın",FX:"Döviz",BES:"BES Fonu",TEFAS:"TEFAS Fonu",CASH:"Nakit",DEPOSIT:"Vadeli Mevduat"};
  ```

  In `TYPE_COLORS` (line 25-35), add after `BES` entry:
  ```js
  TEFAS:    "#84CC16",  // brand kit: --category-tefas
  ```

  Full updated `TYPE_COLORS`:
  ```js
  const TYPE_COLORS = {
    US_STOCK: "#8B5CF6",  // brand kit: --category-us-stock
    FUND:     "#3B82F6",  // brand kit: --category-etf
    CRYPTO:   "#06B6D4",  // brand kit: --category-crypto
    BIST:     "#F97316",  // brand kit: --category-bist
    GOLD:     "#C9A84C",  // brand kit: --category-gold
    FX:       "#10B981",  // brand kit: --category-fx
    BES:      "#EC4899",  // bireysel emeklilik
    TEFAS:    "#84CC16",  // brand kit: --category-tefas
    CASH:     "#64748B",  // slate — nakit
    DEPOSIT:  "#6366F1",  // indigo — vadeli mevduat
  };
  ```

- [ ] **Step 3: Add TEFAS to `BLOCK_TYPES` in `src/utils.js`**

  `BLOCK_TYPES` is at `src/utils.js:156`. After the `BES` entry (line 163), insert:
  ```js
  {type:"TEFAS",   label:"TEFAS Fonları", cur:"TRY", sym:"₺", badge:"bes",  icon:(s=14)=>ASSET_ICONS.TEFAS(s)},
  ```

  Note: reuses `badge:"bes"` CSS class (same pink-family badge style; both are TRY fund types).

- [ ] **Step 4: Add TEFAS icon to `ASSET_ICONS` in `src/utils.js`**

  `ASSET_ICONS` is at `src/utils.js:505`. After the `DEPOSIT` entry, add:
  ```js
  TEFAS:    (s=24)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 12h8M12 8v8"/></svg>,
  ```

- [ ] **Step 5: Add `tefas_funds` LS cache helpers to `src/utils.js`**

  After `tickerDbCacheSet` (around line 230), add:
  ```js
  const tefasFundCacheGet = () => {
    const c = LS.get("tefas_fund_db_v1", null);
    if (!c || !c.list || Date.now() - c.t > 24 * 3600 * 1000) return null;
    return c.list;
  };
  const tefasFundCacheSet = (list) => {
    LS.set("tefas_fund_db_v1", { list, t: Date.now() });
  };
  ```

- [ ] **Step 6: Run babel check**

  ```bash
  npm run check:babel
  ```
  Expected: all files PASS, no errors.

- [ ] **Step 7: Commit**

  ```bash
  git add src/styles/tokens.css src/constants.js src/utils.js
  git commit -m "feat(tefas): add TEFAS asset type — constants, colors, icon, cache helpers"
  ```

---

## Task 4: `fetch-prices` — TEFAS Routing Branch

**Files:**
- Modify: `fetch-prices-edge-function.js`
- Modify: `supabase/functions/fetch-prices/index.ts` (copy of root .js)

The TEFAS branch handles three modes: `price`, `historical`, `meta`.
The primary source is `tefas.gov.tr` direct API. If WAF blocks (Task 1 result), use `fonbul.com` fallback.

- [ ] **Step 1: Add TEFAS helper functions before the main handler**

  In `fetch-prices-edge-function.js`, after the Yahoo Finance helper block and before the Twelve Data block (~line 134), add:

  ```js
  // ── TEFAS (Turkish mutual fund NAV) ─────────────────────────────
  // Primary: tefas.gov.tr/api/DB/BindHistoryInfo (POST form-encoded)
  // Fallback: fonbul.com (same fund codes, no WAF)
  // Date format for TEFAS: DD.MM.YYYY
  const isoToTefas = (iso) => {
    if (!iso) return null;
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  };

  async function tefasPrice(fonkod, dateISO) {
    const tarih = isoToTefas(dateISO) || isoToTefas(yesterdayISO());
    // Try up to 5 previous days in case of holidays/weekends
    for (let offset = 0; offset < 5; offset++) {
      const d = new Date(Date.parse(dateISO || yesterdayISO()) - offset * 86400000);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const t = `${dd}.${mm}.${yyyy}`;
      try {
        const r = await fetch("https://www.tefas.gov.tr/api/DB/BindHistoryInfo", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          },
          body: `fonkod=${encodeURIComponent(fonkod)}&bastarih=${t}&bittarih=${t}`,
        });
        if (!r.ok) continue;
        const data = await r.json();
        const row = data?.data?.[0];
        if (row?.FIYAT) {
          return { price: parseFloat(row.FIYAT), date: `${yyyy}-${mm}-${dd}`, currency: "TRY" };
        }
      } catch (e) { /* try next day */ }
    }
    return { error: "TEFAS: fiyat bulunamadı (son 5 gün)" };
  }

  async function tefasHistorical(fonkod, fromISO, toISO) {
    try {
      const r = await fetch("https://www.tefas.gov.tr/api/DB/BindHistoryInfo", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        body: `fonkod=${encodeURIComponent(fonkod)}&bastarih=${isoToTefas(fromISO)}&bittarih=${isoToTefas(toISO)}`,
      });
      if (!r.ok) return { error: `TEFAS HTTP ${r.status}` };
      const data = await r.json();
      if (!Array.isArray(data?.data) || data.data.length === 0) {
        return { error: "TEFAS: tarihsel veri yok" };
      }
      // TEFAS returns newest-first; reverse for chart (oldest-first)
      const results = data.data.reverse().map(row => {
        const [dd, mm, yyyy] = row.TARIH.split(".");
        return { t: `${yyyy}-${mm}-${dd}`, c: parseFloat(row.FIYAT) };
      });
      return { results };
    } catch (e) {
      return { error: "TEFAS fetch hatası: " + (e?.message ?? e) };
    }
  }

  async function tefasMeta(fonkod) {
    // Returns fund name + category from tefas_funds table (populated by fetch-fundamentals)
    // This is called only on discovery (not-held) — held positions already have name from DB.
    try {
      const r = await fetch("https://www.tefas.gov.tr/api/DB/BindFundInfo", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        body: `fonkod=${encodeURIComponent(fonkod)}`,
      });
      if (!r.ok) return { error: `TEFAS meta HTTP ${r.status}` };
      const data = await r.json();
      const row = data?.data?.[0];
      if (!row) return { error: "TEFAS: fon bulunamadı" };
      return {
        name: row.FONUNVAN || fonkod,
        category: row.FONTUR || null,
        currency: "TRY",
        locale: "tr",
        primary_exchange: "TEFAS",
        type: "Mutual Fund",
      };
    } catch (e) {
      return { error: "TEFAS meta hatası: " + (e?.message ?? e) };
    }
  }
  ```

- [ ] **Step 2: Add `isTefas` routing in the main handler**

  In `fetch-prices-edge-function.js`, after line 343 (`const isBist = ...`), add:

  ```js
  const isTefas = asset_type === "TEFAS";
  ```

  After the `isGold` block (around line 383), add an early return for TEFAS before the provider key check:

  ```js
  // TEFAS: Turkish mutual fund NAV — tefas.gov.tr direct API
  if (isTefas) {
    let result = {};
    let source = "tefas";
    if (mode === "historical") {
      result = await tefasHistorical(ticker, fromDate, toDate);
    } else if (mode === "meta") {
      result = await tefasMeta(ticker);
    } else {
      result = await tefasPrice(ticker, date);
    }
    // Cache price result
    if ((mode === "price" || !mode) && result.price != null) {
      try {
        await supa.from("price_cache").upsert({
          ticker,
          price: result.price,
          currency: "TRY",
          source,
          updated_at: new Date().toISOString(),
        }, { onConflict: "ticker" });
      } catch (e) { console.error("[fetch-prices] TEFAS price_cache upsert failed:", e?.message ?? e); }
    }
    return json({ ticker, result, date: result.date || toDate, source });
  }
  ```

- [ ] **Step 3: Sync to `supabase/functions/fetch-prices/index.ts`**

  Copy the full contents of `fetch-prices-edge-function.js` to `supabase/functions/fetch-prices/index.ts`.

  Then run the drift check:
  ```bash
  npm run check:edge-drift
  ```
  Expected: no drift detected.

- [ ] **Step 4: Run edge function syntax check**

  ```bash
  npm run check:edge
  ```
  Expected: PASS

- [ ] **Step 5: Deploy fetch-prices**

  ```bash
  npx supabase functions deploy fetch-prices --no-verify-jwt
  ```

- [ ] **Step 6: Test via Supabase dashboard**

  Supabase Dashboard → Edge Functions → `fetch-prices` → Test tab.
  Send:
  ```json
  { "ticker": "AAK", "mode": "price", "asset_type": "TEFAS" }
  ```
  Expected response:
  ```json
  { "ticker": "AAK", "result": { "price": 1.234567, "date": "2026-05-12", "currency": "TRY" }, "source": "tefas" }
  ```
  If `result.error` contains "WAF" or HTTP 403: the fallback needs to be wired. Add a `fonbulPrice` helper using `https://api.fonbul.com/fund/history?code=AAK` (investigate endpoint from fonbul.com network tab) and call it when `tefasPrice` returns an error.

- [ ] **Step 7: Commit**

  ```bash
  git add fetch-prices-edge-function.js supabase/functions/fetch-prices/index.ts
  git commit -m "feat(tefas): add isTefas routing in fetch-prices — NAV price/hist/meta"
  ```

---

## Task 5: `fetch-fundamentals` — TEFAS Catalog Mode

**Files:**
- Modify: `fetch-fundamentals-edge-function.js`
- Modify: `supabase/functions/fetch-fundamentals/index.ts`

- [ ] **Step 1: Add `tefas-catalog` mode handler**

  In `fetch-fundamentals-edge-function.js`, after the `skipJwt` check block (around line 669), add:

  ```js
  // Mode: tefas-catalog — fetch all TEFAS funds from tefas.gov.tr and upsert into tefas_funds table.
  // Run once on deploy; re-triggerable from Settings → Fiyat & Veri.
  if (body.mode === "tefas-catalog") {
    let fetched = 0, failed = 0;
    try {
      const r = await fetch("https://www.tefas.gov.tr/api/DB/BindFundInfo", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        body: "",  // empty body = all funds
      });
      if (!r.ok) return json({ error: `TEFAS catalog HTTP ${r.status}` }, 502);
      const data = await r.json();
      if (!Array.isArray(data?.data)) return json({ error: "TEFAS: unexpected response format" }, 502);

      // Batch upsert in chunks of 100
      const rows = data.data.map(f => ({
        code:       (f.FONKODU || "").toUpperCase().trim(),
        name:       f.FONUNVAN || f.FONKODU || "",
        category:   f.FONTUR || null,
        updated_at: new Date().toISOString(),
      })).filter(f => f.code.length > 0);

      const CHUNK = 100;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error } = await supa.from("tefas_funds").upsert(chunk, { onConflict: "code" });
        if (error) { failed += chunk.length; console.error("[tefas-catalog] upsert error:", error.message); }
        else fetched += chunk.length;
      }
    } catch (e) {
      return json({ error: "TEFAS catalog hatası: " + (e?.message ?? e) }, 500);
    }
    return json({ fetched, failed, total: fetched + failed });
  }
  ```

  Also update `skipJwt` check to include `tefas-catalog`:
  ```js
  const skipJwt = body.mode === "sync-ticker-db" || body.mode === "refresh-fund-cache" || body.mode === "tefas-catalog";
  ```

- [ ] **Step 2: Sync to `supabase/functions/fetch-fundamentals/index.ts`**

  Copy the full contents of `fetch-fundamentals-edge-function.js` to `supabase/functions/fetch-fundamentals/index.ts`.

  Run drift check:
  ```bash
  npm run check:edge-drift
  ```
  Expected: no drift.

- [ ] **Step 3: Deploy fetch-fundamentals**

  ```bash
  npx supabase functions deploy fetch-fundamentals --no-verify-jwt
  ```

- [ ] **Step 4: Populate the catalog**

  From Supabase Dashboard → Edge Functions → `fetch-fundamentals` → Test tab:
  ```json
  { "mode": "tefas-catalog" }
  ```
  Expected response:
  ```json
  { "fetched": 950, "failed": 0, "total": 950 }
  ```
  Then verify:
  ```sql
  select count(*), min(code), max(code) from tefas_funds;
  ```
  Expected: `count > 900`.

- [ ] **Step 5: Commit**

  ```bash
  git add fetch-fundamentals-edge-function.js supabase/functions/fetch-fundamentals/index.ts
  git commit -m "feat(tefas): add tefas-catalog mode to fetch-fundamentals, populate tefas_funds"
  ```

---

## Task 6: `AddTab` — TEFAS Picker Entry

**Files:**
- Modify: `src/components/AddTab.js`

- [ ] **Step 1: Add TEFAS to `ADD_TYPES`**

  In `src/components/AddTab.js`, `ADD_TYPES` at line 5. Insert after the `BES` entry (line 12), before `CASH`:

  ```js
  {type:"TEFAS",    label:"TEFAS Fonu",  desc:"Yatırım fonu — AAK, MAC, YKB"},
  ```

  Full updated `ADD_TYPES`:
  ```js
  const ADD_TYPES = [
    {type:"US_STOCK", label:"US Hisse",      desc:"NYSE / NASDAQ — AAPL, TSLA"},
    {type:"BIST",     label:"BIST",           desc:"Borsa İstanbul — THYAO, ASELS"},
    {type:"FUND",     label:"ETF / Fon",      desc:"SPY, QQQ, VT"},
    {type:"CRYPTO",   label:"Kripto",         desc:"BTC, ETH"},
    {type:"GOLD",     label:"Altın",          desc:"Spot ons (XAUUSD)"},
    {type:"FX",       label:"Döviz",          desc:"USDTRY, EURUSD"},
    {type:"BES",      label:"BES Fonu",       desc:"Bireysel Emeklilik — AGS001, PEB011"},
    {type:"TEFAS",    label:"TEFAS Fonu",     desc:"Yatırım fonu — AAK, MAC, YKB"},
    {type:"CASH",     label:"Nakit",          desc:"Banka hesabı — TRY, USD, EUR"},
    {type:"DEPOSIT",  label:"Vadeli Mevduat", desc:"Faizli sabit vadeli hesap"},
  ];
  ```

- [ ] **Step 2: Run babel check**

  ```bash
  npm run check:babel
  ```
  Expected: PASS

- [ ] **Step 3: Smoke test Add flow visually**

  ```bash
  npx serve .
  ```
  Open `http://localhost:3000` → "+ Ekle" → confirm "TEFAS Fonu" card appears in the picker between BES and Nakit. Click it → confirm text/image/CSV/Manuel tabs all appear (not MANUEL_ONLY).

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/AddTab.js
  git commit -m "feat(tefas): add TEFAS Fonu to AddTab picker"
  ```

---

## Task 7: `SearchTab` — `tefas_funds` Integration

**Files:**
- Modify: `src/components/SearchTab.js`

- [ ] **Step 1: Add `tefasDb` state and fetch on load**

  In `SearchTab` function (after `useState` for `tickerDb`, around line 7-9), add:
  ```js
  const [tefasDb,setTefasDb]=useState(()=>tefasFundCacheGet());
  ```

  After the existing `ticker_db` `useEffect` (after line 44), add a new `useEffect`:
  ```js
  useEffect(()=>{
    if(tefasDb)return;
    sb.from("tefas_funds").select("code,name,category")
      .then(({data,error})=>{
        if(error||!data?.length)return;
        tefasFundCacheSet(data);
        setTefasDb(data);
      });
  },[]);
  ```

- [ ] **Step 2: Merge TEFAS into search results**

  After `allMatches` (line ~61-63), add TEFAS matches:
  ```js
  const tefasMatches=qTrim&&tefasDb?tefasDb.filter(({code,name})=>
    !portfolioSet.has(code)&&(code.startsWith(qUpper)||(name||"").toLowerCase().includes(qLower))
  ).slice(0,30).map(f=>({ticker:f.code,name:f.name,type:"TEFAS",exchange:"TEFAS",category:f.category})):[];
  ```

- [ ] **Step 3: Update `nameFor` and `typeFor` to include TEFAS**

  Update `nameFor` (line ~68):
  ```js
  const nameFor=(ticker)=>{
    const pm=portfolioMap.get(ticker);if(pm?.name)return pm.name;
    const td=tickerDb?.find(x=>x.ticker===ticker);if(td?.name)return td.name;
    return tefasDb?.find(x=>x.code===ticker)?.name||"";
  };
  const typeFor=(ticker)=>{
    const pm=portfolioMap.get(ticker);if(pm?.type)return pm.type;
    if(tefasDb?.find(x=>x.code===ticker))return "TEFAS";
    return tickerDb?.find(x=>x.ticker===ticker)?.exchange==="XIST"?"BIST":"US_STOCK";
  };
  ```

- [ ] **Step 4: Render TEFAS results in the search result list**

  Find the JSX where `allMatches` are rendered (look for `allMatches.map`). Add TEFAS results in the same area:
  ```jsx
  {tefasMatches.length>0&&(
    <>
      <div style={{padding:"6px 14px 2px",fontSize:10,color:"var(--text3)",fontWeight:500,letterSpacing:"0.08em"}}>TEFAS FONLARI</div>
      {tefasMatches.map(({ticker,name,category})=>(
        <Row key={ticker} ticker={ticker} name={name} type="TEFAS" exchange="TEFAS" held={false} category={category}/>
      ))}
    </>
  )}
  ```

- [ ] **Step 5: Add TEFAS badge to the `Row` component**

  In the `Row` component (line ~71), after the BIST badge check:
  ```jsx
  {at==="TEFAS"&&<span className="badge" style={{fontSize:9,background:"rgba(132,204,22,0.15)",color:"#84CC16"}}>TEFAS</span>}
  ```

- [ ] **Step 6: Update stats footer to include TEFAS count**

  Find the footer that shows US + BIST count (around line 126-127). Add:
  ```js
  const tefas = tefasDb?.length || 0;
  ```
  And include in the display: `${tefas} TEFAS fonu`

- [ ] **Step 7: Run babel check**

  ```bash
  npm run check:babel
  ```
  Expected: PASS

- [ ] **Step 8: Smoke test search**

  ```bash
  npx serve .
  ```
  Open `http://localhost:3000` → Ara tab → type "AAK" → confirm TEFAS result appears with lime badge. Type "ata portföy" → confirm name search works.

- [ ] **Step 9: Commit**

  ```bash
  git add src/components/SearchTab.js
  git commit -m "feat(tefas): add tefas_funds to SearchTab — unified search with TEFAS badge"
  ```

---

## Task 8: `AnalysisTab` — TEFAS Region + Exclude from Fundamentals

**Files:**
- Modify: `src/components/AnalysisTab.js`

- [ ] **Step 1: Add TEFAS to `REGION_OF`**

  `REGION_OF` is at `src/components/AnalysisTab.js:203`. Add `TEFAS:"tr"`:
  ```js
  const REGION_OF = {
    US_STOCK:"us", FUND:"us",
    BIST:"tr", TEFAS:"tr",
    CRYPTO:"crypto", GOLD:"emtia",
    FX:"fx",
  };
  ```

- [ ] **Step 2: Add TEFAS to `TYPE_LBL` (line ~107)**

  ```js
  const TYPE_LBL = { US_STOCK:'ABD', BIST:'BIST', FUND:'ETF', CRYPTO:'Kripto', GOLD:'Altın', FX:'Döviz', TEFAS:'TEFAS' };
  ```

- [ ] **Step 3: Exclude TEFAS from `priceCurOf` (already works — TRY not explicitly listed, but `BIST` check covers it)**

  Verify line 31:
  ```js
  const priceCurOf = p => p.type === 'BIST' ? 'TRY' : (p.currency === 'EUR' ? 'EUR' : 'USD');
  ```
  Update to also handle TEFAS:
  ```js
  const priceCurOf = p => (p.type === 'BIST' || p.type === 'TEFAS') ? 'TRY' : (p.currency === 'EUR' ? 'EUR' : 'USD');
  ```

- [ ] **Step 4: Exclude TEFAS from Portföy Sağlık (Fundamentals) filters**

  TEFAS should NOT appear in health/fundamentals sections. Verify these lines already exclude TEFAS by only including `US_STOCK` and `BIST`:
  - Line 289: `if(p.type!=="US_STOCK"&&p.type!=="BIST"&&p.type!=="FUND")return false;` — TEFAS already excluded ✓
  - Line 354: `if(p.type!=="US_STOCK"&&p.type!=="BIST")return;` — already excluded ✓
  - Line 446: `healthEligible.filter(p=>p.type==="US_STOCK"||p.type==="BIST")` — already excluded ✓

  No changes needed for fundamentals — TEFAS is already excluded by the existing `US_STOCK || BIST` filters.

- [ ] **Step 5: Run babel check**

  ```bash
  npm run check:babel
  ```
  Expected: PASS

- [ ] **Step 6: Smoke test analysis tab**

  With a TEFAS position in the portfolio: open Analiz tab → confirm TEFAS appears as a lime slice in Varlık Dağılımı. Open Bölge Dağılımı → confirm TEFAS is grouped under "Türkiye". Open Portföy Sağlık → confirm TEFAS positions do NOT appear.

- [ ] **Step 7: Commit**

  ```bash
  git add src/components/AnalysisTab.js
  git commit -m "feat(tefas): add TEFAS to REGION_OF (tr), TYPE_LBL, priceCurOf in AnalysisTab"
  ```

---

## Task 9: Settings — TEFAS Catalog Refresh Button

**Files:**
- Modify: `src/components/App.js`

- [ ] **Step 1: Add "TEFAS Katalogu Yenile" button in Settings → Fiyat & Veri section**

  In `src/components/App.js`, in the "Fiyat & Veri" settings section (around line 1212-1220), add after the existing "Tarihi Veri" button:

  ```jsx
  <button onClick={async()=>{
    try {
      flash_("TEFAS katalogu yükleniyor…","ok");
      const r = await edgeCallAuth("fetch-fundamentals",{mode:"tefas-catalog"});
      const d = await r.json();
      if(d.error) flash_("Katalog hatası: "+d.error,"err");
      else flash_(`TEFAS katalogu güncellendi: ${d.fetched} fon`,"ok");
    } catch(e){ flash_("Katalog hatası: "+e.message,"err"); }
  }}>TEFAS Katalogu Yenile</button>
  ```

- [ ] **Step 2: Run babel check**

  ```bash
  npm run check:babel
  ```
  Expected: PASS

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/App.js
  git commit -m "feat(tefas): add TEFAS catalog refresh button to Settings → Fiyat & Veri"
  ```

---

## Task 10: `refresh-price-cache` — Add TEFAS to Cron Refresh

**Files:**
- Modify: `refresh-price-cache-edge-function.js`
- Modify: `supabase/functions/refresh-price-cache/index.ts`

The cron job runs every 6h and refreshes stale prices. TEFAS must be in `REFRESHABLE_TYPES` or its NAV will never auto-refresh.

- [ ] **Step 1: Add TEFAS fetch helper before `fetchHistorical`**

  In `refresh-price-cache-edge-function.js`, after `normalizeTicker` (around line 106), add:

  ```js
  // TEFAS: fetch latest NAV from tefas.gov.tr — tries last 5 days for holidays.
  const fetchTefasPrice = async (fonkod) => {
    for (let offset = 0; offset < 5; offset++) {
      const d = new Date(Date.now() - offset * 86400000);
      const dd = String(d.getDate()).padStart(2,"0");
      const mm = String(d.getMonth()+1).padStart(2,"0");
      const yyyy = d.getFullYear();
      const t = `${dd}.${mm}.${yyyy}`;
      try {
        const r = await fetch("https://www.tefas.gov.tr/api/DB/BindHistoryInfo", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          },
          body: `fonkod=${encodeURIComponent(fonkod)}&bastarih=${t}&bittarih=${t}`,
        });
        if (!r.ok) continue;
        const data = await r.json();
        const row = data?.data?.[0];
        if (row?.FIYAT) return { price: parseFloat(row.FIYAT), currency: "TRY", source: "tefas" };
      } catch (_) { /* next day */ }
    }
    throw new Error("TEFAS: fiyat bulunamadı");
  };
  ```

- [ ] **Step 2: Add TEFAS to `REFRESHABLE_TYPES`**

  At line 155, update:
  ```js
  const REFRESHABLE_TYPES = ["US_STOCK", "FUND", "CRYPTO", "GOLD", "BIST", "TEFAS"];
  ```

- [ ] **Step 3: Add TEFAS case to `normalizeTicker`**

  In `normalizeTicker` (line 84-106), before `return ticker;`, add:
  ```js
  if (type === "TEFAS") return ticker;  // TEFAS codes are passed as-is (AAK, MAC…)
  ```

- [ ] **Step 4: Branch TEFAS in the main refresh loop**

  In the `for` loop (line ~191-204), replace:
  ```js
  const apiTicker = normalizeTicker(t, tickerTypes[t]);
  const data = await fetchHistorical(apiTicker, massiveKey);
  ```
  With:
  ```js
  const type = tickerTypes[t];
  let data;
  if (type === "TEFAS") {
    data = await fetchTefasPrice(t);
  } else {
    const apiTicker = normalizeTicker(t, type);
    data = await fetchHistorical(apiTicker, massiveKey);
  }
  ```

- [ ] **Step 5: Sync to `supabase/functions/refresh-price-cache/index.ts`**

  Copy the full contents of `refresh-price-cache-edge-function.js` to `supabase/functions/refresh-price-cache/index.ts`.

  Run drift check:
  ```bash
  npm run check:edge-drift
  ```
  Expected: no drift.

- [ ] **Step 6: Deploy refresh-price-cache**

  ```bash
  npx supabase functions deploy refresh-price-cache --no-verify-jwt
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add refresh-price-cache-edge-function.js supabase/functions/refresh-price-cache/index.ts
  git commit -m "feat(tefas): add TEFAS to refresh-price-cache cron — auto-refresh NAV every 6h"
  ```

---

## Task 12: End-to-End Verification

- [ ] **Step 1: Full babel check**

  ```bash
  npm run check:babel && npm run check:edge
  ```
  Expected: all PASS

- [ ] **Step 2: Add a test TEFAS position manually**

  `http://localhost:3000` → "+ Ekle" → "TEFAS Fonu" → Manuel → enter code `AAK`, name `ATA PORTFÖY ÇOKLU VARLIK`, shares `100`, price `1.5` → Kaydet.

- [ ] **Step 3: Verify Dashboard block**

  Confirm "TEFAS Fonları" block appears on Dashboard with the position, values in ₺, lime color.

- [ ] **Step 4: Verify price fetch**

  Settings → "Fiyat Yenile" → confirm AAK price updates from TEFAS API (check source in price_cache: `select ticker, price, source, currency from price_cache where ticker='AAK'`).

- [ ] **Step 5: Verify search**

  Ara tab → type "mac" → confirm TEFAS fund results appear with lime badge.

- [ ] **Step 6: Verify AnalysisTab**

  Analiz → Varlık Dağılımı → lime slice for TEFAS. Bölge → TEFAS under Türkiye. Portföy Sağlık → AAK not listed.

- [ ] **Step 7: Run e2e smoke test**

  ```bash
  IL_EMAIL=canmerter@me.com IL_PASS=123456 node e2e/smoke.mjs
  ```
  Expected: all checks pass.

- [ ] **Step 8: Final commit**

  ```bash
  git add -A
  git commit -m "feat(tefas): complete TEFAS integration — NAV price, fund catalog, search, dashboard"
  ```
