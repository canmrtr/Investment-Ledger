# Investment Ledger

Tek dosyalı React + Supabase kişisel yatırım takip uygulaması. Türkçe UI.

## Mimari

- **Frontend**: `index.html` — React 18 UMD + Babel Standalone (tarayıcıda JSX).
  Build adımı yok; CDN script'leri. GitHub Pages'e doğrudan deploy (`main` branch root).
  Live URL: `https://canmrtr.github.io/Investment-Ledger/`
- **Backend**: Supabase (auth, PostgreSQL, RLS, Edge Functions, pg_cron).
- **Edge Functions** (Supabase'te deploy'lu; kaynağı referans olarak repo'da):
  - `parse-transaction-edge-function.js` — Claude Haiku 4.5 ile metin/görüntü → işlem JSON
  - `fetch-prices-edge-function.js` — Massive.com (Polygon clone) güncel + tarihi fiyat
  - `refresh-price-cache-edge-function.js` — Scheduled (pg_cron 6h), `price_cache`'i stale-first batch ile tazeler
  - `fetch-fundamentals-edge-function.js` — Financial Modeling Prep (FMP) TTM + 5Y annual; 21 metrik value-investing checklist'e işler

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
Root → Login | App
  App
    ├─ Dashboard (IIFE)       — summary kartlar (TR + XIRR), pie chart,
    │                            SparkChart, pozisyon tablosu, TRY/EUR blokları
    ├─ HistoryTab             — filtre toolbar, accordion (ticker gruplu)
    ├─ AddTab                 — 4 mod: text/image/csv/manuel
    │   ├─ ConfirmBox         — parse sonucu onay
    │   └─ ManuelPosForm      — direkt pozisyon girişi
    └─ Settings
        ├─ Fiyat & Veri       — fetchPrices/Hist butonları
        ├─ Pozisyon Bakımı    — ♻️ rebuildPositions
        ├─ Export             — CSV
        ├─ AccountSection     — username + email + password değişimi
        └─ Sistem Durumu      — bağlantı/durum göstergeleri
```

Üst-level yardımcılar (top-level, App/Root dışı):
- `rebuildPositions(userId)` — split-aware
- `xirr(cashflows)` — Newton-Raphson IRR (yıllık return)
- `buildCashflows(txs, mvNow)` — XIRR için cash flow serisi
- `SparkChart` — küçük SVG portfolio değer grafiği
- `AccountSection` — Settings içinde Hesap formu

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

### Para & formatlama
- USD → `$`, TRY → `₺`, EUR → `€`
- `fmt(n, d=2)`, `fmtD(n)` (±$), `fmtP(n)` (±%) helperleri kullanılır
- Gizli mod (`hide` state): `mask()` ile tüm $ tutarları `••••`

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

## Massive.com (Polygon clone) Ticker Formatları

Test edilmiş — mevcut Stocks API key ile hepsi çalışır:

| Asset | Format | Örnek |
|-------|--------|-------|
| US hisse / ETF | direkt ticker | `AAPL`, `SPY`, `GLD` |
| Forex | `C:XXXYYY` | `C:USDTRY`, `C:EURUSD` |
| Crypto | `X:BTCUSD` | `X:BTCUSD`, `X:ETHUSD` |
| Spot altın | `C:XAUUSD` | (1 ons USD) |
| Bazı endeksler | `I:NDX` | (`I:SPX` premium tier) |

**Desteklenmiyor**: BIST hisseleri (THYAO, ASELS), TEFAS fonları → ROADMAP'te not edildi, alternatif provider gerek.

## Fundamental Veri (FMP)

- **Provider**: Financial Modeling Prep — secret `FMP_KEY` (edge function env'inde).
- **Endpoint'ler**: FMP **`/stable/`** API (Aug 2025'te `/api/v3` legacy oldu, yeni hesaplar göremez). Path yerine `?symbol=AAPL` query param. Response şeması legacy ile aynı.
  - `key-metrics-ttm`, `ratios-ttm`, `income-statement` (5Y annual), `balance-sheet-statement` (1Y), `cash-flow-statement` (1Y).
- **21 metrik**: gelir/kâr 5Y CAGR, 4 marj (gross/op/net/FCF), ROE/ROA/ROIC, gider rasyoları (SG&A, D&A, faiz), bilanço (yük/özk, birikmiş kâr/özk), faiz karşılama, net borç/FCF, CapEx (3 oran), P/E, P/S.
- **Renk kodlaması**: top-level `FUND_THRESHOLDS` tablosunda her metriğin `good`/`ok` eşikleri var; `fundScore(key,val)` → `good`/`neutral`/`bad`. UI'da yeşil/sarı/kırmızı sol-border + value rengi.
- **Cache**: LS `fund_${ticker}` (7 gün TTL) — fundamentals yavaş değişir, FMP rate limit dostu.
- **Kapsam**: sadece `US_STOCK` için gösterilir (FMP US-only). FUND/CRYPTO/BIST/GOLD'da bölüm hidden.
- **TickerDetailTab** içinde "Şirket Bilgisi" ile "İşlem Geçmişi" arasında render edilir; auto-fetch on mount + manuel ↻.

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

Detaylı liste için **`ROADMAP.md`** dosyasına bakın. Öne çıkan başlıklar:

- **Asset type genişletme**: BIST (alternatif provider gerek), altın (`C:XAUUSD` ile mümkün), TEFAS fonları, vadeli mevduat
- **Görselleştirme**: ✅ pie chart yapıldı; başka chart varyasyonları olabilir
- **Returns**: ✅ TR + XIRR (period-aware) yapıldı
- **Account**: ✅ password / email / username yapıldı
- **Sayfalar**: hisse detay sayfası, asset type başına ayrı sayfa
- **Fundamental + checklist**: provider seçimi açık (Polygon fundamentals, Alpha Vantage, yfinance)
- **Sosyal**: risk profili, anonim feed (privacy gerektirir)
- **Eğitim**: Investment Basics modülü (compound, diversification, ratios...)
