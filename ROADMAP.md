# Roadmap / Idea Backlog

Fikir havuzu — öncelik ve boyut etiketli, her sprint gözden geçirilir.

İlk toplama: **2026-04-24** | Son grooming: **2026-04-27** (Sprint 4 planı eklendi)

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

---

## Bekleyenler / Blokerli

- [ ] **TEFAS WAF testi** `[S]` `[P2]` — Endpoint bulundu: `https://fundturkey.com.tr/api/DB/BindHistoryInfo` (POST, cookie + `X-Requested-With` header zorunlu). Bloker: F5 WAF cloud IP'lerini engelliyor (Nisan 2026 issue #35 — Render.com/AWS'ten robot check). **Test adımı**: Supabase Dashboard → Edge Functions → Test tab'dan doğrudan POST dene. Çalışırsa Sprint 5'e tam entegrasyon girer (edge function FUND dalı + US ETF vs TEFAS ayrımı). Çalışmazsa: RapidAPI wrapper (`rapidapi.com/kbilgen1980/api/tefas2`) fiyatlandırmasına bak veya borsa-mcp proxy üstünden dene.

---

## Asset Type Genişletme

- [x] ~~**TR altın birimleri MVP**~~ (2026-04-27) — `positions.unit` migration + `GOLD_UNITS` oz-eq tablo (oz/g/quarter/half/full/republic; gram ağırlık + saflık) + birim picker 6 chip + oz-eq `savePos` + Dashboard back-conversion display. USD/ons geriye uyumlu (unit=null → factor=1).
- [ ] **Dividend (temettü) tracking** `[M]` `[P1]` — BIST + US hisseleri için temettü girişi; `transactions` tablosunda `way:"DIV"` (schema CHECK varsa kaldır); Dashboard total return'e dahil; geçmiş temettü listesi HistoryTab'da. Value-investing aracının temel taşı — vadeli mevduat'tan önce gelir.
- [ ] **TR altın işçilik premium göstergesi** `[M]` `[P2]` — Reşat/Ata birimi ekleme; Dashboard "5 çeyrek · ₺12,000/ad · Spot saf ₺55,000 · Premium %9" render; ödenen fiyat − spot saf fark hesabı.
- [ ] **BIST P/S metriği** `[S]` `[P2]` — borsa-mcp `meta.market_cap` / `latestRevenue` ile derive; frontend veya edge function 2. call.
- [ ] **BIST bankalar fundamentals** `[L]` `[P2]` — UFRS grubu Roman numeral itemCode mapping; `ISY_KNOWN_BANKS` set'i kaldır. (Bankalar şu an early-exit ile bloklu.)
- [ ] **Sektör-aware fundamental eşikler** `[M]` `[P1]` — tech P/E ≤30, utility ≤15 vs.; `sic_description` veya FMP `sector` ile profile seç. TR enflasyonu CAGR eşiklerini de etkiliyor — nominal vs reel.
- [ ] **FX/GOLD ham ticker normalize** `[S]` `[P2]` — edge function `asset_type:"FX"` ile prefix'siz `USDTRY` gelirse 404 dönüyor sessizce; `C:` autoprefix + length/format guard. Aktif bug değil ama future-proofing.
- [ ] **BIST price-cache TRY-aware** `[S]` `[P2]` — `prc[ticker]` raw değer; pos.currency="TRY" ile FE doğru sembol seçiyor (şu an sağlam). TRY/USD fx conversion hazırlığı gerekirse bu item devreye girer.
- [ ] **Vadeli mevduat** `[M]` `[P2]` — faiz oranı, vade, getiri hesabı; provider yok, kullanıcı girer.

## Görselleştirme

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
- [ ] **Benchmark karşılaştırması** `[M]` `[P1]` — portföy vs SPY / XU100.IS / QQQ; seçilen dönemde "Piyasayı geçiyor muyum?". Massive.com (SPY) + Yahoo Finance (XU100.IS) mevcut `fetch-prices` ile çekilebilir.
- [ ] **FMP rate limit guard** `[S]` `[P2]` — free tier sınırını test et + guard ekle.

## Analiz Tab — Yeni Özellikler

### Portföy Analizi

- [ ] **Konsantrasyon Risk Göstergesi** `[S]` `[P1]` — Top 3 pozisyonun toplam ağırlığı; kırmızı >%60, sarı %40-60, yeşil <=%40. Herfindahl-Hirschman Index veya basit top-N yüzdesi. Tamamen frontend hesabı, yeni veri yok. **Sprint 4 scope.**
- [ ] **Sektör Dağılımı** `[M]` `[P1]` — FMP `sector` + borsa-mcp `industry` alanlarını birleştirip sektörel pie chart. Veriler fundamentals cache'te zaten mevcut; sadece okuma + görselleştirme.
- [ ] **"Dip mi Tepeden mi Girdim?" Giriş Kalitesi** `[S]` `[P2]` — avg_cost'u 52W aralığına yerleştiren yatay progress bar; "İyi giriş / Tepeden giriş" etiketi. 52W verisi fundamentals cache'te mevcut.
- [ ] **Portföy Çeşitlendirme Skoru** `[M]` `[P2]` — Bölge × Sektör × Asset Type matrisinden 1-10 skor; tek bölge/sektör yoğunlaşmasına göre uyarı cümlesi. Tamamen frontend hesabı.
- [ ] **Yeniden Dengeleme Önerisi (Rebalancing)** `[M]` `[P2]` — Kullanıcı hedef dağılım girer (US %50, BIST %30 vb.); mevcut dağılımla fark gösterilir. Hedef için `profiles` tablosuna JSON kolonu gerekir.

### Risk

- [ ] **Volatilite / Drawdown Analizi** `[S]` `[P1]` — `price_cache.p_d1/w1/m1/y1` değişim yüzdelerinden ağırlıklı portföy volatilitesi; en dalgalı 3 pozisyon "Yüksek Volatilite" işaretli. Yeni fetch yok.
- [ ] **Kur Riski Göstergesi** `[S]` `[P1]` — TRY/USD/EUR exposure dağılımı; "₺'nin %10 değer kaybı portföyünüzü $X etkiler" simülasyonu. `convert()` + `fxRates` zaten hazır.
- [ ] **Temettü Getiri Projeksiyonu** `[S]` `[P1]` — FMP `dividendYield` + borsa-mcp `dividend_yield` cache'ten; yıllık beklenen temettü geliri toplamı. Dividend tracking (ROADMAP P1) özelliğinin öncü adımı.
- [ ] **Likidite Analizi** `[M]` `[P2]` — `marketCap` bazlı "kolayca satılabilir / az likit" sınıflandırması; portföyün kaçte kaçının 1 günde piyasada satılabileceği. Fundamentals cache'ten.

### Performans

- [ ] **Dönem Bazlı Getiri Karşılaştırması** `[S]` `[P1]` — Hisse bazında 1A/3A/6A/1Y getiri horizontal bar chart, en çok kazandırandan azalana sıralı. `price_cache.p_d1/w1/m1/y1` yeterli; Win/Loss kartının doğal devamı.
- [ ] **Başa Baş (Break-Even) Analizi** `[S]` `[P1]` — Komisyon dahil gerçek maliyet tabanlı break-even fiyatı; "THYAO'nun ₺52.3'e çıkması gerekiyor · %8 uzakta". `positions.avg_cost` + `transactions` komisyon toplamı + `price_cache`. Tamamen frontend.
- [ ] **Satılan Pozisyonların Realized P&L Özeti** `[M]` `[P2]` — Kapatılmış pozisyonların yıl bazında tablo; "2024: +$3,200 · 2023: -$800". `transactions` BUY+SELL eşleştirmesi. Vergi & Muhasebe ile örtüşür.
- [ ] **DCA Etkinliği** `[M]` `[P2]` — Çoklu alımlarda zamanlama avantajı: "THYAO için 5 alım — tek sefere göre ortalama %8 daha iyi giriş". `transactions` BUY kayıtları.

### Karşılaştırma

- [ ] **Peer Sektör Ortalamasıyla Karşılaştırma** `[L]` `[P3]` — FMP sektör ortalaması P/E, ROE, marjla hisse bazında karşılaştırma. FMP'de yeni endpoint (`/stable/sector-pe-snapshot`) gerekir.

### Vergi & Muhasebe

- [ ] **Vergi Yılı Özeti** `[L]` `[P2]` — Seçilen yılda realized kazanç/kayıp; US short-term (<1Y) / long-term (>=1Y) ayrımı; TR BIST 2 yıl muafiyet kuralı; tahmini vergi. Tarihi FX kuru için Frankfurter historical API.
- [ ] **Ortalama Elde Tutma Süresi** `[S]` `[P2]` — Pozisyon ve portföy bazında "kaç aydır tutuyorum"; "Portföy ortalaması: 8.3 ay". `transactions` BUY tarihleri, tamamen frontend.

### Kişisel & Eğitim

- [ ] **Kişisel Yatırım Notu** `[M]` `[P2]` — Ticker bazında "neden aldım / çıkış stratejim / öğrenilen ders" serbest metin; tarih sıralı liste. Yeni `notes` Supabase tablosu (user_id, ticker nullable, date, content).
- [ ] **Portföy Zaman Çizelgesi (Timeline)** `[M]` `[P3]` — Tüm BUY/SELL kronolojik vertical timeline; isteğe bağlı piyasa olayı ekleme. `transactions` tablosu yeterli.
- [ ] **Hedef Fiyat & Değerleme Notu** `[M]` `[P2]` — Kullanıcı tanımlı hedef fiyat + kısa not; "THYAO hedef ₺380 — %17 uzakta". Yeni `target_prices` Supabase tablosu.

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

- [ ] **Yatırımcı risk profili** `[M]` `[P2]` — anket → muhafazakar / dengeli / agresif.
- [ ] **Social feed** `[L]` `[P2]` — benzer risk profilindeki yatırımcıların pozisyonları; opt-in, anonim toplam. RLS policy güncellemesi gerektirir.

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
- [ ] **Dashboard pozisyon listesi varsayılan sıralama: kazanım** `[S]` `[P1]` — her blokta (US Hisse / BIST / vb.) varsayılan sıra P&L% azalan olsun; en çok kazandıran hisse en üste gelsin. Şu an sıralama yok (insert sırası). **Sprint 4 scope.**
- [ ] **Dashboard ↻ Güncelle başarısız ticker ayrıntısı** `[S]` `[P2]` — şu an "başarısız: AAPL" toast; Settings → Sistem Durumu'nda per-ticker hata sebebi (HTTP 403, bulunamadı vb.).
- [ ] **AddTxInline NaN guard** `[S]` `[P1]` — parse sonucu `shares/price` NaN/undefined olursa form temiz error state göstermeli; şu an sessiz gönderim. **Sprint 4 scope.**
- [ ] **CSV negatif/Infinity guard** `[S]` `[P1]` — `shares ≤ 0` veya `price = Infinity` olan CSV satırları import edilmemeli; skip count'a eklenmeli. **Sprint 4 scope.**
- [ ] **price_cache sanity check** `[S]` `[P2]` — `price = 0 || price = null` olan satırlar "bayat" sayılıp yeniden fetch tetiklemeli.
- [ ] **maxLength ticker/name/broker** `[S]` `[P2]` — ManuelPosForm + AddTxInline ticker (16), name (80), broker (40) inputlarına `maxLength` prop.
- [ ] **il_recent_search signOut temizliği** `[S]` `[P2]` — `signOut` handler son aramaları LS'ten temizlemeli (`il_recent_search` kullanıcıya özel hissedebilir).
- [ ] **Form tutarı gizli-mod preview** `[S]` `[P2]` — `hide=true` iken form amount alanlarında girilen değerler `mask()` ile maskelenmeli.
- [ ] **massiveHistorical silent {}** `[S]` `[P1]` — `fetch-prices` edge function `massiveHistorical()` hata durumunda `{}` dönüyor; caller farkında değil. Explicit `throw` veya `{error:…}` flag gerekli. **Sprint 4 scope.**
- [ ] **refresh-price-cache cron secret** `[S]` `[P1]` — pg_cron job anon Bearer kullanıyor; `SERVICE_ROLE_KEY` veya ayrı `CRON_SECRET` env ile koruma. Şu an herkes bildik URL ile tetikleyebilir. **Sprint 4 scope.**
- [ ] **BIST/CRYPTO/GOLD cron refresh** `[S]` `[P2]` — `refresh-price-cache` sadece US_STOCK çekiyor; BIST/CRYPTO/GOLD sütunları stale kalıyor. Cron job'ı asset_type dönüşümlü yapılmalı.
- [ ] **İş Yatırım fetch timeout** `[S]` `[P2]` — `fetch-fundamentals` isyatirim call'larında `AbortSignal.timeout(8000)` yok; ağ hatalarında edge fn asılı kalabiliyor.

## Güvenlik & Süreç

- [x] ~~**Periyodik agent denetim turu — ilk tur**~~ (2026-04-27) — client-security-auditor + edge-reviewer; 15 bulgu; Sprint 4 backlog'a eklendi.
- [ ] **Periyodik agent denetim turu (her 2-3 sprint)** `[S]` `[P1]` — Bir sonraki tur: Sprint 5 sonu. 5 agent paralel: client-security-auditor, edge-reviewer, rls-auditor, test-runner, product-owner.

## Ölçeklenme & Mass Kullanım

> Bu bölümdeki tüm maddeler şu an single-user için sorunsuz çalışıyor; kullanıcı tabanı büyüdükçe sırasıyla devreye alınmalı. **Yeni geliştirmeler bu geçişi zorlaştırmamalı**: her fetch user-başına değil cache-first yazılmalı, her external API çağrısı edge function arkasına alınmalı, client'ta secret/credential tutulmamalı.

### Kritik (Blocking — İlk 100 Kullanıcı Öncesi)

- [ ] **price_cache güvenlik + fetch lock MVP** `[M]` `[P0]` — İKİ İŞ BİR ARADA (aynı code path): (A) **Güvenlik**: `authenticated` rolünün doğrudan write yetkisini kaldır, tüm write `fetch-prices` edge function üstünden service_role ile yapılsın — race condition + manipülasyon riski giderilir. (B) **Stale-while-revalidate**: `price_cache`'e `fetching_since TIMESTAMPTZ` kolonu ekle; kullanıcı gelince cache'ten anlık göster, `updated_at` 15 dk'dan eskiyse edge function lock alarak fetch başlat (N kullanıcı = 1 API çağrısı); tarihsel (p_d1/w1/m1/y1) cron'da kalır. Uygulama sırası: SQL migration → edge fn lock → frontend SWR akışı.
- [ ] **Yahoo Finance → resmi BIST data kaynağı** `[L]` `[P1]` — unofficial endpoint, herhangi bir güncellemede veya bot-block'ta tüm BIST kullanıcıları için fiyat kesilir. Adaylar: Rasyonet, Matriks, Bigpara API, Investing.com TR. Seçilene kadar mevcut Yahoo devam eder ama geçiş mimarisi edge function içinde izole — frontend değişmez.
- [ ] **borsa-mcp self-host** `[M]` `[P1]` — tek geliştirici hosted instance, SLA yok. Supabase Edge Function içine ya da ayrı bir VPS'e Docker ile al (Python 3.11, `saidsurucu/borsa-mcp`). Alternatif: `yahoo-finance2` npm paketi Deno'da çalışıyor mu test et.
- [ ] **Claude Haiku parse rate limiting + maliyet kotası** `[S]` `[P1]` — her kullanıcı makbuz/görsel parse edebiliyor; token maliyeti kullanıcı sayısıyla doğru orantılı büyür. Kullanıcı başına günlük parse limiti (ör. 10 istek) + Supabase `profiles` tablosunda sayaç. Gerekirse parse özelliğini premium'a al.

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

- [ ] **Progressive Web App (PWA) hazırlığı** `[M]` `[P1]` — `manifest.json` (icon 192/512px, `display:standalone`, `theme_color`), minimal `service-worker.js` (offline shell cache), `<link rel="manifest">`. iOS Safari'de "Ana Ekrana Ekle" + Android Chrome'da install prompt aktif olur. App Store başvurusu gerektirmez, dağıtım GitHub Pages üstünden devam eder. **Bu adım mevcut index.html mimarisini bozmaz.**
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
- [ ] **EUR tablosu sort** `[S]` `[P1]` — USD/TRY tablolarında sort var, EUR statik; en azından Ticker alfabetik.

### Grup 2 — Bildirim/Feedback (P1)

- [x] ~~**AddTab CSV import skip count**~~ (2026-04-26) — geçersiz satırlar için `flash_("X işlem alındı, Y satır atlandı")` gösterimi eklendi.
- [x] ~~**cur-seg dokunma hedefi mobile**~~ (2026-04-26) — mobile media query 44px AA dokunma hedefi.
- [ ] **Period buton wrap dar ekran** `[S]` `[P1]` — `flex:1 + minWidth:40` 320px'de eziliyor. **Sprint 4 scope.**
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

Sprint 4 — 2026-04-28 → 2026-05-11 | **Güvenlik hızlı kazanımlar + UX boşlukları**

Aktif sprint scope'u (`sprints/sprint-04.md`):

1. **refresh-price-cache cron secret** `[S][P1]` — `CRON_SECRET` env; pg_cron anon Bearer yerine. **Bu sprint.**
2. **massiveHistorical silent {} fix** `[S][P1]` — edge fn explicit error flag; sparkline sessiz bozukluk giderildi. **Bu sprint.**
3. **AddTxInline NaN guard + CSV negatif/Infinity guard** `[S][P1]` — form ve CSV import veri kalitesi. **Bu sprint.**
4. **Period buton wrap dar ekran** `[S][P1]` — 320px'de eziliyor; Sprint 3'ten taşındı. **Bu sprint.**
5. **Dashboard varsayılan sıralama: kazanım** `[S][P1]` — P&L% azalan; her sabah en iyi/kötü görünür. **Bu sprint.**
6. **Konsantrasyon Risk Göstergesi** `[S][P1]` — Analiz Tab yeni kart; Top 3 ağırlık + HHI + renk pill. **Bu sprint.**

Sprint 5 önizlemesi (sonraki):

- **price_cache güvenlik + fetch lock MVP** `[M][P0]` — SQL migration + edge fn service_role write + frontend SWR. En kritik mimari item.
- **Dividend (temettü) tracking** `[M][P1]` — `transactions.way:"DIV"` + Dashboard total return dahil.
- **TEFAS endpoint keşfi** `[S][P2]` — 1 oturum keşif bütçesi; çalışırsa Sprint 6'ya tam entegrasyon.
- **Benchmark karşılaştırması (SPY/XU100)** `[M][P1]` — portföy vs endeks; Massive.com + Yahoo Finance mevcut altyapıyla.
- **Periyodik agent denetim turu** `[S][P1]` — Sprint 5 sonu; 5 agent paralel.
