# Sprint 18 — 2026-05-13 → 2026-05-27

**Goal**: Can, BES hesabındaki devlet katkısını doğru maliyet tabanıyla takip eder; DEPOSIT/BES pozisyonlarını ayrıntılı görür; Dashboard'da mevduat değerini doğru para biriminde görür — yatırım kaydının veri kalitesi ve güvenilirliği somut olarak artar.

**Capacity**: 2 hafta × ~6h/hafta efektif ≈ ~12h toplam (hafta sonu + akşam)

---

## Bağlam: Sprint 17 Retro

Sprint 17 üç item'ı da teslim etti:
- Temettü Takvimi Faz 1 (dividend-calendar mode + TickerDetailTab satırı) tamamlandı.
- AI Parse DIV way desteği: `parse-transaction` sözleşmesi `BUY|SELL|DIV` oldu; `saveTx` istemci doğrulaması eklendi.
- Brand Fit B1+B2: Türkçe jargon geçişi (9 yer) + formül gizleme tamamlandı.

Son commit geçmişi bunu teyit ediyor: `322ee7f (DIV + jargon)`, `9511500 (DoD işaretlendi)`. ROADMAP'e `33c6789` ile BES DK P0 olarak eklendi; design spec `717ccd3` ile hazır.

---

## Scope

### 1. BES Devlet Katkısı (DK) Entegrasyonu `[M][P0]` ✅ (2026-05-13)

**Roadmap satırı**: `Asset Type Genişletme → "BES Devlet Katkısı (DK) entegrasyonu" [P0]`

**Neden bu sprint**: Mevcut modelde DK ayrı pozisyon olarak ekleniyor; DK anaparası maliyet sayılıyor, getiri yanlış hesaplanıyor. Can aktif BES kullanıcısı — bu gerçek para miktarını yanlış raporluyor. Design spec onaylı ve dosyada (`docs/superpowers/specs/2026-05-11-bes-state-contribution-design.md`). Önkoşul yok; sprint başında başlanabilir.

**Alt-task'lar**:
- [x] **1a DB migration** `[S]`: `positions` tablosuna `dk_principal numeric DEFAULT NULL` + `dk_current numeric DEFAULT NULL` kolonu eklendi; `rebuild_positions_atomic` RPC güncellendi. Migration 018.
- [x] **1b `src/utils.js` — `rebuildPositions` güncelleme** `[S]`: Snapshot select'e `dk_principal`, `dk_current` eklendi; `besSnapMap` oluşturuldu; position object çıktısına bu alanlar eklendi.
- [x] **1c `ManuelPosForm.js` — BES form güncelleme** `[S]`: "Kişisel Yatırılan" + "Kişisel Portföy Güncel Değeri" yeniden adlandırıldı; "Devlet Katkısı Anaparası" + "DK Portföy Güncel Değeri" alanları eklendi; form preview güncellendi; `savePos` total = kişisel_güncel + dk_güncel; edit modu pre-populate; hint kaldırıldı.
- [x] **1d `App.js` — `loadData` field okuma** `[S]`: `dkPrincipal` + `dkCurrent` setPos map'ine eklendi.

**DoD**:
- Migration uygulanmış; `positions` tablosunda `dk_principal` + `dk_current` kolonları mevcut.
- BES pozisyonu kaydedince `dk_principal` / `dk_current` DB'de dolu geliyor; toplam `price_cache`'e yazılıyor.
- P&L = `(kişisel_güncel + dk_güncel) - kişisel_yatırılan` doğru; DK anaparası kazanç sayılıyor.
- Eski BES pozisyonları (dk NULL) app'i çökertmiyor; Dashboard'da eski davranış koruyor.
- ManuelPosForm edit modunda 4 alan doğru pre-populate oluyor.
- `npm run check:babel` + drift check geçiyor.
- `sql-writer`, `rls-auditor`, `ui-builder` sign-off'ları tamamlanmış.

**Risk**: `rebuild_positions_atomic` RPC değişikliği — INSERT kolon listesi güncellenmezse mevcut kayıtlar bozulabilir. Mitigation: migration tek SQL dosyasında hem tablo hem RPC'yi günceller; `sql-writer` önce draft yazar, `rls-auditor` onaylar; deploy öncesi staging davranışı manuel test.

---

### 2. DEPOSIT TickerDetailTab Özel Görünümü `[S][P1]`

**Roadmap satırı**: `Asset Type Genişletme → "DEPOSIT TickerDetailTab özel görünümü" [P1]`

**Neden bu sprint**: DEPOSIT first-class asset type olarak Sprint 16'da eklendi; ancak TickerDetailTab hâlâ generik hisse senedi görünümü sunuyor ("Adet/Ort. Maliyet/P&L" + şirket bilgisi). Mevduat kullanıcısı için bu bilgiler anlamsız. `[S]` boyutu — schema değişikliği yok, yalnızca `type==="DEPOSIT"` dalı.

**Alt-task'lar**:
- **2a Vadeli mevduat varyantı** `[S]`: `maturity_date` dolu ise: Anapara (`shares`), Faiz Oranı (`interest_rate → %43.00`), Vade Tarihi + kalan gün badge, Hesaplanan Brüt Faiz (`computeDepositGrossInterest()`), Stopaj (%17.5), Net Faiz, Güncel Değer. Generik metrikler tamamen gizlenir. `ui-builder` sign-off zorunlu.
- **2b Esnek hesap varyantı** `[S]`: `maturity_date` null ise: Vade Tarihi satırı → "Tür: Esnek Hesap" badge; Günlük Net Kazanç (yıllık oran / 365 × anapara × 0.825); diğer satırlar aynı.
- **2c İşlem geçmişi label düzeltmesi** `[S]`: "1364699.53 adet ₺1.00" → "₺1,364,700 yatırılan" render; `type==="DEPOSIT"` dalında `fmtShares(shares)` yerine `₺`+tutar.

**DoD**:
- Vadeli mevduat pozisyonu → TickerDetailTab → Anapara/Faiz Oranı/Vade Tarihi/Net Faiz satırları görünüyor; Şirket Bilgisi yok.
- Esnek hesap pozisyonu → Tür: Esnek Hesap badge + Günlük Net Kazanç satırı görünüyor.
- İşlem geçmişinde tutar okunabilir formatta.
- `npm run check:babel` geçiyor; görsel regresyon yok.
- `ui-builder` sign-off'u tamamlanmış.

**Risk**: `computeDepositGrossInterest()` App.js modül seviyesinde tanımlı; TickerDetailTab bileşeni buna doğrudan erişemiyor olabilir. Mitigation: fonksiyon `src/utils.js`'e taşınır veya prop olarak iletilir — `ui-builder` mimarik kararı verir.

---

### 3. DEPOSIT/CASH Dashboard Blok Para Birimi Düzeltmesi `[S][P1]`

**Roadmap satırı**: `Asset Type Genişletme → "DEPOSIT/CASH Dashboard blok değeri ₺ göster" [P1]`

**Neden bu sprint**: Dashboard'da Vadeli Mevduat bloğu `$30,127` gösteriyor; TRY cinsinden mevduat için `$` sembolü yanlış. Display currency toggle ($/ ₺) değişince dönüşüm olmalı, ancak doğal currency sembolü öncelikli. Küçük render fix — 1-2 saatlik iş.

**Alt-task'lar**:
- **3a Blok toplam sembol**: `mixed:true` blokta (DEPOSIT/CASH) toplam satırı için `fmtSign(total, displaySym(blokCurrency))` yerine pozisyon para birimini kullan.
- **3b Bireysel pozisyon satırı**: Her DEPOSIT/CASH pozisyon satırında sembol `$` değil `displaySym(p.currency)` olsun.

**DoD**:
- TRY vadeli mevduat Dashboard satırında `₺1,364,700` görünüyor (display currency `$` seçiliyken bile en azından sembol doğru).
- Display currency `₺` seçilince TRY pozisyonlar dönüşüm gerektirmeksizin `₺` gösteriyor.
- `npm run check:babel` geçiyor.

**Risk**: `mixed:true` blok render mantığı karmaşık olabilir; yanlış değişiklik diğer blokları etkileyebilir. Mitigation: yalnızca DEPOSIT/CASH type'larını hedefle; US_STOCK/BIST blokları dokunulmaz.

---

## Out of Scope (bilinçli ertelenenler)

- **BES TickerDetailTab breakdown kartı** `[S][P1]`: BES DK entegrasyonu (`dk_principal`/`dk_current`) önkoşul; Sprint 19'a.
- **Temettü Takvimi Faz 2 (c) — Dashboard "Bu ay beklenen temettüler"**: Faz 1 canlıda stabilize olduktan sonra; Sprint 19 adayı.
- **Piyasa Dayanıklılık Skoru** `[M][P2]`: Kapsamlı frontend hesabı; ayrı sprint hedefi hak ediyor.
- **Karmaşık kartlara önce sonuç cümlesi** `[S][P1]`: Brand Fit B3 devamı; Sprint 19'a.
- **Going Live / Custom Domain**: Birden fazla sprint; bağımsız milestone olarak ele alınacak.
- **Stale Fiyat Uyarısı** `[S][P2]`: Değerli ancak P2; P1 item'lar önce.

---

## Demo / Validation

1. **BES DK**: Yeni BES pozisyonu ekle — 4 alan doldur (kişisel yatırılan: ₺10,000, kişisel güncel: ₺11,500, DK anaparası: ₺2,500, DK güncel: ₺2,800) → Dashboard'da P&L = ₺(11500 + 2800 − 10000) = ₺4,300 görünüyor.
2. **BES edit**: Mevcut BES pozisyonunu düzenle → 4 alan önceki değerlerle dolu geliyor.
3. **DEPOSIT detail**: TRY vadeli mevduat → TickerDetailTab → Anapara/Faiz/Vade/Net Faiz satırları görünüyor; "Şirket Bilgisi", "Adet" yok.
4. **Sembol**: Dashboard display currency `$` iken TRY mevduat satırında `₺` görünüyor.
5. **Gerileme**: Mevcut BUY/SELL işlemleri, BIST/US pozisyonları, EUR tablosu, temettü satırı — hiçbiri etkilenmemiş.
