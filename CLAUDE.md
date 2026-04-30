# Investment Ledger

Tek dosyalı React + Supabase kişisel yatırım takip uygulaması. Türkçe UI.

## Mimari

- **Frontend**: `index.html` — React 18 UMD + Babel Standalone (tarayıcıda JSX).
  Build adımı yok; CDN script'leri. GitHub Pages'e doğrudan deploy (`main` branch root).
  Live URL: `https://canmrtr.github.io/Investment-Ledger/`
- **Backend**: Supabase (auth, PostgreSQL, RLS, Edge Functions, pg_cron).
- **Edge Functions** (Supabase'te deploy'lu, hepsi `--no-verify-jwt`; kaynağı referans olarak repo'da):
  - `parse-transaction-edge-function.js` — Claude Haiku 4.5 ile metin/görüntü → `{transactions:[...]}` array (multi-line destek)
  - `fetch-prices-edge-function.js` — Multi-provider router: Massive (US/FX/Crypto/GOLD), Yahoo Finance (BIST price/historical), Twelve Data + borsa-mcp (BIST meta paralel merge)
  - `refresh-price-cache-edge-function.js` — Scheduled (pg_cron 6h), `price_cache`'i stale-first batch ile tazeler
  - `fetch-fundamentals-edge-function.js` — FMP `/stable/` + SEC EDGAR fallback (US); İş Yatırım MaliTablo (BIST, `asset_type:"BIST"`); 21 metrik. Ek mode: `mode:"ticker-list"` → SEC EDGAR (US, ~10.348) + Twelve Data /stocks XIST (BIST, ~636) merged ticker DB

- **Secrets** (Supabase Edge Function env, `Deno.env.get(...)`):
  - `MASSIVE_KEY` — Polygon clone (US/FX/Crypto/GOLD)
  - `FMP_KEY` — Financial Modeling Prep (US fundamentals)
  - `TWELVEDATA_KEY` — BIST reference + ticker list
  - `ANTHROPIC_KEY` — Claude API (parse-transaction)
  - SEC EDGAR + Yahoo + borsa-mcp auth-free; key gerekmez

## Supabase Şeması

| Tablo | Scope | İçerik |
|-------|-------|--------|
| `positions` | user-specific (RLS) | ticker, name, type, shares, avg_cost, currency, broker, unit (TEXT DEFAULT NULL — altın birimi: oz/g/quarter/half/full/republic) |
| `transactions` | user-specific (RLS) | BUY/SELL kayıtları (shares/price orijinal değerlerde) |
| `splits` | user-specific (RLS) | ticker, split_date, ratio (stock split bilgisi) |
| `profiles` | user-specific (RLS, public read) | user_id PK, username (unique), display_name, parse_calls_today (INT DEFAULT 0), parse_calls_date (DATE DEFAULT CURRENT_DATE) |
| `price_cache` | **paylaşımlı** (service_role write only) | ticker PK, price + d1/w1/m1/y1 + p_d1…p_y1 + updated_at |

`price_cache` RLS: `authenticated` rolüne SELECT; INSERT/UPDATE/DELETE policy kaldırıldı — tüm write `fetch-prices` edge function üstünden **service_role** ile (Sprint 5).
`profiles` RLS: SELECT herkese (auth) açık (ileride social feed için), INSERT/UPDATE sadece kendi satırına. `parse_calls_today/date` sütunları sadece `increment_parse_calls` RPC (SECURITY DEFINER) ile service_role üstünden güncellenir.

### pg_cron job

`refresh-price-cache-6h` — `0 */6 * * *` (her 6 saat). `pg_net.http_post` ile edge function'ı çağırır, `CRON_SECRET` Bearer header (Sprint 4 — anon Bearer yerine geçti).

## `index.html` Yapısı (bileşen haritası)

```
Root → Login (IL mark) | App
  App (#shell)
    ├─ #topbar (sticky)       — [IL] logo + nav (Dashboard/İşlemler/Analiz/Ara/Ayarlar)
    │                            + sağ aksiyonlar (.cur-seg $/₺ toggle, 🕐 son güncelleme yaşı (readonly
    │                            span + busy spinner — otomatik 30dk interval + visibilitychange),
    │                            👁 hide, + İşlem Ekle); manuel "↻ Şimdi Güncelle" Settings'te
    ├─ <main #app-main>
    │   ├─ Dashboard          — KPI kartlar (TR + XIRR, display cur'da convert),
    │   │                       pozisyon blokları VARLIK TÜRÜNE göre (BLOCK_TYPES config,
    │   │                       6 tip: US Hisse/ETF/BIST/Kripto/Altın/Döviz).
    │   │                       Bloklar başlangıçta hepsi kapalı (collapsedBlocks init=all).
    │   │                       Başlık: [Etiket] [PeriodPill unsigned] [TotMV] [▸/▾]
    │   │                       Açık halde Alt-B accent-line: header borderRadius "10px 10px 0 0",
    │   │                       body borderLeft 3px --info + bg2. EUR cost-only ayrı blok
    │   ├─ HistoryTab         — filtre toolbar, accordion (ticker gruplu, search)
    │   ├─ AnalysisTab        — Varlık Dağılımı (stacked bar + collapsible legend;
    │   │                       type row tıklanınca ticker drill-down, >1 ticker için ▸/▾),
    │   │                       Bölge Dağılımı, Portföy Sağlık Tablosu (8 metrik),
    │   │                       Toplam Komisyon, Kazanan/Kaybeden Trade,
    │   │                       + diğer kartlar (ROADMAP.md / FEATURE_DETAILS.md detay).
    │   │                       NOT: Pozisyon Yıllık Getiri (CAGR) kartı kaldırıldı —
    │   │                       transactions olmadan çalışmıyordu (işlem tarihi yok).
    │   ├─ SearchTab          — global ticker arama (~11k: 10.348 US + 636 BIST),
    │   │                       portföy + tüm hisseler iki ayrı bölüm
    │   ├─ AddTab             — 6-kart asset type picker → 4 mod: text/image/csv/manuel;
    │   │                       picker context-free (FAB/+İşlem'den); detay'dan gelen
    │   │                       AddTxInline picker görmez
    │   │   ├─ ConfirmBox     — parse onayı (tek=kv-grid, çoklu=row list + ×)
    │   │   └─ ManuelPosForm  — `prefillType` prop; tarih→fiyat autofill;
    │   │                       CRYPTO/GOLD modunda chip picker (CRYPTO_SYMBOLS /
    │   │                       COMMODITY_SYMBOLS); priceNote inline persistent uyarı
    │   ├─ TickerDetailTab    — held mode (pozisyon kartları) + discovery mode
    │   │                       (non-held; YOK badge, warn-card, meta+fund only);
    │   │                       FAB context-aware "il-detail-add" event listener
    │   └─ Settings           — Fiyat & Veri (test result inline + "↻ Şimdi Güncelle · X dk önce"
    │                           manuel buton), Bakım, Export (CSV), Account, Durum (FX Kuru dahil)
    ├─ #bottom-tabs (mobile)  — 5 nav (Dashboard/İşlemler/Analiz/Ara/Ayarlar; detail'de
    │                           fromTab vurgusu); +Ekle filtreli, FAB ayrı
    └─ #fab (mobile)          — Context-aware: Detail'de + Ekle (custom event),
                                Search'te input focus, Settings'te gizli, default + İşlem Ekle
```

Üst-level yardımcılar (top-level, App/Root dışı):
- `edgeCallAuth(fn, body)` — parse-transaction için: `sb.auth.getSession()` ile gerçek kullanıcı JWT'si alıp gönderir (anon key değil); rate limit kimlik doğrulaması için
- `rebuildPositions(userId)` — split-aware pozisyon yeniden hesabı
- `xirr(cashflows)` — Newton-Raphson IRR (yıllık return)
- `buildCashflows(txs, mvNow)` — XIRR için cash flow serisi
- `SparkChart` — küçük SVG portfolio değer grafiği
- `AccountSection` — Settings içinde Hesap formu
- `fmtShares(n)` — adet formatı (integer veya trailing-zero-trimmed ondalık)
- `fmtDateTR(iso)` — `YYYY-MM-DD` → `DD/MM/YYYY` görüntü; ISO storage'a dokunmaz
- `parseTRDate(s)` — TR formatı → ISO (manuel override yolu)
- `safeUrl(url)` — http/https scheme allowlist; provider compromise koruması
- `enrichParseWithPrice(d)` / `enrichParseListWithPrices(list)` — AI parse fiyat boşsa kapanış autofill (tarih → latest fallback)
- `NAV_ICONS` — desktop topbar (s=14) + mobile bottom-tabs (s=20) SVG'leri (5 entry: dashboard/history/analysis/search/settings)
- `ADD_TYPES` — AddTab type picker için 6 entry (US_STOCK/BIST/FUND/CRYPTO/GOLD/FX) + icon/label/desc
- `BLOCK_TYPES` — Dashboard pozisyon blokları için 6 entry (US Hisse/ETF/BIST/Kripto/Altın/Döviz) — currency-yerine asset_type bazlı gruplama
- `BENCHMARKS` — Dashboard benchmark karşılaştırması için 2 entry: `[{ticker:"SPY",label:"S&P 500",type:"US_STOCK"},{ticker:"XU100",label:"BIST 100",type:"BIST"}]`
- `SECTOR_COLORS` — AnalysisTab Sektör Dağılımı için 10 renk dizisi; "Bilinmiyor" her zaman `SECTOR_UNKNOWN_COLOR` (#8e8e93 gri)
- `CRYPTO_SYMBOLS` — ManuelPosForm CRYPTO chip picker için 12 popüler kripto (BTC/ETH/SOL/...)
- `COMMODITY_SYMBOLS` — ManuelPosForm GOLD chip picker için 4 emtia (XAU/XAG/XPT/XPD + ikon)
- `GOLD_UNITS` — ManuelPosForm GOLD birim picker için 6 birim (oz/g/quarter/half/full/republic) + `grams` ağırlık + `purity` saflık faktörü
- `goldOzPerUnit(unit)` — birim → troy oz çevirimi (`shares * ozFactor` oz-eq storage; `avg_cost / ozFactor` per-oz price). unit=null → factor=1 (legacy oz geriye uyumlu)
- `REGION_OF` / `REGION_META` — AnalysisTab bölge dağılımı heuristik (asset_type → region key + label/color)
- `sym_(cur)` — currency code → ₺/€/$ sembol map (AnalysisTab içi)
- `displaySym(cur)` — top-level currency → sembol map (FX conversion için merkez yardımcı)
- `convert(amt, from, to, fxRates)` — USD↔TRY↔EUR çevrim helper'ı (EUR↔TRY için EUR→USD→TRY chain)
- `fxCacheGet/Set` — LS `il_fx` cache 24h TTL (Frankfurter API rates)
- `fmtSign(n, sym)` — currency-aware signed format (`+₺X` / `-$X`); `fmtD`'nin parametrik versiyonu
- `sanitizeMeta(data)` — provider compromise koruması: `meta.description` 5KB cap (`META_DESC_CAP`)
- `buildSlicesPath(arr,cx,cy,r)` — pie SVG path generator (Varlık + Bölge pie'ları paylaşır)
- `DEBUG` const (top of script) — `false` ise console.warn/log no-op (production polish)
- `tickerDbCacheGet/Set` — LS cache 24h TTL + memory fallback `_tickerDbMem` (LS quota fail için); SearchTab için, key `sec_ticker_db_v2`

## Önemli Konvansiyonlar

### Tasarım sistemi (2026-04-25 redesign)
- **Tema**: yalnız dark — `prefers-color-scheme:light` kaldırıldı.
- **Renk tokenleri** (`:root`):
  - `--bg #000` / `--bg2 #0c0c0c` / `--bg3 #141414` / `--bg4 #1c1c1c` (4 katman)
  - `--text #f0ede8` (sıcak beyaz), `--text2 #b8b8b8` (~11:1 contrast — AA passing), `--text3 #888888` (~5:1 — AA Large)
  - `--info #6658ff` (mor brand), `--ok #00d97e`, `--err #ff3366`, `--warn #ffb800`
  - `--border rgba(255,255,255,0.06)` — hat kullanımı için 1px solid (eski 0.5px değil)
- **Tipografi**: Google Fonts `DM Sans` (300-700 body) + `DM Mono` (400/500 sayılar/ticker).
- **Mikro etiketler**: `.lbl`, `.stitle`, `.kk` 10px uppercase + `font-weight:500` (küçük boyutta okunabilirlik için weight bumped).
- **Aktif sekme**: pill (soft mor bg `rgba(102,88,255,0.12)` + text), alt çizgi yok.
- **FAB mobile**: 54px daire, `var(--info)` mor, mor shadow, sağ alt sabit (`bottom:76px`).

### Para & formatlama
- USD → `$`, TRY → `₺`, EUR → `€` (`displaySym(cur)` helper)
- `fmt(n, d=2)`, `fmtD(n)` (±$ — sadece USD), `fmtSign(n, sym)` (currency-aware ±sym), `fmtP(n)` (±%), `fmtShares(n)` adet için
- Gizli mod (`hide` state): `mask()` ile tüm tutarları `••••`
- **Display Currency**: Topbar toggle ile $ veya ₺. Dashboard KPI + Pie + Analiz convert; pozisyon tablosu blokları kendi natural currency'sinde. Bkz. "FX (Currency Conversion)" bölümü.

### Tarih
- **Storage**: ISO `YYYY-MM-DD` (Supabase date). Internal hesaplar/sıralama hep ISO.
- **Görüntü**: `DD/MM/YYYY` — `fmtDateTR(iso)` helper'ı kullan.
- **Input**: `<input type="date">` (native picker, locale-aware, value ISO).

### CFG sabitleri (top-level)
```js
CFG.RATE_LIMIT_MS    = 7500   // Massive.com ticker arası bekleme
CFG.DUST_THRESHOLD   = 0.0001 // pozisyon sayılacak min shares
CFG.CSV_BATCH_SIZE   = 50     // Supabase insert batch
CFG.FLASH_MS         = 3500   // flash mesaj süresi
CFG.CSV_PROGRESS_MS  = 5000   // CSV bitişi sonrası progress reset
```

### Renk paleti (asset_type → pie chart)
```js
TYPE_COLORS = {
  US_STOCK: "#30d158",  // yeşil
  FUND:     "#0a84ff",  // mavi
  CRYPTO:   "#ff9f0a",  // turuncu
  BIST:     "#bf5af2",  // mor
  GOLD:     "#ffd60a",  // sarı
  FX:       "#8e8e93",  // gri
};
```

### CSS class'ları
- `.btn-xs` / `.btn-sm` / `.btn-md` — buton size varyantları
- `.btn-danger-out` — error outline
- `.finp` / `.finp.sm` — form input, küçük varyant
- `.empty-card` — CTA'lı boş-durum kartı
- `.warn-card` — turuncu uyarı kartı (ör. "fiyat yok", "yetersiz veri", FMP `OUT_OF_PLAN`)
- `.pos-row` — clickable tablo satırı (hover bg değişimi, history'ye yönlendirir)
- `.badge.etf`/`.badge.cry`/`.badge.split` — ticker rozetleri (split: ⚡ ×N)
- `.mdl-bd`/`.mdl-bx` — özel confirm modal
- `.seg` — segmented control (toggle); pie chart Maliyet/Piyasa
- `.mtab` — mode tab (AddTab text/image/csv/manuel + AnalysisTab + AddTab type picker filter chip aynı pattern)
- `.pie-row`/`.pie-sw` — pie chart legend rows. Layout: flex; çocuk genişliği `flex:"0 0 70px"` ($) + `flex:"0 0 56px"` (%) sabit (önceki `minWidth` content overflow'da kayardı; bkz. Gotchas)
- `[data-tip]` — özel CSS tooltip (hover'da pop-up, native title yerine)

### Flash & Confirm
- `flash_(msg, "ok"|"err")` — 3.5 sn otomatik kapanır
- `confirm_(msg, {okLbl, cancelLbl, danger})` — **async**, `await` gerekir. `window.confirm` kullanma.

### Dil
- Tüm UI metinleri, flash mesajları, error'lar **Türkçe**
- Commit mesajları **İngilizce** + Co-Authored-By trailer

## Stock Split Sistemi

- Split satırı eklendiğinde (Supabase'e elle INSERT) kullanıcı **Ayarlar → "♻️ Pozisyonları Yeniden Hesapla"** tıklamalı
- `rebuildPositions` her transaction için `factorFor(ticker, date) = Π ratio(tarihten sonraki splitler)` hesaplar
- HistoryTab satır render'ı: o işlemden sonra split varsa `⚡ ×N` badge + tooltip

## Price Cache Akışı

1. **Mount**: `loadData` `price_cache` SELECT eder → `hist`/`prc` state'ine yazar (hızlı chart)
2. **Auto-fetch**: `pos` değiştiğinde cache'te eksik ticker varsa arka planda `fetchHist(missing)` tetiklenir
3. **Yazma**: her başarılı `fetch-prices` sonucu edge function **service_role** ile `price_cache`'e upsert eder (Sprint 5 — frontend write kaldırıldı, backfill kaldırıldı)
4. **Cron**: `refresh-price-cache` her 6 saatte bir en stale 5 ticker'ı tazeler; `CRON_SECRET` Bearer header ile korunuyor (Sprint 4)

## Özellik Detayları

Sekme/provider implementasyon detayları → **`FEATURE_DETAILS.md`**

Kapsam: Returns hesabı · FX conversion · Price Provider Routing · Currency Handling ·
Fundamental Veri (FMP + EDGAR + İş Yatırım) · AnalysisTab kartları · SearchTab mimarisi.

## Ölçeklenme Notları

- `price_cache` write policy Sprint 5'te service_role'a daraltıldı — frontend artık read-only, tüm write `fetch-prices` edge function üstünden service_role ile.
- `parse-transaction` günlük 20 çağrı/kullanıcı limiti var (`increment_parse_calls` RPC, Sprint 5); frontend `edgeCallAuth` ile JWT gönderir, edge fn kimliği verify eder.
- Auto-fetch on mount: çok user'da rate limit'i zorlar — opt-in'e çevirmek gerekebilir.
- Detay: ROADMAP.md "Ölçeklenme & Mass Kullanım" bölümü.

## Gotchas

- Supabase secret adları `SUPABASE_` ile başlayamaz (platform otomatik sağlar): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` zaten edge function runtime'da var.
- `cron.job_run_details` tablosunda `jobname` kolonu **yok** — `jobid` ile `cron.job`'a join gerekir.
- `transactions.way` CHECK kısıtı `ANY(ARRAY['BUY','SELL','DIV'])` (003_div_way.sql ile güncellendi). `DIV` artık resmi olarak destekleniyor.
- **Anon key public**'tir (frontend'de hardcoded OK), **service_role key kesinlikle gizli** — sadece edge function'larda `Deno.env.get(...)` ile.
- CSV export/import round-trip: virgül/tırnaklı alanlar için `csvEsc()` kullan, aksi halde "Apple, Inc" parçalanır.
- Edge function `pos` değiştiğinde useEffect ile auto-fetch tetikler → `busy.h/p` guard'ı korunmalı.
- XIRR `<1Y` periyotlarda matematiksel olarak hesaplanabilir ama yanıltıcı; UI bilinçli olarak gizliyor.
- Native HTML `title` attribute tooltip'i Chrome/Safari'de 1-2 sn gecikmeli — bu yüzden `data-tip` + custom CSS pseudo-element kullanılıyor.
- **iOS Safari/Chrome auto-zoom**: input `font-size < 16px` ise focus'ta sayfayı zoomlar ve session boyu kalır. Mobile media query (`max-width:640px`) altında `input/textarea/select { font-size: 16px }` zorunlu.
- **BIST currency display**: `fmtD(n)` "+$1,234.56" hardcoded `$` döner. BIST için `${(n>=0?"+":"-")+sym+fmt(Math.abs(n),2)}` inline kullan, fmtD'yi parametrik yap diye refactor etme (US tarafına yan etki getirir).
- **Yahoo Finance .IS suffix**: BIST tickerını `THYAO.IS` formatına çevir (edge function tdPrice yapar). Frontend ham ticker geçer.
- **borsa-mcp session expire**: 401/404'te oturum yenilenir; ilk handshake ~500ms ekstra latency.
- **AI parse response shape**: edge function her zaman `{transactions:[...]}` array döner (multi-line + tek işlem hep array). Eski tek-obje format için FE side'da `Array.isArray(d.transactions) ? ... : (d.ticker ? [d] : [])` guard'ı var.
- **localStorage scope**: `il_hide`/`il_prc`/`il_hist` user-agnostic; signOut handler bunları temizler. `fund_*`, `meta_*`, `sec_ticker_db` public market data, user-bound değil.
- **`.pie-row` kolon hizalama**: `display:flex` ile çocuk span'lara `flex:"0 0 70px"` ($) ve `flex:"0 0 56px"` (%) sabit basis ver — `minWidth` koymak yetmez, content > minWidth olunca o satırın % col'u genişler ve $ col'u o satırda kayar (Toplam $3,446 vs legend $1,310 8-15px spread olur). Label `flex:1, minWidth:0` (truncate KULLANMA — `overflow:hidden + ellipsis` "Hi…/ET…" regression yapar). Bu çözüm Dashboard pie + Analiz Varlık + Analiz Bölge pie'larında uygulanmalı.
- **Test-runner agent yetkisi**: `Write` toollu olduğu için kod yazabilir; **read-only mode'u explicit talimatla zorla** ("DO NOT modify any source files. If you find issues, REPORT them — do not fix yourself"). Aksi halde bug fix'leri kendi yapıp regression yaratabilir (ör. label truncation eklemesi 2026-04-25).
- **`rebuildPositions` unit snapshot**: `rebuildPositions` tüm pozisyonları DELETE edip yeniden insert eder. Önce `SELECT ticker, unit FROM positions WHERE user_id=...` ile `unitMap` snapshot'ı al; np map içinde `unit: unitMap[p.ticker] ?? null` ile restore et. Aksi halde rebuild sonrası tüm altın pozisyonları unit kaybeder ve oz olarak yanlış görünür.
- **Edge function CORS**: Tüm 4 edge fn `"Access-Control-Allow-Origin": "https://canmrtr.github.io"` ile kilitli (eski `"*"` değil). Yeni edge fn eklenince aynı şekilde lock yapılmalı. Supabase Dashboard CORS ayarı değil, response header'dan kontrol edilir.
- **Supabase CLI**: `npx supabase link --project-ref jfetubcilmuthpddkodg` ile bağlı. Edge fn deploy: `supabase/functions/<fn-name>/index.ts` yapısı gerekli (`.js` + rename). `npx supabase functions deploy <fn-name> --no-verify-jwt`. `db query --linked --query "SELECT..."` ile schema sorgusu.
- **`p.currency` vs price_cache currency**: `prc[ticker]` değerleri her zaman BIST→TRY (Yahoo), diğer→USD (Massive) döner — `p.currency` ile aynı olmak zorunda değil (AI-parse hatası, stale data). MV hesaplarken (`mvDisp`, `allDisp`) `p.type==="BIST"?"TRY":"USD"` kullan; cost hesaplarken `p.currency` doğru (avg_cost o currency'de saklanır). `rebuildPositions` normCur ile yeni kayıtlar her zaman doğru currency alır ama eski DB verileri için bu ayrım önemli.
- **`.fbar` filter chip bar**: `flex:1;min-width:70px` olan `.mtab`'ı içeren wrapper'da asla `flexWrap:"wrap"` kullanma — mobile'da çok satıra açılır. `.fbar` CSS sınıfı kullan: `overflow-x:auto; scrollbar-width:none; -webkit-overflow-scrolling:touch`. `.fbar .mtab` override: `flex:0 0 auto; white-space:nowrap`.
- **`periodChange` ratio sanity check**: `cur/base < 0.05` ise null döner (USD cur vs TRY stale historic price → ratio ≈1/40 ≈0.025 yakalanır). Max period path için `mv/cost < 0.05` aynı guard (TRY avgCost vs USD mv). 95%+ gerçek kayıp vakaları için false-positive riski var ama kabul edilebilir.
- **TRY avgCost data integrity**: Non-BIST pozisyonun `avg_cost` TRY cinsinde girilmişse (`currency="USD"` ama değer ~₺3M gibi), wrapPos ve periodChange yanlış hesaplar. Çözüm: işlemi USD fiyatıyla düzelt → Ayarlar → ♻️ Yeniden Hesapla. Uyarı mekanizması ROADMAP'te.
- **JSX ternary'de IIFE**: `: (` yerine `: (()=>{ return<>...</>; })()` yazarken orphaned `)` metin nodu bırakmamaya dikkat — JSX'te `}` ve `)` text node olarak render olur. Kapanış bracket'larını dikkatli say; değişiklik sonrası babel check koş.

## Hooks (otomatik validasyon)

`.claude/settings.local.json` içinde `PostToolUse` hook'u tanımlı:

- **`.claude/hooks/babel-check.sh`** — Edit/Write/MultiEdit sonrası `index.html` ise babel/JSX parse'ı koşar. Parse fail olursa exit 2 + stderr ile asistan feedback alır, düzeltir. Build adımı yok — parse fail = canlı sitede tüm kullanıcılar broken page görür.

## Agent Kuralları

`.claude/agents/` altında tanımlı agent'lar. Tetikleyici durumda **kullanıcıya sormadan otomatik** çağır.

- **`babel-checker`** — `index.html` edit'i sonrası **hook tarafından otomatik koşulur**; agent'ı manuel çağırmaya gerek yok. Hook devre dışıysa fallback olarak çağırılabilir.
- **`edge-reviewer`** — `*-edge-function.js` edit'inden sonra, kullanıcıya "deploy et" önermeden **önce**. Security / error-handling / Deno pitfall raporu.
- **`ui-builder`** — yeni bir UI component (tab, card, form, modal, tablo) eklenecek veya mevcut component'in görsel/yapısal değişikliği yapılacak ise kod yazımını delege et. Tasarım sistemi + Türkçe UI konvansiyonlarını biliyor. 1-2 satır string/copy tweak için skip OK.
- **`sql-writer`** — Supabase migration, RLS policy, pg_cron job veya schema SQL'i yazılacak ise. Proje gotcha'larını (jobname column yok, `SUPABASE_` prefix, `transactions.way` enum vb.) biliyor.
- **`rls-auditor`** — yeni tablo eklenince **veya** mevcut RLS policy değişince, SQL uygulanmadan önce. Read-only audit; user data isolation doğrular.
- **`client-security-auditor`** — auth flow / form / kullanıcı girdisi rendering eden yerlerde `index.html` değişikliği yaptıktan sonra. Ayrıca güvenlik-hassas commit'ten önce manuel çağrı uygundur. XSS, secret leak, LS hijyeni, privacy-mode regression'lerini tarar.
- **`test-runner`** — Playwright + Chromium ile canlı (veya localhost) E2E test. Major feature sonrası veya deploy öncesi manuel çağrı. Mid-session eklenen agent'lar registry'ye girmeyebilir; bu durumda `cd /tmp && npm install --no-save playwright` + manuel script de seçenek.

## Pre-Deploy Checklist

Her deploy öncesi aşağıdaki kontrolleri çalıştır:

```bash
npm run check:babel        # index.html JSX parse
npm run check:edge         # node --check tüm root edge files
npm run check:edge-drift   # root *.js == supabase/functions/*/index.ts
```

Edge function deploy akışı:
1. `supabase/functions/<fn>/index.ts` dosyasını düzenle (canonical deploy path)
2. Root `*-edge-function.js` kopyasını da güncelle (sync)
3. `npm run check:edge-drift` → PASS
4. `npx supabase functions deploy <fn> --no-verify-jwt`

E2E smoke test (live site):
```bash
IL_EMAIL=... IL_PASS=... node e2e/smoke.mjs
```

## Test & Doğrulama

- Babel parse: `npm run check:babel` (proje node_modules kullanır, /tmp gerekmez)
- Frontend testi: `Cmd+Shift+R` hard-reload sonrası
- Edge function test: Supabase Dashboard → Edge Functions → function → Test tab, body ile invoke

## Yol Haritası / Açık Konular

Tamamlananlar ve milestone geçmişi → **`ROADMAP.md`**

Açık başlıklar:
- **TR altın işçilik premium göstergesi** — Reşat/Ata birimi + Dashboard "Spot saf · Premium %" render
- **TEFAS entegrasyonu** — WAF cloud IP bloğu sorunu; Supabase edge function üstünden test bekleniyor
- **FX/GOLD ham ticker normalize** — edge function future-proofing
- **Sektör-aware fundamental eşikler** — tech P/E ≤30, utility ≤15 vs.
- **EDGAR + market price** — P/E ve P/S için CommonStockSharesOutstanding × current price
- **Social Portfolios Faz 3** — takip sistemi (follows UI), sosyal feed, risk profili
- **Watchlist & alarm** — izleme listesi + hedef fiyat bildirimi (ROADMAP.md detay)
- **Temettü takvimi** — FMP dividend-calendar mode + yaklaşan temettüler UI
