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

- [ ] Fundamental data provider bulma (Polygon fundamentals / Alpha Vantage / yfinance?)
- [ ] Fundamental data Supabase'te saklama (yeni tablo)
- [ ] Checklist kriterleri (ör. PE < X, ROE > Y, Debt/Equity < Z...) — kullanıcı kendi kuralını tanımlayabilsin
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
