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
  - `fetch-fundamentals-edge-function.js` — FMP `/stable/` + SEC EDGAR fallback (US); İş Yatırım MaliTablo (BIST, `asset_type:"BIST"`); 21 metrik. Ek mode: `mode:"ticker-list"` → SEC EDGAR (US, ~10.348) + Twelve Data /stocks XIST (BIST, ~636) merged ticker DB

- **Secrets** (Supabase Edge Function env, `Deno.env.get(...)`):
  - `MASSIVE_KEY` — Polygon clone (US/FX/Crypto/GOLD)
  - `FMP_KEY` — Financial Modeling Prep (US fundamentals)
  - `TWELVEDATA_KEY` — BIST reference + ticker list
  - `ANTHROPIC_KEY` — Claude API (parse-transaction)
  - SEC EDGAR + Yahoo + borsa-mcp auth-free; key gerekmez

## Supabase Şeması

| Tablo | Scope | İçerik |
|-------|-------|--------|
| `positions` | user-specific (RLS) | ticker, name, type, shares, avg_cost, currency, broker, unit (TEXT DEFAULT NULL — altın birimi: oz/g/quarter/half/full/republic) |
| `transactions` | user-specific (RLS) | BUY/SELL kayıtları (shares/price orijinal değerlerde) |
| `splits` | user-specific (RLS) | ticker, split_date, ratio (stock split bilgisi) |
| `profiles` | user-specific (RLS, public read) | user_id PK, username (unique), display_name, parse_calls_today (INT DEFAULT 0), parse_calls_date (DATE DEFAULT CURRENT_DATE) |
| `price_cache` | **paylaşımlı** (service_role write only) | ticker PK, price + d1/w1/m1/y1 + p_d1…p_y1 + updated_at |

`price_cache` RLS: `authenticated` rolüne SELECT; INSERT/UPDATE/DELETE policy kaldırıldı — tüm write `fetch-prices` edge function üstünden **service_role** ile (Sprint 5).
`profiles` RLS: SELECT herkese (auth) açık (ileride social feed için), INSERT/UPDATE sadece kendi satırına. `parse_calls_today/date` sütunları sadece `increment_parse_calls` RPC (SECURITY DEFINER) ile service_role üstünden güncellenir.

### pg_cron job

`refresh-price-cache-6h` — `0 */6 * * *` (her 6 saat). `pg_net.http_post` ile edge function'ı çağırır, `CRON_SECRET` Bearer header (Sprint 4 — anon Bearer yerine geçti).

## `index.html` Yapısı (bileşen haritası)

```
Root → Login (IL mark) | App
  App (#shell)
    ├─ #topbar (sticky)       — [IL] logo + nav (Dashboard/İşlemler/Analiz/Ara/Ayarlar)
    │                            + sağ aksiyonlar (.cur-seg $/₺ toggle, 🕐 son güncelleme yaşı (readonly
    │                            span + busy spinner — otomatik 30dk interval + visibilitychange),
    │                            👁 hide, + İşlem Ekle); manuel "↻ Şimdi Güncelle" Settings'te
    ├─ <main #app-main>
    │   ├─ Dashboard          — KPI kartlar (TR + XIRR, display cur'da convert),
    │   │                       [Sparkline + Pie] yan yana, pozisyon blokları VARLIK
    │   │                       TÜRÜNE göre (US Hisse/ETF/BIST/Kripto/Altın/Döviz —
    │   │                       BLOCK_TYPES config), EUR cost-only ayrı blok
    │   ├─ HistoryTab         — filtre toolbar, accordion (ticker gruplu, search)
    │   ├─ AnalysisTab        — 5 kart: Varlık Dağılımı (filter chip ile type→ticker),
    │   │                       Bölge Dağılımı (heuristik US/TR/Crypto/Emtia/Döviz),
    │   │                       **Portföy Sağlık Tablosu** (8 metrik renk pill +
    │   │                       collapsible: 🟢/🟡/🔴 aggregate rozet üstte),
    │   │                       Toplam Komisyon (collapsible: KPI üstte + Detay ▾),
    │   │                       Kazanan/Kaybeden Trade (BUY+SELL bağımsız, split-adj)
    │   ├─ SearchTab          — global ticker arama (~11k: 10.348 US + 636 BIST),
    │   │                       portföy + tüm hisseler iki ayrı bölüm
    │   ├─ AddTab             — 6-kart asset type picker → 4 mod: text/image/csv/manuel;
    │   │                       picker context-free (FAB/+İşlem'den); detay'dan gelen
    │   │                       AddTxInline picker görmez
    │   │   ├─ ConfirmBox     — parse onayı (tek=kv-grid, çoklu=row list + ×)
    │   │   └─ ManuelPosForm  — `prefillType` prop; tarih→fiyat autofill;
    │   │                       CRYPTO/GOLD modunda chip picker (CRYPTO_SYMBOLS /
    │   │                       COMMODITY_SYMBOLS); priceNote inline persistent uyarı
    │   ├─ TickerDetailTab    — held mode (pozisyon kartları) + discovery mode
    │   │                       (non-held; YOK badge, warn-card, meta+fund only);
    │   │                       FAB context-aware "il-detail-add" event listener
    │   └─ Settings           — Fiyat & Veri (test result inline + "↻ Şimdi Güncelle · X dk önce"
    │                           manuel buton), Bakım, Export (CSV), Account, Durum (FX Kuru dahil)
    ├─ #bottom-tabs (mobile)  — 5 nav (Dashboard/İşlemler/Analiz/Ara/Ayarlar; detail'de
    │                           fromTab vurgusu); +Ekle filtreli, FAB ayrı
    └─ #fab (mobile)          — Context-aware: Detail'de + Ekle (custom event),
                                Search'te input focus, Settings'te gizli, default + İşlem Ekle
```

Üst-level yardımcılar (top-level, App/Root dışı):
- `edgeCallAuth(fn, body)` — parse-transaction için: `sb.auth.getSession()` ile gerçek kullanıcı JWT'si alıp gönderir (anon key değil); rate limit kimlik doğrulaması için
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
- `NAV_ICONS` — desktop topbar (s=14) + mobile bottom-tabs (s=20) SVG'leri (5 entry: dashboard/history/analysis/search/settings)
- `ADD_TYPES` — AddTab type picker için 6 entry (US_STOCK/BIST/FUND/CRYPTO/GOLD/FX) + icon/label/desc
- `BLOCK_TYPES` — Dashboard pozisyon blokları için 6 entry (US Hisse/ETF/BIST/Kripto/Altın/Döviz) — currency-yerine asset_type bazlı gruplama
- `BENCHMARKS` — Dashboard benchmark karşılaştırması için 2 entry: `[{ticker:"SPY",label:"S&P 500",type:"US_STOCK"},{ticker:"XU100",label:"BIST 100",type:"BIST"}]`
- `SECTOR_COLORS` — AnalysisTab Sektör Dağılımı için 10 renk dizisi; "Bilinmiyor" her zaman `SECTOR_UNKNOWN_COLOR` (#8e8e93 gri)
- `CRYPTO_SYMBOLS` — ManuelPosForm CRYPTO chip picker için 12 popüler kripto (BTC/ETH/SOL/...)
- `COMMODITY_SYMBOLS` — ManuelPosForm GOLD chip picker için 4 emtia (XAU/XAG/XPT/XPD + ikon)
- `GOLD_UNITS` — ManuelPosForm GOLD birim picker için 6 birim (oz/g/quarter/half/full/republic) + `grams` ağırlık + `purity` saflık faktörü
- `goldOzPerUnit(unit)` — birim → troy oz çevirimi (`shares * ozFactor` oz-eq storage; `avg_cost / ozFactor` per-oz price). unit=null → factor=1 (legacy oz geriye uyumlu)
- `REGION_OF` / `REGION_META` — AnalysisTab bölge dağılımı heuristik (asset_type → region key + label/color)
- `sym_(cur)` — currency code → ₺/€/$ sembol map (AnalysisTab içi)
- `displaySym(cur)` — top-level currency → sembol map (FX conversion için merkez yardımcı)
- `convert(amt, from, to, fxRates)` — USD↔TRY↔EUR çevrim helper'ı (EUR↔TRY için EUR→USD→TRY chain)
- `fxCacheGet/Set` — LS `il_fx` cache 24h TTL (Frankfurter API rates)
- `fmtSign(n, sym)` — currency-aware signed format (`+₺X` / `-$X`); `fmtD`'nin parametrik versiyonu
- `sanitizeMeta(data)` — provider compromise koruması: `meta.description` 5KB cap (`META_DESC_CAP`)
- `buildSlicesPath(arr,cx,cy,r)` — pie SVG path generator (Varlık + Bölge pie'ları paylaşır)
- `DEBUG` const (top of script) — `false` ise console.warn/log no-op (production polish)
- `tickerDbCacheGet/Set` — LS cache 24h TTL + memory fallback `_tickerDbMem` (LS quota fail için); SearchTab için, key `sec_ticker_db_v2`

## Returns Hesabı

Dashboard'daki 4 özet kart (hepsi **display currency**'de — toggle ile $ veya ₺):

| Kart | Değer | Period bağımlı |
|------|-------|---------------|
| Maliyet | Σ convert(shares × avg_cost, p.currency, displayCur) | Hayır |
| Piyasa Değeri | Σ convert(shares × current_price, p.currency, displayCur) | Hayır |
| Total Return | (MV + period_sells) − (start_MV + period_buys) | Evet |
| Yıllık (XIRR) | Cash-flow tabanlı IRR (yıllık) — sadece ≥1Y | Evet |

- **Total Return**: Realize + unrealize, komisyonlar dahil. Period seçilince start_MV `mvAtDate(period_start)` ile yaklaşık hesaplanır (tüm pos'lar üzerinden, convert ile display cur'a çevrilir).
- **XIRR**: `<` 1 yıl periyotlarda kart "—" gösterir + "≥1Y için gösterilir" hint. Çok kısa periyotlarda extrapolation yanıltıcı olduğu için.
- Tüm kartlar `data-tip` attribute ile özel CSS tooltip'li (anlık görünür).
- **FX kuru yok** durumunda `convert()` null döner; pozisyon toplama 0 olarak girer ama warn-card görünür ("FX kuru yok · ↻ Güncelle").

## FX (Currency Conversion)

- **Provider**: Frankfurter API (`https://api.frankfurter.dev/v1/latest?from=USD&to=TRY,EUR`) — ECB resmi rates, auth-free, CORS-friendly, browser doğrudan fetch (edge function bypass).
- **State**: `fxRates = {USDTRY: 32.5, EURUSD: 1.08}`. Frankfurter `USD→EUR` döner; bizim convert helper'ı `EUR→USD` bekler — `1 / d.rates.EUR` ile invert.
- **Cache**: `LS.il_fx` 24h TTL (`fxCacheGet/Set`). Mount'ta + ↻ Güncelle ile tetiklenir; pos/txs değişince EUR pozisyon varsa otomatik refresh.
- **Display Currency Toggle**: Topbar `.cur-seg` segmented buton (`$ ₺`); state `displayCur ∈ {"USD","TRY"}` LS persist (`il_disp_cur`).
- **Konvansiyon**: Ham pozisyon değerleri orijinal currency'sinde storage; sadece display sırasında convert. TickerDetailTab + HistoryTab orijinal currency'de kalır (toggle dokunmaz); Dashboard KPI + Sparkline + Pie + AnalysisTab tüm kartları display cur'a convert eder.

## Önemli Konvansiyonlar

### Tasarım sistemi (2026-04-25 redesign)
- **Tema**: yalnız dark — `prefers-color-scheme:light` kaldırıldı.
- **Renk tokenleri** (`:root`):
  - `--bg #000` / `--bg2 #0c0c0c` / `--bg3 #141414` / `--bg4 #1c1c1c` (4 katman)
  - `--text #f0ede8` (sıcak beyaz), `--text2 #b8b8b8` (~11:1 contrast — AA passing), `--text3 #888888` (~5:1 — AA Large)
  - `--info #6658ff` (mor brand), `--ok #00d97e`, `--err #ff3366`, `--warn #ffb800`
  - `--border rgba(255,255,255,0.06)` — hat kullanımı için 1px solid (eski 0.5px değil)
- **Tipografi**: Google Fonts `DM Sans` (300-700 body) + `DM Mono` (400/500 sayılar/ticker).
- **Mikro etiketler**: `.lbl`, `.stitle`, `.kk` 10px uppercase + `font-weight:500` (küçük boyutta okunabilirlik için weight bumped).
- **Aktif sekme**: pill (soft mor bg `rgba(102,88,255,0.12)` + text), alt çizgi yok.
- **FAB mobile**: 54px daire, `var(--info)` mor, mor shadow, sağ alt sabit (`bottom:76px`).

### Para & formatlama
- USD → `$`, TRY → `₺`, EUR → `€` (`displaySym(cur)` helper)
- `fmt(n, d=2)`, `fmtD(n)` (±$ — sadece USD), `fmtSign(n, sym)` (currency-aware ±sym), `fmtP(n)` (±%), `fmtShares(n)` adet için
- Gizli mod (`hide` state): `mask()` ile tüm tutarları `••••`
- **Display Currency**: Topbar toggle ile $ veya ₺. Dashboard KPI + Pie + Analiz convert; pozisyon tablosu blokları kendi natural currency'sinde. Bkz. "FX (Currency Conversion)" bölümü.

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
- `.warn-card` — turuncu uyarı kartı (ör. "fiyat yok", "yetersiz veri", FMP `OUT_OF_PLAN`)
- `.pos-row` — clickable tablo satırı (hover bg değişimi, history'ye yönlendirir)
- `.badge.etf`/`.badge.cry`/`.badge.split` — ticker rozetleri (split: ⚡ ×N)
- `.mdl-bd`/`.mdl-bx` — özel confirm modal
- `.seg` — segmented control (toggle); pie chart Maliyet/Piyasa
- `.mtab` — mode tab (AddTab text/image/csv/manuel + AnalysisTab + AddTab type picker filter chip aynı pattern)
- `.pie-row`/`.pie-sw` — pie chart legend rows. Layout: flex; çocuk genişliği `flex:"0 0 70px"` ($) + `flex:"0 0 56px"` (%) sabit (önceki `minWidth` content overflow'da kayardı; bkz. Gotchas)
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

1. **Mount**: `loadData` `price_cache` SELECT eder → `hist`/`prc` state'ine yazar (hızlı chart)
2. **Auto-fetch**: `pos` değiştiğinde cache'te eksik ticker varsa arka planda `fetchHist(missing)` tetiklenir
3. **Yazma**: her başarılı `fetch-prices` sonucu edge function **service_role** ile `price_cache`'e upsert eder (Sprint 5 — frontend write kaldırıldı, backfill kaldırıldı)
4. **Cron**: `refresh-price-cache` her 6 saatte bir en stale 5 ticker'ı tazeler; `CRON_SECRET` Bearer header ile korunuyor (Sprint 4)

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
- **İş Yatırım MaliTablo** — BIST fundamentals (Faz 5b, 2026-04-25 entegre). `?companyCode=THYAO&exchange=TRY&financialGroup=XI_29&yearN=&periodN=` formatında 147-row tam finansal veri (bilanço + gelir + nakit). 4 yıl/call kolon kapasitesi → 5Y CAGR için 2 paralel call. 21-metrik checklist'in 19'u itemCode mapping ile derive (PE/PS pending). Bankalar (UFRS) henüz desteklenmiyor.

### Search Tab Ticker DB

`fetch-fundamentals` mode:`"ticker-list"` SEC EDGAR + Twelve Data /stocks XIST listesini birleştirir (~10.984 entry: 10.348 US + 636 BIST). Module-level cache 24h TTL. Frontend LS cache 24h. Her entry: `{ticker, name, exchange: "US"|"XIST"}`.

## Currency Handling

- BIST → TRY (₺), US/global → USD ($), bazı pozisyonlar EUR (€).
- TickerDetailTab içinde `effectiveType = p?.type ?? assetTypeHint ?? "US_STOCK"`; `displayCurrency = p?.currency ?? (effectiveType==="BIST" ? "TRY" : "USD")`; `sym = ₺/€/$`.
- Pozisyon kartları (g4: Maliyet/MV/P&L), detay satırı (Realized/Unrealized/Komisyon), header price hepsi `sym` kullanır.
- Manuel form: type=BIST seçilince currency otomatik TRY (set ediliyor onChange'de).
- Storage: `transactions.price` ve `positions.avg_cost` ham değer (kullanıcının para birimi); `currency` field ayrıca tutuluyor.
- Ön-sıralama / total: TRY bloku ayrıca özet kartlarda gösteriliyor; **portföy toplamında USD'ye fx conversion henüz yok** (ROADMAP).

## Fundamental Veri (FMP + EDGAR + İş Yatırım)

- **US (US_STOCK / FUND held)**:
  - Primary: Financial Modeling Prep — secret `FMP_KEY`.
  - Fallback: SEC EDGAR — FMP "Special Endpoint" 402 (NOW/MNSO/NNOX gibi out-of-plan ticker'lar) gelirse otomatik düşer. Ücretsiz, sınırsız, tüm SEC dosyalayıcılarını kapsar.
- **BIST (`asset_type:"BIST"`)**: İş Yatırım MaliTablo — public auth-free; XI_29 (sektörel konsolide olmayan) industrial mapping. Bankalar (UFRS, Roman numeral itemCode'lar) henüz desteklenmiyor — known-bank set ile early-exit.
- **Endpoint'ler**:
  - FMP **`/stable/`** API (Aug 2025'te `/api/v3` legacy oldu). `?symbol=AAPL` query param. Response şeması legacy ile aynı: `key-metrics-ttm`, `ratios-ttm`, `income-statement` (5Y annual), `balance-sheet-statement` (1Y), `cash-flow-statement` (1Y).
  - EDGAR `data.sec.gov/api/xbrl/companyfacts/CIK*.json` — User-Agent header zorunlu.
  - İş Yatırım `https://www.isyatirim.com.tr/_layouts/15/IsYatirim.Website/Common/Data.aspx/MaliTablo?companyCode=THYAO&exchange=TRY&financialGroup=XI_29&year1..year4&period1..period4=12`. Browser-style header'lar (UA + `X-Requested-With: XMLHttpRequest`) zorunlu. Yıl başına 4 kolon → 5Y CAGR için 2 paralel call (Y..Y-3 + Y-4..Y-7).
- **21 metrik**: gelir/kâr 5Y CAGR, 4 marj (gross/op/net/FCF), ROE/ROA/ROIC, gider rasyoları (SG&A, D&A, faiz), bilanço (yük/özk, birikmiş kâr/özk), faiz karşılama, net borç/FCF, CapEx (3 oran), P/E, P/S.
- **EDGAR mode kısıtı**: P/E ve P/S null kalır (market price gerek). Diğer 19 metrik us-gaap line item'larından derive edilir.
- **İş Yatırım mode kısıtı**: P/E null (frontend `meta.pe_ratio` borsa-mcp profile'dan inject eder); P/S null (market_cap/revenue ileride). Bankalar known-bank set ile blocklu.
- **EDGAR FY anchoring**: `NetIncomeLoss`'un en yeni fy'si anchor → tüm metrikler aynı fy'den okunur (cross-year karışma yok). ASC 606 gibi taxonomy migration'larda freshest-concept stratejisi (`Revenues` vs `RevenueFromContractWith...`).
- **İş Yatırım anchor**: `thisYear-1 → thisYear-2` probe; `3C` (Net Sales) value1 dolu olan ilk yıl seçilir. `XI_29` itemCode mapping ile (3C=revenue, 3D=grossProfit, 3DF=operatingIncome, 3L=netIncome, 1BL=totalAssets, 2N=equity, 2OCE=retained, 4B=D&A, 4C=OCF, 4CAI=capex, 4CB=FCF…). itemDescTr/Eng yerine itemCode kullanır → text varyasyonlarına bağışık.
- **Source badge**: response'da `source: "fmp"|"edgar"|"isyatirim"` döner; TickerDetailTab başlığında küçük rozet.
- **Renk kodlaması**: top-level `FUND_THRESHOLDS` tablosunda her metriğin `good`/`ok` eşikleri var; `fundScore(key,val)` → `good`/`neutral`/`bad`. UI'da pill renkler.
- **Cache**: LS `fund_${ticker}` (7 gün TTL); BIST için ayrıca edge function instance-lifetime Map (6h TTL).
- **Kapsam**: `US_STOCK` (held + non-held discovery) + `BIST` (held + non-held discovery, banka hariç) için aktif. FUND/CRYPTO/GOLD'da bölüm hidden.

## Analiz Tab (Portföy Analizi, 2026-04-25)

Sticky pos.3 nav sekmesi (Dashboard | İşlemler | **Analiz** | Ara | Ayarlar). 7 kart, hepsi mevcut tasarım sistemiyle (`.card`, `.pie-row`, `.lbl`, `.stitle`):

1. **Varlık Dağılımı** (filter chip ile)
   - Filter chip `.mtab`: `Genel · US Hisse · BIST · ...` (sadece pozisyonu olan tipler dinamik)
   - Genel mode: type breakdown (Dashboard pie ile aynı veri)
   - Type-spesifik mode: o tipin altındaki ticker breakdown
   - Currency: BIST filter → `₺`, US/diğer → `$`, Genel mixed → `$` (FX conversion ROADMAP'te)
   - Filter sadece **bu kart**ı etkiler — diğer kartlar sabit

2. **Bölge Dağılımı**
   - Heuristik: `REGION_OF` map → `us` (US_STOCK + FUND), `tr` (BIST), `crypto` (CRYPTO), `emtia` (GOLD), `fx` (FX)
   - Pie + legend, footnote'ta heuristik açıklaması
   - **Bilinen kısıt**: ETF underlying (MCHI=Çin gibi) yok; FUND default US

3. **Toplam Komisyon**
   - Currency başına KPI: `byCurrency` aggregate (₺/$/€ ayrı büyük sayı)
   - **Broker bazında** horizontal bar (`broker × currency` sum, sorted desc)
   - **Yıl bazında** horizontal bar (year ascending)
   - Multi-currency satırı `"$5.62 + ₺0.10"` formatında join

4. **Kazanan/Kaybeden Trade** — BUY ve SELL bağımsız, **split-adjusted**
   - Per-tx: `adj = tx.price / factorAt(ticker, tx.date)` (yerel `factorAt` rebuildPositions ile aynı mantık)
   - BUY win: `currentPrice > adj_buy_price` (giriş zamanlaması)
   - SELL win: `currentPrice < adj_sell_price` (iyi exit, satış pişmanlığı yok)
   - 2 stacked horizontal bar (yeşil/kırmızı), `X/Y · %Z` readout
   - **noPrice sayım dışı**: `prc[ticker]` yoksa (sold-out + cache'te yok) o tx atlanır, küçük not gösterilir
   - **Bilinen kısıt**: time horizon = bugünkü fiyat (1A/3A/6A window seçimi ROADMAP)

5. **Portföy Sağlık Tablosu** — 8 metrik renk pill (P/E, ROE, Net/Op Marj, Gelir/Kâr 5Y, Borç/Özk, NetBorç/FCF); default kapalı + 3 rozet (🟢/🟡/🔴 aggregate) + Detay ▾; "Eksikleri Çek" CTA; satır click → openDetail

6. **Konsantrasyon Riski** (Sprint 4) — Top 3 pozisyon ağırlığı + renk pill (>%60 kırmızı / %40-60 sarı / <=%40 yeşil); HHI basit versiyonu (Σwi²×10000); yatay bar chart. Tamamen frontend hesabı.

7. **Sektör Dağılımı** (Sprint 5) — `metaCacheGet(ticker)?.sic_description || .industry` ile sektör grupları; pie + legend; `SECTOR_COLORS` 10-renk; "Meta Çek" butonu (US/BIST/FUND için, CRYPTO/GOLD/FX hariç); `sectorMetaTick` state ile fetch sonrası reaktif re-render. Yeni API yok — mevcut meta cache okur.

## Search Tab (global ticker arama)

- **Veri kaynağı**: SEC EDGAR `company_tickers.json` (~10.348 US) + Twelve Data /stocks XIST (~636 BIST) merged.
- **Proxy**: Edge function `fetch-fundamentals` `mode:"ticker-list"` (browser SEC'e doğrudan fetch yapamaz, User-Agent zorunluluğu).
- **Cache**: LS `sec_ticker_db_v2` (24 saat TTL); ilk Ara sekmesi açılışında lazy fetch. Key `_v2` çünkü v1 BIST eklenmeden önce yazılan US-only cache'leri invalidate etmek gerekti (BIMAS bug 2026-04-25).
- **Match**: ticker prefix (büyük harf) + şirket adı substring (case-insensitive).
- **Render**: 2 bölüm — "Portföyünden" (held + geçmiş işlem ticker'ları, "açık" badge) + "Tüm hisseler" (max 50 sonuç). Click → `openDetail(ticker)`.
- **Discovery mode (non-held)**: TickerDetailTab `!p` durumunda position summary kartlarını gizler; `YOK` badge + turuncu warn-card + meta + fundamental + "+ Ekle" CTA gösterir. Live price `fetch-prices` ile auto-fetch edilir.

## Ölçeklenme Notları

- `price_cache` write policy Sprint 5'te service_role'a daraltıldı — frontend artık read-only, tüm write `fetch-prices` edge function üstünden service_role ile.
- `parse-transaction` günlük 20 çağrı/kullanıcı limiti var (`increment_parse_calls` RPC, Sprint 5); frontend `edgeCallAuth` ile JWT gönderir, edge fn kimliği verify eder.
- Auto-fetch on mount: çok user'da rate limit'i zorlar — opt-in'e çevirmek gerekebilir.
- Detay: ROADMAP.md "Ölçeklenme & Mass Kullanım" bölümü.

## Gotchas

- Supabase secret adları `SUPABASE_` ile başlayamaz (platform otomatik sağlar): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` zaten edge function runtime'da var.
- `cron.job_run_details` tablosunda `jobname` kolonu **yok** — `jobid` ile `cron.job`'a join gerekir.
- `transactions.way` CHECK kısıtı `ANY(ARRAY['BUY','SELL','DIV'])` (003_div_way.sql ile güncellendi). `DIV` artık resmi olarak destekleniyor.
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
- **İş Yatırım MaliTablo parametreleri**: `financialGroup=XI_KONSOL` GEÇERSİZ; doğru: `XI_29`, `UFRS`, veya `UFRS_K`. `exchange=TRY` (boş bırakma — `value:[]` döner). `period`: 3/6/9/12 (Q1/H1/9M/Yıllık cumulative). Endpoint browser-style header (UA + `X-Requested-With: XMLHttpRequest`) ister; yoksa SharePoint hata sayfası HTML'i döner.
- **BIST fundamentals XI_29 kısıtı**: Bankalar/sigorta UFRS grubu ve Roman numeral itemCode'lar (I., VI., XVI.) kullanır — XI_29 mapping (3C, 1BL, 2N…) onlara uymaz. `ISY_KNOWN_BANKS` set ile early-exit (GARAN/AKBNK/YKBNK/ISCTR/HALKB/VAKBN/ALBRK/QNBFB/TSKB/ICBCT/SKBNK). UFRS support eklenince set boşaltılır.
- **BIST fundamentals enflasyon notu**: TRY tutarlar nominal; revenueGrowth5Y/earningsGrowth5Y eşikleri (≥10% iyi) TR enflasyonuyla otomatik karşılanır → metrik yanıltıcı. Sektör-aware + reel büyüme eşiği ROADMAP'te.
- **FMP "Special Endpoint" 402**: NOW gibi mid-cap'ler FMP free tier'a kapalı; edge function otomatik EDGAR'a düşer. EDGAR mode'unda P/E ve P/S null kalır (price gerek).
- **fetch-prices weekend**: Cumartesi/Pazar tarihleri için 403; AI parse autofill'inde önce date-spesifik dener, fail olursa `mode:price` (no date) ile latest close'a fallback yapar.
- **AI parse response shape**: edge function her zaman `{transactions:[...]}` array döner (multi-line + tek işlem hep array). Eski tek-obje format için FE side'da `Array.isArray(d.transactions) ? ... : (d.ticker ? [d] : [])` guard'ı var.
- **localStorage scope**: `il_hide`/`il_prc`/`il_hist` user-agnostic; signOut handler bunları temizler. `fund_*`, `meta_*`, `sec_ticker_db` public market data, user-bound değil.
- **SearchTab → TickerDetailTab non-held flow**: detail page `pos.find(...)` boş dönerse "discovery mode" — pozisyon kartları gizli, YOK badge + warn-card aktif. Yeni eklenen `+ Ekle` flow rebuildPositions sonrası held mode'a otomatik geçer.
- **`.pie-row` kolon hizalama**: `display:flex` ile çocuk span'lara `flex:"0 0 70px"` ($) ve `flex:"0 0 56px"` (%) sabit basis ver — `minWidth` koymak yetmez, content > minWidth olunca o satırın % col'u genişler ve $ col'u o satırda kayar (Toplam $3,446 vs legend $1,310 8-15px spread olur). Label `flex:1, minWidth:0` (truncate KULLANMA — `overflow:hidden + ellipsis` "Hi…/ET…" regression yapar). Bu çözüm Dashboard pie + Analiz Varlık + Analiz Bölge pie'larında uygulanmalı.
- **Test-runner agent yetkisi**: `Write` toollu olduğu için kod yazabilir; **read-only mode'u explicit talimatla zorla** ("DO NOT modify any source files. If you find issues, REPORT them — do not fix yourself"). Aksi halde bug fix'leri kendi yapıp regression yaratabilir (ör. label truncation eklemesi 2026-04-25).
- **`rebuildPositions` unit snapshot**: `rebuildPositions` tüm pozisyonları DELETE edip yeniden insert eder. Önce `SELECT ticker, unit FROM positions WHERE user_id=...` ile `unitMap` snapshot'ı al; np map içinde `unit: unitMap[p.ticker] ?? null` ile restore et. Aksi halde rebuild sonrası tüm altın pozisyonları unit kaybeder ve oz olarak yanlış görünür.
- **Edge function CORS**: Tüm 4 edge fn `"Access-Control-Allow-Origin": "https://canmrtr.github.io"` ile kilitli (eski `"*"` değil). Yeni edge fn eklenince aynı şekilde lock yapılmalı. Supabase Dashboard CORS ayarı değil, response header'dan kontrol edilir.
- **Supabase CLI**: `npx supabase link --project-ref jfetubcilmuthpddkodg` ile bağlı. Edge fn deploy: `supabase/functions/<fn-name>/index.ts` yapısı gerekli (`.js` + rename). `npx supabase functions deploy <fn-name> --no-verify-jwt`. `db query --linked --query "SELECT..."` ile schema sorgusu.
- **`p.currency` vs price_cache currency**: `prc[ticker]` değerleri her zaman BIST→TRY (Yahoo), diğer→USD (Massive) döner — `p.currency` ile aynı olmak zorunda değil (AI-parse hatası, stale data). MV hesaplarken (`mvDisp`, `allDisp`) `p.type==="BIST"?"TRY":"USD"` kullan; cost hesaplarken `p.currency` doğru (avg_cost o currency'de saklanır). `rebuildPositions` normCur ile yeni kayıtlar her zaman doğru currency alır ama eski DB verileri için bu ayrım önemli.
- **`.fbar` filter chip bar**: `flex:1;min-width:70px` olan `.mtab`'ı içeren wrapper'da asla `flexWrap:"wrap"` kullanma — mobile'da çok satıra açılır. `.fbar` CSS sınıfı kullan: `overflow-x:auto; scrollbar-width:none; -webkit-overflow-scrolling:touch`. `.fbar .mtab` override: `flex:0 0 auto; white-space:nowrap`.

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
- ✅ Fundamentals (FMP 21-metric checklist + EDGAR fallback + İş Yatırım BIST)
- ✅ Search tab (~11k ticker: 10.348 SEC US + 636 Twelve Data BIST)
- ✅ Multi-line AI parse, weekend price fallback, manuel date-price autofill
- ✅ Major redesign (DM Sans/Mono, dark palette, top navbar + bottom tabs + FAB)
- ✅ **BIST entegrasyonu (Faz 1-5a)** — Yahoo Finance price/historical, Twelve Data /stocks DB, borsa-mcp profile, currency-aware display, manuel ekleme + search + non-held discovery
- ✅ **BIST Faz 5b** (2026-04-25) — İş Yatırım MaliTablo XI_29 mapping ile 19/21-metrik fundamentals checklist (PE meta-inject, PS pending). Bankalar known-set ile blocklu, 6h server cache, ticker whitelist.
- ✅ **Asset type picker** (2026-04-25) — AddTab açılışında 6-kart picker (US/BIST/FUND/CRYPTO/GOLD/FX), ManuelPosForm `prefillType` prop ile type+currency pre-fill
- ✅ **Mikro UX fix bundle** (2026-04-25) — Input maxLength (username 20 / search 64), Web row null guard, FMP `OUT_OF_PLAN` warn-card, TickerDetailTab effectiveType useEffect deps
- ✅ **Kontrast + pie alignment polish** (2026-04-25) — `--text2 #b8b8b8 + font-weight:500` (3.66 → 11.4 contrast), pie row `flex:0 0 70/56px` (kolon hizalama bug fix)
- ✅ **Analiz Tab** (2026-04-25, Sprint 1+2) — yeni "Analiz" sekmesi (nav pos.3, pie icon), 4 kart: Varlık (filtreli) + Bölge (heuristik) + Komisyon (broker × yıl) + Win/Loss (BUY+SELL bağımsız split-adjusted). 55/55 test PASS.
- ✅ **FX conversion + global currency toggle** (2026-04-26) — Topbar `$ ₺` segmented (`displayCur` LS persist), Frankfurter API rates (`api.frankfurter.dev/v1/latest`), `convert(amt,from,to,fx)` USD↔TRY↔EUR helper. Dashboard KPI + Sparkline + Pie + Analiz 3 kartı tüm pozisyonları display cur'a convert; **Bölge bug fix** (BIST TRY artık doğru topluyor); TRY pozisyon tablosu price-aware; FX yok warn-card.
- ✅ **UI Quick Wins + 2-day cleanup + Hardening** (2026-04-26) — title→data-tip migration (14 yer); confirm modal danger=true autoFocus cancel + Enter koruması; HistoryTab edit form'a komisyon input; AddTab tip picker `.pick-card` CSS hover (anti-pattern düzeltildi); USD tablo fmtD→fmtSign; tüm `<th scope="col">`; TickerDetailTab navigation `fromTab` (Search/History'den geri doğru tab); detail'de bottom-tabs/topbar fromTab vurgusu; FAB context-aware (custom event "il-detail-add", Search input focus, Settings'te gizli); Settings inline test response + FX kuru durumu satırı; Eye `aria-pressed` + logo `aria-label`; AddTxInline `assetType` prop; Manuel form notu; `meta.list_date` fmtDateTR; CDN SRI pin (supabase-js@2.104.1 + React/ReactDOM 18.2.0 + Babel 7.23.2 sha384); `sanitizeMeta` 5KB cap; `_tickerDbMem` LS quota fallback.
- ✅ **Crypto MVP** (2026-04-26) — Edge function CRYPTO ticker normalize (BTC/eth/BTC-USD/BTC/USDT → `X:{BASE}USD`); `split(/[-_/]/)[0]` quote currency strip; empty/over-length guard. ManuelPosForm `CRYPTO_SYMBOLS` chip picker (12 popüler). Dashboard fetch filter'larına CRYPTO eklendi.
- ✅ **Gold MVP** (2026-04-26, ons & USD) — Edge function GOLD normalize (XAU/XAG/XPT/XPD + Türkçe ad → `C:{SYM}USD`). `COMMODITY_SYMBOLS` chip picker (4 emtia). Dashboard fetch filter'larına GOLD dahil. **Gram + TRY display + işçilik premium** ROADMAP'te (schema unit kolonu sonraki sprint).
- ✅ **AnalysisTab Portföy Sağlık Tablosu** (2026-04-26) — 5. kart, 8 metrik renk pill (P/E, ROE, Net/Op Marj, Gelir/Kâr 5Y, Borç/Özk, NetBorç/FCF) + Skor; sticky ticker + horizontal scroll; "Eksikleri Çek" CTA + sıralı fetch + progress; default kapalı + 3 rozet (🟢/🟡/🔴 aggregate sayım) + Detay ▾ toggle; satır click → openDetail.
- ✅ **AnalysisTab Komisyon kartı collapsible** (2026-04-26) — KPI üstte sabit + Detay ▾; Broker/Yıl breakdown sadece commOpen iken render.
- ✅ **Dashboard varlık türü gruplaması** (2026-04-26) — Currency-bazlı USD/TRY/EUR blok yerine `BLOCK_TYPES` config ile 6 type-bazlı blok (US Hisse · ETF · BIST · Kripto · Altın · Döviz) + EUR cost-only ayrı blok. Her blok kendi natural currency sembolü, sort state ortak.
- ✅ **`fetchPrice` weekend & inline uyarı** (2026-04-26) — ManuelPosForm fetchPrice'a `priceNote` state ile persistent inline kart (ok/warn/err). Tarih için veri yoksa otomatik latest close fallback + sarı warn-card "⚠ X tarihi için veri yok — Y kapanışı kullanıldı".
- ✅ **Sprint 3: Veri girişi güvenilirliği + TR Altın birimleri MVP** (2026-04-27) — `step="any"` ondalık adet; form inline validation (`aria-invalid` + error text); backdrop click guard; TR altın birimleri MVP (`positions.unit` + `GOLD_UNITS` + birim picker 6 unit + Dashboard back-conversion); Piyasa Değeri mobil full-width; ↻ Güncelle otomatik (30dk + visibilitychange) + Settings manuel; CORS lockdown 4 edge fn; EDGAR UA email fix; `rebuildPositions` unit snapshot fix.
- ✅ **Dark/Light tema desteği** (2026-04-26) — `[data-theme="light"]` CSS tokens; `applyTheme()` + `matchMedia`; Settings "Görünüm" 3-button segmented; LS `il_theme` persist.
- ✅ **Touch tooltip** (2026-04-26) — `data-tip` mobil tap-to-show: global `touchstart` listener, `data-tip-visible` CSS class, 2500ms auto-dismiss, button/a skip.
- ✅ **Tarihsel fundamental trend** (2026-04-26) — 5Y gelir/net kâr SVG bar chart (`TrendMiniChart`); edge fn FMP + BIST annual array.
- ✅ **Sprint 4: Güvenlik hızlı kazanımlar + UX** (2026-04-27) — refresh-price-cache CRON_SECRET (XOR constant-time compare, fail-closed); massiveHistorical + yfHistorical explicit `{error:…}` flag (sessiz {} bitti); AddTxInline + saveAI + saveTx NaN/negative guard; CSV `shares≤0 || !isFinite || price<0` skip + console.warn; Dashboard varsayılan sıra P&L% azalan (`sortPos` null-safe `-Infinity` fallback); Konsantrasyon Riski kartı (top-3 ağırlık + HHI + renk pill).
- ✅ **Sprint 5: price_cache write-lock + benchmark karşılaştırması** (2026-04-27) — price_cache RLS write policy kaldırıldı (service_role only); `fetch-prices` service_role upsert; frontend backfill + fetchHist client upsert kaldırıldı; `BENCHMARKS` constant (SPY + XU100); Dashboard benchmark getiri bölümü seçili period için; `benchTypeMap` fetchHist'e eklendi.
- ✅ **Sprint 5 devam: Parse rate limiting + Sektör Dağılımı** (2026-04-27) — `parse-transaction` JWT-verified identity (`edgeCallAuth` + `auth.getUser(token)`); `increment_parse_calls` PL/pgSQL RPC (TOCTOU-safe atomic increment); 20 parse/gün/kullanıcı; 401 unauthenticated için; image type/size validation; max_tokens 800→1200; `profiles.parse_calls_today/date` migration. AnalysisTab 7. kart: Sektör Dağılımı (SIC/borsa-mcp industry; pie + legend; "Meta Çek" CTA; SECTOR_COLORS palette).
- ✅ **Global varlık türü filtresi + mobile chip bar** (2026-04-27) — Dashboard `dashTypeFilter` + AnalysisTab `activeTypes` multi-select; `.fbar` CSS sınıfı (yatay kaydırmalı, `overflow-x:auto`, `scrollbar-width:none`, touch-friendly); `flexWrap:"wrap"` kaldırıldı; `BLOCK_TYPES.filter` type-only (currency check kaldırıldı); AnalysisTab per-card Varlık Dağılımı filtre kaldırıldı.
- ✅ **Kripto/non-BIST market value currency bug fix** (2026-04-27) — `mvDisp` ve `allDisp` artık `priceCur = p.type==="BIST"?"TRY":"USD"` kullanıyor (price_cache: BIST→TRY Yahoo, diğer→USD Massive). `p.currency` stale TRY iken BTC=$18 görünümü düzeltildi. `rebuildPositions` normCur: `BIST→TRY`, `EUR→EUR`, diğer→`USD`. HistoryTab tüm `"$"` hardcode → `displaySym(currency)`.
- ✅ **Sprint 6 Milestone A+B** (2026-04-29) — Sektör Dağılımı: AnalysisTab mount useEffect auto-fetch + CRYPTO/GOLD/FX/FUND tip bazlı fallback. Period buton wrap: `.fbar` scrollable. Başa Baş Analizi: AnalysisTab kart 7 (komisyon dahil break-even + distPct%). Potansiyel Kayıp Simülasyonu: AnalysisTab kart 8 (%10/20/30 senaryo bar).
- ✅ **Social Portfolios Faz 1 — Altyapı** (2026-04-29) — `portfolios` tablosu (`id, user_id, name, is_public, privacy_level, created_at, updated_at`); `follows` (follower_id/following_id PK + CHECK self-follow); `portfolio_activities` (buy/sell/position_add/position_remove); `positions`/`transactions`/`splits` tablolarına `portfolio_id UUID NOT NULL` FK (`ON DELETE RESTRICT`); mevcut kullanıcılar için "Ana Portföy" backfill migration (001_portfolios_faz1.sql, Supabase'e apply edildi). RLS: `auth.uid() IS NOT NULL` tüm public read policy'lerinde; `follows` FOR ALL → INSERT + DELETE split (UPDATE vektörü yok); partial index `portfolios(id) WHERE is_public = TRUE`. Frontend: `rebuildPositions(userId, portfolioId)` portfolio-scoped; `loadData` portfolios fetch + `activePortfolioId` LS sync; `AddTxInline`/`TickerDetailTab`/`HistoryTab`/`AddTab`/`ManuelPosForm`/`ManuelPosForm` bileşenlerine `portfolioId` prop threading; tüm transaction/position insert'lerine `portfolio_id` eklendi.
- ✅ **Sprint 7: Güvenlik sertleştirme** (2026-04-29) — `parse-transaction` edge fn sunucu tarafında JWT doğrulama (`auth.getUser(token)`) + `increment_parse_calls` RPC; RLS hardening migration `002_rls_fixes.sql` (positions_public_read privacy_level filtresi, positions/transactions/splits owner policy portfolio_id sahiplik subquery, activities_owner_insert cross-portfolio zehirleme kapatıldı, portfolios_owner_all → 4 per-command policy, splits RLS enable); fetch-prices ticker validation regex; tüm edge fn `Access-Control-Allow-Methods` header eklendi.
- ✅ **Dividend (DIV) işlem takibi** (2026-04-29) — `transactions.way` CHECK kısıtı `['BUY','SELL','DIV']` (003_div_way.sql); Dashboard Total Return'e temettü cashflow dahil; XIRR cashflow'u `DIV = +total` (komisyon çıkarılmaz); HistoryTab grup net hesabı DIV pozitif; CSV allowlist güncellendi; way dropdownlarına "Temettü" seçeneği.
- ✅ **Risk Dashboard — 3 yeni AnalysisTab kartı** (2026-04-29) — Dönem Bazlı Getiri (MV-ağırlıklı 1G/1H/1A/3A/6A/1Y portföy + benchmark SPY/XU100); FX Risk (USD/EUR/TRY dağılım bar + USDTRY +10% simülasyon); 6 Aylık Performans (p_m6 bazlı en iyi/en kötü 3 + ağırlıklı portföy getirisi).
- ✅ **Sprint 8: Temettü Getiri Projeksiyonu** (2026-04-29) — TickerDetailTab "Temettü Geliri" kartı genişletildi: tahmini yıllık gelir (≥2 div tx'ten), maliyete getiri %, cari getiri %; AnalysisTab yeni "Temettü Özeti" kartı: toplam gelir KPI + portföy verimi + top-5 ödeyici bar chart (sadece DIV tx varken görünür).
- ✅ **UX polish bundle** (2026-04-29) — AddTxInline manuel form'a "Not" input alanı; `notes` artık "Detay sayfasından" hardcode yerine kullanıcıdan alınıyor; broker `maxLength={50}` (AddTxInline/HistoryTab×2/ManuelPosForm), ticker `maxLength={20}`, name `maxLength={100}` (ManuelPosForm).
- ✅ **AnalysisTab pie kartları yeniden tasarlandı** (2026-04-29) — Varlık Dağılımı, Bölge Dağılımı, Sektör Dağılımı: pie üstte ortalı (140×140), legend tam genişlikte altında; her kart ▴/▾ toggle ile collapsible; kapalı halde özet satır (tür sayısı + toplam).
- ✅ **Dashboard ETF/₿ rozetleri kaldırıldı** (2026-04-29) — Pozisyon satırlarındaki ETF ve kripto rozetleri gereksiz gürültü yarattığı için kaldırıldı. Rozetler TickerDetailTab ve SearchTab'da korunuyor.
- ✅ **Sprint 9 Milestone A: AnalysisTab analitik kartlar** (2026-04-29) — Portföy F/K KPI (Sağlık Tablosu kartına eklendi, ağırlıklı ortalama); CAGR Tablosu (5Y gelir + kâr büyüme + CAGR satırları, collapsible); Dayanıklılık Skoru (liabToEquity + fcfMargin + operatingMargin → 1-10 puan, renk pill, held tüm pozisyonlar + missings CTA).
- ✅ **Sprint 9: AnalysisTab pie → stacked horizontal bar** (2026-04-29) — Varlık Dağılımı, Bölge Dağılımı, Sektör Dağılımı kartlarındaki SVG pie kaldırıldı; yerine tek satır yatay stacked bar (her dilim `data-tip` tooltip'li). Bar her zaman görünür; legend/liste collapsible (▴/▾). `buildSlicesPath` dead call'ları temizlendi.
- ✅ **Sprint 9: Dashboard sticky filter chips** (2026-04-29) — Varlık türü filtre bar'ı `position:sticky; top:52px; z-index:90` ile topbar'ın hemen altına sabitlendi; scroll'da kayma yok. Background `var(--bg)` ile içerik üstüne kapama.
- ✅ **Sprint 9 Milestone B: Social Portfolios Faz 2** (2026-04-29) — Settings'e "Portföy Gizliliği" kartı (is_public toggle + privacy_level + paylaş butonu → `?portfolio=<uuid>` URL). `profiles` biyografi/avatar/is_profile_public düzenleme (AccountSection içi UserProfileModal). Public portfolio read-only view (`tab==="publicview"`, `?portfolio=` URL param, allocation % bar, sahip badge). Migration `004_social_faz2_rls.sql` (profiles_public_read + follows_public_count AND guard + profiles backfill FALSE).
- ✅ **Sprint 9 Milestone C: PWA + küçük düzeltmeler** (2026-04-29) — `manifest.json` (standalone, #6658ff theme, 192+512 icon placeholder); `service-worker.js` (shell cache-first, API network-first, offline fallback); SW registration `load` event; `<meta theme-color>` + `apple-touch-icon` head tag'leri. `fetch-fundamentals` edge fn `AbortSignal.timeout(8000)`. signOut LS cleanup `il_recent_search` eklendi.
- ✅ **Sprint 9: P1 bug fix bundle** (2026-04-29) — BreakEven `p.avg_cost` → `p.avgCost` (wrapPos camelCase mapping, tüm değerler NaN'dı); AddTxInline total preview hardcoded `$` → `displaySym(effCur)` (TRY işlemlerde yanlış sembol); BreakEven tablo `var(--mono)` → `'DM Mono',monospace` (CSS değişkeni yok); CSV skip + fetchHist `console.warn` → `DEBUG &&` gate (güvenlik audit LOW).

- ✅ **Altyapı & Ölçekleme sprint** (2026-04-29) — `refresh-price-cache` tüm asset_type desteği (BIST Yahoo, CRYPTO/GOLD/FX Massive normalize, ticker URL injection koruması, BIST 1s delay); `ticker_db` Supabase tablosu (005_ticker_db.sql, 10.980 satır initial sync, haftalık pg_cron `sync-ticker-db-weekly`); `fetch-fundamentals` mode:"sync-ticker-db" + getTickerDb/getBistList AbortSignal.timeout; frontend SearchTab Supabase SELECT'e geçti; `İş Yatırım` isyFetch AbortSignal.timeout(8000); `icon-192.png` + `icon-512.png` geçerli PNG.

Açık başlıklar (detay için `ROADMAP.md`):
- **TR altın işçilik premium göstergesi** — Reşat/Ata birimi + Dashboard "Spot saf · Premium %" render
- **TEFAS entegrasyonu** — WAF cloud IP bloğu sorunu; Supabase edge function üstünden test bekleniyor
- **FX/GOLD ham ticker normalize** — edge function future-proofing
- **Sektör-aware fundamental eşikler** — tech P/E ≤30, utility ≤15 vs.
- **EDGAR + market price** — P/E ve P/S için CommonStockSharesOutstanding × current price
- **Social Portfolios Faz 3** — takip sistemi (follows UI), sosyal feed, risk profili
- **Watchlist & alarm** — izleme listesi + hedef fiyat bildirimi (ROADMAP.md detay)
- **Temettü takvimi** — FMP dividend-calendar mode + yaklaşan temettüler UI
