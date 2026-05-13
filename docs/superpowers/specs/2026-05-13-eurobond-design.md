# Eurobond Takibi — Tasarım Spec

**Tarih:** 2026-05-13  
**Kapsam:** Sadece Eurobond (Türk Hazinesi USD/EUR tahvilleri)  
**Yaklaşım:** Yeni `EUROBOND` asset type + ETF proxy fiyat + otomatik kupon takvimi

---

## Bağlam

Investment Ledger'da Türk Hazinesi'nin uluslararası piyasalarda ihraç ettiği döviz cinsinden tahvilleri (Eurobond) takip etmek için destek ekleniyor. DEPOSIT modelinin altyapısı büyük ölçüde yeniden kullanılacak; kupon hesabı DEPOSIT'teki günlük bileşik faiz yerine dönemsel (6 aylık/yıllık) kupon modeline dönüştürülecek. Piyasa fiyatı bireysel tahvil yerine bir EM bond ETF proxy (ör. EMB) üzerinden taklit edilecek.

---

## Veri Modeli

### Positions tablosu — yeni kolonlar (migration)

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| `face_value` | numeric | Lot başı par değer (ör. `1000` = $1,000/lot) |
| `coupon_frequency` | int | Yılda kupon sayısı: `1`=yıllık, `2`=6 aylık |
| `issue_date` | date | İlk kupon tarih hesabı başlangıcı |
| `price_ticker` | text | Proxy ETF sembolü (ör. `EMB`, `AGG`) |

> `unit` kolonu (altın birimi için) EUROBOND'da boş kalır; alım anındaki proxy ETF fiyatını (`purchase_proxy_price`) string olarak saklamak için yeniden kullanılır. Bu sayede ekstra migration kolonu gerekmez.

### Mevcut kolonların yeniden kullanımı

| Kolon | EUROBOND kullanımı |
|-------|-------------------|
| `interest_rate` | Yıllık kupon oranı (ör. `0.0825` = %8.25) |
| `maturity_date` | Vade tarihi |
| `reserve_ratio` | Stopaj oranı (ör. `0.10` = %10) |
| `currency` | `USD` veya `EUR` |
| `broker` | Saklama kuruluşu |
| `shares` | Toplam nominal tutar (lot sayısı × face_value) |
| `avg_cost` | Ortalama alım fiyatı (clean price %, ör. `0.985` = %98.5) |

### Transaction modeli
- **BUY:** `shares = lot × face_value`, `price = cleanPrice / 100`
- **SELL:** `shares = satılan lot × face_value`, `price = cleanPrice / 100`
- DIV tx kullanılmaz; kuponlar synthetic hesaplanır.

### Ticker formatı
Kullanıcı tanımlı, ör. `TRKGB35USD` veya `EUROBOND_TR_2035`.

---

## Fiyat & Hesaplama Mantığı

### Fiyat kaynağı
- `fetch-prices` edge function'ında `type === "EUROBOND"` routing path eklenir.
- `price_ticker` değeri (ör. `EMB`) Massive US stock endpoint'inden çekilir.
- `price_cache`'e proxy ticker altında saklanır — mevcut altyapı yeterli.
- Proxy ticker bulunamazsa: P&L = 0, dashboard'da uyarı badge.

### Dirty price hesabı — `computeEurobondValue(pos, txs, currentDate)`
Yeni modül-seviyesi fonksiyon (`App.js` üstüne, `computeDepositGrossInterest` benzeri):

```
nominalTutar    = shares (tüm BUY - SELL)
purchaseProxyPx = parseFloat(pos.unit)           // unit alanında saklı alım ETF fiyatı
cleanPrice%     = (currentProxyPrice / purchaseProxyPx) × alımCleanPrice%
                  // proxy ETF'nin göreceli hareketini clean price'a yansıt
dönemGün        = 365 / coupon_frequency
günSayısı       = son kupon tarihinden bugüne gün
birikmiş_kupon  = nominalTutar × (interest_rate / coupon_frequency) × (günSayısı / dönemGün)
brütDirtyValue  = nominalTutar × cleanPrice% / 100 + birikmiş_kupon
netKupon        = birikmiş_kupon × (1 - reserve_ratio)
dirtyValue      = nominalTutar × cleanPrice% / 100 + netKupon
```

### Vade sonrası davranış
- `currentDate >= maturity_date` → `cleanPrice% = 100`, `birikmiş_kupon = 0`
- Dashboard'da vade badge kırmızı.

### Sonraki kupon tarihi
```
nextCoupon = issue_date + (n × dönemGün)  →  bugünden sonraki ilk tarih
```

### Synthetic price injection (`loadData`)
DEPOSIT ile aynı pattern:
```javascript
prc[ticker] = dirtyValue / (nominalTutar × ilkAlımCleanPrice%)
```

---

## UI Bileşenleri

### AddTab — ManuelPosForm genişletmesi

`EUROBOND` tipi `MANUEL_ONLY_TYPES`'a eklenir. Ek form alanları:

| Alan | Input tipi | Varsayılan |
|------|-----------|-----------|
| Nominal lot sayısı | number | — |
| Lot büyüklüğü (face value) | number | 1000 |
| Alım fiyatı (clean %, ör. 98.5) | number | — |
| Para birimi | select (USD/EUR) | USD |
| Kupon oranı (%) | number | — |
| Kupon sıklığı | select (Yıllık/6 Aylık) | 6 Aylık |
| İhraç / İlk kupon tarihi | date | — |
| Vade tarihi | date | — |
| Proxy ticker | text | EMB |
| Saklama kuruluşu | text | — |

`shares = lot × face_value`, `avg_cost = cleanPrice / 100` otomatik hesaplanır.  
Proxy ticker'ın **alım anındaki fiyatı** form kayıt sırasında `fetch-prices`'tan çekilip `unit` alanına string olarak yazılır (ör. `"87.50"`).

### Dashboard — EUROBOND bloğu

DEPOSIT bloğuyla aynı yapı (`mixed: true`). Ekstralar:
- Kupon oranı badge: `%8.25 kupon • 6 aylık`
- Sonraki kupon badge: yeşil (>30 gün) / sarı (≤30 gün) / kırmızı (geçmiş)
- Birikmiş net kupon satırı: `Birikmiş: +$124`
- Proxy uyarısı: `Fiyat: EMB proxy` gri küçük not

### TickerDetailTab — Eurobond özet kartı

DEPOSIT'in `TickerDetailTab` özel kartı gibi:
- Nominal tutar, kupon oranı, vade
- Sonraki 4 kupon tarihi takvimi
- YTM hesabı (Newton-Raphson, frontend utility)
- Macaulay Duration göstergesi

### TYPE_COLORS
```javascript
EUROBOND: "#0EA5E9"  // sky-500, DEPOSIT (#6366F1) ile karışmaz
```

---

## Dosya Değişiklikleri

| Dosya | Değişiklik |
|-------|-----------|
| `supabase/migrations/019_eurobond.sql` | 4 yeni kolon + `rebuild_positions_atomic` RPC güncellemesi |
| `src/constants.js` | `TYPE_COLORS`, `TL` label'ları, `DEPOSIT_TAX_RATE` benzeri sabit |
| `src/utils.js` | `BLOCK_TYPES`, `ASSET_ICONS`, `computeEurobondValue` |
| `src/components/App.js` | `loadData` synthetic inject, fiyat routing, dashboard blok render |
| `src/components/AddTab.js` | `MANUEL_ONLY_TYPES`, `ADD_TYPES`, ManuelPosForm koşullu alanlar |
| `src/components/TickerDetailTab.js` | Eurobond özet kartı |
| `fetch-prices` edge fn | EUROBOND routing path (proxy ticker) |

---

## Edge Case'ler

| Durum | Davranış |
|-------|---------|
| Proxy ticker price_cache'de yok | P&L = 0, "Fiyat alınamadı" badge |
| Vade geçmiş | cleanPrice = %100, birikmiş = 0, kırmızı badge |
| SELL sonrası nominal sıfır | Pozisyon DUST_THRESHOLD altında silinir |
| reserve_ratio = 0 | Stopaj uygulanmaz (offshore hesap) |

---

## Test Senaryoları

1. Eurobond ekleme → dashboard EUROBOND bloğunda görünüyor
2. Proxy ticker fiyatı değişince dirty value güncelleniyor
3. Sonraki kupon tarihi doğru hesaplanıyor (6 aylık ve yıllık)
4. Vade geçmiş tahvil — cleanPrice %100, badge kırmızı
5. SELL tx sonrası nominal düşüyor, birikmiş kupon yeniden hesaplanıyor
6. Proxy ticker bulunamazsa uyarı badge görünüyor

---

## Kapsam Dışı

- TRY cinsinden devlet tahvili (DİBS)
- Şirket tahvili / kira sertifikası
- ISIN tabanlı doğrudan fiyat çekimi
- Kupon geçmişi (DIV tx entegrasyonu)
