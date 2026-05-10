# Fund Cache Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fundamental verilerini (P/E, ROE, margins vb.) Supabase `fund_cache` tablosunda merkezi olarak sakla; pg_cron ile haftalık otomatik yenile; frontend her açılışta tablodan okusun.

**Architecture:** `fetch-fundamentals` edge fn başarılı her fetch'ten sonra `fund_cache` tablosuna upsert yapar (service_role). Yeni `mode:"refresh-fund-cache"` modu tablodaki stale ticker'ları toplu yeniler. pg_cron her Pazar 03:00 UTC bu modu tetikler. Frontend AnalysisTab mount'ta Supabase'den okur, bulguları localStorage'a yazar (offline/speed).

**Tech Stack:** Supabase PostgreSQL + RLS, Deno edge functions (Supabase), pg_cron + pg_net, React 18 UMD (frontend), `@supabase/supabase-js@2`

---

## Files

| Dosya | İşlem |
|---|---|
| `supabase/migrations/009_fund_cache.sql` | CREATE TABLE + RLS |
| `supabase/migrations/010_fund_cache_cron.sql` | pg_cron haftalık job |
| `supabase/functions/fetch-fundamentals/index.ts` | upsert to fund_cache + mode:refresh |
| `fetch-fundamentals-edge-function.js` | root copy sync (drift check) |
| `src/components/AnalysisTab.js` | mount'ta Supabase'den oku |

---

## Task 1: `fund_cache` tablosunu oluştur

**Files:**
- Create: `supabase/migrations/009_fund_cache.sql`

- [ ] **Step 1: Migration dosyasını yaz**

```sql
-- 009_fund_cache.sql
-- Merkezi fundamental veri cache'i (price_cache ile aynı pattern).
-- Write: sadece service_role (fetch-fundamentals edge fn).
-- Read: anon + authenticated (frontend doğrudan okur).

create table if not exists fund_cache (
  ticker      text primary key,
  asset_type  text not null default 'US_STOCK',
  metrics     jsonb,
  annual      jsonb,
  grades      jsonb,
  source      text,          -- 'fmp' | 'edgar' | 'isyatirim'
  updated_at  timestamptz not null default now()
);

comment on table fund_cache is 'Shared fundamental data cache. Written by fetch-fundamentals edge fn (service_role), read by frontend (anon).';

alter table fund_cache enable row level security;

-- Herkes okuyabilir (price_cache ile aynı)
create policy "fund_cache public read"
  on fund_cache for select
  to anon, authenticated
  using (true);

-- Write: service_role only (policy yok = service_role bypass eder)
```

- [ ] **Step 2: Supabase MCP ile migration uygula**

```
mcp__supabase__apply_migration ile 009_fund_cache.sql içeriğini uygula.
```

Beklenen: tablo oluştu, RLS aktif, `fund_cache public read` policy var.

- [ ] **Step 3: rls-auditor agent ile doğrula**

`rls-auditor` agent çağır: "fund_cache tablosunun RLS policy'si doğru mu? Public read, service_role only write."

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/009_fund_cache.sql
git commit -m "feat: add fund_cache table with public read RLS"
```

---

## Task 2: pg_cron haftalık job

**Files:**
- Create: `supabase/migrations/010_fund_cache_cron.sql`

- [ ] **Step 1: Cron migration yaz**

Existing pattern: `005_ticker_db.sql:30-44` (sync-ticker-db-weekly) ile aynı yapı.
CRON_SECRET vault'ta mevcut (sync-ticker-db zaten kullanıyor).

```sql
-- 010_fund_cache_cron.sql
-- pg_cron: Her Pazar 03:30 UTC (sync-ticker-db ile çakışmasın diye 30dk sonra)
SELECT cron.schedule(
  'refresh-fund-cache-weekly',
  '30 3 * * 0',
  $$
  SELECT net.http_post(
    url      := (SELECT value FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL')
                 || '/functions/v1/fetch-fundamentals',
    headers  := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body     := '{"mode":"refresh-fund-cache"}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id
  $$
);
```

- [ ] **Step 2: Supabase MCP ile uygula**

```
mcp__supabase__apply_migration ile 010_fund_cache_cron.sql uygula.
```

Beklenen: `cron.job` tablosunda `refresh-fund-cache-weekly` görünüyor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/010_fund_cache_cron.sql
git commit -m "feat: add weekly pg_cron job for fund_cache refresh"
```

---

## Task 3: `fetch-fundamentals` edge fn güncelle

**Files:**
- Modify: `supabase/functions/fetch-fundamentals/index.ts`
- Modify: `fetch-fundamentals-edge-function.js` (root sync copy)

**İki değişiklik:**
1. Normal ticker fetch'ten sonra `fund_cache`'e upsert ekle
2. `mode:"refresh-fund-cache"` modu ekle

- [ ] **Step 1: Supabase client init helper ekle**

`index.ts` dosyasına `Deno.serve(...)` bloğunun hemen BAŞINA (corsHeaders'tan sonra, cagr fonksiyonundan önce) şu helper'ı ekle:

```typescript
// Service role client — fund_cache write için. Sadece SUPABASE_URL + SERVICE_ROLE_KEY
// inject edilmişse oluşturulur (cron/manual modlarda kullanılır).
const getServiceClient = () => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
};

// fund_cache'e ticker verisini upsert et. Fire-and-forget: hata sessiz pas.
const upsertFundCache = async (
  ticker: string,
  asset_type: string,
  metrics: Record<string, unknown> | null,
  annual: unknown[] | null,
  grades: unknown[] | null,
  source: string,
) => {
  try {
    const supa = getServiceClient();
    if (!supa) return;
    await supa.from("fund_cache").upsert({
      ticker,
      asset_type,
      metrics,
      annual,
      grades,
      source,
      updated_at: new Date().toISOString(),
    }, { onConflict: "ticker" });
  } catch (e) {
    console.warn("[fund_cache upsert]", ticker, e);
  }
};
```

- [ ] **Step 2: BIST başarılı fetch'ten sonra upsert ekle**

`index.ts` içinde BIST return bloğunu bul (satır ~700-710). `return json({...})` öncesine upsert ekle:

```typescript
// BIST başarılı fetch — fund_cache'e yaz
if (asset_type === "BIST") {
  const bist = await fetchBist(ticker);
  if (bist.error) return json({ error: bist.error }, 422);
  // upsert ekle — await: fire-and-forget (failure frontend'i etkilemesin)
  upsertFundCache(ticker, "BIST", bist.metrics ?? null, bist.raw?.annual ?? null, null, "isyatirim");
  return json({
    ticker,
    fetched_at: new Date().toISOString(),
    source: "isyatirim",
    metrics: bist.metrics,
    raw: bist.raw,
  });
}
```

- [ ] **Step 3: FMP başarılı fetch'ten sonra upsert ekle**

FMP return bloğu (~satır 717-727):

```typescript
if (fmp.ok) {
  // upsert fund_cache
  upsertFundCache(ticker, asset_type || "US_STOCK", fmp.metrics ?? null, fmp.annual ?? null, fmp.grades ?? null, "fmp");
  return json({
    ticker,
    fetched_at: new Date().toISOString(),
    source: "fmp",
    metrics: fmp.metrics,
    grades: fmp.grades,
    annual: fmp.annual,
    raw: fmp.raw,
  });
}
```

- [ ] **Step 4: EDGAR fallback'ten sonra upsert ekle**

EDGAR return bloğu (~satır 733-739):

```typescript
if (!edgar.error) {
  upsertFundCache(ticker, asset_type || "US_STOCK", edgar.metrics ?? null, null, null, "edgar");
  return json({
    ticker,
    fetched_at: new Date().toISOString(),
    source: "edgar",
    metrics: edgar.metrics,
    raw: edgar.raw,
  });
}
```

- [ ] **Step 5: `mode:"refresh-fund-cache"` ekle**

`mode:"dividend-calendar"` bloğunun HEMEN SONRASINA (ticker/asset_type parse'tan önce) ekle:

```typescript
// Mode: refresh-fund-cache — fund_cache tablosundaki stale ticker'ları yenile.
// pg_cron (haftalık) CRON_SECRET ile çağırır. Her run max 60 ticker, 800ms aralık.
if (body.mode === "refresh-fund-cache") {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || cronSecret.length < 16) return json({ error: "CRON_SECRET not configured" }, 500);
  const auth = req.headers.get("Authorization") || "";
  const expected = `Bearer ${cronSecret}`;
  const enc = new TextEncoder();
  const ab = enc.encode(auth), eb = enc.encode(expected);
  let mismatch = ab.length !== eb.length ? 1 : 0;
  const len = Math.max(ab.length, eb.length);
  for (let i = 0; i < len; i++) mismatch |= (ab[i] ?? 0) ^ (eb[i] ?? 0);
  if (mismatch !== 0) return json({ error: "unauthorized" }, 401);

  const supa = getServiceClient();
  if (!supa) return json({ error: "supabase secrets eksik" }, 500);

  // 7 günden eski ticker'ları al, max 60
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: stale, error: qErr } = await supa
    .from("fund_cache")
    .select("ticker, asset_type")
    .lt("updated_at", cutoff)
    .limit(60);

  if (qErr) return json({ error: qErr.message }, 500);
  if (!stale?.length) return json({ refreshed: 0, skipped: 0, note: "all fresh" });

  const fmpKey = Deno.env.get("FMP_KEY");
  let refreshed = 0, failed = 0;

  for (let i = 0; i < stale.length; i++) {
    const { ticker: t, asset_type: at } = stale[i];
    try {
      if (at === "BIST") {
        const bist = await fetchBist(t);
        if (!bist.error) {
          await upsertFundCache(t, "BIST", bist.metrics ?? null, bist.raw?.annual ?? null, null, "isyatirim");
          refreshed++;
        } else { failed++; }
      } else if (fmpKey) {
        const fmp = await fetchFmp(t, fmpKey);
        if (fmp.ok) {
          await upsertFundCache(t, at || "US_STOCK", fmp.metrics ?? null, fmp.annual ?? null, fmp.grades ?? null, "fmp");
          refreshed++;
        } else if (fmp.isOutOfPlan) {
          const edgar = await fetchEdgar(t);
          if (!edgar.error) {
            await upsertFundCache(t, at || "US_STOCK", edgar.metrics ?? null, null, null, "edgar");
            refreshed++;
          } else { failed++; }
        } else { failed++; }
      }
    } catch { failed++; }
    if (i < stale.length - 1) await new Promise(r => setTimeout(r, 800));
  }

  return json({ refreshed, failed, total: stale.length, cutoff });
}
```

- [ ] **Step 6: Root copy'yi sync et**

```bash
cp supabase/functions/fetch-fundamentals/index.ts fetch-fundamentals-edge-function.js
```

- [ ] **Step 7: Drift check**

```bash
npm run check:edge-drift
```

Beklenen: 0 drift.

- [ ] **Step 8: Edge fn deploy et**

```bash
npx supabase functions deploy fetch-fundamentals --no-verify-jwt
```

- [ ] **Step 9: edge-reviewer agent**

`edge-reviewer` agent çağır: "fetch-fundamentals/index.ts güncellendi — upsertFundCache helper + mode:refresh-fund-cache eklendi. Güvenlik, hata yönetimi, rate limit doğru mu?"

- [ ] **Step 10: Commit**

```bash
git add supabase/functions/fetch-fundamentals/index.ts fetch-fundamentals-edge-function.js
git commit -m "feat: write to fund_cache after each fetch; add mode:refresh-fund-cache"
```

---

## Task 4: AnalysisTab — Supabase'den oku

**Files:**
- Modify: `src/components/AnalysisTab.js:123-134` (mevcut pos useEffect)

AnalysisTab şu an `fundCache` state'ini mount'ta localStorage'dan (`fundCacheGet`) dolduruyor. Bunu Supabase `fund_cache` tablosuyla da beslememiz gerekiyor.

- [ ] **Step 1: pos useEffect'ini Supabase okumasıyla genişlet**

`AnalysisTab.js:123-134` — mevcut `useEffect([pos])` bloğunu şununla değiştir:

```jsx
// pos değişince (1) localStorage'dan bilinen fresh veriyi topla,
// (2) Supabase fund_cache tablosundan DB verisi çek (pg_cron ile güncel).
useEffect(() => {
  // 1) localStorage fast-path
  setFundCache(prev => {
    const next = { ...prev };
    pos.forEach(p => {
      if (p.type !== "US_STOCK" && p.type !== "BIST") return;
      if (next[p.ticker]) return;
      const v = fundCacheGet(p.ticker);
      if (v?.metrics) next[p.ticker] = v;
    });
    return next;
  });

  // 2) Supabase fund_cache — pg_cron ile güncellenen merkezi veri
  const tickers = pos
    .filter(p => p.type === "US_STOCK" || p.type === "BIST")
    .map(p => p.ticker);
  if (!tickers.length) return;

  sb.from("fund_cache")
    .select("ticker, asset_type, metrics, annual, grades")
    .in("ticker", tickers)
    .then(({ data, error }) => {
      if (error || !data?.length) return;
      setFundCache(prev => {
        const next = { ...prev };
        data.forEach(row => {
          if (!row.metrics) return;
          const d = { metrics: row.metrics, annual: row.annual ?? null, grades: row.grades ?? null };
          next[row.ticker] = d;
          fundCacheSet(row.ticker, d);  // localStorage'ı da güncelle (offline fallback)
        });
        return next;
      });
    });
}, [pos]);
```

`sb` global olarak `utils.js`'de zaten tanımlı — ayrıca import gerekmez.

- [ ] **Step 2: babel check**

```bash
npm run check:babel
```

Beklenen: 13 OK, 0 hata.

- [ ] **Step 3: Manuel test**

1. `npx serve .` → localhost:3000
2. LS'teki `fund_*` keyleri sil (DevTools → Application → Local Storage)
3. Analiz tab → Sağlık tablosu → hemen açıldığında **boş** (Supabase'de henüz veri yok)
4. "Eksikleri Çek" tıkla → fetch-fundamentals çağrılır → fund_cache'e yazar → AnalysisTab state güncellenir
5. Sayfayı yenile (Cmd+R), LS'i sil, Analiz tab → bu sefer Supabase'den dolu gelir ✓
6. Bir hafta sonra pg_cron otomatik yeniler (test için Manuel: Dashboard → Settings → cron job test)

- [ ] **Step 4: Commit**

```bash
git add src/components/AnalysisTab.js
git commit -m "feat: load fund_cache from Supabase on AnalysisTab mount"
```

---

## Task 5: Push & production smoke test

- [ ] **Step 1: Son babel check**

```bash
npm run check:babel && npm run check:edge-drift
```

- [ ] **Step 2: Git push**

```bash
git push origin main
```

- [ ] **Step 3: Production hard reload**

GitHub Pages → `https://canmrtr.github.io/Investment-Ledger/` → Cmd+Shift+R

- [ ] **Step 4: Smoke test**

1. Analiz tab → Sağlık tablosu aç → veri dolu mü?
2. "Yenile" butonu → fundBusy spinner → tamamlanınca skor güncellendi mi?
3. Supabase Dashboard → Table Editor → `fund_cache` → satır var mı?
4. Supabase Dashboard → Integrations → pg_cron → `refresh-fund-cache-weekly` scheduled mı?

---

## Verification Checklist

- [ ] `fund_cache` tablosu Supabase'de var, RLS aktif
- [ ] `fund_cache public read` policy var
- [ ] `fetch-fundamentals` deploy edildi, "Eksikleri Çek" → fund_cache'e yazıyor
- [ ] `refresh-fund-cache-weekly` pg_cron job scheduled (her Pazar 03:30 UTC)
- [ ] AnalysisTab mount'ta Supabase'den okuyup state + LS'i güncelliyor
- [ ] LS temizlenip yenileme sonrası veri Supabase'den dolu geliyor
- [ ] babel check 13/13 OK
- [ ] edge-drift 0

## Risk & Notes

- **FMP rate limit**: refresh-fund-cache modu max 60 ticker, 800ms aralık = ~48sn. Timeout 120sn → güvende.
- **Cold start**: İlk kullanımda fund_cache boş → kullanıcı "Eksikleri Çek" yapar → tablo dolar → sonraki mount Supabase'den gelir.
- **SUPABASE_SERVICE_ROLE_KEY**: fetch-fundamentals'ta zaten kullanılıyor (`sync-ticker-db` modu) — yeni secret gerekmez.
- **"Eksikleri Çek" butonu**: Kalıyor. Kullanıcı ilk kez veya on-demand yenileme için kullanır; şimdi fund_cache'e de yazıyor.
- **sb global**: AnalysisTab.js'de `sb` Supabase client'ı `App.js` ile aynı global scope'tan geliyor (type="text/babel" paylaşımlı global). Prop olarak geçmek gerekmez.
