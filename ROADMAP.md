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
- [x] ~~**Altın / emtia (MVP — ons & USD)**~~ (2026-04-26) — Edge function `fetch-prices`'a GOLD normalize bloğu (XAU/XAG/XPT/XPD + Türkçe ad ALTIN/GUMUS/PLATIN/PALADYUM → `C:{SYM}USD`). Frontend ManuelPosForm GOLD seçilince 4 emtia chip (🥇 Altın · 🥈 Gümüş · ⚪ Platin · 🪙 Paladyum). Dashboard fetchPrices/fetchHist filter'larına GOLD ve CRYPTO eklendi. **Edge function deploy gerekli.**
  - [ ] **TR altın birimleri (gram + çeyrek + yarım + tam + Cumhuriyet + Reşat + Ata)** (Altın iterasyon 2, sonraki sprint) — Mevcut MVP sadece ons/USD; TR yatırımcısı için yetersiz. Kapsam:
    - `positions.unit` kolonu (schema migration; sql-writer agent): `null | "ounce" | "gram" | "quarter" | "half" | "full" | "cumhuriyet" | "resat" | "ata"`
    - `GOLD_UNITS` sabit (top-level): birim × gram ağırlık × saflık
      - Gram (1.00 g, 24 ayar = 0.999)
      - Çeyrek (1.75 g, 22 ayar = 0.916)
      - Yarım (3.50 g, 22 ayar)
      - Tam / Ziynet (7.00 g, 22 ayar)
      - Cumhuriyet (7.20 g, 22 ayar)
      - Reşat (7.20 g, 22 ayar)
      - Ata (7.20 g, 22 ayar)
      - Ons (31.1035 g, 24 ayar) — mevcut MVP
    - ManuelPosForm GOLD seçilince Birim picker (8 chip); saflık birime göre auto, kullanıcı manuel override
    - `shares` = adet (kullanıcı "5 çeyrek altın" → shares=5)
    - `avgCost` = TRY/adet (kullanıcının ödediği gerçek fiyat, işçilik dahil)
    - Spot saf değer hesabı: USD/ons (Massive) → USD/gram → TRY/gram (fxRates) → TRY/adet (× ağırlık × saflık)
    - Dashboard render: "5 çeyrek altın · ₺12,000/ad · ₺60,000 toplam · Spot saf ₺55,000 · Premium %9"
    - **Premium işçilik göstergesi** — kullanıcının ödediği fiyat ile spot saf altın eşdeğeri farkı (yatırım kararı için faydalı)
    - Currency default TRY (type=GOLD currency=TRY); USD/ons MVP geriye uyumlu kalır
- [ ] **Türkiye fonları (TEFAS entegrasyonu)** — ⚠ **BLOCKER (2026-04-26)**: borsa-mcp `get_fund_data` ve `screen_funds` çalışmıyor — TEFAS resmi endpoint'leri (`BindComparisonFundReturns`, `BindHistoryAllocation`) `404 ERR-006 "Method not found or disabled"` dönüyor. Sprint ertelendi. Yeni provider keşfi gerek:
  - TEFAS Next.js network analizi → güncel endpoint'leri bul
  - Alternatif scrape kaynakları (Investing.com TR, Mynet Finans, Bigpara, Fonbul) test et
  - tefas-crawler / yfinance Python lib'leri Deno-uyumlu mu? Worker'da çalıştırılabilir mi?
  - Provider seçilince edge function (yeni veya fetch-prices'a TEFAS dalı) + frontend FUND tip ayrımı (US ETF vs TEFAS).
- [x] ~~**Kripto fiyat akışı sağlamlaştırma**~~ (2026-04-26) — Edge function `fetch-prices`'a CRYPTO ticker normalize bloğu (BTC/eth/BTC-USD/BTC/USDT → `X:{BASE}USD`); empty/over-length guard (`base.length>10` reject, `split(/[-_/]/)[0]` ile USDT/USDC quote strip). Frontend ManuelPosForm CRYPTO modunda 12 popüler kripto chip picker (BTC/ETH/SOL/BNB/XRP/ADA/DOGE/AVAX/DOT/MATIC/LINK/UNI). Tip değişiminde currency USD default. **Edge function deploy gerekli** — fetch-prices-edge-function.js Supabase Dashboard'da güncellensin.
- [ ] **FX/GOLD ham ticker normalize** (post-CRYPTO sprint not) — Edge function şu an `asset_type:"FX"`'le `USDTRY` (C: prefix'siz) gelirse 404 dönüyor sessizce. CRYPTO normalize gibi C: autoprefix + length/format guard ekle. Frontend `C:USDTRY` explicit gönderdiği için aktif bug değil ama future-proofing.
- [ ] Vadeli mevduat (faiz oranı, vade, getiri hesabı)

## Görselleştirme

- [x] ~~Pie chart: varlık türlerine göre dağılım~~ (2026-04-24, cost/market toggle'lı)

## Navigasyon & Sayfalar

- [ ] **Dashboard pozisyonları varlık türüne göre gruplansın** (currency yerine asset_type) — Şu an USD/TRY/EUR currency bazlı blok; kripto USD altında hisselerle karışıyor. Hedef: 6 ayrı blok (US Hisse · ETF · BIST · Kripto · Altın · Döviz) + cost-only EUR. Her blok kendi orijinal currency'sinde ham; üst KPI'lar display currency'de convert. Boş bloklar gizli, sort state per-block, blok başlığında toplam + Ekle CTA. Pie chart (Varlık Dağılımı) ile hizalanır.
- [ ] Her yatırım türü için ana sayfadan ayrı sayfa / tab
- [x] ~~Hisse başı detay sayfası~~ (2026-04-25) — `TickerDetailTab` (held + non-held discovery): pozisyon kartları, transaction list, meta (borsa-mcp/Polygon), fundamental checklist (US: FMP/EDGAR; BIST: İş Yatırım), "+ Ekle" CTA. Haber entegrasyonu hâlâ açık (aşağıda).
- [x] ~~**Portföy Analiz sayfası**~~ (2026-04-25) — yeni "Analiz" sekmesi (nav pos.3, pie icon). 4 kart: Varlık Dağılımı (filter chip ile type→ticker breakdown), Bölge Dağılımı (heuristik US/TR/Crypto/Emtia/Döviz pie), Toplam Komisyon (currency başına KPI + broker × yıl bar breakdown), Kazanan/Kaybeden Trade (BUY+SELL bağımsız split-adjusted win-rate stacked bar). Test: Sprint 1 30/30 + Sprint 2 25/25 PASS, sıfır console error.
  - [ ] FX conversion: Genel mode'da mixed currency $ ile sum'lanıyor; gerçek USD-equivalent için TRY/EUR conversion eklenecek (ROADMAP'teki "BIST için price-cache TRY-aware" item ile birlikte)
  - [ ] ETF underlying region (MCHI=Çin gibi) — şu an FUND→US default
  - [ ] Win/Loss time horizon seçimi (current price yerine 1A/3A/6A/1Y window)
  - [ ] Win/Loss: sold-out ticker'lar için live price fetch (şu an cache'te yoksa "noPrice" sayım dışı)
  - [ ] **Toplam Komisyon kartı: KPI üstte sabit, breakdown collapsible** — Mevcut yapı KPI + Broker breakdown + Yıl breakdown hep açık (uzun kart). Hedef: KPI rakamı her zaman görünür; altında "Detay ▾" toggle (default kapalı). HistoryTab accordion pattern'iyle tutarlı. Effort: ~10-15 dk.
  - [ ] **Portföy Sağlık Tablosu: kapalı özet + collapsible detay** — Mevcut yapı tüm satırlar açılır açılmaz görünüyor. Hedef: Default kapalı; üstte 3 büyük rozet (🟢 Yeşil: N · 🟡 Sarı: N · 🔴 Kırmızı: N — portföy genelinde fundScore aggregate sayımları). Yanında "Detay ▾" toggle, tıklanınca firma listesi açılır. Filter chip (Hepsi/US/BIST) kapalı modda da rozet sayılarını günceller. "Eksikleri Çek" CTA kapalı modda da görünür. Effort: ~15-20 dk.

## Fundamental & Analiz

- [x] ~~Fundamental data provider bulma~~ → **Financial Modeling Prep (FMP)** seçildi (2026-04-25)
- [x] ~~Fundamental veri çeken edge function~~ (`fetch-fundamentals`, 21 metrik, 2026-04-25)
- [x] ~~TickerDetailTab içinde checklist görünümü~~ (renk kodlamalı, 7 gün LS cache, 2026-04-25)
- [ ] Fundamental data Supabase'te saklama (yeni tablo) — şu an LS cache yeterli; çok user'da merkezi cache
- [ ] Kullanıcı kendi eşiklerini tanımlasın (ör. PE < X, ROE > Y) — şu an top-level `FUND_THRESHOLDS` sabit
- [ ] FMP free tier sınırını test et + rate limit guard ekle
- [ ] Benchmark karşılaştırması: portföy vs SPY / QQQ / BIST100
- [ ] **Sektör-aware eşikler** — tech için P/E ≤30, utility için ≤15 vs.; ticker'ın `sic_description` veya FMP `sector` ile profile seç
- [x] ~~**Portföy-geneli checklist tablosu**~~ (2026-04-26) — Analiz Tab 5. kart "Portföy Sağlık Tablosu" (Bölge ile Komisyon arasında); 8 kritik metrik (P/E, ROE, Net/Op Marj, Gelir/Kâr 5Y, Borç/Özk, NetBorç/FCF) + Skor kolonu; sticky ticker + horizontal scroll; renk pill (FUND_THRESHOLDS); filter chip Hepsi/US/BIST; "Eksikleri Çek" CTA + sıralı fetch + progress; default sıralama en kötü skor üstte; satır click → openDetail (Analiz'e geri).
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
- [ ] **Dark/Light tema desteği** — Şu an tek dark tema (`prefers-color-scheme:light` redesign'da kaldırılmıştı). Yapılacaklar:
  - `:root` color tokenleri light variant (bg/bg2/bg3/bg4, text/text2/text3, border, info/ok/err/warn light kontrast)
  - `data-theme` attribute (`<html data-theme="light|dark|system">`) + CSS scope (`[data-theme="light"] { ... }`)
  - Settings → Görünüm bölümü: 3-button segmented (Sistem · Açık · Koyu)
  - LS persist (`il_theme`); "system" modunda `prefers-color-scheme` dinler
  - SVG ikonları currentColor kullanıyor mu kontrol (NAV_ICONS, IconEye/EyeOff vb.)
  - Pie chart slice color'ları (TYPE_COLORS, REGION_META) light'ta yeterli kontrast doğrula
  - "Dark-only" notu CLAUDE.md "Tasarım sistemi" bölümünden kaldır
  - Effort: ~yarım gün (token paleti + scope CSS ana iş; component'lar zaten token kullanıyor)

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

- [x] ~~**CDN script SRI + version pin**~~ (2026-04-26) — supabase-js@2.104.1 + React/ReactDOM 18.2.0 + Babel 7.23.2 hepsi exact version pin + sha384 integrity hash + crossorigin="anonymous". Hash hesaplama notu HTML comment'inde.
- [x] ~~**`meta.description` length cap**~~ (2026-04-26) — `sanitizeMeta()` helper + `META_DESC_CAP=5000`; cache yazımı ve render setMeta ikisinde de uygulandı.
- [x] ~~**`tickerDb` LS quota güvenliği**~~ (2026-04-26) — `_tickerDbMem` memory-only fallback; LS write fail (sessiz catch) olsa bile session boyu cache çalışır.
- [x] ~~**Username + search input maxLength**~~ (2026-04-25) — Username `maxLength={20}` (rule note ile uyumlu), Search `maxLength={64}`.
- [x] ~~**Web row null guard**~~ (2026-04-25) — Web row değeri sadece `extractDomain` parse edebildiğinde geçer; null URL'de satır filtrelenir.
- [x] ~~**TickerDetailTab `effectiveType` useEffect deps**~~ (2026-04-25) — Live-price + meta fetch + fund fetch useEffect'lerinin deps'lerine `effectiveType` eklendi; stale closure provider mismatch'i kapatıldı.

## Süreç & Denetim (2026-04-26)

- [ ] **Periyodik agent denetim turu (her 2-3 sprint)** — Major sprint'ler bittikten sonra ana iş kapanmadan önce 5 specialized agent paralel olarak general health check yapar:
  - **client-security-auditor** — XSS vektörü, secret leak, LS hijyeni, auth state, user-data isolation, external resource safety
  - **edge-reviewer** — Tüm `*-edge-function.js`'leri (parse-transaction, fetch-prices, fetch-fundamentals, refresh-price-cache) — Deno pitfall, env misuse, error handling, rate limit
  - **rls-auditor** — Mevcut Supabase tabloları + RLS policy'leri (positions, transactions, splits, profiles, price_cache) — user data isolation halen sağlam mı
  - **ui-builder** — Son sprint'lerde eklenen yeni component'lar tasarım sistemi konvansiyonlarına uyuyor mu (CSS class'ları, color tokens, Türkçe microcopy, empty/loading state)
  - **product-owner** — Backlog grooming, son 2-3 sprint'in kapadığı/açtığı item'lar, sıradaki 5 öncelik impact × effort dengesinde, stale item temizliği
  - Tetikleyici: ana ajan proaktif (kullanıcı talep etmese de). Çıktı: her agent ≤200 kelime + en kritik 2-3 bulgu, tek bir özet sayfa olarak sunulur.
  - İlk tur: TEFAS sprint'i bittikten sonra (5+ sprint birikmiş olur).

## Fiyat Akışı UX Notları (2026-04-26)

- [x] ~~**ManuelPosForm fetchPrice — tarih için veri yoksa persistent inline uyarı**~~ (2026-04-26) — Önceki flash 3.5sn sonra kayboluyordu; avgCost sessizce fallback fiyatla doluyordu. Yeni: `priceNote` state ile inline kart (sarı warn-card) "⚠ {tarih} için veri yok — {fallback tarih} kapanışı kullanıldı" + tarih kontrol uyarısı. ok/warn/err 3 stil.
- [ ] **AI parse autofill (enrichParseWithPrice) için aynı pattern** — Multi-line text/image parse'ında her tx için fiyat fallback olduysa ConfirmBox satırında küçük pill ("⚠ tarih fallback") göster. Şu an sessizce fallback'liyor.
- [ ] **Dashboard ↻ Güncelle — başarısız ticker'lar için ayrıntılı sebep** — Şu an "başarısız: AAPL, MSFT" toast; her ticker'ın hatası (HTTP 403, ticker bulunamadı vb.) Settings → Sistem Durumu'nda görünsün veya toast içinde detay.

## UX/UI Gaps (kod-okumalı, ROADMAP dışı gözlem; 2026-04-25)

- [ ] **Touch device'larda tooltip**: `data-tip` hover-only; mobil/tablet'te hiç görünmez. Tap-to-show + outside-tap-close pattern (~30 yer etkilenir).
- [ ] **Pozisyon tablosu sort/filter**: Dashboard'da kolon başlıkları clickable değil; ticker/MV/P&L/% sıralaması manuel imkansız. `useState` + comparator yeterli.
- [ ] **Loading state tutarlılığı**: bazı yerlerde spinner, bazılarında `"..."`, bazılarında hiçbir şey. `<SkeletonRow>` / `<SkeletonCard>` standart component.
- [ ] **Confirm modal danger styling**: `confirm_(...)` modal'ında destructive vs non-destructive arasında görsel ayrım minimal. `danger:true` flag → kırmızı bg + ikon önerilir.
- [ ] **Recent searches**: Search tab her açılışta sıfırdan; LS'de son N (örn. 8) arama hatırlansın, focus'ta öneri olarak çıksın.
- [x] ~~**Currency blend (multi-currency net worth)**~~ (2026-04-26) — Topbar `$ ₺` toggle; Frankfurter API; tüm KPI/pie/Analiz convert.
- [ ] **Border contrast**: `--border rgba(255,255,255,0.06)` dark BG'de bazı kartların kenarı kayboluyor; %10'a bumped olabilir veya inner shadow.
- [ ] **Sparkline interactivity**: hover'da değer/tarih tooltip'i yok. SVG `<circle>` cursor + dikey kılavuz çizgi ekle.
- [ ] **FAB context-awareness**: mobil FAB her sekmede aynı (`+ İşlem Ekle`); HistoryTab'tayken aynen, Search'teyken "+ Ticker ara" / Detail'da "+ Ekle (THYAO)" gibi context hint.
- [ ] **Pie chart segment selection**: legend tıklanabilir değil, slice hover'da yok. Selected slice → dış kenarda 2px outline + ortada toplam label.
- [ ] **Form input error inline**: invalid date/negative shares submit'e kadar feedback vermiyor; `<input>` `aria-invalid` + altında 11px error text (form validation library gerekmez).

## UI Audit Backlog (2026-04-26 ui-builder full audit, kalan başlıklar)

Quick wins paketinde (commit `04e7870`) 8 fix uygulandı: title→data-tip migration (14 yer), confirm modal autoFocus/Enter koruması, TRY tablosu + Ekle butonu, manuel form yanlış uyarı, list_date fmtDateTR, AddTxInline assetType prop, Settings inline test response + FX kuru durumu satırı, eye aria-pressed + logo aria-label.

Kalan bulgular (severity: HIGH/MED/LOW), sprintlere gruplu:

### Sprint A — Navigation polish (½–1 gün, HIGH öncelik) ✅ 2026-04-26
- [x] ~~**TickerDetailTab "← Geri" → fromTab**~~ — `openDetail(tk, assetType, fromTab)` + `selectedFromTab` state; default `tab||"dashboard"` ile call site değişikliği gerekmedi.
- [x] ~~**Detail tab'ında bottom-tabs/topbar nav aktif değil**~~ — `tab==="detail"&&selectedFromTab===id` durumunda hem topbar-nav hem bottom-tabs `on` class'ı verir.
- [x] ~~**FAB context-awareness**~~ — Detail'da `il-detail-add` custom event ile `setShowAdd(true)`; Search'te input focus + scrollIntoView; Settings'te gizli; default + İşlem Ekle.

### Sprint B — Table a11y + currency consistency (kısmen ✅ 2026-04-26)
- [x] ~~**`<th scope="col">`** tüm tablolarda~~ — USD/TRY/EUR + CSV önizleme tüm `<th>`'larına eklendi (replace_all pass).
- [x] ~~**CSV önizleme `<table aria-label>`** + th scope~~ — `aria-label="CSV önizleme — ilk 5 işlem"` + map'te `key={h}` zaten vardı.
- [x] ~~**USD tablosunda `fmtD` hardcoded $**~~ — `fmtSign(p.pl,"$")` ile normalize; tek `fmtD` call site kaldı (top-level helper olarak duruyor).
- [ ] **EUR tablosu sort yok**: USD/TRY tablolarında sort var, EUR statik; en azından Ticker alfabetik. (MED — kalan)
- [ ] **HistoryTab tx satırlarında `openDetail` yok**: Detay'a gitme yolu sadece pozisyon tablosundan. (MED — kalan)
- [ ] **HistoryTab accordion ticker `fontFamily:"monospace"`**: Diğer ticker'lar DM Mono; sistem mono ile farklı render. (MED — kalan)

### Sprint C — Form UX bundle (kısmen ✅ 2026-04-26)
- [x] ~~**HistoryTab edit formunda komisyon input yok**~~ — Komisyon input + `step="any"` shares/price'a da eklendi; EUR sembolü doğru gösterildi.
- [x] ~~**AddTab tip picker hover anti-pattern**~~ — `.pick-card` CSS class + `:hover` + `:focus-visible`; inline DOM mutation kaldırıldı.
- [ ] **Pozisyonları Yeniden Hesapla — confirm yok**: Destructive (DELETE+INSERT cascade), `confirm_(...)` ile guard. (MED — kalan)
- [ ] **Confirm modal backdrop click destructive guard**: `danger=true`'da backdrop click iptal sayma; explicit "İptal" butonu zorunlu. (MED — kalan)
- [ ] **AddTab CSV import: skip count bildirim**: Geçersiz satırlar sessizce atlanıyor; `flash_("X işlem alındı, Y satır atlandı")`. (MED — kalan)
- [ ] **AnalysisTab FX yok warn-card eksik**: Dashboard'da var; Analiz'de sessizce 0 ekleniyor. (MED — kalan)
- [ ] **AnalysisTab Komisyon KPI label**: `{displayCur}` yerine `Toplam ({displayCur})` veya `Tüm Komisyon` ile bağlam ver. (MED — kalan)
- [ ] **TickerDetailTab metaErr**: küçük `.err` span yerine `.warn-card` (tutarlılık). (LOW — kalan)
- [ ] **fundLoading "..."**: spin icon ile değiştir. (MED — kalan)
- [ ] **Login error/success → `.flash err/ok`**: Inline style yerine class. (MED — kalan)

### Sprint D — Mobile + touch (1 gün, MED)
- [ ] **Touch device tooltip pattern**: `data-tip` hover-only (~35+ yer); tap-to-show + outside-tap-close. KPI kartları + fundamental satırları + cur-seg en kritik. (MED — UX/UI Gaps'ten devralındı)
- [ ] **`cur-seg` dokunma hedefi mobile**: ~30px; mobile media query'de padding artır (44px AA). (MED)
- [ ] **SearchTab autoFocus mobile**: Sekme geçişinde anında klavye açıyor; desktop-only focus + 150ms delay. (MED)
- [ ] **Period buton wrap dar ekran**: `flex:1 + minWidth:40` 320px'de eziliyor. (MED)
- [ ] **↻ Güncelle progress mobile**: `data-tip={pprog}` mobil'de hover yok; progress'i flash veya inline bar ile göster. (MED)
- [ ] **Flash position fixed**: Sayfa scroll'unda flash kaçırılıyor; `position:fixed; top:60px` ile sticky banner. (LOW)
- [ ] **Sparkline empty state min-height**: data <2 ise kart küçülüyor; min-height belirle. (MED)
- [ ] **Sparkline interactivity**: hover değer/tarih tooltip'i yok. (LOW — UX/UI Gaps'ten devralındı)

### Sprint E — Microcopy + a11y small (½ gün, LOW–MED)
- [ ] **Türkçe/İngilizce term sözlüğü**: `period` → `dönem`, mixed `ticker/split/cache/provider` kullanımı; CLAUDE.md'ye glossary ekle ve uygula. (MED)
- [ ] **Settings `<label>` → `<div className="stitle">`**: Standalone heading için label semantically yanlış. CSS rule güncellemesi gerekir. (MED)
- [ ] **Login `autocomplete` attributes**: `email` + `current-password` ekle. (LOW)
- [ ] **`input type="number" step="any"`**: Ondalık adet (kripto) için. (MED)
- [ ] **HistoryTab "tot" negatif format**: `$-1,234` → `-$1,234` normalize. (LOW)
- [ ] **Spinner boyut tutarlılığı**: 12/14/11px karışık; tek standart. (LOW)
- [ ] **Tip picker desc font/contrast**: 10px `var(--text3)` AA sınırda. (LOW)
- [ ] **AddTab tip değiştir butonu dokunma hedefi**: 24-26px → 44px. (MED)
- [ ] **SearchTab "50+" sonuç hint**: "Aramayı daraltın" ipucu. (MED)
- [ ] **SearchTab portföy match=0 empty state**: "Portföyünde eşleşme yok" mini note. (MED)
- [ ] **Pozisyon tablosu sort/filter** (UX/UI Gaps'ten devralındı): zaten USD+TRY tablolarına eklendi; EUR pending (Sprint B'de listeli).

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
