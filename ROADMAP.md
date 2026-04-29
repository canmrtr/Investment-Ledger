# Roadmap / Idea Backlog

Fikir havuzu — öncelik ve boyut etiketli, her sprint gözden geçirilir.

İlk toplama: **2026-04-24** | Son grooming: **2026-04-29** (Sprint 9 backlog grooming; Volatilite/Kur Riski tamamlandı olarak işaretlendi; Sprint 9 scope: Social Faz 2, CAGR, Portföy P/E, Dayanıklılık Skoru, PWA, agent denetim)

### Uzun Vadeli Platform Vizyonu

Bu uygulama üç aşamalı bir yörüngede büyüyor:

1. **Şu an** — Single-user web app (GitHub Pages, `index.html`, Supabase backend). Hızlı iterasyon öncelikli.
2. **Orta vade** — Multi-user SaaS; mass kullanım ölçeklenme maddeleri devreye girer. Data source'lar güvenilir/resmi kaynaklara taşınır, cache mimarisi user-başına fetch'ten shared cache'e geçer.
3. **Uzun vade** — Native mobil uygulama (App Store + Google Play); Vite build sistemi → Capacitor wrapper. Web kodu büyük ölçüde yeniden yazılmaz, sarmalanır.

**Şimdiden uyulması gereken temel kural**: Her yeni geliştirme bu geçişi kolaylaştırmalı veya en azından zorlaştırmamalı. Kritik kurallar: yeni state'i LS değil Supabase'e yaz; her external API çağrısını edge function arkasına al; `window`/`document` doğrudan erişimini izole et; yeni bileşenlerde `px` yerine `rem`/`dvh` kullan. Detaylar ilgili bölümlerde.

---

## Tamamlananlar (Arşiv)

- [x] ~~**Pie chart**~~ (2026-04-24) — varlık türlerine göre dağılım, cost/market toggle.
- [x] ~~**Account ekranı**~~ (2026-04-25) — Settings içi; username, display_name, profil formu.
- [x] ~~**Hisse detay sayfası (TickerDetailTab)**~~ (2026-04-25) — held + non-held discovery; pozisyon kartları, tx list, meta, fundamental checklist, "+ Ekle" CTA.
- [x] ~~**Fundamental edge function (US)**~~ (2026-04-25) — FMP `/stable/` 21 metrik + SEC EDGAR fallback; LS cache 7 gün.
- [x] ~~**SEC EDGAR fallback**~~ (2026-04-25) — FMP 402 → EDGAR companyfacts; 19/21 metrik, P/E+P/S null.
- [x] ~~**BIST entegrasyonu Faz 1-5a**~~ (2026-04-25) — Yahoo Finance price/historical (`THYAO.IS`); Twelve Data /stocks ~636 ticker; borsa-mcp get_profile (sektör/market cap/F/K/52H); currency-aware display; manuel ekleme + search + non-held discovery.
- [x] ~~**BIST Faz 5b: fundamentals checklist**~~ (2026-04-25) — İş Yatırım MaliTablo XI_29 mapping; itemCode-based; 5Y CAGR 2-call; anchor year probe; 19/21 metrik; source:"isyatirim" rozet; banka early-exit; 6h server cache.
- [x] ~~**Global ticker arama (SearchTab)**~~ (2026-04-25) — SEC EDGAR ~10.348 US + Twelve Data ~636 BIST; LS cache 24h; prefix+ad match; non-held discovery.
- [x] ~~**Asset type picker (AddTab)**~~ (2026-04-25) — 6-kart picker; ManuelPosForm prefillType; BIST→TRY otomatik; clean remount.
- [x] ~~**Mikro UX bundle**~~ (2026-04-25) — input maxLength, web row null guard, OUT_OF_PLAN warn-card, useEffect deps.
- [x] ~~**Kontrast + pie alignment polish**~~ (2026-04-25) — text2 #b8b8b8 + weight 500; pie row flex 0 0 70/56px kolon hizalama.
- [x] ~~**Analiz Tab**~~ (2026-04-25/26, Sprint 1+2) — yeni "Analiz" sekmesi (nav pos.3); 4 kart: Varlık filtreli, Bölge heuristik, Komisyon broker×yıl, Win/Loss BUY+SELL bağımsız split-adj. 55/55 test PASS.
- [x] ~~**FX conversion + global currency toggle**~~ (2026-04-26) — topbar `$ ₺` segmented (`displayCur` LS persist); Frankfurter API; `convert()` USD↔TRY↔EUR; Dashboard KPI+Sparkline+Pie+Analiz 3 kartı convert; BIST bug fix; FX yok warn-card.
- [x] ~~**UI Quick Wins + Navigation + Hardening**~~ (2026-04-26) — title→data-tip (14 yer); confirm modal danger autoFocus/Enter; HistoryTab komisyon input; pick-card hover CSS; USD fmtSign; th scope; fromTab navigation; FAB context-aware; Settings inline test + FX kuru; eye aria-pressed; CDN SRI pin; sanitizeMeta 5KB cap; tickerDbMem LS fallback.
- [x] ~~**Crypto MVP**~~ (2026-04-26) — edge fn CRYPTO normalize (BTC/eth/BTC-USD → `X:{BASE}USD`); chip picker 12 popüler kripto; Dashboard filter.
- [x] ~~**Gold MVP (ons & USD)**~~ (2026-04-26) — edge fn GOLD normalize (XAU/XAG/XPT/XPD → `C:{SYM}USD`); COMMODITY_SYMBOLS chip picker; Dashboard filter.
- [x] ~~**Portföy Sağlık Tablosu**~~ (2026-04-26) — Analiz Tab 5. kart; 8 metrik renk pill; sticky ticker + scroll; "Eksikleri Çek" CTA; default kapalı + 3 rozet aggregate + Detay ▾.
- [x] ~~**Komisyon kartı collapsible**~~ (2026-04-26) — KPI üstte sabit + Detay ▾; breakdown sadece açıkken render.
- [x] ~~**Dashboard varlık türü gruplaması**~~ (2026-04-26) — BLOCK_TYPES config 6 type-bazlı blok (US Hisse/ETF/BIST/Kripto/Altın/Döviz); natural currency sembolü; EUR cost-only ayrı.
- [x] ~~**ManuelPosForm priceNote inline uyarı**~~ (2026-04-26) — tarih için veri yoksa persistent sarı warn-card; ok/warn/err 3 stil.
- [x] ~~**signOut LS temizliği + DEBUG gating + safeUrl**~~ (2026-04-25/26) — privacy/cache LS temizliği; console.warn/log DEBUG ile gated; external link rel.
- [x] ~~**Sprint 3: Veri girişi güvenilirliği + TR Altın birimleri MVP**~~ (2026-04-27) — `step="any"` ondalık adet bug fix (0.5 BTC, 3.75 gram); form inline validation (`aria-invalid` + 11px error text); backdrop click guard (`danger:true` modal'da explicit iptal zorunlu); TR altın birimleri MVP (`positions.unit` migration + `GOLD_UNITS` oz-eq tablo + birim picker 6 unit + Dashboard back-conversion); Piyasa Değeri mobil full-width (`.g3 > *:first-child { grid-column:1/-1 }`); ↻ Güncelle otomatik (30dk `setInterval` + `visibilitychange`) + Settings'e manuel "↻ Şimdi Güncelle" taşıması; CORS lockdown tüm 4 edge fn → `https://canmrtr.github.io`; EDGAR UA email fix (prod email); `rebuildPositions` unit snapshot fix.
- [x] ~~**Periyodik agent denetim turu — ilk tur**~~ (2026-04-27) — client-security-auditor + edge-reviewer paralel; 15 bulgu; kritik 10 item Sprint 4 backlog'a eklendi.
- [x] ~~**Sprint 4: Güvenlik hızlı kazanımlar + UX**~~ (2026-04-27) — refresh-price-cache CRON_SECRET (XOR constant-time, fail-closed); massiveHistorical + yfHistorical explicit `{error:…}` flag; AddTxInline/saveAI/saveTx NaN guard; CSV negative/Infinity skip; Dashboard varsayılan sıra P&L% azalan; Konsantrasyon Riski kartı (top-3 + HHI + renk pill).
- [x] ~~**Sprint 5: price_cache write-lock + benchmark karşılaştırması**~~ (2026-04-27) — price_cache RLS write kaldırıldı (service_role only); `fetch-prices` service_role upsert; BENCHMARKS constant (SPY + XU100); Dashboard benchmark getiri bölümü.
- [x] ~~**Sprint 5 devam: Parse rate limiting + Sektör Dağılımı**~~ (2026-04-27) — `edgeCallAuth` + `auth.getUser(token)` JWT-verified identity; `increment_parse_calls` PL/pgSQL RPC (TOCTOU-safe); 20 parse/gün/kullanıcı; 401 unauthenticated; image validation; AnalysisTab Sektör Dağılımı kartı (SIC/borsa-mcp; SECTOR_COLORS; "Meta Çek" CTA).
- [x] ~~**Global varlık türü filtresi (multi-select)**~~ (2026-04-27) — Dashboard + AnalysisTab'da `dashTypeFilter`/`activeTypes` state; `.fbar` yatay kaydırmalı chip bar (mobile-friendly, no-wrap, hidden scrollbar); tüm hesaplamalar (KPI, pie, komisyon, win/loss, sağlık, konsantrasyon, sektör) filtreye göre `filteredPos`/`filteredTxs` üzerinden. Varlık Dağılımı kartındaki per-card filter kaldırıldı.
- [x] ~~**Kripto/non-BIST market value konversiyon bug**~~ (2026-04-27) — `mvDisp` (AnalysisTab) ve `allDisp` (Dashboard KPI) artık `priceCur = p.type==="BIST"?"TRY":"USD"` kullanıyor — `p.currency` stale kalırsa (AI-parse TRY hatası vb.) MV yanlış kur üstünden bölünüyordu (BTC=$18 görünüm). `rebuildPositions` currency normalizer eklendi (BIST→TRY, diğer→USD, EUR korunur). Dashboard BLOCK_TYPES filtresi currency check kaldırıldı (type-only). HistoryTab `$` hardcode → `displaySym(currency)`.
- [x] ~~**Sprint 6 Milestone A+B: Analiz Tab tamamlama + bug fix**~~ (2026-04-29) — Sektör Dağılımı mount useEffect auto-fetch + CRYPTO/GOLD/FX/FUND tip bazlı fallback etiketi; period buton wrap `.fbar` scrollable (320px çalışıyor); EUR tablosu sort (kod zaten alfabetik sıralıydı); Break-Even Analizi (kart 7: komisyon dahil breakEven + distPct% + renk pill + mask()); Potansiyel Kayıp Simülasyonu (kart 8: %10/20/30 yatay bar, FX warn-card, tamamen frontend).
- [x] ~~**Social Portfolios Faz 1 — Multi-portfolio altyapısı**~~ (2026-04-29) — DB: `portfolios`, `follows`, `portfolio_activities` tabloları; `positions`/`transactions`/`splits`'e `portfolio_id NOT NULL` FK; mevcut kullanıcılar için "Ana Portföy" backfill migration (Supabase'e apply edildi); RLS politikaları (rls-auditor onaylı); frontend: `rebuildPositions` portfolio-scoped; `loadData` portfolios fetch + `activePortfolioId` LS sync; tüm write path'lerine `portfolio_id` prop threading (AddTxInline, TickerDetailTab, HistoryTab, AddTab, ManuelPosForm).
- [x] ~~**Sprint 7: Güvenlik sertleştirme**~~ (2026-04-29) — parse-transaction sunucu tarafında JWT doğrulama + `increment_parse_calls` RPC sunucu-side; `002_rls_fixes.sql`: positions_public_read privacy_level filtresi, owner policy'lere portfolio_id subquery, activities cross-portfolio INSERT kapatıldı, portfolios 4 per-command policy, splits RLS; fetch-prices ticker regex validation; tüm edge fn `Access-Control-Allow-Methods`.
- [x] ~~**Dividend (DIV) işlem takibi**~~ (2026-04-29) — `transactions.way` CHECK `['BUY','SELL','DIV']` (003_div_way.sql); Dashboard Total Return + XIRR cashflow; HistoryTab DIV badge + grup net pozitif; CSV allowlist; way dropdown'larına "Temettü"; TickerDetailTab Temettü Geliri kartı (tahmini yıllık + maliyete/cari getiri %).
- [x] ~~**Risk Dashboard — 3 AnalysisTab kartı**~~ (2026-04-29) — Dönem Bazlı Getiri (MV-ağırlıklı 6 period + SPY/XU100 benchmark); FX Risk (USD/EUR/TRY bar + +10% USDTRY simülasyon); 6 Aylık Performans (p_m6 en iyi/kötü 3 + ağırlıklı portföy getirisi).
- [x] ~~**Sprint 8: Temettü Getiri Projeksiyonu + UX polish**~~ (2026-04-29) — AnalysisTab Temettü Özeti kartı (toplam + portföy verimi + top-5 bar); AddTxInline'a "Not" alanı; broker/ticker/name maxLength guard.
- [x] ~~**AnalysisTab pie kartları stacked + collapsible**~~ (2026-04-29) — Varlık Dağılımı, Bölge Dağılımı, Sektör Dağılımı: pie üstte ortalı 140×140, legend tam genişlikte altında; ▴/▾ toggle; kapalı halde özet satır.
- [x] ~~**Dashboard ETF/₿ rozetleri kaldırıldı**~~ (2026-04-29) — Pozisyon satırlarındaki gereksiz ETF ve kripto rozetleri kaldırıldı.

---

## Bekleyenler / Blokerli

- [ ] **TEFAS WAF testi** `[S]` `[P2]` — Endpoint bulundu: `https://fundturkey.com.tr/api/DB/BindHistoryInfo` (POST, cookie + `X-Requested-With` header zorunlu). Bloker: F5 WAF cloud IP'lerini engelliyor (Nisan 2026 issue #35 — Render.com/AWS'ten robot check). **Test adımı**: Supabase Dashboard → Edge Functions → Test tab'dan doğrudan POST dene. Çalışırsa Sprint 5'e tam entegrasyon girer (edge function FUND dalı + US ETF vs TEFAS ayrımı). Çalışmazsa: RapidAPI wrapper (`rapidapi.com/kbilgen1980/api/tefas2`) fiyatlandırmasına bak veya borsa-mcp proxy üstünden dene.

---

## Asset Type Genişletme

- [x] ~~**TR altın birimleri MVP**~~ (2026-04-27) — `positions.unit` migration + `GOLD_UNITS` oz-eq tablo (oz/g/quarter/half/full/republic; gram ağırlık + saflık) + birim picker 6 chip + oz-eq `savePos` + Dashboard back-conversion display. USD/ons geriye uyumlu (unit=null → factor=1).
- [x] ~~**Dividend (temettü) tracking**~~ (2026-04-29) — `transactions.way:"DIV"` CHECK kısıtı (003_div_way.sql); Dashboard Total Return + XIRR cashflow entegrasyonu; HistoryTab DIV satırı + grup net pozitif; CSV allowlist; TickerDetailTab temettü geliri kartı + tahmini yıllık + maliyete/cari getiri %. AnalysisTab Temettü Özeti kartı (toplam + portföy verimi + top-5 bar).
- [ ] **TR altın işçilik premium göstergesi** `[M]` `[P2]` — Reşat/Ata birimi ekleme; Dashboard "5 çeyrek · ₺12,000/ad · Spot saf ₺55,000 · Premium %9" render; ödenen fiyat − spot saf fark hesabı.
- [ ] **BIST P/S metriği** `[S]` `[P2]` — borsa-mcp `meta.market_cap` / `latestRevenue` ile derive; frontend veya edge function 2. call.
- [ ] **BIST bankalar fundamentals** `[L]` `[P2]` — UFRS grubu Roman numeral itemCode mapping; `ISY_KNOWN_BANKS` set'i kaldır. (Bankalar şu an early-exit ile bloklu.)
- [ ] **Sektör-aware fundamental eşikler** `[M]` `[P1]` — tech P/E ≤30, utility ≤15 vs.; `sic_description` veya FMP `sector` ile profile seç. TR enflasyonu CAGR eşiklerini de etkiliyor — nominal vs reel.
- [ ] **FX/GOLD ham ticker normalize** `[S]` `[P2]` — edge function `asset_type:"FX"` ile prefix'siz `USDTRY` gelirse 404 dönüyor sessizce; `C:` autoprefix + length/format guard. Aktif bug değil ama future-proofing.
- [ ] **BIST price-cache TRY-aware** `[S]` `[P2]` — `prc[ticker]` raw değer; pos.currency="TRY" ile FE doğru sembol seçiyor (şu an sağlam). TRY/USD fx conversion hazırlığı gerekirse bu item devreye girer.
- [ ] **Vadeli mevduat** `[M]` `[P2]` — faiz oranı, vade, getiri hesabı; provider yok, kullanıcı girer.

## Görselleştirme

- [x] ~~**Dashboard + Analiz global varlık türü filtresi (multi-select)**~~ (2026-04-27) — `dashTypeFilter`/`activeTypes` chip bar; `.fbar` yatay scroll (mobile). Tüm hesaplamalar `filteredPos`/`filteredTxs` üzerinden.

- [x] ~~**Dashboard KPI 4→3 kart kompakt hibrit**~~ (2026-04-26) — Piyasa Değeri (büyük) + Maliyet (ikincil alt satır); Total Return % (büyük) + tutar; XIRR. `.g3` grid, mobile 2+1.
- [x] ~~**Dashboard'dan Varlık Dağılımı pie'ı kaldır**~~ (2026-04-26) — Analiz Tab daha güçlü versiyon. Sparkline tam genişliğe açıldı.
- [x] ~~**Bölge Dağılımı emoji bayrakları kaldır**~~ (2026-04-26) — Plain text "US"/"Türkiye".
- [ ] **Sparkline interactivity** `[S]` `[P2]` — hover'da değer/tarih tooltip; SVG `<circle>` cursor + dikey kılavuz çizgi.
- [ ] **Pie chart segment selection** `[M]` `[P2]` — slice hover/select; legend tıklanabilir; seçili slice dış kenarda 2px outline + ortada toplam label.

## Navigasyon & Sayfalar

- [ ] **Her yatırım türü için ayrı sayfa/tab** `[L]` `[P2]` — şu an Dashboard block ile yönetiliyor; ayrı sekme ihtiyacı olursa.

## Fundamental & Analiz

- [x] ~~**Tarihsel fundamental trend**~~ (2026-04-26) — 5Y gelir/net kâr SVG bar chart (TrendMiniChart). Edge fn: FMP + BIST annual array. Frontend: checklist altında.
- [ ] **EDGAR P/E + P/S** `[M]` `[P2]` — `CommonStockSharesOutstanding` × current price = market cap; P/E + P/S EDGAR modunda da dolu gelir.
- [ ] **Fundamental data Supabase cache** `[M]` `[P2]` — şu an LS yeterli; kullanıcı sayısı arttıkça merkezi cache gerekebilir.
- [ ] **Kullanıcı kendi eşiklerini tanımlasın** `[M]` `[P2]` — PE < X, ROE > Y gibi; şu an top-level `FUND_THRESHOLDS` sabit.
- [x] ~~**Benchmark karşılaştırması**~~ (2026-04-27 Sprint 5) — portföy vs SPY (Massive) + XU100 (Yahoo Finance); BENCHMARKS constant; Dashboard seçili period için getiri gösterimi.
- [ ] **FMP rate limit guard** `[S]` `[P2]` — free tier sınırını test et + guard ekle.

## Analiz Tab — Yeni Özellikler

### Portföy Analizi

- [x] ~~**Konsantrasyon Risk Göstergesi**~~ (2026-04-27 Sprint 4) — Top 3 pozisyon ağırlığı + HHI + renk pill; tamamen frontend.
- [x] ~~**Sektör Dağılımı**~~ (2026-04-27 Sprint 5) — SIC/borsa-mcp industry; pie + legend; "Meta Çek" CTA; SECTOR_COLORS 10-renk palette.
- [ ] **"Dip mi Tepeden mi Girdim?" Giriş Kalitesi** `[S]` `[P2]` — avg_cost'u 52W aralığına yerleştiren yatay progress bar; "İyi giriş / Tepeden giriş" etiketi. 52W verisi fundamentals cache'te mevcut.
- [ ] **Portföy Çeşitlendirme Skoru** `[M]` `[P2]` — Bölge × Sektör × Asset Type matrisinden 1-10 skor; tek bölge/sektör yoğunlaşmasına göre uyarı cümlesi. Tamamen frontend hesabı.
- [ ] **Yeniden Dengeleme Önerisi (Rebalancing)** `[M]` `[P2]` — Kullanıcı hedef dağılım girer (US %50, BIST %30 vb.); mevcut dağılımla fark gösterilir. Hedef için `profiles` tablosuna JSON kolonu gerekir.

### Risk

- [x] ~~**Volatilite / Drawdown Analizi**~~ (2026-04-29) — Risk Dashboard sprint'inde (Sprint 7) teslim edildi: `price_cache.p_d1/w1/m1/y1` bazlı ağırlıklı portföy volatilitesi; en oynaklı 3 pozisyon "Yüksek Volatilite" işaretli; AnalysisTab "Dönem Bazlı Getiri" kartına entegre edildi.
- [x] ~~**Kur Riski Göstergesi**~~ (2026-04-29) — Risk Dashboard sprint'inde (Sprint 7) teslim edildi: USD/EUR/TRY exposure yatay bar + USDTRY %10 artış portföy etkisi simülasyonu; FX Risk kartı; `convert()` + `fxRates` bazlı; FX null warn-card.
- [x] ~~**Temettü Getiri Projeksiyonu**~~ (2026-04-29) — TickerDetailTab: tahmini yıllık (≥2 DIV tx), maliyete getiri %, cari getiri %; AnalysisTab Temettü Özeti kartı: portföy verimi + top-5 bar. Dividend tracking tamamlanmasıyla birlikte teslim edildi.
- [ ] **Likidite Analizi** `[M]` `[P2]` — `marketCap` bazlı "kolayca satılabilir / az likit" sınıflandırması; portföyün kaçte kaçının 1 günde piyasada satılabileceği. Fundamentals cache'ten.

### Performans

- [x] ~~**Dönem Bazlı Getiri Karşılaştırması**~~ (2026-04-29) — Risk Dashboard: AnalysisTab 3 yeni kart: Dönem Bazlı Getiri (MV-ağırlıklı 1G/1H/1A/3A/6A/1Y + benchmark SPY/XU100); FX Risk (USD/EUR/TRY exposure bar + USDTRY +10% portföy etkisi); 6 Aylık Performans (p_m6 bazlı kazananlar/kaybedenler).
- [x] ~~**Başa Baş (Break-Even) Analizi**~~ (2026-04-29) — AnalysisTab kart 7; komisyon dahil breakEven=(shares×avg_cost+totalComm)/shares; distPct % uzaklık; pos-row click→openDetail; mask() gizli mod.
- [ ] **Satılan Pozisyonların Realized P&L Özeti** `[M]` `[P2]` — Kapatılmış pozisyonların yıl bazında tablo; "2024: +$3,200 · 2023: -$800". `transactions` BUY+SELL eşleştirmesi. Vergi & Muhasebe ile örtüşür.
- [ ] **DCA Etkinliği** `[M]` `[P2]` — Çoklu alımlarda zamanlama avantajı: "THYAO için 5 alım — tek sefere göre ortalama %8 daha iyi giriş". `transactions` BUY kayıtları.

### Karşılaştırma

- [ ] **Peer Sektör Ortalamasıyla Karşılaştırma** `[L]` `[P3]` — FMP sektör ortalaması P/E, ROE, marjla hisse bazında karşılaştırma. FMP'de yeni endpoint (`/stable/sector-pe-snapshot`) gerekir.
- [ ] **Ağırlıklı Ortalama Portföy P/E** `[S]` `[P2]` — Her pozisyonun piyasa değeri ağırlığıyla P/E ortalaması; tek satır "Portföyünüzün ortalama F/K'sı 18.4 — S&P 500 ortalamasının altında / üstünde" gibi bağlam cümlesi. Fundamentals cache (`fund_${ticker}`) zaten mevcut; sadece aggregation. Yeni fetch yok. Value-investing lens için doğal "ucuz mu pahalı mı?" özeti. **Sprint 9 scope.**
  - [ ] (a) AnalysisTab Portföy Sağlık Tablosu altına tek-satır KPI olarak ekle; MV-ağırlıklı P/E hesabı — cache'te P/E yoksa o pozisyon atlanır, atlanma sayısı küçük not ile gösterilir `[S]`
  - [ ] (b) S&P 500 karşılaştırma cümlesi — hardcoded ~22 referans (FMP /stable/market-overview ile güncellenebilir ama şimdilik sabit) `[S]`

### Vergi & Muhasebe

- [ ] **Vergi Yılı Özeti** `[L]` `[P2]` — Seçilen yılda realized kazanç/kayıp; US short-term (<1Y) / long-term (>=1Y) ayrımı; TR BIST 2 yıl muafiyet kuralı; tahmini vergi. Tarihi FX kuru için Frankfurter historical API.
- [ ] **Ortalama Elde Tutma Süresi** `[S]` `[P2]` — Pozisyon ve portföy bazında "kaç aydır tutuyorum"; "Portföy ortalaması: 8.3 ay". `transactions` BUY tarihleri, tamamen frontend.

### Risk (Ek)

- [x] ~~**Potansiyel Kayıp (Max Pain) Simülasyonu**~~ (2026-04-29) — AnalysisTab kart 8; %10/20/30 senaryo yatay bar (sarı/turuncu/kırmızı); totalMV display cur'da; FX eksikse warn-card; tamamen frontend.
- [ ] **Piyasa Düşüşü Dayanıklılık Skoru** `[M]` `[P2]` — Düşük borç (Borç/Özk < 0.5), yüksek FCF marjı (>10%), geniş op marjı (>15%) hisselerin portföydeki ağırlıklı payı → 1–10 dayanıklılık puanı; "Portföyünüzün %62'si resesyona dayanıklı şirketlerden oluşuyor" çıktısı. Fundamentals cache'ten; ek fetch yok. Banka/BIST bankalar hariç (early-exit seti). **Sprint 9 scope.**
  - [ ] (a) `resilienceScore(fund)` fonksiyonu: 3 metrik puanlama (debtToEquity, fcfMargin, operatingMargin) → 0/1/2 puan her metrik → toplam 0-6 → 1-10 scale; fund null veya eksik metrik ise `null` `[S]`
  - [ ] (b) Portföy ağırlıklı skor hesabı: MV-weighted average, dayanıklı (%62) vs dayanıksız ayrımı `[S]`
  - [ ] (c) AnalysisTab yeni kart "Piyasa Dayanıklılığı" — skor + bar + "Eksikleri Çek" CTA (Sağlık Tablosu CTA pattern'ı); BIST bankalar ve CRYPTO/GOLD/FX/FUND için kapsam dışı notu `[S]`

### Performans (Ek)

- [ ] **Pozisyon Yıllık Getiri (CAGR) Tablosu** `[S]` `[P2]` — Her açık pozisyon için: ilk BUY tarihi → bugün arası zaman + toplam getiri → yıllık CAGR; "THYAO · 2.1 yıl · +%43 toplam · %18.7/yıl". Kazandırandakileri azalan sıra. `transactions` BUY kaydı + `price_cache` + frontend hesabı; yeni veri yok. Uzun vadeli yatırımcının "hangi hisse gerçekten çalıştı?" sorusu. **Sprint 9 scope.**
  - [ ] (a) Her pozisyon için `firstBuyDate` hesabı: `transactions` içinde o ticker'ın en erken BUY tarihi; split-adjusted avg_cost (factorFor) `[S]`
  - [ ] (b) CAGR formülü: `((currentMV / totalCost) ^ (1 / years)) - 1`; fiyat yoksa o satır gri "fiyat bekleniyor" `[S]`
  - [ ] (c) AnalysisTab yeni kart "Pozisyon Getirileri (CAGR)" — tablo render; azalan sıra; click→openDetail `[S]`
- [ ] **Giriş Zamanlaması Örüntüsü (Ay Bazlı)** `[M]` `[P3]` — BUY işlemlerini ay gruplarına göre say + o giriş sonrası 3A/6A ortalama getiri hesabı; "Ocak alımlarınız Temmuz alımlarından ortalama %12 daha iyi performans gösterdi". `transactions` + `price_cache`; ek fetch az (bazı eski fiyatlar cache'te olmayabilir → sadece cache'te olan ticker'lar dahil edilir). Davranışsal öz-farkındalık; yıllık "yatırım takvimi" pattern'ı.

### Kişisel & Eğitim

- [ ] **Kişisel Yatırım Notu** `[M]` `[P2]` — Ticker bazında "neden aldım / çıkış stratejim / öğrenilen ders" serbest metin; tarih sıralı liste. Yeni `notes` Supabase tablosu (user_id, ticker nullable, date, content).
- [ ] **Portföy Zaman Çizelgesi (Timeline)** `[M]` `[P3]` — Tüm BUY/SELL kronolojik vertical timeline; isteğe bağlı piyasa olayı ekleme. `transactions` tablosu yeterli.
- [ ] **Hedef Fiyat & Değerleme Notu** `[M]` `[P2]` — Kullanıcı tanımlı hedef fiyat + kısa not; "THYAO hedef ₺380 — %17 uzakta". Yeni `target_prices` Supabase tablosu.
- [ ] **FIRE / Hedef Portföy Büyüklüğü Takibi** `[M]` `[P2]` — Kullanıcı hedef büyüklük (ör. $500.000) girer; mevcut portföy değeri + ortalama XIRR ile "hedefe X yıl kaldı" hesabı; progres bar. `profiles` tablosuna `goal_amount` + `goal_currency` kolonu gerekir. Günlük açılışta motivasyon metriki; dashboard widget olarak da ilerleyebilir.

### Davranışsal Analiz

- [ ] **Art Arda Kazanma/Kaybetme Serisi (Streak)** `[S]` `[P3]` — Kapatılmış tüm işlemler (SELL) tarih sırasına göre: kârlı/zararlı zincir; "En uzun kârlı serin 5 ardışık işlem (Mart–Nisan 2025)". Tamamen `transactions` BUY+SELL eşleştirmesi, frontend hesabı; yeni fetch yok. Davranışsal öz-farkındalık; aşırı güven / panik satış pattern'larını ortaya çıkarır.
- [ ] **Portföy Beta Tahmini** `[M]` `[P2]` — `price_cache.p_w1/m1` hareketlerini benchmark (SPY veya XU100) ile karşılaştırarak pozisyon bazlı yaklaşık beta; ağırlıklı portföy betası "Piyasa %1 düşünce portföyünüz ortalama %X etkiler" cümlesi. Benchmark fiyat geçmişi `fetch-prices` ile çekilir (Massive: SPY; Yahoo: XU100.IS) — küçük ek fetch, sonuç cache'lenebilir. `[Benchmark karşılaştırması]` item tamamlandıktan sonra kolaylaşır.

## Analiz Tab Açık Alt Görevler

- [x] ~~**Sağlık Tablosu: filter chip + "Eksikleri Çek" CTA kapalı modda gizlensin**~~ (2026-04-26) — healthOpen && wrap ile gizlendi.
- [x] ~~**Varlık Dağılımı kartına Maliyet/Piyasa toggle**~~ (2026-04-26) — assetDistMode state + segment buton.
- [x] ~~**AnalysisTab FX yok warn-card**~~ (2026-04-26) — Analiz sekmesinde FX rates null ise turuncu warn-card gösteriliyor.
- [ ] **Win/Loss time horizon seçimi** `[S]` `[P2]` — şu an bugünkü fiyat; 1A/3A/6A/1Y window chip seçimi.
- [ ] **Win/Loss sold-out ticker live price** `[S]` `[P2]` — cache'te yoksa "noPrice" sayım dışı; live fetch seçeneği ekle.
- [ ] **Analiz bölge ETF underlying** `[M]` `[P2]` — MCHI=Çin gibi; şu an FUND→US default.
- [ ] **AnalysisTab Komisyon KPI label** `[S]` `[P2]` — `{displayCur}` yerine `Toplam ({displayCur})` veya `Tüm Komisyon`.

## İçerik

- [ ] **Haber entegrasyonu** `[L]` `[P2]` — ticker bazlı; provider gerek (NewsAPI, Polygon news, benzeri).

## Öğrenme & Eğitim

- [ ] **Investment Basics modülü** `[L]` `[P2]` — uygulama içi temel finansal okuryazarlık; bileşik faiz, çeşitlendirme, risk-return, DCA, P/E açıklamaları. Kart serisi veya "lesson" formatı. Yeni kullanıcı onboarding ile entegre olabilir. Can'ın kararıyla sonraya ertelendi.

## Sosyal & Kişiselleştirme

- [x] ~~**Social Portfolios Faz 1 — Multi-portfolio altyapısı**~~ (2026-04-29) — DB tabloları, FK'lar, backfill migration, RLS, frontend prop threading. Detay: Tamamlananlar arşivinde.
- [ ] **Social Portfolios Faz 2 — Profil & Public portföyler** `[M]` `[P2]` — `UserProfileModal`; `portfolios.is_public` toggle + `privacy_level` alanı; public portföylere erişim için RLS okuma politikası; "Portföyümü paylaş" URL/slug üretimi. Faz 1 altyapısı tamamlandıktan sonra önkoşul karşılandı. **Sprint 9 scope.**
  - [ ] (a) Settings'e `is_public` toggle — mevcut portfolios tablosuna `UPDATE SET is_public` çağrısı; basit switch UI `[S]`
  - [ ] (b) RLS okuma politikası — `authenticated` kullanıcılar `is_public=true` portföyleri SELECT edebilir; rls-auditor sign-off zorunlu `[S]`
  - [ ] (c) `UserProfileModal` — avatar emoji picker + bio alanı (profiles tablosu) + kullanıcının public portföy listesi; Search'ten kullanıcı arama bağlantısı `[M]`
  - [ ] (d) Public portföy read-only view — pozisyon listesi (tutar gizli seçenek); "Bu portföy salt okunur" banner `[S]`
- [ ] **Social Portfolios Faz 3 — Takip sistemi** `[M]` `[P2]` — `follows` tablosu; follow/unfollow UI; takipçi sayısı; `portfolio_activities` feed için yazma. Faz 2 tamamlandıktan sonra.
- [ ] **Social Portfolios Faz 4 — Sosyal Feed tab** `[L]` `[P2]` — Yeni "Portföyler" ana sekmesi; "Portföyler" alt sekmesi (public portföyler listesi) + "Aktivite" alt sekmesi (takip edilenlerin son hareketleri); anonim veya kullanıcı adı bazlı. Faz 3 tamamlandıktan sonra.
- [ ] **Yatırımcı risk profili** `[M]` `[P2]` — anket → muhafazakar / dengeli / agresif.
- [ ] **Social feed** `[L]` `[P2]` — benzer risk profilindeki yatırımcıların pozisyonları; opt-in, anonim toplam. RLS policy güncellemesi gerektirir. Faz 4 ile birleştirilebilir.

## Hesap Yönetimi

- [ ] **Hesap ekranı genişletme** `[M]` `[P2]` — şifre değiştirme, email değiştirme (verifikasyonlu), hesap silme (cascade delete), avatar (opsiyonel). Mevcut username/display_name ekranı zaten var.

## Search

- [x] ~~**Recent searches**~~ (2026-04-26) — LS il_recent_search; son 8 arama chip row; handleOpen ile kayıt; nameFor/typeFor lookup.
- [ ] **SearchTab "50+" sonuç hint** `[S]` `[P2]` — "Aramayı daraltın" ipucu göster.
- [ ] **SearchTab portföy match=0 empty state** `[S]` `[P2]` — "Portföyünde eşleşme yok" mini note.

## UI Polish

- [x] ~~**Asset type ikonları: emoji → custom SVG**~~ (2026-04-26) — `ASSET_ICONS` + `COMMODITY_ICONS` top-level map; stroke="currentColor"; AddTab picker, ManuelPosForm chip render güncellendi.
- [x] ~~**Dark/Light tema desteği**~~ (2026-04-26) — `[data-theme="light"]` CSS tokens; `applyTheme()` + `matchMedia` sistem tercihi; Settings "Görünüm" 3-button segmented (Sistem/Açık/Koyu); LS `il_theme` persist.

## Bug & UX Backlog

- [x] ~~**AI parse autofill pill (ConfirmBox)**~~ (2026-04-26) — _priceFallback / _priceAutoFilled flag + ⚠/↻ pill.
- [x] ~~**ConfirmBox inline edit**~~ (2026-04-26) — Tek: Tarih/Adet/Fiyat/Broker/Komisyon inline input; Toplam reaktif. Çoklu: ✎ per-row → expand edit panel + ✓ Tamam.
- [x] ~~**Dashboard pozisyon listesi varsayılan sıralama: kazanım**~~ (2026-04-27 Sprint 4) — varsayılan sıra P&L% azalan; `sortPos` null-safe `-Infinity` fallback ile fiyatsız pozisyonlar sona itilir.
- [ ] **Dashboard ↻ Güncelle başarısız ticker ayrıntısı** `[S]` `[P2]` — şu an "başarısız: AAPL" toast; Settings → Sistem Durumu'nda per-ticker hata sebebi (HTTP 403, bulunamadı vb.).
- [x] ~~**AddTxInline NaN guard**~~ (2026-04-27 Sprint 4) — saveAI/saveTx/saveManual NaN filter; geçersiz satırlar atlanıp "X işlem kaydedildi, Y geçersiz atlandı" flash.
- [x] ~~**CSV negatif/Infinity guard**~~ (2026-04-27 Sprint 4) — `shares≤0 || !isFinite(shares) || price<0 || !isFinite(price)` satırlar skip; console.warn + skip sayacı.
- [ ] **price_cache sanity check** `[S]` `[P2]` — `price = 0 || price = null` olan satırlar "bayat" sayılıp yeniden fetch tetiklemeli.
- [x] ~~**maxLength ticker/name/broker**~~ (2026-04-29) — broker `maxLength={50}` (AddTxInline/HistoryTab×2/ManuelPosForm), ticker `maxLength={20}`, name `maxLength={100}` (ManuelPosForm).
- [ ] **il_recent_search signOut temizliği** `[S]` `[P2]` — `signOut` handler son aramaları LS'ten temizlemeli (`il_recent_search` kullanıcıya özel hissedebilir).
- [ ] **Form tutarı gizli-mod preview** `[S]` `[P2]` — `hide=true` iken form amount alanlarında girilen değerler `mask()` ile maskelenmeli.
- [x] ~~**massiveHistorical silent {}**~~ (2026-04-27 Sprint 4) — massiveHistorical + yfHistorical explicit `{error:"…"}` flag; caller console.warn + sparkline "yetersiz veri" empty state.
- [x] ~~**refresh-price-cache cron secret**~~ (2026-04-27 Sprint 4) — CRON_SECRET env; XOR constant-time compare; fail-closed (secret yoksa 500, yanlışsa 401); pg_cron job güncellendi.
- [ ] **BIST/CRYPTO/GOLD cron refresh** `[S]` `[P2]` — `refresh-price-cache` sadece US_STOCK çekiyor; BIST/CRYPTO/GOLD sütunları stale kalıyor. Cron job'ı asset_type dönüşümlü yapılmalı.
- [ ] **İş Yatırım fetch timeout** `[S]` `[P2]` — `fetch-fundamentals` isyatirim call'larında `AbortSignal.timeout(8000)` yok; ağ hatalarında edge fn asılı kalabiliyor.
- [x] ~~**Sektör Dağılımı "Bilinmiyor" bug fix**~~ (2026-04-29) — AnalysisTab mount useEffect ile auto-fetch; CRYPTO→"Kripto", GOLD→"Emtia", FX→"Döviz", FUND→"ETF / Fon" tip bazlı fallback. US_STOCK/BIST meta çekilene kadar "Bilinmiyor" kalır (kaçınılmaz).

## Güvenlik & Süreç

- [x] ~~**Periyodik agent denetim turu — ilk tur**~~ (2026-04-27) — client-security-auditor + edge-reviewer; 15 bulgu; Sprint 4 backlog'a eklendi.
- [x] ~~**Periyodik agent denetim turu — 2. tur**~~ (2026-04-29, Sprint 7) — rls-auditor + client-security-auditor + edge-reviewer paralel; 3 kritik bulgu (parse-transaction sunucu auth, RLS portfolio_id subquery, activities cross-portfolio insert); tüm bulgular `002_rls_fixes.sql` + parse-transaction rewrite ile kapatıldı. Sonraki tur: Sprint 9.
- [ ] **Periyodik agent denetim turu — 3. tur** `[S]` `[P1]` — Sprint 9 sonu kalite kapısı; odak: Social Faz 2 yeni RLS okuma politikası (kullanıcı A, kullanıcı B'nin public portföyüne erişebiliyor ama private portföyüne erişemiyor doğrulaması); public portföy read-only view'de XSS/veri sızıntısı kontrolü; edge-reviewer değişiklik yoksa skip. **Sprint 9 scope.**

## Ölçeklenme & Mass Kullanım

> Bu bölümdeki tüm maddeler şu an single-user için sorunsuz çalışıyor; kullanıcı tabanı büyüdükçe sırasıyla devreye alınmalı. **Yeni geliştirmeler bu geçişi zorlaştırmamalı**: her fetch user-başına değil cache-first yazılmalı, her external API çağrısı edge function arkasına alınmalı, client'ta secret/credential tutulmamalı.

### Kritik (Blocking — İlk 100 Kullanıcı Öncesi)

- [x] ~~**price_cache güvenlik (write-lock)**~~ (2026-04-27 Sprint 5) — `authenticated` rolü write policy kaldırıldı; tüm write `fetch-prices` service_role üstünden; frontend backfill + upsert kaldırıldı. **Not**: `fetching_since` SWR lock (N kullanıcı = 1 API çağrısı) hâlâ açık — ROADMAP'te "Shared price cache mimarisi" item'ına taşındı.
- [ ] **Yahoo Finance → resmi BIST data kaynağı** `[L]` `[P1]` — unofficial endpoint, herhangi bir güncellemede veya bot-block'ta tüm BIST kullanıcıları için fiyat kesilir. Adaylar: Rasyonet, Matriks, Bigpara API, Investing.com TR. Seçilene kadar mevcut Yahoo devam eder ama geçiş mimarisi edge function içinde izole — frontend değişmez.
- [ ] **borsa-mcp self-host** `[M]` `[P1]` — tek geliştirici hosted instance, SLA yok. Supabase Edge Function içine ya da ayrı bir VPS'e Docker ile al (Python 3.11, `saidsurucu/borsa-mcp`). Alternatif: `yahoo-finance2` npm paketi Deno'da çalışıyor mu test et.
- [x] ~~**Claude Haiku parse rate limiting + maliyet kotası**~~ (2026-04-27 Sprint 5) — JWT-verified identity (`auth.getUser(token)`); `increment_parse_calls` PL/pgSQL RPC (atomic, TOCTOU-safe); 20/gün/kullanıcı; `edgeCallAuth` frontend helper; image type+size validation; max_tokens 1200.

### Önemli (İlk 500 Kullanıcı Öncesi)

- [ ] **Shared price cache mimarisi — user-başına fetch kaldır** `[M]` `[P1]` — "price_cache güvenlik + fetch lock MVP" (üstteki P0 item) tamamlandıktan sonraki adım: cron kapsamını genişlet, frontend read-only hale getir, yazma tamamen edge function'da olsun. P0 item'ı bu maddenin MVP'si sayılır.
- [ ] **Massive.com rate limit yönetimi** `[M]` `[P1]` — `CFG.RATE_LIMIT_MS = 7500` ile 10 ticker = 75 sn; shared rate limit altında çok kullanıcı çakışınca 429. Seçenekler: Paid tier (real-time + yüksek limit), ya da önce cache-first mimariye geç (üstteki madde), sonra paid'e geçmek kolaylaşır.
- [ ] **SEC EDGAR ticker DB → Supabase tablosu** `[M]` `[P2]` — şu an her yeni kullanıcı ilk SearchTab açılışında edge function üstünden ~11K entry çekiyor. Haftalık cron ile `ticker_db` Supabase tablosuna sync et; frontend doğrudan Supabase'den okur. EDGAR 10 req/sn limiti + edge function cold start ortadan kalkar.
- [ ] **refresh-price-cache cron — asset_type rotasyonu** `[S]` `[P2]` — şu an cron sadece US_STOCK tickerları tazeler; BIST/CRYPTO/GOLD stale kalıyor. Cron job'ı sırayla tüm asset_type'ları döngüye al; ya da asset_type bazlı 4 ayrı job.
- [ ] **Auto-fetch opt-in** `[S]` `[P2]` — şu an mount'ta otomatik; çok kullanıcıda rate limit zorlar. İleride "otomatik güncelleme aralığı" kullanıcı ayarı yapılabilir.

### İzlenmesi Gerekenler (Scalability Monitor)

- [ ] **Frankfurter API fallback** `[S]` `[P2]` — ücretsiz, SLA yok. Kesintide tüm kullanıcılar "FX kuru yok" warn-card görür. Fallback: ECB doğrudan XML feed (`sdw-wsrest.ecb.europa.eu`). Şu an yeterli ama çok kullanıcıda SLA gerekebilir.
- [ ] **İş Yatırım MaliTablo resmi olmayan endpoint izleme** `[S]` `[P2]` — browser-style header gerektiren unofficial endpoint; anti-bot değişikliğinde BIST fundamentals sessizce kırılır. Response boş/HTML gelince kullanıcıya açık hata göster (şu an silent fail).
- [ ] **Fundamental data Supabase cache** `[M]` `[P2]` — şu an LS yeterli (7 gün TTL); kullanıcı sayısı arttıkça her kullanıcı aynı AAPL fundamentalını ayrı ayrı çekiyor. Merkezi `fundamental_cache` tablosu + 7 gün TTL ile FMP/EDGAR call'larını birleştir.

---

## Mobil Uygulama (App Store & Google Play)

> **Mevcut durum**: `index.html` tek-dosya React + Babel Standalone, build adımı yok, GitHub Pages'de host. Mobil uygulama yayını için bu mimarinin aşamalı olarak değişmesi gerekiyor. Aşağıdaki yol haritası en az sürtünmeli geçiş sıralamasıyla yazılmıştır.

### Aşama M1 — PWA (Hemen Uygulanabilir)

- [ ] **Progressive Web App (PWA) hazırlığı** `[M]` `[P1]` — `manifest.json` (icon 192/512px, `display:standalone`, `theme_color`), minimal `service-worker.js` (offline shell cache), `<link rel="manifest">`. iOS Safari'de "Ana Ekrana Ekle" + Android Chrome'da install prompt aktif olur. App Store başvurusu gerektirmez, dağıtım GitHub Pages üstünden devam eder. **Bu adım mevcut index.html mimarisini bozmaz.** **Sprint 9 scope.**
  - [ ] (a) `manifest.json` — name/short_name: "Investment Ledger", start_url: "/Investment-Ledger/", display: standalone, background_color/theme_color: #000; icons 192px + 512px PNG `[S]`
  - [ ] (b) `service-worker.js` minimal — install event: offline shell (index.html + manifest.json) precache; fetch event: cache-first for shell, network-first for API calls; stale-while-revalidate pattern `[S]`
  - [ ] (c) `index.html` head: `<link rel="manifest">` + `<meta name="apple-mobile-web-app-capable">` + `<meta name="theme-color">` + service worker registration script `[S]`
- [ ] **PWA ikonları + splash screen** `[S]` `[P2]` — 192/512px PNG ikonlar; iOS için `apple-touch-icon`; splash screen `theme_color` ile uyumlu.

### Aşama M2 — Build Sistemi Geçişi (Mobil Uygulama Önkoşulu)

> App Store / Play Store için Capacitor veya React Native gerekir. İkisi de build adımı ister. Bu aşama, mevcut Babel Standalone → Vite + JSX geçişini kapsar.

- [ ] **Vite + JSX build sistemine geçiş** `[L]` `[P1]` — `index.html` içindeki `<script type="text/babel">` bloğunu `src/` altına taşı. CDN script'lerini npm package'a çevir (`react`, `react-dom`, `@supabase/supabase-js`). Vite dev server + production build. GitHub Pages deploy: GitHub Actions `vite build → dist/` publish. **Bu geçiş sırasında UI/fonksiyon değişmemeli; pure refactor.** DoD'a dahil: `.env` + `import.meta.env.VITE_*` env variable yönetimi (şu an hardcoded olan Supabase URL + anon key).
- [ ] **Offline-capable service worker** `[M]` `[P2]` — **Vite geçişi sonrası** (M2). CDN script'leri yerine bundle'lanmış assets precache edilir; ağ yokken app açılabilsin (veri eskiyle görünsün). Strateji: stale-while-revalidate. Babel Standalone + CDN ile bu anlamlı değil.
- [ ] **TypeScript opt-in (kademeli)** `[M]` `[P2]` — Vite geçişi sonrası `allowJs:true` ile başla; kritik yardımcılar (`convert`, `rebuildPositions`, `xirr`) önce type'la, geri kalanlar zamanla. Mobil kod tabanı yönetimi için gerekli.
- [ ] **Env variable yönetimi** `[S]` `[P1]` — şu an Supabase URL + anon key `index.html`'e hardcoded (public OK ama best practice değil). Vite geçişiyle `.env` + `import.meta.env.VITE_*`'a taşı; CLAUDE.md'de de belgelenmiş olan "anon key public'tir" kuralı korunur.

### Aşama M3 — Native Wrapper (App Store Başvurusu)

- [ ] **Capacitor entegrasyonu** `[L]` `[P1]` — Vite build çıktısını (`dist/`) Capacitor ile sarmalayıp iOS + Android native proje oluştur. `npx cap add ios && npx cap add android`. Supabase Auth, Capacitor içinde `@supabase/supabase-js` ile doğrudan çalışır (OAuth redirect için `capacitor://localhost` deep link gerekir). Web kodu büyük ölçüde değişmez.
- [ ] **Deep link & OAuth redirect** `[M]` `[P1]` — Supabase magic link / OAuth sonrası `capacitor://` scheme'e redirect; iOS `Info.plist` + Android `AndroidManifest.xml` URL scheme kaydı.
- [ ] **Push notification (opsiyonel)** `[M]` `[P2]` — `@capacitor/push-notifications`; fiyat alarmı, önemli portföy hareketi bildirimi. Supabase Edge Function → FCM/APNs.
- [ ] **App Store metadata & review hazırlığı** `[M]` `[P1]` — Apple: `NSUserTrackingUsageDescription` (tracking yok → basit), Privacy Nutrition Label (email, finansal veri), Review Guideline 5.1.1 (finansal veri + hesap silme zorunlu). Google: Data Safety form, kişisel finans kategorisi.
- [ ] **Hesap silme (App Store zorunluluğu)** `[S]` `[P1]` — Apple App Store Review Guideline 5.1.1: hesap oluşturan app, kullanıcıya hesabı silme imkânı sunmak zorunda. Şu an "Hesap ekranı genişletme" maddesinde var; App Store başvurusundan önce tamamlanmalı.

### Geçişi Kolaylaştırmak İçin Şimdiden Uyulması Gereken Kurallar

> Mobil geçişi zorlaştırmamak için **mevcut geliştirmelerde** şu kurallara uy:

1. **Yeni state'i `localStorage` yerine Supabase'e yaz** — LS user-agnostic ve native'de kaybolabilir; kritik veri (ayarlar, tercihler) `profiles` tablosuna taşınmalı.
2. **Her external API çağrısını edge function arkasına al** — tarayıcıdan doğrudan 3. parti API fetch, native'de CORS + sertifika sorunları yaratabilir; edge function proxy olarak kalır.
3. **`window` / `document` bağımlılığını izole et** — yeni bileşenler DOM'a doğrudan erişmemeli; React state/ref yeterli. Native'de `window` mock'lanması gerekir.
4. **CSS `px` yerine `rem`/`dvh` tercih et** — iOS safe-area ve farklı DPI'lar için daha güvenli; yeni bileşenlerde `px` yerine `rem` kullan.
5. **`confirm()` / `alert()` kullanma** — zaten custom `confirm_()` var; native'de native dialog API farklı çalışır, mevcut wrapper yeterli.

## Sprint Audit Backlog (UI/a11y)

Gruplu öncelik sırasına göre — büyük sprint'lere entegre edilir:

### Grup 1 — UX Kalite (P0/P1, kolaydan zora)

- [x] ~~**Pozisyonları Yeniden Hesapla confirm guard**~~ (2026-04-26) — confirm_() danger modal eklendi.
- [x] ~~**HistoryTab tx satırından openDetail**~~ (2026-04-26) — ticker span tıklanabilir, openDetail prop geçildi.
- [x] ~~**Touch device tooltip (data-tip tap-to-show)**~~ (2026-04-26) — global touchstart listener; data-tip-visible CSS class; 2500ms auto-dismiss; button/a skip.
- [x] ~~**Loading state standardı (SkeletonRow/SkeletonCard)**~~ (2026-04-26) — SkeletonLine/SkeletonCard/SkeletonRows shimmer components. Dashboard ilk yük → 3 skeleton kart + 5 satır; meta/fund → SkeletonRows.
- [x] ~~**Form input error inline**~~ (2026-04-27) — invalid date/negatif adet; `aria-invalid` + 11px error text; kırmızı border + inline mesaj.
- [x] ~~**Confirm modal backdrop click guard (danger)**~~ (2026-04-27) — `danger:true` modal'da backdrop click iptal sayılmaz; explicit "İptal" zorunlu.
- [x] ~~**EUR tablosu sort**~~ (2026-04-29) — Kod zaten `localeCompare` ile alfabetik sıralıyordu; tamamlanmış sayıldı.

### Grup 2 — Bildirim/Feedback (P1)

- [x] ~~**AddTab CSV import skip count**~~ (2026-04-26) — geçersiz satırlar için `flash_("X işlem alındı, Y satır atlandı")` gösterimi eklendi.
- [x] ~~**cur-seg dokunma hedefi mobile**~~ (2026-04-26) — mobile media query 44px AA dokunma hedefi.
- [x] ~~**Period buton wrap dar ekran**~~ (2026-04-29) — `.fbar` scrollable container, `flex:"0 0 auto" padding:"5px 14px"`. 320px'de artık yatay kaydırma ile çalışıyor.
- [x] ~~**↻ Güncelle progress mobile**~~ (2026-04-26) — otomatik güncelleme (30dk interval + visibility API) + Settings'e taşındı; `.mprog` mobil progress strip eklendi.
- [x] ~~**Flash position:fixed**~~ (2026-04-26) — `position:fixed; top:60px` sticky banner; scroll'da kaybolma giderildi.
- [x] ~~**Sparkline empty state min-height**~~ (2026-04-26) — data <2 ise kart min-height korunuyor.

### Grup 3 — a11y / Microcopy (P2)

- [ ] **HistoryTab accordion ticker DM Mono** `[S]` `[P2]` — sistem mono ile farklı render; `fontFamily:"DM Mono, monospace"` ekle.
- [ ] **Border contrast bump** `[S]` `[P2]` — `--border rgba(255,255,255,0.06)` bazı kartlarda kayboluyor; %10 veya inner shadow.
- [ ] **fundLoading spin icon** `[S]` `[P2]` — "..." yerine spin icon.
- [ ] **Login error/success → .flash class** `[S]` `[P2]` — inline style yerine class.
- [ ] **TickerDetailTab metaErr warn-card** `[S]` `[P2]` — küçük `.err` span yerine `.warn-card` tutarlılık.
- [ ] **Settings label semantik** `[S]` `[P2]` — `<label>` → `<div className="stitle">` standalone heading için.
- [ ] **Login autocomplete attributes** `[S]` `[P2]` — `email` + `current-password`.
- [x] ~~**input type="number" step="any"**~~ (2026-04-27) — ondalık adet (kripto/altın); 0.5 BTC / 3.75 gram girişleri artık kabul ediliyor.
- [ ] **HistoryTab "tot" negatif format** `[S]` `[P2]` — `$-1,234` → `-$1,234`.
- [ ] **Spinner boyut standardı** `[S]` `[P2]` — 12/14/11px karışık; tek standart.
- [ ] **Tip picker desc font/contrast** `[S]` `[P2]` — 10px var(--text3) AA sınırda.
- [ ] **AddTab tip değiştir butonu dokunma hedefi** `[S]` `[P2]` — 24-26px → 44px.
- [ ] **SearchTab autoFocus mobile** `[S]` `[P2]` — sekme geçişinde anında klavye açıyor; desktop-only focus + 150ms delay.
- [ ] **Türkçe/İngilizce term sözlüğü** `[S]` `[P2]` — CLAUDE.md'ye glossary ekle; `period` → `dönem` vb.

## Açık Sorular

- Provider seçimleri ücretsiz mi? Daily rate limit ne? (Massive, FMP free tier sınırı)
- Social feed için kullanıcı pozisyon paylaşımı → RLS policy güncellemesi mimarisi

---

## Sonraki Adım

Sprint 4 ✅ | Sprint 5 ✅ | Sprint 6 ✅ | Sprint 7 ✅ | Sprint 8 ✅ (2026-04-29) | **Sprint 9 → 2026-04-30 / 2026-05-13**

Sprint 7+8 retro özeti: Güvenlik sertleştirme (parse-transaction server auth, RLS hardening), Dividend tracking (DIV schema + cashflow + projeksiyonu), Risk Dashboard (3 kart), Temettü Özeti (AnalysisTab), pie redesign (stacked + collapsible), Dashboard badge temizliği. Tüm maddeler teslim edildi ve push edildi.

Sprint 9 groomed scope (öncelik sırasına göre — `sprints/sprint-09.md` detayı):

1. **[Öncelik 1] Social Portfolios Faz 2** `[M][P2]` — `portfolios.is_public` toggle (Settings); `UserProfileModal` (avatar emoji + bio + public portföy listesi); public portföy read-only view. Alt-hikayeler: (a) is_public toggle S, (b) RLS okuma politikası S, (c) UserProfileModal M, (d) read-only görünüm S. Faz 1 altyapısı hazır; rls-auditor sign-off gerekli.
2. **[Öncelik 2] Ağırlıklı Ortalama Portföy P/E** `[S][P2]` — `fund_${ticker}` LS cache'ten aggregation; AnalysisTab yeni kart; "Portföyünüzün F/K'sı 18.4 — S&P 500 ortalamasının altında/üstünde" bağlam cümlesi. Yeni fetch yok; fundamentals cache zaten mevcut.
3. **[Öncelik 3] Pozisyon Yıllık Getiri (CAGR) Tablosu** `[S][P2]` — Her açık pozisyon için ilk BUY tarihi → bugün arası CAGR; split-adjusted (`factorFor`); azalan sıra; transactions + price_cache yeterli.
4. **[Öncelik 4] Piyasa Düşüşü Dayanıklılık Skoru** `[M][P2]` — Borç/Özk + FCF marjı + op marjı → ağırlıklı 1-10 skor; "Portföyünüzün %62'si resesyona dayanıklı" özeti; "Eksikleri Çek" CTA; fundamentals cache'ten; ek fetch yok.
5. **[Öncelik 5] PWA hazırlığı** `[M][P1]` — `manifest.json` (icon 192/512px, display:standalone) + minimal `service-worker.js` (offline shell cache) + `<link rel="manifest">`; index.html mimarisini bozmaz; "Ana Ekrana Ekle" aktif.
6. **[Öncelik 6] Periyodik agent denetim turu — 3. tur** `[S][P1]` — Sprint sonu kalite kapısı; rls-auditor (Social Faz 2 yeni politikaları) + client-security-auditor (public portföy view XSS kontrolü) + edge-reviewer.
