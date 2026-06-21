# Sprint 28 — 2026-06-21 → 2026-07-04

**Goal**: Uygulama "kişisel araç"tan "başkasına verilebilir ürüne" geçişe bir adım daha yaklaşır — kullanıcı takıldığında yardım isteyebilir / özellik talep edebilir, ve Ayarlar artık geliştirici-bakım paneli değil, kullanıcıya anlamlı kontrolleri net gösterir.

**Capacity**: 2 hafta × ~6h/hafta efektif (~12h) — akşam + hafta sonu.

**Tema**: Going-live hazırlığı (Hesap Yönetimi önkoşulları). Layer-2 nudge batch'i (Sprint 26-27) bittikten sonra bağımsız sonraki faz.

## ⚠ Açık karar (sprint başında Can onayı)

**Support & Feature Request kanalı mekanizması** — efort'u doğrudan belirler:
- **(A) In-app form → Supabase `feedback` tablosu** `[M]` ← **önerilen**. Veri in-house, üçüncü-parti signup yok, ileride admin görünümüne genişler. RLS: own-insert.
- (B) GitHub Issues linki `[S]` — en ucuz ama kullanıcıyı dışarı atar + GitHub hesabı ister; teknik-olmayan kullanıcı için kötü.
- (C) Crisp/Intercom widget `[M]` — canlı sohbet ama external signup + script + gizlilik yükü; kişisel ürün için ağır.

Plan (A)'ya göre yazıldı. Can (B)/(C) derse #2 DoD güncellenir.

## Scope

1. **Ayarlar sekmesi revizyonu** — ROADMAP "Hesap Yönetimi" `[M]` `[P2]` `[PO+UX]` (headline-A)
   - Neden bu sprint: Canlıya geçişin zorunlu kapısı. Mevcut Ayarlar (hamburger) geliştirici/bakım odaklı (İşlem Geçmişi · Fiyat&Veri · Bakım · Export CSV · Account · Durum); yeni kullanıcı bu paneli görünce kafası karışır.
   - **İlk iş (envanter, ~1h)**: mevcut Settings bölümlerini tek tek listele → her biri için *kal / gizle / yeniden-adlandır / "Gelişmiş"e katla* kararı (Can onayı). Yıkıcı değil — önce envanter.
   - DoD:
     - Kullanıcı-odaklı IA: Account + Export + İşlem Geçmişi öne; ham cache/durum/debug ("Durum", düşük-seviye "Bakım") tek bir **"Gelişmiş / Geliştirici"** alt-`<details>`'ine katlanır (silinmez — geliştirici hâlâ erişir).
     - Her görünür bölümün tek-cümle Türkçe açıklaması (ne işe yarar).
     - Hamburger menü düzeni gözden geçirilir; tutarlı başlık/ikon.
   - Risk: yanlış bölümü gizleme/kaldırma → envanter + Can onayı önce; tüm değişiklik reversible (CSS/JSX reorganizasyon, veri silme yok). UI işi → `ui-builder` skill.

2. **Support & Feature Request kanalı** — ROADMAP "Hesap Yönetimi" `[M]` `[P2]` (headline-B, karar (A) varsayımıyla)
   - Neden bu sprint: Ayarlar revizyonuyla aynı yüzeyde (Settings) yaşıyor; ikisi tek "Hesap/Destek" temasını oluşturur. Canlıya geçmeden kullanıcı sesi kanalı şart.
   - DoD:
     - Yeni `feedback` Supabase tablosu (`id`, `user_id`, `type` [`bug`|`feature`], `message`, `created_at`); RLS: yalnız own-insert + own-select. Migration + **`rls-auditor` sign-off** (yeni tablo).
     - Settings'te "Geri Bildirim / Destek" bölümü: tip seçimi (Hata / Öneri) + metin alanı (maxLength guard) → `feedback` insert → teşekkür flash.
     - Boş/çok-kısa mesaj guard; basit rate koruması (ör. art arda insert engeli veya client throttle).
   - Risk: RLS yanlış kurulursa cross-user okuma. Mitigation: own-insert/own-select policy + `rls-auditor` + (gerekirse) `rls-empirical-tester`. SQL → `sql-writer` skill.

3. **AddTab tez checklist nudge'ı** — ROADMAP "Akıllı Öneriler & Nudge" Katman 2 `[S]` `[P2]` (filler / stretch)
   - Neden bu sprint: Layer-2'nin 4. ve son nudge'ı; nudge sistemini kapatır. Ucuz, mevcut altyapı, yeni fetch/tablo yok. Headline'lardan artan yarım güne sığarsa.
   - DoD:
     - AddTab'da asset tipi seçiminden sonra / işlem kaydından önce hafif hatırlatma: "Yatırım tezini belirledin mi? (Investment Guide 20-kriter)" — dismissable, panik yaratmayan, Investment Guide'a pointer.
     - Dismiss tercihi kalıcı (LS) veya her seferinde gösterilebilir — UI kararı build'de.
   - Risk: işlem ekleme akışını yavaşlatmamalı (zorunlu modal değil, pasif hatırlatma). Taşarsa Sprint 29'a devreder — headline'ları bloklamaz.

## Out of Scope (bilinçli ertelenenler)

- **Hesap silme (cascade delete)** — App Store zorunluluğu ama mobil faz (M3) önkoşulu; ayrı item, bu sprint değil.
- **Hesap ekranı genişletme** (şifre/email değiştirme verifikasyonlu) — ayrı `[M]` item; bu sprint Settings IA + Support'a odaklanır.
- **Admin/moderasyon görünümü** (feedback'leri Can'ın görmesi) — Faz 2; bu sprint yalnız toplama (insert).

## Demo / Validation

- **Settings IA**: Test hesabıyla hamburger → Ayarlar → kullanıcı-odaklı bölümler net mi? "Gelişmiş" katlı mı? Her bölüm açıklamalı mı? Geliştirici hâlâ debug'a erişebiliyor mu?
- **Support kanalı**: Test hesabından Hata + Öneri gönder → `feedback` tablosuna düştü mü (Supabase SELECT)? Başka kullanıcının feedback'i okunamıyor mu (RLS — `rls-empirical-tester`)? Boş/uzun mesaj guard çalışıyor mu?
- **Checklist nudge** (yapıldıysa): AddTab'da hatırlatma çıkıyor, dismiss ediliyor, işlem akışını bloklamıyor.
- **Canlı doğrulama**: edge/RLS dokunan kısımlar push sonrası `canmrtr.github.io`'da (localhost CORS edge'i bloklar — Lessons.md 2026-06-21).

## Notlar / Bağımlılıklar
- **Yeni tablo** (`feedback`) → `sql-writer` skill ile migration; `rls-auditor` + `rls-empirical-tester` agent'ları schema apply öncesi/sonrası zorunlu.
- **UI işi** (Settings reorganizasyon + Support formu + nudge) → `ui-builder` skill. Türkçe UI, mevcut `.btn-*`/`.finp`/`.warn-card` sistemine uy.
- **Edge yok** (beklenen) — feedback insert client'tan doğrudan Supabase'e (RLS-korumalı), edge fn gerekmez. Edge dokunulursa `edge-reviewer` + drift check.
- **Platform yörüngesi**: yeni state Supabase'e (LS değil) — `feedback` tablosu multi-user SaaS geçişiyle uyumlu.

## İlerleme / Retro (2026-06-21)

İki headline aynı gün kodlandı + canlıda doğrulandı. Karar (A) in-app Supabase seçildi.

### #2 Support kanalı — ✅ canlıda (commit `aba0cc5`)
- `feedback` tablosu: `rls-auditor` PASS (5/5 gereksinim) + `rls-empirical-tester` **14/14** (cross-user izolasyon solid). Bonus hardening: Supabase default privileges anon+authenticated'a TÜM yetkileri otomatik vermiş → `REVOKE ALL` + yalnız SELECT/INSERT (least-privilege).
- `FeedbackSection` Settings'te; canlıda uçtan uca: Öneri gönder → `feedback` tablosuna `type=feature` + doğru owner düştü → test satırı temizlendi.

### #1 Ayarlar revizyonu — ✅ canlıda (commit `e12e171`)
- Can kararı: bakım/recovery dahil **hepsini** "Gelişmiş / Geliştirici" collapsible'a katla.
- Görünür: Hesap, Portföy, Görünüm, Veri (yalnız "↻ Şimdi Güncelle"), Araçlar (Export + İşlem Geçmişi), Geri Bildirim, Çıkış. Katlı: Tarihi Veri, TEFAS Katalog, Bağlantı Test, Pozisyon Yeniden Hesapla, Split Senkronize, Sistem Durumu. Tüm handler'lar birebir korundu; hiçbir araç silinmedi.

### Bonus — SW shell cache bug yakalandı + fix'lendi (commit `2d911a7`)
FeedbackSection script tag'i index.html'i değiştirdi ama SW shell'i cache-first servis ediyor (JS network-first) → dönen kullanıcı yeni App.js (FeedbackSection referansı) + stale index.html (script tag yok) → `ReferenceError`, Settings boş. `CACHE` v3→v4 bump'lendi (GOTCHAS kuralı). **Öğrenme**: index.html her değişince SW cache bump şart — bu sefer hatırlatıcı yoktu, sonraki için GOTCHAS yeterli.

### Kalan
- **#3 AddTab tez checklist nudge'ı** `[S]` (stretch) — başlanmadı. Sprint 28'de bitirilebilir veya Sprint 29'a devreder (Layer-2'nin 4. ve son nudge'ı).
