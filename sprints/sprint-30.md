# Sprint 30 — 2026-06-28 → 2026-07-11

**Goal**: Kullanıcı hesabını kendi başına tamamen silebilir — tüm verisi (pozisyon, işlem, watchlist, portföy, profil, feedback) geri dönüşsüz temizlenir ve `auth.users` satırı kaldırılır. Bu, App Store başvurusunun (Apple Guideline 5.1.1) zorunlu önkoşulunu kapatır.

**Capacity**: ~2 hafta × ~6h/hafta efektif. Tek headline + bir güvenlik turu; düşük UI yükü (mevcut `AccountSection` genişletilir).

> **Scope düzeltmesi (2026-06-28 grooming)**: "Hesap ekranı genişletme" roadmap item'ının şifre değiştirme / email değiştirme (verifikasyonlu) / avatar / bio / username parçaları `AccountSection.js`'te **zaten canlıda**. Geriye yalnızca **hesap silme (cascade)** kaldı — bu sprint onu kapatır. Item bu nedenle `[M]` → fiilen `[S-M]`.

## Scope

1. **`delete-account` edge function (service_role)** — *headline; roadmap "Hesap ekranı genişletme" → hesap silme parçası*
   Hesap silme `auth.users` satırını gerektirir; bu yalnızca service_role ile (admin API) yapılabilir, client'tan yapılamaz. Yeni edge function: çağıran JWT'den `getUser` ile kimliği doğrula → `supabaseAdmin.auth.admin.deleteUser(uid)` çağır → FK `ON DELETE CASCADE` geri kalan tüm kullanıcı verisini siler.
   - DoD:
     - `--no-verify-jwt` ile deploy; içeride `Authorization` header'dan `getUser` zorunlu (anon/eksik token → 401). Pattern: mevcut `fetch-fundamentals` auth bloğu.
     - Yalnızca **kendi** `uid`'sini siler — gövdeden/parametreden user_id **kabul etmez**, token'daki `uid` kullanılır (IDOR yok).
     - Başarıda 200 + `{ok:true}`; admin delete hatasında 500 + generic mesaj (ham hata yalnız server log'a — `parse-transaction` raw-leak dersi).
     - `edge-reviewer` agent'ı GO verir (deploy öncesi).
     - `npm run check:edge` + `check:edge-drift` (root `.js` ↔ `supabase/functions/*/index.ts` sync) yeşil.
   - Risk: service_role key'in edge ortamında doğru env'den okunduğu doğrulanmalı (`SUPABASE_SERVICE_ROLE_KEY` reserved-prefix değil — `Deno.env.get` ile erişim teyidi). Mitigation: spike'ta tek dummy/test user ile uçtan uca sil-doğrula.

2. **Cascade kapsam denetimi + boşluk migration'ı** — *headline'ın veri-bütünlüğü ayağı*
   `auth.users` silinince tüm kullanıcı-scope satırların gittiğini fiilen doğrula. Mevcut durum: positions / transactions / watchlist / portfolios / feedback / follows / portfolio_activities → `ON DELETE CASCADE` ✅. **`profiles` ve `splits`** FK'ları teyit edilmeli; CASCADE değilse migration ile eklenmeli (veya edge function içinde explicit DELETE).
   - DoD:
     - 13 tablonun her birinin user-scope satırı için kapsam matrisi `SCHEMA.md`'ye not düşülür (CASCADE / manuel-delete / paylaşımlı-cache=dokunma).
     - Eksik CASCADE varsa `sql-writer` ile migration; ardından **`rls-empirical-tester`** ile gerçek test user'da sil → tüm tablolarda 0 satır kaldığı doğrulanır.
     - `price_cache` / `adr_bist_map` / `tefas_funds` gibi **paylaşımlı** tablolar silinmez (user-scope değil) — kapsam dışı olduğu açıkça not edilir.
   - Risk: positions/transactions kasıtlı olarak portfolios'a `ON DELETE RESTRICT` ile bağlı (veri kaybı koruması). user_id → auth.users CASCADE'i bunu by-pass eder mi sıralaması test edilmeli. Mitigation: empirical test tek transaction'da gerçek silmeyi gösterir.

3. **Settings "Tehlikeli Bölge" — Hesabı Sil UI** — *headline'ın kullanıcı yüzeyi*
   `AccountSection.js` altına (veya Settings "Gelişmiş" değil, **görünür** Hesap bölümünün en altına) kırmızı-tonlu "Hesabı Sil" aksiyonu. İki-adımlı koruma: confirm dialog + **type-to-confirm** (kullanıcı "SİL" yazmadan buton pasif). Onayda `delete-account` edge çağrısı → başarıda `signOut` + login ekranına.
   - DoD:
     - Geri dönüşü olmayan aksiyon net dille uyarılır ("Bu işlem geri alınamaz — tüm pozisyon, işlem ve portföy verin kalıcı silinir").
     - `confirm_` + ek text-input guard; yanlışlıkla tek-tık silme imkânsız.
     - Silme sonrası user-scope LS key'leri temizlenir (`clearUserLocalKeys` mevcut helper) ve oturum kapanır.
     - `ui-builder` skill ile yapılır; `client-security-auditor` agent'ı UI değişikliğini gözden geçirir.
   - Risk: Silme başarılı ama signOut yarış durumu (RLS artık satır yok → app çökmesi). Mitigation: edge 200 dönmeden UI state'i temizleme; sıralama signOut → redirect.

## Out of Scope (bilinçli ertelenenler)
- **Şifre / email / avatar / username** — zaten canlıda (`AccountSection.js`); bu sprint dokunmaz.
- **Soft-delete / "30 gün içinde geri al" akışı** — kişisel araç için fazla; hard-delete yeterli. Çok-kullanıcı SaaS fazında değerlendirilir.
- **Hesap silme onay e-postası / out-reach** — Resend bağımlısı, ayrı item.
- **Avatar görsel upload** (emoji yerine resim) — Supabase Storage gerektirir; ayrı `[M]` item.
- **Altın işçilik premium (Sprint 29)** — park edildi; Can yeniden önceliklendirene kadar bekler.

## Demo / Validation
- **Test hesabıyla uçtan uca** (`canmerter@me.com` değil — silineceği için **tek-kullanımlık yeni test user** oluştur): pozisyon + işlem + watchlist + feedback ekle → "Hesabı Sil" → type-to-confirm → edge 200 → login ekranı.
- Silme sonrası Supabase'de doğrula: `auth.users` + 13 tablonun hepsinde o `uid`'ye ait **0 satır** (`rls-empirical-tester` veya manuel `execute_sql` SELECT count).
- Negatif test: anon/eksik JWT ile `delete-account` çağrısı → 401; başkasının user_id'sini gövdede göndermek → yine sadece token sahibinin silinmesi (IDOR yok).
- Production'da (`canmrtr.github.io`) UI eyeball: kırmızı bölge görünür, type-to-confirm guard çalışıyor, yanlış metinle buton pasif.
