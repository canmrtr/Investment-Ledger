# Sprint 09 — 2026-04-30 → 2026-05-13

**Goal**: Portföy, artık "bu hisseyi ne kadar süre tuttum ve gerçekten ne kazandırdı?" sorusunu CAGR + Dayanıklılık Skoru + Portföy F/K ile yanıtlıyor; sosyal altyapı public portföy paylaşımına hazır; uygulama mobil ana ekrana eklenebilir.

**Capacity**: 2 hafta × ~6h/hafta efektif ≈ ~12h toplam (hafta sonu + akşam)

---

## Scope

### Milestone A — Analitik Derinleştirme (önce; yeni fetch yok, hızlı kazanım)

1. **Ağırlıklı Ortalama Portföy P/E** — AnalysisTab Portföy Sağlık Tablosu altına tek-satır KPI.
   - Roadmap: `Analiz Tab → Karşılaştırma → "Ağırlıklı Ortalama Portföy P/E"` `[S][P2]`
   - Neden bu sprint: Fundamentals cache (`fund_${ticker}`) zaten mevcut; sıfır yeni API çağrısı. Portföy Sağlık Tablosu'nun doğal tamamlayıcısı. 1-2 saatlik iş. Sprint'in en hızlı kazanımı; güven oluşturur.
   - DoD:
     - `fund_${ticker}` LS cache'ten MV-ağırlıklı P/E ortalaması hesaplanır; P/E null olan pozisyonlar atlanır
     - AnalysisTab Portföy Sağlık Tablosu başlığının hemen altında (ya da kart içinde ayrı satır) "Portföy F/K: 18.4" tek sayı + "(X pozisyon dahil, Y veri yok)" küçük notu
     - S&P 500 karşılaştırma cümlesi: ~22 hardcoded referans; altında/üstünde bağlam etiketi (yeşil/kırmızı pill)
     - Sağlık Tablosu kapalıyken de KPI görünür (collapsible dışında)
   - Risk: Fundamentals cache boş ise "Veri yok — Sağlık Tablosundan çek" yönlendirmesi yeterli; crash yok.

2. **Pozisyon Yıllık Getiri (CAGR) Tablosu** — AnalysisTab yeni kart.
   - Roadmap: `Analiz Tab → Performans (Ek) → "Pozisyon Yıllık Getiri (CAGR) Tablosu"` `[S][P2]`
   - Neden bu sprint: `transactions` BUY tarihleri + `price_cache` mevcut; split-adjusted mantığı `factorFor` zaten var; `rebuildPositions` pattern'ını biliyoruz. Uzun vadeli yatırımcı için "hangi hisse gerçekten çalıştı?" sorusunun yanıtı.
   - DoD:
     - Her açık pozisyon için: `firstBuyDate` = o ticker'ın ilk BUY işlem tarihi; `years` = (today − firstBuyDate) / 365
     - CAGR = `(currentMV / totalCost) ^ (1 / years) − 1`; `years < 0.1` ise (30 günden az) "Yeni Pozisyon" göster
     - Tablo: Ticker | Süre | Toplam Getiri % | Yıllık CAGR % — CAGR azalan sıraya göre
     - Fiyat yoksa satır gri + "fiyat bekleniyor" notu; click → openDetail
     - `dashTypeFilter` global filtresiyle uyumlu (filteredPos üzerinden hesap)
   - Risk: `transactions` boşsa (sadece manuel pozisyon) firstBuyDate bulunamaz → pozisyon atlanır, tablo notu "Bu pozisyon için işlem tarihi bulunamadı".

3. **Piyasa Düşüşü Dayanıklılık Skoru** — AnalysisTab yeni kart.
   - Roadmap: `Analiz Tab → Risk (Ek) → "Piyasa Düşüşü Dayanıklılık Skoru"` `[M][P2]`
   - Neden bu sprint: Fundamentals cache yeterli; "Eksikleri Çek" CTA pattern Sağlık Tablosu'ndan kopyalanır. Value-investing araç olarak portföyün kalitesini tek sayıya indirger.
   - DoD:
     - `resilienceScore(fund)` helper: `debtToEquity < 0.5` (+2), `fcfMargin > 0.10` (+2), `operatingMargin > 0.15` (+2) → toplam 0-6 → 1-10 scale (`Math.round(raw/6*9)+1`); fund null veya tüm metrikler null → `null`
     - Portföy skoru: MV-ağırlıklı ortalama (sadece null-olmayan skorlar dahil); ağırlıklı "dayanıklı" payı = skor ≥ 7 pozisyonların MV toplamı / total
     - "Portföyünüzün %62'si resesyona dayanıklı şirketlerden oluşuyor" özet satırı
     - "Eksikleri Çek" CTA (Sağlık Tablosu pattern): fund cache boş pozisyonlar için sıralı fetch; progress göstergesi
     - CRYPTO/GOLD/FX/FUND ve BIST bankalar (ISY_KNOWN_BANKS) kart dışı — küçük kapsam notu
   - Risk: Tüm pozisyonlar null skor dönerse kart "Veri yetersiz — Eksikleri Çek" CTA ile görünür; crash yok.
   - Bağımlılık: 1. item (P/E) önce bitmeli değil ama paralel ilerlenebilir; Sağlık Tablosu CTA kodu referans alınacak.

---

### Milestone B — Social Portfolios Faz 2 (sprint'in ana özelliği)

4. **Social Portfolios Faz 2 — Public Portföy Paylaşımı**
   - Roadmap: `Sosyal & Kişiselleştirme → "Social Portfolios Faz 2"` `[M][P2]`
   - Neden bu sprint: Faz 1 DB altyapısı (portfolios, follows, portfolio_activities tabloları + RLS) hazır; önkoşul karşılandı. Faz 2 kullanıcıya somut değer katar: portföyünü paylaşabilir.
   - Alt-hikayeler (bu sırayla):

   **4a. is_public toggle — Settings** `[S]`
   - DoD:
     - Settings → "Portföy" bölümüne "Portföyümü herkese açık yap" toggle switch eklenir
     - `UPDATE portfolios SET is_public=? WHERE id=activePortfolioId AND user_id=auth.uid()` çağrısı
     - Kapalıyken "Sadece siz görebilirsiniz" notu; açıkken "Bağlantısı olan herkes pozisyonlarınızı görebilir" uyarısı (privacy-first)
     - Confirm dialog: is_public=true yaparken "Portföyünüz herkese açık olacak. Devam edilsin mi?" — `confirm_()` ile

   **4b. RLS okuma politikası — sql-writer ile** `[S]`
   - DoD:
     - `positions` tablosunda: `authenticated` kullanıcılar `is_public=true` portföylere SELECT erişimi (portfolio_id → portfolios.is_public join)
     - `portfolios` tablosunda: `authenticated` kullanıcılar `is_public=true` portföyleri SELECT edebilir
     - `transactions` tablosuna okuma politikası: `is_public=true` portföylerde de görünür (opsiyonel — ilk versiyon sadece pozisyonlar yeterli)
     - rls-auditor sign-off: kullanıcı A, kullanıcı B'nin private portföyüne erişemiyor; public portföye erişebiliyor doğrulaması
     - Migration: `003_social_faz2_rls.sql`

   **4c. UserProfileModal** `[M]`
   - DoD:
     - Settings → Account bölümüne "Profilim" butonu; tıklanınca modal açılır
     - Modal içeriği: avatar emoji picker (12 emoji grid — kullanıcı seçer, `profiles.avatar_emoji` kolonu — migration gerekli veya `profiles` tablosunda `extra JSONB` varsa oraya)
     - Bio alanı: 160 karakter max free text; `profiles.bio` kolonu (migration gerekli)
     - Kullanıcının public portföyleri: `is_public=true` portföy kartları (portföy adı + oluşturma tarihi)
     - Kaydet butonu; SQL migration: `ALTER TABLE profiles ADD COLUMN bio TEXT, ADD COLUMN avatar_emoji TEXT`

   **4d. Public portföy read-only view** `[S]`
   - DoD:
     - Bir kullanıcı kendi public portföy linkini paylaşabilir: `?portfolio=<uuid>` query param ile uygulama açıldığında o portföy read-only modda görünür
     - Veya: searchTab'dan kullanıcı arama (username prefix) → UserProfileModal → portföy tıkla → read-only view
     - Read-only view: pozisyon listesi (ticker + type + % dağılım); tutar/maliyet gizli (privacy-by-default — kullanıcı is_public'i açık tutsa da hassas tutar bilgisi gösterilmez)
     - "Bu portföy salt okunur görünümdür" sticky banner; hiçbir yazma işlemi tetiklenmez
   - Risk: URL-based sharing şimdilik basit tutulur (hash routing değişikliği gerektirmez; query param yeterli). SPA deep-link GitHub Pages'de çalışmaz doğrudan — yönlendirme notu eklenir.

   - Bağımlılık: 4a → 4b → 4c → 4d sırasıyla. 4b rls-auditor onayı olmadan 4d'ye geçme.

---

### Milestone C — PWA + Küçük Düzeltmeler (sprint sonu)

5. **Progressive Web App (PWA) hazırlığı**
   - Roadmap: `Mobil Uygulama → Aşama M1 → "PWA hazırlığı"` `[M][P1]`
   - Neden bu sprint: index.html mimarisini bozmaz; App Store başvurusu gerektirmez; mobil kullanıcı "Ana Ekrana Ekle" yapabilir. Kapasitede en az riskli M-item.
   - DoD:
     - `manifest.json`: name "Investment Ledger", short_name "IL", start_url "/Investment-Ledger/", display "standalone", background_color "#000", theme_color "#6658ff"; icons 192px + 512px PNG (placeholder ikon kabul edilir — gerçek tasarım ileride)
     - `service-worker.js`: install event precache (index.html + manifest.json); fetch event network-first for Supabase/edge calls, cache-first for shell assets; offline'da stale index.html gösterir
     - `index.html` head: `<link rel="manifest" href="/Investment-Ledger/manifest.json">` + `<meta name="theme-color" content="#6658ff">` + `<meta name="apple-mobile-web-app-capable" content="yes">` + `<meta name="apple-touch-icon">`; service worker registration script (register if `'serviceWorker' in navigator`)
     - Chrome DevTools → Application → Manifest: tüm alanlar dolu; "installable" kriterleri karşılandı
   - Risk: GitHub Pages HTTPS + same-origin — service worker kaydında sorun yaşanmaz. Offline'da Supabase auth token geçerliyse dashboard veri gösterir (cache'teki veri). Token yoksa login sayfası gösterilir.

6. **Küçük düzeltmeler (freebie bundle)** — toplam ~30 dk
   - **İş Yatırım fetch timeout** `[S][P2]`: `fetch-fundamentals` isyatirim call'larına `AbortSignal.timeout(8000)` ekle; edge fn asılı kalma sorunu kapatılır. (edge-reviewer bulgusu — Sprint 7)
   - **il_recent_search signOut temizliği** `[S][P2]`: `signOut` handler'a `localStorage.removeItem('il_recent_search')` eklenir; kullanıcı çıkış yapınca arama geçmişi sıfırlanır.
   - **BIST/CRYPTO/GOLD cron refresh** `[S][P2]`: `refresh-price-cache` cron job'ını asset_type rotasyonlu yapılandır; şu an sadece US_STOCK tazelleniyor. (sql-writer + edge-reviewer)

7. **Periyodik agent denetim turu — 3. tur** — sprint sonu kalite kapısı
   - Roadmap: `Güvenlik & Süreç → "Periyodik agent denetim turu — 3. tur"` `[S][P1]`
   - DoD:
     - rls-auditor: Social Faz 2 yeni politikaları — kullanıcı A, kullanıcı B'nin private portföyüne erişemiyor; public portföye erişebiliyor
     - client-security-auditor: public portföy read-only view'de XSS kontrolü (ticker/name render); UserProfileModal bio input sanitizasyonu
     - edge-reviewer: fetch timeout eklendiyse isyatirim call değişikliği incelenir; değişiklik yoksa skip
     - Kritik bulgu varsa: Sprint 10 backlog'una öncelikli eklenir, bulunan item kapatılmadan Milestone tamamlandı sayılmaz

---

## Out of Scope (bilinçli ertelenenler)

- **Social Portfolios Faz 3 — Takip sistemi** `[M][P2]`: Faz 2 tamamlanmadan anlamlı değil; Sprint 10+.
- **Sektör-aware fundamental eşikler** `[M][P1]`: Önemli ama P/E + CAGR + Dayanıklılık bu sprintte önce geliyor; fundamental edge function refactor gerektirir. Sprint 10.
- **EDGAR P/E + P/S** `[M][P2]`: CommonStockSharesOutstanding hesabı gerekiyor; ayrı sprint item'ı.
- **Ortalama Elde Tutma Süresi** `[S][P2]`: CAGR tablosunun doğal tamamlayıcısı ama kapasitede 7. item; Sprint 10 freebie.
- **Vite + JSX build sistemine geçiş** `[L][P1]`: Büyük mimari değişiklik; kendi sprint'i — Sprint 11+.
- **Sparkline interactivity** `[S][P2]`: UI polish; daha kritik analitik önce.

---

## Demo / Validation

Sprint sonu başarı sinyalleri:

1. **Portföy P/E**: En az 3 US pozisyonu için fundamentals çekilmiş; AnalysisTab Sağlık Tablosu başlığında "Portföy F/K: X" görünür; S&P 500 karşılaştırma cümlesi doğru renk pill ile çıkıyor.

2. **CAGR tablosu**: 2 yıldan uzun tutulan pozisyon için CAGR hesabı manuel doğrulanır: `(MV / cost)^(1/years) - 1` = hesaplanan değer; tablo azalan CAGR sırasında; yeni pozisyon (<30 gün) "Yeni Pozisyon" olarak görünür.

3. **Dayanıklılık skoru**: En az 1 düşük borçlu/yüksek marjlı US hisse için skor ≥ 7 (yeşil); GARAN gibi BIST bankası kart dışı notta listelenmiş; "Eksikleri Çek" CTA çalışıyor.

4. **Social Faz 2 — is_public toggle**: Settings → toggle açık → confirm dialog çıkıyor → DB güncelleniyor; Supabase Dashboard'dan `portfolios.is_public` doğrulanır.

5. **Social Faz 2 — RLS**: rls-auditor çıktısında "user isolation: PASS" — kullanıcı A'nın private portföyüne kullanıcı B SELECT ile erişemiyor.

6. **PWA**: Chrome DevTools Application → Manifest: tüm alanlar dolu; "Add to Home Screen" prompt Android Chrome'da görünüyor; iOS Safari "Ana Ekrana Ekle" çalışıyor ve standalone modda açılıyor.

7. **Agent denetim 3. tur**: Kritik bulgu yok (veya bulunan bulgu Sprint 10 backlog'una işaretlenmiş).

---

## Retro Alanı (Sprint sonu doldur)

_Neler çıktı, neler kaldı, neden kaldı — bir paragraf._
