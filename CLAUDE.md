# Investment Ledger

Tek dosyalı React + Supabase kişisel yatırım takip uygulaması. Türkçe UI.

## Mimari

- **Frontend**: `index.html` — React 18 UMD + Babel Standalone (tarayıcıda JSX).
  Build adımı yok; CDN script'leri. GitHub Pages'e doğrudan deploy (main branch root).
- **Backend**: Supabase (auth, PostgreSQL, RLS, Edge Functions)
- **Edge Functions** (Supabase'te deploy'lu; kaynağı referans olarak repo'da):
  - `parse-transaction-edge-function.js` — Claude Haiku 4.5 ile metin/görüntü parse
  - `fetch-prices-edge-function.js` — Massive.com API (güncel + tarihi fiyat)
  - `refresh-price-cache-edge-function.js` — Scheduled (pg_cron her 6 saat), `price_cache`'i stale-first batch ile tazeler

## Supabase Şeması

| Tablo | Scope | İçerik |
|-------|-------|--------|
| `positions` | user-specific (RLS) | ticker, name, type, shares, avg_cost, currency, broker |
| `transactions` | user-specific (RLS) | BUY/SELL kayıtları (shares/price orijinal değerlerde) |
| `splits` | user-specific (RLS) | ticker, split_date, ratio (stock split bilgisi) |
| `price_cache` | **paylaşımlı** (auth read+upsert) | ticker PK, price + d1/w1/m1/y1 + p_d1…p_y1 + updated_at |

`price_cache` RLS'i: `authenticated` rolüne SELECT/INSERT/UPDATE; DELETE policy yok.

## `index.html` Yapısı (bileşen haritası)

```
Root → Login | App
  App
    ├─ Dashboard (IIFE)       — summary kartlar, SparkChart, pozisyon tablosu, TRY/EUR blokları
    ├─ HistoryTab             — filtre toolbar, accordion (ticker gruplu)
    ├─ AddTab
    │   ├─ ConfirmBox         — parse sonucu onay
    │   └─ ManuelPosForm      — direkt pozisyon girişi
    └─ Settings               — fetchPrices/Hist butonları, ♻️ rebuildPositions, CSV export
```

Üst-level yardımcılar (top-level, App/Root dışı):
- `rebuildPositions(userId)` — split-aware; HistoryTab edit/delete + CSV import + Settings rebuild tarafından çağrılır
- `SparkChart` — küçük SVG portfolio değer grafiği

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

### CSS class'ları (tekrar azalt)
- `.btn-xs` / `.btn-sm` / `.btn-md` — buton size varyantları
- `.btn-danger-out` — error outline
- `.finp` / `.finp.sm` — form input, küçük varyant
- `.empty-card` — CTA'lı boş-durum kartı
- `.warn-card` — turuncu uyarı kartı (ör. "fiyat yok")
- `.pos-row` — clickable tablo satırı (hover bg değişimi)
- `.badge.etf`/`.badge.cry`/`.badge.split` — ticker rozetleri
- `.mdl-bd`/`.mdl-bx` — özel confirm modal

### Flash & Confirm
- `flash_(msg, "ok"|"err")` — 3.5 sn otomatik kapanır
- `confirm_(msg, {okLbl, cancelLbl, danger})` — **async**, `await` gerekir. `window.confirm` kullanma.

### Dil
- Tüm UI metinleri, flash mesajları, error'lar **Türkçe**
- Commit mesajları **İngilizce** + Co-Authored-By trailer

## Stock Split Sistemi

- Split satırı eklendiğinde (Supabase'e elle INSERT) kullanıcı **Ayarlar → "♻️ Pozisyonları Yeniden Hesapla"** tıklamalı
- `rebuildPositions` her transaction için `factorFor(ticker, date) = Π ratio(tarihten sonraki splitler)` hesaplar; `adjShares = shares × factor`, total cost aynı kalır, avg_cost otomatik düşer
- HistoryTab satır render'ı: o işlemden sonra split varsa `⚡ ×N` badge + tooltip

## Price Cache Akışı

1. **Mount**: `loadData` `price_cache` select eder → `hist`/`prc` state'ine yazar (hızlı chart)
2. **Backfill**: LS'te olup cache'te olmayan ticker'lar bir kerelik cache'e yazılır
3. **Auto-fetch**: `pos` değiştiğinde, cache'te eksik ticker varsa arka planda `fetchHist(missing)` tetiklenir
4. **Yazma**: her başarılı `fetch-prices` sonucu `price_cache`'e upsert (paylaşım)
5. **Cron**: `refresh-price-cache` edge function her 6 saatte bir en stale 5 ticker'ı tazeler

Cron job adı: `refresh-price-cache-6h`, schedule: `0 */6 * * *`, auth: anon Bearer header.

## Gotchas

- Supabase secret adları `SUPABASE_` ile başlayamaz (platform otomatik sağlar): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` zaten edge function runtime'da var.
- `cron.job_run_details` tablosunda `jobname` kolonu **yok** — `jobid` ile `cron.job`'a join gerekir.
- `transactions.way` serbest text ama pratikte `BUY`/`SELL`. Dividend için `"DIV"` eklenmişti, karmaşık geldi, revert edildi — eklenmek istenirse schema constraint kontrolü şart.
- **Anon key public**'tir (frontend'de hardcoded OK), **service_role key kesinlikle gizli** — sadece edge function'larda `Deno.env.get(...)` ile.
- CSV export/import round-trip: virgül/tırnaklı alanlar için `csvEsc()` kullan, aksi halde "Apple, Inc" parçalanır.
- Edge function çalıştırıldığında kullanıcının pos değişiminde `useEffect` çalışıyor → rate limit'e dikkat, `busy.h/p` guard'ı korunmalı.

## Test & Doğrulama

- Babel parse sanity check:
  ```bash
  cd /tmp && node -e "
    const fs=require('fs'); const h=fs.readFileSync('...','utf8');
    const m=h.match(/<script type=\"text\/babel\">([\s\S]*?)<\/script>/);
    try{require('@babel/parser').parse(m[1],{sourceType:'module',plugins:['jsx']});console.log('OK');}
    catch(e){console.log('ERR:',e.message,'line',e.loc?.line);}
  "
  ```
- Frontend testini manuel: `Cmd+Shift+R` hard-reload sonrası
- Edge function test: Supabase Dashboard → Edge Functions → function → Test tab, body ile invoke

## Yol Haritası / Açık Konular

- **CSV format desteği**: kullanıcı Midas/benzer broker export'unu yapıştırınca otomatik parse (şu an header zorunlu, bulunmazsa flash err)
- **Dividend takibi**: önceden denendi, revert edildi. Schema'ya CHECK yoksa `way="DIV"` + ayrı UI moduyla eklenebilir.
- **Çoklu cihaz rebuildPositions**: şu an cihazda manuel tetikleniyor; split eklenince rebuild otomatik olabilir (splits table'a trigger)
