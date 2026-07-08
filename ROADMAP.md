# Roadmap / Idea Backlog

Fikir havuzu — öncelik ve boyut etiketli, her sprint gözden geçirilir.

İlk toplama: **2026-04-24** | Son grooming: **2026-06-20** (Sprint 21–25 ✅. **Sprint 24 = TEFAS ✅ SHIPPED 2026-06-05** — 3509 fon katalog canlıda, NAV doğrulandı. Retro: `sprints/sprint-24.md`. **Sprint 25 = Değerleme Okunabilirliği ✅ KAPANDI** (2026-06-05 → 2026-06-18) — 3 kapsam işi de kodlandı + canlıya deploy edildi (commit `fe3e16a`: Fundamental Checklist özet+detay · ağırlıklı portföy F/K vs S&P 500 · `--card-pad` token). Tek carry-over: canlı `fund_cache` verisiyle render göz doğrulaması → Sprint 26 başında birlikte yapılır. Plan+delivery: `sprints/sprint-25.md`. **Sprint 26 ✅ KAPANDI** (TEFAS sparkline + market-drop nudge; commit `82c8b93`, canlıda doğrulandı — YAC NAV sparkline +16.6%). **Sprint 27 ✅ KAPANDI** (2026-06-21'de erken; commit `a238d2c`): kazanç tez-kontrol nudge'ı (TickerDetail) + SearchTab FOMO badge — ikisi de canlıda doğrulandı (GARAN m1-bump testi). Katman 2 davranışsal nudge sistemi 3 yüzeyde tamam (kayıp/kazanç/FOMO). **Sprint 28 ✅ KAPANDI** (Going-live: Settings IA revamp + Support kanalı + tez nudge; 3/3 + SW fix). **Sprint 29 PLANLANDI** (Altın işçilik premium — %41'lik en büyük dilim, kör nokta). Detay "Sonraki Adım"da.)

### Uzun Vadeli Platform Vizyonu

Detay için bkz. `docs/strategy/product-vision.md`. **Özet — 4 Katman:**
- **Katman 1 (Mevcut)** — Tracker: portföyü görünür kılar.
- **Katman 2 (+1 ay)** — Davranışsal Nudge'lar: tetikleyici→mesaj, karar sürtünmesi yaratır.
- **Katman 3 (+3 ay)** — Koç Sekmesi: kullanıcının yatırım felsefesini tanımlar, uyum skoru verir.
- **Katman 4 (+6 ay)** — AI Asistan: portföy bağlamıyla çalışan conversational yatırım koçu.

Platform yörüngesi: (1) Solo web app → (2) Multi-user SaaS → (3) Native mobil. **Her yeni geliştirme bu geçişi kolaylaştırmalı**: yeni state LS değil Supabase'e; her external API çağrısı edge function arkasına; `window`/`document` bağımlılığını izole et; yeni bileşenlerde `px` yerine `rem`/`dvh`.

---

## Tamamlananlar

> Sprint 1–12: ~60 özellik tamamlandı. Tam liste → [`_archive/roadmap-completed.md`](_archive/roadmap-completed.md)

---

## Brand & Design — Sprint 21 (closed 2026-05-16)

> Sprint 21 hedefi: "Yeni marka kimliğini uçtan uca yerleştir (logo, favicon, PWA icons, topbar wordmark) ve `design_audit.md` (2026-05-15) Phase-1 hijyenini halletim." ✅ kapandı. Phase-2 carry-over Sprint 23'te #4 + #6 ile devam etti; #7 + #9 Sprint 25+ adayı olarak `## UI Polish` altında izlenir.

- [x] **Logo refresh end-to-end** `[M]` `[P0]` `Sprint-21` `2026-05-16` — Login lockup swap (linear-* → portfoi-lockup-*, 240→160px); topbar wordmark butonu (>640px, dashboard'a tıklanır); PWA icons (icon-192/512) Playwright rasterizer ile yeniden üretildi; favicon.svg + favicon-32.png eklendi; service-worker SHELL precache `il-shell-v3`'e bumped. Kaynak SVG `Logo/portfoi-icon.svg`. Eski Logo dosyaları (`linear-*`, `Full Name *`, `Logo Dark/Light`) rollback için `Logo/`'da kalır.
- [x] **5-tier button system** `[M]` `[P1]` `Sprint-21` `2026-05-16` — `.btn-icon` (square icon-only) eklendi; `.btn-xs/.btn-sm/.btn-md/.btn-pri` min-height ile codified. `.pri` alias olarak korundu (back-compat). Doc: CLAUDE.md "Tasarım sistemi → Buton katmanları".
- [x] **Mobile form grid classes** `[S]` `[P1]` `Sprint-21` `2026-05-16` — `.form-grid-2/3` reusable; ManuelPosForm + TickerDetailTab manuel quick-add + TickerDetailTab edit row + HistoryTab edit row migrate edildi; ≤640px tek kolona çöker.
- [x] **Text size minimums** `[S]` `[P2]` `Sprint-21` `2026-05-16` — `.empty-card .sub` 12→13, `.ttl` 15→16, `.warn-card .wc-sub` 11→12, `.sg .hint` 11→12. `.lbl/.kk/.stitle` 10px ve tablo hücreleri 12px korundu (intentional dense labels).
- [x] **Mobile touch targets ≥36px** `[S]` `[P1]` `Sprint-21` `2026-05-16` — `@media(max-width:640px)`: `.btn-xs/.btn-icon/.btn-sm` min 36×36; `.pos-row .btn-xs` ve `table .btn-xs` padding 8/10.
- [x] ~~**Design audit Phase-2**~~ `[M]` `[P2]` `Sprint-25` `2026-06-09` ✅ — `design_audit.md` kalan maddeler tamamlandı. ✅ #8 tablet breakpoint + #10 inline flash class Sprint 22'de kapandı; ✅ #4 empty-state normalization + #6 button-like span→button Sprint 23 carry-over'da kapandı (2026-05-25, commits `710857a` + `8a54c56`). ✅ #7 card padding `--card-pad` token (baskın değer; 2026-06-09) + #9 tooltip consistency (src/components'te native `title=` yok — zaten tek `data-tip` pattern'i; touch fallback `App.js` global handler'ı ile çalışıyor) Sprint 25'te kapandı.

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

### Denetim Turu 5 Bulguları — 2026-05-17 (audit.md)

> Tümü 2026-05-19'da kapatıldı. Detay: `audit.md` (status stamp'li).

- [x] **`set-manual-price` shared `price_cache` overwrite** `[S]` `[P0]` `2026-05-19` — High finding. Edge fn artık `asset_type==="BES"` + `auth.uid()` BES pozisyon ownership doğruluyor; non-BES tickers veya başkasının BES'i için 403. `→ fetch-prices-edge-function.js:325`
- [x] **BES update atomicity** `[S]` `[P1]` `2026-05-19` — Medium. Migration 019 `bes_update_atomic` RPC (SECURITY DEFINER): positions.dk_current + price_cache aynı transaction. `BesUpdateModal` artık RPC çağırıyor; iki-adımlı yazım kaldırıldı. `→ supabase/migrations/019_bes_update_atomic.sql; BesUpdateModal.js`
- [x] **DEPOSIT kısmi çekim sonrası faiz mat.** `[S]` `[P1]` `2026-05-19` — Medium. `computeDepositGrossInterest` SELL'de `grossInterest *= newBal/oldBal` ile orantılı faiz çıkışı uygular; çekilen anaparayla orantılı biriken faiz yanında gider. `→ App.js:5-30`

**P2 — Sprint-16:**

- [x] **`get_allocation_only_positions` çoklu-para birimi sorunu** `[M]` `[P1]` `Sprint-16` ✅ — Migration 014: price_cache FX oranı ile USD'ye normalize; avg_cost fallback yok; anon GRANT kaldırıldı.
- [x] **"Tam Detay" portföy paylaşımı: UI ≠ veri katmanı** `[S]` `[P1]` `2026-05-19` — Audit fix (Medium): public view load logic her durumda `get_allocation_only_positions` RPC'sine düşer; cost-basis pct fallback kaldırıldı. `privacy_level='full'` column + RLS gelecekteki social full-detail UI için saklı.
- [x] **CSP/SRI: `html2canvas` integrity hash eksik** `[S]` `[P2]` `Sprint-16` ✅ — `index.html` sha512 integrity attribute eklendi.
- [x] **`watchlist_own` policy `FOR ALL` — UPDATE riski** `[S]` `[P2]` `Sprint-16` ✅ — Migration 015: FOR INSERT/SELECT/DELETE ayrı policy; UPDATE DB seviyesinde engelli.
- [x] **`fetch-prices` historical upsert hatası sessizce yutuluyor** `[S]` `[P2]` `Sprint-16` ✅ — PostgREST + network hataları console.error ile loglanıyor.
- [x] ~~**LS key'leri user-scope değil**~~ `[S]` `[P2]` `Sprint-22` `2026-06-13` ✅ — Sprint 22 #5'te kapandı (grooming-confirmed 2026-06-13): user-scoped key'ler `il_<base>_<userId>`; device-pref global'ler (`il_theme`/`il_fx`/`il_disp_cur`) prefix'siz. App mount'ta `migrateUserLSKeys`, signOut'ta `clearUserLocalKeys`. Manifest → `CACHE.md`. `→ App.js:45,592,1408`
- [x] **`price_snapshots` policy `TO anon, authenticated` eksik** `[S]` `[P3]` `2026-05-19` — Migration 020: DROP + CREATE policy explicit `TO anon, authenticated USING (true)`. `fund_cache`/`adr_bist_map` pattern'ine hizalandı.

---

## Asset Type Genişletme

- [x] ~~**TEFAS Yatırım Fonu entegrasyonu**~~ `[L]` `[P1]` `Sprint-24` `2026-06-05` ✅ — Yeni `TEFAS` asset type (`#84CC16` lime, TRY). Günlük NAV `tefas.gov.tr/api/funds/fonFiyatBilgiGetir`'den; `tefas_funds` katalog (**3509 fon canlıda**); SearchTab kod+isim araması (lime badge); Dashboard "TEFAS Fonları" bloğu (₺); AnalysisTab lime dilim + Türkiye bölge; 6h cron. **Canlı: migration (MCP) + 3 edge fn deploy + katalog yüklendi + NAV doğrulandı (YAC=14.05).** Canlı doğrulamada NAV bug yakalandı (bugünün entry'si yayına kadar 0) → `tefasLastPublished` fix'lendi. 17 commit. Retro + runbook: `sprints/sprint-24.md`. Spec/Plan: `docs/superpowers/{specs,plans}/2026-05-13-tefas-integration*`
  - [x] (1) `fetch-prices` `isTefas` routing (price/historical/meta) `[S]` `2026-06-04`
  - [x] (2) `tefas_funds` SQL migration + public-read RLS (rls-auditor PASS) `[S]` `2026-06-04`
  - [x] (3) Frontend sabitler: TYPE_COLORS, TL, BLOCK_TYPES, ASSET_ICONS, cache helper `[S]` `2026-06-04`
  - [x] (4) `fetch-fundamentals mode:"tefas-catalog"` (JWT-protected, anon değil) `[S]` `2026-06-04`
  - [x] (5) AddTab TEFAS Fonu picker girişi `[S]` `2026-06-04`
  - [x] (6) SearchTab `tefas_funds` birleşik arama + lime badge (5×1000 sayfalama) `[S]` `2026-06-04`
  - [x] (7) AnalysisTab REGION_OF (tr), TYPE_LBL, priceCurOf, Fundamentals hariç `[S]` `2026-06-04`
  - [x] (8) Settings "TEFAS Katalogu Yenile" butonu `[S]` `2026-06-04`
  - [x] (9) `refresh-price-cache` cron'a TEFAS ekleme `[S]` `2026-06-04`
- [x] ~~**BES Devlet Katkısı (DK) entegrasyonu**~~ `[M]` `[P0]` `Sprint-18` ✅ (2026-05-13) — 4 form alanı (kişisel yatırılan, kişisel portföy güncel, DK anaparası, DK portföy güncel); `positions` tablosuna `dk_principal` + `dk_current` kolonları eklendi; `rebuild_positions_atomic` RPC güncellendi; cost basis = yalnızca kişisel yatırılan, DK+getiri tamamı kazanç; hint kaldırıldı. Migration 018. `→ utils.js, App.js, ManuelPosForm.js`
- [x] ~~**AI parse temettü desteği (DIV way)**~~ `[S]` `[P1]` (2026-05-13) — `parse-transaction` sözleşmesi `BUY|SELL|DIV` oldu; Türkçe temettü ifadesi örnekleri eklendi; `saveTx` way allowlist doğrulaması eklendi. `→ parse-transaction-edge-function.js; AddTab.js`
- [ ] **TR altın işçilik premium göstergesi** `[M]` `[P2]` `Sprint-29 (headline)` — Reşat/Ata birimi ekleme; Dashboard/TickerDetail "Saf altın değeri ₺X · Ödenen ₺Y · Prim %Z" render; ödenen − saf fark. Mevcut `GOLD_UNITS`/`goldOzPerUnit`/XAU spot altyapısı kullanılır. Premium tanımı spike'ta seçilir (güncel-spot / eğitimsel / historical). Plan: `sprints/sprint-29.md`.
- [ ] **BIST P/S metriği** `[S]` `[P2]` — borsa-mcp `meta.market_cap` / `latestRevenue` ile derive; frontend veya edge function 2. call.
- [ ] **BIST bankalar fundamentals** `[L]` `[P2]` — UFRS grubu Roman numeral itemCode mapping; `ISY_KNOWN_BANKS` early-exit kaldır.
- [ ] **FX/GOLD ham ticker normalize** `[S]` `[P2]` — `asset_type:"FX"` prefix'siz `USDTRY` gelince 404; `C:` autoprefix + format guard.
- [x] **BES (Bireysel Emeklilik) temel giriş** `[S]` `[P1]` `Hotfix-2026-05-11` ✅ — ManuelPosForm BES için pay adedi/NAV kaldırıldı; "Yatırılan Toplam Tutar" + "Güncel Değer" alanları eklendi. `shares=1, avg_cost=yatırılan`; güncel değer `fetch-prices mode:"set-manual-price"` → `price_cache`. Devlet katkısı farklı hesap kodu ile ayrı pozisyon.
- [x] **BES TickerDetailTab breakdown kartı** `[S]` `[P1]` `Sprint-19` `2026-05-15` — Tamamlandı: 7-satır iki bölümlü kart (Kişisel Portföy + tinted Devlet Katkısı + Toplam Değer footer). 6 commit `45d98fc..50b92f4`. NULL guard ile eski BES pozisyonları "⚠ DK bilgisi güncellenmeli" nudge gösteriyor. ↻ Meta butonu BES için gizlendi; meta/divCal edge fetch'leri skiplendi. Spec: `docs/superpowers/specs/2026-05-15-bes-tickerdetail-breakdown-design.md`, plan: `docs/superpowers/plans/2026-05-15-bes-tickerdetail-breakdown.md`.
- [x] **BES güncel değer aylık güncelleme** `[S]` `[P2]` `Sprint-19` `2026-05-19` ✅ — 💰 buton Dashboard pos-row (desktop+mobile) + TickerDetailTab "💰 Değer Güncelle"; `BesUpdateModal` `bes_update_atomic` RPC üzerinden positions.dk_current + price_cache aynı transaction'da yazar. Migration 019.
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

- [x] ~~**Temettü Takvimi**~~ `[M]` `[P2]` `Sprint-19` `2026-06-20` ✅ — Üç alt-task da shipped (grooming-confirmed): `mode:"dividend-calendar"` dalı + TickerDetailTab "Sonraki Temettü" satırı + Dashboard "Bu Ay Beklenen Temettüler" `<details>` kartı (ex_date ∈ [today, today+30]). Opsiyonel HistoryTab "Yaklaşan Temettüler" tablo varyantı bilinçli olarak ertelendi (Dashboard kartı pratikte kapsamı karşılıyor).
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
- [x] **DCF Hızlı Değerleme** `[M]` `[P3]` `2026-05-21` ✅ — TickerDetailTab'da 21-maddelik fundamental checklist'in üstünde "Hızlı Değerleme (DCF)" kartı. `fetch-fundamentals` `fetchFmp` 7. paralel URL olarak FMP `/stable/discounted-cash-flow` çeker; `dcf` cevabın top-level alanı (metrics jsonb'sine konmaz — checklist kriter sayısı 21 kalır). Kart: adil değer + güncel fiyat + yükseliş potansiyeli `(dcf−price)/price`; renk eşiği `≥%50` 🟢 / `≥%25` 🟡 / `<%25` 🔴. Sadece US_STOCK/USD + `fund.dcf>0`; BIST/EDGAR-fallback/zararda şirket → kart gizli. Migration yok. `→ fetch-fundamentals-edge-function.js; src/components/TickerDetailTab.js`
- [ ] **Snowflake Skor (Çok Boyutlu)** `[L]` `[P3]` — Simply Wall St benzeri 5-boyut skor (Değer/Büyüme/Kalite/Borç/Temettü); `FUND_THRESHOLDS` üstünden; 5-dilimli radar SVG. Önce diğer fundamentals tamamlanmalı.
- [ ] **Fundamental checklist gruplarını Investment-Guide'a hizala** `[S]` `[P2]` — `FUND_GROUPS` 7 başlığı → `docs/guide/investment-guide.md` Part 5'in 5 başlığına eşitlenir: (a) `fcfMargin` "Cash Flow Strength" grubuna taşı; (b) Büyüme+Kâr Marjları+Gider Disiplini → "Income Quality". Eşikler aynen kalır; sadece grup yapısı değişir.

---

## Analiz Tab — Yeni Özellikler

### Portföy Analizi

- [ ] **"Dip mi Tepeden mi Girdim?" Giriş Kalitesi (sözel verdict)** `[S]` `[P2]` — **Kısmen shipped**: TickerDetailTab'da held US_STOCK/BIST(TRY) için 52W gradient bar (avg_cost marker + güncel fiyat disk) live (`TickerDetailTab.js:780`). Kalan delta: açık "İyi giriş %28 / Tepeden %89" sözel verdict etiketi + (opsiyonel) AnalysisTab portföy seviyesi rollup. (Eski "Alım Fiyatı Bölgesi Analizi / 52W Konumu" item'ı buraya katlandı.)
- [ ] **Portföy Çeşitlendirme Skoru** `[M]` `[P2]` — Bölge × Sektör × Asset Type matrisinden 1-10 skor; tek bölge/sektör yoğunlaşmasına göre uyarı cümlesi. Tamamen frontend hesabı.
- [ ] **Yeniden Dengeleme Önerisi (Rebalancing)** `[M]` `[P2]` — Kullanıcı hedef dağılım girer (US %50, BIST %30 vb.); mevcut farkı göster. `profiles` tablosuna JSON kolonu gerekir.

### Risk

- [ ] **Likidite Analizi** `[M]` `[P2]` — `marketCap` bazlı "kolayca satılabilir / az likit" sınıflandırması. Fundamentals cache'ten; ek fetch yok.
- [x] ~~**Piyasa Düşüşü Dayanıklılık Skoru**~~ `[M]` `[P2]` `2026-06-13` ✅ — AnalysisTab Detay katmanında live (grooming-confirmed): `resilienceScore` MV-weighted 1-10 + tek-satır verdict (güçlü ≥7 / orta ≥5 / kırılgan <5) + composition satırı + per-ticker bar grid. BIST bankaları + non-equity `isFundEligible` ile kapsam dışı. Fundamentals cache; ek fetch yok. `→ AnalysisTab.js:477-508`
  - [x] (a) `resilienceScore(m)` fonksiyonu ✅
  - [x] (b) MV-weighted portföy skoru hesabı ✅
  - [x] (c) AnalysisTab "Piyasa Dayanıklılığı" kartı ✅
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
- [x] ~~**Ağırlıklı Ortalama Portföy P/E**~~ `[S]` `[P2]` `Sprint-25` `2026-06-09` ✅ — AnalysisTab Portföy Sağlık'ta MV-ağırlıklı F/K KPI + 3-durumlu plain-language cümle: "Portföyünün F/K'sı 18.4 — S&P 500 ortalamasının (~22) altında/civarında/belirgin üstünde" (ratio <0.9 🟢 / ≤1.1 🟡 / >1.1 🔴). Kaynak yorumlu sabit (`SP500_PE=22`); "X pozisyon dahil · kapsanan değer %Y" notu; kapsam <%60 ise "kısmi veri" uyarısı. Yeni fetch yok. `→ src/components/AnalysisTab.js`
  - [x] ~~(a) AnalysisTab Portföy Sağlık'a KPI olarak ekle; atlanma sayısı not~~ `[S]` `2026-06-09`
  - [x] ~~(b) S&P 500 karşılaştırma cümlesi — hardcoded ~22 referans~~ `[S]` `2026-06-09`

### Vergi & Muhasebe

- [ ] **Vergi Yılı Özeti** `[L]` `[P2]` — Seçilen yılda realized kazanç/kayıp; US short/long-term ayrımı; TR BIST 2 yıl muafiyet; tahmini vergi. Tarihi FX için Frankfurter.
- [ ] **Ortalama Elde Tutma Süresi** `[S]` `[P2]` — "Portföy ortalaması: 8.3 ay". `transactions` BUY tarihleri; tamamen frontend.
- [ ] **FIFO / LIFO Maliyet Muhasebesi** `[L]` `[P3]` — Vergi raporlaması için lot bazlı takip. Büyük mimari değişiklik.
- [ ] **Yıllık Portföy Raporu (PDF)** `[L]` `[P3]` — Başlangıç/bitiş portföy değeri, kazanç/kayıp, temettü, komisyon, en iyi/en kötü 3 işlem. `window.print()` + print CSS.

### Davranışsal Analiz

- [ ] **Art Arda Kazanma/Kaybetme Serisi (Streak)** `[S]` `[P3]` — Kapatılmış işlemler kârlı/zararlı zinciri; tamamen `transactions` BUY+SELL frontend hesabı.
- [x] ~~**Alım Fiyatı Bölgesi Analizi (52W Konumu)**~~ `[S]` `[P2]` `2026-06-13` — Duplicate; "Dip mi Tepeden mi Girdim?" (Portföy Analizi) item'ıyla aynı iş, oraya katlandı. Görsel bar TickerDetailTab'da shipped; kalan sözel-etiket deltası tek item'da izlenir.
- [ ] **Kayıp Realizasyonu Analizi (Tax Loss Harvesting)** `[S]` `[P3]` — Zarardaki pozisyonlar + elde tutma süresi; "XYZ 2 yıldır zararda — vergi avantajı fırsatı". Frontend hesabı.

### Analiz Tab Açık Alt Görevler

- [x] **Dashboard: Kripto getirisi gösterilmiyor** `[S]` `[P1]` ✅ — Düzeltildi.

- [x] ~~**Başabaş tablosu ve potansiyel kayıp bölümleri — Detay katmanına taşı**~~ `[S]` `[P3]` `Sprint-23` `2026-05-22` — Özet/Detay split ile birlikte tamamlandı: Başa Baş Analizi (order:32) ve Potansiyel Kayıp Simülasyonu (order:33) Detay katmanına taşındı.

- [x] ~~**Aylık özet yerleşimi — sayfada daha aşağı**~~ `[S]` `[P3]` `Sprint-23` `2026-05-22` — Özet/Detay split ile tamamlandı: Aylık Özet (order:13) Dağılım kartlarının (Varlık 10 / Bölge 11 / Sektör 12) altına yerleşti; Özet katmanında görünür kalır.

- [ ] **Win/Loss time horizon seçimi** `[S]` `[P2]` — şu an bugünkü fiyat; 1A/3A/6A/1Y window chip.
- [ ] **Win/Loss sold-out ticker live price** `[S]` `[P2]` — cache'te yoksa "noPrice" sayım dışı; live fetch seçeneği.
- [ ] **Analiz bölge ETF underlying** `[M]` `[P2]` — MCHI=Çin gibi; şu an FUND→US default.
- [ ] **AnalysisTab Komisyon KPI label** `[S]` `[P2]` — `{displayCur}` yerine `Toplam ({displayCur})`.

---

## Otomasyon & Raporlama

- [ ] **Haftalık Portföy Özeti E-postası** `[M]` `[P2]` — Her Pazar pg_cron: haftanın getirisi, en iyi/en kötü 3 ticker. Resend API. `portfolio_weekly_snapshot` tablosu (user_id, week_start, mv_usd, mv_try, top_gainer, top_loser). Bağımlılık: Resend API key.
  - [ ] (a) `portfolio_weekly_snapshot` tablosu + pg_cron Pazar sabahı toplama `[S]`
  - [ ] (b) Resend API entegrasyonu + temel template (getiri + top/bottom 3) `[S]`
  - [ ] (c) AI özet katmanı — Haiku ile 4-5 cümle Türkçe yorum (eski "Haftalık AI Portföy Özeti" P3 item'ı buraya kaymış) `[M]`
- [x] **Stale Fiyat Uyarısı (price_cache yaşı)** `[S]` `[P2]` `Sprint-19` `2026-05-15` — `isPriceStale(updatedAtISO, 24)` `src/utils.js`'te; App.js `prcUpdatedAt` state'i `price_cache.updated_at`'i map'liyor; `.badge.stale` Dashboard desktop+mobile pos-row'da ve WatchlistTab ticker hücresinde; hover'da `data-tip` ile "Fiyat X sa önce güncellendi". CASH/DEPOSIT/BES synthetic tipler `prcUpdatedAt` map'inde yok → badge görünmez.
- [ ] **Otomatik Split Tespiti** `[L]` `[P3]` — FMP adjusted fiyatla avg_cost karşılaştırma; >50% sapmada "split olmuş olabilir" uyarısı.

---

## Akıllı Öneriler & Nudge Sistemi

- [x] ~~**Katman 2 — Piyasa düşüş nudge'ı**~~ `[S]` `[P2]` `Sprint-26` `2026-06-21` ✅ — `computeNudges`'a eklendi: MV-ağırlıklı günlük değişim (`allDisp` `mv`×`d1`, yalnız fiyat-takipli pozisyonlar) ≤ -%5 ise P0 Dashboard nudge'ı. Yeni LS key yok — gün-damgalı id (`market_drop_YYYY-MM-DD`) mevcut `il_nudge_dismissed` makinesiyle aynı gün susar, ertesi gün yeniden görünür. Yeni fetch yok. `→ src/utils.js`
- [x] ~~**Katman 2 — Yeni pozisyon ekleme checklist sorusu**~~ `[S]` `[P2]` `Sprint-28` `2026-06-21` ✅ — AddTab'da tip seçildikten sonra (CASH/DEPOSIT hariç) pasif gold-tinted tez hatırlatması; kalıcı dismiss (`il_nudge_thesis_<userId>`). Yeni API yok. **4. ve son Layer-2 nudge — davranışsal nudge sistemi tamam** (kayıp/kazanç/FOMO/yeni-pozisyon). `→ AddTab.js`
- [x] ~~**Katman 2 — Popüler hisse FOMO uyarısı**~~ `[M]` `[P2]` `Sprint-27` `2026-06-21` ✅ — SearchTab sonuç satırında `hist[ticker].m1 > 30` ise pasif-bilgilendirici `🔥 +%X` badge + tooltip ("Son ~1 ayda çok hareketlendi — FOMO mu, tez mi?"). Yalnız cache'te olan ticker'larda; tamamen frontend, yeni fetch yok. App `hist`'i prop geçirir. `→ SearchTab.js, App.js`
- [x] ~~**Katman 2 — Büyük kazanç tez kontrolü nudge**~~ `[S]` `[P2]` `Sprint-27` `2026-06-21` ✅ — Held pozisyon son ~1 ayda `m1 > %25` ise TickerDetailTab header altında gold-tinted nudge: "TICKER son ~1 ayda +%X büyüdü. Orijinal tezin hâlâ geçerli mi…". Per-ticker 30-gün sustur (`il_nudge_gain_<userId>`). `→ TickerDetailTab.js`

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

- [ ] **Investment Guide → Claude system prompt dönüşümü** `[S]` `[P2]` — `docs/guide/investment-guide.md` içeriğini tüm AI etkileşimlerinin felsefesi olarak `SYSTEM_PROMPT` constant'a dönüştür; `parse-transaction` zaten bu pattern'i kullanıyor.
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
  - [ ] (a) `target_prices` migration + RLS + TickerDetailTab "Hedef Fiyat" satırı `[S]`
  - [ ] (b) Watchlist row'unda hedef fiyat + uzaklık + kısa not gösterimi (eski "Watchlist'e niyet katmanı" item'ı buraya katıldı) `[S]`
  - [ ] (c) Bildirim/alarm tetikleyici — fiyat hedefe değdiğinde nudge veya email (Yaklaşan Etkinlikler Merkezi'ne feed) `[M]`
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
- [ ] **Portföy Performans Karşılaştırma (Anonim Leaderboard)** `[L]` `[P3]` — Opt-in; anonim getiri sıralaması; Faz 3 tamamlanınca anlamlı.

---

## Gamification & Başarı Sistemi

- [ ] **Yatırımcı Rozetleri (Başarı Sistemi)** `[M]` `[P3]` — Eşiklere ulaşınca rozet kazanılır: "İlk İşlem", "Çeşitlenmiş" (5+ asset_type), "Temettü Toplayıcı" (10+ DIV), "Uzun Vadeli" (1+ pozisyon 2Y+), "Değer Yatırımcısı" (P/E <15 olan 3+ pozisyon), "Disiplinli" (12 ay üst üste BUY). `profiles.badges` JSONB veya LS.

---

## Hesap Yönetimi

- [x] ~~**Canlı sistem için Ayarlar sekmesi revizyonu**~~ `[M]` `[P2]` `[PO+UX]` `Sprint-28` `2026-06-21` ✅ — Kullanıcı-odaklı IA: görünür bölümler (Hesap/Portföy/Görünüm/Veri/Araçlar/Geri Bildirim/Çıkış) + "Gelişmiş / Geliştirici" collapsible (bakım+veri+tanılama araçları katlı, silinmedi). Canlıda doğrulandı. `→ App.js` (commit `e12e171`)

- [x] ~~**Support & Feature Request iletişim altyapısı**~~ `[M]` `[P2]` `Sprint-28` `2026-06-21` ✅ — (a) seçildi: in-app form → Supabase `feedback` tablosu. `FeedbackSection` (Hata/Öneri + metin, RLS own-insert, `rls-empirical-tester` 14/14). Canlıda uçtan uca doğrulandı. `→ migration 20260621000000_feedback.sql, FeedbackSection.js` (commit `aba0cc5`)

- [x] ~~**Hesap ekranı genişletme**~~ `[M→S-M]` `[P2]` `Sprint-30` `2026-06-28` ✅ — **Scope düzeltmesi**: şifre/email (verifikasyonlu)/avatar/bio/username `AccountSection.js`'te zaten canlıydı; kalan tek iş = **hesap silme (cascade)** → App Store önkoşulu (Apple Guideline 5.1.1) kapandı. (1) `delete-account` edge fn (service_role `admin.deleteUser`, token-uid IDOR-safe, `--no-verify-jwt` + içeride JWT; `edge-reviewer` GO; deploy + e2e doğrulandı); (2) cascade kapsam denetimi — 9 user-scope tablonun hepsi `ON DELETE CASCADE`, `splits`+RESTRICT-FK senaryosu empirik teyitli, migration gerekmedi (`SCHEMA.md` matrisi); (3) Settings "Tehlikeli Bölge" kırmızı kartı — type-to-confirm "SİL" + `confirm_` danger + `clearUserLocalKeys`+`signOut`; `client-security-auditor` GO. `→ delete-account-edge-function.js, SCHEMA.md, AccountSection.js`

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

- [x] **`fetch-fundamentals` Analiz tab'da 422 dönüyor** `[S]` `[P1]` `Sprint-22` `2026-05-19` — Sprint 22 e2e test (2026-05-19) sırasında prod'da gözlemlendi. Root cause: BIST bankaları (GARAN, AKBNK, YKBNK, ISCTR, HALKB, VAKBN, ALBRK, QNBFB, TSKB, ICBCT, SKBNK) İş Yatırım XI_29 finansal şemasında yok (UFRS kapsam dışı); edge fn doğru bir şekilde 422 + Türkçe açıklama döndürüyor. Frontend `resilienceEligible` filtresi banka istisnasını uyguluyordu ama `healthEligible` (ve Supabase fund_cache mount fetch) uygulamıyordu — Portföy Sağlık otomatik fetch banka tickerlarını da hedefliyor, 422 üretiyor. Fix: `ISY_KNOWN_BANKS` sabiti modül seviyesine çıkarıldı, `isFundEligible(p)` helper'ı tüm eligibility checklerinde kullanıldı (mount LS init, Supabase fetch, healthEligible, resilienceEligible, onHealthSummary). `→ src/components/AnalysisTab.js`
- [ ] **AI parse kaydetme: `way` istemci doğrulaması eksik** `[S]` `[P2]` — CSV `BUY|SELL|DIV` normalize ediyor; AI parse yalnızca sayısal kontrol yapıp `way`'i insert ediyor. `saveTx`'e `way`/`asset_type`/tarih/para birimi doğrulaması ekle. `→ AddTab.js:73,79`
- [ ] **İşlem türü kart ikonları yeniden ele alınacak** `[S]` `[P1]` — AddTab asset type picker ikonları marka diliyle tam örtüşmüyor. Brand kit uyumlu SVG/logo yaklaşımı seçilecek.
- [x] **ManuelPosForm sadece USD pozisyonları listeler** `[S]` `[P2]` `Sprint-16` ✅ — `shares > CFG.DUST_THRESHOLD` filtresi; currency sembolü otomatik (₺/€/$).
- [x] **EUR tablosu sıralanamıyor** `[S]` `[P2]` `Sprint-16` ✅ — `sortEur` state + Ticker/Toplam sütunları tıklanabilir; ↑↓ ikonu.

### Tasarım Tutarsızlıkları

- [x] ~~**Kart padding standart dışı**~~ `[S]` `[P2]` `Sprint-25` `2026-06-09` ✅ — `--card-pad:14px 16px` token tanımlandı (`:root`); baskın `14px 16px` section-card padding'i (18 inline override, TickerDetail/Analysis/App) token'a bağlandı — değer aynı, görsel regresyon yok. Dense `.card` base (`12px 14px`) bilinçli olarak token'dan ayrı kaldı. Kalan off-token paddingler (`16px 18px` Dashboard KPI vb.) görsel onay gerektirdiği için ileriye bırakıldı. `→ index.html; CONVENTIONS.md`
- [ ] **Spinner boyut karmaşası** `[S]` `[P2]` — CSS `.spin` 18×18; inline'da 11/12/14px karışık. `--spin-sm:12px` + `--spin-md:16px` değişkenleri. (Bug&UX'teki "Spinner boyut standardı" duplicate'i buraya katlandı.)
- [ ] **Yükleniyor metin standardı** `[S]` `[P2]` — `"..."`, `"Kaydediliyor..."`, `"Parse ediliyor..."` karışık. Kural: kısa buton → spin icon; uzun metin buton → standart Türkçe metin.
- [ ] **`.stitle` marginBottom inline override'ları** `[S]` `[P3]` — `data-tight`/`data-loose` modifier class ekle; aksi halde inline'ları kaldır.
- [ ] **`CUR_COLORS` `TYPE_COLORS` ile çakışıyor** `[S]` `[P2]` — AnalysisTab Kur Riski: `USD:"#0a84ff"` (FUND rengi) anlamsız. `TYPE_COLORS.US_STOCK` daha semantik. `→ AnalysisTab.js:~3989`

### Boş Durum & Mikrokopi

- [x] **TickerDetailTab "işlem yok" div.dim** `[S]` `[P3]` `Sprint-23` `2026-05-25` — `.empty-card` (📋 + ttl + sub) pattern'e dönüştürüldü; padding HistoryTab section-level empty pattern'e hizalandı. `→ TickerDetailTab.js:1027`
- [x] **AnalysisTab grafik alanları `.empty` sınıfı** `[S]` `[P3]` `Sprint-23` `2026-05-25` — `index.html:173` `.empty` rule'una "in-card subsection placeholder, distinct from .empty-card" comment eklendi. AnalysisTab 8 `.empty` lokasyonu (lines 917/974/1237/1298/1309/1347/1435/1658) kasıtlı olarak korundu — full-section empty değil.
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
- [x] **`scripts/check-edge.sh`'a `deno check` adımı ekle** `[S]` `[P2]` `2026-05-31` ✅ — Conditional gate eklendi: Deno PATH'de varsa `deno check <fn>` her edge fn için çalışır, yoksa "deno not installed — install: brew install deno" warning'i basılır + node-only flow korunur. Forward-compatible: Can `brew install deno` çalıştırınca strict ESM gate kendiliğinden devreye girer. Detay: `Lessons.md` 2026-05-19 entry. `2026-06-04` follow-up: repo-root `deno.json` + import map eklendi (npm dep'leri pin'li, `checkJs:false`); gate config'i deterministik hale getirildi.
- [ ] **`deno.lock` commit et (offline-safe edge gate)** `[S]` `[P3]` — `deno check` ilk çalıştırmada `npm:` dep'leri network'ten indirir; offline/CI'da yeşil node gate'ini kırmızıya çevirebilir. `brew install deno` sonrası `deno cache *-edge-function.js` ile lock üret + commit et. Detay: `Lessons.md` 2026-06-04 entry.

### Brand Fit & Jargon Temizliği (Grup A/B — Sprint-15 kapsamı)

- [x] ~~**Finans jargonunu Türkçe kullanıcı diline çevir**~~ `[S]` `[P1]` (2026-05-13) — `Total Return → Toplam Getiri`, `Benchmark → Karşılaştırma`, `Trade → İşlem`, `XIRR → Yıllık Getiri` (detayda XIRR), `P/E/P/S → F/K/F/S`; 9 yer güncellendi.
- [x] **Karmaşık kartlara önce sonuç cümlesi ekle** `[S]` `[P1]` `Sprint-19` `2026-05-15` — Tamamlandı: Portföy Sağlık, Konsantrasyon Riski, Kur Riski kartlarında tek satırlık sinyal-renkli verdict cümlesi canlıda. 7 commit `4d57b4c..9ca62f5`. Dayanıklılık kartı Sprint 20'ye (skor bağımlılığı). Spec: `docs/superpowers/specs/2026-05-15-analysis-card-verdicts-design.md`, plan: `docs/superpowers/plans/2026-05-15-analysis-card-verdicts.md`.
- [x] ~~**Formülleri ekrandan kaldır**~~ `[S]` `[P1]` (2026-05-13) — `HHI= Σ(ağırlık²) × 10000`, skor formülleri, `FUND_THRESHOLDS` string metinleri kaldırıldı; sonuç değerleri + açıklayıcı tooltip kaldı. `→ AnalysisTab.js:1290,1943,1126`
- [ ] **Boş durum metinlerini kullanıcı diline çevir** `[S]` `[P2]` — `"snap. yok"` → `"Veri henüz oluşmadı"`; `"Bilinmiyor"` sektör → `"Henüz sınıflandırılmadı"`.
- [ ] **"Potansiyel Kayıp Simülasyonu" → "Senaryo Analizi" veya "Stres Testi"** `[S]` `[P2]` — Daha az korkutucu framing; renk nötrleştirme. `→ AnalysisTab.js:1371`
- [ ] **Potansiyel Kayıp Simülasyonu — altın pozisyonlarını filtrele** `[S]` `[P2]` — "Piyasa −%10/20/30" GOLD tipi pozisyonları kapsamalı mı? (a) `type!=='GOLD'` filtresi + "Hisse & Fon Değeri" alt başlığı, veya (b) footnote ile açıkla.
- [ ] **Başa Baş "Uzaklık" kolonuna tooltip ekle** `[S]` `[P2]` — `data-tip="Güncel fiyatın başa baş noktasına yüzde uzaklığı. Pozitif = kâr bölgesinde."` `→ AnalysisTab.js:1333`
- [x] ~~**AnalysisTab Özet / Detay iki katmana bölünsün**~~ `[L]` `[P2]` `Sprint-23` `2026-05-22` — Root `<div>` flex-column; kartlar CSS `order` ile konumlanır. Özet katmanı (order 10–16, default görünür): Varlık/Bölge/Sektör Dağılımı, Aylık Özet, 6 Aylık Performans, Kur Riski, Temettü Özeti. "Detaylı Analiz" toggle (`detailOpen`, order:20) altında Detay katmanı (order 30–37, `display:none` ile gizli): Portföy Sağlık, Konsantrasyon/HHI, Başa Baş, Potansiyel Kayıp, Kazanan/Kaybeden, Dönem Bazlı Getiri, Dayanıklılık, Toplam Komisyon. `fund_cache` lazy-fetch yalnız Detay açıkken (`useEffect` deps `[pos,detailOpen]`). Eski 4 bölüm başlığı kaldırıldı. Playwright doğrulandı: Detay kapalıyken 0 `fund_cache` isteği, toggle'da 1. `→ src/components/AnalysisTab.js`
- [ ] **Toplam Komisyon kartını AnalysisTab'dan taşı** `[S]` `[P2]` — Settings → İşlem Geçmişi altı veya "Maliyet Özeti" bölümü daha anlamlı.
- [ ] **Konsantrasyon Riski — HHI sonucu → trafik ışığı + cümle** `[S]` `[P2]` — "Konsantrasyon: Yüksek" pill + cümle yeterli; HHI sayısı detay/tooltip'e.
- [x] ~~**Fundamental Checklist'i şirket özeti + detay modeline çevir**~~ `[M]` `[P2]` `Sprint-25` `2026-06-09` ✅ — TickerDetailTab checklist'in üstünde plain-language özet satırı ("🟢 Kârlılık güçlü · 🔴 Borç yüksek · 🔴 Değerleme pahalı"). 7 `FUND_GROUPS` başlığı → 4 segmente (`FUND_SUMMARY_MAP`: Kârlılık/Büyüme/Borç/Değerleme) deterministik map; `buildFundSummary` mevcut `fundScore` grade'lerinden rollup (avg good=1/neutral=.5/bad=0 → iyi≥.66/orta≥.4/zayıf). Yeni eşik yok. US_STOCK+BIST; `fund_cache` boşsa gizli. Detay gruplar aynen altta. `→ src/components/TickerDetailTab.js`
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
- [ ] **`refresh-price-cache-6h` pg_cron secret'ını vault-okumaya migrate et** `[S]` `[P2]` — Sprint 22 bulgusu: `refresh-price-cache-6h` job command'ında `Authorization` header'a `Bearer <CRON_SECRET>` **literal string** olarak hardcoded yazılı. Secret rotation iki ayrı noktada (Edge Functions secret store + `cron.job.command` SQL) güncelleme gerektiriyor; Management API `/secrets` ile pg_cron literal'i diverge edebilir. `refresh-fund-cache-weekly` doğru pattern'i kullanıyor: `'Bearer ' || (SELECT value FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')`. `refresh-price-cache-6h` job'ı bu vault-okumalı forma migrate et — rotation tek noktaya iner. Detay: `Lessons.md` 2026-05-19 entry.

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
- ~~FMP `/stable/discounted-cash-flow` ücretsiz tier'da mı?~~ → ✅ Evet, free tier'da çalışıyor (2026-05-21 test). US hisseleri HTTP 200; BIST tickerları HTTP 402 (premium) — DCF feature US_STOCK kapsamında yapılabilir.
- Resend API ücretsiz tier limiti nedir? → Haftalık özet email + hedef fiyat alarmı için
- `portfolio_snapshots` tablosu ne zaman devreye girmeli? → Sparkline geçmişi + haftalık email önkoşulu

---

## Sonraki Adım

Sprint 4–24 ✅ | Sprint 24 = TEFAS Yatırım Fonu Entegrasyonu ✅ kapandı (2026-06-05 — 3509 fon canlıda, NAV doğrulandı); retro `sprints/sprint-24.md`.

**Sprint 25 = Değerleme Okunabilirliği ✅ KAPANDI** (2026-06-05 → 2026-06-18) — 3 kapsam işi de kodlandı + canlıya deploy edildi (commit `fe3e16a`). Tek carry-over: canlı `fund_cache` verisiyle render göz doğrulaması → Sprint 26 başında. Plan + delivery: `sprints/sprint-25.md`.
1. ✅ **Fundamental Checklist → özet + detay modeli** `[M][P2]` — TickerDetailTab plain-language sinyal-renkli özet; `FUND_SUMMARY_MAP` + `buildFundSummary` rollup. `→ TickerDetailTab.js`
2. ✅ **Ağırlıklı portföy F/K KPI + S&P 500 karşılaştırma** `[S][P2]` — AnalysisTab Portföy Sağlık 3-durumlu cümle + kapsam notu + <%60 kısmi-veri uyarısı. `→ AnalysisTab.js`
3. ✅ **Polish — Design audit Phase-2 kalanı** `[S×2][P2]` — #7 `--card-pad` token; #9 tooltip tek `data-tip` pattern + global touch fallback. `→ index.html`

---

**Sprint 26 = Karma: TEFAS sparkline + ilk davranışsal nudge** (2026-06-19 → 2026-07-02) — **🚧 DEVAM EDİYOR**. Plan + spike sonucu: `sprints/sprint-26.md`.

**Goal**: TEFAS fonları artık "kör nokta" değil — Can her TEFAS fonunun son ~6 ayın NAV trendini sparkline'da görür, Dashboard'da günlük/haftalık değişimini diğer varlıklar gibi okur; ayrıca portföyü bir günde sert düştüğünde tezini sorgulatan ilk davranışsal nudge devreye girer.

**Sprint 26 durumu (2026-06-21) — ✅ KOD + EDGE TAMAM, canlı eyeball push sonrası:**
- ✅ **Spike yeşil** — TEFAS NAV zaman serisi `periyod=12` ile çalışıyor (252 nokta, tek fetch tüm `p_*` delta'ları besliyor). Detay: `sprints/sprint-26.md` "Spike Sonucu".
- ✅ **#1 TEFAS historical NAV + sparkline** `[M][P2]` (headline) — `refresh-price-cache` `fetchTefasHistorical` (`periyod=12` → price + d1/w1/m1/y1 + p_* + 52w) **deploy edildi (v19)**; `edge-reviewer` GO; smoke test 200/0-fail; YAC delta alanları doğru doldu. TickerDetailTab `TefasNavSparkline` kodlandı (parse yeşil); veri yolu gerçek JWT'yle doğrulandı (124 NAV noktası). Kalan: canlı görsel eyeball (CORS → yalnız production). `→ fetch-prices, refresh-price-cache, TickerDetailTab.js, App.js`
- ✅ **#2 Piyasa düşüş nudge'ı** `[S][P2]` (filler) — `computeNudges`'a eklendi (MV-ağırlıklı günlük ≤ -%5 → P0 nudge). Yeni LS key gerekmedi: gün-damgalı id (`market_drop_YYYY-MM-DD`) mevcut `il_nudge_dismissed` makinesiyle aynı gün susar, ertesi gün yeniden görünür. Logic unit-test edildi. `→ utils.js (computeNudges)`

**Out of scope (Sprint 26)**: diğer Layer-2 nudge'ları (büyük kazanç tez-kontrol, SearchTab FOMO) → Sprint 27; TEFAS fundamentals (veri yok).

**Kalan (push sonrası, canlıda eyeball)**: YAC sparkline + Dashboard TEFAS günlük % badge; Sprint 25 carry-over (F/K cümlesi + fundamental özet satırı). Hepsi edge-bağımlı → localhost CORS nedeniyle yalnız `canmrtr.github.io`'da doğrulanır.

---

**Sprint 27 = Layer-2 nudge derinleşme: kazanç tez-kontrolü + FOMO badge** (2026-06-21'de erken kapandı; planlı pencere 07-03 → 07-16) — **✅ KAPANDI, canlıda doğrulandı**. Commit `a238d2c`. Plan + retro: `sprints/sprint-27.md`.

**Goal**: Davranışsal koç (Katman 2) tek nudge'dan sisteme dönüştü — kayıp (Sprint 26) + kazanç + arama-FOMO üç bağlamda karar sürtünmesi. Hepsi mevcut `price_cache`, yeni fetch yok.
1. ✅ **Büyük kazanç tez-kontrol nudge'ı** `[S][P2]` — held + `m1 > %25` ise TickerDetailTab header altında gold-tinted nudge; per-ticker 30-gün sustur (`il_nudge_gain_<userId>`). **Canlıda doğrulandı** (GARAN m1=35 bump → nudge + dismiss çalıştı → restore). `→ TickerDetailTab.js`
2. ✅ **SearchTab FOMO badge'i** `[M][P2]` — `hist[ticker].m1 > 30` ise `🔥 +%X` pasif badge + tooltip; yalnız cache'te olan ticker'larda (O(1), dismiss yok). App `hist` prop geçirir. **Canlıda doğrulandı** (GARAN satırında 🔥 +35.0%, diğer sonuçlar temiz). `→ SearchTab.js, App.js`

**Tasarım kararı**: #2 "banner" yerine inline `🔥` badge — liste-satırında pasif-bilgilendirici, panik yaratmaz, ölçeklenir (plan "dismiss edilebilir VEYA pasif-bilgilendirici" diyordu). Eşikler: #1 %25, #2 %30. Üç nudge üç yüzeyde ayrı (tek-util'e zorlanmadı — bkz. `sprints/sprint-27.md` DRY notu).

---

**Sprint 28 = Going-live hazırlığı: Ayarlar revizyonu + Support kanalı** (2026-06-21'de kapandı) — **✅ KAPANDI (3/3 + stretch dahil)**. Plan + retro: `sprints/sprint-28.md`.

**Goal**: Uygulama "kişisel araç"tan "başkasına verilebilir ürüne" yaklaşır — kullanıcı yardım isteyebilir/özellik talep edebilir, ve Ayarlar geliştirici-bakım paneli değil kullanıcı-odaklı kontrol gösterir.
1. ✅ **Ayarlar sekmesi revizyonu** `[M][P2][PO+UX]` — kullanıcı-odaklı IA: Görünür (Hesap/Portföy/Görünüm/Veri/Araçlar/Geri Bildirim/Çıkış) + "Gelişmiş / Geliştirici" collapsible (Tarihi Veri, TEFAS Katalog, Bağlantı Test, Pozisyon Yeniden Hesapla, Split Senkronize, Sistem Durumu). Hiçbir şey silinmedi. **Canlıda doğrulandı** (commit `e12e171`). `→ App.js`
2. ✅ **Support & Feature Request kanalı** `[M][P2]` — `feedback` tablosu (RLS own-insert/select, `rls-auditor` PASS + `rls-empirical-tester` 14/14, grant-hardening) + Settings `FeedbackSection` (Hata/Öneri + metin → insert). **Canlıda uçtan uca doğrulandı** (test feedback insert→DB→cleanup; commit `aba0cc5`). `→ migration 20260621000000_feedback.sql, FeedbackSection.js`
3. ✅ **AddTab tez checklist nudge'ı** `[S][P2]` — tip seçildikten sonra (CASH/DEPOSIT hariç) pasif gold-tinted tez hatırlatması; kalıcı dismiss (`il_nudge_thesis`). **4. ve son Layer-2 nudge → davranışsal nudge sistemi tamam** (kayıp/kazanç/FOMO/yeni-pozisyon). `→ AddTab.js`

**Karar verildi**: Support kanalı = (A) in-app form → Supabase `feedback` (Can onayı 2026-06-21).
**Bonus fix**: SW shell cache v3→v4 bump (commit `2d911a7`) — index.html değişince cache-first stale shell bug'ı (FeedbackSection script tag yüklenmiyordu); GOTCHAS kuralı uygulandı.

---

**Sprint 29 = Altın işçilik premium + Reşat/Ata birimleri** (2026-06-22 → 2026-07-05) — **📋 PLANLANDI**. Plan: `sprints/sprint-29.md`.

**Goal**: Altın (portföyün %41'i, en büyük + en kör dilim) — Can her altın pozisyonunun saf değerini + ödediği primi görür. Mevcut `GOLD_UNITS`/`goldOzPerUnit`/XAU spot altyapısı %80 hazır.
1. ⬜ **TR altın işçilik premium göstergesi** `[M][P2]` (headline) — held GOLD (oz/gram hariç) için "Saf altın değeri ₺X · Ödenen ₺Y · Prim %Z". **Risk-first spike**: premium tanımı (tarihsel spot yok → (A) güncel-spot deltası / (B) eğitimsel yapısal / (C) historical=out-of-scope). `→ utils.js, TickerDetailTab/Dashboard`
2. ⬜ **GOLD_UNITS'e Reşat + Ata Lirası** `[S][P2]` (filler) — birim picker'da eksik; aynı dosya, headline'ı tamamlar. `→ utils.js (GOLD_UNITS)`

**⚠ Açık karar (spike)**: premium tanımı (A/B/C) — detay `sprints/sprint-29.md`.

**Sprint 29 = Altın işçilik premium — ⏸ PARK EDİLDİ (2×)**. İlk park 2026-06-28 (Sprint 30 önceliği); **2. park 2026-07-08 spike sonrası**: risk-first spike Can'ın canlı GOLD pozisyonlarının **hepsinin ons külçe olduğunu** buldu (sikke yok) → işçilik primi feature'ı oz/gram'ı hariç tuttuğu için Can'ın portföyünde hiçbir şey göstermez. Premise geçersiz. Sikke eklenmesi / (B) külçe reframe'i tetikleyebilir. Detay: `sprints/sprint-29.md` "Spike Sonucu".

---

**Sprint 30 = Hesap Silme (Cascade) — App Store önkoşulu** (2026-06-28 → 2026-07-11) — **✅ KOD TAMAM (3/3), canlı UI eyeball push sonrası**. Plan: `sprints/sprint-30.md`.

**Goal**: Kullanıcı hesabını tamamen silebilir — tüm verisi geri dönüşsüz temizlenir + `auth.users` kaldırılır; Apple Guideline 5.1.1 zorunluluğu kapanır.

> **Scope düzeltmesi**: "Hesap ekranı genişletme"nin şifre/email/avatar/username parçaları `AccountSection.js`'te **zaten canlıda**. Kalan tek iş = hesap silme. Item `[M]` → fiilen `[S-M]`.

1. ✅ **`delete-account` edge function** `[S][P2]` (headline) — service_role `admin.deleteUser`; token-uid (IDOR yok); `--no-verify-jwt`+içeride JWT; `edge-reviewer` GO; **deploy + e2e doğrulandı** (no-token→401, GET→405, valid→200, full cascade). `→ supabase/functions/delete-account` (commit `9c9fe4f`)
2. ✅ **Cascade kapsam denetimi** `[S][P2]` — 9 user-scope tablo hepsi CASCADE; `splits`+RESTRICT-FK empirik teyitli; **migration gerekmedi**; `SCHEMA.md` kapsam matrisi. `→ SCHEMA.md` (commit `9c9fe4f`)
3. ✅ **Settings "Tehlikeli Bölge" UI** `[S][P2]` — en altta kırmızı kart; type-to-confirm "SİL" + `confirm_` danger + `clearUserLocalKeys`+`signOut`; `client-security-auditor` GO + 2 hardening. `→ AccountSection.js`

**Out of scope**: soft-delete/geri-al, silme onay e-postası (Resend), avatar resim upload, altın premium (Sprint 29 park).
**Kalan**: canlı UI eyeball (push sonrası `canmrtr.github.io` — kırmızı kart + type-to-confirm guard).

**Sprint 31 = Görselleştirme polish** (2026-07-08 → 2026-07-21) — **📋 PLANLANDI**. Plan: `sprints/sprint-31.md`. (Can seçti 2026-07-08; premise-check: broker verisi zengin/gerçek.)

**Goal**: Günlük dashboard/analiz daha okunur — aracı kurum dağılımı tek bakışta, sparkline'da tarih/değer, filtre bar scroll'da sabit. Frontend-only, yeni veri/edge yok.
1. ⬜ **Broker Dağılımı Pie** `[S][P2]` (headline) — AnalysisTab collapsible; `positions.broker` MV-ağırlıklı; **case-insensitive** (QNB/Qnb tek dilim) + boş→"Atanmamış"; `buildSlicesPath`+`.pie-row` reuse. `→ AnalysisTab.js`
2. ⬜ **Sparkline hover tooltip** `[S][P2]` — Dashboard sparkline hover'da tarih+değer + dikey kılavuz; `TefasNavSparkline` pattern referans. `→ App.js`
3. ⬜ **Sticky `.fbar`** `[S][P2]` — Dashboard filtre bar `position:sticky; top:--topbar-h`. `→ index.html, App.js`

**Out of scope**: pie→stacked bar migrasyonu, segment selection, broker DB merge (yalnız görüntüde normalize), gerçek tarihsel MV sparkline.

**Sprint 32+ aday havuzu (her sprint başında gözden geçir):**

1. **Bağlamsal Mikro Öğrenme Katmanı** `[M][P1]` — en yüksek öncelik etiketli başlanmamış item; inline kavram açıklamaları (F/K, XIRR); Katman 3 köprüsü. (2026-07-08 aday olarak sunuldu.)
2. **Satılan Pozisyon Realized P&L Özeti** `[M][P2]` — yıl bazlı kapatılmış-pozisyon kâr/zarar; aktif trader için somut. (2026-07-08 aday.)
3. **Altın işçilik premium (Sprint 29 park 2×)** `[M][P2]` — sikke altın eklenirse VEYA külçe "spot vs ödenen" reframe'i ile tetiklenir; plan hazır (spike premise'i çürüttü).
4. **"Tam Detay" gerçek tam-detay render** `[M][P2]` — Social Faz 2 bağımlısı; tek başına değersiz.
5. **Altın gerçek tarihsel işçilik (C)** `[L][P3]` — alım-tarihi XAU spot fetch; ancak sikke altın varsa anlamlı.
