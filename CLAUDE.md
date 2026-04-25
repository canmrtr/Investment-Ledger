# Investment Ledger

Tek dosyalı React + Supabase kişisel yatırım takip uygulaması. Türkçe UI.

## Mimari

- **Frontend**: `index.html` — React 18 UMD + Babel Standalone (tarayıcıda JSX).
  Build adımı yok; CDN script'leri. GitHub Pages'e doğrudan deploy (`main` branch root).
  Live URL: `https://canmrtr.github.io/Investment-Ledger/`
- **Backend**: Supabase (auth, PostgreSQL, RLS, Edge Functions, pg_cron).
- **Edge Functions** (Supabase'te deploy'lu, hepsi `--no-verify-jwt`; kaynağı referans olarak repo'da):
  - `parse-transaction-edge-function.js` — Claude Haiku 4.5 ile metin/görüntü → `{transactions:[...]}` array (multi-line destek)
  - `fetch-prices-edge-function.js` — Multi-provider router: Massive (US/FX/Crypto/GOLD), Yahoo Finance (BIST price/historical), Twelve Data + borsa-mcp (BIST meta paralel merge)
  - `refresh-price-cache-edge-function.js` — Scheduled (pg_cron 6h), `price_cache`'i stale-first batch ile tazeler
  - `fetch-fundamentals-edge-function.js` — FMP `/stable/` + SEC EDGAR fallback; 21 metrik. Ek mode: `mode:"ticker-list"` → SEC EDGAR (US, ~10.348) + Twelve Data /stocks XIST (BIST, ~636) merged ticker DB

- **Secrets** (Supabase Edge Function env, `Deno.env.get(...)`):
  - `MASSIVE_KEY` — Polygon clone (US/FX/Crypto/GOLD)
  - `FMP_KEY` — Financial Modeling Prep (US fundamentals)
  - `TWELVEDATA_KEY` — BIST reference + ticker list
  - `ANTHROPIC_KEY` — Claude API (parse-transaction)
  - SEC EDGAR + Yahoo + borsa-mcp auth-free; key gerekmez

## Supabase Şeması

| Tablo | Scope | İçerik |
|-------|-------|--------|
| `positions` | user-specific (RLS) | ticker, name, type, shares, avg_cost, currency, broker |
| `transactions` | user-specific (RLS) | BUY/SELL kayıtları (shares/price orijinal değerlerde) |
| `splits` | user-specific (RLS) | ticker, split_date, ratio (stock split bilgisi) |
| `profiles` | user-specific (RLS, public read) | user_id PK, username (unique), display_name |
| `price_cache` | **paylaşımlı** (auth read+upsert) | ticker PK, price + d1/w1/m1/y1 + p_d1…p_y1 + updated_at |

`price_cache` RLS: `authenticated` rolüne SELECT/INSERT/UPDATE; DELETE policy yok.
`profiles` RLS: SELECT herkese (auth) açık (ileride social feed için), INSERT/UPDATE sadece kendi satırına.

### pg_cron job

`refresh-price-cache-6h` — `0 */6 * * *` (her 6 saat). `pg_net.http_post` ile edge function'ı çağırır, anon Bearer header.

## `index.html` Yapısı (bileşen haritası)

```
Root → Login (IL mark) | App
  App (#shell)
    ├─ #topbar (sticky)       — [IL] logo + nav (Dashboard/İşlemler/Ara/Ayarlar)
    │                            + sağ aksiyonlar (↻ Güncelle, 👁 hide, + İşlem Ekle)
    ├─ <main #app-main>
    │   ├─ Dashboard          — KPI kartlar (TR + XIRR), [Sparkline + Pie] yan yana,
    │   │                       pozisyon tablosu, TRY/EUR blokları
    │   ├─ HistoryTab         — filtre toolbar, accordion (ticker gruplu, search)
    │   ├─ SearchTab          — global ticker arama (10k+ US listed via SEC),
    │   │                       portföy + tüm hisseler iki ayrı bölüm
    │   ├─ AddTab             — 4 mod: text/image/csv/manuel; multi-line AI parse
    │   │   ├─ ConfirmBox     — parse onayı (tek=kv-grid, çoklu=row list + ×)
    │   │   └─ ManuelPosForm  — direkt pozisyon; tarih→fiyat autofill
    │   ├─ TickerDetailTab    — held mode (pozisyon kartları) + discovery mode
    │   │                       (non-held; YOK badge, warn-card, meta+fund only)
    │   └─ Settings           — Fiyat & Veri, Bakım, Export (CSV), Account, Durum
    ├─ #bottom-tabs (mobile)  — 3 nav (Dashboard/İşlemler/Ara/Ayarlar; +Ekle filtreli)
    └─ #fab (mobile)          — Floating "+ İşlem Ekle" sağ alt
```

Üst-level yardımcılar (top-level, App/Root dışı):
- `rebuildPositions(userId)` — split-aware pozisyon yeniden hesabı
- `xirr(cashflows)` — Newton-Raphson IRR (yıllık return)
- `buildCashflows(txs, mvNow)` — XIRR için cash flow serisi
- `SparkChart` — küçük SVG portfolio değer grafiği
- `AccountSection` — Settings içinde Hesap formu
- `fmtShares(n)` — adet formatı (integer veya trailing-zero-trimmed ondalık)
- `fmtDateTR(iso)` — `YYYY-MM-DD` → `DD/MM/YYYY` görüntü; ISO storage'a dokunmaz
- `parseTRDate(s)` — TR formatı → ISO (manuel override yolu)
- `safeUrl(url)` — http/https scheme allowlist; provider compromise koruması
- `enrichParseWithPrice(d)` / `enrichParseListWithPrices(list)` — AI parse fiyat boşsa kapanış autofill (tarih → latest fallback)
- `NAV_ICONS` — desktop topbar (s=14) + mobile bottom-tabs (s=20) SVG'leri
- `DEBUG` const (top of script) — `false` ise console.warn/log no-op (production polish)
- `tickerDbCacheGet/Set` — LS cache 24h TTL (SearchTab için)

## Returns Hesabı

Dashboard'daki 4 özet kart:

| Kart | Değer | Period bağımlı |
|------|-------|---------------|
| Maliyet | Σ shares × avg_cost (mevcut pozisyonlar) | Hayır |
| Piyasa Değeri | Σ shares × current_price | Hayır |
| Total Return | (MV + period_sells) − (start_MV + period_buys) | Evet |
| Yıllık (XIRR) | Cash-flow tabanlı IRR (yıllık) — sadece ≥1Y | Evet |

- **Total Return**: Realize + unrealize, komisyonlar dahil. Period seçilince start_MV `mvAtDate(period_start)` ile yaklaşık hesaplanır (sadece bugün aktif olan ticker'lar üzerinden).
- **XIRR**: `<` 1 yıl periyotlarda kart "—" gösterir + "≥1Y için gösterilir" hint. Çok kısa periyotlarda extrapolation yanıltıcı olduğu için.
- Tüm kartlar `data-tip` attribute ile özel CSS tooltip'li (anlık görünür).

## Önemli Konvansiyonlar

### Tasarım sistemi (2026-04-25 redesign)
- **Tema**: yalnız dark — `prefers-color-scheme:light` kaldırıldı.
- **Renk tokenleri** (`:root`):
  - `--bg #000` / `--bg2 #0c0c0c` / `--bg3 #141414` / `--bg4 #1c1c1c` (4 katman)
  - `--text #f0ede8` (sıcak beyaz), `--text2 #666`, `--text3 #333`
  - `--info #6658ff` (mor brand), `--ok #00d97e`, `--err #ff3366`, `--warn #ffb800`
  - `--border rgba(255,255,255,0.06)` — hat kullanımı için 1px solid (eski 0.5px değil)
- **Tipografi**: Google Fonts `DM Sans` (300-700 body) + `DM Mono` (400/500 sayılar/ticker).
- **Aktif sekme**: pill (soft mor bg `rgba(102,88,255,0.12)` + text), alt çizgi yok.
- **FAB mobile**: 54px daire, `var(--info)` mor, mor shadow, sağ alt sabit (`bottom:76px`).

### Para & formatlama
- USD → `$`, TRY → `₺`, EUR → `€`
- `fmt(n, d=2)`, `fmtD(n)` (±$), `fmtP(n)` (±%), `fmtShares(n)` adet için
- Gizli mod (`hide` state): `mask()` ile tüm $ tutarları `••••`

### Tarih
- **Storage**: ISO `YYYY-MM-DD` (Supabase date). Internal hesaplar/sıralama hep ISO.
- **Görüntü**: `DD/MM/YYYY` — `fmtDateTR(iso)` helper'ı kullan.
- **Input**: `<input type="date">` (native picker, locale-aware, value ISO).

### CFG sabitleri (top-level)
```js
CFG.RATE_LIMIT_MS    = 7500   // Massive.com ticker arası bekleme
CFG.DUST_THRESHOLD   = 0.0001 // pozisyon sayılacak min shares
CFG.CSV_BATCH_SIZE   = 50     // Supabase insert batch
CFG.FLASH_MS         = 3500   // flash mesaj süresi
CFG.CSV_PROGRESS_MS  = 5000   // CSV bitişi sonrası progress reset
```

### Renk paleti (asset_type → pie chart)
```js
TYPE_COLORS = {
  US_STOCK: "#30d158",  // yeşil
  FUND:     "#0a84ff",  // mavi
  CRYPTO:   "#ff9f0a",  // turuncu
  BIST:     "#bf5af2",  // mor
  GOLD:     "#ffd60a",  // sarı
  FX:       "#8e8e93",  // gri
};
```

### CSS class'ları
- `.btn-xs` / `.btn-sm` / `.btn-md` — buton size varyantları
- `.btn-danger-out` — error outline
- `.finp` / `.finp.sm` — form input, küçük varyant
- `.empty-card` — CTA'lı boş-durum kartı
- `.warn-card` — turuncu uyarı kartı (ör. "fiyat yok", "yetersiz veri")
- `.pos-row` — clickable tablo satırı (hover bg değişimi, history'ye yönlendirir)
- `.badge.etf`/`.badge.cry`/`.badge.split` — ticker rozetleri (split: ⚡ ×N)
- `.mdl-bd`/`.mdl-bx` — özel confirm modal
- `.seg` — segmented control (toggle); pie chart Maliyet/Piyasa
- `.pie-row`/`.pie-sw` — pie chart legend rows
- `[data-tip]` — özel CSS tooltip (hover'da pop-up, native title yerine)

### Flash & Confirm
- `flash_(msg, "ok"|"err")` — 3.5 sn otomatik kapanır
- `confirm_(msg, {okLbl, cancelLbl, danger})` — **async**, `await` gerekir. `window.confirm` kullanma.

### Dil
- Tüm UI metinleri, flash mesajları, error'lar **Türkçe**
- Commit mesajları **İngilizce** + Co-Authored-By trailer

## Stock Split Sistemi

- Split satırı eklendiğinde (Supabase'e elle INSERT) kullanıcı **Ayarlar → "♻️ Pozisyonları Yeniden Hesapla"** tıklamalı
- `rebuildPositions` her transaction için `factorFor(ticker, date) = Π ratio(tarihten sonraki splitler)` hesaplar
- HistoryTab satır render'ı: o işlemden sonra split varsa `⚡ ×N` badge + tooltip

## Price Cache Akışı

1. **Mount**: `loadData` `price_cache` select eder → `hist`/`prc` state'ine yazar (hızlı chart)
2. **Backfill**: LS'te olup cache'te olmayan ticker'lar bir kerelik cache'e yazılır
3. **Auto-fetch**: `pos` değiştiğinde, cache'te eksik ticker varsa arka planda `fetchHist(missing)` tetiklenir
4. **Yazma**: her başarılı `fetch-prices` sonucu `price_cache`'e upsert (paylaşım)
5. **Cron**: `refresh-price-cache` her 6 saatte bir en stale 5 ticker'ı tazeler

## Price Provider Routing

`fetch-prices` edge function multi-provider. Frontend `asset_type` parametresini geçirir; edge function ona göre route eder:

| asset_type | Provider | Endpoint | Notlar |
|------------|----------|----------|--------|
| `US_STOCK` / `FUND` / default | Massive (Polygon clone) | `api.massive.com/v1/open-close`, `/v2/aggs`, `/v3/reference/tickers` | MASSIVE_KEY |
| `CRYPTO` | Massive | ticker `X:BTCUSD` formatı | aynı key |
| `FX` / `GOLD` | Massive | `C:USDTRY`, `C:XAUUSD` | aynı key |
| `BIST` (price/historical) | **Yahoo Finance** unofficial | `query1.finance.yahoo.com/v8/finance/chart/THYAO.IS` | Auth yok; UA header gerek |
| `BIST` (meta) | **Twelve Data + borsa-mcp** paralel | `/stocks?exchange=XIST` (TD) + `borsamcp.fastmcp.app/mcp` `get_profile` (MCP) | TWELVEDATA_KEY |

### Massive.com (Polygon clone) Ticker Formatları

| Asset | Format | Örnek |
|-------|--------|-------|
| US hisse / ETF | direkt ticker | `AAPL`, `SPY`, `GLD` |
| Forex | `C:XXXYYY` | `C:USDTRY`, `C:EURUSD` |
| Crypto | `X:BTCUSD` | `X:BTCUSD`, `X:ETHUSD` |
| Spot altın | `C:XAUUSD` | (1 ons USD) |
| Bazı endeksler | `I:NDX` | (`I:SPX` premium tier) |

### BIST Provider Mimarisi

- **Yahoo Finance** chart endpoint — auth-free, ~5 yıl stabil. `THYAO` → `THYAO.IS`. Edge function `User-Agent: Mozilla/...` header gönderir (Yahoo bot-block koruması). Twelve Data Basic plan US dışı market data verdiği için seçildi.
- **Twelve Data /stocks reference** — free tier'da 636 BIST ticker (XIST exchange). Sadece name + currency + type. Search tab ticker DB'si bu kaynaktan.
- **borsa-mcp** (saidsurucu/borsa-mcp, MIT, public hosted) — JSON-RPC over HTTP+SSE. 3 step handshake (initialize → notifications/initialized → tools/call). Module-level session cache (auto re-init on 401/404). `get_profile` BIST için sektör, industry, market cap, F/K, temettü yield, 52W high/low döner. Risk: tek dev hosted instance; B planı self-host (Docker, Python 3.11) veya `yahoo-finance2` npm.
- **İş Yatırım MaliTablo** — Faz 5b için planlandı (henüz integre değil). `?companyCode=THYAO&exchange=TRY&financialGroup=XI_29&yearN=&periodN=` formatında 147-row tam finansal veri (bilanço + gelir + nakit). 4 quarter cumulative (period: 3/6/9/12). 21-metrik checklist için ham veri kaynağı.

### Search Tab Ticker DB

`fetch-fundamentals` mode:`"ticker-list"` SEC EDGAR + Twelve Data /stocks XIST listesini birleştirir (~10.984 entry: 10.348 US + 636 BIST). Module-level cache 24h TTL. Frontend LS cache 24h. Her entry: `{ticker, name, exchange: "US"|"XIST"}`.

## Currency Handling

- BIST → TRY (₺), US/global → USD ($), bazı pozisyonlar EUR (€).
- TickerDetailTab içinde `effectiveType = p?.type ?? assetTypeHint ?? "US_STOCK"`; `displayCurrency = p?.currency ?? (effectiveType==="BIST" ? "TRY" : "USD")`; `sym = ₺/€/$`.
- Pozisyon kartları (g4: Maliyet/MV/P&L), detay satırı (Realized/Unrealized/Komisyon), header price hepsi `sym` kullanır.
- Manuel form: type=BIST seçilince currency otomatik TRY (set ediliyor onChange'de).
- Storage: `transactions.price` ve `positions.avg_cost` ham değer (kullanıcının para birimi); `currency` field ayrıca tutuluyor.
- Ön-sıralama / total: TRY bloku ayrıca özet kartlarda gösteriliyor; **portföy toplamında USD'ye fx conversion henüz yok** (ROADMAP).

## Fundamental Veri (FMP + EDGAR fallback)

- **Primary provider**: Financial Modeling Prep — secret `FMP_KEY` (edge function env'inde).
- **Fallback**: SEC EDGAR — FMP "Special Endpoint" 402 (NOW/MNSO/NNOX gibi out-of-plan ticker'lar) gelirse otomatik düşer. Ücretsiz, sınırsız, tüm SEC dosyalayıcılarını kapsar.
- **Endpoint'ler**:
  - FMP **`/stable/`** API (Aug 2025'te `/api/v3` legacy oldu). `?symbol=AAPL` query param. Response şeması legacy ile aynı: `key-metrics-ttm`, `ratios-ttm`, `income-statement` (5Y annual), `balance-sheet-statement` (1Y), `cash-flow-statement` (1Y).
  - EDGAR `data.sec.gov/api/xbrl/companyfacts/CIK*.json` — User-Agent header zorunlu.
- **21 metrik**: gelir/kâr 5Y CAGR, 4 marj (gross/op/net/FCF), ROE/ROA/ROIC, gider rasyoları (SG&A, D&A, faiz), bilanço (yük/özk, birikmiş kâr/özk), faiz karşılama, net borç/FCF, CapEx (3 oran), P/E, P/S.
- **EDGAR mode kısıtı**: P/E ve P/S null kalır (market price gerek). Diğer 19 metrik us-gaap line item'larından derive edilir.
- **EDGAR FY anchoring**: `NetIncomeLoss`'un en yeni fy'si anchor → tüm metrikler aynı fy'den okunur (cross-year karışma yok). ASC 606 gibi taxonomy migration'larda freshest-concept stratejisi (`Revenues` vs `RevenueFromContractWith...`).
- **Source badge**: response'da `source: "fmp"|"edgar"` döner; TickerDetailTab başlığında küçük rozet.
- **Renk kodlaması**: top-level `FUND_THRESHOLDS` tablosunda her metriğin `good`/`ok` eşikleri var; `fundScore(key,val)` → `good`/`neutral`/`bad`. UI'da pill renkler.
- **Cache**: LS `fund_${ticker}` (7 gün TTL).
- **Kapsam**: `US_STOCK` (held) + non-held discovery (search'ten gelen) için aktif. FUND/CRYPTO/BIST/GOLD'da bölüm hidden.

## Search Tab (global ticker arama)

- **Veri kaynağı**: SEC EDGAR `company_tickers.json` — ~10.350 US listed (NYSE/NASDAQ).
- **Proxy**: Edge function `fetch-fundamentals` `mode:"ticker-list"` (browser SEC'e doğrudan fetch yapamaz, User-Agent zorunluluğu).
- **Cache**: LS `sec_ticker_db` (24 saat TTL); ilk Ara sekmesi açılışında lazy fetch.
- **Match**: ticker prefix (büyük harf) + şirket adı substring (case-insensitive).
- **Render**: 2 bölüm — "Portföyünden" (held + geçmiş işlem ticker'ları, "açık" badge) + "Tüm hisseler" (max 50 sonuç). Click → `openDetail(ticker)`.
- **Discovery mode (non-held)**: TickerDetailTab `!p` durumunda position summary kartlarını gizler; `YOK` badge + turuncu warn-card + meta + fundamental + "+ Ekle" CTA gösterir. Live price `fetch-prices` ile auto-fetch edilir.

## Ölçeklenme Notları

- Şu an `price_cache` write policy frontend'e açık (auth user'lar yazabilir). Kullanıcı sayısı arttıkça **service_role'a daraltılmalı** ve tüm write edge function üstünden yapılmalı.
- Auto-fetch on mount: çok user'da rate limit'i zorlar — opt-in'e çevirmek gerekebilir.
- Detay: ROADMAP.md "Aşama 2" notları.

## Gotchas

- Supabase secret adları `SUPABASE_` ile başlayamaz (platform otomatik sağlar): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` zaten edge function runtime'da var.
- `cron.job_run_details` tablosunda `jobname` kolonu **yok** — `jobid` ile `cron.job`'a join gerekir.
- `transactions.way` serbest text ama pratikte `BUY`/`SELL`. Dividend için `"DIV"` denenmişti, schema'da CHECK olabilir, revert edildi.
- **Anon key public**'tir (frontend'de hardcoded OK), **service_role key kesinlikle gizli** — sadece edge function'larda `Deno.env.get(...)` ile.
- CSV export/import round-trip: virgül/tırnaklı alanlar için `csvEsc()` kullan, aksi halde "Apple, Inc" parçalanır.
- Edge function `pos` değiştiğinde useEffect ile auto-fetch tetikler → `busy.h/p` guard'ı korunmalı.
- XIRR `<1Y` periyotlarda matematiksel olarak hesaplanabilir ama yanıltıcı; UI bilinçli olarak gizliyor.
- Native HTML `title` attribute tooltip'i Chrome/Safari'de 1-2 sn gecikmeli — bu yüzden `data-tip` + custom CSS pseudo-element kullanılıyor.
- **iOS Safari/Chrome auto-zoom**: input `font-size < 16px` ise focus'ta sayfayı zoomlar ve session boyu kalır. Mobile media query (`max-width:640px`) altında `input/textarea/select { font-size: 16px }` zorunlu.
- **BIST currency display**: `fmtD(n)` "+$1,234.56" hardcoded `$` döner. BIST için `${(n>=0?"+":"-")+sym+fmt(Math.abs(n),2)}` inline kullan, fmtD'yi parametrik yap diye refactor etme (US tarafına yan etki getirir).
- **Yahoo Finance .IS suffix**: BIST tickerını `THYAO.IS` formatına çevir (edge function tdPrice yapar). Frontend ham ticker geçer.
- **borsa-mcp session expire**: 401/404'te oturum yenilenir; ilk handshake ~500ms ekstra latency.
- **Twelve Data Basic plan limit**: Sadece US market data açık. BIST için sadece /stocks reference data (ticker list) çalışır. Real-time/historical price ve fundamentals 402 döner — bu yüzden Yahoo + borsa-mcp seçildi.
- **İş Yatırım MaliTablo parametreleri**: `financialGroup=XI_KONSOL` GEÇERSİZ; doğru: `XI_29`, `UFRS`, veya `UFRS_K`. `exchange=TRY` (boş bırakma — `value:[]` döner). `period`: 3/6/9/12 (Q1/H1/9M/Yıllık cumulative).
- **FMP "Special Endpoint" 402**: NOW gibi mid-cap'ler FMP free tier'a kapalı; edge function otomatik EDGAR'a düşer. EDGAR mode'unda P/E ve P/S null kalır (price gerek).
- **fetch-prices weekend**: Cumartesi/Pazar tarihleri için 403; AI parse autofill'inde önce date-spesifik dener, fail olursa `mode:price` (no date) ile latest close'a fallback yapar.
- **AI parse response shape**: edge function her zaman `{transactions:[...]}` array döner (multi-line + tek işlem hep array). Eski tek-obje format için FE side'da `Array.isArray(d.transactions) ? ... : (d.ticker ? [d] : [])` guard'ı var.
- **localStorage scope**: `il_hide`/`il_prc`/`il_hist` user-agnostic; signOut handler bunları temizler. `fund_*`, `meta_*`, `sec_ticker_db` public market data, user-bound değil.
- **SearchTab → TickerDetailTab non-held flow**: detail page `pos.find(...)` boş dönerse "discovery mode" — pozisyon kartları gizli, YOK badge + warn-card aktif. Yeni eklenen `+ Ekle` flow rebuildPositions sonrası held mode'a otomatik geçer.

## Hooks (otomatik validasyon)

`.claude/settings.local.json` içinde `PostToolUse` hook'u tanımlı:

- **`.claude/hooks/babel-check.sh`** — Edit/Write/MultiEdit sonrası `index.html` ise babel/JSX parse'ı koşar. Parse fail olursa exit 2 + stderr ile asistan feedback alır, düzeltir. Build adımı yok — parse fail = canlı sitede tüm kullanıcılar broken page görür.

## Agent Kuralları

`.claude/agents/` altında tanımlı agent'lar. Tetikleyici durumda **kullanıcıya sormadan otomatik** çağır.

- **`babel-checker`** — `index.html` edit'i sonrası **hook tarafından otomatik koşulur**; agent'ı manuel çağırmaya gerek yok. Hook devre dışıysa fallback olarak çağırılabilir.
- **`edge-reviewer`** — `*-edge-function.js` edit'inden sonra, kullanıcıya "deploy et" önermeden **önce**. Security / error-handling / Deno pitfall raporu.
- **`ui-builder`** — yeni bir UI component (tab, card, form, modal, tablo) eklenecek veya mevcut component'in görsel/yapısal değişikliği yapılacak ise kod yazımını delege et. Tasarım sistemi + Türkçe UI konvansiyonlarını biliyor. 1-2 satır string/copy tweak için skip OK.
- **`sql-writer`** — Supabase migration, RLS policy, pg_cron job veya schema SQL'i yazılacak ise. Proje gotcha'larını (jobname column yok, `SUPABASE_` prefix, `transactions.way` enum vb.) biliyor.
- **`rls-auditor`** — yeni tablo eklenince **veya** mevcut RLS policy değişince, SQL uygulanmadan önce. Read-only audit; user data isolation doğrular.
- **`client-security-auditor`** — auth flow / form / kullanıcı girdisi rendering eden yerlerde `index.html` değişikliği yaptıktan sonra. Ayrıca güvenlik-hassas commit'ten önce manuel çağrı uygundur. XSS, secret leak, LS hijyeni, privacy-mode regression'lerini tarar.
- **`test-runner`** — Playwright + Chromium ile canlı (veya localhost) E2E test. Major feature sonrası veya deploy öncesi manuel çağrı. Mid-session eklenen agent'lar registry'ye girmeyebilir; bu durumda `cd /tmp && npm install --no-save playwright` + manuel script de seçenek.

## Test & Doğrulama

- Babel parse sanity check (büyük edit'lerden sonra):
  ```bash
  cd /tmp && node -e "
    const fs=require('fs'); const h=fs.readFileSync('...','utf8');
    const m=h.match(/<script type=\"text\/babel\">([\s\S]*?)<\/script>/);
    try{require('@babel/parser').parse(m[1],{sourceType:'module',plugins:['jsx']});console.log('OK');}
    catch(e){console.log('ERR:',e.message,'line',e.loc?.line);}
  "
  ```
- Frontend testi: `Cmd+Shift+R` hard-reload sonrası
- Edge function test: Supabase Dashboard → Edge Functions → function → Test tab, body ile invoke

## Yol Haritası / Açık Konular

Detaylı liste için **`ROADMAP.md`** dosyasına bakın. Tamamlananlar:
- ✅ Pie chart, Account screen, Returns (TR + XIRR), TickerDetailTab
- ✅ Fundamentals (FMP 21-metric checklist + EDGAR fallback)
- ✅ Search tab (~11k ticker: 10.348 SEC US + 636 Twelve Data BIST)
- ✅ Multi-line AI parse, weekend price fallback, manuel date-price autofill
- ✅ Major redesign (DM Sans/Mono, dark palette, top navbar + bottom tabs + FAB)
- ✅ **BIST entegrasyonu (Faz 1-5a)** — Yahoo Finance price/historical, Twelve Data /stocks DB, borsa-mcp profile, currency-aware display, manuel ekleme + search + non-held discovery

Açık başlıklar:
- **BIST Faz 5b**: İş Yatırım MaliTablo'dan 21-metrik fundamentals checklist
- **Asset type'lar**: altın (`C:XAUUSD` ile mümkün), TEFAS fonları (borsa-mcp `get_fund_data` mevcut), vadeli mevduat
- **EDGAR + market price**: P/E ve P/S için CommonStockSharesOutstanding × current price
- **Sektör-aware fundamental eşikler**: tech P/E ≤30, utility ≤15 vs.
- **Portföy-geneli checklist tablosu**: tüm pozisyonlar tek tabloda
- **Tarihsel fundamental trend**: 5 yıl gelir/marj/ROE eğrisi
- **Asset type seçimi → ekleme akışı**: context-free + butonlardan girince önce type seçtir
- **Sosyal**: risk profili, anonim feed (privacy gerektirir)
- **Eğitim**: Investment Basics modülü
