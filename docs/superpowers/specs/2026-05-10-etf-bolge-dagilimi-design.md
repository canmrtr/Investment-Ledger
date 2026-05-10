# ETF Bölge Dağılımı (Underlying Country Weights) — Design Spec

**Sprint**: 13 | **Tarih**: 2026-05-10 | **Boyut**: M | **Öncelik**: P2

---

## Problem

AnalysisTab Bölge Dağılımı kartı şu an her FUND pozisyonunu `"us"` bucket'a düşürüyor. VT, VWO, EEM gibi global ETF'leri olan kullanıcılar için bölge analizi yanıltıcı sonuç üretiyor (örneğin VT → %100 ABD gibi görünüyor, gerçekte %55 ABD + %24 Avrupa + ...).

---

## Kapsam

- `src/constants.js` — `COUNTRY_REGION` haritası (~60 ülke → 5 bucket)
- `fetch-fundamentals` edge fn — yeni `mode:"etf-country"` dalı
- `src/components/AnalysisTab.js` — state, fetch akışı, `regionSlices` hesabı, UI

---

## Veri Modeli

### 5 ETF Bölge Bucket'ı

Mevcut bucket'lara (`us`, `tr`, `crypto`, `emtia`, `fx`) eklenir:

| Bucket | Label | Renk |
|--------|-------|------|
| `eu` | Avrupa | `#0a84ff` |
| `asia-pac` | Asya-Pasifik | `#ff9f0a` |
| `em` | Gelişen Piyasalar | `#ff453a` |
| `other` | Diğer | `#636366` |

### COUNTRY_REGION Haritası

`src/constants.js`'e eklenir. FMP ülke adı → bucket key. Yaklaşık 60 ülke kapsanır:

- **us**: United States
- **eu**: Germany, France, United Kingdom, Switzerland, Netherlands, Sweden, Italy, Spain, Denmark, Finland, Norway, Belgium, Ireland, Austria, Portugal, Luxembourg, Poland, Czech Republic, Hungary
- **asia-pac**: Japan, China, Australia, South Korea, Taiwan, Hong Kong, Singapore, India, New Zealand, Indonesia, Thailand, Malaysia, Philippines
- **em**: Brazil, Mexico, South Africa, Saudi Arabia, United Arab Emirates, Qatar, Kuwait, Turkey, Russia, Egypt, Greece, Colombia, Chile, Peru, Argentina
- **other**: Bilinmeyen veya listedeki ülkeler dışındaki her ülke

### LS Cache

- Anahtar: `il_etf_cw_<TICKER>` (büyük harf ticker)
- Format: `{ weights: {us:55.2, eu:24.1, "asia-pac":12.3, em:7.1, other:1.3}, ts: <epoch_ms> }`
- TTL: 90 gün (ETF rebalance sıklığına uygun)

### TEFAS Tespiti

`type:"FUND"` + `currency:"TRY"` → TEFAS fonu → ETF country fetch atlanır, "us" fallback korunur. Yeni type veya tablo gerekmez.

---

## Edge Function — `mode:"etf-country"`

### İstek

```json
{ "mode": "etf-country", "tickers": ["VT", "VWO", "EEM"] }
```

- `edgeCallAuth` ile çağrılır (JWT zorunlu)
- Max 10 ticker (`tickers.slice(0, 10)`)
- Ticker başına regex validation: `/^[A-Z0-9.\-]{1,12}$/i`

### Sunucu İşlemi

1. `FMP_KEY` secret kontrolü → yoksa 500
2. `Promise.all` ile her ticker için FMP `/stable/etf/country-weightings?symbol=<ticker>&apikey=<key>` çağrısı, `AbortSignal.timeout(8000)`
3. FMP yanıtı: `[{country:"United States", weightPercentage:"55.23"}, ...]`
4. Her satır: `COUNTRY_REGION[country]` → bucket key; bilinmeyenler → `other`
5. Bucket değerleri toplanır, normalleştirilir (toplam 100'e yakın olmalı; raw float tutulur)
6. FMP hata/boş → o ticker için `{}` döner (frontend fallback devreye girer)

### Yanıt

```json
{
  "weights": {
    "VT":  { "us": 55.2, "eu": 24.1, "asia-pac": 12.3, "em": 7.1, "other": 1.3 },
    "VWO": { "em": 60.1, "asia-pac": 25.4, "us": 5.2, "eu": 4.1, "other": 5.2 },
    "EEM": {}
  }
}
```

---

## AnalysisTab Değişiklikleri

### Yeni State

```js
const [etfCw, setEtfCw]         = useState({});   // {ticker: {us,eu,...}}
const [etfCwBusy, setEtfCwBusy] = useState(false);
```

`etfCw` component mount'ta LS cache'den populate edilir.

### Fetch Akışı

`useEffect([filteredPos])` içinde çalışır:

1. `type:"FUND"` + `currency !== "TRY"` olan ticker'ları topla
2. Her biri için LS cache kontrol et (`il_etf_cw_<ticker>`, TTL 90 gün)
3. Cache'de olanları `etfCw`'ye yükle
4. Eksikler varsa:
   - `etfCwBusy = true`
   - `edgeCallAuth("fetch-fundamentals", { mode:"etf-country", tickers:[...] })`
   - Başarıda: `etfCw` güncelle + her ticker'ı LS'e yaz
   - Hata/boş: sessiz fail (kullanıcıya gösterilmez)
   - `etfCwBusy = false`
5. FUND pozisyonu yoksa effect hiç çalışmaz

### `regionSlices` Hesabı

```
FUND + currency:"TRY"       → "tr" değil, mevcut "us" fallback (TEFAS)
FUND + etfCw[ticker] var    → MV'yi weights'e göre her bucket'a dağıt
FUND + etfCw[ticker] yok    → "us" bucket (fetch bitmedi veya FMP'de yok)
US_STOCK / BIST / diğer     → mevcut REGION_OF mantığı (değişmez)
```

Örnek (VT, MV = 10.000 USD, weights = {us:55, eu:24, "asia-pac":12, em:7, other:2}):
- `byRegion["us"] += 5500`
- `byRegion["eu"] += 2400`
- `byRegion["asia-pac"] += 1200`
- `byRegion["em"] += 700`
- `byRegion["other"] += 200`

### UI

- `etfCwBusy` aktifken Bölge Dağılımı başlığının yanında `<span style={{color:"var(--text3)",fontSize:11}}> Yükleniyor…</span>`
- Fetch bitince pie otomatik yenilenir (state update yeterli, animasyon yok)
- Hata durumunda kullanıcıya hiçbir şey gösterilmez — sessiz fail, "us" fallback

---

## Hata Senaryoları

| Durum | Davranış |
|-------|----------|
| FMP rate limit (250/gün aşıldı) | `{}` döner → "us" fallback |
| FMP'de o ETF yok | `{}` döner → "us" fallback |
| TEFAS fonu (currency TRY) | Fetch atlanır → "us" fallback |
| Edge fn network hatası | `etfCw` güncellenmez → "us" fallback |
| LS cache 90 günden eski | Cache yoksayılır, yeni fetch tetiklenir |

---

## Test Senaryoları

1. **VT**: Bölge pie → ~%55 ABD, ~%24 Avrupa, ~%12 Asya-Pasifik (şu an %100 ABD)
2. **SPY** (saf US ETF): Sonuç değişmez (%100 ABD)
3. **TEFAS fonu** (FUND + TRY): "us" fallback, warn-card yok
4. **FUND pozisyonu yok**: `useEffect` tetiklenmez, fetch yok
5. **LS cache**: 2. açılışta fetch yok, pie anında render

---

## Kapsam Dışı

- Yeni Supabase tablosu veya migration
- pg_cron refresh (90 gün TTL yeterli)
- BIST_FUND yeni type'ı (currency:"TRY" kontrolü yeterli)
- Kullanıcıya hata gösterimi (sessiz fail kabul edilebilir)
