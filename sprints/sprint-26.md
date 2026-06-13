# Sprint 26 — 2026-06-19 → 2026-07-02

**Goal**: TEFAS fonları artık "kör nokta" değil — Can her TEFAS fonunun son ~6 ayın NAV trendini sparkline'da görür ve Dashboard'da günlük/haftalık değişimini diğer varlıklar gibi okur. Ayrıca portföyü bir günde sert düştüğünde, karar vermeden önce tezini sorgulatan ilk davranışsal nudge devreye girer.

**Capacity**: 2 hafta × ~6h/hafta efektif (~12h) — akşam + hafta sonu.

**Tema**: Karma — TEFAS derinleştirme (headline) + Layer-2'ye ilk somut adım (filler). Can'ın seçimi (2026-06-13).

## Scope

1. **TEFAS historical NAV + sparkline** — ROADMAP "Sonraki Adım" aday #2 (unblocked 2026-06-13) `[M]` `[P2]` (headline)
   - Neden bu sprint: 2026-06-13'te TEFAS uçtan uca gerçek kullanım onaylandı (fon eklendi → Dashboard'da göründü → canlı NAV çekildi). Shipped Sprint 24 işinin doğal devamı; Can'ın artık fiilen kullandığı varlık için günlük-driver delta. **Risk-first**: TEFAS historical endpoint'i bilinmiyor → sprint başında spike.
   - **Spike (ilk iş, ~1-2h)**: TEFAS'ın NAV zaman serisi endpoint'ini bul + test et. `tefas.gov.tr/api/funds/fonFiyatBilgiGetir`'in tarih-aralıklı (`bastarih`/`bittarih`) çağrısı zaman serisi dönüyor mu? Dönüyorsa son ~6 ay NAV listesi alınır. Spike sonucu bu dosyaya not düşülür; dönmüyorsa fallback'e (↓) geçilir.
   - DoD:
     - `fetch-prices` `isTefas` dalı `mode:"historical"` çağrısında son ~6 ayın NAV serisini döndürür (spike'ta doğrulanan endpoint ile).
     - `price_cache` TEFAS satırlarında mevcut `p_d1/p_w1/p_m1/p_m3/p_m6/p_y1` alanları doldurulur (diğer varlık tiplerinin kullandığı aynı şema; yeni kolon yok). `refresh-price-cache` cron TEFAS dalında da hesaplar.
     - TickerDetailTab'da TEFAS fonu için NAV sparkline render olur (mevcut sparkline bileşeni yeniden kullanılır; US/BIST ile aynı pattern).
     - Dashboard TEFAS pos-row'unda günlük % değişim badge'i (diğer varlıklar gibi) görünür.
   - Risk: (a) Historical endpoint yoksa/güvenilmezse → **fallback**: cron snapshot'larından ileriye-doldurma (yalnız cron çalıştıkça nokta birikir; "geçmiş henüz oluşuyor" gri durumu). Bu kabul edilebilir degradasyon, sprint'i bloklamaz. (b) TEFAS NAV küçük ondalık (1.92 gibi) → sparkline ölçek/format guard. Mitigation: spike'ta gerçek seri ile format doğrula.

2. **Piyasa düşüş nudge'ı** — ROADMAP "Akıllı Öneriler & Nudge" Katman 2 `[S]` `[P2]` (filler)
   - Neden bu sprint: Headline'dan artan yarım güne en ucuz, en düşük riskli iş — **yeni fetch yok**, mevcut `price_cache.p_d1` verisi. Platform vizyonu Katman 2'ye ilk somut adım (davranışsal koç yörüngesi).
   - DoD:
     - MV-ağırlıklı portföy günlük değişimi `price_cache.p_d1`'den hesaplanır; ≤ -%5 ise Dashboard'da (KPI civarı, üstte) nudge kartı: "Portföyün bugün -%X düştü. Tezin hâlâ geçerli mi?"
     - Kapatılabilir (dismiss); aynı gün susturulur — user-scoped LS key `il_nudge_drop_<userId>` (o günün tarihini tutar; ertesi gün resetlenir).
     - Empty/normal gün (düşüş < %5 veya veri yok) → nudge tamamen gizli, hata yok.
   - Risk: -%5 eşiği nadiren tetiklenir → manuel test zor. Mitigation: geçici mock `p_d1` değeriyle render'ı doğrula; eşik sabiti tek yerde (kolay tune). Nudge metni nötr/destekleyici tonda — panik yaratma.

## Out of Scope (bilinçli ertelenenler)

- **Diğer Layer-2 nudge'ları** — büyük kazanç tez-kontrol nudge'ı + SearchTab FOMO banner'ı sonraki Layer-2 sprint'ine. Bu sprint'te odak dağılmasın diye **tek nudge**.
- **TEFAS fundamentals** — TEFAS fonlarının İş Yatırım/FMP fundamental verisi yok; kapsam dışı (AnalysisTab `isFundEligible` zaten hariç tutuyor).
- **Sektör-aware F/K eşikleri** — ROADMAP'ten tamamen kaldırıldı (2026-06-13, Can kararı).

## Demo / Validation

- **TEFAS sparkline**: Test hesabındaki TEFAS fonuna (YAC — 2026-06-13'te eklendi) TickerDetailTab'dan bak → 6 aylık NAV sparkline görünüyor mu? Dashboard TEFAS satırında günlük % badge dolu mu? Edge case: yeni eklenen, geçmişi olmayan TEFAS fonu → sparkline zarif boş ("geçmiş oluşuyor"), hata yok.
- **Nudge**: Geçici mock ile portföy günlük değişimini -%6 yap → nudge belirsin; dismiss → günün geri kalanı susturulsun; sayfa yenile → hâlâ susturulmuş. Normal gün → nudge yok.
- **Hesap sınırı**: Doğrulama test hesabında (`canmerter@me.com`) yapılır — Can'ın gerçek hesabından ayrı; gerekirse test hesabına TEFAS fonu + geçmiş eklenir.
- Başarı sinyali: Can bir TEFAS fonunun "yükseliyor mu / düşüyor mu" sorusuna sparkline'a tek bakışta yanıt verir; sert düşüş gününde uygulama ona dürtüyü gösterir.

## Notlar / Bağımlılıklar
- **Sprint 25 carry-over**: AnalysisTab F/K cümlesi + TickerDetail fundamental özet satırının canlı `fund_cache` verisiyle render doğrulaması hâlâ açık (Sprint 25'in tek "Kalan" maddesi). Sprint 26 başında deploy sonrası birlikte doğrula.
- Edge fn değişikliği (`fetch-prices`, muhtemelen `refresh-price-cache`) → deploy öncesi `edge-reviewer` agent + drift check (`npm run check:edge-drift`).
