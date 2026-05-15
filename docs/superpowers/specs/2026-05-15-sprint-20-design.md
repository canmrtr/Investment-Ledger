# Sprint 20 — Tasarım Spec'i

**Tarih:** 2026-05-15
**Kapsam:** 3 item (ROADMAP Sprint 20 adayları #3, #4, #5). Aday #6 (52W giriş kalitesi bar) Sprint 21'e ertelendi — `price_cache` migration ve `fetch-prices` değişikliği gerektirdiği için Sprint 20 kapsamı dışında.

---

## Item 1 — BES "Değer Güncelle" Butonu

**Sorun:** BES pozisyonu aylık güncellenirken kullanıcı şu an `ManuelPosForm`'da 4 alanı yeniden doldurmak zorunda: Kişisel Yatırılan, Kişisel Güncel, DK Anaparası, DK Güncel. Anaparalar aylık değişmez; sadece güncel değerler değişir.

**Çözüm:** Sadece 2 güncel değer alanı içeren hafif bir modal eklemek.

### Bileşenler

**Yeni dosya:** `src/components/BesUpdateModal.js` (~80 satır)

Props:
- `pos` — `{ticker, name, avgCost, shares, dkPrincipal, dkCurrent}` (pozisyon objesi)
- `onClose` — modal kapatma callback
- `onSaved` — başarılı kayıttan sonra `loadData` tetikleme

İçerik:
- Modal başlık: "BES Güncelle — {ticker}"
- Read-only badge'ler: "Kişisel Anapara: ₺{avgCost}" + "DK Anapara: ₺{dkPrincipal}" (değiştirmek için "Düzenle" linki yok — bu modal sadece güncel değerleri günceller).
- Form alanları:
  - `Kişisel Güncel` (₺) — `defaultValue=pos.shares*prc[ticker]−pos.dkCurrent` (mevcut güncel kişisel değer)
  - `DK Güncel` (₺) — `defaultValue=pos.dkCurrent`
- "Kaydet" butonu: `set-manual-price` edge çağrısı + `positions.dk_current` UPDATE + `flash_("Güncellendi","ok")` + `onSaved()`.
- "İptal" butonu: `onClose`.

### Entegrasyon

**Dashboard (App.js):** Mevcut BES `pos-row`'da action grubuna `💰` ikon butonu eklenecek (54x32px). Tıklama `BesUpdateModal`'i açar.

**TickerDetailTab.js:** Mevcut "BES Özeti" kartının üstüne "💰 Değer Güncelle" tam genişlikte buton (sadece `isBes && p` koşulunda) — alternatif giriş noktası.

### Hesaplama

`total = (kişisel_güncel) + (dk_güncel)`
→ `set-manual-price` çağrısı `total` ile yapılır → `prc[ticker]` güncel TL toplam değer olur (mevcut BES modeline uygun, `loadData` synthetic inject eder).
→ `dk_current` DB'ye yazılır → TickerDetailTab BES Özeti yeni değeri gösterir.

### Hata Senaryoları

- `set-manual-price` başarısız → `flash_("Güncelleme başarısız","err")`, modal açık kalır, kullanıcı tekrar deneyebilir.
- `dk_current` UPDATE başarısız → aynı flash; `prc` güncellenmiş ama `dk_current` eski (tutarsız state). Bu nadir; sonraki `ManuelPosForm` düzenlemesinde manuel düzeltilebilir. Atomik tx zorunlu değil — gerçek tutar `prc`'de zaten doğru, sadece kişisel/DK ayrımı geçici olarak yanlış gözükür.

### Test Senaryoları

1. BES pozisyon → Dashboard `💰` butonu → modal aç → 2 değer gir → Kaydet → flash + modal kapanır + Dashboard yeni değer gösterir.
2. TickerDetailTab → `💰 Değer Güncelle` → aynı akış.
3. Boş veya negatif sayı → submit disabled.
4. Sadece bir alan değiştirildi → diğeri eski değerle gönderilir (defaultValue önemli).

---

## Item 2 — "Tam Detay" Paylaşım UI Fix

**Bug:** `App.js:1252`'deki Settings metni "Adet ve maliyet bilgileri görünür" diyor, ancak gerçek public view (`App.js:1142-1162`) `privacy_level==="full"` modda bile yalnızca `{ticker, name, pct}` render ediyor. Toggle çalışıyor (DB'ye yazıyor) ama görsel sonuç yok.

**Karar:** Render katmanını değiştirmek yerine UI'ı gerçek davranışla uyumlu hale getirmek. Tam detay paylaşımı Social Faz 2 işi; Sprint 20 sadece yanıltıcı UI'ı düzeltir.

### Değişiklikler (App.js:1247-1270)

**1. Block içeriğini "yakında" mesajına dönüştür:**
- Detay paylaşımı sub-section'ı görünür kalır (kullanıcı "bunun olacağını" bilsin).
- Alt metin: `"Sadece ticker + yüzde dağılımı görünür"` (mevcut allocation_only davranışı zaten doğru).
- Yeni satır: `"💡 Tam detay paylaşımı yakında sosyal güncellemesinde aktif olacak"` — kullanıcı bilgilendirilir.

**2. Toggle butonlarını disable et:**
- "Sadece Dağılım" butonu `on` görünür ve `disabled`.
- "Tam Detay" butonu da `disabled` (gri gözük, tıklanamaz).
- `onClick` handler'lar kaldırılır.
- `togglePrivacyLevel` fonksiyonu kaldırılır (kullanılmıyor).

**3. Confirm dialog'unu kaldır:**
- `App.js:1200-1208`'deki `confirm_("Maliyet ve adet bilgileri de herkesle paylaşılacak...")` artık çağrılmıyor → silinir.

### Net Etki

- DB schema değişmez (`privacy_level` kolonu kalır).
- Mevcut `is_public` ayarları korunur — kullanıcı portföyü gizleyip yeniden açabilir.
- Hiçbir kullanıcı şu an `privacy_level==="full"` olarak ayarlamış olsa bile render hâlâ allocation_only davranıyor → görsel değişiklik yok.

### Test Senaryoları

1. Settings → Portföy → Herkese Aç → açık badge görünür.
2. Detay Paylaşımı bölümü görünür ama her iki toggle disabled.
3. "Yakında" mesajı görünür.
4. Portföyü gizle → bölüm gizlenir (mevcut davranış).

---

## Item 3 — LS Key User-Scope Hardening

**Sorun:** localStorage'da kullanıcıya özgü değerler `il_` prefix ile yazılıyor ama `user.id` ile namespace'lenmemiş. signOut handler'ları sadece 5 key temizliyor; en az 6 per-user key (ör. `il_disp_cur`, `il_nudge_dismissed`) silinmiyor. Bu A kullanıcısı → signOut → B kullanıcısı sign-in akışında cross-user kontaminasyonuna yol açar.

**Karar:** Kısa vadeli düzeltme — signOut'ta tüm `il_*` keyleri temizle (whitelist hariç). Uzun vadeli `user.id` prefix migrasyonu Sprint 20 kapsamı dışında.

### Whitelist Kararı

Bu iki key her kullanıcı için aynı olabilir veya ortak cache:
- `il_theme` — kullanıcı tercihi ama signOut sonrası bile beklenen davranış (kart kalır gibi); cihaz tercihi olarak değerlendirilebilir. Bilinçli karar: silmiyoruz, çünkü çoğu uygulamada tema sign-in/out aşmaz.
- `il_fx` — paylaşımlı FX rate cache; hiçbir kullanıcıya özgü değil. Silmek anlamsız (her giriş yenisinden fetch zorlanır).

Diğer tüm `il_*` keyler temizlenir — `il_prc`, `il_hist`, `il_hide`, `il_disp_cur`, `il_last_fetch`, `il_nudge_dismissed`, `il_active_portfolio`, `il_recent_*`, `il_etf_cw_*`, `il_divcal_*`.

### Implementasyon

**`src/utils.js`'e yeni helper** (browser-global pattern — `export` yok; üst düzey `const` zaten global olur, App.js'ten doğrudan erişilebilir):

```js
// signOut'ta tüm il_* localStorage keylerini temizler.
// Whitelist: il_theme (cihaz tercihi), il_fx (paylaşımlı cache).
const clearUserLocalKeys = () => {
  const PRESERVE = new Set(["il_theme", "il_fx"]);
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith("il_") && !PRESERVE.has(k)) {
      localStorage.removeItem(k);
    }
  });
};
```

**`src/components/App.js` iki call site:**
- Line ~572 (hamburger menü signOut): `["il_hide","il_prc",...].forEach(...)` → `clearUserLocalKeys()`.
- Line ~1391 (Settings signOut): aynı değişiklik.

### Test Senaryoları

1. Sign-in → tema değiştir (light) → `il_disp_cur` TRY yap → signOut.
2. localStorage devTools: `il_disp_cur`, `il_hide`, `il_prc`, `il_hist`, `il_active_portfolio` **silinmiş** olmalı; `il_theme` ve `il_fx` **kalmış** olmalı.
3. Yeni kullanıcı sign-in → Display Cur default `USD`, hide=false (kişisel state'ler taze).
4. Tema `light` korunur (whitelist çalışıyor).

### Risk

- `il_recent_search` (eski global anahtar) ve `il_recent_${user.id}` (per-user anahtar) ikisi de silinir → mevcut davranışla aynı.
- Cron veya offline kullanım etkilenmez (signOut zaten online işlem).

---

## Bağımsızlık ve Sıralama

3 item birbirinden bağımsız. Önerilen implementasyon sırası:

1. **Item 2 (Tam Detay UI)** — 5 satır, riski sıfır, en hızlı PR. Aynı zamanda P1 (audit bulgusu).
2. **Item 3 (LS hardening)** — ~15 satır, signOut akışı test edilmesi gerekir.
3. **Item 1 (BES modal)** — yeni component, en büyük; manuel test için BES pozisyonu gerekir (test hesabı `canmerter@me.com`'da BES varsa kullanılır, yoksa eklenir).

Her item ayrı commit. Sprint 20 tek branch'ta (main, solo dev) ardışık commit'ler.

---

## Test Stratejisi

- `npm run check:babel` — her commit öncesi parse kontrolü.
- `e2e/smoke.mjs` — sign-in akışı sağlam mı kontrol et (Item 3 signOut akışını dolaylı kapsar).
- Manuel: GitHub Pages canlıda `Cmd+Shift+R` ile her item'ı doğrula (3 senaryo: BES güncelleme, Settings UI, signOut+yeni hesap).

## Açık Sorular

Yok — tüm tasarım kararları onaylandı.
