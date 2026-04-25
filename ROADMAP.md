# Roadmap / Idea Backlog

Fikir havuzu — öncelik henüz belirlenmedi, planlama için biriktiriliyor.

İlk toplama: **2026-04-24**

## Asset Type Genişletme

- [ ] BIST hisseleri (provider + edge function)
- [ ] Altın / emtia (gram, ons; TL & USD fiyat)
- [ ] Türkiye fonları (TEFAS entegrasyonu)
- [ ] Vadeli mevduat (faiz oranı, vade, getiri hesabı)

## Görselleştirme

- [x] ~~Pie chart: varlık türlerine göre dağılım~~ (2026-04-24, cost/market toggle'lı)

## Navigasyon & Sayfalar

- [ ] Her yatırım türü için ana sayfadan ayrı sayfa / tab
- [ ] Hisse başı detay sayfası (özet + işlem geçmişi + fundamental + haber)
- [ ] **Portföy Analiz sayfası** — yeni sekme. İçerik/kapsam sonra detaylandırılacak.

## Fundamental & Analiz

- [x] ~~Fundamental data provider bulma~~ → **Financial Modeling Prep (FMP)** seçildi (2026-04-25)
- [x] ~~Fundamental veri çeken edge function~~ (`fetch-fundamentals`, 21 metrik, 2026-04-25)
- [x] ~~TickerDetailTab içinde checklist görünümü~~ (renk kodlamalı, 7 gün LS cache, 2026-04-25)
- [ ] Fundamental data Supabase'te saklama (yeni tablo) — şu an LS cache yeterli; çok user'da merkezi cache
- [ ] Kullanıcı kendi eşiklerini tanımlasın (ör. PE < X, ROE > Y) — şu an top-level `FUND_THRESHOLDS` sabit
- [ ] FMP free tier sınırını test et + rate limit guard ekle
- [ ] Benchmark karşılaştırması: portföy vs SPY / QQQ / BIST100
- [ ] **Sektör-aware eşikler** — tech için P/E ≤30, utility için ≤15 vs.; ticker'ın `sic_description` veya FMP `sector` ile profile seç
- [ ] **Portföy-geneli checklist tablosu** — tüm US_STOCK pozisyonlar için tek tablo, her sıra ticker, kolon kriter, skoru özet
- [ ] Tarihsel fundamental trend — son 5 yıl gelir/marj/ROE eğrisi (mini chart, FY'leri y/y göster)
- [x] ~~**SEC EDGAR fallback**~~ (FMP boşluğunu doldur, 2026-04-25) — companyfacts API + module-level CIK cache (24h TTL). FMP `Special Endpoint` 402 → EDGAR'a düşer. 19/21 metrik EDGAR'dan derive (PE/PS şu an null; market price entegrasyonu ileride).
  - [ ] Iterate: PE/PS için EDGAR shares + fetch-prices ile market cap hesabı (`CommonStockSharesOutstanding` × current price)
  - [ ] Ticker→CIK mapping'i Supabase'e taşı (cold start latency'sini azalt)
- [ ] **Twelve Data fallback (BIST için, opsiyonel)** — `XIST` exchange free tier (800/gün); SEC bitince ve THYAO/ASELS gibi BIST hisseleri eklemek istersek

## İçerik

- [ ] Haber entegrasyonu (ticker bazlı; yine provider gerek)

## Öğrenme & Eğitim

- [ ] **Investment Basics** — uygulama içi temel finansal okuryazarlık modülü
  - Compound interest (bileşik faiz)
  - Diversification (çeşitlendirme)
  - Risk-return ilişkisi
  - Asset allocation (varlık dağılımı stratejileri)
  - Dollar-Cost Averaging
  - P/E, ROE, EPS gibi temel oranların ne anlama geldiği
  - Format: kısa makaleler / kart serisi / interaktif "lesson" gibi
  - Yeni kullanıcılar için onboarding ile entegre olabilir

## Sosyal & Kişiselleştirme

- [ ] Yatırımcı risk profili (anket → muhafazakar / dengeli / agresif)
- [ ] Social feed: benzer risk profilindeki yatırımcıların pozisyonları
  - Privacy: opt-in gerekli, anonim toplam görünümler

## Hesap Yönetimi

- [ ] Account / Profil ekranı (yeni sekme)
  - Şifre değiştirme (Supabase `auth.updateUser({password})`)
  - Kullanıcı adı (username) — profile tablosu + unique constraint
  - Email değiştirme (Supabase verifikasyonlu)
  - Hesap silme (tüm verinin cascade delete'i)
  - Avatar / profil resmi (opsiyonel)

## Search

- [x] ~~**Global ticker arama**~~ — Yeni "Ara" sekmesi (Variant C). SEC EDGAR ticker DB (10k+ US hisse) edge function üzerinden proxy + LS cache (24h). Match: ticker prefix + şirket adı substring. Portföydekiler ayrı bölüm "açık" badge ile. Sonuca tıklanınca TickerDetailTab non-held mode'da açılır (meta + fundamental, position summary gizli, "+ Ekle" CTA aktif). (2026-04-25)

## UI Polish

- [x] ~~**Adet kolonu trailing-zero temizliği**~~ — `fmtShares()` helper'a alındı, 7 site güncellendi (2026-04-25)
- [ ] **Fundamental "ticker kapsam dışı" mesajı** — FMP 402 + "Special Endpoint" body'si geldiğinde edge function spesifik error code (örn. `"OUT_OF_PLAN"`) dönsün; FE bunu kırmızı `err` yerine turuncu `warn-card` ile "Bu ticker FMP free planında yok — alternatif provider gerekiyor" şeklinde göstersin. NOW gibi küçük/orta hisselerde tetikleniyor.
- [ ] **Asset type seçimi → ekleme akışı** — "+ İşlem Ekle" / FAB gibi context-free butonlardan girildiğinde, formu açmadan önce kullanıcıya asset type (US_STOCK / BIST / FUND / CRYPTO / GOLD / FX) seçtir. AddTab default açıldığında bu adım görünür; kullanıcı seçince form gelir + type pre-fill'lenir. Detay sayfasının "+ Ekle" butonu gibi context'ten gelenlerde bu adım atlanır (ticker'ın type'ı zaten biliniyor).

## Bug & UX Backlog

- [x] ~~**iOS Chrome zoom**~~ — input font-size 13px iOS WebKit auto-zoom tetikliyordu. Mobile media query'de input/textarea/select 16px'e bumped (2026-04-25)
- [x] ~~**AI parse — fiyat boşsa kapanış otomatik gelsin**~~ — `enrichParseWithPrice()` helper'ı eklendi, AddTab + AddTxInline parse flow'larından geçiyor (2026-04-25)
- [x] ~~**AI parse — birden fazla işlem**~~ — Edge function `{transactions: [...]}` array döner; FE bulk ConfirmBox + per-row remove + bulk insert + rebuildPositions (2026-04-25)
- [x] ~~**Manuel ekle — tarih fiyatı otomatik dolsun**~~ — Tarih input onChange'inde ticker doluysa fetchPrice tetiklenir (2026-04-25)

## Güvenlik Hardening (post-redesign audit, 2026-04-25)

- [x] ~~**signOut sırasında privacy/cache LS temizliği**~~ — `il_hide`/`il_prc`/`il_hist` signOut handler'da temizleniyor (2026-04-25)
- [x] ~~**console.warn/log temizliği**~~ — `DEBUG` const ile 9 console call gated (2026-04-25)
- [x] ~~**External link hardening**~~ — `safeUrl()` helper + `rel="noopener noreferrer"` (2026-04-25)

## Açık Sorular

- Provider seçimleri ücretsiz mi? Daily rate limit ne?
- TEFAS için resmi API var mı, scrape mi?
- Social feed için kullanıcıların pozisyonlarını paylaşması gerek → RLS policy güncellemesi
- BIST/altın/TL fiyatlar için bizim Massive.com yetmez → ek provider

## Sonraki Adım

Bu havuzdan **2-3 item seçip** küçük bir milestone yap. Güncel öneri:
1. ✅ ~~Pie chart~~ (tamamlandı 2026-04-24)
2. ✅ ~~Account / Profil ekranı~~ (tamamlandı 2026-04-24)
3. ✅ ~~Hisse detay sayfası + fundamental checklist~~ (tamamlandı 2026-04-25)
4. **Vadeli mevduat** (basit asset type — provider gerekmez, kullanıcı girer)
5. **Portföy-geneli checklist tablosu** (mevcut fundamental veriyi tek tabloda kıyaslama)
6. **Sektör-aware eşikler** (tek tıklamalı kazanım — değerleme metriklerinin renk skoru çok daha anlamlı olur)
