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

## Task 1: WAF Test ✅ COMPLETED (2026-05-19)

**Result: Endpoint reachable, no WAF block.** Legacy `/api/DB/BindHistoryInfo`
(form-encoded) was retired in 2026 (`tefas-crawler` lib changelog). New
JSON endpoints are live:

- **Price (per-fund, periyod-based):** `POST https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir`
- **Listing (kind-filtered):** `POST https://www.tefas.gov.tr/api/funds/fonGetiriBazliBilgiGetir`

Headers required:

```
Content-Type: application/json
Accept: application/json, text/plain, */*
User-Agent: Mozilla/5.0 ... (any browser UA)
```

Smoke test (2026-05-19 local IP):

```bash
curl -s -X POST "https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/plain, */*" \
  -H "User-Agent: Mozilla/5.0" \
  -d '{"fonKodu":"YAC","periyod":1}'
```

Response shape:

```json
{
  "errorCode": null,
  "errorMessage": null,
  "resultList": [
    {
      "fonKodu": "YAC",
      "fonUnvan": "YAPI KREDİ PORTFÖY İKİNCİ FON SEPETİ FONU",
      "kategoriDerece": 59,
      "kategoriFonSay": 98,
      "tarih": "2026-04-20",
      "fiyat": 13.92976
    },
    ...
  ]
}
```

`periyod` = months back (1 = last month, 12 = last 12 months). NAV in `fiyat`,
date in `tarih` (`YYYY-MM-DD`). `market_cap`, `number_of_shares`,
`number_of_investors` and asset-allocation breakdown columns are **no longer
exposed** by the new API.

**Implication for downstream tasks:**
- Task 3 (edge fn routing) uses the new endpoint directly; `fonbul.com` fallback
  is no longer the primary contingency — keep as defensive fallback for hard
  outages.
- Task 4 (catalog sync) needs to enumerate `kind` ∈ {YAT, EMK, BYF} via the
  listing endpoint, then iterate per-fund for category metadata.
- Add `User-Agent` to every request; bare/missing UA may be filtered.

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

  > **Pre-flight 2026-05-25 correction**: Original code targeted retired legacy `/api/DB/BindHistoryInfo` + `/api/DB/BindFundInfo` (HTTP 404 — confirmed retired 2026). New JSON API `/api/funds/fonFiyatBilgiGetir` + catalog endpoint `/api/funds/fonGetir` (Task 5) replace them. Field names are camelCase (`fonKodu`, `fonUnvan`, `fiyat`, `tarih`), not uppercase. Response wrapper is `{errorCode, errorMessage, resultList}` — list is newest-LAST. Per-fund endpoint takes `periyod` (months back: 1/3/6/12), not a date range.

  ```js
  // ── TEFAS (Turkish mutual fund NAV) ─────────────────────────────
  // Endpoint: POST https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir
  // Payload : { "fonKodu": "<code>", "periyod": <1|3|6|12> }  // months back
  // Response: { resultList: [{ tarih:"YYYY-MM-DD", fiyat:<num>, fonUnvan:"...", ... }, ...] }
  //           — newest-LAST (oldest-first); ~14-22 trading days for periyod=1.
  //           — errorCode/errorMessage non-null → fund not found or other API err.
  // Legacy /api/DB/BindHistoryInfo + BindFundInfo retired 2026-04; this is the replacement.
  const TEFAS_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  };

  async function tefasFetchSeries(fonKodu, periyod = 1) {
    try {
      const r = await fetch("https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir", {
        method: "POST",
        headers: TEFAS_HEADERS,
        body: JSON.stringify({ fonKodu, periyod }),
      });
      if (!r.ok) return { error: `TEFAS HTTP ${r.status}` };
      const data = await r.json();
      if (data?.errorCode) return { error: `TEFAS: ${data.errorMessage || data.errorCode}` };
      return { list: data?.resultList || [] };
    } catch (e) {
      return { error: "TEFAS fetch hatası: " + (e?.message ?? e) };
    }
  }

  async function tefasPrice(fonKodu) {
    // Latest NAV — periyod=1 returns ~14-22 daily NAVs over last month (trading days).
    // Take the most recent (last element); no holiday loop needed — API already skips them.
    const r = await tefasFetchSeries(fonKodu, 1);
    if (r.error) return r;
    if (!r.list.length) return { error: "TEFAS: fiyat bulunamadı" };
    const last = r.list[r.list.length - 1];
    return { price: parseFloat(last.fiyat), date: last.tarih, name: last.fonUnvan };
  }

  async function tefasHistorical(fonKodu, fromISO, toISO) {
    // periyod = months back; pick smallest periyod that covers fromISO.
    const monthsBack = Math.max(1, Math.ceil((Date.now() - Date.parse(fromISO)) / (30 * 86400000)));
    const periyod = monthsBack <= 1 ? 1 : monthsBack <= 3 ? 3 : monthsBack <= 6 ? 6 : 12;
    const r = await tefasFetchSeries(fonKodu, periyod);
    if (r.error) return r;
    const results = (r.list || [])
      .filter(row => row.tarih >= fromISO && row.tarih <= toISO)
      .map(row => ({ t: row.tarih, c: parseFloat(row.fiyat) }));
    if (!results.length) return { error: "TEFAS: tarihsel veri yok" };
    return { results };
  }

  async function tefasMeta(fonKodu, supa) {
    // Prefer tefas_funds catalog (populated by fetch-fundamentals tefas-catalog mode).
    // Fallback: per-fund price endpoint includes fonUnvan in each row.
    try {
      const { data } = await supa.from("tefas_funds")
        .select("name, category").eq("code", fonKodu).maybeSingle();
      if (data) {
        return { name: data.name, category: data.category, currency: "TRY",
                 locale: "tr", primary_exchange: "TEFAS", type: "Mutual Fund" };
      }
    } catch (_) { /* fall through to API */ }
    const r = await tefasFetchSeries(fonKodu, 1);
    if (r.error) return r;
    if (!r.list.length) return { error: "TEFAS: fon bulunamadı" };
    return { name: r.list[0].fonUnvan || fonKodu, category: null, currency: "TRY",
             locale: "tr", primary_exchange: "TEFAS", type: "Mutual Fund" };
  }
  ```

- [ ] **Step 2: Add `isTefas` routing in the main handler**

  In `fetch-prices-edge-function.js`, after line 343 (`const isBist = ...`), add:

  ```js
  const isTefas = asset_type === "TEFAS";
  ```

  After the `isGold` block (around line 383), add an early return for TEFAS before the provider key check:

  > **Pre-flight 2026-05-25 correction**: `price_cache` schema confirmed via Supabase MCP — columns are `{ticker, updated_at, price, d1/w1/m1/y1, p_d1…p_y1, h_52w, l_52w}`. **No `source` and no `currency` columns.** Existing `fetch-prices` upsert at line 207 of `refresh-price-cache-edge-function.js` only writes `{ticker, price, updated_at}` — TEFAS branch must match. Currency is implied by `positions.currency='TRY'` at read time.

  ```js
  // TEFAS: Turkish mutual fund NAV — tefas.gov.tr direct API
  if (isTefas) {
    let result = {};
    if (mode === "historical") {
      result = await tefasHistorical(ticker, fromDate, toDate);
    } else if (mode === "meta") {
      result = await tefasMeta(ticker, supa);
    } else {
      result = await tefasPrice(ticker);
    }
    // Cache price result. price_cache has no `source` or `currency` columns —
    // only persist {ticker, price, updated_at} per existing schema.
    if ((mode === "price" || !mode) && result.price != null) {
      try {
        await supa.from("price_cache").upsert({
          ticker,
          price: result.price,
          updated_at: new Date().toISOString(),
        }, { onConflict: "ticker" });
      } catch (e) { console.error("[fetch-prices] TEFAS price_cache upsert failed:", e?.message ?? e); }
    }
    return json({ ticker, result, date: result.date || toDate, source: "tefas" });
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
  { "ticker": "YAC", "mode": "price", "asset_type": "TEFAS" }
  ```
  Expected response:
  ```json
  { "ticker": "YAC", "result": { "price": 1.234567, "date": "2026-05-12", "currency": "TRY" }, "source": "tefas" }
  ```
  If `result.error` contains "WAF" or HTTP 403: the fallback needs to be wired. Add a `fonbulPrice` helper using `https://api.fonbul.com/fund/history?code=YAC` (investigate endpoint from fonbul.com network tab) and call it when `tefasPrice` returns an error.

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

  > **Pre-flight 2026-05-25 correction**: Catalog endpoint is `/api/funds/fonGetir` (JSON POST), NOT the retired `/api/DB/BindFundInfo` (HTTP 404). Note: `fonGetiriBazliBilgiGetir` (referenced in Task 1's discovery note) returns null `resultList` regardless of payload — it's the wrong endpoint for full catalog enumeration. `fonGetir` ignores its payload body and always returns the full catalog. **Catalog size: 3510 funds** (verified 2026-05-25 — 3.5× the spec's "~1000" estimate). Field names are camelCase; category lives in `fonTurAciklama`. Batch size raised 100→500 to keep total roundtrips manageable at this size (~7 batches instead of 36).

  ```js
  // Mode: tefas-catalog — fetch ALL TEFAS funds (~3500) from tefas.gov.tr and
  // upsert into tefas_funds table. Endpoint /api/funds/fonGetir; payload body
  // is ignored — always returns full catalog. Run once on deploy; re-triggerable
  // from Settings → Fiyat & Veri.
  if (body.mode === "tefas-catalog") {
    let fetched = 0, failed = 0;
    try {
      const r = await fetch("https://www.tefas.gov.tr/api/funds/fonGetir", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/plain, */*",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({}),
      });
      if (!r.ok) return json({ error: `TEFAS catalog HTTP ${r.status}` }, 502);
      const data = await r.json();
      if (data?.errorCode) return json({ error: `TEFAS: ${data.errorMessage || data.errorCode}` }, 502);
      const list = data?.resultList;
      if (!Array.isArray(list)) return json({ error: "TEFAS: unexpected response format" }, 502);

      const rows = list.map(f => ({
        code:       (f.fonKodu || "").toUpperCase().trim(),
        name:       f.fonUnvan || f.fonKodu || "",
        category:   f.fonTurAciklama || null,
        updated_at: new Date().toISOString(),
      })).filter(f => f.code.length > 0);

      // ~3500 funds at chunk=500 → ~7 sequential upserts; PostgREST default
      // payload limit (~1MB) is well above 500 small rows.
      const CHUNK = 500;
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
  { "fetched": 3510, "failed": 0, "total": 3510 }
  ```
  (Actual count verified 2026-05-25; will drift slightly as new funds list and others retire.)

  Then verify:
  ```sql
  select count(*), min(code), max(code) from tefas_funds;
  ```
  Expected: `count > 3000`.

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
  {type:"TEFAS",    label:"TEFAS Fonu",  desc:"Yatırım fonu — YAC, MAC, GAH"},
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
    {type:"TEFAS",    label:"TEFAS Fonu",     desc:"Yatırım fonu — YAC, MAC, GAH"},
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
  Open `http://localhost:3000` → Ara tab → type "YAC" → confirm TEFAS result appears with lime badge. Type "ata portföy" → confirm name search works.

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

  > **Pre-flight 2026-05-25 correction**: Same endpoint + payload + field migration as Task 4. Return shape: the existing refresh-price-cache main loop (line 207) does `upsert({ ticker: t, ...data, updated_at: ... })` — so `data` must contain only `price_cache` columns. **Drop `currency` and `source`** from the return (no such columns). Holiday loop is unnecessary too: `fonFiyatBilgiGetir` with `periyod=1` returns ~14-22 trading days and we just take the last one.

  ```js
  // TEFAS: fetch latest NAV from tefas.gov.tr — /api/funds/fonFiyatBilgiGetir.
  // Returns only fields that exist in price_cache schema (no source/currency cols).
  const fetchTefasPrice = async (fonKodu) => {
    const r = await fetch("https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({ fonKodu, periyod: 1 }),
    });
    if (!r.ok) throw new Error(`TEFAS HTTP ${r.status}`);
    const data = await r.json();
    if (data?.errorCode) throw new Error(`TEFAS: ${data.errorMessage || data.errorCode}`);
    const list = data?.resultList || [];
    if (!list.length) throw new Error("TEFAS: fiyat bulunamadı");
    const last = list[list.length - 1];
    return { price: parseFloat(last.fiyat) };
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
  if (type === "TEFAS") return ticker;  // TEFAS codes are passed as-is (YAC, MAC…)
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

  `http://localhost:3000` → "+ Ekle" → "TEFAS Fonu" → Manuel → enter code `YAC`, name `YAPI KREDİ PORTFÖY İKİNCİ FON SEPETİ FONU`, shares `100`, price `14.00` → Kaydet.

- [ ] **Step 3: Verify Dashboard block**

  Confirm "TEFAS Fonları" block appears on Dashboard with the position, values in ₺, lime color.

- [ ] **Step 4: Verify price fetch**

  Settings → "Fiyat Yenile" → confirm YAC price updates from TEFAS API (check source in price_cache: `select ticker, price, source, currency from price_cache where ticker='YAC'`).

- [ ] **Step 5: Verify search**

  Ara tab → type "mac" → confirm TEFAS fund results appear with lime badge.

- [ ] **Step 6: Verify AnalysisTab**

  Analiz → Varlık Dağılımı → lime slice for TEFAS. Bölge → TEFAS under Türkiye. Portföy Sağlık → YAC not listed.

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
