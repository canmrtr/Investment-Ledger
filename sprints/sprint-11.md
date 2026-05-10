# Sprint 11 — 2026-05-09 → 2026-05-23

**Goal**: Can, Dashboard'u açtığında portföy sağlık sinyallerini proaktif olarak görür ve hangi hisseden ne zaman temettü beklediğini bilir.

**Capacity**: 2 hafta × ~6h/hafta efektif ≈ ~12h toplam (hafta sonu + akşam)

---

## Ön-Not: PWA Durumu

Sprint 11 adayları listesinde #1 olan "PWA — service worker + manifest" `[M][P1]` kalemi **zaten tamamlanmış** bulundu:
- `manifest.json` root'ta eksiksiz (name, short_name, start_url, display:standalone, theme_color, icons 192+512)
- `service-worker.js` root'ta tam implementasyon (install/activate/fetch, cache-first shell, network-first Supabase/CDN)
- `index.html` head: `<link rel="manifest">` + `<meta name="theme-color">` + `<meta name="apple-mobile-web-app-capable">` + SW kayıt kodu

Bu kalemin kapsamı ROADMAP'te tamamlandı olarak işaretlenmeli; Sprint 11 kapasitesi diğer P1/P2 kalemlere kaydırıldı.

---

## Scope

### 1. Periyodik Agent Denetim Turu — 3. Tur `[S][P1]`

**Roadmap satırı**: `Güvenlik & Süreç → "Periyodik agent denetim turu — 3. tur"` `[S][P1]`

**Neden bu sprint**: Sprint 7'den (2. tur) bu yana 3 sprint geçti. Bu sürede eklenenler:
- `watchlist` tablosu + RLS (migration 004 + 006)
- `follows`, `portfolio_activities` tabloları (Social Faz 1 altyapısı)
- Analist Tavsiyeleri edge fn değişikliği (grade endpoint)
- `split` auto-sync yeni commit (son git log'da görünüyor)
- Watchlist `asset_type` kolonu + non-held price fetch

Odak alanlar: watchlist RLS doğruluğu (başka kullanıcının watchlist'i okunabilir mi?); `follows`/`portfolio_activities` RLS (Faz 2 önkoşulu); edge-reviewer için son commit'teki `refresh-price-cache` ve `fetch-fundamentals` değişiklikleri.

**DoD**:
- `rls-auditor` agent: watchlist, follows, portfolio_activities, splits tablolarını çalıştırır; `[PASS]`/`[FAIL]` raporu üretir
- `edge-reviewer` agent: `fetch-fundamentals` (grade endpoint, annual field), `refresh-price-cache` (auto-sync split değişikliği) son halini inceler
- `client-security-auditor`: Watchlist bileşeni (kullanıcı girdi render — ticker, asset_type) XSS kontrolü
- Bulunan bulgular ayrı migration veya hotfix olarak ROADMAP "Bekleyenler" bölümüne eklenir; sprint scope'u değişmez

**Risk**: Kritik bulgu çıkarsa tek akşam hotfix — sprint bloker değil, ek item olarak izlenir.

---

### 2. Temettü Takvimi `[M][P2]`

**Roadmap satırı**: `Temettü Takvimi → "Temettü Takvimi"` — Sprint 10'dan devredildi.

**Neden bu sprint**: FMP entegrasyonu hazır, yeni API key gerekmez. `fetch-fundamentals` edge fn'a tek mod dalı. Sprint 10 planında Milestone C olarak hazırlandı, capacity nedeniyle teslim edilmedi. 3 alt-task düzgün dilimlenmiş; paralel ilerlenebilir.

**Alt-task'lar**:

**2a. `fetch-fundamentals` — `mode:"dividend-calendar"` dalı** `[S]`
- DoD:
  - `body.mode === "dividend-calendar"` ile gelen isteklerde `tickers[]` array kabul edilir
  - Her ticker için FMP `/stable/stock/dividends?symbol=X&limit=5` → ex-date, pay-date, amount, frequency döner
  - Gelecek tarihli (`ex_date >= today`) kayıtlar öncelikli; geçmişten son 1 kayıt da döner (TTM yield için)
  - Response: `{dividends: {AAPL: [{ex_date, pay_date, amount, currency}], ...}}`
  - `AbortSignal.timeout(8000)` her external fetch'te; mevcut CORS header korunur
  - Deployed öncesi `edge-reviewer` sign-off zorunlu

**2b. TickerDetailTab — "Sonraki Temettü" satırı** `[S]`
- DoD:
  - Held US_STOCK pozisyon için meta bölümünde "Sonraki Temettü: 15 May · $0.24/hisse · Tahmini $XX" satırı
  - Yalnızca `ex_date >= today` ise gösterilir; veri yoksa satır çıkmaz (crash yok)
  - Tahmini tutar: `amount × shares`, display cur'a convert; `mask()` gizli mod uyumlu
  - BIST tipi için bu satır çıkmaz (FMP temettü sadece US için güvenilir)

**2c. HistoryTab — "Yaklaşan Temettüler" bölümü** `[S]`
- DoD:
  - HistoryTab'da collapsible "Yaklaşan Temettüler" bölümü: önümüzdeki 30 gün içinde ex-date'i olan held ticker'lar
  - Her satır: Ticker | Ex-Date | Pay-Date | Tahmini tutar (shares × amount, display cur)
  - Tutar toplamı: "Bu ay beklenen toplam temettü: $X / ₺X"
  - Veri yoksa (temettü vermeyen portföy veya API boş dönerse) section çıkmaz
  - LS cache 24h TTL: `il_divcal_${ticker}` key; her ticker için ayrı

**Risk**: FMP free tier'da `/stable/stock/dividends` endpoint'i kısıtlıysa (rate limit veya paywall), veri boş gelir → warn-card + "Temettü verisi mevcut değil" notu; crash yok. 2a bitmeden 2b/2c başlamaz.

---

### 3. Akıllı Nudge Kartları — (a)+(b) alt-task `[M][P2]`

**Roadmap satırı**: `Akıllı Öneriler & Nudge Sistemi → "Akıllı Nudge Kartları"` `[M][P2]`

**Neden bu sprint**: AnalysisTab'daki hesaplama altyapısı (konsantrasyon riski, portföy sağlık, XIRR) zaten mevcut. Bu item o hesaplanan bilgiyi Dashboard'da proaktif olarak yüzeye çıkarıyor; yeni Supabase çağrısı yok. (c) alt-task'ı (sağlık skoru kuralları + AnalysisTab scroll aksiyonu) Sprint 12'ye erteleniyor — Sprint 11 kapasitesine sığması için kapsamı daralttık.

**Alt-task'lar**:

**4a. `computeNudges()` fonksiyonu** `[S]`
- DoD:
  - `src/utils.js`'e `computeNudges(positions, transactions, xirr)` pure fonksiyonu eklenir
  - Tetikleyici kurallar (öncelik sırasıyla):
    - `[P0-Nudge]` Konsantrasyon: tek pozisyon portföyün >%35'i → "X pozisyonun portföyün %Y'sini oluşturuyor"
    - `[P1-Nudge]` İnaktivite: son BUY işleminden >90 gün → "X gündür yeni işlem yok"
    - `[P1-Nudge]` Çeşitlendirme: yalnızca 1 asset_type → "Portföyün tamamı X varlık türünden oluşuyor"
  - Return: `[{id, priority, message, actionTab}]`; boş portföy veya veri yoksa `[]`
  - Birim test edilebilir saf fonksiyon; side effect yok

**4b. Dashboard nudge card render + dismiss mekanizması** `[S]`
- DoD:
  - Dashboard'da KPI kartlarının üstünde nudge kartları render edilir; aynı anda en fazla 2 nudge (öncelik sırasına göre)
  - Her nudge `.warn-card` stili + × kapatma butonu
  - Kapatma: `il_nudge_dismissed` LS key → `{[nudgeId]: dismissedUntilTimestamp}`; 7 gün sonra yeniden gösterilir
  - XIRR veya fiyat verisi yoksa ilgili nudge tetiklenmez (safe fallback)
  - `ui-builder` agent onayı zorunlu (yeni Dashboard bileşeni)

**Risk**: `computeNudges` yanlış pozitif üretebilir (örn. bilerek tek varlık türüne odaklanan kullanıcı). Çözüm: kapatma mekanizması yeterli; nudge paternalist değil bilgilendirici tonda yazılmalı.

---

## Out of Scope (bilinçli ertelenenler)

- **Sektör-aware fundamental eşikler** `[M][P1]`: Bekleyenler'e alındı — ilerleyen sprint'te önceliklendirilecek.
- **Aylık Özet Kopyala/Paylaş** `[S][P2]`: Basit freebie, sprint kapasitesi dolu. Sprint 12 freebie.
- **Social Portfolios Faz 2-3** `[M][P2]`: Faz 1 altyapısı hazır ama UI + RLS işi büyük; Sprint 12-13.
- **Periyodik CAGR Tablosu**: Veri kaynağı sorunu daha önce kaldırılmış; Sprint 12+ için veri netleştirilmeli.
- **ETF Bölge Dağılımı** `[M][P2]`: FMP country-weightings plan hazır ama bu sprint kapasitesine sığmıyor.
- **Akıllı Nudge (c) alt-task**: Sağlık skoru bağımlılığı (lazy-fetch) + AnalysisTab scroll aksiyonu — Sprint 12.

---

## Demo / Validation

Sprint sonu başarı sinyalleri:

1. **Denetim turu**: rls-auditor raporu `watchlist` SELECT policy doğruluğunu onaylar — başka kullanıcının watchlist'i okunamıyor; edge-reviewer grade endpoint ve auto-split commit için `[PASS]` verir.

2. **Temettü Takvimi**: AAPL için FMP'den sonraki ex-date + amount çekilir; TickerDetailTab meta satırında "Sonraki Temettü: DD/MM · $X.XX/hisse · Tahmini $YY" görünür; HistoryTab "Yaklaşan Temettüler" collapsible kısmında önümüzdeki 30 gün içindeki ex-date'ler listelenir; THYAO.IS için bu satır çıkmaz.

3. **Nudge kartları**: Tek pozisyon portföyde %40 ağırlığı aşıyorsa Dashboard'da "X pozisyonun portföyün %Y'sini oluşturuyor" warn-card çıkar; × butona basınca kaybolur ve 7 gün boyunca tekrar görünmez; 91+ gün işlem yoksa inaktivite uyarısı çıkar.

---

## Sprint 12 için Notlar

- Akıllı Nudge (c) alt-task: sağlık skoru + XIRR kuralları + AnalysisTab scroll aksiyonu
- Sektör-aware fundamental eşikler — Bekleyenler'den önceliklendirilecek
- Aylık Özet Kopyala/Paylaş — freebie
- Social Portfolios Faz 2 — profil & public portföyler (RLS + UserProfileModal)
- ETF Bölge Dağılımı — plan hazır (`/Users/canmerter/.claude/plans/...`)

---

## Retro Alanı (Sprint sonu doldur)

**Tamamlananlar (2026-05-10 itibarıyla):**
- Temettü Takvimi: 2a (mode:dividend-calendar), 2b (TickerDetailTab "Sonraki Temettü" satırı), 2c (HistoryTab "Yaklaşan Temettüler" bölümü) — tüm alt-task'lar teslim edildi.
- Nudge Kartları: 4a (computeNudges fonksiyonu), 4b (Dashboard render + dismiss mekanizması) — teslim edildi.
- **Sprint dışı ek**: Fundamental data Supabase cache (`fund_cache` tablosu + pg_cron + AnalysisTab otomatik fetch) — kullanıcı "Eksikleri Çek" butonuna artık basmak zorunda değil; mount'ta Supabase'den okur, hâlâ eksik ticker'lar otomatik fetch edilir.

**Kalan (Sprint 12'ye devreden):** Nudge (c) sağlık skoru kuralları + AnalysisTab scroll aksiyonu.
