# Roadmap / Idea Backlog

Fikir havuzu — öncelik henüz belirlenmedi, planlama için biriktiriliyor.

İlk toplama: **2026-04-24**

## Asset Type Genişletme

- [x] ~~**BIST hisseleri**~~ (2026-04-25) — fiyat: Yahoo Finance unofficial chart endpoint (`THYAO.IS` formatı); search: Twelve Data /stocks (~636 ticker, free reference); meta enrichment: borsa-mcp (saidsurucu, MIT, hosted) get_profile → sektör, market cap, F/K, temettü, 52H. Manuel ekleme + search + non-held discovery hepsi BIST-aware.
  - [x] ~~**Faz 5b: BIST fundamentals checklist**~~ (2026-04-25) — İş Yatırım MaliTablo `XI_29` industrial mapping; itemCode-based (text-bağımsız) lookup, 5Y CAGR için iki paralel call (Y..Y-3 + Y-4..Y-7), anchor year probe (FY-1 → FY-2). 19/21 metrik derive (PE meta'dan inject, PS henüz yok). `source:"isyatirim"` rozet. Ticker whitelist + bilinen banka early-exit + 6h instance cache.
    - [ ] BIST P/S: borsa-mcp `meta.market_cap` / `latestRevenue` ile derive (frontend tarafında veya edge function 2. call ile)
    - [ ] BIST bankalar (UFRS grubu, Roman numeral itemCode'lar): ayrı mapping + `ISY_KNOWN_BANKS` set'i kaldır
    - [ ] Sektör-aware + reel büyüme eşikleri (TR enflasyonu nominal CAGR'ı şişiriyor → `revenueGrowth5Y` ≥10% kriteri otomatik geçiyor; CPI deflate veya sektör median kıyası gerek)
  - [ ] BIST için price-cache TRY-aware olsun (şu an `prc[ticker]` raw değer; pos.currency="TRY" ile FE doğru sembolleri seçiyor — sağlam ama TRY/USD fx conversion için hazırlık gerek)
- [ ] Altın / emtia (gram, ons; TL & USD fiyat)
- [ ] Türkiye fonları (TEFAS entegrasyonu — borsa-mcp `get_fund_data` aracı destekliyor, hazır kaynak)
- [ ] Vadeli mevduat (faiz oranı, vade, getiri hesabı)

## Görselleştirme

- [x] ~~Pie chart: varlık türlerine göre dağılım~~ (2026-04-24, cost/market toggle'lı)

## Navigasyon & Sayfalar

- [ ] Her yatırım türü için ana sayfadan ayrı sayfa / tab
- [x] ~~Hisse başı detay sayfası~~ (2026-04-25) — `TickerDetailTab` (held + non-held discovery): pozisyon kartları, transaction list, meta (borsa-mcp/Polygon), fundamental checklist (US: FMP/EDGAR; BIST: İş Yatırım), "+ Ekle" CTA. Haber entegrasyonu hâlâ açık (aşağıda).
- [x] ~~**Portföy Analiz sayfası**~~ (2026-04-25) — yeni "Analiz" sekmesi (nav pos.3, pie icon). 4 kart: Varlık Dağılımı (filter chip ile type→ticker breakdown), Bölge Dağılımı (heuristik US/TR/Crypto/Emtia/Döviz pie), Toplam Komisyon (currency başına KPI + broker × yıl bar breakdown), Kazanan/Kaybeden Trade (BUY+SELL bağımsız split-adjusted win-rate stacked bar). Test: Sprint 1 30/30 + Sprint 2 25/25 PASS, sıfır console error.
  - [ ] FX conversion: Genel mode'da mixed currency $ ile sum'lanıyor; gerçek USD-equivalent için TRY/EUR conversion eklenecek (ROADMAP'teki "BIST için price-cache TRY-aware" item ile birlikte)
  - [ ] ETF underlying region (MCHI=Çin gibi) — şu an FUND→US default
  - [ ] Win/Loss time horizon seçimi (current price yerine 1A/3A/6A/1Y window)
  - [ ] Win/Loss: sold-out ticker'lar için live price fetch (şu an cache'te yoksa "noPrice" sayım dışı)

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
- [x] ~~**Fundamental "ticker kapsam dışı" mesajı**~~ (2026-04-25) — Edge function `code:"OUT_OF_PLAN"` döner (FMP 402 + EDGAR fallback de fail olunca); FE turuncu `warn-card` "Ticker FMP free planında yok" + alternatif provider notu ile gösterir.
- [x] ~~**Asset type seçimi → ekleme akışı**~~ (2026-04-25) — AddTab açılınca 6 kart picker (US/BIST/FUND/CRYPTO/GOLD/FX); seçimden sonra context header "Tip: X · [Tipi değiştir]" + mevcut 4 mode tab. ManuelPosForm `prefillType` prop ile type+currency (BIST→TRY) pre-fill; `key={pickedType}` ile tip değişiminde clean remount. AddTxInline (Detay'dan "+ Ekle") değişmedi — context zaten var. Test: 29/29 PASS (Playwright + Chromium).

## Bug & UX Backlog

- [x] ~~**iOS Chrome zoom**~~ — input font-size 13px iOS WebKit auto-zoom tetikliyordu. Mobile media query'de input/textarea/select 16px'e bumped (2026-04-25)
- [x] ~~**AI parse — fiyat boşsa kapanış otomatik gelsin**~~ — `enrichParseWithPrice()` helper'ı eklendi, AddTab + AddTxInline parse flow'larından geçiyor (2026-04-25)
- [x] ~~**AI parse — birden fazla işlem**~~ — Edge function `{transactions: [...]}` array döner; FE bulk ConfirmBox + per-row remove + bulk insert + rebuildPositions (2026-04-25)
- [x] ~~**Manuel ekle — tarih fiyatı otomatik dolsun**~~ — Tarih input onChange'inde ticker doluysa fetchPrice tetiklenir (2026-04-25)

## Güvenlik Hardening (post-redesign audit, 2026-04-25)

- [x] ~~**signOut sırasında privacy/cache LS temizliği**~~ — `il_hide`/`il_prc`/`il_hist` signOut handler'da temizleniyor (2026-04-25)
- [x] ~~**console.warn/log temizliği**~~ — `DEBUG` const ile 9 console call gated (2026-04-25)
- [x] ~~**External link hardening**~~ — `safeUrl()` helper + `rel="noopener noreferrer"` (2026-04-25)

### Post-BIST audit (2026-04-25)

- [ ] **CDN script SRI + version pin** — `supabase-js@2` floating major; React/Babel pinned ama `integrity=` yok. SRI hash + exact version'a geç (low-risk; CDN compromise korunması).
- [ ] **`meta.description` length cap** — Polygon/Yahoo/borsa-mcp upstream provider compromise edilirse multi-MB string LS quota'yı patlatabilir. Cache yazımı ve render öncesi ~5KB cap.
- [ ] **`tickerDb` LS quota güvenliği** — 10k+ entry × ~50 byte ≈ 500KB; LS quota'ya yakın. Fallback: memory-only cache LS write fail olursa.
- [x] ~~**Username + search input maxLength**~~ (2026-04-25) — Username `maxLength={20}` (rule note ile uyumlu), Search `maxLength={64}`.
- [x] ~~**Web row null guard**~~ (2026-04-25) — Web row değeri sadece `extractDomain` parse edebildiğinde geçer; null URL'de satır filtrelenir.
- [x] ~~**TickerDetailTab `effectiveType` useEffect deps**~~ (2026-04-25) — Live-price + meta fetch + fund fetch useEffect'lerinin deps'lerine `effectiveType` eklendi; stale closure provider mismatch'i kapatıldı.

## UX/UI Gaps (kod-okumalı, ROADMAP dışı gözlem; 2026-04-25)

- [ ] **Touch device'larda tooltip**: `data-tip` hover-only; mobil/tablet'te hiç görünmez. Tap-to-show + outside-tap-close pattern (~30 yer etkilenir).
- [ ] **Pozisyon tablosu sort/filter**: Dashboard'da kolon başlıkları clickable değil; ticker/MV/P&L/% sıralaması manuel imkansız. `useState` + comparator yeterli.
- [ ] **Loading state tutarlılığı**: bazı yerlerde spinner, bazılarında `"..."`, bazılarında hiçbir şey. `<SkeletonRow>` / `<SkeletonCard>` standart component.
- [ ] **Confirm modal danger styling**: `confirm_(...)` modal'ında destructive vs non-destructive arasında görsel ayrım minimal. `danger:true` flag → kırmızı bg + ikon önerilir.
- [ ] **Recent searches**: Search tab her açılışta sıfırdan; LS'de son N (örn. 8) arama hatırlansın, focus'ta öneri olarak çıksın.
- [ ] **Currency blend (multi-currency net worth)**: Dashboard'da TR + USD + EUR pozisyonların toplamı tek sayıda yok; iki ayrı blok. `fetch-prices` C:USDTRY/EURUSD ile blend edilebilir; "Net Worth (USD)" kartı.
- [ ] **Border contrast**: `--border rgba(255,255,255,0.06)` dark BG'de bazı kartların kenarı kayboluyor; %10'a bumped olabilir veya inner shadow.
- [ ] **Sparkline interactivity**: hover'da değer/tarih tooltip'i yok. SVG `<circle>` cursor + dikey kılavuz çizgi ekle.
- [ ] **FAB context-awareness**: mobil FAB her sekmede aynı (`+ İşlem Ekle`); HistoryTab'tayken aynen, Search'teyken "+ Ticker ara" / Detail'da "+ Ekle (THYAO)" gibi context hint.
- [ ] **Pie chart segment selection**: legend tıklanabilir değil, slice hover'da yok. Selected slice → dış kenarda 2px outline + ortada toplam label.
- [ ] **Form input error inline**: invalid date/negative shares submit'e kadar feedback vermiyor; `<input>` `aria-invalid` + altında 11px error text (form validation library gerekmez).

## Açık Sorular

- Provider seçimleri ücretsiz mi? Daily rate limit ne?
- TEFAS için resmi API var mı, scrape mi?
- Social feed için kullanıcıların pozisyonlarını paylaşması gerek → RLS policy güncellemesi
- BIST/altın/TL fiyatlar için bizim Massive.com yetmez → ek provider

## Sonraki Adım

**Tamamlanmış milestonlar (2026-04):**
- ✅ Pie chart, Account, Hisse detay + fundamental checklist (US + BIST)
- ✅ BIST entegrasyonu Faz 1-5b (price + meta + Search DB + non-held discovery + fundamentals)
- ✅ Asset type picker (AddTab 6-kart giriş)
- ✅ Mikro UX bundle (input maxLength, web row null guard, OUT_OF_PLAN warn-card, useEffect deps)
- ✅ Kontrast + pie alignment polish
- ✅ **Analiz Tab** (Sprint 1+2: Varlık filtreli + Bölge + Komisyon + Win/Loss bağımsız)
- ✅ **FX conversion + global currency toggle** (2026-04-26) — topbar `$ ₺` segmented (`displayCur` LS persist `il_disp_cur`); Frankfurter API (`api.frankfurter.dev/v1/latest`, ECB rates, auth-free, CORS, browser doğrudan); `convert(amt,from,to,fx)` USD↔TRY↔EUR helper; Dashboard KPI'lar (Maliyet/MV/Total Return/XIRR) + Sparkline + Allocation pie + Analiz 3 kartı (Varlık + **Bölge bug fix** + Komisyon tek tutar) tüm pozisyonları display cur'a convert eder; TRY pozisyon tablosu price-aware (eski "fiyat desteği yok" notu kaldırıldı), EUR cost-only kalır; FX yok fallback warn-card.

**Sıradaki milestone önerileri** (impact × effort dengesi):

A — **Mobile UX mikro-sprint** (yarım gün)
- Touch tooltip (data-tip tap-to-show)
- Pozisyon tablosu sort
- Skeleton loading standardı

B — **Fundamental derinleştirme** (1 gün)
- Portföy-geneli checklist tablosu (Analiz Tab'a eklenebilir)
- Sektör-aware eşikler (tech P/E ≤30, utility ≤15)
- Tarihsel trend mini chart (5Y revenue/margin/ROE)

C — **Yeni asset type** (2-3 gün)
- Vadeli mevduat (provider yok, kullanıcı girer — hızlı kazanım)
- Altın (`C:XAUUSD` ile mevcut Massive provider — kolay)
- TEFAS fonları (borsa-mcp `get_fund_data` mevcut)

D — **Audit backlog** (yarım gün) — CDN SRI pin, meta.description length cap, tickerDb LS quota fallback (bkz. Post-BIST audit)
