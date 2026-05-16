# Roadmap / Idea Backlog

Fikir havuzu — öncelik ve boyut etiketli, her sprint gözden geçirilir.

İlk toplama: **2026-04-24** | Son grooming: **2026-05-15** (Sprint 19 ✅ kapandı — 4 item tamamlandı: BES TickerDetailTab, analiz kartı verdict cümleleri, Temettü Faz 2 Dashboard kartı, Stale Fiyat badge. Sprint 20 başlamaya hazır.)

### Uzun Vadeli Platform Vizyonu

Detay için bkz. `portfoi-product-vision.md`. **Özet — 4 Katman:**
- **Katman 1 (Mevcut)** — Tracker: portföyü görünür kılar.
- **Katman 2 (+1 ay)** — Davranışsal Nudge'lar: tetikleyici→mesaj, karar sürtünmesi yaratır.
- **Katman 3 (+3 ay)** — Koç Sekmesi: kullanıcının yatırım felsefesini tanımlar, uyum skoru verir.
- **Katman 4 (+6 ay)** — AI Asistan: portföy bağlamıyla çalışan conversational yatırım koçu.

Platform yörüngesi: (1) Solo web app → (2) Multi-user SaaS → (3) Native mobil. **Her yeni geliştirme bu geçişi kolaylaştırmalı**: yeni state LS değil Supabase'e; her external API çağrısı edge function arkasına; `window`/`document` bağımlılığını izole et; yeni bileşenlerde `px` yerine `rem`/`dvh`.

---

## Tamamlananlar

> Sprint 1–12: ~60 özellik tamamlandı. Tam liste → [`_archive/roadmap-completed.md`](_archive/roadmap-completed.md)

---

## Bekleyenler / Blokerli

- [ ] **TEFAS WAF testi** `[S]` `[P1]` `Sprint-20 adayı` — Endpoint: `https://www.tefas.gov.tr/api/DB/BindHistoryInfo` (POST, `X-Requested-With` header). Bloker: F5 WAF cloud IP'leri engelliyor (Nisan 2026 — yeniden test edilmedi). Test adımı: plan Task 1'e bakınız. Çalışırsa → TEFAS entegrasyonu tam akış; WAF hâlâ engelliyorsa `fonbul.com` fallback devreye girer (plan Task 4). Plan: `docs/superpowers/plans/2026-05-13-tefas-integration.md`

---

## Güvenlik & Denetim Backlog

### Denetim Turu 4 Bulguları — Sprint 15/16

> P0 doğrulandı — temiz: `positions_allocation_read` policy DB'de YOK. Tasarım kararı: `get_allocation_only_positions` anon EXECUTE kasıtlı; sosyal discovery için yalnızca `{ticker,name,type,pct}` döner.

**P1 — Sprint-15:** ✅ Tamamlandı (2026-05-11)

- [x] **`fetch-fundamentals` auth eksikliği** `[S]` `[P1]` `Sprint-15` — ticker-list/dividend-calendar/etf-country/default modlarında JWT doğrulaması yok; anon kullanıcı ~11k ticker çekip Twelve Data/FMP kotası boşaltabilir. Düzeltme: tüm modlarda `Authorization` header'dan `getUser`; cron modları `CRON_SECRET` ile kalır. `→ fetch-fundamentals-edge-function.js`
- [x] **`fetch-prices` JWT try/catch dışında** `[S]` `[P1]` `Sprint-15` — `getUser()` try/catch bloğu dışında; exception → 500. try/catch içine al. `→ fetch-prices-edge-function.js:302-312`
- [x] **`refresh-price-cache` BIST type+USD currency edge case** `[S]` `[P1]` `Sprint-15` — BIST tipi ama `currency=USD` pozisyonlar Massive'e yönleniyor; type-first routing ekle: `asset_type=BIST` her zaman Yahoo'ya. `→ refresh-price-cache-edge-function.js:148-153`
- [x] **`Dönem getirisi ve dönem XIRR temettüyü içermiyor`** `[S]` `[P1]` `Sprint-15` — `computePeriod` yalnızca BUY/SELL; seçili dönem DIV işlemleri eksik. Düzeltme: `tr`'ye dönem temettülerini ekle; dönem XIRR'de DIV pozitif nakit akışı. `→ App.js:326-327,583,591-592; utils.js:304`
- [x] **`parse-transaction:136-138` ham çıktı sızıyor** `[S]` `[P2]` `Sprint-15` — Hata response'u `raw.slice(0,500)` ile Claude çıktısını açıyor. Hata mesajını generic yap; `raw` yalnızca sunucu loguna. `→ parse-transaction-edge-function.js:136-138`
- [x] **`fetch-fundamentals:820-821` `bist.raw?.annual` → `bist.annual`** `[S]` `[P2]` `Sprint-15` — `bist.raw?.annual` her zaman `undefined`; fund_cache'e BIST annual `null` yazılıyor. Önceki sprint'te zaten düzeltilmişti; audit sırasında teyit edildi. `→ fetch-fundamentals-edge-function.js:820-821`
- [x] **`fetch-fundamentals` dividend-calendar ticker validation yok** `[S]` `[P2]` `Sprint-15` — `dividend-calendar` modunda `ticker` doğrulanmıyor; injection riski. Allowlist regex ekle. `→ fetch-fundamentals-edge-function.js:703-728`

**P2 — Sprint-16:**

- [x] **`get_allocation_only_positions` çoklu-para birimi sorunu** `[M]` `[P1]` `Sprint-16` ✅ — Migration 014: price_cache FX oranı ile USD'ye normalize; avg_cost fallback yok; anon GRANT kaldırıldı.
- [ ] **"Tam Detay" portföy paylaşımı: UI ≠ veri katmanı** `[S]` `[P1]` — Settings "Tam Detay" → "Adet ve maliyet bilgileri görünür" diyor; public render her zaman yalnızca ticker/isim/yüzde bar gösteriyor. Social Faz 2 ile birlikte ele alınacak. `→ App.js:944,960,982,1082`
- [x] **CSP/SRI: `html2canvas` integrity hash eksik** `[S]` `[P2]` `Sprint-16` ✅ — `index.html` sha512 integrity attribute eklendi.
- [x] **`watchlist_own` policy `FOR ALL` — UPDATE riski** `[S]` `[P2]` `Sprint-16` ✅ — Migration 015: FOR INSERT/SELECT/DELETE ayrı policy; UPDATE DB seviyesinde engelli.
- [x] **`fetch-prices` historical upsert hatası sessizce yutuluyor** `[S]` `[P2]` `Sprint-16` ✅ — PostgREST + network hataları console.error ile loglanıyor.
- [ ] **LS key'leri user-scope değil** `[S]` `[P2]` `Sprint-16` — `il_prc`, `il_hist`, `il_hide` vb. user-specific prefix taşımıyor. Kısa vade: signOut'ta tüm `il_` key'leri temizle. Uzun vade: key'lere `user.id` prefix ekle.
- [ ] **`price_snapshots` policy `TO anon, authenticated` eksik** `[S]` `[P3]` — Role kısıtlaması belirtilmemiş; davranış aynı ama dokümantasyon netleşmeli. (Sprint-16'da yapılmadı; düşük aciliyet — P3'e indirildi 2026-05-15.)

---

## Asset Type Genişletme

- [ ] **TEFAS Yatırım Fonu entegrasyonu** `[L]` `[P1]` — Yeni `TEFAS` asset type (`#84CC16` lime, TRY cinsinden). Günlük NAV fiyatı `tefas.gov.tr` API'sinden; WAF engeli varsa `fonbul.com` fallback. ~1000 fonluk `tefas_funds` Supabase tablosu (katalog); SearchTab'da kod + isim araması. Dashboard "TEFAS Fonları" bloğu (₺). AnalysisTab: Varlık Dağılımı lime dilimi, Bölge Dağılımı → Türkiye. 6h cron refresh. Tasarım + plan hazır; önce WAF testi gerekli. Spec: `docs/superpowers/specs/2026-05-13-tefas-integration-design.md` · Plan: `docs/superpowers/plans/2026-05-13-tefas-integration.md`
  - [ ] (1) WAF testi + `fetch-prices` `isTefas` routing `[S]`
  - [ ] (2) `tefas_funds` SQL migration + RLS `[S]`
  - [ ] (3) Frontend sabitler: TYPE_COLORS, TL, BLOCK_TYPES, ASSET_ICONS `[S]`
  - [ ] (4) `fetch-fundamentals mode:"tefas-catalog"` + katalog yükleme `[S]`
  - [ ] (5) AddTab TEFAS Fonu picker girişi `[S]`
  - [ ] (6) SearchTab `tefas_funds` birleşik arama + lime badge `[S]`
  - [ ] (7) AnalysisTab REGION_OF, priceCurOf, Fundamentals hariç `[S]`
  - [ ] (8) Settings katalogu yenile butonu `[S]`
  - [ ] (9) `refresh-price-cache` cron'a TEFAS ekleme `[S]`
- [x] ~~**BES Devlet Katkısı (DK) entegrasyonu**~~ `[M]` `[P0]` `Sprint-18` ✅ (2026-05-13) — 4 form alanı (kişisel yatırılan, kişisel portföy güncel, DK anaparası, DK portföy güncel); `positions` tablosuna `dk_principal` + `dk_current` kolonları eklendi; `rebuild_positions_atomic` RPC güncellendi; cost basis = yalnızca kişisel yatırılan, DK+getiri tamamı kazanç; hint kaldırıldı. Migration 018. `→ utils.js, App.js, ManuelPosForm.js`
- [x] ~~**AI parse temettü desteği (DIV way)**~~ `[S]` `[P1]` (2026-05-13) — `parse-transaction` sözleşmesi `BUY|SELL|DIV` oldu; Türkçe temettü ifadesi örnekleri eklendi; `saveTx` way allowlist doğrulaması eklendi. `→ parse-transaction-edge-function.js; AddTab.js`
- [ ] **Sektör-aware fundamental eşikler** `[M]` `[P1]` — tech P/E ≤30, utility ≤15 vs.; `sic_description` veya FMP `sector` ile profil seç. TR enflasyonu CAGR eşiklerini de etkiliyor.
- [ ] **TR altın işçilik premium göstergesi** `[M]` `[P2]` — Reşat/Ata birimi ekleme; Dashboard "5 çeyrek · ₺12,000/ad · Spot saf ₺55,000 · Premium %9" render; ödenen fiyat − spot saf fark hesabı.
- [ ] **BIST P/S metriği** `[S]` `[P2]` — borsa-mcp `meta.market_cap` / `latestRevenue` ile derive; frontend veya edge function 2. call.
- [ ] **BIST bankalar fundamentals** `[L]` `[P2]` — UFRS grubu Roman numeral itemCode mapping; `ISY_KNOWN_BANKS` early-exit kaldır.
- [ ] **FX/GOLD ham ticker normalize** `[S]` `[P2]` — `asset_type:"FX"` prefix'siz `USDTRY` gelince 404; `C:` autoprefix + format guard.
- [x] **BES (Bireysel Emeklilik) temel giriş** `[S]` `[P1]` `Hotfix-2026-05-11` ✅ — ManuelPosForm BES için pay adedi/NAV kaldırıldı; "Yatırılan Toplam Tutar" + "Güncel Değer" alanları eklendi. `shares=1, avg_cost=yatırılan`; güncel değer `fetch-prices mode:"set-manual-price"` → `price_cache`. Devlet katkısı farklı hesap kodu ile ayrı pozisyon.
- [x] **BES TickerDetailTab breakdown kartı** `[S]` `[P1]` `Sprint-19` `2026-05-15` — Tamamlandı: 7-satır iki bölümlü kart (Kişisel Portföy + tinted Devlet Katkısı + Toplam Değer footer). 6 commit `45d98fc..50b92f4`. NULL guard ile eski BES pozisyonları "⚠ DK bilgisi güncellenmeli" nudge gösteriyor. ↻ Meta butonu BES için gizlendi; meta/divCal edge fetch'leri skiplendi. Spec: `docs/superpowers/specs/2026-05-15-bes-tickerdetail-breakdown-design.md`, plan: `docs/superpowers/plans/2026-05-15-bes-tickerdetail-breakdown.md`.
- [ ] **BES güncel değer aylık güncelleme** `[S]` `[P2]` — Pozisyon satırında "Değer Güncelle" butonu; `set-manual-price` endpoint hazır, yalnızca UI gerekli.
- [x] **Nakit & Vadeli Mevduat (CASH/DEPOSIT)** `[M]` `[P2]` `Hotfix-2026-05-11` ✅ — CASH (banka bakiyesi) + DEPOSIT (vadeli mevduat) first-class asset type eklendi. Faiz oranı, vade tarihi, basit faiz hesabı (cap at maturity). DB: `interest_rate`, `maturity_date` kolonları + `rebuild_positions_atomic` RPC. Dashboard mixed-currency blokları; vade tarihi badge (kırmızı/sarı/yeşil); HHI konsantrasyon riskinden hariç. 11 commit, migration 016–017.
- [x] **DEPOSIT/CASH Dashboard blok değeri ₺ göster** `[S]` `[P1]` `Sprint-18` ✅ (2026-05-13) — Dashboard'da Vadeli Mevduat bloğu değer toplamı `$30,127` gösteriyor; DEPOSIT ve CASH pozisyonlar TRY cinsinden olduğu için blok toplamı ve bireysel pozisyon satırı `₺` sembolüyle gösterilmeli. Display currency toggle ($/ ₺) değişince döviz bazında çevrilmeli, ama default `$` seçiliyken bile bu blok ₺ olarak kalmalı ya da açıkça ₺ değeri göstermeli.
- [x] **DEPOSIT TickerDetailTab özel görünümü** `[S]` `[P1]` `Sprint-18` ✅ (2026-05-13) — DEPOSIT pozisyonlarında "Adet/Ort. Maliyet/Piyasa Değeri/P&L/Şirket Bilgisi" yerine mevduata özgü bilgi kartı göster. Şema değişikliği yok — `maturity_date` varlığına göre iki varyant:
  - **Vadeli mevduat** (`maturity_date` dolu): **Anapara** (`shares`), **Faiz Oranı** (`interest_rate` → `%43.00`), **Vade Tarihi** (`maturity_date` + kalan gün badge), **Hesaplanan Brüt Faiz** (`computeDepositGrossInterest()`), **Stopaj (%17.5)** (brüt × 0.175), **Net Faiz**, **Güncel Değer** (anapara + net faiz).
  - **Esnek hesap / Serbest Plus** (`maturity_date` null): Vade Tarihi satırı yerine **Tür: Serbest/Esnek** badge; **Günlük Net Kazanç** (yıllık oran / 365 × anapara × 0.825); diğer satırlar aynı.
  - Her iki varyant: işlem geçmişinde "1364699.53 adet ₺1.00" → "₺1,364,700 yatırılan" render. Generik hisse metrikler (`type==="DEPOSIT"` dalında) tamamen gizlenir.
- [ ] **Eurobond / Tahvil takibi** `[M]` `[P2]` — `asset_type:"BOND"`; kupon tarihleri, vade, YTM; manuel giriş. Fiyat: Massive `AGG`/`TLT` proxy veya Hazine websitesi.
- [ ] **Kripto staking / getiri takibi** `[S]` `[P2]` — Staking kazancını DIV gibi takip; mevcut `transactions.way:"DIV"` altyapısı yeniden kullanılır.
- [ ] **DCA Planı (Otomatik Alım Hatırlatıcısı)** `[M]` `[P3]` — ticker + dönem + tutar; pg_cron email hatırlatma. Yeni `dca_plans` tablosu + Resend API.

---

## Temettü Takvimi

- [ ] **Temettü Takvimi** `[M]` `[P2]` — FMP `/stable/stock/dividends`; tutulan ticker'lar için sonraki temettü tarihi; HistoryTab "Yaklaşan Temettüler" collapsible veya TickerDetailTab "Sonraki Temettü" satırı. `fetch-fundamentals`'a yeni `mode:"dividend-calendar"` dalı.
  - [x] ~~(a) `mode:"dividend-calendar"` dalı; `dividends` array → ex-date, amount~~ `[S]` (2026-05-13)
  - [x] ~~(b) TickerDetailTab "Sonraki Temettü" satırı (held ise)~~ `[S]` (2026-05-13)
  - [x] ~~(c) Dashboard "Bu Ay Beklenen Temettüler" `<details>` kartı~~ `[S]` `Sprint-19` `2026-05-15` — Faz 1 LS cache'i (`il_divcal_${ticker}`, 24h TTL) `src/utils.js`'e taşındı. App.js'e `divCalByTicker` state + pos değişiminde LS-load + eksik US_STOCK ticker'ları için `dividend-calendar` batch fetch (20/batch). KPI ile Period selector arasında `<details>` kart; ex_date ∈ [today, today+30] filtresi; empty state'te kart tamamen gizli. HistoryTab tablosu (3c) Sprint 20+ feedback'e bırakıldı.
- [ ] **Kazanç Takvimi (Earnings Calendar)** `[S]` `[P3]` — FMP `/stable/earning-calendar`; TickerDetailTab meta'ya "Sonraki Bilanço: 28 Nisan" satırı.

---

## Görselleştirme

- [ ] **Broker Dağılımı Pie Chart** `[S]` `[P2]` — AnalysisTab Varlık/Bölge/Sektör yanına "Aracı Kurum Dağılımı" collapsible; `positions.broker` alanından, mevcut pie altyapısı.
- [ ] **Sparkline interactivity** `[S]` `[P2]` — hover'da değer/tarih tooltip; SVG `<circle>` cursor + dikey kılavuz çizgi.
- [ ] **Pie chart segment selection** `[M]` `[P2]` — slice hover/select; legend tıklanabilir; seçili slice 2px outline + ortada toplam label.
- [ ] **AnalysisTab: Dağılım kartları pie → stacked bar** `[M]` `[P2]` — Varlık/Bölge/Sektör kartlarındaki pie SVG → tek yatay stacked horizontal bar; legend/liste/yüzdeler collapsible kalır. `buildStackedBar` render helper; önce `buildSlicesPath` kullanım yerlerini denetle.
- [ ] **Dashboard: Varlık türü filtre bar'ı sticky** `[S]` `[P2]` — `.fbar` chip bar `position:sticky; top:<topbar-height>px`; topbar yüksekliği `--topbar-h` CSS custom property ile yönetilmeli.
- [ ] **Fundamental Ratio Trendi (5Y Grafik)** `[M]` `[P2]` — TickerDetailTab'da P/E, P/S, ROE için yıllık trend SVG; FMP `/stable/ratios` annual array zaten mevcut. `TrendMiniChart` pattern yeniden kullanılır.
- [ ] **Portföy Değer Geçmişi (Tarihsel MV)** `[M]` `[P2]` — `portfolio_snapshots` tablosu; günlük kapanışta cron snapshot; Dashboard Sparkline gerçek geçmişten beslenir. **Uzun vade — Vite geçişinden önce değil.**

---

## Navigasyon & Sayfalar

- [ ] **Her yatırım türü için ayrı sayfa/tab** `[L]` `[P2]` — şu an Dashboard block ile yönetiliyor; ayrı sekme ihtiyacı olursa.

---

## Fundamental & Analiz

- [ ] **EDGAR P/E + P/S** `[M]` `[P2]` — `CommonStockSharesOutstanding` × current price = market cap; P/E + P/S EDGAR modunda da dolu gelir.
- [ ] **Kullanıcı tanımlı fundamental eşikler** `[M]` `[P2]` — 8 metrik için "iyi/orta" eşikler Settings'ten; `il_fund_thr` LS + `DEFAULT_FUND_THRESHOLDS` merge. Plan: `/Users/canmerter/.claude/plans/kullan-c-n-n-kendi-e-iklerini-girece-i-compressed-coral.md`
- [ ] **FMP rate limit guard** `[S]` `[P2]` — free tier sınırını test et + guard ekle.
- [ ] **DCF Hızlı Değerleme** `[M]` `[P3]` — FMP `/stable/discounted-cash-flow`; "Bugünkü adil değer: $145, şu an $132 — %9 ucuz". UI'da "tahmini" etiketi zorunlu.
- [ ] **Snowflake Skor (Çok Boyutlu)** `[L]` `[P3]` — Simply Wall St benzeri 5-boyut skor (Değer/Büyüme/Kalite/Borç/Temettü); `FUND_THRESHOLDS` üstünden; 5-dilimli radar SVG. Önce diğer fundamentals tamamlanmalı.
- [ ] **Fundamental checklist gruplarını Investment-Guide'a hizala** `[S]` `[P2]` — `FUND_GROUPS` 7 başlığı → Investment-Guide.md Part 5'in 5 başlığına eşitlenir: (a) `fcfMargin` "Cash Flow Strength" grubuna taşı; (b) Büyüme+Kâr Marjları+Gider Disiplini → "Income Quality". Eşikler aynen kalır; sadece grup yapısı değişir.

---

## Analiz Tab — Yeni Özellikler

### Portföy Analizi

- [ ] **"Dip mi Tepeden mi Girdim?" Giriş Kalitesi** `[S]` `[P2]` — avg_cost'u 52W aralığına yerleştiren yatay progress bar; "İyi giriş / Tepeden giriş" etiketi. 52W verisi fundamentals cache'te mevcut.
- [ ] **Portföy Çeşitlendirme Skoru** `[M]` `[P2]` — Bölge × Sektör × Asset Type matrisinden 1-10 skor; tek bölge/sektör yoğunlaşmasına göre uyarı cümlesi. Tamamen frontend hesabı.
- [ ] **Yeniden Dengeleme Önerisi (Rebalancing)** `[M]` `[P2]` — Kullanıcı hedef dağılım girer (US %50, BIST %30 vb.); mevcut farkı göster. `profiles` tablosuna JSON kolonu gerekir.

### Risk

- [ ] **Likidite Analizi** `[M]` `[P2]` — `marketCap` bazlı "kolayca satılabilir / az likit" sınıflandırması. Fundamentals cache'ten; ek fetch yok.
- [ ] **Piyasa Düşüşü Dayanıklılık Skoru** `[M]` `[P2]` — Borç/Özk < 0.5, FCF marjı >10%, op marjı >15% pozisyonların ağırlıklı payı → 1-10 puan. Fundamentals cache; ek fetch yok.
  - [ ] (a) `resilienceScore(fund)` fonksiyonu: 3 metrik → 0-6 puan → 1-10 scale `[S]`
  - [ ] (b) MV-weighted portföy skoru hesabı `[S]`
  - [ ] (c) AnalysisTab "Piyasa Dayanıklılığı" kartı — skor + bar + "Eksikleri Çek" CTA `[S]`
- [ ] **Portföy Beta Tahmini** `[M]` `[P2]` — `price_cache.p_w1/m1` hareketleri benchmark ile karşılaştırma; ağırlıklı portföy betası. `[Benchmark karşılaştırması]` tamamlandıktan sonra kolaylaşır.

### Performans

- [ ] **Satılan Pozisyonların Realized P&L Özeti** `[M]` `[P2]` — Kapatılmış pozisyonların yıl bazlı tablosu; "2024: +$3,200". `transactions` BUY+SELL eşleştirmesi.
- [ ] **DCA Etkinliği** `[M]` `[P2]` — "THYAO için 5 alım — tek sefere göre ortalama %8 daha iyi giriş". `transactions` BUY kayıtları.
- [ ] **Pozisyon Yıllık Getiri (CAGR) Tablosu** — Veri kaynağı netleştirilmeli; transactions BUY kaydı okunamıyordu, kaldırılmıştı.
  - [ ] (a) `firstBuyDate` hesabı: en erken BUY tarihi + split-adjusted avg_cost `[S]`
  - [ ] (b) CAGR formülü; fiyat yoksa gri "fiyat bekleniyor" `[S]`
  - [ ] (c) AnalysisTab "Pozisyon Getirileri (CAGR)" kartı — azalan sıra; click→openDetail `[S]`
- [ ] **Giriş Zamanlaması Örüntüsü (Ay Bazlı)** `[M]` `[P3]` — BUY işlemlerini ay gruplarına göre say + o giriş sonrası 3A/6A ortalama getiri. `transactions` + `price_cache`.

### Karşılaştırma

- [ ] **Peer Sektör Ortalamasıyla Karşılaştırma** `[L]` `[P3]` — FMP sektör ortalaması P/E, ROE; yeni endpoint (`/stable/sector-pe-snapshot`) gerekir.
- [ ] **Ağırlıklı Ortalama Portföy P/E** `[S]` `[P2]` — MV-ağırlıklı P/E; "Portföyünüzün F/K'sı 18.4 — S&P 500 ortalamasının altında". Fundamentals cache zaten mevcut; yeni fetch yok.
  - [ ] (a) AnalysisTab Portföy Sağlık'a KPI olarak ekle; atlanma sayısı not `[S]`
  - [ ] (b) S&P 500 karşılaştırma cümlesi — hardcoded ~22 referans `[S]`

### Vergi & Muhasebe

- [ ] **Vergi Yılı Özeti** `[L]` `[P2]` — Seçilen yılda realized kazanç/kayıp; US short/long-term ayrımı; TR BIST 2 yıl muafiyet; tahmini vergi. Tarihi FX için Frankfurter.
- [ ] **Ortalama Elde Tutma Süresi** `[S]` `[P2]` — "Portföy ortalaması: 8.3 ay". `transactions` BUY tarihleri; tamamen frontend.
- [ ] **FIFO / LIFO Maliyet Muhasebesi** `[L]` `[P3]` — Vergi raporlaması için lot bazlı takip. Büyük mimari değişiklik.
- [ ] **Yıllık Portföy Raporu (PDF)** `[L]` `[P3]` — Başlangıç/bitiş portföy değeri, kazanç/kayıp, temettü, komisyon, en iyi/en kötü 3 işlem. `window.print()` + print CSS.

### Davranışsal Analiz

- [ ] **Art Arda Kazanma/Kaybetme Serisi (Streak)** `[S]` `[P3]` — Kapatılmış işlemler kârlı/zararlı zinciri; tamamen `transactions` BUY+SELL frontend hesabı.
- [ ] **Alım Fiyatı Bölgesi Analizi (52W Konumu)** `[S]` `[P2]` — avg_cost 52W low/high aralığı; "İyi giriş (%28)" veya "Tepeden giriş (%89)". Fundamentals cache'te `high_52w/low_52w` mevcut; yeni fetch yok.
- [ ] **Kayıp Realizasyonu Analizi (Tax Loss Harvesting)** `[S]` `[P3]` — Zarardaki pozisyonlar + elde tutma süresi; "XYZ 2 yıldır zararda — vergi avantajı fırsatı". Frontend hesabı.

### Analiz Tab Açık Alt Görevler

- [x] **Dashboard: Kripto getirisi gösterilmiyor** `[S]` `[P1]` ✅ — Düzeltildi.

- [ ] **Başabaş tablosu ve potansiyel kayıp bölümleri — Detay katmanına taşı** `[S]` `[P3]` — PO kararı (2026-05-15): Kaldırılmıyor; value-investing için başabaş noktası kritik. "AnalysisTab Özet/Detay iki katman" item'ı tamamlandığında otomatik Detay katmanına geçer. Bağımlılık: `AnalysisTab Özet / Detay iki katmana bölünsün`.

- [ ] **Aylık özet yerleşimi — sayfada daha aşağı** `[S]` `[P3]` — PO kararı (2026-05-15): (b) seçeneği — ekranda daha aşağıya kaydır (Dağılım kartlarının altı). Hamburger değil; görünürlük kaybolmamalı. `ui-builder` düzen güncelleme.

- [ ] **Win/Loss time horizon seçimi** `[S]` `[P2]` — şu an bugünkü fiyat; 1A/3A/6A/1Y window chip.
- [ ] **Win/Loss sold-out ticker live price** `[S]` `[P2]` — cache'te yoksa "noPrice" sayım dışı; live fetch seçeneği.
- [ ] **Analiz bölge ETF underlying** `[M]` `[P2]` — MCHI=Çin gibi; şu an FUND→US default.
- [ ] **AnalysisTab Komisyon KPI label** `[S]` `[P2]` — `{displayCur}` yerine `Toplam ({displayCur})`.

---

## Otomasyon & Raporlama

- [ ] **Haftalık Portföy Özeti E-postası** `[M]` `[P2]` — Her Pazar pg_cron: haftanın getirisi, en iyi/en kötü 3 ticker. Resend API. `portfolio_weekly_snapshot` tablosu (user_id, week_start, mv_usd, mv_try, top_gainer, top_loser). Bağımlılık: Resend API key.
- [x] **Stale Fiyat Uyarısı (price_cache yaşı)** `[S]` `[P2]` `Sprint-19` `2026-05-15` — `isPriceStale(updatedAtISO, 24)` `src/utils.js`'te; App.js `prcUpdatedAt` state'i `price_cache.updated_at`'i map'liyor; `.badge.stale` Dashboard desktop+mobile pos-row'da ve WatchlistTab ticker hücresinde; hover'da `data-tip` ile "Fiyat X sa önce güncellendi". CASH/DEPOSIT/BES synthetic tipler `prcUpdatedAt` map'inde yok → badge görünmez.
- [ ] **Otomatik Split Tespiti** `[L]` `[P3]` — FMP adjusted fiyatla avg_cost karşılaştırma; >50% sapmada "split olmuş olabilir" uyarısı.

---

## Akıllı Öneriler & Nudge Sistemi

- [ ] **Katman 2 — Piyasa düşüş nudge'ı** `[S]` `[P2]` — `price_cache.p_d1` portföy ağırlıklı günlük ≤ -%5 ise "Portföyün bugün -%X düştü. Tezin hâlâ geçerli mi?" nudge. Yeni fetch yok.
- [ ] **Katman 2 — Yeni pozisyon ekleme checklist sorusu** `[S]` `[P2]` — AddTab'da asset tipi seçiminden önce "Yatırım tezini belirledin mi? (Investment Guide 20-kriter)" nudge/modal. Yeni API yok.
- [ ] **Katman 2 — Popüler hisse FOMO uyarısı** `[M]` `[P2]` — SearchTab'da `price_cache.p_m1 > 30%` ise "Bu hisse son 30 günde çok konuşuluyor. FOMO mu, tez mi?" banner. Basit versiyon: tamamen frontend, yeni fetch yok.
- [ ] **Katman 2 — Büyük kazanç tez kontrolü nudge** `[S]` `[P2]` — Pozisyon son 1 ayda >%25 artmışsa "TICKER %X büyüdü. Orijinal tezin hâlâ geçerli mi?" nudge; aynı ticker 30 gün susturulur.
- [ ] **Haftalık AI Portföy Özeti (Push/Email Nudge)** `[M]` `[P3]` — Pazar sabahı pg_cron + Haiku; 4-5 cümle Türkçe özet; Resend e-posta. Bağımlılık: `portfolio_snapshots` tablosu + Resend API key. `→ "Haftalık Portföy Özeti E-postası" item'ı ile birleştirilebilir.`

---

## Koç Sekmesi (Katman 3)

- [ ] **Yatırımcı felsefesi onboarding formu** `[M]` `[P2]` — Settings'den tetiklenebilen 5 soruluk onboarding (risk profili, zaman ufku, hedef getiri, kırmızı çizgiler, felsefe tercihi). `profiles.philosophy` JSONB kolonu.
  - [ ] (a) `profiles.philosophy` JSONB kolonu migration + RLS `[S]`
  - [ ] (b) Settings'de "Yatırım Felsefem" bölümü — 5 soru formu UI `[M]`
- [ ] **Haftalık felsefe uyum skoru** `[M]` `[P3]` — Portföy durumu `philosophy` ile karşılaştırma; "Bu hafta felsefen ile %78 uyum" Dashboard widget. Tamamen frontend.
  - [ ] (a) `computePhilosophyScore(philosophy, positions, transactions)` pure fonksiyon `[S]`
  - [ ] (b) Dashboard "Felsefe Uyumu" KPI veya nudge + Settings'de haftalık geçmiş `[S]`
- [ ] **Prensip ihlali uyarıları** `[S]` `[P2]` — Kırmızı çizgiler ihlal edilince nudge: "Kripto %12'ye ulaştı — kırmızı çizgin %10'du." `computeNudges()` içinde. Onboarding tamamlanmadan tetiklenmez.
- [ ] **Aylık davranış raporu** `[M]` `[P3]` — "Bu ay 2 kez FOMO nudge'ını kapattın · 1 prensip ihlali · Felsefen ile %82 uyumlu." `il_nudge_dismissed` LS key'inden türet.

---

## AI Asistan (Katman 4)

- [ ] **Investment Guide → Claude system prompt dönüşümü** `[S]` `[P2]` — `Investment-Guide.md` içeriğini tüm AI etkileşimlerinin felsefesi olarak `SYSTEM_PROMPT` constant'a dönüştür; `parse-transaction` zaten bu pattern'i kullanıyor.
- [ ] **Portföy bağlamı entegrasyonu (AI için)** `[M]` `[P2]` — AI prompt'a `philosophy` + `positions` özeti + `fund_cache` kritik metrikleri ekle. `buildAiContext()` helper `src/utils.js`'e.
- [ ] **AI Yatırım Koçu — Sohbet Arayüzü** `[L]` `[P3]` — Yeni "Koç" tab; Claude Sonnet API; portföy bağlamıyla yanıt. Günde 5 mesaj rate limit. Önkoşul: Portföy bağlamı entegrasyonu.
  - [ ] (a) `ai-coach` edge function — Sonnet + sistem prompt `[L]`
  - [ ] (b) Koç sekmesi UI — chat input + yanıt balonu `[M]`
  - [ ] (c) Rate limit + günlük kota `[S]`
- [ ] **FIRE / Finansal Özgürlük Hesaplayıcı (AI destekli)** `[M]` `[P2]` — Hedef büyüklük + aylık tasarruf; mevcut portföy + XIRR → "hedefe X yıl kaldı". AI koç bağlamına alır.

---

## İçerik

- [ ] **Haber entegrasyonu** `[L]` `[P2]` — Ticker bazlı; NewsAPI, Polygon news veya borsa-mcp `get_news` (BIST için test et).
- [ ] **AI Portföy Yorumu** `[M]` `[P2]` — "Portföyümü analiz et" → Haiku'ya positions+fundamentals özeti → 3-5 cümle Türkçe yorum. Günde 3 çağrı/kullanıcı limit.
- [ ] **Borsa Takvimi (Piyasa Tatilleri)** `[S]` `[P3]` — NYSE + BIST tatil günleri; "Bugün piyasa kapalı" banner. Statik liste; Supabase gerektirmez.

---

## Öğrenme & Eğitim

- [ ] **Bağlamsal Mikro Öğrenme Katmanı** `[M]` `[P1]` — F/K, XIRR, çeşitlendirme gibi kavramlar ekran içinde kısa inline açıklanır (tooltip yerine inline cümle). Dashboard, AnalysisTab, TickerDetailTab'da öncelikli.
- [ ] **Investment Basics modülü** `[L]` `[P2]` — Uygulama içi finansal okuryazarlık; bileşik faiz, çeşitlendirme, risk-return, DCA, P/E. Can'ın kararıyla ileriye ertelendi.

---

## Kişisel & Eğitim

- [ ] **Kişisel Yatırım Notu** `[M]` `[P2]` — Ticker bazında "neden aldım / çıkış stratejim / öğrenilen ders" serbest metin. Yeni `notes` Supabase tablosu (user_id, ticker nullable, date, content).
- [ ] **Hedef Fiyat & Değerleme Notu** `[M]` `[P2]` — Kullanıcı tanımlı hedef fiyat + kısa not; "THYAO hedef ₺380 — %17 uzakta". Yeni `target_prices` Supabase tablosu.
- [ ] **FIRE / Hedef Portföy Büyüklüğü Takibi** `[M]` `[P2]` — Hedef büyüklük girer; XIRR projeksiyonu + progress bar. `profiles.goal_amount` + `goal_currency` kolonu.
- [ ] **Yaklaşan Etkinlikler Merkezi** `[M]` `[P2]` — Önümüzdeki 30/90 günde temettü, bilanço, DCA hatırlatıcısı ve hedef fiyat alarmı tek kronolojik listede. Veri kaynakları: Temettü Takvimi, Kazanç Takvimi, DCA Planı, Hedef Fiyat Bildirimi.
- [ ] **Portföy Zaman Çizelgesi (Timeline)** `[M]` `[P3]` — Tüm BUY/SELL kronolojik vertical timeline. `transactions` tablosu yeterli.

---

## Sosyal & Kişiselleştirme

- [ ] **Social Portfolios Faz 2 — Profil & Public portföyler** `[M]` `[P2]` — `UserProfileModal`; `portfolios.is_public` toggle; public portföy URL/slug. Faz 1 altyapısı tamamlandı.
  - [ ] (a) Settings'e `is_public` toggle — basit switch UI `[S]`
  - [ ] (b) RLS okuma politikası — `is_public=true` portföyler için; rls-auditor sign-off zorunlu `[S]`
  - [ ] (c) `UserProfileModal` — avatar emoji picker + bio + public portföy listesi `[M]`
  - [ ] (d) Public portföy read-only view — "Bu portföy salt okunur" banner `[S]`
- [ ] **Social Portfolios Faz 3 — Takip sistemi** `[M]` `[P2]` — `follows` tablosu; follow/unfollow UI; `portfolio_activities` feed. Faz 2 sonrası.
- [ ] **Social Portfolios Faz 4 — Sosyal Feed tab** `[L]` `[P2]` — Yeni "Portföyler" sekmesi; public portföyler listesi + aktivite feed. Faz 3 sonrası.
- [ ] **Social Portfolios Faz 5 — Grup Portföyleri** `[L]` `[P3]` — Eşlerle/aile ile ortak portföy takibi; `groups` + `group_members` tabloları; davet kodu akışı; konsolide dashboard. Faz 2+3 sonrası.
- [ ] **Yatırımcı risk profili** `[M]` `[P2]` — anket → muhafazakar / dengeli / agresif. Koç Sekmesi "Yatırımcı felsefesi onboarding" item'ı ile birleştirilebilir.
- [ ] **Portföy Performans Karşılaştırma (Anonim Leaderboard)** `[L]` `[P3]` — Opt-in; anonim getiri sıralaması; Faz 3 tamamlanınca anlamlı.

---

## Gamification & Başarı Sistemi

- [ ] **Yatırımcı Rozetleri (Başarı Sistemi)** `[M]` `[P3]` — Eşiklere ulaşınca rozet kazanılır: "İlk İşlem", "Çeşitlenmiş" (5+ asset_type), "Temettü Toplayıcı" (10+ DIV), "Uzun Vadeli" (1+ pozisyon 2Y+), "Değer Yatırımcısı" (P/E <15 olan 3+ pozisyon), "Disiplinli" (12 ay üst üste BUY). `profiles.badges` JSONB veya LS.

---

## Hesap Yönetimi

- [ ] **Canlı sistem için Ayarlar sekmesi revizyonu** `[M]` `[P2]` `[PO+UX]` `[Canlı Sistem Önkoşulu]` — Mevcut Ayarlar (hamburger menü) geliştirici/bakım odaklı; canlıya geçince kullanıcıya ne gösterilmeli netleştirilmeli. Hangi bölümler kalır, hangisi kaldırılır, yeni ne eklenmeli — PO içerik kararı, UX düzen revizyonu yapacak.

- [ ] **Support & Feature Request iletişim altyapısı** `[M]` `[P2]` `[Canlı Sistem Önkoşulu]` — Canlı sisteme geçilmeden önce kullanıcıların sorun bildirebileceği ve özellik talep edebileceği bir iletişim kanalı kurulmalı. Seçenekler: (a) uygulama içi form → e-posta/Supabase tablosu, (b) Crisp/Intercom gibi hazır widget, (c) GitHub Issues linki. Kanal seçimi ve önceliklendirme PO ile yapılacak.

- [ ] **Hesap ekranı genişletme** `[M]` `[P2]` — şifre değiştirme, email değiştirme (verifikasyonlu), hesap silme (cascade delete), avatar. Mevcut username/display_name ekranı zaten var.

---

## Monetizasyon (Referans Plan)

> Şu an geliştirme önceliği değil. **Kural**: Free plan kullanıcıyı tamamen kaybetmeyecek kadar değerli; premium kullanıcıyı elde tutacak kadar fark yaratmalı.

**Free:** Tek portföy, manuel giriş + AI parse (20/gün), Dashboard/HistoryTab/AnalysisTab temel kartlar, BIST+US+Kripto+Altın, 21-metrik fundamental, temettü takibi.

**Premium:**
- [ ] **Çoklu portföy yönetimi** `[M]` `[P3]` — DB altyapısı hazır; UI limit kaldırılır.
- [ ] **Gelişmiş AI parse limiti** `[S]` `[P3]` — Free 20/gün → Premium 100/gün.
- [ ] **Vergi Yılı Özeti raporu** `[M]` `[P3]` — PDF export + FIFO lot bazlı; Free'de sadece özet.
- [ ] **Gerçek zamanlı fiyat (intraday)** `[L]` `[P3]` — Massive API paid tier gerekir.
- [ ] **Özel Fundamental Eşikler** `[S]` `[P3]` — Free'de sabit; premium'da kendi P/E <X, ROE >Y.
- [ ] **Portföy Paylaşım Linki (Branded)** `[S]` `[P3]` — Özel slug (`portfoi.com/@canmerter`).

---

## Search

- [ ] **SearchTab "50+" sonuç hint** `[S]` `[P2]` — "Aramayı daraltın" ipucu.
- [ ] **SearchTab portföy match=0 empty state** `[S]` `[P2]` — "Portföyünde eşleşme yok" mini note.

---

## UI & A11y Backlog

> Sprint'lere entegre edilebilir; boyut `[S]`=1-2h / `[M]`=yarım gün. Öncelik: `[P1]`=bug / `[P2]`=görünür tutarsızlık / `[P3]`=iyileştirme.

### Aktif Buglar / P1

- [ ] **AI parse kaydetme: `way` istemci doğrulaması eksik** `[S]` `[P2]` — CSV `BUY|SELL|DIV` normalize ediyor; AI parse yalnızca sayısal kontrol yapıp `way`'i insert ediyor. `saveTx`'e `way`/`asset_type`/tarih/para birimi doğrulaması ekle. `→ AddTab.js:73,79`
- [ ] **İşlem türü kart ikonları yeniden ele alınacak** `[S]` `[P1]` — AddTab asset type picker ikonları marka diliyle tam örtüşmüyor. Brand kit uyumlu SVG/logo yaklaşımı seçilecek.
- [x] **ManuelPosForm sadece USD pozisyonları listeler** `[S]` `[P2]` `Sprint-16` ✅ — `shares > CFG.DUST_THRESHOLD` filtresi; currency sembolü otomatik (₺/€/$).
- [x] **EUR tablosu sıralanamıyor** `[S]` `[P2]` `Sprint-16` ✅ — `sortEur` state + Ticker/Toplam sütunları tıklanabilir; ↑↓ ikonu.

### Tasarım Tutarsızlıkları

- [ ] **Kart padding standart dışı** `[S]` `[P2]` — `.card` `12px 14px`; AnalysisTab kartları `14px 16px`; Dashboard kartları `16px 18px` inline override. Tek `--card-pad` token ile standardize et.
- [ ] **Spinner boyut karmaşası** `[S]` `[P2]` — CSS `.spin` 18×18; inline'da 11/12/14px karışık. `--spin-sm:12px` + `--spin-md:16px` değişkenleri.
- [ ] **Yükleniyor metin standardı** `[S]` `[P2]` — `"..."`, `"Kaydediliyor..."`, `"Parse ediliyor..."` karışık. Kural: kısa buton → spin icon; uzun metin buton → standart Türkçe metin.
- [ ] **`.stitle` marginBottom inline override'ları** `[S]` `[P3]` — `data-tight`/`data-loose` modifier class ekle; aksi halde inline'ları kaldır.
- [ ] **`CUR_COLORS` `TYPE_COLORS` ile çakışıyor** `[S]` `[P2]` — AnalysisTab Kur Riski: `USD:"#0a84ff"` (FUND rengi) anlamsız. `TYPE_COLORS.US_STOCK` daha semantik. `→ AnalysisTab.js:~3989`

### Boş Durum & Mikrokopi

- [ ] **TickerDetailTab "işlem yok" div.dim** `[S]` `[P3]` — `.empty-card` ile tutarlı hale getir. `→ AnalysisTab.js:~1514`
- [ ] **AnalysisTab grafik alanları `.empty` sınıfı** `[S]` `[P3]` — `.empty-card` farkı kasıtlıysa CSS'e yorum ekle. `→ AnalysisTab.js:~3264/3304/3600/3665`
- [ ] **Temettü Özeti `dSym` EUR'u atlıyor** `[S]` `[P2]` — `dSym=displayCur==="TRY"?"₺":"$"` EUR'u dikkate almıyor. `displaySym(displayCur)` kullan. `→ AnalysisTab.js:~4068`
- [ ] **HistoryTab "tot" negatif format** `[S]` `[P2]` — `$-1,234` → `-$1,234`.

### Erişilebilirlik

- [ ] **Nav öğelerine `aria-label` eksik** `[S]` `[P2]` — `<nav id="bottom-tabs">` ve `<nav className="topbar-nav">` `aria-label` içermiyor. `→ App.js:~5422,~4783`
- [ ] **HistoryTab/TickerDetailTab accordion `aria-expanded` eksik** `[M]` `[P2]` — `open` state toggle eden satırlarda `aria-expanded={open}` yok.
- [ ] **Settings label semantik** `[S]` `[P2]` — `<label>` → `<div className="stitle">` standalone heading için.
- [ ] **Login autocomplete attributes** `[S]` `[P2]` — `email` + `current-password`.

### Etkileşim Tutarsızlıkları

- [ ] **Konsantrasyon Risk satırları `.pos-row` eksik** `[S]` `[P3]` — `cursor:"pointer"` inline var ama hover efekti yok. `.pos-row` ekle. `→ AnalysisTab.js:~3622`
- [ ] **HistoryTab filtre toolbar `flexWrap:"wrap"`** `[S]` `[P2]` — Dar mobilde select'ler ikinci satıra kayıyor. `.fbar` pattern ile `overflow-x:auto` yap. `→ HistoryTab.js:~1984`

### Görsel Hiyerarşi

- [ ] **AnalysisTab 15 kart bölüm başlıkları yok** `[M]` `[P2]` — Dağılım / Risk / Performans / Gelir gruplarına bölüm başlığı ekle; collapsible kural netleştirilmeli.
- [ ] **Dashboard açılış deneyimi — en az 1 blok default açık** `[S]` `[P3]` — Tüm bloklar başlangıçta kapalı; en büyük varlık bloğu default açık gelebilir. `→ App.js:50`

### Diğer Kod Kalitesi

- [ ] **`today` değişkeni üst-seviye fonksiyonu gölgeliyor** `[S]` `[P3]` — CAGR bileşeninde `const today = new Date().toISOString()...` (string) üst seviye `today` fonksiyonunu gölgeliyor. `todayStr` olarak adlandır. `→ App.js:~4195`
- [ ] **PublicView çift padding** `[S]` `[P3]` — `app-main` zaten `padding:24px 20px 60px`; PublicView iç `padding:16px 16px 80px` ile birleşince alt ~140px. `→ App.js:~5235`

### Brand Fit & Jargon Temizliği (Grup A/B — Sprint-15 kapsamı)

- [x] ~~**Finans jargonunu Türkçe kullanıcı diline çevir**~~ `[S]` `[P1]` (2026-05-13) — `Total Return → Toplam Getiri`, `Benchmark → Karşılaştırma`, `Trade → İşlem`, `XIRR → Yıllık Getiri` (detayda XIRR), `P/E/P/S → F/K/F/S`; 9 yer güncellendi.
- [x] **Karmaşık kartlara önce sonuç cümlesi ekle** `[S]` `[P1]` `Sprint-19` `2026-05-15` — Tamamlandı: Portföy Sağlık, Konsantrasyon Riski, Kur Riski kartlarında tek satırlık sinyal-renkli verdict cümlesi canlıda. 7 commit `4d57b4c..9ca62f5`. Dayanıklılık kartı Sprint 20'ye (skor bağımlılığı). Spec: `docs/superpowers/specs/2026-05-15-analysis-card-verdicts-design.md`, plan: `docs/superpowers/plans/2026-05-15-analysis-card-verdicts.md`.
- [x] ~~**Formülleri ekrandan kaldır**~~ `[S]` `[P1]` (2026-05-13) — `HHI= Σ(ağırlık²) × 10000`, skor formülleri, `FUND_THRESHOLDS` string metinleri kaldırıldı; sonuç değerleri + açıklayıcı tooltip kaldı. `→ AnalysisTab.js:1290,1943,1126`
- [ ] **Boş durum metinlerini kullanıcı diline çevir** `[S]` `[P2]` — `"snap. yok"` → `"Veri henüz oluşmadı"`; `"Bilinmiyor"` sektör → `"Henüz sınıflandırılmadı"`.
- [ ] **"Potansiyel Kayıp Simülasyonu" → "Senaryo Analizi" veya "Stres Testi"** `[S]` `[P2]` — Daha az korkutucu framing; renk nötrleştirme. `→ AnalysisTab.js:1371`
- [ ] **Potansiyel Kayıp Simülasyonu — altın pozisyonlarını filtrele** `[S]` `[P2]` — "Piyasa −%10/20/30" GOLD tipi pozisyonları kapsamalı mı? (a) `type!=='GOLD'` filtresi + "Hisse & Fon Değeri" alt başlığı, veya (b) footnote ile açıkla.
- [ ] **Başa Baş "Uzaklık" kolonuna tooltip ekle** `[S]` `[P2]` — `data-tip="Güncel fiyatın başa baş noktasına yüzde uzaklığı. Pozitif = kâr bölgesinde."` `→ AnalysisTab.js:1333`
- [ ] **AnalysisTab Özet / Detay iki katmana bölünsün** `[L]` `[P2]` — Özet (default): Aylık Özet, Dağılım kartları, 6 Aylık Performans, Kur Riski. Detay (toggle): Sağlık Tablosu, Konsantrasyon/HHI, Başa Baş, Kazanan/Kaybeden, Dayanıklılık, Dönem Bazlı Getiri.
- [ ] **Toplam Komisyon kartını AnalysisTab'dan taşı** `[S]` `[P2]` — Settings → İşlem Geçmişi altı veya "Maliyet Özeti" bölümü daha anlamlı.
- [ ] **Konsantrasyon Riski — HHI sonucu → trafik ışığı + cümle** `[S]` `[P2]` — "Konsantrasyon: Yüksek" pill + cümle yeterli; HHI sayısı detay/tooltip'e.
- [ ] **Fundamental Checklist'i şirket özeti + detay modeline çevir** `[M]` `[P2]` — TickerDetailTab önce plain-language özet: "Kârlılık güçlü · Borç makul · Değerleme pahalı". Ardından mevcut metrik grupları detay olarak kalır.
- [ ] **Watchlist'e niyet katmanı ekle** `[M]` `[P2]` — Watchlist row'unda hedef fiyat, uzaklık ve kısa not gösterimi. "Hedef Fiyat & Değerleme Notu" + "Hedef Fiyat Bildirimi" item'larıyla birleştir.
- [ ] **Sağlık Tablosu 🟢🟡🔴 sayılarına inline açıklama** `[S]` `[P2]` — "7 sağlıklı · 3 orta · 2 dikkat" formatı; tooltip touch'ta çalışmıyor. `→ AnalysisTab.js:1001-1007`

---

## Bug & UX Backlog

- [ ] **Dashboard ↻ Güncelle başarısız ticker ayrıntısı** `[S]` `[P2]` — Şu an "başarısız: AAPL" toast; Settings → Sistem Durumu'nda per-ticker hata sebebi (HTTP 403, bulunamadı vb.).
- [ ] **price_cache sanity check** `[S]` `[P2]` — `price = 0 || price = null` satırlar "bayat" sayılıp yeniden fetch tetiklemeli.
- [ ] **Service Worker cache versiyonlama** `[S]` `[P2]` — `CACHE = 'il-shell-v1'` sabit kalınca deploy sonrası eski HTML serve edilebilir. Öneri: deploy script'e `CACHE` adını otomatik artıran adım ekle veya `index.html`'i SHELL cache'inden çıkarıp network-first'e al.
- [x] **il_recent_search signOut temizliği** `[S]` `[P2]` ✅ — Her iki signOut handler'da zaten temizleniyordu; doğrulandı.
- [ ] **Form tutarı gizli-mod preview** `[S]` `[P2]` — `hide=true` iken form amount alanlarında girilen değerler `mask()` ile maskelenmeli.
- [x] **BIST/CRYPTO/GOLD cron refresh** `[S]` `[P2]` `Sprint-16` ✅ — `currency="USD"` filtresi → `type IN (US_STOCK,FUND,CRYPTO,GOLD,BIST)`; deployed.
- [ ] **HistoryTab tarih `fontFamily:"monospace"` sistem fontu** `[S]` `[P3]` — `"'DM Mono',monospace"` kullan. `→ HistoryTab.js:~2069`
- [ ] **HistoryTab accordion ticker DM Mono** `[S]` `[P2]` — `fontFamily:"DM Mono, monospace"` ekle.
- [ ] **Border contrast bump** `[S]` `[P2]` — `--border rgba(255,255,255,0.06)` bazı kartlarda kayboluyor; %10 veya inner shadow.
- [ ] **fundLoading spin icon** `[S]` `[P2]` — "..." yerine spin icon.
- [ ] **Login error/success → .flash class** `[S]` `[P2]` — inline style yerine class.
- [ ] **TickerDetailTab metaErr warn-card** `[S]` `[P2]` — küçük `.err` span yerine `.warn-card`.
- [ ] **Spinner boyut standardı** `[S]` `[P2]` — 12/14/11px karışık; tek standart.
- [ ] **Tip picker desc font/contrast** `[S]` `[P2]` — 10px var(--text3) AA sınırda.
- [ ] **AddTab tip değiştir butonu dokunma hedefi** `[S]` `[P2]` — 24-26px → 44px.
- [ ] **Türkçe/İngilizce term sözlüğü** `[S]` `[P2]` — CLAUDE.md'ye glossary ekle; `period` → `dönem` vb.

---

## Güvenlik Hardening

- [ ] **Yahoo Finance → resmi BIST data kaynağı** `[L]` `[P1]` `[Going-Live Öncesi]` — Unofficial endpoint; herhangi bir güncellemede tüm BIST kullanıcıları için fiyat kesilir. Adaylar: Rasyonet, Matriks, Bigpara API. Geçiş mimarisi edge function içinde izole. Solo-dev aşamasında kabul edilebilir risk; canlı sistem öncesinde ele alınmalı.
- [ ] **borsa-mcp self-host** `[M]` `[P1]` `[Going-Live Öncesi]` — Tek geliştirici hosted instance, SLA yok. Supabase Edge Function içine veya VPS'e Docker ile al (`saidsurucu/borsa-mcp`). Şu an tek kullanıcı — acil değil; multi-user öncesi.
- [ ] **Massive.com rate limit yönetimi** `[M]` `[P1]` `[Going-Live Öncesi]` — `RATE_LIMIT_MS=7500`; çok kullanıcıda 429. Seçenek: paid tier veya cache-first mimar. Tek kullanıcıda sorun çıkmıyor; multi-user öncesi.
- [ ] **Frankfurter API fallback** `[S]` `[P2]` — Ücretsiz, SLA yok; ECB doğrudan XML feed (`sdw-wsrest.ecb.europa.eu`) fallback.
- [ ] **İş Yatırım MaliTablo resmi olmayan endpoint izleme** `[S]` `[P2]` — Anti-bot değişikliğinde BIST fundamentals sessizce kırılır; response boş/HTML gelince kullanıcıya açık hata göster.
- [ ] **Auto-fetch opt-in** `[S]` `[P2]` — Çok kullanıcıda rate limit zorlar; "otomatik güncelleme aralığı" kullanıcı ayarı ileride eklenebilir.

---

## Going Live / Custom Domain

- [ ] **Canonical domain kararı** `[S]` `[P1]` — apex (`https://portfoi.com`) veya `www`; önerimiz `www` canonical + apex redirect.
- [ ] **GitHub Pages custom domain ayarı** `[S]` `[P1]` — `Settings → Pages → Custom domain`; root `CNAME` dosyası; HTTPS enforce.
- [ ] **DNS kayıtları** `[S]` `[P1]` — Apex: `A` kayıtları GitHub Pages IP'lerine. `www`: `CNAME www → canmrtr.github.io`.
- [ ] **Root-path migration** `[S]` `[P1]` — `/Investment-Ledger/` prefix'leri kaldır; PWA linkleri, SW path, manifest `start_url/scope/icons` güncelle.
- [ ] **Supabase Edge Function CORS güncellemesi** `[S]` `[P1]` — `Access-Control-Allow-Origin` yeni canonical domain'e taşı; geçiş döneminde allowlist.
- [ ] **Supabase Auth URL ayarları** `[S]` `[P1]` — Site URL + izinli redirect URL'leri güncelle.
- [ ] **Eski URL geçiş politikası** `[S]` `[P2]` — `canmrtr.github.io/Investment-Ledger/` yayını custom domain'e mi yönlenir karar ver.
- [ ] **Smoke test ve dokümantasyon güncellemesi** `[S]` `[P2]` — `e2e/smoke.mjs`, `CLAUDE.md`, `GOTCHAS.md`, brand kit referanslarını canonical domain'e taşı.

---

## Mobil Uygulama (App Store & Google Play)

### Aşama M2 — Build Sistemi Geçişi

- [ ] **Vite + JSX build sistemine geçiş** `[L]` `[P1]` — Babel Standalone → Vite + JSX; CDN → npm package; GitHub Actions `vite build → dist/`; `.env` + `import.meta.env.VITE_*`. Pure refactor — UI/fonksiyon değişmemeli.
- [ ] **Offline-capable service worker** `[M]` `[P2]` — Vite geçişi sonrası; bundle precache; stale-while-revalidate.
- [ ] **TypeScript opt-in (kademeli)** `[M]` `[P2]` — Vite sonrası `allowJs:true`; önce kritik yardımcılar (`convert`, `rebuildPositions`, `xirr`).
- [ ] **Env variable yönetimi** `[S]` `[P1]` — Supabase URL + anon key → `.env` + `import.meta.env.VITE_*`.

### Aşama M3 — Native Wrapper

- [ ] **Capacitor entegrasyonu** `[L]` `[P1]` — Vite build çıktısını iOS + Android native proje olarak sarmalama. `npx cap add ios && npx cap add android`.
- [ ] **Deep link & OAuth redirect** `[M]` `[P1]` — `capacitor://` scheme; iOS `Info.plist` + Android `AndroidManifest.xml`.
- [ ] **Push notification (opsiyonel)** `[M]` `[P2]` — `@capacitor/push-notifications`; fiyat alarmı bildirimleri.
- [ ] **App Store metadata & review hazırlığı** `[M]` `[P1]` — Apple Privacy Nutrition Label; Android Data Safety form.
- [ ] **Hesap silme (App Store zorunluluğu)** `[S]` `[P1]` — Apple Guideline 5.1.1; cascade delete; App Store başvurusundan önce zorunlu.

---

## Açık Sorular

- Provider seçimleri ücretsiz mi? Daily rate limit ne? (Massive, FMP free tier sınırı)
- Social feed için kullanıcı pozisyon paylaşımı → RLS policy güncellemesi mimarisi
- borsa-mcp'de `get_news` tool'u var mı? → BIST haber entegrasyonu için test et
- FMP `/stable/discounted-cash-flow` ücretsiz tier'da mı? → DCF değerleme önkoşulu
- Resend API ücretsiz tier limiti nedir? → Haftalık özet email + hedef fiyat alarmı için
- `portfolio_snapshots` tablosu ne zaman devreye girmeli? → Sparkline geçmişi + haftalık email önkoşulu

---

## Sonraki Adım

Sprint 4–20 ✅ | **Sprint 21 başlamaya hazır** | Önceki dosya: `sprints/sprint-20.md` (planlanacak)

**Sprint 20 ✅ kapandı (2026-05-16):**
- ✅ Item 3 — BES "Değer Güncelle" butonu: `BesUpdateModal` component (2 alan: Kişisel Güncel + DK Güncel) + TickerDetailTab BES Özeti üstü full-width buton + Dashboard BES pos-row 💰 ikon (desktop+mobile, stopPropagation). `flash_` prop wiring fix dahil.
- ✅ Item 4 — Tam Detay paylaşım UI fix: Settings privacy_level toggle'ları disabled + "💡 Tam detay paylaşımı sosyal güncellemesinde aktif olacak" copy; `togglePrivacyLevel` fonksiyonu + dead `privLevel` var kaldırıldı.
- ✅ Item 5 — LS key user-scope hardening: `clearUserLocalKeys()` helper (`il_theme` + `il_fx` whitelist); 2 signOut call site (hamburger + Settings danger) refactor.
- ⏭️ Item 6 (52W giriş kalitesi bar) Sprint 21'e ertelendi — `price_cache` migration + `fetch-prices` değişikliği gerektirdiği için Sprint 20 kapsamı dışında. `high_52w/low_52w` aslında fund_cache'te mevcut DEĞİL, yeni veri çekimi gerekli.

**Sprint 21 adayları (öncelik sırası, 2026-05-16 grooming):**

1. **Piyasa Dayanıklılık Skoru** `[M][P2]` — `resilienceScore` (3 metrik: Borç/Özk, FCF marjı, op marjı) + MV-weighted portföy skoru + AnalysisTab kartı + 2d verdict cümlesi (Sprint 19 Item 2'nin tamamlayıcısı). Tamamen frontend.
2. **TEFAS WAF testi** `[S][P1]` — Bloker test adımı: endpoint `https://www.tefas.gov.tr/api/DB/BindHistoryInfo` canlı ortamda dene; geçerse tam TEFAS entegrasyonu başlatılabilir. Aksi halde `fonbul.com` fallback planına geç.
3. **Alım Fiyatı Bölgesi Analizi (52W Konumu)** `[S→M][P2]` — avg_cost'u 52W aralığına yerleştiren horizontal progress bar. Sprint 20'den taşındı; `price_cache` migration + `fetch-prices` historical mode 52W high/low hesaplaması gerekiyor.
4. **"Tam Detay" gerçek tam-detay render** `[M][P2]` — Social Faz 2 ile birlikte: public view `is_public` + `privacy_level==="full"` modda gerçek `shares`/`avg_cost` render. Şu an UI disabled, "yakında" mesajıyla.
5. **LS key user-scope prefix (uzun vade)** `[M][P3]` — Sprint 20'de signOut temizliği yapıldı; ek olarak `user.id` prefix migration (`il_${userId}_*` pattern) yapılabilir. Cross-account leak şu an yok ama daha güçlü izolasyon.
