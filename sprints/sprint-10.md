# Sprint 10 — 2026-05-14 → 2026-05-27

**Goal**: Can, Dashboard'u açtığında her varlık bloğunun dönemsel getirisini tek bakışta görür; hangi hisseden ne zaman temettü beklediğini bilir; mobil ana ekranda uygulama çalışır.

**Capacity**: 2 hafta × ~6h/hafta efektif ≈ ~12h toplam (hafta sonu + akşam)

---

## Scope

### ✅ Milestone A — P1 Bug Bundle + TRY avgCost Uyarısı (2026-04-30)

Sprint 9 plan'da 3 false-positive P1 bug vardı (BreakEven NaN, AddTxInline $, var(--mono) — kod zaten doğruydu). Gerçek buglar tespit edilip düzeltildi:

1. ✅ **`costDisp` `p.avg_cost` → `p.avgCost`** — AnalysisTab Maliyet dağılımı pie'ı hep 0 dönüyordu. `costDisp` helper `p.avg_cost` kullanıyordu (pos state `avgCost` camelCase).
2. ✅ **ManuelPosForm + HistoryTab edit form `$` hardcode → `displaySym`** — EUR pozisyonlarda önizleme `$` gösteriyordu. `displaySym(form.currency)` / `displaySym(editForm.currency)` ile düzeltildi.
3. ✅ **TRY avgCost mismatch warn-card** — TickerDetailTab'da `p.type!=="BIST" && p.currency!=="TRY" && p.avgCost > prc[ticker]*30` koşulunda turuncu warn-card. `prc[ticker]` yoksa görünmez (safe fallback).

---

### Milestone B — Dashboard Blok Bazında Dönem Getirisi (~3-4h)

Can'ın en sık yaptığı akış: Dashboard'u açar, hangi sektör bugün/bu hafta ne yaptı bakar. Şu an bu bilgi yok — her bloğu açıp tek tek pozisyona bakmak gerekiyor.

5. ✅ **Dashboard: Blok bazında dönem getirisi** (2026-04-30)
   - Pill zaten vardı ama unsigned gösteriyordu ve `blockStartMv` tüm items'ı karıştırıyordu.
   - Düzeltmeler: (1) Signed `+/-` pill — `(blockDeltaDlr>=0?"+":"")+blockDeltaPct.toFixed(1)+"%"`. (2) `blockStartMv` hesabı sadece fiyatı olan items üzerinden yapıldı (`itemsWithChg` ile). (3) `missingPriceCount>0` ise header'da "N eksik" data-tip notu.

---

### Milestone C — Temettü Takvimi (~4-5h, 3 alt-task)

DIV takibi Sprint 8'de tamamlandı. Şu an geçmiş görünüyor ama "önümüzdeki 30 günde ne bekliyorum?" sorusu yanıtsız. FMP zaten entegre — yeni API key gerekmez.

6. **Temettü Takvimi**
   - Roadmap: `Temettü Takvimi → "Temettü Takvimi"` `[M][P2]`
   - Neden bu sprint: FMP `/stable/stock/dividends` mevcut entegrasyonda; `fetch-fundamentals` edge fn'a sadece yeni bir `mode` dalı eklemek yeterli. Sprint 10 adayları listesinde en üst sıra. Portföyde US hissesi olan aktif kullanıcı için somut değer.
   - Alt-task'lar:

   **6a. `fetch-fundamentals` edge fn — `mode:"dividend-calendar"` dalı** `[S]`
   - DoD:
     - `body.mode === "dividend-calendar"` ile gelen isteklerde `tickers[]` array parametresi alınır
     - Her ticker için FMP `/stable/stock/dividends?symbol=AAPL&limit=5` → ex-date, pay-date, amount, frequency döner
     - Gelecek tarihli kayıtlar (`ex_date >= today`) öncelikli; geçmişteki son 1 kayıt da döner (TTM yield için)
     - Response: `{dividends: {AAPL: [{ex_date, pay_date, amount, currency}], ...}}`
     - `AbortSignal.timeout(8000)` her fetch'te; CORS header korunuyor
     - edge-reviewer geçmeden deploy edilmez

   **6b. TickerDetailTab — "Sonraki Temettü" satırı** `[S]`
   - DoD:
     - Held US_STOCK pozisyon için TickerDetailTab meta bölümünde "Sonraki Temettü: 15 May · $0.24/hisse · Tahmini ₺480" satırı
     - Yalnızca `ex_date >= today` ise gösterilir; veri yoksa satır çıkmaz (crash yok)
     - Tahmini tutar: `amount × shares` (display cur'a convert); mask() ile gizli mod uyumlu
     - BIST için bu satır çıkmaz (FMP temettü sadece US için güvenilir)

   **6c. HistoryTab / Dashboard — "Bu ay beklenen temettüler" özet satırı** `[S]`
   - DoD:
     - HistoryTab'da "Yaklaşan Temettüler" collapsible section: önümüzdeki 30 gün içinde ex-date'i olan held ticker'lar listesi; sıralı (yakın tarih önce)
     - Her satır: Ticker | Ex-Date | Pay-Date | Tahmini Tutar (shares × amount, display cur)
     - Tutar toplamı: "Bu ay beklenen toplam temettü: $X / ₺X"
     - Veri yoksa (temettü vermeyen portföy veya API döndürmediyse) section çıkmaz
     - LS cache 24h TTL: `div_cal_${ticker}` key; her ticker için ayrı cache
   - Bağımlılık: 6a önce bitmeli; 6b ve 6c paralel ilerlenebilir.

---

### Milestone D — PWA Service Worker (~2h, Sprint 9 tamamlayıcısı)

PWA icon'ları Sprint 9'da tamamlandı (`icon-192.png` + `icon-512.png`). Sadece service worker + index.html head tag kaldı; M1 aşaması tam kapanır.

7. **PWA — service worker + manifest head tag**
   - Roadmap: `Mobil Uygulama → Aşama M1 → "PWA hazırlığı"` `[M][P1]`
   - Neden bu sprint: Icons hazır; service worker aynı item'ın kalan %30'u. Mobil kullanımı güçlendirir; "Ana Ekrana Ekle" ile standalone açılış aktif olur.
   - DoD:
     - `service-worker.js` root'ta; install event: offline shell precache (index.html + manifest.json + icon-192.png + icon-512.png); activate event: eski cache temizlenir
     - Fetch event: `supabase.co` ve edge fn URL'leri → network-first; diğerleri (shell) → cache-first; network fail + cache hit → stale shell göster; ikisi de yoksa 503
     - `manifest.json` root'ta: `name:"Investment Ledger"`, `short_name:"IL"`, `start_url:"/Investment-Ledger/"`, `display:"standalone"`, `background_color:"#000"`, `theme_color:"#6658ff"`, icons 192 + 512
     - `index.html` head: `<link rel="manifest">` + `<meta name="theme-color">` + `<meta name="apple-mobile-web-app-capable">` + service worker registration (`if('serviceWorker' in navigator)`)
     - Chrome DevTools Application → Manifest: "installable" kriterleri karşılanmış; "Add to Home Screen" prompt görünüyor
   - Risk: GitHub Pages HTTPS + same-origin — service worker kaydı sorunsuz. Supabase auth cookie/token service worker'ı bypass etmez (network-first).

---

### Milestone E — Freebie (~1h)

8. **Analist Derecelendirme Geçmişi**
   - Roadmap: `Fundamental & Analiz → "Analist Derecelendirme Geçmişi"` `[S][P2]`
   - Neden bu sprint: FMP `/stable/grade` endpoint; yeni API key yok; `fetch-fundamentals` edge fn'a yeni alan. Simply Wall St'in en çok bakılan özelliklerinden biri. Effort S — tek akşam.
   - DoD:
     - `fetch-fundamentals` response'a `grades: [{date, company, analyst, rating, previousRating}]` array eklenir (son 5 kayıt, US hisseler için)
     - TickerDetailTab fundamental bölümünde "Analist Tavsiyeleri" kısmı: tarih + analist + rating pill (Buy/Hold/Sell → yeşil/sarı/kırmızı)
     - BIST ve US_STOCK dışı tipler için kart çıkmaz
     - `fetch-fundamentals` zaten LS cache 7 gün TTL kullanıyor; grades da aynı cache'te saklanır (ayrı fetch yok)
   - Risk: FMP free tier'da `/stable/grade` mevcut değilse warn-card + "Analist verisi mevcut değil" notu; crash yok.

---

## Out of Scope (bilinçli ertelenenler)

- **Social Portfolios Faz 3 — Takip sistemi** `[M][P2]`: Sprint 9'da Faz 2 tamamlanmadan girmez; Sprint 9 çıktısı bekleniyor. Sprint 11'e taşındı.
- **Watchlist & alarm** `[M][P2]`: Yeni tablo + RLS + UI üçlüsü; bu sprint kapasitesinde mevcut M item'larla çakışır. Sprint 11 adayı.
- **Sektör-aware fundamental eşikler** `[M][P1]`: Önemli ama fundamental edge function refactor gerektirir; Sprint 11.
- **Ortalama Elde Tutma Süresi** `[S][P2]`: CAGR tablosunun (Sprint 9) tamamlayıcısı; Sprint 9 çıktısı + Sprint 11 freebie.
- **Alım Fiyatı Bölgesi Analizi (52W Konumu)** `[S][P2]`: ROADMAP Sprint 10+ adayı; bu sprint zaten dolu. Sprint 11.
- **Aylık Özet Kopyala/Paylaş** `[S][P2]`: Sıfır backend, tek akşam; Sprint 11 freebie.

---

## Demo / Validation

Sprint sonu başarı sinyalleri:

1. **P1 buglar**: AnalysisTab BreakEven — AAPL için breakEven fiyatı sayısal, NaN yok; AddTxInline — THYAO için "Toplam: ₺X.XX" görünüyor; BreakEven tablo hücreleri DM Mono fontuyla render oluyor.

2. **TRY avgCost uyarısı**: BTC pozisyonu avgCost TRY cinsindeyse (~₺3M) TickerDetailTab'da turuncu warn-card çıkıyor; USD cinsindeyse çıkmıyor.

3. **Blok bazında getiri**: Dashboard'da "BIST" bloğu başlık satırında seçili period için `+X.X%` renk pill görünüyor; period değiştirince pill güncelleniyor; fiyat olmayan blok pill göstermiyor (crash yok).

4. **Temettü Takvimi**: AAPL için FMP'den sonraki ex-date + amount çekiliyor; TickerDetailTab meta satırı "Sonraki Temettü: DD/MM · $X.XX" gösteriyor; HistoryTab "Yaklaşan Temettüler" collapsible kısmında önümüzdeki 30 gün listeleniyor.

5. **PWA**: Chrome DevTools Application → Manifest: tüm alanlar dolu, "installable" yeşil; Android Chrome'da "Ana Ekrana Ekle" prompt; iOS Safari standalone modda açılıyor. Offline'da son yüklenen dashboard görünüyor (Supabase cache'teki veri).

6. **Analist tavsiyeleri**: AAPL için TickerDetailTab fundamental bölümünde "Analist Tavsiyeleri" kartı; son 5 analist tavsiyesi tarih + rating pill; GARAN.IS için kart çıkmıyor.

---

## Retro Alanı (Sprint sonu doldur)

_Neler çıktı, neler kaldı, neden kaldı — bir paragraf._
