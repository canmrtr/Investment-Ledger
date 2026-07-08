# Sprint 29 — 2026-06-22 → 2026-07-05

**Goal**: Altın — portföyün **en büyük dilimi (%41)** ama şu an tamamen "kör": Can bir çeyrek/Cumhuriyet altını için ne kadar **işçilik primi** ödediğini göremiyor. Bu sprint sonunda Can her altın pozisyonunun saf altın değerini ve ödediği primi tek bakışta görür.

**Capacity**: 2 hafta × ~6h/hafta efektif (~12h) — akşam + hafta sonu.

**Tema**: Altın derinleştirme (daily-driver delta — Can'ın en büyük holding'i, en zayıf görünürlük).

## ⚠ Açık karar (sprint başında — spike çözer)

**"Premium" nasıl tanımlanır?** Tarihsel spot fiyatımız yok (yalnız güncel XAU). Üç seçenek:
- **(A) Güncel-spot bazlı** `[M]` — `ödenen avg_cost − güncel saf değer`. Basit (mevcut veri yeter) ama altın alımdan beri değer kazandıysa fark işçilik + fiyat hareketini **karıştırır**. Dürüst etiketle: "Ödediğin − güncel saf değer" (işçilik DEĞİL).
- **(B) Eğitimsel/yapısal** `[S]` — güncel saf birim değeri göster + "küçük birimlerde tipik işçilik ~%5-10" bilgilendirici not. Kişisel kesin prim iddia etmez; en dürüst, en ucuz.
- **(C) Gerçek tarihsel işçilik** `[L]` — alım tarihindeki XAU spot'unu çek (Frankfurter/Massive historical), `avg_cost − alım-tarihi saf` = gerçek ödenen işçilik. En doğru ama [L] (tx tarihi başına historical fetch). **Out of scope** — taşarsa Sprint 30.
- **Spike kararı**: MVP olarak (B) en dürüst ve hızlı; (A) "ödenen vs güncel saf" deltası olarak eklenebilir ama etiketi net olmalı. (C) ertelenir.

## Scope

1. **TR altın işçilik premium göstergesi** — ROADMAP "Asset Type Genişletme" `[M]` `[P2]` (headline)
   - Neden bu sprint: Altın %41 portföyün en büyük dilimi ve en zayıf görünürlük; mevcut altyapı (`GOLD_UNITS` gram+milyem, `goldOzPerUnit`, XAU spot, USDTRY) zaten %80'i hazır → yüksek değer, düşük risk. **Risk-first**: premium tanımı belirsiz → spike (↑) ilk iş.
   - **Spike (ilk iş, ~1-2h)**: (a) premium tanımını yukarıdaki (A/B/C)'den seç; (b) saf-değer hesabını doğrula: `saf_değer_₺ = goldOzPerUnit(unit) × XAU_spot_USD × USDTRY`; (c) `GOLD_UNITS` gram/milyem değerlerini gerçek değerlerle teyit et (çeyrek 1.75g/0.9167 vb.). Sonuç bu dosyaya not düşülür.
   - DoD:
     - Held GOLD pozisyonları için (**oz/gram hariç** — bunlar saf külçe, işçilik yok) TickerDetail (ve/veya Dashboard pos-row) satırı: "Saf altın değeri ₺X · Ödenen ₺Y · Prim %Z" (seçilen tanıma göre etiket).
     - Çoklu birim (çeyrek + Cumhuriyet vb.) doğru ağırlık/milyem ile hesaplanır.
     - XAU spot veya USDTRY yoksa zarif boş (gösterme, hata yok).
   - Risk: (a) premium tanımı (spike çözer); (b) USD→TRY conversion (mevcut `fxRates.USDTRY`); (c) oz/gram için prim göstermeme guard'ı.

2. **GOLD_UNITS'e Reşat + Ata Lirası birimleri** — ROADMAP "Asset Type Genişletme" `[S]` `[P2]` (filler)
   - Neden bu sprint: Headline ile aynı dosya (`GOLD_UNITS`) + aynı domain; ManuelPosForm/AddTab altın birim picker'ında Reşat (~7.2g, 0.916) ve Ata (~7g, 0.916) eksik. Küçük, headline'ı tamamlar.
   - DoD: `GOLD_UNITS`'e `reshat` + `ata` eklenir (doğru gram/milyem); birim picker'da görünür; premium göstergesi bunları da doğru hesaplar.
   - Risk: gram/milyem doğruluğu — spike'ta diğer birimlerle birlikte teyit.

## Out of Scope (bilinçli ertelenenler)

- **(C) Gerçek tarihsel işçilik** (alım-tarihi spot fetch) — [L]; doğru ama pahalı. MVP dürüst bir yaklaşımla (B/A) çıkar, gerekirse Sprint 30.
- **Altın alarm/hedef** — kapsam dışı; premium görünürlüğü yeterli ilk adım.
- **Hesap ekranı genişletme** (şifre/email/silme) — bağımsız going-live teması; Sprint 30 adayı (Sprint 28 Hesap Yönetimi'nin doğal devamı).

## Demo / Validation

- Test hesabında bir GOLD pozisyonu (çeyrek/Cumhuriyet) ile: "Saf altın değeri ₺X · Ödenen ₺Y · Prim %Z" doğru mu? El hesabıyla çapraz doğrula (örn. çeyrek = 1.75g × 0.9167 = 1.604g saf → spot ₺/g × 1.604).
- Oz/gram pozisyonu → prim satırı gizli (saf külçe).
- XAU spot veya FX yoksa → satır gizli, hata yok.
- Reşat/Ata birimi eklenip pozisyon oluşturulabiliyor + prim doğru hesaplanıyor.
- **Canlı doğrulama**: edge/FX'e bağlı olduğundan push sonrası `canmrtr.github.io`'da (localhost CORS edge'i bloklar — Lessons.md 2026-06-21).

## Spike Sonucu (2026-07-08) — ⏸ TEKRAR PARK EDİLDİ

Risk-first spike altyapıyı doğruladı **ama premise'i çürüttü**:
- ✅ `GOLD_UNITS` değerleri standart/doğru; saf değer formülü (`XAU_spot × goldOzPerUnit`) hazır; GOLD=USD → priceCur trap yok.
- 🔴 **Can'ın canlı GOLD pozisyonları sikke değil — hepsi ons külçe**: XAU oz 14.58 @ $1335.71 · XAU null-unit 2 @ $4702.61 · XAG gümüş 100. Hiç çeyrek/Cumhuriyet/Reşat yok.
- İşçilik primi feature'ı oz/gram'ı **kasıtlı hariç tutar** (külçede işçilik yok) → feature tam çalışsa bile Can'ın portföyünde **hiçbir şey göstermez**. "Altın %41 ama işçilik görünmüyor" premise'i geçersiz: o %41 külçe, işçilik primi zaten yok.

**Karar (Can, 2026-07-08)**: Sprint 29 tekrar park. Anlık değer katmıyor. Sikke altın eklenmesi veya (B) külçe "spot vs ödenen" reframe'i gelecekte tetikleyebilir. Feature kodu değersiz değil (multi-user'da sikke tutan kullanıcı için değerli) ama Can'ın kendi daily-driver'ı için öncelik değil.

## Notlar / Bağımlılıklar
- **Frontend-ağırlıklı** — mevcut `GOLD_UNITS`/`goldOzPerUnit`/XAU spot/`fxRates.USDTRY` yeniden kullanılır; yeni edge/tablo beklenmez. (C) seçilirse historical fetch gerekir (o zaman edge dokunulur → `edge-reviewer`).
- **UI işi** → `ui-builder` skill (prim satırı + birim picker). Türkçe, mevcut tasarım sistemi.
- **priceCur kuralı**: altın değer hesabında para birimi karıştırma — saf değer USD hesaplanıp display'de ₺'ye çevrilir (canonical `FEATURE_DETAILS.md` "Currency Handling"; Lessons.md 2026-06-04 ~38x trap).
