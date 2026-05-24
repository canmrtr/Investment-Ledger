# Sprint 20 — 2026-05-16 → 2026-05-16 ✅ TAMAMLANDI 2026-05-16

> **Not:** Bu dosya sonradan (2026-05-24) retroaktif olarak backfill edildi. Kaynak: `ROADMAP.md` satır 485–489 ve "Sonraki Adım" bölümü. Detaylar ROADMAP'teki Sprint 20 özet bullet'larından alındı; ayrıntılı DoD/Scope belgeleri yazılmamıştı.

**Goal**: BES portföy değerini kullanıcı aylık güncelleyebilir; Tam Detay paylaşım UI tutarsızlığı düzeltilir; LS key'leri signOut'ta doğru temizlenir.

**Capacity**: ~1 gün efektif (yoğun kod günü — S21 Brand sprint öncesi sıkıştırılmış)

---

## Scope (Retroaktif Özet)

### 1. BES "Değer Güncelle" Butonu `[S][P1]`
- ✅ `BesUpdateModal` component oluşturuldu: 2 alan — Kişisel Güncel + DK Güncel.
- ✅ TickerDetailTab BES Özeti üstüne full-width "💰 Değer Güncelle" butonu eklendi.
- ✅ Dashboard BES pos-row'da 💰 ikon (desktop + mobile, `stopPropagation` ile).
- ✅ `flash_` prop wiring fix dahil.

### 2. "Tam Detay" Paylaşım UI Düzeltmesi `[S][P1]`
- ✅ Settings'teki `privacy_level` toggle'ları `disabled` yapıldı.
- ✅ "💡 Tam detay paylaşımı sosyal güncellemesinde aktif olacak" copy eklendi.
- ✅ `togglePrivacyLevel` fonksiyonu ve artık kullanılmayan `privLevel` var kaldırıldı.

### 3. LS Key Temizliği (signOut hardening) `[S][P1]`
- ✅ `clearUserLocalKeys()` helper yazıldı: `il_theme` + `il_fx` whitelist dışındaki `il_` prefix'li tüm key'leri siler.
- ✅ 2 signOut call site (hamburger menü + Settings danger zone) refactor edildi.

---

## Out of Scope (bilinçli ertelenenler)

- **52W Giriş Kalitesi bar** `[S→M][P2]`: `price_cache` migration + `fetch-prices` edge fn değişikliği gerektiriyor; S20 scope dışında bırakıldı. Sprint 21 → Sprint 22'ye kaydı.
- **Brand & Design (Logo refresh, button system)**: Sprint 21'e ayrı sprint olarak planlandı.

---

## Retro

Sprint 20, Sprint 19'un hemen ardından hızlıca kapatılan bir "temizlik" sprintiydi. 3 item tamamlandı; 52W bar, `price_cache` migration gerektirdiği ortaya çıkınca ertelendi. Sprint 21 Brand sprint başlamadan önce P1 borçları kapatıldı.
