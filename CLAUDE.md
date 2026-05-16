# Portfoi

Tek dosyalı React + Supabase kişisel yatırım takip uygulaması. Türkçe UI.

> **Her session başında `Lessons.md`'yi oku.** Can'ın geçmişte düzelttiği veya itiraz ettiği konuların kuralları orada. Yeni bir düzeltme alırsan → `Lessons.md`'ye ekle.

## Mimari

- **Frontend**: `index.html` (ince shell: CSS + CDN scripts + `<script src>` etiketleri) + `src/constants.js`, `src/utils.js`, `src/components/*.js` — React 18 UMD + Babel Standalone (tarayıcıda JSX). Build adımı yok; CDN script'leri. GitHub Pages deploy (`main` branch root). Live: `https://canmrtr.github.io/Investment-Ledger/`
  - **Yerel geliştirme**: Babel standalone external scripts XHR ile yükler — `file://` çalışmaz. `npx serve .` veya `python3 -m http.server 8000` gerekli.
- **Backend**: Supabase (auth, PostgreSQL, RLS, Edge Functions, pg_cron).
- **Edge Functions** (hepsi `--no-verify-jwt`):
  - `parse-transaction` — Claude Haiku 4.5, metin/görüntü → `{transactions:[...]}` array
  - `fetch-prices` — Massive (US/FX/Crypto/GOLD), Yahoo (BIST price/hist), Twelve Data + borsa-mcp (BIST meta)
  - `refresh-price-cache` — pg_cron 6h, stale-first batch
  - `fetch-fundamentals` — FMP + EDGAR (US); İş Yatırım (BIST); 21 metrik + annual + grades; `mode:"ticker-list"` → ~11k ticker DB; `mode:"refresh-fund-cache"` → pg_cron haftalık stale refresh; `mode:"etf-country"` → FMP country-weightings (planlı)
- **PWA**: `manifest.json` + `service-worker.js` (root); `index.html`'de SW kayıt; icon-192/512.png mevcut.
- **Secrets** (`Deno.env.get`): `MASSIVE_KEY`, `FMP_KEY`, `TWELVEDATA_KEY`, `ANTHROPIC_KEY`

## Supabase Şeması

| Tablo | Scope | İçerik |
|-------|-------|--------|
| `positions` | user (RLS) | ticker, name, type, shares, avg_cost, currency, broker, unit (altın birimi: oz/g/quarter/half/full/republic), **portfolio_id FK**; `interest_rate numeric` (DEPOSIT yıllık oran, ör. 0.45), `maturity_date date` (DEPOSIT vade), `reserve_ratio numeric default 0` |
| `transactions` | user (RLS) | BUY/SELL/DIV kayıtları; `way` CHECK `ANY(ARRAY['BUY','SELL','DIV'])`; **portfolio_id FK** |
| `splits` | user (RLS) | ticker, split_date, ratio; **portfolio_id FK** |
| `profiles` | user (RLS, public read) | user_id PK, username, display_name, parse_calls_today/date (20/gün limit, `increment_parse_calls` RPC ile) |
| `price_cache` | paylaşımlı (service_role write only) | ticker PK, price + d1/w1/m1/y1 + p_d1…p_y1 + updated_at |
| `portfolios` | user (RLS) | id PK, user_id FK, name, privacy_level (`full` \| `allocation_only`; `private` değer geçersiz); "Ana Portföy" backfill migration uygulandı |
| `watchlist` | user (RLS) | id PK, user_id FK, ticker, asset_type, added_at |
| `follows` | user (RLS) | follower_id + followee_id FK; Social Faz 1 altyapısı |
| `portfolio_activities` | user (RLS) | portfolio_id FK, activity_type, payload; Social Faz 1 altyapısı |
| `fund_cache` | paylaşımlı (service_role write only) | ticker PK, asset_type, metrics/annual/grades jsonb, source, updated_at |
| `adr_bist_map` | paylaşımlı (public read, service_role write) | adr_ticker PK, bist_ticker, name; OTC ADR→BIST eşlemesi; `fetch-fundamentals` 1h TTL ile cache'ler; yeni satır Supabase Dashboard'dan eklenir, deploy gerekmez |

`price_cache`: frontend read-only; tüm write `fetch-prices` service_role üstünden.
`fund_cache`: frontend read-only (anon+authenticated); tüm write `fetch-fundamentals` service_role üstünden.
`adr_bist_map`: frontend read-only; dashboard veya edge fn service_role ile yazılır.
pg_cron: `refresh-price-cache-6h` — `0 */6 * * *`; `refresh-fund-cache-weekly` — `30 3 * * 0` (Pazar 03:30 UTC); her ikisi de `CRON_SECRET` Bearer header.

**DB RPC'leri** (`sb.rpc(...)`):
- `rebuild_positions_atomic(p_user_id, p_portfolio_id, p_positions jsonb)` — `SECURITY INVOKER`; pozisyon DELETE+INSERT atomik tek transaction'da; `src/utils.js:rebuildPositions` tarafından çağrılır; `null` döner → hata.
- `get_allocation_only_positions(p_portfolio_id uuid)` — `SECURITY DEFINER`; `is_public+allocation_only` portföyler için `{ticker,name,type,pct}` döner; `avg_cost`/`shares`/`broker` hiçbir zaman döndürülmez; `authenticated` + `anon` grant'li.
- `increment_parse_calls(user_id)` — parse rate limit (20/gün), `SECURITY DEFINER`.

## Tabs & Bileşenler

`Root → Login | App(#shell)`
- **#topbar**: hamburger menü (profil + settings + signOut, kullanıcı-scope LS keys signOut'tan önce temizlenir) + 6 nav + $/₺ toggle + 👁 hide + İşlem Ekle; 30dk auto-refresh
- `TABS = [["dashboard","Dashboard"],["watchlist","Watchlist"],["analysis","Analiz"],["search","Ara"],["add","+ Ekle"],["rehber","Rehber"]]` — Settings ana nav'dan çıktı, hamburger içinden açılır
- **Dashboard**: KPI (TR + XIRR), "Bu Ay Beklenen Temettüler" `<details>` kart (held US_STOCK için ex_date ∈ [today, today+30]; empty state'te gizli), 6 BLOCK_TYPE pozisyon bloğu (başlangıçta kapalı); pos-row'da ticker yanında `.badge.stale` (24h+ eski `price_cache.updated_at`)
- **WatchlistTab**: fiyat/günlük değişim tablosu, "Çıkar" per row (async `confirm_` prop'u App'ten gelir), empty-card CTA; ticker yanında `.badge.stale`; `watchlist` Supabase tablosu (id, user_id, ticker, asset_type, added_at)
- **AnalysisTab**: 4 bölüm başlığı (Performans & Getiri / Dağılım / Fundamentals / Risk Değerlendirmesi); Varlık/Bölge/Sektör Dağılımı (pie, collapsible); **Portföy Sağlık** (Portföy F/K KPI + 6 portföy seviyesi sonuç cümlesi "🟢 Borçlanma seviyesi sağlıklı" + "Detay ▾" toggle ile 8 metrik dense tablo, lazy-fetch); Komisyon (broker×yıl), Kazanan/Kaybeden, Konsantrasyon Riski, Break-Even, Potansiyel Kayıp, Dönem Bazlı Getiri (benchmark), FX Risk, 6 Aylık Performans, Temettü Özeti; global asset-type filtre (.fbar)
- **SearchTab**: ~11k ticker (US + BIST); autofocus sadece desktop'ta (`!('ontouchstart' in window)`); portföy + discovery; "+ İzle" / "✓ İzleniyor" non-held toggle
- **AddTab**: 8 asset type picker → text/image/csv/manuel; CASH/DEPOSIT Manuel-only (text/image/csv gizli); ConfirmBox + ManuelPosForm
- **TickerDetailTab**: held + discovery mode; "İzleniyor" badge + toggle buton; FAB context-aware
- **HistoryTab**: filtre toolbar, accordion ticker gruplu — ana nav'da yok; Settings → "İşlem Geçmişi" → "Tüm İşlemleri Gör →"
- **Rehber** (yeni, hamburger nav): coming soon placeholder — yatırım temelleri + portföy yönetimi rehberi
- **Settings** (hamburger menüden açılır): İşlem Geçmişi, Fiyat&Veri, Bakım, Export CSV, Account, Durum
- **#bottom-tabs** (mobile) + **#fab** (mobile, context-aware; rehber sekmesinde gizli)

## Önemli Konvansiyonlar

### Tasarım sistemi
- **Tema**: dark (default) + light (`[data-theme="light"]`).
- **Dark renk tokenleri**: `--bg #000` / `--bg2 #0c0c0c` / `--bg3 #141414` / `--bg4 #1c1c1c`; `--text #f0ede8`, `--text2 #b8b8b8`, `--text3 #888888`; `--info #C9A84C` (Portfoi Gold), `--ok #00d97e`, `--err #ff3366`, `--warn #ffb800`; `--border rgba(255,255,255,0.06)` 1px solid; `--border2 rgba(201,168,76,0.28)`.
- **Light tema** (`portfoi-brand-kit.md` Section 7): `--bg #F5F3EE` (Arctic, beyaz değil) / `--text #0D1117` (Midnight, wordmark rengi) / `--info #8A6A1F` (Gold Muted) / `--topbar-bg rgba(245,243,238,0.90)`. İkon ve border gold her iki temada aynı kalır.
- **Font**: `DM Serif Display` (hero sayılar/başlıklar) + `DM Sans` (body 300-700) + `DM Mono` (sayılar/ticker). `--font-display`/`--font-body`/`--font-numeric` CSS değişkenleri. `.lbl`/`.stitle`/`.kk`: 10px uppercase `font-weight:500`.
- **Aktif sekme**: pill `rgba(201,168,76,0.12)`, alt çizgi yok. **FAB**: 54px, `var(--info)` (gold), `bottom:76px`. **Dashboard hero**: Piyasa Değeri değeri 32px `var(--font-display)`.
- **Kod içi font kullanımı**: inline style'larda hardcoded font string yok — `fontFamily:"var(--font-display)"` / `fontFamily:"var(--font-numeric)"` kullan.
- **Logo dosyaları** (`Logo/` dizini, Sprint 21 brand refresh):
  - **Aktif:** `Logo/new/portfoi-wordmark-dark.png` + `portfoi-wordmark-light.png` (yalnız wordmark, transparan; 580×264 RGBA) — **Login** kart dışında üstte, ortalı, **120px height**; `.login-wrap` arka planı `var(--bg2)`. Aynı varlık **Topbar** sol tarafta `.topbar-wordmark` butonu içinde, **36px image** / 40px button, click → Dashboard. `@media(max-width:640px){.topbar-wordmark{display:none;}}` — mobilde gizli.
  - **Hazır ama referanssız:** `Logo/new/portfoi-lockup-dark.png` + `portfoi-lockup-light.png` (icon + wordmark + tagline lockup; 620×264 RGBA) — şu an UI'da kullanılmıyor; marketing veya app-store splash gerekirse hazır.
  - **Kaynak SVG:** `Logo/portfoi-icon.svg` (512×512, midnight + gold candles + p glyph). PWA icons (`icon-192.png`, `icon-512.png`) ve `favicon.svg` / `favicon-32.png` bundan `scripts/generate-pwa-icons.mjs` (Playwright headless) ile regenerate edilir.
  - **CSS:** `.theme-logo-dark`/`.theme-logo-light` sınıfları `[data-theme="light"]` selector ile otomatik geçiş — JS gerekmez (default `.theme-logo-light{display:none;}`).
  - **Legacy (rollback için tutuluyor, referanslı değil):** `Logo/linear-{dark,light}.png` (eski Login lockup), `Logo/Logo {Dark,Light}.png` (eski ikon), `Logo/Full Name {Dark,Light}.png` (eski wordmark).

### Para & formatlama
- `displaySym(cur)`: USD→`$`, TRY→`₺`, EUR→`€`
- `fmt(n,d=2)`, `fmtD(n)` (±$ USD only), `fmtSign(n,sym)` (currency-aware ±), `fmtP(n)` (±%), `fmtShares(n)`
- Gizli mod: `mask()` → `••••`. Display Currency: topbar toggle $/₺; KPI+Pie+Analiz convert, pozisyon blokları natural currency'de.
- **BIST için `fmtD` kullanma** — hardcoded `$` döner; `fmtSign(n, sym)` kullan.

### Tarih
- Storage: ISO `YYYY-MM-DD`. Görüntü: `DD/MM/YYYY` (`fmtDateTR`). Input: `<input type="date">`.

### CSS sınıfları
- **Buton katmanları (Sprint 21):** `.btn-icon` (square icon-only, 28×28 desktop / 36×36 mobile) < `.btn-xs` (11px) < `.btn-sm` (11px, 30px min-height) < `.btn-md` (12px, 34px min) < `.btn-pri` / `button.pri` (12px gold CTA, 38px min). `@media(max-width:640px)`: `.btn-xs/.btn-icon/.btn-sm` 36×36 min, dense table/pos-row için 8/10 padding. Inline `<button style="...">` yerine bu sınıfları tercih et.
- **Form grid'leri:** `.form-grid-2` / `.form-grid-3` — ≤640px tek kolona çöker. Inline `gridTemplateColumns` yerine bu sınıfları kullan (ManuelPosForm, TickerDetailTab quick-add/edit, HistoryTab edit row için).
- `.btn-xs/sm/md`, `.btn-danger-out`, `.finp`/`.finp.sm`, `.empty-card`, `.warn-card`
- `.pos-row`, `.badge.etf/cry/split/stale`, `.mdl-bd/bx`, `.seg`, `.mtab`, `.pie-row/pie-sw`, `[data-tip]`
- `.theme-logo-dark`/`.theme-logo-light` — `[data-theme="light"]` ile otomatik logo geçişi; `.delta-pos`/`.delta-neg` — yeşil/kırmızı delta badge sınıfları
- `.topbar-wordmark` — topbar sol wordmark butonu (Login.js olmayan tek logo placement). Mobilde gizli.
- **`.pie-row`**: `flex:"0 0 70px"` ($) + `flex:"0 0 56px"` (%) sabit basis; label `flex:1,minWidth:0`. `minWidth` yetmez, truncate/ellipsis ekleme.
- **`.fbar`**: `overflow-x:auto; scrollbar-width:none`; `.fbar .mtab`: `flex:0 0 auto; white-space:nowrap`. Wrapper'da `flexWrap:wrap` kullanma.

### Edge çağrı yardımcıları
- `edgeCall(fn, body)` — anon key ile çağırır; `fetch-prices` için **kullanma**.
- `edgeCallAuth(fn, body)` — kullanıcı JWT'si ile çağırır; session yoksa yerel `401 Response` döner (anon fallback yok).
- `edgePriceCall(body)` — `edgeCallAuth("fetch-prices", body)` kısayolu; tüm `fetch-prices` çağrıları bu yardımcıyı kullanmalı.

### ManuelPosForm davranışı
- `savePos`: tx insert → `rebuildPositions` (atomik RPC) → `loadData`. Manuel upsert yok.
- `delPos`: tüm transaction'ları sil → `rebuildPositions` → `loadData`. Sadece position row'u silmez; confirm dialog `danger:true`.

### CASH / DEPOSIT / BES pozisyon modeli
- **CASH**: `shares=bakiye, avg_cost=1.0`; `prc[ticker]=1.0` (synthetic, fetch yok). P&L daima 0.
- **DEPOSIT**: `shares=anapara, avg_cost=1.0, interest_rate=yıllık (ör. 0.42), reserve_ratio=rezerv fraksiyonu (ör. 0.10), maturity_date=opsiyonel`; `prc[ticker]=(anapara+brütFaiz)/anapara` günlük bileşik.
- **BES**: `shares=1, avg_cost=kişisel_yatırılan_tutar (X)`; `dk_principal=DK anaparası (Y), dk_current=DK güncel (Y+Y_g)` (her ikisi de nullable — eski pozisyonlar için); `prc[ticker]=total (X+X_g + Y+Y_g)` `set-manual-price` ile yazılır. Kişisel güncel = `prc[ticker] − dk_current`. ManuelPosForm 4 alan: Kişisel Yatırılan, Kişisel Güncel, DK Anaparası, DK Güncel. TickerDetailTab: BES Özeti kartı 7 satır iki bölümde gösterir (`isBes` dalı).
- `fetchPrices/fetchHist` dışı — `prc` `loadData`'da `setPrc_` ile synthetic inject edilir (`src/components/App.js:loadData`).
- `rebuildPositions(userId, pid, extraMeta)` — `extraMeta={[ticker]:{interest_rate,maturity_date,reserve_ratio}}` ilk BUY kayıtta geçilir; sonraki rebuild'lar DB snapshot ile restore eder.
- Brüt faiz: `computeDepositGrossInterest()` (App.js modül seviyesi, component dışı); stopaj sabit: `DEPOSIT_TAX_RATE=0.175`.
- **Çekim**: SELL tx (`shares=çekilen tutar, price=1.0`); piecewise hesap tüm BUY/SELL segmentlerine göre çalışır.
- Dashboard'da net P&L% (stopaj sonrası) ve brüt/net faiz breakdown gösterilir.

### CFG sabitleri
`RATE_LIMIT_MS=7500`, `DUST_THRESHOLD=0.0001`, `CSV_BATCH_SIZE=50`, `FLASH_MS=3500`

### Renk paleti (TYPE_COLORS)
`US_STOCK:#8B5CF6`, `FUND:#3B82F6`, `CRYPTO:#06B6D4`, `BIST:#F97316`, `GOLD:#C9A84C`, `FX:#10B981`, `BES:#EC4899`, `CASH:#64748B`, `DEPOSIT:#6366F1`

### Brand kit token dosyası
`src/styles/tokens.css` — tüm brand kit CSS custom property'leri (category colors, badge tokens, component tokens, extended palette). Kaynak: `portfoi-brand-kit.md`. `index.html`'deki mevcut `--bg/--text/--info/--font-*` tokenleri tekrarlanmaz.

### Flash & Confirm
- `flash_(msg, "ok"|"err")` — 3.5 sn otomatik kapanır.
- `confirm_(msg, {okLbl, cancelLbl, danger})` — **async/await gerekir**. `window.confirm` kullanma.

### Dil
- UI + flash + error: **Türkçe**. Commit: **İngilizce** + Co-Authored-By trailer.

## Özellik Detayları

Detaylı implementasyon → **`FEATURE_DETAILS.md`** (Returns, FX, Price Routing, Fundamentals, AnalysisTab, SearchTab)

## Gotchas

Kritik pitfall'lar → **`GOTCHAS.md`**

## Hooks

`.claude/settings.local.json` `PostToolUse` hook:
- **`babel-check.sh`** — `src/*.js` veya `src/components/*.js` edit sonrası ilgili dosyayı otomatik JSX parse eder; fail = exit 2. `index.html` artık inline Babel içermiyor (skip). Build adımı yok — broken parse = broken production.

## Agent Kuralları

Tetikleyicide **kullanıcıya sormadan** çağır:
- **`edge-reviewer`** — `*-edge-function.js` edit sonrası, deploy öncesi
- **`ui-builder`** — yeni UI component (tab/card/form/modal/tablo) veya görsel değişiklik; 1-2 satır tweak için skip OK
- **`sql-writer`** — migration, RLS policy, pg_cron, schema SQL
- **`rls-auditor`** — yeni tablo veya RLS policy değişikliği, SQL uygulanmadan önce
- **`client-security-auditor`** — auth/form/kullanıcı girdi render eden `index.html` değişikliği sonrası
- **`test-runner`** — major feature / deploy öncesi; **"DO NOT modify any source files. Report only."** talimatını ver

## Pre-Deploy Checklist

```bash
npm run check:babel        # JSX parse
npm run check:edge         # edge fn syntax
npm run check:edge-drift   # root .js == supabase/functions/*/index.ts eşleşmesi
```

Edge fn deploy: `supabase/functions/<fn>/index.ts` düzenle → root `.js` sync → drift check → `npx supabase functions deploy <fn> --no-verify-jwt`

Test: `npm run check:babel` (tüm src/*.js dosyalarını parse eder) + `Cmd+Shift+R` hard-reload (GitHub Pages üzerinde)
Yerel test: `npx serve .` → http://localhost:3000 (Babel standalone XHR için HTTP server gerekli)
E2E: `IL_EMAIL=... IL_PASS=... node e2e/smoke.mjs`

## Yol Haritası

Tamamlananlar + açık konular → **`ROADMAP.md`**
