# Sprint 04 — 2026-04-28 → 2026-05-11

**Goal**: Uygulamanın "fark etmeden kırık" güvenlik açıkları kapanır; Can günlük kullanımda form hatalarıyla ve dar ekranda ezilen butonlarla uğraşmaz.

**Capacity**: 2 hafta × ~5-6h/hafta efektif (akşam + hafta sonu) ≈ 10-12h toplam

---

## Scope

### Güvenlik & Altyapı Katmanı

1. **refresh-price-cache cron secret** — `[S][P1]` (ROADMAP: Bug & UX Backlog)
   - DoD:
     - `CRON_SECRET` env variable Supabase'e eklendi
     - `refresh-price-cache` edge function gelen `Authorization` header'ı `CRON_SECRET` ile doğruluyor; eşleşmezse 401 dönüyor
     - pg_cron job güncellemesi: anon Bearer yerine `CRON_SECRET` header ile çağrı
     - Supabase Dashboard Test tab'dan doğru secret ile çağrı başarılı, yanlış secret ile 401
   - Risk: pg_cron `pg_net.http_post` header değişikliği syntax'ı farklı olabilir — sql-writer agent'a danış. Mitigation: mevcut job DROP + yeni CREATE ile replace.
   - Neden bu sprint: Anon Bearer ile cron URL'si bilen herkes price_cache'i manipüle edebilir; tek-kullanıcı şu an yeterli ama PR açık.

2. **massiveHistorical silent {} fix** — `[S][P1]` (ROADMAP: Bug & UX Backlog)
   - DoD:
     - `fetch-prices` edge function `massiveHistorical()` fonksiyonu; HTTP != 200 durumunda `{}` yerine `{ error: "massiveHistorical: HTTP {status}" }` flag döndürüyor
     - Caller (`fetchHist`) response içinde `error` field'ı varsa console.warn + `flash_("Fiyat geçmişi alınamadı: TICKER", "err")` gösteriyor (DEBUG mod kapalı olsa da warn aktif)
     - Sparkline'da data yoksa mevcut "yetersiz veri" empty state devreye giriyor — kullanıcı sessiz bozukluk yerine net geri bildirim alıyor
   - Risk: edge function değişikliği → edge-reviewer agent'a gönder, deploy öncesi.
   - Neden bu sprint: Altın/BIST geçmişi zaman zaman sessizce boş geliyor; sparkline veri yokken "kırık" görünüyor. Düşük efor, yüksek görünürlük.

3. **AddTxInline NaN guard** — `[S][P1]` (ROADMAP: Bug & UX Backlog)
   - DoD:
     - `AddTxInline` bileşeninde `shares` veya `price` NaN/undefined/boş string olduğunda form submit engelleniyor
     - Inline hata metni gösteriliyor ("Geçersiz adet" / "Geçersiz fiyat"); `aria-invalid="true"` ile birlikte
     - AI parse sonucu NaN dönerse ConfirmBox'ta da aynı guard aktif — NaN içeren satır kırmızı highlight, onay butonuna basılırken atlanıyor + kullanıcıya "X geçersiz işlem atlandı" flash
   - Risk: ConfirmBox multi-row guard'ı state taşır — ui-builder agent'a delege et.

4. **CSV negatif/Infinity guard** — `[S][P1]` (ROADMAP: Bug & UX Backlog)
   - DoD:
     - CSV import: `shares <= 0` veya `!isFinite(shares)` veya `price < 0` veya `!isFinite(price)` olan satırlar insert edilmiyor
     - Skip sayacına ekleniyor; mevcut `"X işlem alındı, Y satır atlandı"` flash mesajı bunu kapsıyor
     - Atlandığında console.warn ile skip sebebi (NaN/negatif/Infinity) loglanıyor
   - Risk: düşük — mevcut CSV parse akışına koşul ekleme.

### UX / Günlük Kullanım Katmanı

5. **Period buton wrap dar ekran** — `[S][P1]` (ROADMAP: Sprint Audit Backlog Grup 2)
   - DoD:
     - 320px (iPhone SE) ve 360px ekranda dönem butonları (1H/3H/6H/1Y/Tüm) ezilmiyor
     - `flex:1; min-width:40px` veya `flex-wrap:wrap` + `gap:4px` ile çözüm
     - Buton metni kırpılmıyor; "Tüm" yerine "All" değil — Türkçe korunsun
   - Risk: sıfır — pure CSS; Sprint 3'ten taşındı, bu sprint kesin bitmeli.

6. **Dashboard pozisyon listesi varsayılan sıralama: kazanım** — `[S][P1]` (ROADMAP: Bug & UX Backlog)
   - DoD:
     - Her BLOCK_TYPES bloğunda (US Hisse / ETF / BIST / Kripto / Altın / Döviz) pozisyonlar varsayılan olarak P&L% azalan sırada gösteriliyor
     - En çok kazandıran pozisyon en üste; kaybedenler en alta
     - Mevcut sıralama state (`sortKey/sortDir`) korunuyor — kullanıcı hâlâ farklı sütuna göre sıralayabiliyor
     - Fiyat verisi yoksa (`prc[ticker]` undefined) P&L% = 0 sayılıp listenin sonuna itiliyor
   - Risk: `prc` state boşken sort comparator NaN üretebilir — `isNaN` guard ekle. Düşük risk.
   - Neden bu sprint: Her sabah açıldığında "en iyi/en kötü gider nasıl?" sorusu 2 saniyede cevaplanmalı. Mevcut durum insert sırasına göre rastlantısal.

7. **Konsantrasyon Risk Göstergesi** — `[S][P1]` (ROADMAP: Analiz Tab — Portföy Analizi)
   - DoD:
     - Analiz Tab'da yeni küçük kart: "Konsantrasyon Riski"
     - Top 3 pozisyonun toplam portföy ağırlığı hesaplanıyor (display cur'da market value)
     - Renk mantığı: >%60 kırmızı pill ("Yüksek"), %40-60 sarı ("Orta"), <=%40 yeşil ("Düşük")
     - Herfindahl-Hirschman Index (HHI) basit versiyonu: Σ(wi²) × 10000; değer ile birlikte gösteriliyor
     - Top 3 ticker ismi ve ağırlığı kart içinde listeleniyor
     - Tamamen frontend hesabı — yeni API/fetch yok
   - Risk: FX conversion olmadan TRY + USD pozisyonları toplanamazsa sadece USD veya displayCur'a convert et. `convert()` helper zaten hazır.
   - Neden bu sprint: Tek analiz aracı olmayan uygulamanın "value-investing power tool" olma iddiasının en kolay kanıtı. 2 saatlik efor, yüksek günlük değer.

---

## Out of Scope (bilinçli ertelenenler)

- **price_cache güvenlik + fetch lock MVP** `[M][P0]` — SQL migration + edge fn lock + frontend SWR akışı üç bağımlı adım; 6h+ tek item. Sprint 5'in baş öğesi. Bu sprint cron secret ile riski kısmen azaltıyoruz.
- **Dividend (temettü) tracking** `[M][P1]` — schema + UI + HistoryTab entegrasyonu büyük kapsam; Sprint 5 veya 6.
- **Benchmark karşılaştırması (SPY/XU100)** `[M][P1]` — fetch + UI birlikte; Sprint 5.
- **TEFAS endpoint keşfi** — 2 saatlik keşif bütçesi makul ama sprint kapasitesi tolu; Sprint 5 başında 1 oturum.
- **maxLength ticker/name/broker** `[S][P2]` — küçük ama Sprint 4'ün P1'leri dolunca girer; Sprint 5 başı.
- **EUR tablosu sort** `[S][P1]` — EUR pozisyon sayısı az; Sprint 5.

---

## Demo / Validation

Sprint sonunda doğrulama akışı:

1. **Cron secret**: Supabase Edge Functions Test tab → `refresh-price-cache` → boş Authorization header ile POST → 401 döner. Doğru `CRON_SECRET` ile → 200.
2. **massiveHistorical fix**: Geçici olarak BIST AAPL gibi geçersiz ticker ile fetch tetikle → console'da warn görünüyor, sparkline "yetersiz veri" empty state gösteriyor, sessiz bozukluk yok.
3. **NaN guard**: AddTxInline'da fiyat alanını boş bırak → "Geçersiz fiyat" hata metni çıkıyor, submit çalışmıyor.
4. **CSV guard**: `shares=-5, price=Infinity` içeren 3 satırlık CSV yükle → "2 işlem alındı, 1 satır atlandı" flash.
5. **Dar ekran**: iPhone SE (375px) Chrome DevTools'ta dönem butonları yan yana okunabilir şekilde duruyor, metin kırpılmıyor.
6. **Default sort**: Dashboard açıldığında US Hisse bloğu en çok kazandıran pozisyon üstte, en çok kaybeden altta.
7. **Konsantrasyon risk**: Analiz Tab → "Konsantrasyon Riski" kartı — top 3 ticker + ağırlık + renk pill görünüyor; tek pozisyon %80 ise kırmızı.

---

## Retro Notu (Sprint 3 sonu)

Sprint 3 büyük kısmıyla tamamlandı: TR altın birimleri MVP (6 unit + oz-eq storage + Dashboard back-conversion), ondalık adet fix, form inline validation, backdrop guard, CORS lockdown, EDGAR UA email, rebuildPositions unit snapshot. `period buton wrap` bitirilmedi — Sprint 4'e taşındı. Periyodik agent denetim turu (client-security-auditor + edge-reviewer) da bu sprint'te yapıldı ve 15 bulgu Sprint 4 backlog'una eklendi. Sprint 3 kapasiteye göre dengeli bir sprint'ti; teknik borç + yeni özellik dengesi iyi kuruldu.
