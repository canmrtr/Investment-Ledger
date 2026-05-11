# Sprint 16 — 2026-05-12 → 2026-05-25

**Goal**: Sprint 15'ten devreden borç kapatılır: public portföy yüzdeleri çok para biriminde doğru hesaplanır; watchlist ve price upsert güvenlik açıkları giderilir; TRY/EUR pozisyon UI bug'ları düzeltilir — Can portföyünü açtığında gösterilen her oran ve her satır gerçek veriyi yansıtır.

**Capacity**: 2 hafta × ~6h/hafta efektif ≈ ~12h toplam (hafta sonu + akşam)

---

## Bağlam: Sprint 15 Retro Özeti

Sprint 15 tüm scope'u teslim etti (6 commit, 2026-05-11). Edge security bloku beklenenden temiz çıktı. `computePeriod` DIV fix izole kaldı; brand-fit A-2/A-3/B-2 AnalysisTab'ı görsel olarak netleştirdi. İki öğrenme: (1) subagent commit talimatlarını açık yazmak gerekiyor; (2) scope-dışı review döngüleri spec'e "sprint X scope'u dışındakileri flagleme" notu ile önlenebilir.

Sprint 16 Sprint 15'in "bilinçli erteleme" listesinden devralınan 5 item ile başlıyor — hepsi zaten bağlamı hazır, yeni analiz gerektirmiyor.

---

## Scope

### 1. `get_allocation_only_positions` Çoklu-Para Birimi `[M][P1]`

**Roadmap satırı**: `Güvenlik & Denetim Backlog → P2 — Sprint-16 → "get_allocation_only_positions çoklu-para birimi sorunu"`

**Neden bu sprint**: Public portföy görünümünde USD+TRY karışık pozisyonlar normalize edilmeden toplanıyor; görüntülenen yüzdeler yanıltıcı. P1 işaretli; Social Faz 2 öncesinde düzeltilmesi şart.

**Nasıl**:
- `migrations/012_public_allocation_rpc.sql` RPC'sini güncelle: `price_cache.price` + dönemdeki FX oranı ile her pozisyonu tek para birimine (USD veya TRY) çevir, ardından toplam üzerinden pct hesapla.
- `App.js:226,982` çağrısı sonucu kullandığı yerlerde değişiklik gerekmeyebilir; normalize edilmiş pct zaten doğru gelirse frontend değişmez. Kontrol et.
- Migration → `sql-writer` agent; RLS etkisi → `rls-auditor` sign-off zorunlu.

**DoD**:
- USD + TRY karma pozisyonlu test portföyünde public allocation yüzdeleri toplam %100 ediyor ve FX dönüşümlü doğru.
- `rls-auditor` agent migration'ı onaylıyor; `avg_cost`/`shares` hiçbir koşulda dönmüyor.
- `sql-writer` migration syntax kontrol ediyor; Supabase Dashboard'da RPC canlı.
- Frontend `App.js` `get_allocation_only_positions` çağrısı mevcut davranışını koruyor (sonuç format değişmemeli).

**Risk**: RPC SECURITY DEFINER; `price_cache` join yanlış yazılırsa anon read üzerinden beklenmedik veri açığı. Mitigation: rls-auditor pre-apply review; staging olmadığından migration'ı `ROLLBACK` bloğunda test et.

---

### 2. Security Audit Batch — S1 + S2 + S3 `[S×4][P2]`

**Roadmap satırı**: `Güvenlik & Denetim Backlog → P2 — Sprint-16 → watchlist policy + html2canvas SRI + price_snapshots + fetch-prices upsert`

**Neden bu sprint**: Dört item aynı audit turunda tespit edildi, üçü migration/config, biri edge fn tek satır. Birlikte gönderilirse deploy overhead sıfır.

**Alt-task'lar**:
- **S1 `watchlist_own` policy FOR ALL → INSERT/SELECT/DELETE**: `watchlist` tablosunun `watchlist_own` policy'si `FOR ALL` — `ticker` sütunu UPDATE edilebilir (istenmiyor). `FOR INSERT` / `FOR SELECT` / `FOR DELETE` olarak üçe böl. `→ migrations/013_watchlist_policy_split.sql`
- **S2 `html2canvas` SRI hash**: `index.html:291` `html2canvas@1.4.1` CDN script'ine `integrity=` + `crossorigin="anonymous"` ekle. SRI hash: `openssl dgst -sha384 -binary html2canvas.min.js | openssl base64 -A` ile üret veya `srihash.com`. `→ index.html:291`
- **S3 `fetch-prices` historical upsert hata yutma**: Supabase upsert hatası `console.error` bile çağrılmadan yutuluyor; fiyat geçmişi eksik kalabiliyor. `try/catch` veya `.then/catch` ile `console.error` ekle. `→ fetch-prices-edge-function.js:453-467`
- **S4 `price_snapshots` policy rol notu**: `TO anon, authenticated` belirtilmemiş; davranış değişmez ama policy'ye açıklama satırı ekle ve SQL'de rol grant'larını netleştir. `→ migration veya inline comment`

**DoD**:
- `watchlist` tablosunda UPDATE ile ticker değiştirme denemesi DB'de reddediliyor (policy test).
- `html2canvas` script tag'inde `integrity` attribute mevcut; browser DevTools → Network → SRI check geçiyor.
- `fetch-prices` upsert bloğunda hata loglanıyor; sessiz yutma yok — Supabase Dashboard log'dan doğrulanabilir.
- `rls-auditor` S1 migration'ı onaylıyor; `edge-reviewer` S3 değişikliğini onaylıyor.
- `npm run check:edge` + `npm run check:edge-drift` geçiyor.

**Risk**: S1 policy bölünmesi mevcut `INSERT/SELECT/DELETE` çağrılarını kırmaz — Supabase RLS `FOR ALL`'dan ayrı policy'lere geçiş backward compatible. Yine de watchlist yükleme + ekleme + çıkarma akışını canlıda test et.

---

### 3. UI Bug Batch — U1 + U2 + U3 `[S×3][P2]`

**Roadmap satırı**: `UI & A11y Backlog → Aktif Buglar → ManuelPosForm sadece USD + EUR tablosu sıralanamıyor` + `Bug & UX Backlog → il_recent_search signOut temizliği`

**Neden bu sprint**: Üçü de `[S]`, hepsi aynı sprint 15 kapasite sarkması. Ayrı PR gerekmiyor; tek commit batchi yeterli.

**Alt-task'lar**:
- **U1 ManuelPosForm currency filtresi**: `pos.filter(p=>p.currency==="USD")` → `pos.filter(p=>p.shares>CFG.DUST_THRESHOLD)` ile değiştir; TRY ve EUR pozisyonları da listelenir. `→ App.js:~2402`
- **U2 EUR tablo sort state**: `sortEur` state ekle; EUR tablosunda sütun başlığı tıklanınca sıralama çalışsın; USD/TRY tabloları referans implementasyon olarak kullanılabilir. `→ App.js:~5157-5176`
- **U3 `il_recent_search` signOut temizliği**: `signOut` handler'ında `il_recent_search` LS key'ini temizle; diğer `il_` key'leri zaten temizleniyor, bu atlama. `→ App.js signOut bloğu`

**DoD**:
- ManuelPosForm'da TRY ve EUR pozisyonları listede görünüyor; mevcut USD davranışı değişmiyor.
- EUR tablosunda en az 2 sütun (ticker ve değer) sort çalışıyor; sıralama ok ikonu görünüyor.
- Çıkış yapıldıktan sonra `localStorage.getItem("il_recent_search")` → `null`; başka kullanıcı oturum açınca eski arama geçmişi görünmüyor.
- `npm run check:babel` geçiyor; görsel regresyon yok.

**Risk**: U2 EUR sort `BLOCK_TYPE` mantığıyla etkileşebilir; USD/TRY sort referans pattern'e birebir uyulursa risk minimumdur. `ui-builder` agent değişikliği onaylamalı.

---

### 4. BIST/CRYPTO/GOLD Cron Refresh `[S][P2]`

**Roadmap satırı**: `Bug & UX Backlog → "BIST/CRYPTO/GOLD cron refresh"`

**Neden bu sprint**: `refresh-price-cache` pg_cron sadece US_STOCK tipi pozisyonları yeniliyor; diğer asset tipleri stale fiyatla kalıyor. 6 saatlik cron döngüsünde tüm asset tipleri kapsanmalı.

**Nasıl**:
- `refresh-price-cache-edge-function.js`'de asset_type filtresi varsa kaldır veya tüm aktif pozisyonları kapsayan sorguya dönüştür.
- BIST → Yahoo, CRYPTO → Massive/CoinGecko, GOLD → Massive routing zaten `fetch-prices` içinde; cron sadece doğru tipler için job tetiklemeli.
- `edge-reviewer` agent deploy öncesi onay.

**DoD**:
- Cron çalıştıktan sonra `price_cache`'te BIST ve CRYPTO ticker'larının `updated_at` güncelleniyor (Supabase Dashboard ile doğrulanır).
- GOLD ticker `updated_at` de güncelleniyor.
- Mevcut US_STOCK refresh'i kırılmıyor.
- `npm run check:edge` + `npm run check:edge-drift` geçiyor; deploy yapılıyor.

**Risk**: Cron çalışma süresi uzayabilir; birden fazla asset tipi için paralel batch sorun yaratabilir. Mitigation: `edge-reviewer` batch boyutu ve timeout riskini gözden geçirmeli. `RATE_LIMIT_MS` konfigürasyonu kontrol edilmeli.

---

### 5. Temettü Takvimi — Faz 1 `[M][P2]`

**Roadmap satırı**: `Temettü Takvimi → (a) mode:"dividend-calendar" dalı + (b) TickerDetailTab "Sonraki Temettü" satırı`

**Neden bu sprint**: FMP `/stable/stock/dividends` endpoint hazır; `fetch-fundamentals`'a `mode:"dividend-calendar"` dalı Sprint 15'te ticker validation ile hazırlandı. Faz 1 tamamlandığında temettü hissesi olan her ticker için "Sonraki Temettü" tarihi TickerDetailTab'da görünür — değer yatırımcısı için doğrudan fayda.

**Alt-task'lar**:
- **5a `mode:"dividend-calendar"` dalı** `[S]`: `fetch-fundamentals`'ta mevcut `dividend-calendar` mode iskeletine FMP `/stable/stock/dividends?ticker=X&apikey=Y` call ekle; `dividends` array'inden en yakın ex-date + amount döndür. Response: `{ticker, exDate, amount, frequency}`. Ticker validation Sprint 15'te zaten eklendi.
- **5b TickerDetailTab "Sonraki Temettü" satırı** `[S]`: Ticker held ise (`heldTickers.includes(t)`) meta bilgi satırına "Sonraki Temettü: 15 Haz — $0.24/hisse" satırı ekle. Veri yoksa satır render edilmez (graceful fallback). `→ TickerDetailTab.js veya ilgili bileşen`

**DoD**:
- Temettü ödeyen bir US ticker (ör. AAPL, JNJ) için `fetch-fundamentals?mode=dividend-calendar&ticker=AAPL` çağrısı `{exDate, amount}` döndürüyor.
- TickerDetailTab'da held ticker için "Sonraki Temettü" satırı görünüyor; temettü ödemeyen ticker için satır yok.
- Hata durumunda (FMP 404, rate limit) satır sessizce gizleniyor; uygulama crash etmiyor.
- `edge-reviewer` 5a'yı onaylıyor; `ui-builder` 5b'yi onaylıyor.
- `npm run check:babel` + `npm run check:edge` geçiyor.

**Risk**: FMP free tier dividends endpoint'i rate limit'e girebilir. Mitigation: `fund_cache` tablosuna dividend verisi de yazılacaksa TTL mantığı eklenmeli; yoksa her TickerDetailTab açılışında çağrı yapılır (kısa süre için kabul edilebilir). `edge-reviewer` caching stratejisini önersin.

---

## Out of Scope (bilinçli ertelenenler)

- **"Tam Detay" portföy paylaşımı UI ≠ veri katmanı** `[P1]` — Social Faz 2 ile birlikte ele alınacak; tek başına düzeltmek UI borcunu artırır.
- **`Dashboard: Kripto getirisi gösterilmiyor`** `[P1]` — Sprint 15 Retro'dan tanınan; capacity dolmaması için Sprint 17'ye bırakıldı.
- **AI parse DIV way desteği** `[P1]` — `parse-transaction` sistem promptu değişikliği; bu sprint edge fn kapasitesi dolacak.
- **Temettü Takvimi Faz 2 (c)** — Dashboard/HistoryTab özet satırı; Faz 1 doğrulanmadan başlamamalı.
- **Piyasa Dayanıklılık Skoru** `[P2]` — Büyük; ayrı sprint hedefi hak ediyor.
- **Social Portfolios Faz 2** `[P2]` — Item 1 (multi-currency RPC) tamamlanmadan başlamamalı.
- **LS key user-scope prefix** (uzun vade) — Kısa vade `il_recent_search` signOut temizliği bu sprint'te; prefix refactor ayrı sprint.

---

## Definition of Done

- [x] Item 1: `rls-auditor` onayı + migration 014 Supabase'e uygulandı + USD/TRY normalize + anon GRANT kaldırıldı. ✅ 2026-05-11
- [x] Item 2 (S1+S2+S3): `rls-auditor` S1 onayı + `edge-reviewer` S3 onayı + migration 015 uygulandı + html2canvas SRI eklendi + fetch-prices deployed. ✅ 2026-05-11
- [x] Item 3 (U1+U2+U3): TRY/EUR pozisyonlar ManuelPosForm'da görünüyor + EUR sort çalışıyor + il_recent_search doğrulandı + `npm run check:babel` geçti. ✅ 2026-05-11
- [x] Item 4: type IN filtresi uygulandı + `npm run check:edge` + drift check geçti + refresh-price-cache deployed. ✅ 2026-05-11
- [ ] Item 5 (5a+5b): `edge-reviewer` + `ui-builder` onayı + held ticker TickerDetailTab'da temettü satırı + hata durumunda graceful fallback.
- [ ] `ROADMAP.md` Sprint 16 item'ları `[x]` işaretlendi; Sprint 17 bakış listesi güncellendi.

---

## Demo / Validation

1. **Multi-currency RPC**: Supabase Dashboard → SQL Editor → `SELECT * FROM get_allocation_only_positions('<test_portfolio_id>')` → USD+TRY karışık portföyde pct toplamı 100 (tolerans ±0.5).
2. **Watchlist policy**: Supabase Dashboard → Table Editor → `watchlist` satırında `ticker` UPDATE denemesi → DB hatası.
3. **html2canvas SRI**: DevTools → Network → `html2canvas.min.js` → Response Headers → `integrity` match; console'da SRI violation yok.
4. **ManuelPosForm**: TRY pozisyonu olan portföyde "Manuel Pozisyon Güncelle" → pozisyon listesinde TRY ticker'ı görünüyor.
5. **EUR sort**: EUR tablosunda sütun başlığına tıkla → sıralama değişiyor.
6. **signOut LS temizliği**: Arama yap → çıkış yap → `localStorage.getItem("il_recent_search")` DevTools Console → `null`.
7. **BIST cron**: Supabase Dashboard → `refresh-price-cache` manual tetikle → BIST/CRYPTO/GOLD ticker `updated_at` güncellendi.
8. **Temettü Takvimi**: AAPL held pozisyonu için TickerDetailTab → "Sonraki Temettü" satırı görünüyor. Temettü ödemeyen bir ticker için satır yok.

---

## Retro Alanı

*(Sprint bitiminde doldurulacak)*
