# Portfoi

Tek dosyalı React + Supabase kişisel yatırım takip uygulaması. Türkçe UI.

> **Her session başında `Lessons.md`'yi oku.** Can'ın geçmişte düzelttiği veya itiraz ettiği konuların kuralları orada. Yeni bir düzeltme alırsan → `Lessons.md`'ye ekle.

> **Her commit + push, ilgili `.md` dosyalarını da güncellemek zorunda.** Kod davranışı / schema / convention / sprint durumu / feature değişikliği varsa **aynı commit'te** şu dosyalardan ilgili olanı güncelle (sahiplik için ↓ Dokümantasyon Haritası): schema → `SCHEMA.md`; konvansiyon/CSS/format → `CONVENTIONS.md`; cache/LS key → `CACHE.md`; fiyat/FX/feature → `FEATURE_DETAILS.md`; pitfall → `GOTCHAS.md`; sprint/backlog → `ROADMAP.md`; düzeltme → `Lessons.md`. Doküman güncellemesini "sonraya" bırakma — drift sessizdir. (`.claude/hooks/doc-sync-check.sh` advisory hatırlatma verir.)

## Mimari

- **Frontend**: `index.html` (ince shell: CSS + CDN scripts + `<script src>` etiketleri) + `src/constants.js`, `src/utils.js`, `src/components/*.js` — React 18 UMD + Babel Standalone (tarayıcıda JSX). Build adımı yok; CDN script'leri. GitHub Pages deploy (`main` branch root). Live: `https://canmrtr.github.io/Investment-Ledger/`
  - **Yerel geliştirme**: Babel standalone external scripts XHR ile yükler — `file://` çalışmaz. `npx serve .` veya `python3 -m http.server 8000` gerekli.
- **Backend**: Supabase (auth, PostgreSQL, RLS, Edge Functions, pg_cron).
- **Edge Functions** (hepsi `--no-verify-jwt`):
  - `parse-transaction` — Claude Haiku 4.5, metin/görüntü → `{transactions:[...]}` array
  - `fetch-prices` — Massive (US/FX/Crypto/GOLD), Yahoo (BIST price/hist), Twelve Data + borsa-mcp (BIST meta), **TEFAS** (`asset_type:"TEFAS"` → `tefas.gov.tr/api/funds/fonFiyatBilgiGetir` NAV; price/historical/meta; provider-key kontrolünden önce route; price_cache'e yalnız `{ticker,price,updated_at}` yazar)
  - `refresh-price-cache` — pg_cron 6h, stale-first batch; `REFRESHABLE_TYPES` US_STOCK/FUND/CRYPTO/GOLD/BIST/**TEFAS** (TEFAS `fetchTefasPrice` ile fetch loop'ta branch'lenir)
  - `fetch-fundamentals` — FMP + EDGAR (US); İş Yatırım (BIST); 21 metrik + annual + grades + `dcf` (FMP `/stable/discounted-cash-flow` adil değer, cevapta top-level — metrics jsonb'sine konmaz; US-only); `mode:"ticker-list"` → ~11k ticker DB; `mode:"refresh-fund-cache"` → pg_cron haftalık stale refresh; `mode:"etf-country"` → FMP country-weightings (planlı); `mode:"tefas-catalog"` → ~3510 fonu `/api/funds/fonGetir`'den `tefas_funds`'a upsert (500'lük chunk; **JWT-protected, skipJwt'de DEĞİL** — anon suistimali engellenir)
- **PWA**: `manifest.json` + `service-worker.js` (root); `index.html`'de SW kayıt; icon-192/512.png mevcut.
- **Secrets** (`Deno.env.get`): `MASSIVE_KEY`, `FMP_KEY`, `TWELVEDATA_KEY`, `ANTHROPIC_KEY`

## Supabase Şeması

12 tablo (positions, transactions, splits, profiles, price_cache, portfolios, watchlist, follows, portfolio_activities, fund_cache, adr_bist_map, tefas_funds) + 4 DB RPC + 2 pg_cron job. Tam tablo yapısı, RLS niyeti, RPC imzaları ve cron → **`SCHEMA.md`**.

## Tabs & Bileşenler

`Root → Login | App(#shell)`
- **#topbar**: hamburger menü (profil + settings + signOut, kullanıcı-scope LS keys signOut'tan önce temizlenir) + 6 nav + $/₺ toggle + 👁 hide + İşlem Ekle; 30dk auto-refresh
- **LS key scope (Sprint 22 #5)**: User-scoped key'ler `il_<base>_<userId>`; device-pref global'ler (`il_theme`/`il_fx`/`il_disp_cur`); ticker-keyed paylaşımlı cache'ler prefix'siz. App mount'ta `migrateUserLSKeys`, signOut'ta `clearUserLocalKeys`. Tam manifest (key/TTL/scope/yazan) → **`CACHE.md`**.
- `TABS = [["dashboard","Dashboard"],["watchlist","Watchlist"],["analysis","Analiz"],["search","Ara"],["add","+ Ekle"],["rehber","Rehber"]]` — Settings ana nav'dan çıktı, hamburger içinden açılır
- **Dashboard**: KPI (TR + XIRR), "Bu Ay Beklenen Temettüler" `<details>` kart (held US_STOCK için ex_date ∈ [today, today+30]; empty state'te gizli), 6 BLOCK_TYPE pozisyon bloğu (başlangıçta kapalı); pos-row'da ticker yanında `.badge.stale` (24h+ eski `price_cache.updated_at`)
- **WatchlistTab**: fiyat/günlük değişim tablosu, "Çıkar" per row (async `confirm_` prop'u App'ten gelir), empty-card CTA; ticker yanında `.badge.stale`; `watchlist` Supabase tablosu (id, user_id, ticker, asset_type, added_at)
- **AnalysisTab** (Sprint 23 — **Özet / Detay iki katman**): root `<div>` flex-column; kartlar CSS `order` ile konumlanır (kaynak DOM sırası ≠ görsel sıra). **Özet katmanı** (`order` 10–16, default görünür): Varlık/Bölge/Sektör Dağılımı (stacked bar, collapsible), Aylık Özet, 6 Aylık Performans, Kur Riski, Temettü Özeti. **Detaylı Analiz toggle** (`detailOpen` state, `order:20`) altında **Detay katmanı** (`order` 30–37, `display:detailOpen?undefined:"none"`): **Portföy Sağlık** (Portföy F/K KPI + S&P 500 (~22) 3-durumlu karşılaştırma cümlesi 🟢altında/🟡civarında/🔴belirgin üstünde + kapsam notu + <%60 "kısmi veri" uyarısı [Sprint 25] + 6 portföy seviyesi sonuç cümlesi + "Detay ▾" toggle ile 8 metrik dense tablo), Konsantrasyon Riski, Break-Even, Potansiyel Kayıp, Kazanan/Kaybeden, Dönem Bazlı Getiri (benchmark), **Piyasa Düşüşü Dayanıklılığı** (MV-weighted 1-10 skor + tek-satır verdict "güçlü ≥7 / orta ≥5 / kırılgan <5" + composition satırı + per-ticker bar grid; BIST bankaları + non-equity `isFundEligible` ile kapsam dışı), Toplam Komisyon (broker×yıl). **fund_cache lazy-fetch**: Supabase `fund_cache` SELECT + edge auto-fetch yalnız `detailOpen===true` iken (`useEffect` deps `[pos,detailOpen]`); Detay hiç açılmazsa hiçbir fundamentals ağ isteği yok. Eski 4 bölüm başlığı (Performans/Dağılım/Fundamentals/Risk) kaldırıldı. Global asset-type filtre (`.fbar`) iki katmanın da üstünde.
- **SearchTab**: ~11k ticker (US + BIST) + **~3510 TEFAS fonu** (`tefas_funds` 5×1000 sayfalı fetch, 24h LS cache `tefas_fund_db_v1`); ayrı "TEFAS fonları" sonuç bölümü + lime badge; autofocus sadece desktop'ta (`!('ontouchstart' in window)`); portföy + discovery; "+ İzle" / "✓ İzleniyor" non-held toggle
- **AddTab**: 9 asset type picker (US_STOCK/BIST/FUND/CRYPTO/GOLD/FX/BES/**TEFAS**/CASH/DEPOSIT) → text/image/csv/manuel; CASH/DEPOSIT Manuel-only (text/image/csv gizli); TEFAS tüm sekmeler açık (BES gibi); ConfirmBox + ManuelPosForm
- **TickerDetailTab**: held + discovery mode; "İzleniyor" badge + toggle buton; FAB context-aware; held US_STOCK/BIST için "Giriş Kalitesi" 52W bar (gradient + avg_cost vertical marker + güncel fiyat disk marker; h_52w/l_52w NULL ise gizli); US_STOCK/USD için fundamental checklist üstünde "Hızlı Değerleme (DCF)" kartı (`fund.dcf` adil değer + yükseliş potansiyeli `(dcf−price)/price`; renkli verdict ≥%50 🟢 / ≥%25 🟡 / <%25 🔴; `fund.dcf>0` yoksa gizli); fundamental checklist'te 21 metrik grubunun üstünde **plain-language özet satırı** (Sprint 25: `buildFundSummary` → Kârlılık/Büyüme/Borç/Değerleme segmentleri, `fundScore` grade rollup'ı, sinyal renkli; `fund_cache` boşsa gizli)
- **HistoryTab**: filtre toolbar, accordion ticker gruplu — ana nav'da yok; Settings → "İşlem Geçmişi" → "Tüm İşlemleri Gör →"
- **Rehber** (yeni, hamburger nav): coming soon placeholder — yatırım temelleri + portföy yönetimi rehberi
- **Settings** (hamburger menüden açılır): İşlem Geçmişi, Fiyat&Veri, Bakım, Export CSV, Account, Durum
- **#bottom-tabs** (mobile) + **#fab** (mobile, context-aware; rehber sekmesinde gizli)

## Önemli Konvansiyonlar

Kod konvansiyonları (tasarım sistemi quick-ref, para & formatlama, tarih, CSS sınıf katmanları, edge çağrı yardımcıları, ManuelPosForm, CASH/DEPOSIT/BES pozisyon modeli, CFG sabitleri, TYPE_COLORS, flash & confirm, dil) → **`CONVENTIONS.md`**.

Hızlı hatırlatma:
- **Dil**: UI + flash + error **Türkçe**; commit **İngilizce** + Co-Authored-By trailer.
- **`priceCur` kuralı** canonical kaynağı → `FEATURE_DETAILS.md` "Currency Handling" (kısa hali asla kopyalama — TL mevduatı ~38x şişirir).
- **`flash_`/`confirm_`/`loadData`/`mask`** App closure'ları, global değil — prop olarak geç.
- Tasarım sistemi & marka → `docs/brand/README.md`.

## Özellik Detayları

Detaylı implementasyon → **`FEATURE_DETAILS.md`** (Returns, FX, Price Routing, Fundamentals, AnalysisTab, SearchTab)

## Gotchas

Kritik pitfall'lar → **`GOTCHAS.md`**

## Hooks

`.claude/settings.local.json` `PostToolUse` hook'ları:
- **`babel-check.sh`** — `src/*.js` veya `src/components/*.js` edit sonrası ilgili dosyayı otomatik JSX parse eder; fail = exit 2 (fail-closed). `index.html` artık inline Babel içermiyor (skip). Build adımı yok — broken parse = broken production.
- **`doc-sync-check.sh`** — her Edit/Write sonrası değişiklik tipine göre hangi `.md`'nin güncellenmesi gerektiğini hatırlatır (schema→SCHEMA.md, cache→CACHE.md, vb.). **Advisory** — daima exit 0, asla bloklamaz; docs-sync kuralının in-loop hatırlatıcısı (commit-time karşılığı `commit-helper` agent).

`SessionStart` hook: **`lessons-md-reminder.sh`** — `Lessons.md` sözleşmesini enjekte eder (oku, asla otomatik ekleme, önce onay al).

## Agent & Skill Kuralları

**Agents** (izole alt-süreç, raporlama/audit/test için):
- **`edge-reviewer`** (sonnet) — `*-edge-function.js` edit sonrası, deploy öncesi
- **`rls-auditor`** (sonnet) — yeni tablo veya RLS policy değişikliği, SQL uygulanmadan önce; policy **text** auditi
- **`rls-empirical-tester`** (sonnet) — `rls-auditor` sonrası schema/RLS migration apply edildiğinde; gerçek cross-user query'lerle RLS'i deneyimsel doğrular
- **`client-security-auditor`** (sonnet) — auth/form/kullanıcı girdi render eden `index.html` değişikliği sonrası
- **`test-runner`** (haiku) — major feature / deploy öncesi; **"DO NOT modify any source files. Report only."** talimatını ver
- **`commit-helper`** (haiku) — Can "commit hazırla" derse; İngilizce commit message draft + docs-sync (.md güncelleme) listesi üretir
- **`price-debugger`** (sonnet) — Can "X tickerının fiyatı yanlış / eski" derse; provider cascade'i (Massive/Yahoo/Twelve/borsa-mcp/İş Yatırım) manuel traverse eder

Tetikleyicide **kullanıcıya sormadan** çağır (commit-helper ve price-debugger explicit istek üzerine).

**Skills** (ana thread'e yüklenen methodology paketleri — `.claude/skills/<name>/SKILL.md`):
- **`ui-builder`** — yeni UI component (tab/card/form/modal/tablo) veya görsel değişiklik; 1-2 satır tweak için skip OK. Babel parse'ı PostToolUse hook otomatik yapar.
- **`sql-writer`** — migration, RLS policy, pg_cron, schema SQL. Schema değişikliği sonrası `rls-auditor` agent'ını çağır.
- **`product-owner`** — roadmap grooming, sprint planlama, fikir üretimi, önceliklendirme

Babel parse otomatize: `.claude/hooks/babel-check.sh` PostToolUse hook'u `src/*.js` ve `src/components/*.js` edit sonrası çalışır.

## Pre-Deploy Checklist

```bash
npm run check:babel        # JSX parse
npm run check:edge         # edge fn syntax
npm run check:edge-drift   # root .js == supabase/functions/*/index.ts eşleşmesi
```

Edge fn deploy: `supabase/functions/<fn>/index.ts` düzenle → root `.js` sync → drift check → `npx supabase functions deploy <fn> --no-verify-jwt`

Test: `npm run check:babel` (tüm src/*.js dosyalarını parse eder) + `Cmd+Shift+R` hard-reload (GitHub Pages üzerinde)
Yerel test: `npx serve .` → http://localhost:3000 (Babel standalone XHR için HTTP server gerekli)
E2E: `IL_EMAIL=... IL_PASS=... node e2e/smoke.mjs`

## Yol Haritası

Tamamlananlar + açık konular → **`ROADMAP.md`**

## Ürün Stratejisi & Marka

- Vizyon, positioning, GTM → **`docs/strategy/README.md`** (product-vision, product-brief, launch-plan)
- Marka, tasarım sistemi, logo asset'leri → **`docs/brand/README.md`** (brand-kit, design-system, design-audit, tokens.css)
- Yatırım rehberi / eğitim içeriği → **`docs/guide/README.md`** (investment-guide)

## Dokümantasyon Haritası

Her konunun **tek sahibi** var — bilgiyi sahibinde güncelle, diğerleri yalnız pointer verir.

| Konu | Sahip dosya |
|------|-------------|
| Mimari + indeks + bu harita | `CLAUDE.md` (bu dosya) |
| DB şeması, RLS niyeti, RPC, cron | `SCHEMA.md` |
| Kod konvansiyonları, CSS, format, pozisyon modelleri | `CONVENTIONS.md` |
| Fiyat / FX / canonical `priceCur` / provider routing / fundamentals / AnalysisTab / SearchTab | `FEATURE_DETAILS.md` |
| Cache / localStorage key manifesti | `CACHE.md` |
| Runtime pitfall'ları ("seni ne ısırır") | `GOTCHAS.md` |
| Roadmap / backlog / sprint durumu | `ROADMAP.md` |
| Düzeltme/itiraz kayıtları (append-only, hook'lu) | `Lessons.md` |
| Güvenlik denetimi | `audit.md` |
| Marka & tasarım sistemi | `docs/brand/` |
| Ürün stratejisi & brief | `docs/strategy/` |
| Yatırım eğitimi | `docs/guide/` |
| Tarihli plan/spec kayıtları (dondurulmuş) | `docs/superpowers/{plans,specs}/` |
| Sprint retrospektifleri | `sprints/sprint-NN.md` |

> Doküman yaşam döngüsü: tarihli plan/spec'ler `docs/superpowers/{plans,specs}/` altında **kalıcı, dondurulmuş** kayıttır — taşıma/düzenleme yok (ROADMAP onlara pointer verir). `_archive/` yalnızca kök seviyesindeki süresi geçmiş gevşek dosyalar içindir.
