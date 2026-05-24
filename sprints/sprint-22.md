# Sprint 22 — 2026-05-16 → 2026-05-19 ✅ TAMAMLANDI 2026-05-19

**Goal**: Portföy dayanıklılık analizi tamamlanır; giriş kalitesi görsel olarak izlenebilir hale gelir; güvenlik ve LS hygiene hardening yapılır; TEFAS blokerı test edilip kaldırılır.

**Durum**: 5 item tamamlandı (1, 2, 3, 5, 6). Item 4 ("Tam Detay" gerçek render) ertelendi — Social Faz 2 bağımlılığı. Item 7 (Voice-Add) iptal edildi.

**Capacity**: ~4 gün efektif (2026-05-16 → 2026-05-19, yoğun sprint)

---

## Bağlam: Sprint 21 Retro

Sprint 21, tek yoğun çalışma günüydü — logo refresh, 5-tier button system, form grid class'ları, text size minimums, mobile touch targets hepsi aynı günde tamamlandı. Design audit Phase-2 (6 madde) S22+'ya bırakıldı. Önceki S21 adayları (Dayanıklılık Skoru, TEFAS WAF, 52W bar) bu sprinte taşındı.

---

## Scope

### 1. Piyasa Dayanıklılık Skoru — Verdict Cümlesi `[S][P2]`

**Roadmap satırı**: `Analiz Tab → Risk → "Piyasa Düşüşü Dayanıklılık Skoru"` + `Sprint-19 Item 2d`

**Neden bu sprint**: Skor ve MV-weighted hesap önceki sprintlerde implementti; eksik olan tek parça Sprint 19 Item 2d — tek-satır verdict cümlesi. Sprint 19 günceli: "güçlü/orta/kırılgan" pattern `goodCount/badCount` verdict stiliyle tutarlı yapıldı.

**Alt-task'lar**:
- [x] AnalysisTab "Piyasa Dayanıklılığı" kartı üstüne skor 1-10 → `🟢 güçlü / 🟡 orta / 🔴 kırılgan` verdict cümlesi eklendi.
- [x] Eşikler: ≥7 güçlü · ≥5 orta · <5 kırılgan; null skor → "veri bekleniyor" nötr.
- [x] Renk: `var(--ok) / --warn / --err`; Sprint 19 Portföy Sağlık paterni ile tutarlı.

**Tamamlandı 2026-05-19**

**DoD**:
- Piyasa Dayanıklılığı kartı, tablo/bar'dan önce renkli tek cümle verdict gösteriyor.
- Skor null ise gizli değil; "veri bekleniyor" nötr.
- `npm run check:babel` geçiyor.

---

### 2. Alım Fiyatı Bölgesi Analizi — 52W Giriş Kalitesi Bar `[S→M][P2]`

**Roadmap satırı**: `Analiz Tab → Davranışsal → "Alım Fiyatı Bölgesi Analizi (52W Konumu)"` + Sprint 22 adayları #3

**Neden bu sprint**: Sprint 20'de `h_52w/l_52w` fund_cache'te değil, ayrı fetch gerektiği anlaşıldı. Sprint 22'de migration + edge fn deploy dahil tam pipeline implement edildi.

**Alt-task'lar**:
- [x] Migration 021 (Management API): `price_cache`'e `h_52w numeric` + `l_52w numeric` kolonları.
- [x] `fetch-prices` + `refresh-price-cache` edge fn: `compute52w` helper (closes-only 52W high/low); upsert payload'u `h_52w/l_52w` ile genişletildi. 3 historical fn'e eklendi.
- [x] 4 batch trigger: 25/25 aktif pozisyon `h_52w/l_52w` dolduruldu.
- [x] TickerDetailTab "Giriş Kalitesi" bar: held US_STOCK + TRY-cinsli BIST için gradient bar (yeşil→sarı→kırmızı) + avg_cost dikey marker + güncel fiyat disk marker + verdict cümlesi. Eşik: cost <33% "düşük bantta (iyi giriş)" · 33-66% "orta bant" · >66% "zirveye yakın". `h_52w/l_52w` NULL ise kart gizli.
- [x] E2E doğrulandı: AAPL prod'da "düşük bantta" verdict render ediliyor.

**Tamamlandı 2026-05-19**

**DoD**:
- TickerDetailTab held US_STOCK/BIST için "Giriş Kalitesi" bar görünüyor; discovery mode'da veya NULL ise gizli.
- Gradient + iki marker (avg_cost + güncel fiyat) prod'da render ediliyor.
- `npm run check:babel` geçiyor; rls-auditor sign-off (migration 021).

**Risk**: `compute52w` closes-only — intraday extremes yansıtılmıyor. Bilinçli trade-off; sprint scope içinde belgelendi.

---

### 3. LS Key User-Scope Prefix (Uzun Vade) `[M][P3]`

**Roadmap satırı**: `Güvenlik & Denetim → "LS key'leri user-scope değil" [P2]`

**Neden bu sprint**: Sprint 20 kısa vade (signOut'ta temizle) tamamlandı. Uzun vade (user.id prefix) cross-account leak'i ikinci bir defense katmanıyla kapatıyor; altyapı değişikliği olmadan eklenebilir.

**Alt-task'lar**:
- [x] `utils.js`'e `USER_SCOPED_LS_BASES` listesi, `userLSKey(base, uid)` helper, `migrateUserLSKeys(uid)` idempotent migrator.
- [x] App mount'ta `migrateUserLSKeys(user.id)` — legacy non-scoped key'leri `il_<base>_<userId>` formatına hoist eder.
- [x] App.js `savePrc/saveHist/saveHide/setLastFetchAt/nudge dismiss/active portfolio` — tüm read/write `_uk(base)` ile user-scoped.
- [x] Whitelist: `il_theme/il_fx/il_disp_cur` (device pref — scoped değil).
- [x] Pattern SearchTab `il_recent_${userId}` ile tutarlı.

**Tamamlandı 2026-05-19**

**DoD**:
- Farklı hesaba geçişte bir kullanıcının `il_prc/il_hist/il_hide` verisi diğerine görünmüyor.
- `migrateUserLSKeys` idempotent: çift çalışma yan etkisiz.
- `npm run check:babel` geçiyor.

---

### 4. "Tam Detay" Gerçek Render `[M][P2]` — ERTELENDİ

**Roadmap satırı**: Sprint 22 adayları #4

**Neden ertelendi**: Social Faz 2 bağımlılığı netleşmedi; `is_public` toggle UI + RLS politikası tamamlanmadan full-detail render anlamsız. Sprint 23+ adayı.

---

### 5. TEFAS WAF Testi `[S][P1]`

**Roadmap satırı**: `Bekleyenler / Blokerli → "TEFAS WAF testi"` + Sprint 22 adayları #2

**Neden bu sprint**: Tam TEFAS entegrasyonu (`[L][P1]`) için bloker — endpoint canlı mı, WAF var mı bilinmiyordu.

**Alt-task'lar**:
- [x] Legacy endpoint `https://www.tefas.gov.tr/api/DB/BindHistoryInfo` (form-encoded POST) test edildi — 404 "Method not found or disabled". WAF değil, endpoint retire edilmiş.
- [x] Yeni JSON API `https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir` (POST, JSON) local test 200 + resultList dönüyor; WAF/IP ban yok.
- [x] Plan dosyası yeni endpoint için güncellendi. Tam entegrasyon (~L, 9 sub-task) Sprint 23+ adayı.

**Tamamlandı 2026-05-19**

**DoD**:
- Yeni endpoint lokal ortamda 200 + geçerli veri döndürüyor belgelendi.
- Plan dosyası güncellendi; bloker "Bekleyenler" bölümünden çıktı.

---

### 6. Güvenlik Hardening: `fetch-fundamentals` 422 Fix + Denetim Turu 5 `[S][P1/P0]`

**Roadmap satırı**: `UI & A11y → Aktif Buglar → "fetch-fundamentals Analiz tab 422"` + `Güvenlik & Denetim → Denetim Turu 5`

**Neden bu sprint**: E2E test sırasında prod'da 422 gözlemlendi; Denetim Turu 5 bulguları P0/P1 içeriyor.

**Alt-task'lar**:
- [x] `ISY_KNOWN_BANKS` sabiti modül seviyesine çıkarıldı; `isFundEligible(p)` helper tüm eligibility check'lerinde (mount LS init, Supabase fetch, healthEligible, resilienceEligible, onHealthSummary). `→ src/components/AnalysisTab.js`
- [x] `set-manual-price` shared `price_cache` overwrite [P0]: `asset_type==="BES"` + `auth.uid()` ownership guard. `→ fetch-prices-edge-function.js`
- [x] `bes_update_atomic` RPC migration 019: positions.dk_current + price_cache aynı transaction. `→ supabase/migrations/019_bes_update_atomic.sql; BesUpdateModal.js`
- [x] DEPOSIT kısmi çekim sonrası faiz: `computeDepositGrossInterest` SELL'de orantılı faiz çıkışı. `→ App.js`
- [x] `price_snapshots` policy migration 020: explicit `TO anon, authenticated USING (true)`. `→ supabase/migrations/020_...`
- [x] "Tam Detay" UI fix: `privacy_level='full'` logic düzeltildi; `togglePrivacyLevel` temizliği. `→ App.js`

**Tamamlandı 2026-05-19**

---

### 7. Voice-Add — İPTAL `[L][P2]`

**İptal tarihi**: 2026-05-21. Sesli işlem ekleme kapsamdan çıkarıldı. Spec arşivde: `docs/superpowers/specs/2026-05-17-voice-add-design.md`. Yeniden değerlendirmek gerekirse oradan başlanır.

---

## Out of Scope (bilinçli ertelenenler)

- **"Tam Detay" gerçek tam-detay render** — Social Faz 2 önkoşulu; Sprint 23+.
- **Design audit Phase-2** (6 madde) — Sprint 21'den beri beklemede; Sprint 23 [M] anchor adayı.
- **TEFAS tam entegrasyonu** — Bloker kalktı ama `[L]` scope; Sprint 23+ için slice gerekiyor.
- **`deno check` adımı** + **pg_cron vault migration** — `[S]` hygiene; Sprint 23'e.

---

## Demo / Validation

1. **Dayanıklılık verdict**: AnalysisTab "Piyasa Dayanıklılığı" kartı → tablo/bar'dan önce `🟢 güçlü / 🟡 orta / 🔴 kırılgan` verdict cümlesi görünüyor.
2. **52W bar**: AAPL (veya herhangi held US_STOCK) → TickerDetailTab → "Giriş Kalitesi" gradient bar + avg_cost marker + güncel fiyat marker + "düşük bantta / orta / zirveye yakın" verdict.
3. **LS scope**: İki farklı hesapla giriş/çıkış → ikinci hesabın Dashboard'u birinci hesabın cache'ini göstermiyor.
4. **TEFAS bloker**: Yeni endpoint `/api/funds/fonFiyatBilgiGetir` lokal test 200 dönüyor (belgelendi, prod deploy yok).
5. **Güvenlik**: BES olmayan ticker'da `set-manual-price` → 403. BIST banka tickerı (GARAN) → AnalysisTab Portföy Sağlık'ta 422 hatası yok.
