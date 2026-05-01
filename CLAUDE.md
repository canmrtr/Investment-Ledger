# Investment Ledger

Tek dosyalı React + Supabase kişisel yatırım takip uygulaması. Türkçe UI.

## Mimari

- **Frontend**: `index.html` (ince shell: CSS + CDN scripts + `<script src>` etiketleri) + `src/constants.js`, `src/utils.js`, `src/components/*.js` — React 18 UMD + Babel Standalone (tarayıcıda JSX). Build adımı yok; CDN script'leri. GitHub Pages deploy (`main` branch root). Live: `https://canmrtr.github.io/Investment-Ledger/`
  - **Yerel geliştirme**: Babel standalone external scripts XHR ile yükler — `file://` çalışmaz. `npx serve .` veya `python3 -m http.server 8000` gerekli.
- **Backend**: Supabase (auth, PostgreSQL, RLS, Edge Functions, pg_cron).
- **Edge Functions** (hepsi `--no-verify-jwt`):
  - `parse-transaction` — Claude Haiku 4.5, metin/görüntü → `{transactions:[...]}` array
  - `fetch-prices` — Massive (US/FX/Crypto/GOLD), Yahoo (BIST price/hist), Twelve Data + borsa-mcp (BIST meta)
  - `refresh-price-cache` — pg_cron 6h, stale-first batch
  - `fetch-fundamentals` — FMP + EDGAR (US); İş Yatırım (BIST); 21 metrik + annual + grades; `mode:"ticker-list"` → ~11k ticker DB
- **Secrets** (`Deno.env.get`): `MASSIVE_KEY`, `FMP_KEY`, `TWELVEDATA_KEY`, `ANTHROPIC_KEY`

## Supabase Şeması

| Tablo | Scope | İçerik |
|-------|-------|--------|
| `positions` | user (RLS) | ticker, name, type, shares, avg_cost, currency, broker, unit (altın birimi: oz/g/quarter/half/full/republic) |
| `transactions` | user (RLS) | BUY/SELL/DIV kayıtları; `way` CHECK `ANY(ARRAY['BUY','SELL','DIV'])` |
| `splits` | user (RLS) | ticker, split_date, ratio |
| `profiles` | user (RLS, public read) | user_id PK, username, display_name, parse_calls_today/date (20/gün limit, `increment_parse_calls` RPC ile) |
| `price_cache` | paylaşımlı (service_role write only) | ticker PK, price + d1/w1/m1/y1 + p_d1…p_y1 + updated_at |

`price_cache`: frontend read-only; tüm write `fetch-prices` service_role üstünden.
pg_cron: `refresh-price-cache-6h` — `0 */6 * * *`, `CRON_SECRET` Bearer header.

## Tabs & Bileşenler

`Root → Login | App(#shell)`
- **#topbar**: logo + 5 nav + $/₺ toggle + 👁 hide + İşlem Ekle; 30dk auto-refresh
- **Dashboard**: KPI (TR + XIRR), 6 BLOCK_TYPE pozisyon bloğu (başlangıçta kapalı)
- **HistoryTab**: filtre toolbar, accordion ticker gruplu
- **AnalysisTab**: Varlık/Bölge Dağılımı, Portföy Sağlık (8 metrik), Komisyon, Kazanan/Kaybeden
- **SearchTab**: ~11k ticker (US + BIST), portföy + discovery
- **AddTab**: 6 asset type picker → text/image/csv/manuel; ConfirmBox + ManuelPosForm
- **TickerDetailTab**: held + discovery mode; FAB context-aware
- **Settings**: Fiyat&Veri, Bakım, Export CSV, Account, Durum
- **#bottom-tabs** (mobile) + **#fab** (mobile, context-aware)

## Önemli Konvansiyonlar

### Tasarım sistemi
- **Tema**: yalnız dark.
- **Renk tokenleri**: `--bg #000` / `--bg2 #0c0c0c` / `--bg3 #141414` / `--bg4 #1c1c1c`; `--text #f0ede8`, `--text2 #b8b8b8`, `--text3 #888888`; `--info #6658ff`, `--ok #00d97e`, `--err #ff3366`, `--warn #ffb800`; `--border rgba(255,255,255,0.06)` 1px solid.
- **Font**: `DM Sans` (body 300-700) + `DM Mono` (sayılar/ticker). `.lbl`/`.stitle`/`.kk`: 10px uppercase `font-weight:500`.
- **Aktif sekme**: pill `rgba(102,88,255,0.12)`, alt çizgi yok. **FAB**: 54px, `var(--info)`, `bottom:76px`.

### Para & formatlama
- `displaySym(cur)`: USD→`$`, TRY→`₺`, EUR→`€`
- `fmt(n,d=2)`, `fmtD(n)` (±$ USD only), `fmtSign(n,sym)` (currency-aware ±), `fmtP(n)` (±%), `fmtShares(n)`
- Gizli mod: `mask()` → `••••`. Display Currency: topbar toggle $/₺; KPI+Pie+Analiz convert, pozisyon blokları natural currency'de.
- **BIST için `fmtD` kullanma** — hardcoded `$` döner; `fmtSign(n, sym)` kullan.

### Tarih
- Storage: ISO `YYYY-MM-DD`. Görüntü: `DD/MM/YYYY` (`fmtDateTR`). Input: `<input type="date">`.

### CSS sınıfları
- `.btn-xs/sm/md`, `.btn-danger-out`, `.finp`/`.finp.sm`, `.empty-card`, `.warn-card`
- `.pos-row`, `.badge.etf/cry/split`, `.mdl-bd/bx`, `.seg`, `.mtab`, `.pie-row/pie-sw`, `[data-tip]`
- **`.pie-row`**: `flex:"0 0 70px"` ($) + `flex:"0 0 56px"` (%) sabit basis; label `flex:1,minWidth:0`. `minWidth` yetmez, truncate/ellipsis ekleme.
- **`.fbar`**: `overflow-x:auto; scrollbar-width:none`; `.fbar .mtab`: `flex:0 0 auto; white-space:nowrap`. Wrapper'da `flexWrap:wrap` kullanma.

### CFG sabitleri
`RATE_LIMIT_MS=7500`, `DUST_THRESHOLD=0.0001`, `CSV_BATCH_SIZE=50`, `FLASH_MS=3500`

### Renk paleti (TYPE_COLORS)
`US_STOCK:#30d158`, `FUND:#0a84ff`, `CRYPTO:#ff9f0a`, `BIST:#bf5af2`, `GOLD:#ffd60a`, `FX:#8e8e93`

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
