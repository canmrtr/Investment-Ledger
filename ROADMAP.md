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
- [ ] **Sektör-aware eşikler** — tech için P/E ≤30, utility için ≤15 vs.; ticker'ın `sic_description` veya FMP `sector` ile profile seç
- [ ] **Portföy-geneli checklist tablosu** — tüm US_STOCK pozisyonlar için tek tablo, her sıra ticker, kolon kriter, skoru özet
- [ ] Tarihsel fundamental trend — son 5 yıl gelir/marj/ROE eğrisi (mini chart, FY'leri y/y göster)
- [ ] **SEC EDGAR fallback** (FMP boşluğunu doldur) — `data.sec.gov/api/xbrl/companyfacts/CIK*.json`, ücretsiz/sınırsız, NOW/MNSO/NNOX gibi tüm SEC dosyalayıcılarını kapsar. Edge function akışı: FMP dene → 402 alırsa EDGAR'a düş. İş kalemleri:
  - Ticker→CIK mapping (`company_tickers.json` 1× indir, Supabase'te tablo veya KV)
  - us-gaap line item eşleme: `Revenues`, `GrossProfit`, `NetIncomeLoss`, `OperatingIncomeLoss`, `Assets`, `Liabilities`, `StockholdersEquity`, `RetainedEarnings`, `CashAndCashEquivalents`, `LongTermDebt`, `InterestExpense` vs.
  - Ratio'ları derive et: P/E (price ÷ EPS), P/S (mcap ÷ revenue), ROE (NI ÷ equity), margins
  - User-Agent header zorunlu (SEC ToS), rate limit 10 req/sn
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

## UI Polish

- [ ] **Adet kolonu trailing-zero temizliği** — SOFI gibi fractional pozisyonlarda Dashboard tablosu `255.4200` gösteriyor; `255.42` olmalı. `toFixed(4)` yerine `+num.toFixed(4)` (Number cast trailing sıfırları atar) veya helper. TickerDetailTab'taki "Adet" kartı ve History sayfasındaki "adet" yazıları aynı kalıbı kullanıyor — hepsini ortak bir `fmtShares()`'e geçir.
- [ ] **Fundamental "ticker kapsam dışı" mesajı** — FMP 402 + "Special Endpoint" body'si geldiğinde edge function spesifik error code (örn. `"OUT_OF_PLAN"`) dönsün; FE bunu kırmızı `err` yerine turuncu `warn-card` ile "Bu ticker FMP free planında yok — alternatif provider gerekiyor" şeklinde göstersin. NOW gibi küçük/orta hisselerde tetikleniyor.

## Bug & UX Backlog

- [ ] **Chrome ilk açılışta zoomed** — viewport meta veya font-size root değeri Chrome'da yanlış ölçek tetikleyebilir. İncelenecek (Safari'de sorun yok).
- [ ] **AI parse — fiyat boşsa kapanış otomatik gelsin** — AI parse-transaction sonucunda fiyat null/boşsa, edge function `fetch-prices` ile o tarihin (veya en yakın iş günü) kapanış fiyatını otomatik dolduralım. Şu an sessizce boş kalıyor.
- [ ] **AI parse — birden fazla işlem** — input'a "AAPL 10 adet $150 alış 2024-01-15; MSFT 5 adet $300 satış 2024-02-10" gibi çoklu satır verince Claude tek bir array dönsün, FE tek tek confirm edebilsin (bulk add).
- [ ] **Manuel ekle — tarih fiyatı otomatik dolsun** — Manuel form'da tarih seçildiğinde o tarihin fiyatı `fetch-prices?date=` ile çekilip `form.price`'a otomatik girsin (kullanıcı override edebilir). Şu an manuel girmek gerekiyor.

## Güvenlik Hardening (post-redesign audit, 2026-04-25)

- [ ] **signOut sırasında privacy/cache LS temizliği** — `il_hide`, `il_prc`, `il_hist` user-agnostic key'lerle saklanıyor. Ortak tarayıcıda sonraki kullanıcı eski hide-toggle ve cache state'ini görür. signOut handler'da temizle veya key'leri user.id ile scope'la.
- [ ] **console.warn/log temizliği** — 5 yerde edge function ticker error'ları console'a yazılıyor (PII yok ama production polish). Kaldır veya `if(DEBUG)` guard.
- [ ] **External link hardening** — Şirket Bilgisi'ndeki `homepage_url` anchor'ı şu an `rel="noopener"`; `noreferrer` da ekle. `extractDomain()` içinde scheme allowlist (`http`/`https` only) — Massive provider compromise edilirse `javascript:` URL render edilmemeli.

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
