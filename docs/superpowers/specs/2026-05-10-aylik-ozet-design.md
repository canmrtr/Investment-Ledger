# Aylık Özet Kopyala/Paylaş — Tasarım Dokümanı

**Tarih:** 2026-05-10  
**Sprint:** 13  
**Konum:** AnalysisTab (yeni kart)

---

## Özet

AnalysisTab'a bir "Aylık Özet" kartı eklenir. Kullanıcı takvim ayı seçer; o aya ait 8 metrik hesaplanır. İki çıktı üretilir: panoya kopyalanabilir düz metin ve indirilebilir/paylaşılabilir PNG kart.

---

## Amaç & Başarı Kriteri

- Kullanıcı geçmiş bir ayı seçip portföy özetini tek dokunuşta WhatsApp/Telegram'a yapıştırabilmeli.
- Görsel kart (PNG) sosyal medya / arşiv için hazır olmalı.
- İlk açılışta (snapshot tablosu henüz boşken) yaklaşık veri gösterilmeli, ilerleyen aylarda otomatik olarak gerçek verilere geçilmeli.

---

## İçerik (8 Metrik)

| # | Metrik | Kaynak |
|---|--------|--------|
| 1 | Toplam Portföy Değeri ($ ve ₺) | `positions` × ay sonu snapshot fiyatı (yoksa current price + "~" notu) |
| 2 | Aylık Getiri (% ve $) | Ay başı snapshot → ay sonu snapshot delta (yoksa `price_cache.p_m1` ~) |
| 3 | YTD Getiri | Ocak 1 snapshot → current price delta (Ocak snapshot yoksa gizle) |
| 4 | Benchmark: Portföy vs SPY vs XU100 | Aynı snapshot mantığı; SPY ve XU100 da price_cache'de mevcut |
| 5 | En İyi Pozisyon (ticker + %) | Tüm `positions` listesi × ay dönemi fiyat deltası (snapshot varsa snapshot, yoksa p_m1); en yüksek % |
| 6 | En Kötü Pozisyon (ticker + %) | Aynı; en düşük % |
| 7 | Temettü Geliri ($) | `transactions` WHERE `way='DIV'` AND ay filtresi |
| 8 | Net Yatırım (Alış − Satış $) | `transactions` WHERE ay filtresi; pozitif = sermaye girişi, negatif = sermaye çıkışı |

Dağılım (asset type %) mevcut `filteredPos` hesabından anlık alınır — snapshot gerekmez.

---

## Dönem Seçimi

- Varsayılan: bir önceki tamamlanmış takvim ayı (örn. Mayıs 2026'daysan Nisan 2026)
- Dropdown: son 12 ay listelenir (`YYYY-MM-DD` formatında `<select>`)
- Mevcut ay seçilemez (henüz tamamlanmadı)

---

## Veri Akışı

```
Ay seçildi
  │
  ├─ transactions filtrele (ay aralığı)
  │    → temettü, net yatırım (anlık ✅)
  │    → best/worst: positions × fiyat deltası (snapshot veya p_m1)
  │
  ├─ price_snapshots'ta ay başı kaydı var mı?
  │    ├─ EVET → gerçek aylık getiri, benchmark hesapla
  │    └─ HAYIR → price_cache.p_m1 kullan, UI'da "~" göster
  │
  └─ Render kart → "Metni Kopyala" + "Kart İndir" butonları
```

---

## Yeni DB Nesneleri

### `price_snapshots` tablosu

```sql
CREATE TABLE price_snapshots (
  ticker       text        NOT NULL,
  snapshot_date date       NOT NULL,
  price        numeric     NOT NULL,
  PRIMARY KEY (ticker, snapshot_date)
);

-- RLS: yok (paylaşımlı, service_role write, anon+auth read)
ALTER TABLE price_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON price_snapshots FOR SELECT USING (true);
```

### pg_cron job

Her ayın 1'i 00:05 UTC — `price_cache`'deki tüm aktif tickerları snapshot alır:

```sql
SELECT cron.schedule(
  'monthly-price-snapshot',
  '5 0 1 * *',
  $$
    INSERT INTO price_snapshots (ticker, snapshot_date, price)
    SELECT ticker, date_trunc('month', now())::date, price
    FROM price_cache
    WHERE price IS NOT NULL
    ON CONFLICT (ticker, snapshot_date) DO NOTHING;
  $$
);
```

Migration: `013_price_snapshots.sql`

---

## Frontend Bileşenleri

### Kart yerleşimi (AnalysisTab.js)

- AnalysisTab'ın en üstüne (filtre barının hemen altına) yeni `MonthlySnapshotCard` bileşeni
- `<select>` ile ay seçimi; state: `selectedMonth` (varsayılan: önceki ay)
- Hesaplamalar `useMemo` ile ay veya fiyat verisi değişince yeniden çalışır

### Metin formatı (clipboard)

```
📊 Nisan 2026 — Portföy Özeti

💰 Değer:    $45,320 (₺1,452,400)
📈 Aylık:    +3.2% (+$1,402)
📅 YTD:      +8.7%

Benchmark:
  Portföy  +3.2%
  SPY      +2.1%  ✓ piyasayı yendim
  XU100    +4.8%  ✗ geride kaldım

🏆 En İyi:  AAPL  +8.2%
📉 En Kötü: THYAO -3.1%

💵 Temettü:     $124
➕ Net Yatırım: +$2,000
🗂 Dağılım: ABD %52 · BIST %28 · Kripto %12 · Altın %8

— Portfoi ile hesaplandı
```

### PNG export

- `html2canvas` CDN'den yüklenir (`defer`, sadece bu kart render'ında çağrılır)
- "Kart İndir" → paylaşım kartı div'ini `html2canvas` ile yakalar → `<a download>` ile PNG indirir
- Mobil: `navigator.share({ files: [pngBlob] })` destekleniyorsa Web Share API'yi dene; desteklenmiyorsa direkt indir
- `html2canvas` yüklenemezse → buton gizlenir, sadece "Metni Kopyala" görünür

---

## Edge Case'ler

| Durum | Davranış |
|-------|----------|
| Seçilen ayda hiç transaction yok | Metrikler gösterilir, "Bu ay işlem yok" notu |
| `price_snapshots` boş (ilk ay) | Getiri satırlarında `~` badge + "Yaklaşık değer (30 günlük)" tooltip |
| YTD için Ocak snapshot'ı yok | YTD satırı tamamen gizlenir |
| `html2canvas` CDN yüklenemezse | "Kart İndir" butonu render edilmez |
| Seçilen ayda temettü yok | Temettü satırı `$0` gösterir (gizlemez) |

---

## Kapsam Dışı

- Geçmişe dönük snapshot backfill (sadece ileriye dönük çalışır)
- PDF export
- E-posta ile gönderme
- Özelleştirilebilir metin şablonu

---

## Dosya Değişiklikleri

| Dosya | Değişiklik |
|-------|-----------|
| `supabase/migrations/013_price_snapshots.sql` | Yeni tablo + RLS + pg_cron |
| `src/components/AnalysisTab.js` | `MonthlySnapshotCard` bileşeni eklenir |
| `index.html` | `html2canvas` CDN script etiketi |
