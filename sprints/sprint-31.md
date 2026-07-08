# Sprint 31 — 2026-07-08 → 2026-07-21

**Goal**: Günlük dashboard/analiz daha okunur — Can aracı kurum dağılımını tek bakışta görür, sparkline'da tarih/değer okur, ve filtre bar'ı scroll'da kaybolmaz. Düşük risk, hızlı çıkan görsel iyileştirmeler; yeni veri/edge bağımlılığı yok.

**Capacity**: 2 hafta × ~6h/hafta (~12h). Üç `[S]` item, hepsi frontend + mevcut altyapı.

**Tema**: Görselleştirme polish (daily-driver okunabilirlik). Kaynak: ROADMAP "Görselleştirme" + "Analiz Tab" backlog; Sprint 31 adayı (Can seçti 2026-07-08).

> **Premise-check yapıldı (2026-07-08)** — gold dersinden sonra: canlı veride **broker alanı zengin** (Akbank 14 · QNB 9 · boş 8 · Midas 6 · YKB 1 · Qnb 1). Feature Can'ın portföyünde gerçek dağılım gösterir. ⚠ İki data-quality noktası ele alınacak: (1) **"QNB" vs "Qnb"** case tutarsızlığı → tek dilim olmalı (case-insensitive grup); (2) 8 boş broker → "Atanmamış" kovası.

## Scope

1. **Broker Dağılımı Pie Chart** — ROADMAP "Görselleştirme" `[S]` `[P2]` (headline)
   - AnalysisTab'da Varlık/Bölge/Sektör kartlarının yanına "Aracı Kurum Dağılımı" collapsible kartı; `positions.broker` alanından **piyasa değeri** ağırlıklı. Mevcut `buildSlicesPath` (AnalysisTab:235) + `.pie-row`/`.pie-sw` yeniden kullanılır (yeni pie altyapısı yazma).
   - DoD:
     - Slice'lar MV-ağırlıklı; display currency toggle'a uyar (mevcut `allDisp` normalize pattern'i).
     - **Case-insensitive gruplama**: "QNB" + "Qnb" tek dilim (normalize: trim + tek casing; görünen etiket ilk/başat yazım).
     - Boş broker → "Atanmamış" dilimi (gizleme — kullanıcıya eksik atamayı gösterir).
     - CASH/DEPOSIT hariç (broker'sız); collapsible, default kapalı; TYPE_COLORS yerine nötr/hash-based palet (broker'lar type değil).
     - `mask()` gizli modda değerleri sarmalar.
   - Risk: broker string kirliliği (case/whitespace) — normalize helper ile; komisyon KPI'daki `(t.broker||"Bilinmiyor").trim()` pattern'i baz al ama case ekle.

2. **Sparkline hover interactivity** — ROADMAP "Görselleştirme" `[S]` `[P2]` (filler)
   - Dashboard portföy sparkline'ında hover'da değer + tarih tooltip; SVG `<circle>` cursor + dikey kılavuz çizgi. `TefasNavSparkline` (TickerDetailTab:371) zaten benzer SVG trend pattern'i — oradaki yaklaşımı referans al.
   - DoD:
     - Hover'da en yakın nokta değeri + tarihi `[data-tip]` veya inline label ile; mouse-leave'de temizlenir.
     - Touch cihazda zarif (tap → en yakın nokta; ya da mobilde skip — masaüstü öncelikli).
     - Değer `fmt`/`mask` ile; tarih `fmtDateTR`.
   - Risk: sparkline'ın hangi seri ile beslendiği (gerçek geçmiş yok — mevcut sparkline neyi çiziyor? spike'ta teyit et; yalnız var olan seriye hover ekle, yeni veri kaynağı ekleme).

3. **Dashboard filtre bar'ı (`.fbar`) sticky** — ROADMAP "Görselleştirme" `[S]` `[P2]` (filler)
   - `.fbar` chip bar `position:sticky; top:<topbar-height>`; topbar yüksekliği `--topbar-h` CSS custom property ile yönetilir (magic number değil).
   - DoD:
     - Dashboard'da varlık türü filtre bar'ı scroll'da topbar'ın hemen altına yapışır; z-index topbar altında, içerik üstünde.
     - Mobilde de çalışır (bottom-tabs ile çakışmaz).
     - `--topbar-h` tanımlanır ve topbar + sticky bar ikisi de referans alır (tek kaynak).
   - Risk: `.fbar` kesin konumu (Dashboard mı AnalysisTab mı ikisi mi) — spike'ta teyit; sadece Dashboard hedefleniyor.

## Out of Scope (bilinçli ertelenenler)
- **Pie → stacked bar migrasyonu** (Varlık/Bölge/Sektör) — ayrı `[M]` item; bu sprint yalnız broker pie ekler, mevcut pie'ları değiştirmez.
- **Pie segment selection / legend tıklanabilirlik** — ayrı `[M]` item.
- **Broker normalize'ı DB'de düzeltme** (QNB/Qnb kalıcı merge) — bu sprint yalnız görüntüde normalize eder; kalıcı veri temizliği ayrı (istenirse ManuelPosForm broker dropdown'ı ile).
- **Fundamental ratio trend / gerçek tarihsel MV sparkline** — Vite/`portfolio_snapshots` bağımlısı, uzun vade.

## Demo / Validation
- Broker pie: AnalysisTab'da "Aracı Kurum Dağılımı" açılır; Akbank/QNB/Midas/Atanmamış dilimleri MV ile doğru; **QNB tek dilim** (Qnb ayrı görünmüyor); $/₺ toggle çevirisi tutuyor; gizli modda maskeli.
- Sparkline: Dashboard sparkline'da hover → tarih+değer okunuyor, leave'de temizleniyor.
- Sticky bar: Dashboard scroll → filtre chip'leri topbar altına yapışıyor, içerik altından kayıyor.
- **Canlı doğrulama**: display-cur + gerçek pozisyonlara bağlı → push sonrası `canmrtr.github.io` hard-reload (SW `.js` network-first, bump gerekmez; index.html değişmezse).

## Notlar / Bağımlılıklar
- **Tamamen frontend** — `positions.broker` + mevcut `buildSlicesPath`/`.pie-row`/sparkline SVG; yeni edge/tablo/migration yok.
- **UI işi** → `ui-builder` skill. Türkçe, mevcut tasarım sistemi (TYPE_COLORS broker'a uymaz → nötr palet).
- **priceCur kuralı**: broker MV toplamı display cur'a `allDisp` normalize pattern'i ile çevrilir (natural-cur karıştırma → ~38x trap; Lessons 2026-06-04).
- **`--topbar-h`**: yoksa oluştur; hem topbar hem sticky `.fbar` referans alsın (magic px değil).
