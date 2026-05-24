# Sprint 21 — 2026-05-16 → 2026-05-16 ✅ TAMAMLANDI 2026-05-16

> **Not:** Bu dosya sonradan (2026-05-24) retroaktif olarak backfill edildi. Kaynak: `ROADMAP.md` "Brand & Design — Sprint 21" bölümü (satır 25–34). Design audit Phase-2 hariç tüm item'lar aynı gün tamamlandı; sprint muhtemelen tek yoğun bir çalışma seansıydı.

**Goal**: Yeni Portfoi marka kimliğini uçtan uca yerleştir (logo, favicon, PWA icons, topbar wordmark) ve `design_audit.md` Phase-1 hijyenini tamamla.

**Capacity**: ~1 gün efektif (yoğun koding günü)

---

## Scope

### 1. Logo Refresh (End-to-End) `[M][P0]`
- ✅ Login lockup swap: `linear-*` → `portfoi-lockup-*`; yükseklik 240px → 160px.
- ✅ Topbar wordmark butonu eklendi: `>640px`, Dashboard'a tıklanabilir.
- ✅ PWA icons (`icon-192/512`) Playwright rasterizer ile yeniden üretildi.
- ✅ `favicon.svg` + `favicon-32.png` eklendi.
- ✅ Service worker SHELL precache `il-shell-v3`'e bumped.
- ✅ Kaynak SVG: `Logo/portfoi-icon.svg`. Eski dosyalar rollback için `Logo/legacy/` altına taşındı.

### 2. 5-Tier Button System `[M][P1]`
- ✅ `.btn-icon` (28×28 desktop / 36×36 mobile square icon-only) eklendi.
- ✅ `.btn-xs / .btn-sm / .btn-md / .btn-pri` min-height ile codified.
- ✅ `.pri` alias olarak back-compat korundu.
- ✅ CLAUDE.md "Tasarım sistemi → Buton katmanları" dokümante edildi.

### 3. Mobile Form Grid Classes `[S][P1]`
- ✅ `.form-grid-2` ve `.form-grid-3` reusable CSS sınıfları eklendi.
- ✅ ManuelPosForm + TickerDetailTab manuel quick-add + edit row + HistoryTab edit row migrate edildi.
- ✅ `≤640px`'de tek kolona çöküyor.

### 4. Text Size Minimums `[S][P2]`
- ✅ `.empty-card .sub` 12→13px, `.ttl` 15→16px, `.warn-card .wc-sub` 11→12px, `.sg .hint` 11→12px.
- ✅ `.lbl/.kk/.stitle` 10px ve tablo hücreleri 12px kasıtlı yoğun label olarak korundu.

### 5. Mobile Touch Targets ≥36px `[S][P1]`
- ✅ `@media(max-width:640px)`: `.btn-xs/.btn-icon/.btn-sm` min 36×36px.
- ✅ `.pos-row .btn-xs` ve `table .btn-xs` padding 8/10.

---

## Out of Scope (bilinçli ertelenenler)

- **Design audit Phase-2** `[M][P2]`: `design_audit.md` kalan 6 madde (#4 empty-state, #6 button-like span, #7 card consolidation, #8 tablet breakpoint, #9 tooltip consistency, #10 inline flash class). Sprint 22+ adayı.
- **Önceki S21 adayları** (Dayanıklılık Skoru, TEFAS WAF, 52W bar): Brand sprint'e yer açmak için Sprint 22'ye kaydı.

---

## Retro

Sprint 21 marka yatırımının meyvesini verdi: login, topbar, PWA ve favicon tutarlı Portfoi kimliğine kavuştu. Button system ve form grid class'lar mobil UX borcunu kapattı. Phase-2 design audit bilinçli olarak ertelendi — Sprint 22'nin ilk adayı haline geldi. Tüm S21 hedefleri aynı oturumda teslim edildi.
