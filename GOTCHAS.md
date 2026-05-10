# Gotchas

## Supabase / Edge Functions

- `SUPABASE_` prefix yasak — `SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY` runtime'da otomatik gelir, `Deno.env.get` ile tekrar tanımlama.
- `cron.job_run_details`'da `jobname` kolonu yok — `jobid` ile `cron.job`'a join gerekir.
- `transactions.way` CHECK: `ANY(ARRAY['BUY','SELL','DIV'])` — `DIV` geçerli.
- Anon key frontend'de hardcoded OK; **service_role key kesinlikle gizli** — sadece edge fn.
- Tüm edge fn CORS: `"Access-Control-Allow-Origin": "https://canmrtr.github.io"` — yeni fn'de de aynı lock. Supabase Dashboard değil, response header'dan.
- Supabase CLI bağlantı: `npx supabase link --project-ref jfetubcilmuthpddkodg`
- Edge fn deploy yapısı: `supabase/functions/<fn-name>/index.ts` gerekli (`.js` + rename).
- `fetch-fundamentals` ticker regex: `^[A-Z0-9.\-]{1,12}$/i` — nokta ve tire dahil.

## Frontend / React

- **AI parse response shape**: edge fn her zaman `{transactions:[...]}` döner. Guard: `Array.isArray(d.transactions) ? ... : (d.ticker ? [d] : [])`.
- **`rebuildPositions` unit snapshot**: önce `SELECT ticker, unit FROM positions` ile `unitMap` al; rebuild sonrası `unit: unitMap[p.ticker] ?? null` restore et — aksi halde altın pozisyonları unit kaybeder.
- **`p.currency` vs price_cache**: `prc[ticker]` BIST→TRY, diğer→USD döner. MV hesabında `p.type==="BIST"?"TRY":"USD"` kullan; cost için `p.currency` doğru.
- **`periodChange` sanity check**: `cur/base < 0.05` → null (USD/TRY mix yakalanır).
- **TRY avgCost mismatch**: `currency="USD"` ama avg_cost TRY cinsindeyse wrapPos/periodChange yanlış hesaplar — kullanıcı USD fiyatıyla düzeltmeli.
- **JSX ternary IIFE**: orphaned `)` metin nodu bırakmamaya dikkat — babel check koş.
- **localStorage scope**: `il_hide/il_prc/il_hist/il_active_portfolio/il_recent_${user.id}` user-agnostic veya user-suffix'li; **her** signOut handler'ında (Settings + hamburger) temizlenmeli — biri eksikse cross-user cache leak. `fund_*/meta_*/sec_ticker_db` public data, user-bound değil.
- **Component prop drilling — `confirm_`/`flash_`**: `confirm_` ve `flash_` App.js'in iç closure'ları, **global değil**. Alt component'e prop olarak geçilmeli; eksikse babel parse temiz görünür ama runtime'da `ReferenceError`. Yeni component eklerken WatchlistTab pattern'ini takip et.
- CSV round-trip: virgül/tırnaklı alanlar için `csvEsc()` — "Apple, Inc" aksi halde parçalanır.
- Edge fn useEffect auto-fetch: `busy.h/p` guard korunmalı.
- XIRR `<1Y` yanıltıcı — UI bilinçli gizliyor.
- **`openDetail` asset_type gap**: `openDetail` resolves type from `pos` → `watchlistItems` when caller omits it. But old watchlist rows may have `asset_type=NULL` in DB, and HistoryTab explicitly passes `undefined`. If a BIST ticker still gets HTTP 404 on meta, check the `watchlist` row's `asset_type` column in Supabase.
- **`effectiveType` fallback = silent wrong API**: `effectiveType = p?.type || assetTypeHint || "US_STOCK"` in TickerDetailTab — if both are null, a BIST ticker hits Massive API (US stock provider) → HTTP 404 on company info/meta. Always trace the type chain before debugging 404s in TickerDetailTab.
- **fund_cache out-of-plan sentinel**: Non-US/non-EDGAR tickers (e.g. NNOX — Israeli, MNSO — Chinese) return 422 with no `metrics` from `fetch-fundamentals`. Stored as `{metrics:null,unavailable:true}` sentinel. `stillMissing` check excludes `?.unavailable`; without this, "Eksikleri Çek" retries forever with no effect.
- **`fetch-fundamentals` EDGAR fallback**: `!fmp.ok` (tüm FMP hataları: 402/429/boş array) → EDGAR dene. Sadece `isOutOfPlan` değil. `refresh-fund-cache` loop da aynı koşulu kullanmalı — ikisi diverge ederse stale tickers cron'da EDGAR'a düşmez.
- **`.filter(([,v])=>v)` + IIFE null**: Array içinde IIFE `null` döndürebilirse (erken `return null`) destructuring filter crash eder. `.filter(Boolean)` önce gel: `.filter(Boolean).filter(([,v])=>v)`.
- **`fund_cache` debug query**: `SELECT ticker, source, (metrics IS NOT NULL) has_metrics, updated_at FROM fund_cache ORDER BY updated_at DESC` — hangi tickerlerin fundamentals çektiğini 1 sorguda gösterir; log okumadan önce buraya bak.

## CSS / Layout

- **`.pie-row` kolon hizalama**: `flex:"0 0 70px"` ($) + `flex:"0 0 56px"` (%) sabit basis. `minWidth` yetmez — content > minWidth'te kayar. Label: `flex:1, minWidth:0`; truncate/ellipsis ekleme → "Hi…/ET…" regression.
- **`.fbar` filter chip bar**: wrapper'da `flexWrap:"wrap"` kullanma. `.fbar`: `overflow-x:auto; scrollbar-width:none`. `.fbar .mtab`: `flex:0 0 auto; white-space:nowrap`.
- **iOS Safari auto-zoom**: `font-size < 16px` input focus'ta zoom yapar. `max-width:640px` altında `input/textarea/select { font-size: 16px }`.
- **Mobil autofocus**: `<input autoFocus>` mobilde klavyeyi otomatik açar (istenmeyen UX). `useRef` + `useEffect` ile `if (!('ontouchstart' in window)) ref.current.focus()` koşullu kullan.
- **Theme-aware img display**: `.theme-logo-dark`/`.theme-logo-light` gibi tema-koşullu img class'ları için CSS rule MUTLAKA tanımlı olmalı (`display:none` + `[data-theme="light"]` selector). Yoksa iki img üst üste render olur — silent failure, babel parse temiz görünür.
- `data-tip` kullan — native `title` tooltip Chrome/Safari'de 1-2 sn gecikmeli.
- **BIST `fmtD`**: hardcoded `$` döner — BIST için `fmtSign(n, sym)` kullan.
- **Yahoo Finance**: BIST ticker `THYAO.IS` formatı edge fn'de yapılır; frontend ham ticker geçer.
- **borsa-mcp**: ilk handshake ~500ms; 401/404'te oturum yeniler.

## Agent

- **test-runner write yetkisi**: `Write` toollu — "DO NOT modify any source files. Report only." talimatını explicit ver.

## Deploy

- **Service Worker cache version**: `service-worker.js` içindeki `CACHE = 'il-shell-vN'` shell asset değişikliğinde (HTML/manifest) **bump edilmeli**. Aksi halde mevcut kullanıcılarda eski shell cache'lenir, yeni deploy görünmez. Sadece `.js`/`.css` değişiklikleri network-first → version bump gerekmez.
- **Edge fn env var deploy sırası**: Yeni `Deno.env.get(...)` eklediysen ÖNCE `npx supabase secrets set KEY=value`, SONRA `npx supabase functions deploy <fn>`. Aksi halde fn fallback'e düşer (genelde sessiz).
