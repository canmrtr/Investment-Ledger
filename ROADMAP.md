# Roadmap / Idea Backlog

Fikir havuzu — öncelik henüz belirlenmedi, planlama için biriktiriliyor.

İlk toplama: **2026-04-24**

## Asset Type Genişletme

- [ ] BIST hisseleri (provider + edge function)
- [ ] Altın / emtia (gram, ons; TL & USD fiyat)
- [ ] Türkiye fonları (TEFAS entegrasyonu)
- [ ] Vadeli mevduat (faiz oranı, vade, getiri hesabı)

## Görselleştirme

- [ ] Pie chart: varlık türlerine göre dağılım
- (mevcut: kart tabanlı dağılım — pie daha anlaşılır)

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

## Sosyal & Kişiselleştirme

- [ ] Yatırımcı risk profili (anket → muhafazakar / dengeli / agresif)
- [ ] Social feed: benzer risk profilindeki yatırımcıların pozisyonları
  - Privacy: opt-in gerekli, anonim toplam görünümler

## Açık Sorular

- Provider seçimleri ücretsiz mi? Daily rate limit ne?
- TEFAS için resmi API var mı, scrape mi?
- Social feed için kullanıcıların pozisyonlarını paylaşması gerek → RLS policy güncellemesi
- BIST/altın/TL fiyatlar için bizim Massive.com yetmez → ek provider

## Sonraki Adım

Bu havuzdan **2-3 item seçip** küçük bir milestone yap. Önerim:
1. **Pie chart** (kolay, görünür fayda, frontend-only)
2. **Vadeli mevduat** (basit asset type — provider gerekmez, kullanıcı girer)
3. **Hisse detay sayfası** (mevcut veriyle de değerli — fundamental gelince zenginleşir)
