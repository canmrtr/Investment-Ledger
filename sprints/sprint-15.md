# Sprint 15 — 2026-05-10 → 2026-05-23

**Goal**: Aktif kullanımda yanlış veri gösteren ve API kotasını tehdit eden P1 açıkları kapatılır; Sprint 14'ten devreden brand-fit cümleleri tamamlanır — Can portföyünü açtığında hem güvenli hem doğru hem anlaşılır bir yüzey görür.

**Capacity**: 2 hafta × ~6h/hafta efektif ≈ ~12h toplam (hafta sonu + akşam)

---

## Bağlam: Sprint 14 Retro Özeti

Sprint 14 tüm scope'u teslim etti (7 commit, tek push). Brand-fit Item 5'in A-2/A-3/B-2 alt-task'ları kapasite nedeniyle bu sprint'e ötelendi. Audit Tur 4; 3 P1 edge security, 1 P1 veri doğruluğu, 2 P1 UI/veri uyumsuzluğu ve 9 P2 bulgu üretti. SEC email + hamburger LS leak sprint içinde fix edildi. Tüm babel/edge/drift check'ler geçti.

---

## Scope

### 1. Edge Security Fixes — Blok 1a + 1b + 1c `[S×3][P1]`

**Roadmap satırı**: `Bug & UX Backlog → Denetim Turu 4 Bulguları → P1`

**Neden bu sprint**: Anon kullanıcı `fetch-fundamentals`'ı JWT olmadan çağırarak Twelve Data/FMP kotasını boşaltabilir. `fetch-prices`'da `getUser()` try/catch dışında kalırsa edge runtime 500 üretiyor. BIST+USD pozisyonu yanlış venue'ya route ediliyor — stale fiyat.

**Alt-task'lar**:
- **1a `fetch-fundamentals` auth**: ticker-list / dividend-calendar / etf-country / default modlarında request başında `Authorization` header'dan `getUser` ile kimlik doğrula. `CRON_SECRET` ile gelen cron modları (`refresh-fund-cache`, `sync-ticker-db`) bypass'ta kalır. Referans: `fetch-fundamentals-edge-function.js`.
- **1b `fetch-prices` try/catch**: `getUser()` çağrısını mevcut try/catch bloğuna al veya `?.` güvenli çağrı yap; exception fırlatırsa `Response(JSON, {status:401})` döndür. Referans: `fetch-prices-edge-function.js:302-312`.
- **1c `refresh-price-cache` BIST routing**: `asset_type==="BIST"` kontrolünü `currency` kontrolünden önce yap; BIST tipi her zaman Yahoo Finance'e gitsin. Referans: `refresh-price-cache-edge-function.js:148-153`.

**DoD**:
- Anon Supabase client ile `fetch-fundamentals` çağrısı → `401` döner; cron çağrısı `CRON_SECRET` ile → normal çalışır.
- `fetch-prices`'da `getUser()` exception fırlatılırsa edge 500 yerine `401` JSON Response döner.
- BIST tipi, `currency=USD` olan pozisyon için `refresh-price-cache`'te Yahoo Finance kullanılır; console log'da doğrulanır.
- `edge-reviewer` agent üç dosyayı onaylar; `npm run check:edge` + `npm run check:edge-drift` geçer; her üç fn deploy edilir.

**Risk**: `fetch-fundamentals` auth eklenince frontend'deki mevcut `edgeCall` (anon) → `edgeCallAuth` (JWT) geçişi gerekebilir. `AnalysisTab.js` ve `App.js`'teki tüm `fetch-fundamentals` çağrıları `edgeCallAuth` kullanıyor mu kontrol et — kullanmıyorsa hata almaya başlar. Mitigation: `edge-reviewer` bu geçişi de kapsamalı.

---

### 2. Veri Doğruluğu — `computePeriod` DIV Eksikliği `[S][P1]`

**Roadmap satırı**: `UI Polish & Tutarlılık → Gerçek Buglar (P1) → "Dönem getirisi ve dönem XIRR temettüyü içermiyor"`

**Neden bu sprint**: "Dönem getirisi" Dashboard'da ve AnalysisTab'da aktif kullanımda görünüyor. Temettü hissesi olan kullanıcı için hesap eksik — değer yatırımcısı için doğrudan hata.

**Nasıl**:
- `computePeriod` fonksiyonunda (referans: `src/components/App.js:326-327,583,591-592`; `src/utils.js:304`): seçilen dönem içindeki `way==="DIV"` işlemlerini filtrele; `tr` hesabına dönem temettülerini ekle; dönem XIRR döngüsünde DIV'ları pozitif nakit akışı olarak push et.
- "Max" dönem zaten `totalDivs` kullanıyor — sadece alt dönemler (1G/1H/1A/3A/6A/1Y) etkileniyor.

**DoD**:
- 1 BUY + 1 DIV olan test senaryosunda dönem getirisi = `(MV_son - cost + div) / cost`; DIV sıfır dahil edildiğindeki eski değerden farklı.
- XIRR döngüsünde DIV pozitif cashflow olarak görünüyor; console kontrol edilebilir.
- `npm run check:babel` geçer; görsel regresyon yok (AnalysisTab yükleniyor).

**Risk**: Dönem XIRR hesabı karmaşık; negatif cashflow mantığını bozmamalı. DIV tarihi seçilen dönem dışındaysa dahil edilmemeli — tarih filtresi mevcut pattern'e uygun yapılmalı.

---

### 3. Brand-fit Devam — A-2 + A-3 `[S×2][P1]`

**Roadmap satırı**: `Gruplanmış Backlog → Grup A → Sprint 15 ertelenenleri (A-2, A-3)`

**Neden bu sprint**: Sprint 14'te yapılması planlandı; kapasite nedeniyle ötelendi. Bağlam cümleleri mevcut kartlarda zaten var (B-1 bölüm başlıkları teslim edildi); bu son iki adım.

**Alt-task'lar**:
- **A-2 BreakEven Analizi bağlam cümlesi**: Tablo üstüne veya her satıra: "Bu fiyatın `%X` üzerinde satış yapman gerekiyor" (pozitif → yeşil, negatif → sarı). Mevcut "Uzaklık" kolonu korunur ama cümle önce gelir. Referans: `src/components/AnalysisTab.js` BreakEven kartı.
- **A-3 FX Risk kartı açıklayıcı cümle**: "USD %62" raw rakam yerine kart başında "Portföyünün %62'si dolar kuru riskine açık" cümlesi. "Önerilen çeşitlendirme" satırı kaldırılır veya "Daha geniş çeşitlendirme riski azaltabilir" actionable metne dönüştürülür. Referans: `src/components/AnalysisTab.js` FX Risk kartı.

**DoD**:
- BreakEven kartında her satır için bağlam cümlesi mevcut; büyük portföyde de crash yok.
- FX Risk kartında kart başında cümle var; sayısal bar ikincil konumda.
- `ui-builder` agent her iki kartı onaylıyor; görsel regresyon yok.
- `npm run check:babel` geçer.

**Risk**: AnalysisTab ~2000+ satır; yanlış yerde değişiklik başka kartı bozabilir. Mitigation: kart başına ayrı commit; babel check her commit'te.

---

### 4. Brand-fit Devam — B-2 Bağlam/Birim `[S][P2]`

**Roadmap satırı**: `Gruplanmış Backlog → Grup B → B-2 (Sprint 15 ertelendi)`

**Neden bu sprint**: A-2/A-3 ile birlikte aynı dosya; tek PR'a alınabilir. Küçük; bağımsız.

**Alt-task'lar**:
- **Komisyon kartı bağlam**: "₺1,240 / yıl" yanına "— getirinin yaklaşık %0.8'i" cümlesi. Getiri oranı `totalComm / totalMV_TRY * 100` ile hesaplanır; FX veri eksikse bu bağlam satırı atlanır.
- **Konsantrasyon Riski HHI → cümle**: HHI sayısını ve formülü kaldır; yerine "Portföyünün %67'si ilk 3 pozisyona yoğunlaşmış" cümlesi + renk pill (kırmızı/sarı/yeşil). HHI hesabı arka planda devam eder ama ekrana çıkmaz.

**DoD**:
- Komisyon kartında bağlam satırı var; FX eksikse bu satır çıkmıyor (safe fallback).
- Konsantrasyon Riski'nde HHI formülü metin olarak ekranda görünmüyor; cümle + pill var.
- `ui-builder` agent onaylıyor.

**Risk**: Düşük. Sadece `AnalysisTab.js`'te metin/render değişikliği.

---

### 5. Audit P2 Batch — bist.annual + raw error + divcal ticker validation `[S×3][P2]`

**Roadmap satırı**: `Bug & UX Backlog → Denetim Turu 4 Bulguları → P2`

**Neden bu sprint**: Üçü de `[S]`, hepsi edge function veya tek satır frontend fix. Blok 1 ile birlikte edge deploy fırsatı — overhead sıfır.

**Alt-task'lar**:
- **5a `fetch-fundamentals:820-821` `bist.raw?.annual` → `bist.annual`**: Tek satır düzeltme. BIST annual verisi `null` yazılıyor; fund_cache'te BIST fundamental trendi kırık. Referans: `fetch-fundamentals-edge-function.js:820-821`.
- **5b `parse-transaction:136-138` raw error generic**: Hata response'unda `raw.slice(0,500)` yerine `"Parse edilemedi"` generic mesaj; `raw` sadece `console.error` ile sunucu loguna yaz. Referans: `parse-transaction-edge-function.js:136-138`.
- **5c `fetch-fundamentals:703-728` `dividend-calendar` ticker validation**: Gelen `ticker` parametresine `^[A-Z0-9.\-]{1,12}$` regex guard ekle; eşleşmezse `400 Bad Request`. Referans: `fetch-fundamentals-edge-function.js:703-728`.

**DoD**:
- BIST ticker için fund_cache'te `annual` dizi verisi var (artık `null` değil); `fetch-fundamentals` BIST annual dalı doğru çalışıyor.
- `parse-transaction` hata response'unda `raw` içerik yok; sunucu log'da `console.error` var.
- `dividend-calendar` moduna geçersiz ticker (`; DROP TABLE`)gönderilince `400` dönüyor.
- `edge-reviewer` agent üç değişikliği onaylıyor; deploy yapılıyor.

**Risk**: 5b'de `console.error` sunucu tarafı log — Supabase Dashboard'dan izlenebilir; istemci hiç raw görmüyor.

---

## Out of Scope (bilinçli ertelenenler)

- **`get_allocation_only_positions` multi-currency [M][P1]** — Önemli ama migration + RPC değişikliği + frontend; rls-auditor sign-off gerekiyor. Sprint 15 kapasitesini patlatır. Sprint 16'nın ilk item'ı.
- **"Tam Detay" UI/veri uyumsuzluğu [S][P1]** — Settings UI'ı düzeltilmesi veya public portföy view'ının genişletilmesi; Social Faz 2 ile birlikte ele alınacak.
- **`watchlist` policy FOR ALL → INSERT/SELECT/DELETE [S][P2]** — Migration gerekiyor; rls-auditor sign-off. Sprint 16 audit batch'ine ekle.
- **SRI hash html2canvas [S][P2]** — Güvenlik hygiene; acil değil. Sprint 16.
- **Kullanıcı tanımlı fundamental eşikler [M][P2]** — Plan dosyası hazır; Settings form UI büyük; Sprint 16.
- **Piyasa Dayanıklılık Skoru [M][P2]** — fundamentals cache aggregation; Sprint 16.
- **Social Portfolios Faz 2 [M][P2]** — Personal anlama katmanı tamamlanmadan Sprint 16+.
- **Temettü Takvimi [M][P2]** — FMP hazır; Sprint 16.

---

## Definition of Done

- [x] Item 1 (1a+1b+1c): `edge-reviewer` onayı + `npm run check:edge` + `npm run check:edge-drift` geçti + 3 fn deploy edildi.
- [x] Item 2: `computePeriod` DIV dahil; dönem getirisi DIV olan portföyde değişiyor; `npm run check:babel` geçti.
- [x] Item 3 (A-2+A-3): `ui-builder` onayı; BreakEven + FX Risk kartları bağlam cümleli; `npm run check:babel` geçti.
- [x] Item 4 (B-2): `ui-builder` onayı; HHI formül metni ekranda yok; Komisyon bağlam satırı var.
- [x] Item 5 (5a+5b+5c): `edge-reviewer` onayı; BIST annual dolu; raw error generic; divcal ticker validation `400`.
- [x] `ROADMAP.md` Sprint 15 item'ları `[x]` işaretlendi; Sprint 16 sarkan item'lar listelendi.

---

## Demo / Validation

1. **Security**: Supabase Dashboard → Edge Functions → Test tab → `fetch-fundamentals` body `{"mode":"ticker-list"}` ile anon key (Authorization header'sız) → `401` döner.
2. **Dönem getirisi**: DIV işlemi olan bir ticker için AnalysisTab Dönem Bazlı Getiri → dönem seçiminde "1A" seçilince DIV tutarı dahil hesap yapılıyor; DIV sıfır dahil edildiğindeki rakamdan farklı.
3. **Brand-fit**: BreakEven tablosunda her satırda bağlam cümlesi mevcut; FX Risk kartında "Portföyünün X%'i..." cümlesi var; Konsantrasyon Riski'nde HHI formülü metin olarak yok.
4. **BIST annual**: BIST fundamental çekilen bir ticker için fund_cache'te `annual` array boş array değil, gerçek veri içeriyor.
5. **Edge deploy**: `npm run check:edge-drift` geçiyor; Supabase Dashboard'da 3 fn son deploy zamanı güncellendi.

---

## Retro Alanı

**Teslim tarihi**: 2026-05-11 | **Commit sayısı**: 6 commit, main'e push edildi.

**Ne iyi gitti:**
- Edge security bloku (1a+1b+1c) beklenenden temiz çıktı; JWT try/catch wrapper + skipJwt flag pattern tekrar kullanılabilir.
- `computePeriod` DIV fix tek dosyada izole kaldı; XIRR tarafı beklenenden kolay entegre oldu.
- Brand-fit A-2/A-3/B-2 AnalysisTab'ı görsel olarak netleştirdi; "aboveBE/belowBE özet cümlesi" özellikle değer kattı.
- 5a audit bulgusu (`bist.raw?.annual`) önceki sprint'te zaten düzeltilmişti; audit sırasında teyit edildi — bu bir "free pass".

**Ne zordu:**
- Item 3 ve 4 implementer subagent'ları commit yapmayı unuttu; main branch'te unstaged değişikler kaldı. Fix agent + manuel commit ile düzeltildi. Subagent prompt'larına "commit et" talimatı daha açık yazılmalı.
- Spec reviewer, `distPct` renk mantığını yanlış flagladı (pre-existing code) — gereksiz review döngüsüne yol açtı. Reviewer context'ine "sprint-15 scope'u dışındakileri flagleme" notu eklenebilir.

**Sprint 16 ilk sıra:**
- `get_allocation_only_positions` multi-currency (migration + RPC)
- `watchlist_own` policy FOR ALL → INSERT/SELECT/DELETE split
- SRI hash html2canvas
- ManuelPosForm currency filtresi + EUR sort + BIST/CRYPTO/GOLD cron refresh batch
- Temettü Takvimi (dividend-calendar mode + UI)
- `il_recent_search` signOut temizliği (LS key user-scope)
