# Roadmap / Idea Backlog

Fikir havuzu — öncelik ve boyut etiketli, her sprint gözden geçirilir.

İlk toplama: **2026-04-24** | Son grooming: **2026-04-26**

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

---

## Bekleyenler / Blokerli

- [ ] **TEFAS entegrasyonu** — borsa-mcp `get_fund_data` + TEFAS resmi endpoint'leri `404 ERR-006`; sprint'e girmesin. Provider keşfi yapılınca yeniden değerlendirilir:
  - TEFAS Next.js network analizi → güncel endpoint'leri bul
  - Alternatif: Investing.com TR, Mynet Finans, Bigpara, Fonbul scrape test
  - tefas-crawler / yfinance Python lib Deno-uyumlu mu?
  - Provider seçilince: edge function yeni TEFAS dalı + frontend FUND tip ayrımı (US ETF vs TEFAS)

---

## Asset Type Genişletme

- [ ] **TR altın birimleri** `[M]` `[P1]` — gram / çeyrek / yarım / tam / Cumhuriyet / Reşat / Ata birimleri. Mevcut MVP sadece ons/USD; TR yatırımcısı için yetersiz.
  - `positions.unit` schema migration (sql-writer agent)
  - `GOLD_UNITS` sabit: birim × gram ağırlık × saflık tablosu (8 birim)
  - ManuelPosForm GOLD → Birim picker (8 chip); `avgCost` = TRY/adet (işçilik dahil)
  - Spot saf değer hesabı: USD/ons → USD/gram → TRY/gram (fx) → TRY/adet (×ağırlık×saflık)
  - Dashboard render: "5 çeyrek · ₺12,000/ad · Spot saf ₺55,000 · Premium %9"
  - Premium işçilik göstergesi (ödenen fiyat − spot saf fark)
  - USD/ons MVP geriye uyumlu kalır
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
- [ ] **Benchmark karşılaştırması** `[M]` `[P2]` — portföy vs SPY / QQQ / BIST100.
- [ ] **FMP rate limit guard** `[S]` `[P2]` — free tier sınırını test et + guard ekle.

## Analiz Tab Açık Alt Görevler

- [ ] **Sağlık Tablosu: filter chip + "Eksikleri Çek" CTA kapalı modda gizlensin** `[S]` `[P0]` — Şu an kapalıyken de görünüyor; sadece `healthOpen===true` iken render edilsin. Kapalı modda: başlık + 3 rozet + "Detay ▾".
- [ ] **Varlık Dağılımı kartına Maliyet/Piyasa toggle** `[S]` `[P1]` — Dashboard pie'daki `distMode` toggle Analiz'de yok; aynısını ekle. Dashboard pie kalkınca tek dağılım grafiği bu olur.
- [ ] **AnalysisTab FX yok warn-card** `[S]` `[P1]` — Dashboard'da var; Analiz'de sessizce 0 ekleniyor. FX rates null ise Analiz'de de turuncu uyarı göster.
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

- [ ] **AI parse autofill pill (ConfirmBox)** `[S]` `[P1]` — multi-line parse'ta fiyat fallback olduysa ConfirmBox satırında "⚠ tarih fallback" pill göster; şu an sessizce fallback'liyor.
- [x] ~~**ConfirmBox inline edit**~~ (2026-04-26) — Tek: Tarih/Adet/Fiyat/Broker/Komisyon inline input; Toplam reaktif. Çoklu: ✎ per-row → expand edit panel + ✓ Tamam.
- [ ] **Dashboard ↻ Güncelle başarısız ticker ayrıntısı** `[S]` `[P2]` — şu an "başarısız: AAPL" toast; Settings → Sistem Durumu'nda per-ticker hata sebebi (HTTP 403, bulunamadı vb.).

## Güvenlik & Süreç

- [ ] **Periyodik agent denetim turu (her 2-3 sprint)** `[S]` `[P1]` — 5 agent paralel health check: client-security-auditor, edge-reviewer, rls-auditor, ui-builder, product-owner. Her agent ≤200 kelime + en kritik 2-3 bulgu. İlk tur: 5+ sprint birikmişken.

## Ölçeklenme

- [ ] **price_cache write policy daraltma** `[S]` `[P2]` — şu an auth user'lar yazabiliyor; kullanıcı arttıkça service_role'a daralt, tüm write edge function üstünden.
- [ ] **Auto-fetch opt-in** `[S]` `[P2]` — şu an mount'ta otomatik; çok user'da rate limit'i zorlar.

## Sprint Audit Backlog (UI/a11y)

Gruplu öncelik sırasına göre — büyük sprint'lere entegre edilir:

### Grup 1 — UX Kalite (P0/P1, kolaydan zora)

- [ ] **Pozisyonları Yeniden Hesapla confirm guard** `[S]` `[P0]` — destructive (DELETE+INSERT cascade); `confirm_(...)` ile guard. (Sprint C kalıntısı)
- [ ] **HistoryTab tx satırından openDetail** `[S]` `[P0]` — şu an detaya gitme yolu sadece pozisyon tablosundan; HistoryTab satır click → TickerDetailTab.
- [x] ~~**Touch device tooltip (data-tip tap-to-show)**~~ (2026-04-26) — global touchstart listener; data-tip-visible CSS class; 2500ms auto-dismiss; button/a skip.
- [x] ~~**Loading state standardı (SkeletonRow/SkeletonCard)**~~ (2026-04-26) — SkeletonLine/SkeletonCard/SkeletonRows shimmer components. Dashboard ilk yük → 3 skeleton kart + 5 satır; meta/fund → SkeletonRows.
- [ ] **Form input error inline** `[S]` `[P1]` — invalid date/negative shares submit'e kadar feedback yok; `aria-invalid` + 11px error text.
- [ ] **Confirm modal backdrop click guard (danger)** `[S]` `[P1]` — `danger:true`'da backdrop click iptal saymasın; explicit "İptal" zorunlu.
- [ ] **EUR tablosu sort** `[S]` `[P1]` — USD/TRY tablolarında sort var, EUR statik; en azından Ticker alfabetik.

### Grup 2 — Bildirim/Feedback (P1)

- [ ] **AddTab CSV import skip count** `[S]` `[P1]` — geçersiz satırlar sessizce atlanıyor; `flash_("X işlem alındı, Y satır atlandı")`.
- [ ] **cur-seg dokunma hedefi mobile** `[S]` `[P1]` — ~30px; mobile media query 44px AA.
- [ ] **Period buton wrap dar ekran** `[S]` `[P1]` — `flex:1 + minWidth:40` 320px'de eziliyor.
- [ ] **↻ Güncelle progress mobile** `[S]` `[P1]` — `data-tip={pprog}` mobil'de hover yok; progress flash veya inline bar.
- [ ] **Flash position:fixed** `[S]` `[P1]` — scroll'da flash kaçırılıyor; `position:fixed; top:60px` sticky banner.
- [ ] **Sparkline empty state min-height** `[S]` `[P1]` — data <2 ise kart küçülüyor; min-height belirle.

### Grup 3 — a11y / Microcopy (P2)

- [ ] **HistoryTab accordion ticker DM Mono** `[S]` `[P2]` — sistem mono ile farklı render; `fontFamily:"DM Mono, monospace"` ekle.
- [ ] **Border contrast bump** `[S]` `[P2]` — `--border rgba(255,255,255,0.06)` bazı kartlarda kayboluyor; %10 veya inner shadow.
- [ ] **fundLoading spin icon** `[S]` `[P2]` — "..." yerine spin icon.
- [ ] **Login error/success → .flash class** `[S]` `[P2]` — inline style yerine class.
- [ ] **TickerDetailTab metaErr warn-card** `[S]` `[P2]` — küçük `.err` span yerine `.warn-card` tutarlılık.
- [ ] **Settings label semantik** `[S]` `[P2]` — `<label>` → `<div className="stitle">` standalone heading için.
- [ ] **Login autocomplete attributes** `[S]` `[P2]` — `email` + `current-password`.
- [ ] **input type="number" step="any"** `[S]` `[P2]` — ondalık adet (kripto) için.
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

P0 item'lar + en yüksek günlük kullanım etkisi, gerçek sırayla:

1. **Sağlık Tablosu kapalı modda filter/CTA gizle** `[S][P0]` — Şu an kapalıyken de filter chip + "Eksikleri Çek" görünüyor; kapalı modda sadece üst bar (başlık + rozetler + Detay ▾). Tek akşam.
2. **Pozisyonları Yeniden Hesapla confirm guard** `[S][P0]` — destructive işlem confirm'siz; kaza riski. Tek akşam.
3. **HistoryTab satırından openDetail** `[S][P0]` — En doğal navigasyon yolu eksik; tarihçe bakıyorken detaya gidemiyorsun.
4. **AI parse autofill ConfirmBox pill** `[S][P1]` — Çoklu parse'ta fiyat fallback olduysa kullanıcı bilgisiz; güven açığı. Tek akşam.
5. **Dashboard KPI 4→3 kart kompakt** `[S][P1]` — Maliyet ve Piyasa Değeri ayrı kart hiyerarşiyi zayıflatıyor; görsel odak için kompakt hibrit.
6. **Dashboard'dan Varlık Dağılımı pie kaldır + SVG ikonlar** `[M][P1]` — Analiz'de daha güçlü versiyon var; Dashboard Sparkline açılır + emoji→SVG sprint ile birleştirilebilir.
7. **Dark/Light tema + asset SVG ikonlar** `[M][P1]` — Can onayladı; light tema + emoji kaldırma aynı sprint. UI kalitesi ciddi atlayış.
8. **Touch tooltip (data-tip tap-to-show)** `[M][P1]` — Mobil kullanımda ~35 yer etkileniyor; KPI + fundamental satırları okunaksız.
