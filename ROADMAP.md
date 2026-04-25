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

## Fundamental & Analiz

- [x] ~~Fundamental data provider bulma~~ → **Financial Modeling Prep (FMP)** seçildi (2026-04-25)
- [x] ~~Fundamental veri çeken edge function~~ (`fetch-fundamentals`, 21 metrik, 2026-04-25)
- [x] ~~TickerDetailTab içinde checklist görünümü~~ (renk kodlamalı, 7 gün LS cache, 2026-04-25)
- [ ] Fundamental data Supabase'te saklama (yeni tablo) — şu an LS cache yeterli; çok user'da merkezi cache
- [ ] Kullanıcı kendi eşiklerini tanımlasın (ör. PE < X, ROE > Y) — şu an top-level `FUND_THRESHOLDS` sabit
- [ ] FMP free tier sınırını test et + rate limit guard ekle
- [ ] Benchmark karşılaştırması: portföy vs SPY / QQQ / BIST100

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

## Açık Sorular

- Provider seçimleri ücretsiz mi? Daily rate limit ne?
- TEFAS için resmi API var mı, scrape mi?
- Social feed için kullanıcıların pozisyonlarını paylaşması gerek → RLS policy güncellemesi
- BIST/altın/TL fiyatlar için bizim Massive.com yetmez → ek provider

## Sonraki Adım

Bu havuzdan **2-3 item seçip** küçük bir milestone yap. Güncel öneri:
1. ✅ ~~Pie chart~~ (tamamlandı)
2. **Account / Profil ekranı** (şifre + username; temel eksik)
3. **Vadeli mevduat** (basit asset type — provider gerekmez, kullanıcı girer)
4. **Hisse detay sayfası** (mevcut veriyle başla, fundamental gelince zenginleşir)
