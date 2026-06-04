# Portfoi

Tek dosyalı React + Supabase kişisel yatırım takip uygulaması. Türkçe UI.

> **Her session başında `Lessons.md`'yi oku.** Can'ın geçmişte düzelttiği veya itiraz ettiği konuların kuralları orada. Yeni bir düzeltme alırsan → `Lessons.md`'ye ekle.

> **Her commit + push, ilgili `.md` dosyalarını da güncellemek zorunda.** Kod davranışı / schema / convention / sprint durumu / feature değişikliği varsa **aynı commit'te** şu dosyalardan ilgili olanları güncelle: `ROADMAP.md`, `CLAUDE.md`, `FEATURE_DETAILS.md`, `GOTCHAS.md`, `Lessons.md`, `docs/superpowers/plans/*.md`. Doküman güncellemesini "sonraya" bırakma — drift sessizdir.

## Mimari

- **Frontend**: `index.html` (ince shell: CSS + CDN scripts + `<script src>` etiketleri) + `src/constants.js`, `src/utils.js`, `src/components/*.js` — React 18 UMD + Babel Standalone (tarayıcıda JSX). Build adımı yok; CDN script'leri. GitHub Pages deploy (`main` branch root). Live: `https://canmrtr.github.io/Investment-Ledger/`
  - **Yerel geliştirme**: Babel standalone external scripts XHR ile yükler — `file://` çalışmaz. `npx serve .` veya `python3 -m http.server 8000` gerekli.
- **Backend**: Supabase (auth, PostgreSQL, RLS, Edge Functions, pg_cron).
- **Edge Functions** (hepsi `--no-verify-jwt`):
  - `parse-transaction` — Claude Haiku 4.5, metin/görüntü → `{transactions:[...]}` array
  - `fetch-prices` — Massive (US/FX/Crypto/GOLD), Yahoo (BIST price/hist), Twelve Data + borsa-mcp (BIST meta)
  - `refresh-price-cache` — pg_cron 6h, stale-first batch
  - `fetch-fundamentals` — FMP + EDGAR (US); İş Yatırım (BIST); 21 metrik + annual + grades + `dcf` (FMP `/stable/discounted-cash-flow` adil değer, cevapta top-level — metrics jsonb'sine konmaz; US-only); `mode:"ticker-list"` → ~11k ticker DB; `mode:"refresh-fund-cache"` → pg_cron haftalık stale refresh; `mode:"etf-country"` → FMP country-weightings (planlı)
- **PWA**: `manifest.json` + `service-worker.js` (root); `index.html`'de SW kayıt; icon-192/512.png mevcut.
- **Secrets** (`Deno.env.get`): `MASSIVE_KEY`, `FMP_KEY`, `TWELVEDATA_KEY`, `ANTHROPIC_KEY`

## Supabase Şeması

| Tablo | Scope | İçerik |
|-------|-------|--------|
| `positions` | user (RLS) | ticker, name, type, shares, avg_cost, currency, broker, unit (altın birimi: oz/g/quarter/half/full/republic), **portfolio_id FK**; `interest_rate numeric` (DEPOSIT yıllık oran, ör. 0.45), `maturity_date date` (DEPOSIT vade), `reserve_ratio numeric default 0` |
| `transactions` | user (RLS) | BUY/SELL/DIV kayıtları; `way` CHECK `ANY(ARRAY['BUY','SELL','DIV'])`; **portfolio_id FK** |
| `splits` | user (RLS) | ticker, split_date, ratio; **portfolio_id FK** |
| `profiles` | user (RLS, public read) | user_id PK, username, display_name, parse_calls_today/date (20/gün limit, `increment_parse_calls` RPC ile) |
| `price_cache` | paylaşımlı (service_role write only) | ticker PK, price + d1/w1/m1/y1 + p_d1…p_y1 + h_52w/l_52w (Sprint 22, closes-only) + updated_at |
| `portfolios` | user (RLS) | id PK, user_id FK, name, privacy_level (`full` \| `allocation_only`; `private` değer geçersiz); "Ana Portföy" backfill migration uygulandı |
| `watchlist` | user (RLS) | id PK, user_id FK, ticker, asset_type, added_at |
| `follows` | user (RLS) | follower_id + followee_id FK; Social Faz 1 altyapısı |
| `portfolio_activities` | user (RLS) | portfolio_id FK, activity_type, payload; Social Faz 1 altyapısı |
| `fund_cache` | paylaşımlı (service_role write only) | ticker PK, asset_type, metrics/annual/grades jsonb, source, updated_at |
| `adr_bist_map` | paylaşımlı (public read, service_role write) | adr_ticker PK, bist_ticker, name; OTC ADR→BIST eşlemesi; `fetch-fundamentals` 1h TTL ile cache'ler; yeni satır Supabase Dashboard'dan eklenir, deploy gerekmez |
| `tefas_funds` | paylaşımlı (public read, service_role write) | code PK, name, category, updated_at; TEFAS yatırım fonu kataloğu (~3500 fon); `fetch-fundamentals mode:"tefas-catalog"` ile doldurulur; SearchTab `tefas_funds` araması bundan beslenir |

`price_cache`: frontend read-only; tüm write `fetch-prices` service_role üstünden.
`fund_cache`: frontend read-only (anon+authenticated); tüm write `fetch-fundamentals` service_role üstünden.
`adr_bist_map`: frontend read-only; dashboard veya edge fn service_role ile yazılır.
`tefas_funds`: frontend read-only (anon+authenticated); tüm write `fetch-fundamentals` service_role üstünden.
pg_cron: `refresh-price-cache-6h` — `0 */6 * * *`; `refresh-fund-cache-weekly` — `30 3 * * 0` (Pazar 03:30 UTC); her ikisi de `CRON_SECRET` Bearer header.

**DB RPC'leri** (`sb.rpc(...)`):
- `rebuild_positions_atomic(p_user_id, p_portfolio_id, p_positions jsonb)` — `SECURITY INVOKER`; pozisyon DELETE+INSERT atomik tek transaction'da; `src/utils.js:rebuildPositions` tarafından çağrılır; `null` döner → hata.
- `get_allocation_only_positions(p_portfolio_id uuid)` — `SECURITY DEFINER`; `is_public+allocation_only` portföyler için `{ticker,name,type,pct}` döner; `avg_cost`/`shares`/`broker` hiçbir zaman döndürülmez; `authenticated` + `anon` grant'li.
- `bes_update_atomic(p_ticker text, p_total numeric, p_dk_current numeric)` — `SECURITY DEFINER`; `positions.dk_current` + `price_cache.price` aynı transaction'da güncellenir; ownership doğrulamasını `auth.uid()` ile yapar (BES tipi + caller'a ait pozisyon zorunlu). `BesUpdateModal` aylık güncellemede kullanır; `authenticated` grant'li.
- `increment_parse_calls(user_id)` — parse rate limit (20/gün), `SECURITY DEFINER`.

## Tabs & Bileşenler

`Root → Login | App(#shell)`
- **#topbar**: hamburger menü (profil + settings + signOut, kullanıcı-scope LS keys signOut'tan önce temizlenir) + 6 nav + $/₺ toggle + 👁 hide + İşlem Ekle; 30dk auto-refresh
- **LS key scope (Sprint 22 #5)**: User-scoped key'ler `il_<base>_<userId>` pattern'inde (SearchTab `il_recent_${userId}` ile aynı). Liste `USER_SCOPED_LS_BASES` (utils.js): `il_prc`, `il_hist`, `il_hide`, `il_last_fetch`, `il_nudge_dismissed`, `il_active_portfolio`. App mount'ta `migrateUserLSKeys(user.id)` legacy non-scoped key'leri user-scoped'a hoist eder (idempotent, no-op sonraki render'larda). Device-pref global key'ler: `il_theme`, `il_fx`, `il_disp_cur` (whitelist `clearUserLocalKeys`'te). Ticker-keyed paylaşımlı cache'ler (`fund_*`, `meta_*`, `il_divcal_*`, `il_etf_cw_*`, `sec_ticker_db_v3`) prefix gerektirmez — kullanıcıdan bağımsız ticker datası.
- `TABS = [["dashboard","Dashboard"],["watchlist","Watchlist"],["analysis","Analiz"],["search","Ara"],["add","+ Ekle"],["rehber","Rehber"]]` — Settings ana nav'dan çıktı, hamburger içinden açılır
- **Dashboard**: KPI (TR + XIRR), "Bu Ay Beklenen Temettüler" `<details>` kart (held US_STOCK için ex_date ∈ [today, today+30]; empty state'te gizli), 6 BLOCK_TYPE pozisyon bloğu (başlangıçta kapalı); pos-row'da ticker yanında `.badge.stale` (24h+ eski `price_cache.updated_at`)
- **WatchlistTab**: fiyat/günlük değişim tablosu, "Çıkar" per row (async `confirm_` prop'u App'ten gelir), empty-card CTA; ticker yanında `.badge.stale`; `watchlist` Supabase tablosu (id, user_id, ticker, asset_type, added_at)
- **AnalysisTab** (Sprint 23 — **Özet / Detay iki katman**): root `<div>` flex-column; kartlar CSS `order` ile konumlanır (kaynak DOM sırası ≠ görsel sıra). **Özet katmanı** (`order` 10–16, default görünür): Varlık/Bölge/Sektör Dağılımı (stacked bar, collapsible), Aylık Özet, 6 Aylık Performans, Kur Riski, Temettü Özeti. **Detaylı Analiz toggle** (`detailOpen` state, `order:20`) altında **Detay katmanı** (`order` 30–37, `display:detailOpen?undefined:"none"`): **Portföy Sağlık** (Portföy F/K KPI + 6 portföy seviyesi sonuç cümlesi + "Detay ▾" toggle ile 8 metrik dense tablo), Konsantrasyon Riski, Break-Even, Potansiyel Kayıp, Kazanan/Kaybeden, Dönem Bazlı Getiri (benchmark), **Piyasa Düşüşü Dayanıklılığı** (MV-weighted 1-10 skor + tek-satır verdict "güçlü ≥7 / orta ≥5 / kırılgan <5" + composition satırı + per-ticker bar grid; BIST bankaları + non-equity `isFundEligible` ile kapsam dışı), Toplam Komisyon (broker×yıl). **fund_cache lazy-fetch**: Supabase `fund_cache` SELECT + edge auto-fetch yalnız `detailOpen===true` iken (`useEffect` deps `[pos,detailOpen]`); Detay hiç açılmazsa hiçbir fundamentals ağ isteği yok. Eski 4 bölüm başlığı (Performans/Dağılım/Fundamentals/Risk) kaldırıldı. Global asset-type filtre (`.fbar`) iki katmanın da üstünde.
- **SearchTab**: ~11k ticker (US + BIST); autofocus sadece desktop'ta (`!('ontouchstart' in window)`); portföy + discovery; "+ İzle" / "✓ İzleniyor" non-held toggle
- **AddTab**: 8 asset type picker → text/image/csv/manuel; CASH/DEPOSIT Manuel-only (text/image/csv gizli); ConfirmBox + ManuelPosForm
- **TickerDetailTab**: held + discovery mode; "İzleniyor" badge + toggle buton; FAB context-aware; held US_STOCK/BIST için "Giriş Kalitesi" 52W bar (gradient + avg_cost vertical marker + güncel fiyat disk marker; h_52w/l_52w NULL ise gizli); US_STOCK/USD için fundamental checklist üstünde "Hızlı Değerleme (DCF)" kartı (`fund.dcf` adil değer + yükseliş potansiyeli `(dcf−price)/price`; renkli verdict ≥%50 🟢 / ≥%25 🟡 / <%25 🔴; `fund.dcf>0` yoksa gizli)
- **HistoryTab**: filtre toolbar, accordion ticker gruplu — ana nav'da yok; Settings → "İşlem Geçmişi" → "Tüm İşlemleri Gör →"
- **Rehber** (yeni, hamburger nav): coming soon placeholder — yatırım temelleri + portföy yönetimi rehberi
- **Settings** (hamburger menüden açılır): İşlem Geçmişi, Fiyat&Veri, Bakım, Export CSV, Account, Durum
- **#bottom-tabs** (mobile) + **#fab** (mobile, context-aware; rehber sekmesinde gizli)

## Önemli Konvansiyonlar

### Tasarım sistemi

> Tüm marka & tasarım dokümantasyonu için tek giriş noktası: **`docs/brand/README.md`**. Brand kit (`docs/brand/brand-kit.md`), design audit, logo asset path'leri, generation script'leri ve `src/styles/tokens.css` token katmanı oradan indekslenir. UI işine başlamadan önce oraya bak.

Sık başvurulan operasyonel kurallar (quick-ref):
- **Tema**: dark (default) + light (`[data-theme="light"]`).
- **Dark renk tokenleri**: `--bg #000` / `--bg2 #0c0c0c` / `--bg3 #141414` / `--bg4 #1c1c1c`; `--text #f0ede8`, `--text2 #b8b8b8`, `--text3 #888888`; `--info #C9A84C` (Portfoi Gold), `--ok #00d97e`, `--err #ff3366`, `--warn #ffb800`; `--border rgba(255,255,255,0.06)` 1px solid; `--border2 rgba(201,168,76,0.28)`.
- **Light tema** (detay: `docs/brand/brand-kit.md` Section 7): `--bg #F5F3EE` (Arctic) / `--text #0D1117` (Midnight) / `--info #8A6A1F` (Gold Muted). İkon ve border gold her iki temada aynı kalır.
- **Font**: `DM Serif Display` (hero sayılar/başlıklar) + `DM Sans` (body 300-700) + `DM Mono` (sayılar/ticker). `--font-display`/`--font-body`/`--font-numeric` CSS değişkenleri. `.lbl`/`.stitle`/`.kk`: 10px uppercase `font-weight:500`.
- **Aktif sekme**: pill `rgba(201,168,76,0.12)`, alt çizgi yok. **FAB**: 54px, `var(--info)` (gold), `bottom:76px`. **Dashboard hero**: Piyasa Değeri değeri 32px `var(--font-display)`.
- **Kod içi font kullanımı**: inline style'larda hardcoded font string yok — `fontFamily:"var(--font-display)"` / `fontFamily:"var(--font-numeric)"` kullan.
- **Logo path özeti** (tüm detay `docs/brand/README.md`'de):
  - Aktif wordmark: `Logo/new/portfoi-wordmark-{dark,light}.png` — Login 120px height, Topbar `.topbar-wordmark` 36px (mobilde gizli).
  - Tema CSS: `.theme-logo-dark`/`.theme-logo-light` — `[data-theme="light"]` ile otomatik geçiş.
  - Kaynak SVG: `Logo/portfoi-icon.svg` → PWA icons + favicon `scripts/generate-pwa-icons.mjs` ile.
  - Legacy (rollback): `Logo/legacy/` altında.

### Para & formatlama
- `displaySym(cur)`: USD→`$`, TRY→`₺`, EUR→`€`
- `fmt(n,d=2)`, `fmtD(n)` (±$ USD only), `fmtSign(n,sym)` (currency-aware ±), `fmtP(n)` (±%), `fmtShares(n)`
- Gizli mod: `mask()` → `••••`. Display Currency: topbar toggle $/₺; KPI+Pie+Analiz convert, pozisyon blokları natural currency'de.
- **BIST için `fmtD` kullanma** — hardcoded `$` döner; `fmtSign(n, sym)` kullan.

### Tarih
- Storage: ISO `YYYY-MM-DD`. Görüntü: `DD/MM/YYYY` (`fmtDateTR`). Input: `<input type="date">`.

### CSS sınıfları
- **Buton katmanları (Sprint 21):** `.btn-icon` (square icon-only, 28×28 desktop / 36×36 mobile) < `.btn-xs` (11px) < `.btn-sm` (11px, 30px min-height) < `.btn-md` (12px, 34px min) < `.btn-pri` / `button.pri` (12px gold CTA, 38px min). `@media(max-width:640px)`: `.btn-xs/.btn-icon/.btn-sm` 36×36 min, dense table/pos-row için 8/10 padding. Inline `<button style="...">` yerine bu sınıfları tercih et. Icon-only emoji/sembol butonlar (✎, ×, 💰, ↻) **`.btn-icon`** + `aria-label` + `data-tip`.
- **`.link-btn`** (Sprint 22, design audit): transparent inline button gold text — login mode toggle, "devamı / daha az", "Temizle" gibi link-stil tekstler. `.link-btn.sm` 12px varyant.
- **Form grid'leri:** `.form-grid-2` / `.form-grid-3` — ≤640px tek kolona çöker. Inline `gridTemplateColumns` yerine bu sınıfları kullan (ManuelPosForm, TickerDetailTab quick-add/edit, HistoryTab edit row, AnalysisTab metric grid için).
- **`.type-picker-grid`** (Sprint 22): AddTab asset-type cards; `auto-fit minmax(150px,1fr)` desktop, `1fr 1fr` ≤480px.
- **`.metric-mini`** (Sprint 22): `bg4` flat KPI card 10×12; içinde `.lbl` (üst) + `.val` (numeric 15/700). AnalysisTab Aylık Özet, custom metric pill için.
- **`.inline-alert.err / .ok`** (Sprint 22): form/section scoped flow-positioned alert. `.flash`'ı form içinde inline kullanma — `.inline-alert` kullan (parse errors, validation summaries, in-form feedback).
- **Tablet breakpoint (Sprint 22, 641–880px):** `.topbar-nav .tab` compact, `.topbar-freshness` gizli, `.topbar-wordmark` 36→32 height. Topbar overflow'unu önler.
- `.btn-xs/sm/md`, `.btn-danger-out`, `.finp`/`.finp.sm`, `.empty-card` (`.ic` + `.ttl` + `.sub` + CTA), `.warn-card`, `.cbox`
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
- **BES**: `shares=1, avg_cost=kişisel_yatırılan_tutar (X)`; `dk_principal=DK anaparası (Y), dk_current=DK güncel (Y+Y_g)` (her ikisi de nullable — eski pozisyonlar için); `prc[ticker]=total (X+X_g + Y+Y_g)` aylık güncellemede `bes_update_atomic` RPC ile yazılır (positions.dk_current + price_cache aynı transaction'da). ManuelPosForm ilk-oluştur akışı hâlâ `set-manual-price` mode'unu kullanır, fakat artık server-side BES-only + ownership guard'lı. Kişisel güncel = `prc[ticker] − dk_current`. ManuelPosForm 4 alan: Kişisel Yatırılan, Kişisel Güncel, DK Anaparası, DK Güncel. TickerDetailTab: BES Özeti kartı 7 satır iki bölümde gösterir (`isBes` dalı).
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
`src/styles/tokens.css` — tüm brand kit CSS custom property'leri (category colors, badge tokens, component tokens, extended palette). Kaynak: `docs/brand/brand-kit.md`. `index.html`'deki mevcut `--bg/--text/--info/--font-*` tokenleri tekrarlanmaz.

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

## Agent & Skill Kuralları

**Agents** (izole alt-süreç, raporlama/audit/test için):
- **`edge-reviewer`** (sonnet) — `*-edge-function.js` edit sonrası, deploy öncesi
- **`rls-auditor`** (sonnet) — yeni tablo veya RLS policy değişikliği, SQL uygulanmadan önce; policy **text** auditi
- **`rls-empirical-tester`** (sonnet) — `rls-auditor` sonrası schema/RLS migration apply edildiğinde; gerçek cross-user query'lerle RLS'i deneyimsel doğrular
- **`client-security-auditor`** (sonnet) — auth/form/kullanıcı girdi render eden `index.html` değişikliği sonrası
- **`test-runner`** (haiku) — major feature / deploy öncesi; **"DO NOT modify any source files. Report only."** talimatını ver
- **`commit-helper`** (haiku) — Can "commit hazırla" derse; İngilizce commit message draft + docs-sync (.md güncelleme) listesi üretir
- **`price-debugger`** (sonnet) — Can "X tickerının fiyatı yanlış / eski" derse; provider cascade'i (Massive/Yahoo/Twelve/borsa-mcp/İş Yatırım) manuel traverse eder

Tetikleyicide **kullanıcıya sormadan** çağır (commit-helper ve price-debugger explicit istek üzerine).

**Skills** (ana thread'e yüklenen methodology paketleri — `.claude/skills/<name>/SKILL.md`):
- **`ui-builder`** — yeni UI component (tab/card/form/modal/tablo) veya görsel değişiklik; 1-2 satır tweak için skip OK. Babel parse'ı PostToolUse hook otomatik yapar.
- **`sql-writer`** — migration, RLS policy, pg_cron, schema SQL. Schema değişikliği sonrası `rls-auditor` agent'ını çağır.
- **`product-owner`** — roadmap grooming, sprint planlama, fikir üretimi, önceliklendirme

Babel parse otomatize: `.claude/hooks/babel-check.sh` PostToolUse hook'u `src/*.js` ve `src/components/*.js` edit sonrası çalışır.

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

## Ürün Stratejisi & Marka

- Vizyon, positioning, GTM → **`docs/strategy/README.md`** (product-vision, launch-plan)
- Marka, tasarım sistemi, logo asset'leri → **`docs/brand/README.md`** (brand-kit, design-audit, tokens.css)
