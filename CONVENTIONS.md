# Portfoi — Kod Konvansiyonları & Veri Modelleri

CLAUDE.md'nin "Önemli Konvansiyonlar"ından ayrılan operasyonel kurallar. Yeni kod/UI yazmadan önce ilgili bölümü oku. UI işi için ayrıca `ui-builder` skill'i.

## Tasarım sistemi

> Tüm marka & tasarım dokümantasyonu için tek giriş noktası: **`docs/brand/README.md`**. Brand kit (`docs/brand/brand-kit.md`), design system (`docs/brand/design-system.md`), design audit, logo asset path'leri, generation script'leri ve `src/styles/tokens.css` token katmanı oradan indekslenir. Ürün dili/ilkeleri → `docs/strategy/product-brief.md`. UI işine başlamadan önce oraya bak.

Sık başvurulan operasyonel kurallar (quick-ref):
- **Tema**: dark (default) + light (`[data-theme="light"]`).
- **Dark renk tokenleri**: `--bg #000` / `--bg2 #0c0c0c` / `--bg3 #141414` / `--bg4 #1c1c1c`; `--text #f0ede8`, `--text2 #b8b8b8`, `--text3 #888888`; `--info #C9A84C` (Portfoi Gold), `--ok #00d97e`, `--err #ff3366`, `--warn #ffb800`; `--on-accent #0D1117` (gold dolgu üzeri metin/ikon — gold açık olduğu için near-black, ≈8.4:1); `--border rgba(255,255,255,0.06)` 1px solid; `--border2 rgba(201,168,76,0.28)`.
- **Light tema** (detay: `docs/brand/brand-kit.md` Section 7): `--bg #F5F3EE` (Arctic) / `--text #0D1117` (Midnight) / `--info #8A6A1F` (Gold Muted) / `--on-accent #ffffff` (light gold koyu olduğu için beyaz, ≈5.0:1). İkon ve border gold her iki temada aynı kalır.
- **Gold dolgu üzeri metin**: gold zeminli öğeler (`button.pri`, `.btn-pri`, `.mtab.on`, `.login-logo`) **`color:var(--on-accent)`** kullanır — `#fff` hardcode etme (dark temada gold üzeri beyaz kontrast düşük).
- **Font**: `DM Serif Display` (hero sayılar/başlıklar) + `DM Sans` (body 300-700) + `DM Mono` (sayılar/ticker). `--font-display`/`--font-body`/`--font-numeric` CSS değişkenleri. `.lbl`/`.stitle`/`.kk`: 10px uppercase `font-weight:500`.
- **Aktif sekme**: pill `rgba(201,168,76,0.12)`, alt çizgi yok. **FAB**: 54px, `var(--info)` (gold), `bottom:76px`. **Dashboard hero**: Piyasa Değeri değeri 32px `var(--font-display)`.
- **Kod içi font kullanımı**: inline style'larda hardcoded font string yok — `fontFamily:"var(--font-display)"` / `fontFamily:"var(--font-numeric)"` kullan.
- **Logo path özeti** (tüm detay `docs/brand/README.md`'de):
  - Aktif wordmark: `Logo/new/portfoi-wordmark-{dark,light}.png` — Login 120px height, Topbar `.topbar-wordmark` 36px (mobilde gizli).
  - Tema CSS: `.theme-logo-dark`/`.theme-logo-light` — `[data-theme="light"]` ile otomatik geçiş.
  - Kaynak SVG: `Logo/portfoi-icon.svg` → PWA icons + favicon `scripts/generate-pwa-icons.mjs` ile.
  - Legacy (rollback): `Logo/legacy/` altında.

## Para & formatlama
- `displaySym(cur)`: USD→`$`, TRY→`₺`, EUR→`€`
- `fmt(n,d=2)`, `fmtD(n)` (±$ USD only), `fmtSign(n,sym)` (currency-aware ±), `fmtP(n)` (±%), `fmtShares(n)`
- Gizli mod: `mask()` → `••••`. Display Currency: topbar toggle $/₺; KPI+Pie+Analiz convert, pozisyon blokları natural currency'de.
- **BIST için `fmtD` kullanma** — hardcoded `$` döner; `fmtSign(n, sym)` kullan.
- **`priceCur` kuralı** (para-değer hesaplarının canonical kaynağı) → `FEATURE_DETAILS.md` "Currency Handling". Kısa hali asla kopyalama; oradan al.

## Tarih
- Storage: ISO `YYYY-MM-DD`. Görüntü: `DD/MM/YYYY` (`fmtDateTR`). Input: `<input type="date">`.

## CSS sınıfları
- **Buton katmanları (Sprint 21):** `.btn-icon` (square icon-only, 28×28 desktop / 36×36 mobile) < `.btn-xs` (11px) < `.btn-sm` (11px, 30px min-height) < `.btn-md` (12px, 34px min) < `.btn-pri` / `button.pri` (12px gold CTA, 38px min). `@media(max-width:640px)`: `.btn-xs/.btn-icon/.btn-sm` 36×36 min, dense table/pos-row için 8/10 padding. Inline `<button style="...">` yerine bu sınıfları tercih et. Icon-only emoji/sembol butonlar (✎, ×, 💰, ↻) **`.btn-icon`** + `aria-label` + `data-tip`.
- **`.link-btn`** (Sprint 22, design audit): transparent inline button gold text — login mode toggle, "devamı / daha az", "Temizle" gibi link-stil tekstler. `.link-btn.sm` 12px varyant.
- **Form grid'leri:** `.form-grid-2` / `.form-grid-3` — ≤640px tek kolona çöker. Inline `gridTemplateColumns` yerine bu sınıfları kullan (ManuelPosForm, TickerDetailTab quick-add/edit, HistoryTab edit row, AnalysisTab metric grid için).
- **`.type-picker-grid`** (Sprint 22): AddTab asset-type cards; `auto-fit minmax(150px,1fr)` desktop, `1fr 1fr` ≤480px.
- **`.metric-mini`** (Sprint 22): `bg4` flat KPI card 10×12; içinde `.lbl` (üst) + `.val` (numeric 15/700). AnalysisTab Aylık Özet, custom metric pill için.
- **`.inline-alert.err / .ok`** (Sprint 22): form/section scoped flow-positioned alert. `.flash`'ı form içinde inline kullanma — `.inline-alert` kullan (parse errors, validation summaries, in-form feedback).
- **Tablet breakpoint (Sprint 22, 641–880px):** `.topbar-nav .tab` compact, `.topbar-freshness` gizli, `.topbar-wordmark` 36→32 height. Topbar overflow'unu önler.
- `.btn-xs/sm/md`, `.btn-danger-out`, `.finp`/`.finp.sm`, `.empty-card` (`.ic` + `.ttl` + `.sub` + CTA), `.warn-card`, `.cbox`
- `.pos-row`, `.badge.etf/cry/split/stale`, `.mdl-bd/bx`, `.seg`, `.mtab`, `.pie-row/pie-sw`, `[data-tip]`
- `.theme-logo-dark`/`.theme-logo-light` — `[data-theme="light"]` ile otomatik logo geçişi; `.delta-pos`/`.delta-neg` — yeşil/kırmızı delta badge sınıfları
- `.topbar-wordmark` — topbar sol wordmark butonu (Login.js olmayan tek logo placement). Mobilde gizli.
- **`.pie-row`**: `flex:"0 0 70px"` ($) + `flex:"0 0 56px"` (%) sabit basis; label `flex:1,minWidth:0`. `minWidth` yetmez, truncate/ellipsis ekleme.
- **`.fbar`**: `overflow-x:auto; scrollbar-width:none`; `.fbar .mtab`: `flex:0 0 auto; white-space:nowrap`. Wrapper'da `flexWrap:wrap` kullanma.

## Edge çağrı yardımcıları
- `edgeCall(fn, body)` — anon key ile çağırır; `fetch-prices` için **kullanma**.
- `edgeCallAuth(fn, body)` — kullanıcı JWT'si ile çağırır; session yoksa yerel `401 Response` döner (anon fallback yok).
- `edgePriceCall(body)` — `edgeCallAuth("fetch-prices", body)` kısayolu; tüm `fetch-prices` çağrıları bu yardımcıyı kullanmalı.

## ManuelPosForm davranışı
- `savePos`: tx insert → `rebuildPositions` (atomik RPC) → `loadData`. Manuel upsert yok.
- `delPos`: tüm transaction'ları sil → `rebuildPositions` → `loadData`. Sadece position row'u silmez; confirm dialog `danger:true`.

## CASH / DEPOSIT / BES pozisyon modeli
- **CASH**: `shares=bakiye, avg_cost=1.0`; `prc[ticker]=1.0` (synthetic, fetch yok). P&L daima 0.
- **DEPOSIT**: `shares=anapara, avg_cost=1.0, interest_rate=yıllık (ör. 0.42), reserve_ratio=rezerv fraksiyonu (ör. 0.10), maturity_date=opsiyonel`; `prc[ticker]=(anapara+brütFaiz)/anapara` günlük bileşik.
- **BES**: `shares=1, avg_cost=kişisel_yatırılan_tutar (X)`; `dk_principal=DK anaparası (Y), dk_current=DK güncel (Y+Y_g)` (her ikisi de nullable — eski pozisyonlar için); `prc[ticker]=total (X+X_g + Y+Y_g)` aylık güncellemede `bes_update_atomic` RPC ile yazılır (positions.dk_current + price_cache aynı transaction). ManuelPosForm ilk-oluştur akışı hâlâ `set-manual-price` mode'unu kullanır, fakat artık server-side BES-only + ownership guard'lı. Kişisel güncel = `prc[ticker] − dk_current`. ManuelPosForm 4 alan: Kişisel Yatırılan, Kişisel Güncel, DK Anaparası, DK Güncel. TickerDetailTab: BES Özeti kartı 7 satır iki bölümde gösterir (`isBes` dalı).
- `fetchPrices/fetchHist` dışı — `prc` `loadData`'da `setPrc_` ile synthetic inject edilir (`src/components/App.js:loadData`).
- `rebuildPositions(userId, pid, extraMeta)` — `extraMeta={[ticker]:{interest_rate,maturity_date,reserve_ratio}}` ilk BUY kayıtta geçilir; sonraki rebuild'lar DB snapshot ile restore eder.
- Brüt faiz: `computeDepositGrossInterest()` (App.js modül seviyesi, component dışı); stopaj sabit: `DEPOSIT_TAX_RATE=0.175`.
- **Çekim**: SELL tx (`shares=çekilen tutar, price=1.0`); piecewise hesap tüm BUY/SELL segmentlerine göre çalışır.
- Dashboard'da net P&L% (stopaj sonrası) ve brüt/net faiz breakdown gösterilir.

## CFG sabitleri
`RATE_LIMIT_MS=7500`, `DUST_THRESHOLD=0.0001`, `CSV_BATCH_SIZE=50`, `FLASH_MS=3500`

## Renk paleti (TYPE_COLORS)
`US_STOCK:#8B5CF6`, `FUND:#3B82F6`, `CRYPTO:#06B6D4`, `BIST:#F97316`, `GOLD:#C9A84C`, `FX:#10B981`, `BES:#EC4899`, `TEFAS:#84CC16`, `CASH:#64748B`, `DEPOSIT:#6366F1`

## Brand kit token dosyası
`src/styles/tokens.css` — tüm brand kit CSS custom property'leri (category colors, badge tokens, component tokens, extended palette). Kaynak: `docs/brand/brand-kit.md`. `index.html`'deki mevcut `--bg/--text/--info/--font-*` tokenleri tekrarlanmaz.

## Flash & Confirm
- `flash_(msg, "ok"|"err")` — 3.5 sn otomatik kapanır.
- `confirm_(msg, {okLbl, cancelLbl, danger})` — **async/await gerekir**. `window.confirm` kullanma.
- `flash_`/`confirm_`/`loadData`/`mask` App.js iç closure'ları, **global değil** — alt component'e prop olarak geç (bkz. GOTCHAS). `sb`/`edgePriceCall`/`fmt*` globaldir.

## Dil
- UI + flash + error: **Türkçe**. Commit: **İngilizce** + Co-Authored-By trailer.
