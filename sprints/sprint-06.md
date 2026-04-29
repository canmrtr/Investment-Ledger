# Sprint 06 — 2026-04-29 → 2026-05-10

**Goal**: Portföy, "sabah baktığımda risk tablomu görebiliyorum" — break-even, max pain ve sektör dağılımı düzgün çalışıyor; UI'da kırık kalmıyor.

**Capacity**: 12 gün × ~5h/hafta efektif ≈ ~10h toplam (hafta sonu + akşam)

---

## Scope

### Milestone A — Bug & Polish (hızlı, engel kaldır)

1. **Sektör Dağılımı "Bilinmiyor" bug fix** — Analiz Tab'daki mevcut kart çalışmıyor.
   - Roadmap: `Bug & UX Backlog → "Sektör Dağılımı — tümü Bilinmiyor görünüyor"` `[S][P1]`
   - Neden bu sprint: Sprint 5'te gönderilen özellik; kart açıldığında hiçbir şey göstermiyor. Kullanıcıya boş kart sunmak, özelliği hiç yoktan kötü.
   - DoD:
     - Kart açıldığında `metaCacheGet(ticker)` boş dönen pozisyonlar için otomatik meta fetch tetiklenir (max 3'er chunk; zaten meta varsa tekrar çekilmez)
     - ETF/FUND ticker'larında `sic_description = null` ise "ETF / Fon" etiketi gösterilir
     - Gerçek sektör verisi olmayan (meta fetch sonrası da null) entry "Diğer" olarak gruplanır; "Bilinmiyor" etiketi kaldırılır
     - BIST için `borsa-mcp sector` → `industry` fallback zinciri kontrol edilir
   - Risk: borsa-mcp latency chunk fetch'i yavaşlatabilir → chunk boyutu 3-4 ile sınırlı tutulur; "Yükleniyor..." spinner gösterilir

2. **Period buton wrap — dar ekran** — 320px iPhone SE'de period chip'leri üst üste binip zıplıyor.
   - Roadmap: `Sprint Audit Backlog → Grup 2 → "Period buton wrap dar ekran"` `[S][P1]`
   - Neden bu sprint: Sprint 3-4-5'ten taşındı, CSS-only fix, <30dk; artık yok sayılmamalı.
   - DoD:
     - 320px viewport'ta period butonları ezilmiyor; satır içi kalıyor ya da yatay scroll ile görünür
     - `flex:1 + minWidth:40px` yerine `.fbar` pattern (overflow-x:auto, no-wrap) uygulanır
     - Mevcut `.fbar` CSS class'ı zaten hazır — sadece period row'una uygulanacak

3. **EUR tablosu sort** — Dashboard EUR pozisyon bloğu statik listeleniyor; ticker alfabetik sort yok.
   - Roadmap: `Sprint Audit Backlog → Grup 1 → "EUR tablosu sort"` `[S][P1]`
   - Neden bu sprint: S-effort, 2 satır kod; diğer USD/TRY tablolarıyla tutarlılık sağlar.
   - DoD:
     - EUR bloğu en azından Ticker alfabetik sırayla gösterilir
     - Mevcut `sortPos` state'i EUR bloğuna da uygulanır (veya blok bazında minimal sort)

---

### Milestone B — Yeni Analiz Kartları (frontend-only, yeni fetch yok)

4. **Başa Baş (Break-Even) Analizi** — Her pozisyon için komisyon dahil gerçek break-even fiyatı + piyasaya uzaklık.
   - Roadmap: `Analiz Tab → Performans → "Başa Baş (Break-Even) Analizi"` `[S][P1]`
   - Neden bu sprint: Tamamen frontend hesabı (`positions.avg_cost` + `transactions` komisyon toplamı + `price_cache`). Yeni API çağrısı yok. "THYAO'nun ₺52.3'e çıkması gerekiyor · %8 uzakta" — günlük "nerede duruyorum?" sorusuna anlık yanıt.
   - DoD:
     - AnalysisTab'da yeni kart: "Başa Baş Analizi"
     - Her açık pozisyon için: `break_even = (Σ(shares×cost) + Σ komisyon) / toplam_shares`; `distance = (current_price - break_even) / break_even × 100`
     - Renk pill: `distance > 0` → yeşil ("kârda"), `distance < 0` → kırmızı (uzakta)
     - `price_cache`'te fiyatı olmayan pozisyonlar gri "fiyat yok" etiketi ile listede yer alır, hesaplamadan çıkar
     - Global `dashTypeFilter` filtresine uyar

5. **Potansiyel Kayıp (Max Pain) Simülasyonu** — %10/%20/%30 piyasa düşüşü senaryosu; kur etkisi ayrıca.
   - Roadmap: `Analiz Tab → Risk (Ek) → "Potansiyel Kayıp (Max Pain) Simülasyonu"` `[S][P1]`
   - Neden bu sprint: Tamamen frontend; `convert()` + `fxRates` + `prc[]` hazır. "Sabah ne kadar riske giriyorum?" sorusu — value-investing power-tool için temel risk metrikleri.
   - DoD:
     - AnalysisTab'da yeni kart: "Kayıp Simülasyonu"
     - 3 senaryo (%10 / %20 / %30) × mevcut portföy değeri; display currency'de toplam kayıp tutarı
     - Kur etkisi ayrı satır: "₺'nin %10 değer kaybı ekleniyle toplam etki: -$X" (sadece TRY/USD cross pozisyonlarda)
     - Yatay bar chart (kırmızı tonları, en fazla 3 bar)
     - Global `dashTypeFilter` filtresine uyar; FX rates yoksa warn-card

---

### Milestone C — Sprint Kapanış (son gün)

6. **Periyodik agent denetim turu (2. tur)** — Sprint 5 sonu olması planlanan tur, Sprint 6 kapanışına alındı.
   - Roadmap: `Güvenlik & Süreç → "Periyodik agent denetim turu (her 2-3 sprint)"` `[S][P1]`
   - Neden bu sprint: 2 sprint birikti; güvenlik borcunu ertelememek gerekiyor.
   - DoD:
     - `client-security-auditor`, `edge-reviewer`, `rls-auditor` paralel çalıştırılır
     - `test-runner` E2E smoke (login, Dashboard, AnalysisTab yeni kartlar)
     - Bulunan kritik/high bulgular Sprint 7 backlog'una öncelikli eklenir
     - Denetim özeti bu sprint dosyasına ek olarak yazılır

---

## Out of Scope (bilinçli ertelenenler)

- **Dividend (temettü) tracking** `[M][P1]` — Schema değişikliği (`transactions.way:"DIV"` CHECK kaldır veya ekle, Dashboard total return entegrasyon) tek başına M-effort. Sprint 7'nin ana teması olarak planlanacak; bu sprint onun ön koşullarını temizliyor.
- **Sektör-aware fundamental eşikler** `[M][P1]` — dividend tracking ve daha geniş fundamental refactoru bekliyor. Sprint 7-8.
- **Volatilite / Drawdown + Kur Riski Göstergesi + Temettü Getiri Projeksiyonu** `[S][P1]` — Üç item birlikte "Risk Dashboard" teması oluşturuyor. Sprint 7'de tek milestone olarak çıkmak daha anlamlı.
- **Dönem Bazlı Getiri Karşılaştırması** `[S][P1]` — Win/Loss kartının doğal devamı; Sprint 7'de Win/Loss refactor ile birlikte çıkar.
- **BIST/CRYPTO/GOLD cron refresh** `[S][P2]` — Ölçeklenme bölümü; önce P1'ler bitmeli.
- **maxLength ticker/name/broker** `[S][P2]` — Sprint 7 polish bundleı.

---

## Demo / Validation

Sprint sonu başarı sinyalleri:

1. **Sektör kartı**: En az 3 US hisseli portföyde "Meta Çek" sonrası sektör pie dolu gelir; ETF ayrı "ETF / Fon" dilimi görünür; "Bilinmiyor" dilimi ya yok ya çok küçük.
2. **Break-Even kartı**: THYAO veya AAPL pozisyonunda hesaplanan break-even fiyatı elle doğrulanır (`avg_cost × shares + komisyon / shares`); mesafe rengi doğru.
3. **Max Pain kartı**: Mevcut portföy değerinin %10'u kaybının display currency'deki karşılığı doğru hesaplanır.
4. **Period butonlar**: iPhone SE simülatörü (320px) veya Chrome DevTools'ta 320px genişlikte period row'u single line'da kalır.
5. **EUR sort**: EUR bloku Ticker'a göre alfabetik sıralı.
6. **Agent denetim turu**: 3 agent raporu tamamlandı; kritik bulgu yoksa Sprint 7'ye geçiş onaylanır.

---

## Retro Alanı

**Tamamlananlar (2026-04-29):**
Milestone A ve B tam teslim edildi. Sektör Dağılımı artık açılışta otomatik meta fetch yapıyor; CRYPTO/GOLD/FX/FUND için tip bazlı fallback etiketleri çalışıyor. Period butonlar 320px'de yatay scroll ile düzgün görünüyor. Break-Even Analizi (kart 7) ve Potansiyel Kayıp Simülasyonu (kart 8) frontend-only, sıfır yeni API çağrısı ile teslim edildi — bu ikisi için öngörülen kapasiteyle birebir örtüştü.

**Scope dışından gelen:** Social Portfolios Faz 1 (multi-portfolio altyapısı) bu sprint'in planında yoktu ama sprint sırasında teslim edildi. `portfolios` / `follows` / `portfolio_activities` tabloları, `portfolio_id` FK migrasyonu, backfill, RLS ve tüm frontend write path threadingleri tamamlandı. Bu, Sprint 7-8'de hayata geçecek olan sosyal özelliklerin temelini attı.

**Kalan:** Milestone C (agent denetim turu) yapılmadı. Sebebi: Social Portfolios Faz 1 altyapısı denetim kapsamını genişletti (yeni tablolar + RLS politikaları) — mevcut agent çalışması eksik olurdu. Sprint 7'nin ilk adımı olarak daha değerli ve zamanında gerçekleşecek.
