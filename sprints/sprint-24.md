# Sprint 24 — 2026-06-05 → 2026-06-18

**Goal**: Can artık TEFAS yatırım fonlarını portföyüne ekleyebilir; fiyatlar 6 saatte bir otomatik güncellenir; Dashboard'da ₺ TEFAS bloğu, AnalysisTab'da lime dilim ve Türkiye bölgesi olarak görür.

**Capacity**: 2 hafta × ~6h/hafta efektif (~12h) — akşam + hafta sonu.

## Scope

1. **TEFAS Yatırım Fonu entegrasyonu** — ROADMAP "Asset Type Genişletme" `[L]` `[P1]` (headline, 9 alt-task)
   - Neden bu sprint: Bloker (TEFAS WAF) Sprint 22'de temizlendi — yeni JSON endpoint `fonFiyatBilgiGetir` çalışıyor (2026-05-19 doğrulandı, 200 OK). Yıllardır en büyük asset gap; Can'ın gerçek portföyünde manuel takip ettiği fonlar var. 9 alt-task hep `[S]` etiketli — kümülatif ~10-12h, sprint kapasitesine sığar. Tasarım + plan dosyaları zaten hazır: `docs/superpowers/specs/2026-05-13-tefas-integration-design.md` + `docs/superpowers/plans/2026-05-13-tefas-integration.md`.
   - DoD (uçtan uca akış):
     - AddTab → Manuel'de "TEFAS Fonu" picker'ı ile fon kodu seçilebilir (≥6 karakter), pozisyon eklenir.
     - Dashboard'da yeni "TEFAS Fonları" bloğu ₺ cinsinden toplam değer + per-pozisyon satırlar gösterir.
     - SearchTab `tefas_funds` katalogundan kod + isim ile aranabilir; lime badge ile ayırt edilir.
     - AnalysisTab: Varlık Dağılımı'nda lime dilim; Bölge Dağılımı'nda Türkiye altında; Fundamentals checklist'inden hariç (US/BIST hisse benzeri metrikler yok).
     - `fetch-prices` `asset_type:"TEFAS"` routing'i çalışır; günlük NAV fiyatı `tefas.gov.tr` API'sinden `price_cache`'e yazılır.
     - `refresh-price-cache-6h` cron job'ı `type IN (...)` allowlist'ine `TEFAS` ekler — 6 saatte bir otomatik güncellenir.
     - Settings → Bakım'da "TEFAS Katalog Yenile" butonu (~1000 fon, `fetch-fundamentals mode:"tefas-catalog"`).
   - Alt-task'lar (sırayla):
     1. `fetch-prices isTefas` routing + tek-fon NAV fetch'i `[S]` (~1.5h, backend)
     2. `tefas_funds` SQL migration + RLS (paylaşımlı, anon+auth read, service_role write) `[S]` (~1h, `sql-writer` skill + `rls-auditor` agent)
     3. Frontend sabitler: `TYPE_COLORS.TEFAS:"#84CC16"`, `displaySym` TL, `BLOCK_TYPES`, `ASSET_ICONS` `[S]` (~0.5h)
     4. `fetch-fundamentals mode:"tefas-catalog"` katalog yükleme `[S]` (~1.5h, backend)
     5. AddTab Manuel TEFAS picker `[S]` (~1.5h, `ui-builder` skill)
     6. SearchTab `tefas_funds` birleşik arama + lime badge `[S]` (~1.5h)
     7. AnalysisTab `REGION_OF`, `priceCurOf`, Fundamentals exclusion `[S]` (~1h)
     8. Settings "Katalog Yenile" butonu `[S]` (~0.5h)
     9. `refresh-price-cache` cron allowlist'ine TEFAS ekleme + deploy `[S]` (~1h)
   - Risk:
     - **WAF rebound**: Yeni JSON endpoint TEFAS tarafında geri kapatılırsa cron job sessizce kırılır. Mitigation: edge fn'ye `null` NAV durumunda console.error + `price_cache.price` güncellemesini skip (eski fiyat görünür kalsın, kullanıcıya açık hata mesajı). Sprint 22 `İş Yatırım izleme` pattern'i.
     - **Katalog büyüklüğü**: ~1000 fon tek seferde insert → potansiyel Supabase batch limit. Mitigation: 100'erli batch insert; `fetch-fundamentals` `tefas-catalog` mode'unda chunk loop.
     - **`type` enum check constraint**: `positions.type` ve `transactions.asset_type` CHECK varsa migration gerekir. **Önce DB schema kontrol et.**
     - **`edge-reviewer` agent**: `fetch-prices` ve `fetch-fundamentals` edit sonrası mutlaka çağır (deploy öncesi).

2. **Boş durum metinlerini kullanıcı diline çevir** — ROADMAP "Brand Fit & Jargon Temizliği" `[S]` `[P2]` (companion)
   - Neden bu sprint: TEFAS yeni asset type → yeni empty state'ler ("Henüz TEFAS fonu yok", "Katalog yükleniyor..."). Mevcut sertçe-Türkçe ifadeleri (`"snap. yok"`, `"Bilinmiyor"`) toplu temizlik için doğal an. Sprint kapasitesinin son 1-1.5 saati.
   - DoD:
     - `"snap. yok"` → `"Veri henüz oluşmadı"` (AnalysisTab grafik empty state'leri).
     - `"Bilinmiyor"` sektör/bölge → `"Henüz sınıflandırılmadı"`.
     - TEFAS empty state'leri user-friendly Türkçe: "Henüz TEFAS fonu eklemediniz · İlk fonunu ekle →" CTA pattern.
   - Risk: Düşük. String değişikliği; UI test gerekmez.

## Out of Scope (bilinçli ertelenenler)

- **TEFAS performans/fundamentals**: NAV trendi, YTD getiri, expense ratio gibi fon-spesifik metrikler. Sprint 24 yalnızca **NAV takibi**. Detaylı analiz sonraki sprint adayı.
- **TEFAS yıllık/aylık historical NAV**: `price_cache.p_d1/w1/m1/y1` boş kalır (1. iterasyon); sparkline ve % delta yok. Sprint 25+ adayı.
- **Design audit Phase-2 kalanı** (#7 kart konsolidasyon, #9 tooltip): Sprint 25 adayı.
- **Değerleme okunabilirliği** (Fundamental Checklist özet+detay, portföy F/K KPI): Sprint 25 adayı.
- **Eski Sprint 23 carry-over** (#4 empty-state, #6 button-like span→button): Sprint 23 kendi window'unda (→ 2026-06-04) kapanmalı; Sprint 24'e taşınmaz. Açık kalırsa Sprint 25 başında değerlendir.

## Demo / Validation

- **Manuel akış**: AddTab → Manuel → "TEFAS Fonu" → fon kodu (örn. "TKF" = Türkiye Sınai Kalkınma Bankası A.Ş. Kısa Vadeli Borçlanma Araçları Fonu) seç → 1000 pay × güncel NAV ekle → Dashboard'da "TEFAS Fonları" bloğu açık, ₺ değer doğru.
- **Cron doğrulama**: Manuel olarak `refresh-price-cache` çağır (`CRON_SECRET` ile); TEFAS pozisyonu için `price_cache.price` güncellenir, `updated_at` bumped.
- **AnalysisTab**: Varlık Dağılımı'nda lime dilim ve yüzde; Bölge Dağılımı'nda Türkiye payı; Fundamentals Checklist'i TEFAS pozisyonu yok sayar (eligibility filtresinde değil).
- **SearchTab**: "kalkınma" arandığında TEFAS sonuçları US/BIST sonuçlarının altında lime badge ile listelenir.
- **Mobile**: 380px Dashboard TEFAS bloğu, AddTab picker dokunma hedefi ≥44px, SearchTab badge kesilmiyor.
- **Pre-deploy gate**: `npm run check:babel` + `npm run check:edge` + `npm run check:edge-drift` yeşil.
- **Agent zinciri**: `sql-writer` skill (alt-task 2) → `rls-auditor` agent → `rls-empirical-tester` agent → `edge-reviewer` agent (alt-task 1, 4, 9) → `test-runner` agent (smoke) → manuel deploy.

---

## Retro (sprint sonunda doldurulacak)

_(Ne çıktı, ne kaldı, neden — bir paragraf.)_
