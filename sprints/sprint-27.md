# Sprint 27 — 2026-07-03 → 2026-07-16

**Goal**: Davranışsal koç (Katman 2) tek bir nudge'dan bir *sisteme* dönüşür — Can yalnız portföyü düştüğünde değil, bir pozisyonu sert yükseldiğinde ("tezin hâlâ geçerli mi?") ve aramada aşırı-konuşulan bir hisseye bakarken (FOMO uyarısı) de karar sürtünmesi yaşar. Hepsi mevcut `price_cache` verisinden; yeni fetch yok.

**Capacity**: 2 hafta × ~6h/hafta efektif (~12h) — akşam + hafta sonu.

**Tema**: Layer-2 derinleşme — Sprint 26'nın açtığı nudge altyapısının DRY devamı.

## Önkoşul / Bağımlılık (sprint başında doğrula)

Bu sprint **Sprint 26 #2 (piyasa düşüş nudge'ı)** ile gelen altyapıya dayanır:
- MV-ağırlıklı portföy değişim hesabı (`price_cache.p_d1` → genelleştir `p_m1`'e).
- Dismiss + gün/30-gün susturma kalıbı, user-scoped LS key (`il_nudge_drop_<userId>` → ticker-scoped varyant).
- Dashboard'da nudge kartı render konumu (KPI civarı).

**Sprint 26 #2 ship etmediyse**: ilk iş onu kapatmak (carry-over) — bu sprint'in #1'i onun üstüne kurulur. Plan başında `sprints/sprint-26.md` durumunu kontrol et.

## Scope

1. **Büyük kazanç tez-kontrol nudge'ı** — ROADMAP "Akıllı Öneriler & Nudge" Katman 2 `[S]` `[P2]` (headline-A)
   - Neden bu sprint: Sprint 26 nudge altyapısının en ucuz devamı — aynı dismiss/sustur kalıbı, ters yönde sinyal (kazanç). Davranışsal koç yörüngesinde "kayıpta panik" kadar "kazançta aşırı-güven" de hedef.
   - DoD:
     - Held pozisyon son ~30 günde `price_cache.p_m1 > %25` ise TickerDetailTab'da (ve/veya Dashboard pos-row'da) nudge: "TICKER son ayda %X büyüdü. Orijinal tezin hâlâ geçerli mi?"
     - Ticker-scoped 30-gün susturma: aynı ticker için dismiss → 30 gün tekrar gösterilmez. LS key `il_nudge_gain_<userId>` (ticker → dismiss tarihi map).
     - `p_m1` yoksa / ≤ %25 ise nudge gizli, hata yok.
   - Risk: Eşik (%25) çok sık/seyrek tetiklenebilir → tek sabitte tut (kolay tune). Nudge tonu nötr — "sat" demez, tezi sorgulatır.

2. **SearchTab FOMO uyarı banner'ı** — ROADMAP "Akıllı Öneriler & Nudge" Katman 2 `[M]` `[P2]` (headline-B)
   - Neden bu sprint: Aynı Layer-2 temasının discovery yüzeyindeki karşılığı; arama anı = satın alma niyetinin en yüksek olduğu an, nudge için en değerli nokta. Basit versiyon tamamen frontend.
   - DoD:
     - SearchTab sonuç satırında (veya ticker detayına geçişte) `price_cache.p_m1 > %30` ise banner: "Bu hisse son 30 günde çok hareketlendi. FOMO mu, tez mi?"
     - Yalnız cache'te `p_m1` olan ticker'lar için; veri yoksa banner yok (sessiz).
     - Banner dismiss edilebilir veya pasif-bilgilendirici (panik yaratmayan ton) — UI kararı ui-builder skill'inde netleşir.
   - Risk: SearchTab ~11k ticker + 3510 TEFAS fonu render ediyor; banner per-row hesabı performansı bozmamalı. Mitigation: yalnız görünür/eşleşen sonuçlar için `p_m1` lookup; cache map'inde yoksa atla.

## Out of Scope (bilinçli ertelenenler)

- **Katman 3 (Koç Sekmesi)** — felsefe onboarding + uyum skoru sonraki faz; bu sprint hâlâ Katman 2 nudge'larını tamamlıyor.
- **Yeni pozisyon ekleme checklist nudge'ı** (AddTab tez sorusu) — dördüncü Layer-2 nudge; odak dağılmasın diye bu sprint'e alınmadı, Sprint 28 adayı.
- **Hesap Yönetimi canlı-sistem önkoşulları** — bağımsız bir tema; Layer-2 batch'i bitince ayrı sprint olarak ele alınır (Sprint 28 top adayı).

## Demo / Validation

- **Kazanç nudge'ı**: Test hesabında bir ticker'ın `price_cache.p_m1`'ini geçici %30 yap → TickerDetailTab'da nudge belirsin; dismiss → 30 gün sustur; sayfa yenile → hâlâ susturulmuş. `p_m1` düşük olan ticker → nudge yok.
- **FOMO banner**: SearchTab'da `p_m1 > %30` olan bir ticker ara → banner görünür; `p_m1` olmayan/düşük ticker → banner yok. 11k+ sonuç render'ında belirgin yavaşlama olmamalı.
- **Hesap sınırı**: Doğrulama test hesabında (`canmerter@me.com`), Can'ın gerçek hesabından ayrı.
- Başarı sinyali: Üç farklı bağlamda (kayıp / kazanç / arama) uygulama Can'a karar öncesi bir an düşündürür — Katman 2 "davranışsal nudge" katmanı bir sistem olarak çalışır.

## Notlar / Bağımlılıklar
- **Yeni fetch yok** — üç nudge da mevcut `price_cache.p_d1/p_m1`'den; edge fn değişikliği beklenmiyor. Edge dokunulursa `edge-reviewer` + drift check.
- **UI işi** → `ui-builder` skill (nudge kartı + banner = yeni görsel bileşen). Nudge metinleri Türkçe, nötr/destekleyici ton (panik/FOMO körükleme yok).
- **DRY**: Sprint 26 nudge kalıbını (`computeNudges()` benzeri tek yer + LS susturma helper'ı) genelleştir; üç nudge tek util'den türesin — kopyala-yapıştır değil.
