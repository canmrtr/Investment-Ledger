# Sprint 19 — 2026-05-28 → 2026-06-10

**Goal**: Can, BES pozisyonundaki katkı/getiri dağılımını net görür; karmaşık analiz kartları düz dille özetlenir; temettü takvimi Dashboard'da izlenebilir hale gelir; fiyat verisi eskidikçe uyarı alır — günlük kullanım deneyimi ölçülebilir biçimde iyileşir.

**Capacity**: 2 hafta × ~6h/hafta efektif ≈ ~12h toplam (hafta sonu + akşam)

---

## Bağlam: Sprint 18 Retro

Sprint 18, kapsamlı bir sprint oldu. BES DK entegrasyonu (Item 1) tüm alt-task'larıyla teslim edildi: DB migration (018), RPC güncelleme, `utils.js` rebuildPositions, ManuelPosForm 4 alan, `loadData` field okuma. P&L = yalnızca kişisel yatırılan maliyet; DK tamamı kazanç — doğru hesaplama canlıda.

Item 2 (DEPOSIT TickerDetailTab) ve Item 3 (DEPOSIT/CASH blok sembolü) sprint döngüsü bitmeden aktif olarak devam ediyordu; bu iki item Sprint 18 kapsamında kalır ve sprint-18.md'de işaretlenecektir. Sprint 19, bu iki item'ın tamamlanmasını beklemeye gerek duymadan paralelde planlanmıştır — çakışan kodbase bölgesi yok.

---

## Scope

### 1. BES TickerDetailTab Breakdown Kartı `[S][P1]`

**Roadmap satırı**: `Asset Type Genişletme → "BES TickerDetailTab breakdown kartı" [P1]`

**Neden bu sprint**: Sprint 18 Item 1 (BES DK entegrasyonu) tamamlandıkça `dk_principal` + `dk_current` kolonları mevcut; önkoşul kalktı. Şu an BES pozisyonu TickerDetailTab'da generik hisse görünümü sunuyor — "Adet", "Şirket Bilgisi", "P/E" gibi alanlar BES için anlamsız. Can aktif BES kullanıcısı; DK takibinin faydası ancak bu kart tamamlanınca tam görünür olur.

**Alt-task'lar**:
- [x] **1a `TickerDetailTab.js` — `type==="BES"` dalı**: Generik hisse metrikleri (`Adet`, `Ort. Maliyet`, `Şirket Bilgisi`, invalid ticker uyarısı) gizlenir; BES özel 6+1 satır render edilir. `ui-builder` sign-off ✅.
- [x] **1b Kişisel katkı satırı**: `avg_cost` değeri → "Yatırılan Tutar: ₺X" (maliyet tabanı).
- [x] **1c Yatırım getirisi satırı**: `prc[ticker] − dk_current − avg_cost` → "Yatırım Getirisi: ₺X" (kişisel portföy kazancı). Önce "Kişisel Güncel" sub-row ile gösterilir.
- [x] **1d Devlet Katkısı satırı**: `dk_principal` → "DK Anaparası: ₺X" (DK anaparası).
- [x] **1e DK getiri satırı**: `dk_current − dk_principal` → "DK Getirisi: ₺X" (DK kazancı). Önce "DK Güncel" sub-row ile gösterilir.
- [x] **1f Toplam satırı**: `prc[ticker]` (kişisel_güncel + dk_güncel) → "Toplam Değer: ₺X" kalın, vurgulu (16px gold).
- [x] **1g `dk_principal` NULL guard**: Eski BES pozisyonları (`dkCurrent==null`) için "Kişisel Güncel" satırı "⚠ DK bilgisi güncellenmeli" nudge gösteriyor; DK satırları "—"; app çökmüyor.

**Tamamlandı 2026-05-15** — 6 commit (`45d98fc..50b92f4`) ile canlı. Final layout iki bölümlü: Kişisel Portföy + tinted Devlet Katkısı + Toplam Değer footer. Ekstra olarak Task 2'de "Kişisel Güncel" ve "DK Güncel" ara satırları eklendi (spec'in 5 satırından 7'ye çıktı) ve ↻ Meta butonu BES için gizlendi. Spec: `docs/superpowers/specs/2026-05-15-bes-tickerdetail-breakdown-design.md`, plan: `docs/superpowers/plans/2026-05-15-bes-tickerdetail-breakdown.md`.

**DoD**:
- BES pozisyonu TickerDetailTab'da 5 satır (Yatırılan Tutar / Yatırım Getirisi / Devlet Katkısı / DK Getirisi / Toplam Değer) gösteriyor.
- "Adet", "Ort. Maliyet", "Şirket Bilgisi", "Sonraki Temettü" gibi generik metrikler BES tipi için görünmüyor.
- `dk_principal=NULL` olan eski BES pozisyonları kart açarken çökmüyor; DK satırları "—" gösteriyor.
- `npm run check:babel` geçiyor; `ui-builder` sign-off tamamlanmış.
- Mevcut BUY/SELL pozisyonlarında (US, BIST, CRYPTO, DEPOSIT) görsel regresyon yok.

**Risk**: `prc[ticker]` BES pozisyonu için `set-manual-price` ile yazılan sentetik değer; DK alanları `dk_current` ayrı — toplam hesap karışabilir. Mitigation: `ui-builder` hesaplama formülünü spec (`docs/superpowers/specs/2026-05-11-bes-state-contribution-design.md`) ile karşılaştırır; field mapping kod içinde inline yorum ile belgelenir.

---

### 2. Karmaşık Kartlara Önce Sonuç Cümlesi `[S][P1]`

**Roadmap satırı**: `UI & A11y Backlog → Brand Fit & Jargon Temizliği → "Karmaşık kartlara önce sonuç cümlesi ekle" [P1]`

**Neden bu sprint**: Sprint 17'de B1 (jargon → Türkçe) + B2 (formül gizleme) tamamlandı; B3 bu item. Kullanıcı AnalysisTab'ı açtığında tablo/metrikten önce tek cümle okumak istiyor — "Portföyün borç düzeyi sağlıklı" gibi. Bu nudge copy pattern `parse-transaction` prompt'larında zaten var; yeniden kullanım kolay. 4 kart hedefleniyor; her biri bağımsız, paralel geliştirilebilir.

**Alt-task'lar**:
- [x] **2a Portföy Sağlık kartı**: 6 per-metric sentence yerine tek aggregate verdict: "X metrik sağlıklı, Y dikkat gerektiriyor — portföyün genel fundamentali [güçlü/orta/zayıf]." Eşikler: goodCount≥4→güçlü, badCount≥3→zayıf, else orta. `ui-builder` sign-off ✅.
- [x] **2b Konsantrasyon Riski kartı**: Kart üstünde yeni verdict: "Portföyün çeşitlendirme düzeyi [iyi / orta düzey / yüksek konsantrasyon]." Eşikler `top3wStocks` ile (>60→yüksek konsantrasyon, >40→orta düzey, ≤40→iyi). Mevcut alttaki açıklama cümlesi korundu.
- [x] **2c Kur Riski kartı**: `fxSubText` yerine explicit verdict + JSX-based render: "Portföyün %X'i yabancı para cinsinden — kur değişimine [yüksek/orta/düşük] maruz." Eşikler: >70% yüksek, 30-70% orta, <30% düşük. All-TRY ve no-data fallback case'leri eklendi.
- [ ] **2d Dayanıklılık kartı** (eğer Piyasa Dayanıklılık Skoru Sprint 19'a alınırsa): Skor 1-10 → "Portföyün piyasa düşüşlerine karşı dayanıklılığı [güçlü/orta/kırılgan]." Sprint 20'ye ertelendi (Piyasa Dayanıklılık Skoru bağımlılığı).

**Tamamlandı 2026-05-15** — 7 commit (`4d57b4c..9ca62f5`) canlıda. 3 AnalysisTab kartı şimdi tek satırlık sinyal-renkli verdict cümlesi ile açılıyor. Item 2d Sprint 20'ye taşındı. Spec: `docs/superpowers/specs/2026-05-15-analysis-card-verdicts-design.md`, plan: `docs/superpowers/plans/2026-05-15-analysis-card-verdicts.md`.

**DoD**:
- Portföy Sağlık, Konsantrasyon Riski, Kur Riski kartları metrik tablosundan önce tek cümle sonuç gösteriyor.
- Cümleler mevcut state'e dinamik olarak bağlı (hardcoded değil); üç eşik senaryosunda doğru metin çıkıyor.
- `npm run check:babel` geçiyor; `ui-builder` sign-off tamamlanmış.
- Fundamentals verisi yüklenmemişse/yoksa sonuç cümlesi "—" veya gizli kalıyor (ekstra fetch tetiklemiyor).

**Risk**: Her kart için eşik değerleri keyfi görünebilir; açıkça yorumlamaya yol açabilir. Mitigation: eşik seçimi ROADMAP'teki mevcut HHI/skor mantığından türetilir; tooltip'te sayısal değer korunur.

---

### 3. Temettü Takvimi Faz 2 — Dashboard "Bu Ay Beklenen Temettüler" `[S][P2]`

**Roadmap satırı**: `Temettü Takvimi → (c) Dashboard/HistoryTab "Bu ay beklenen temettüler" özet satırı`

**Neden bu sprint**: Faz 1 (dividend-calendar mode + TickerDetailTab satırı) Sprint 17'de tamamlandı, stabilize oldu. Faz 2 küçük bir ek: mevcut `fund_cache.dividends` verisi zaten çekiliyor; yalnızca filtreleme + Dashboard/HistoryTab render gerekiyor. Can temettü beklentilerini takip etmek istiyor — sabah açılışında "bu ay ne geliyor?" görünümü.

**Alt-task'lar**:
- [ ] **3a Veri filtreleme**: `fund_cache` dividends array'ini mevcut ay + sonraki 30 güne göre filtrele; tutulan ticker'lar ile kesişim; `upcomingDividends` state.
- [ ] **3b Dashboard özet satırı**: KPI bölümü altında veya ayrı collapsible kart: "Bu ay X ticker'dan temettü bekleniyor · Toplam tahmini: $Y." Ticker listesi hover/expand. `ui-builder` sign-off.
- [ ] **3c HistoryTab "Yaklaşan Temettüler" collapsible** (isteğe bağlı, kapasiteye göre): Ex-date, ticker, tahmini tutar tablosu; `upcomingDividends` state'i yeniden kullanır.

**DoD**:
- Dashboard'da "Bu ay beklenen temettüler" satırı görünüyor; veri yoksa gizli kalıyor (boş kart değil).
- Filtre mantığı: ex-date bugün ile +30 gün arasında olan ve tutulan ticker'lardan gelen temettüler.
- Tahmini tutar = `amount × shares` (mevcut adet); `fund_cache.dividends[0].amount` kullanılıyor.
- `npm run check:babel` geçiyor; `ui-builder` sign-off tamamlanmış.
- Temettü verisi olmayan pozisyonlar (BIST, CRYPTO, GOLD) için hata yok; sadece US_STOCK hisseleri gösteriliyor.

**Risk**: `fund_cache.dividends` verisi bazı ticker'larda boş ya da güncel olmayabilir (haftalık cron). Mitigation: tutarsız veri → satır gizlenir, hata gösterilmez; veri kalitesi notu tooltip'te.

---

### 4. Stale Fiyat Uyarısı `[S][P2]`

**Roadmap satırı**: `Otomasyon & Raporlama → "Stale Fiyat Uyarısı (price_cache yaşı)" [P2]`

**Neden bu sprint**: `price_cache.updated_at` zaten mevcut; yeni fetch yok. Saf render mantığı — Dashboard/WatchlistTab'da ticker satırına turuncu badge eklenir. Can fiyatın kaç saatlik olduğunu bilmek istiyor; yanlış fiyatla karar alınmasını önler. 1-2 saatlik iş.

**Alt-task'lar**:
- [ ] **4a Yaş hesabı yardımcısı**: `isPriceStale(updatedAt, thresholdHours=24)` → boolean; `src/utils.js`'e eklenir.
- [ ] **4b Dashboard pozisyon satırı badge**: `isPriceStale` true ise ticker yanına turuncu "Fiyat eski" mini badge (≤20px yükseklik). Hover'da `updated_at` okunabilir formatı gösterir (`data-tip`).
- [ ] **4c WatchlistTab badge** (isteğe bağlı, kapasiteye göre): Aynı badge WatchlistTab satırlarına da eklenir; aynı yardımcı fonksiyon.

**DoD**:
- 24 saatten eski `updated_at` değeri olan ticker satırlarında turuncu "Fiyat eski" badge görünüyor.
- CASH/DEPOSIT sentetik fiyatlar (synthetic inject) bu kuralın dışında; `isPriceStale` bu tipler için false döndürüyor.
- Badge `prc` state'i değiştirmiyor; yalnızca görsel uyarı.
- `npm run check:babel` geçiyor.
- 24 saatin altındaki fiyatlar için badge yok; görsel kirlilik yok.

**Risk**: CASH/DEPOSIT gibi tipler için `updated_at` price_cache'te anlamsız (synthetic); yanlış uyarı verebilir. Mitigation: `isPriceStale` içinde `type==="CASH"||type==="DEPOSIT"||type==="BES"` kontrolü; bu tipler her zaman fresh sayılır.

---

## Out of Scope (bilinçli ertelenenler)

- **Piyasa Dayanıklılık Skoru** `[M][P2]`: 3 alt-task (`resilienceScore` fonksiyonu + MV-weighted hesap + AnalysisTab kartı) toplam ~4-5 saat; tek sprint item olarak değer. Sprint 20 ilk adayı.
- **BES güncel değer aylık güncelleme** `[S][P2]`: `set-manual-price` endpoint hazır; UI sadece bir buton. Sprint 20'ye; Piyasa Dayanıklılık ile birlikte küçük bir sprint tamamlayabilir.
- **TEFAS entegrasyonu** `[L][P1]`: WAF testi önce gerekiyor; büyük scope. Bağımsız sprint.
- **Going Live / Custom Domain**: Birden fazla sprint; bağımsız milestone.
- **Social Faz 2+**: P2, başka sprint.

---

## Demo / Validation

1. **BES breakdown**: Aktif BES pozisyonu → TickerDetailTab aç → "Yatırılan Tutar / Yatırım Getirisi / Devlet Katkısı / DK Getirisi / Toplam Değer" 5 satır görünüyor. "Şirket Bilgisi", "Adet" yok.
2. **BES NULL guard**: `dk_principal=NULL` olan eski BES pozisyonu → TickerDetailTab aç → uygulama çökmüyor; DK satırları "—" gösteriyor.
3. **Sonuç cümleleri**: AnalysisTab → Portföy Sağlık kartı açılır → tablo görünmeden önce tek cümle "X metrik sağlıklı..." yazıyor. Konsantrasyon ve Kur Riski kartları için de aynı.
4. **Temettü**: Tutulan en az 1 US hissesi dividend verisi varsa → Dashboard'da "Bu ay beklenen temettüler" özet satırı görünüyor. Temettü verisi olmayan portföyde satır görünmüyor.
5. **Stale badge**: price_cache'te `updated_at > 24 saat` olan bir ticker var ise → Dashboard satırında turuncu "Fiyat eski" badge görünüyor; CASH/DEPOSIT satırında yok.
6. **Gerileme**: BIST/US pozisyonları, EUR tablosu, temettü satırı (TickerDetailTab), BES DK form — hiçbiri etkilenmemiş.
