# Sprint 23 — 2026-05-21 → 2026-06-04

**Goal**: AnalysisTab artık ezici değil — kullanıcı Analiz sekmesini açtığında önce sade bir "Özet" katmanı görür, derin analiz kartları tek tıkla açılan "Detay" katmanına iner.

**Capacity**: 2 hafta × ~6h/hafta efektif (~12h) — akşam + hafta sonu.

## Scope

1. **AnalysisTab Özet / Detay iki katmana bölünsün** — ROADMAP "Brand Fit & Jargon Temizliği" / `[L]` `[P2]` (headline item)
   - Neden bu sprint: AnalysisTab 15+ kart; ilk açılışta bilgi yükü çok yüksek. Günlük driver ama tarama yorgunluğu yaratıyor. `[L]` etiketli ama tek bir yapısal refactor — slice etmek yerine sprint'in çekirdeği yapılıyor.
   - DoD:
     - **Özet katmanı** (default görünür): Aylık Özet, Varlık/Bölge/Sektör Dağılımı, 6 Aylık Performans, Kur Riski.
     - **Detay katmanı** (tek "Detaylı Analiz ▾" toggle ile açılır): Portföy Sağlık tablosu, Konsantrasyon/HHI, Başa Baş, Kazanan/Kaybeden, Piyasa Düşüşü Dayanıklılığı, Dönem Bazlı Getiri, Toplam Komisyon.
     - Toggle durumu component state (kalıcı LS opsiyonel; gerekirse `il_analysis_detail` device-pref whitelist'e).
     - Başa Baş + Potansiyel Kayıp Detay katmanına taşınır → bağımlı ROADMAP item'ı ("Başabaş tablosu… Detay katmanına taşı") kapanır.
     - Aylık Özet, Özet katmanında Dağılım kartlarının altına yerleşir → "Aylık özet yerleşimi — sayfada daha aşağı" `[P3]` item'ı kapanır.
   - Risk: AnalysisTab tek büyük dosya. **Kritik**: `healthEligible` → Supabase `fund_cache` lazy-fetch'i Detay kapalıyken tetiklenmemeli; aksi halde kullanıcı hiç Detay açmasa bile gereksiz fetch + 422 riski (Sprint 22 #1 banka bulgusu). Mitigation: fetch'i "Detay en az bir kez açıldı" koşuluna bağla; `ui-builder` skill ile çalış, PostToolUse babel hook parse eder.

2. **Design audit Phase-2 — empty-state normalizasyonu + button-like span→button** — ROADMAP "Brand & Design" `[S]×2` `[P2]` (audit #4, #6)
   - Neden bu sprint: Phase-2'nin en temiz, düşük-riskli iki maddesi; heavy `[L]` item'ın yanında "biten ufak iş" verir. Audit #8 (tablet breakpoint) ve #10 (inline flash class) Sprint 22'de zaten kapandı — Phase-2'de kalan gerçek iş 4 madde.
   - DoD:
     - Tüm empty-state'ler `.empty-card` (`.ic` + `.ttl` + `.sub` + opsiyonel CTA) patternine hizalanır; TickerDetailTab "işlem yok" `div.dim` + AnalysisTab grafik `.empty` sınıfları dahil.
     - Tıklanabilir `<span>`/`<div>` öğeleri gerçek `<button>` + `aria-label`'a çevrilir (a11y; konsantrasyon risk satırları gibi `cursor:pointer` inline'lar dahil).
   - Risk: Düşük. CTA'sız empty-state'ler için pattern (ikon+başlık+alt metin, buton yok) net tutulmalı.

## Out of Scope (bilinçli ertelenenler)

- Design audit Phase-2 #7 (kart/panel konsolidasyon) ve #9 (tooltip tutarlılığı) → Sprint 24.
- "AnalysisTab 15 kart bölüm başlıkları" — mevcut 4 bölüm başlığı yeterli; Özet/Detay split sonrası yeniden değerlendirilir.
- TEFAS entegrasyonu, fundamental değerleme okunabilirliği, Layer-2 nudge temaları — sonraki sprint adayları.

## Demo / Validation

- Canlı app'te Analiz sekmesi açılır → ilk ekranda yalnızca Özet katmanı (4 kart) görünür, Detay kapalı.
- "Detaylı Analiz ▾" toggle → Detay kartları açılır; Network tab'da `fund_cache` fetch'in **ilk toggle'da** tetiklendiği doğrulanır (kapalıyken fetch yok).
- Mobil 380px + tablet 768px'te iki katman düzgün render; toggle dokunma hedefi ≥36px.
- `test-runner` agent ile Analiz akışı smoke (DO NOT modify source — report only); `npm run check:babel` gate yeşil.

---

## Retro (2026-05-25, sprint window'undan 10 gün önce kapandı)

Sprint, planlanandan çok daha hızlı kapandı. Headline iş (AnalysisTab Özet / Detay iki katmana bölünmesi) sprint başlangıcının ertesi günü 2026-05-22'de shipped — `fund_cache` lazy-fetch dahil Playwright ile doğrulanmış (Detay kapalıyken 0 fetch, ilk toggle'da 1). Carry-over Phase-2 maddeleri (#4 empty-state + #6 button-like span→button) bugün (2026-05-25) iki ayrı commit'te ship edildi: `710857a` TickerDetailTab "işlem yok" `.dim` → `.empty-card` + `.empty` CSS comment, `8a54c56` HistoryTab ticker link span + AnalysisTab konsantrasyon row → `<button>` (a11y).

**Sürprizler**: (1) SearchTab.js:85 watchlist toggle audit-grep'te `cursor:pointer` ile yakalanmıştı ama zaten `<button type="button" aria-label="…" aria-pressed={…}>` — false positive, conversion gerekmedi. İlk plan 4 conversion içeriyordu, gerçekte 2 yetti. (2) AnalysisTab `.empty` (8 lokasyon) ilk plan'da "muhtemelen `.empty-card`'a hizalanmalı" sayılmıştı, exploration'da bunların **bilinçli olarak farklı** olduğu (in-card subsection placeholder vs full-section empty) netleşti — CSS comment ile distinction lock'landı.

**Carry-over**: Phase-2 #7 (kart/panel konsolidasyon) ve #9 (tooltip tutarlılığı) Sprint 25+ adayı olarak ROADMAP'te kaldı. Sprint 24 = TEFAS entegrasyonu olarak ayrı planlandı (`sprints/sprint-24.md`). Total Sprint 23 commit sayısı: ~3 (headline `67f24da` + Phase-2 `710857a`+`8a54c56`).

**Capacity öğrenmesi**: 12h tahminli sprint ~4-5h'de bitti. Headline `[L]` etiketli olmasına rağmen tek bir yapısal CSS `order`-based split olarak ele alındığında modular işti. Gelecek `[L]` item'larda "bütün'i tek seferde refactor mu, slice mı" ayrımını daha net yapmak gerek.
