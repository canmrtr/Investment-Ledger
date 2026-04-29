# Sprint 07 — 2026-04-30 → 2026-05-13

**Goal**: Portföy artık temettü de dahil tam getiri gösteriyor; risk tablosu (volatilite + kur riski) ve sosyal altyapı denetimden geçirilmiş — "değer yatırımcısının günlük aracı" hissiyatı pekişiyor.

**Capacity**: 2 hafta × ~6h/hafta efektif ≈ ~12h toplam (hafta sonu + akşam)

---

## Scope

### Milestone A — Güvenlik Denetimi (önce, blokları kaldır)

1. **Periyodik agent denetim turu (2. tur)** — Social Portfolios Faz 1 RLS doğrulaması dahil.
   - Roadmap: `Güvenlik & Süreç → "Periyodik agent denetim turu (her 2-3 sprint)"` `[S][P1]`
   - Neden bu sprint ve neden önce: Social Portfolios Faz 1 yeni tablolar + FK + RLS getirdi; bu altyapının izolasyon açığı olmadan çalıştığını doğrulamadan Faz 2'ye geçmek riskli. Sprint 6'dan kalan Milestone C.
   - DoD:
     - `rls-auditor` Social Portfolios tabloları için user isolation onayı verir (`portfolios`, `follows`, `portfolio_activities`; `portfolio_id` FK'lı `positions`/`transactions`/`splits`)
     - `client-security-auditor` Sprint 6 yeni kartlarında (Break-Even, Max Pain) ve Social write path'lerinde XSS/leak/privacy-mode regression tarar
     - `edge-reviewer` mevcut 4 edge function için son değişiklikleri (Social altyapı, port threading) gözden geçirir
     - `test-runner` E2E smoke: login → Dashboard → AnalysisTab (Break-Even + Max Pain kartları) → AddTab → HistoryTab
     - Kritik/high bulgu varsa Sprint 7 backlog'unda öncelikli item olarak eklenir; bloker yoksa Milestone B'ye devam

---

### Milestone B — Dividend Tracking (sprint'in ana özelliği)

2. **Dividend (temettü) tracking** — BIST + US için temettü girişi; total return'e dahil.
   - Roadmap: `Asset Type Genişletme → "Dividend (temettü) tracking"` `[M][P1]`
   - Neden bu sprint: Value-investing aracının en temel eksik parçası. Gerçek total return (fiyat artışı + temettü) olmadan XIRR da yanıltıcı. `transactions.way` zaten `BUY`/`SELL` string; `DIV` eklemek için schema CHECK constraint varsa kaldırmak ya da güncellenmek gerekiyor.
   - DoD:
     - `transactions.way` alanı `DIV` değerini destekler (CHECK constraint güncellenmiş veya kaldırılmış; sql-writer ile)
     - HistoryTab'da `DIV` işlemleri ayrı ikonla gösterilir (₺/$ rozeti, "Temettü" etiketi)
     - AddTab / ManuelPosForm'a temettü girişi eklenir: ticker, tarih, tutar, para birimi (shares opsiyonel — hisse başı × adet veya toplam)
     - Dashboard Total Return hesabı temettü gelirlerini `+` olarak dahil eder (XIRR cash flow serisine de eklenir)
     - BIST 2 yıl muafiyet bilgisi: UI'da sadece bilgilendirme notu (hesap dışı — vergi tab ileride)
   - Risk: `buildCashflows` + Total Return hesabı `DIV` way'ini handle etmeli; yan etki testi kritik → test-runner E2E dahil edilmeli
   - Bağımlılık: Milestone A (rls-auditor) önce bitmeli; sql-writer schema migration için çağrılacak

---

### Milestone C — Risk Dashboard (frontend-only, hızlı kazanım)

3. **Volatilite / Drawdown Analizi** — `price_cache.p_d1/w1/m1/y1` değişim yüzdelerinden portföy risk göstergesi.
   - Roadmap: `Analiz Tab → Risk → "Volatilite / Drawdown Analizi"` `[S][P1]`
   - Neden bu sprint: Sıfır yeni API çağrısı — `price_cache` zaten `p_d1/w1/m1/y1` tutuyor. Break-Even + Max Pain kartlarının doğal devamı. 1 akşamlık iş.
   - DoD:
     - AnalysisTab'da yeni kart: "Volatilite & Drawdown"
     - Her pozisyon için `|p_m1|` günlük oynaklık proxy; ağırlıklı portföy volatilitesi (piyasa değeri ağırlığı)
     - En yüksek volatilite 3 pozisyon "Yüksek Volatilite" işaretli (kırmızı pill)
     - `price_cache` verisi yoksa (yeni pozisyon vb.) o satır gri "veri yok" ile geçilir

4. **Kur Riski Göstergesi** — TRY/USD/EUR exposure + "₺ %10 değer kaybı portföyü $X etkiler" simülasyonu.
   - Roadmap: `Analiz Tab → Risk → "Kur Riski Göstergesi"` `[S][P1]`
   - Neden bu sprint: `convert()` + `fxRates` zaten mevcut; Max Pain kartının kur etkisi hesabının genişletilmiş versiyonu. BIST + FX pozisyonu olan kullanıcı için doğrudan değer.
   - DoD:
     - AnalysisTab'da yeni kart: "Kur Riski"
     - TRY / USD / EUR exposure pasta veya yatay bar (display currency dışından olanların toplamı)
     - "₺ %10 değer kaybı senaryosu: USD pozisyonlarınız ₺X daha değerli görünür, TRY pozisyonlarınız $Y kaybeder" özet cümlesi
     - `fxRates` null ise warn-card

5. **Dönem Bazlı Getiri Karşılaştırması** — Hisse bazında 1A/3A/6A/1Y getiri horizontal bar chart.
   - Roadmap: `Analiz Tab → Performans → "Dönem Bazlı Getiri Karşılaştırması"` `[S][P1]`
   - Neden bu sprint: `price_cache.p_d1/w1/m1/y1` yeterli; Win/Loss kartının doğal devamı; yeni fetch yok.
   - DoD:
     - AnalysisTab'da yeni kart: "Dönem Getirileri"
     - Seçilebilir dönem chip (1A / 3A / 6A / 1Y); her pozisyon yatay bar (yeşil/kırmızı)
     - Kazanandan kaybedene sıralı; fiyatı olmayan pozisyon gri "veri yok"
     - Global `dashTypeFilter` filtresine uyar

---

## Out of Scope (bilinçli ertelenenler)

- **Social Portfolios Faz 2** `[M][P2]` — Faz 1 altyapısı hazır ama Faz 2 (UserProfileModal, is_public toggle, RLS okuma politikası) tek başına M-effort. Sprint 8'e ertelendi; Can'ın "kritik değil ama geleceğe hazırlık" notuna uygun şekilde altyapı önce sağlamlaştırılacak.
- **Temettü Getiri Projeksiyonu** `[S][P1]` — Dividend tracking (Milestone B) tamamlanmadan anlamlı değil; Sprint 8'de dividend verisini okuyarak çalışacak.
- **Sektör-aware fundamental eşikler** `[M][P1]` — Daha geniş fundamental refactor bekliyor; Sprint 8-9.
- **Ağırlıklı Ortalama Portföy P/E** `[S][P2]` — Fundamentals cache zaten hazır, ancak bu sprint kapasitesi doldu. Milestone C tamamlanırsa bonus.
- **maxLength ticker/name/broker + a11y polish bundlei** `[S][P2]` — Sprint 8 polish bundleı.
- **BIST/CRYPTO/GOLD cron refresh** `[S][P2]` — Ölçeklenme bölümü; P1'ler bitmeli önce.

---

## Demo / Validation

Sprint sonu başarı sinyalleri:

1. **Agent denetim**: rls-auditor, Social Portfolios tablolarında kullanıcı A'nın verilerini kullanıcı B göremez doğrular. Kritik bulgu yok veya bulgu Sprint 7 backlog'unda işaretli.
2. **Temettü girişi**: THYAO veya AAPL için temettü işlemi eklenir → HistoryTab'da "DIV" ikonu ile görünür → Dashboard Total Return artar → XIRR cash flow serisine dahil olduğu doğrulanır.
3. **Volatilite kartı**: En az 3 US pozisyonlu portföyde "Yüksek Volatilite" rozeti AAPL/BTC gibi oynaylı ticker'larda görünür.
4. **Kur Riski kartı**: TRY + USD mix portföyde "%10 TRY değer kaybı etkisi" hesabı `convert()` ile manuel doğrulanır.
5. **Dönem Getirileri kartı**: `price_cache.p_m1` → her pozisyon için % doğru işaret ve büyüklükte bar gösterilir.

---

## Retro Alanı (Sprint sonu doldur)

_Neler çıktı, neler kaldı, neden kaldı — bir paragraf._
