# Sprint 03 — 2026-04-27 → 2026-05-10

**Goal**: TR yatırımcısı altın pozisyonunu doğru birimde ekleyebilir; tüm işlem formları geçersiz girişi anında gösterir.

**Capacity**: 2 hafta × ~5-6h/hafta efektif (akşam + hafta sonu)

---

## Scope

1. **TR altın birimleri** — `[M][P1]` (ROADMAP: Asset Type Genişletme)
   - DoD:
     - `positions.unit` kolonu eklendi (sql-writer agent, migration)
     - `GOLD_UNITS` sabiti: gram / çeyrek / yarım / tam / Cumhuriyet / Reşat / Ata + USD/ons (8 birim × ağırlık × saflık tablosu)
     - ManuelPosForm GOLD modunda birim chip picker; `avgCost` TRY/adet olarak girilir
     - Dashboard render: "5 çeyrek · ₺12,000/ad · Spot saf ₺55,000 · Premium %9"
     - USD/ons MVP geriye uyumlu (unit=null → ons davranışı)
     - Spot hesabı: XAU/USD → USD/gram → TRY/gram (fx) → TRY/adet (×ağırlık×saflık)
   - Risk: schema migration sırasında mevcut GOLD pozisyonları `unit=null` kalır → fallback mantığı şart. sql-writer'a "unit IS NULL → ons muamelesi" kuralını ver.

2. **input step="any" — ondalık adet bug fix** — `[S][P1]` (ROADMAP: Sprint Audit Backlog Grup 3, P1'e yükseltildi)
   - DoD:
     - ManuelPosForm tüm `<input type="number">` adet alanlarında `step="any"` var
     - 0.5 BTC, 3.75 gram, 12.5 çeyrek altın başarıyla girilip kaydediliyor
     - `fmtShares` zaten ondalık destekliyor — görüntüde değişiklik yok
   - Risk: neredeyse sıfır — tek satır HTML attribute değişikliği.

3. **Form input error inline** — `[S][P1]` (ROADMAP: Sprint Audit Backlog Grup 1)
   - DoD:
     - ManuelPosForm: negatif adet, geçersiz tarih (gelecek + çok eski), sıfır fiyat için submit öncesi `aria-invalid="true"` + 11px kırmızı hata metni
     - Hata submit sonrası değil, `onBlur` veya `onChange` + dirty flag ile gösterilir
     - ConfirmBox inline edit alanlarında da temel validasyon (negatif sayı koruması)
     - Mevcut `flash_()` error'lar silinmiyor — hata metni ek katman
   - Risk: `onBlur` dirty pattern biraz boilerplate; eğer zaman daralırsa sadece submit-time validation da kabul edilebilir (DoD azaltılır, not bırakılır).

4. **Confirm modal backdrop click guard (danger)** — `[S][P1]` (ROADMAP: Sprint Audit Backlog Grup 1)
   - DoD:
     - `danger:true` parametresiyle açılan modalda backdrop (`.mdl-bd`) click işlemi iptal etmez
     - Explicit "İptal" butonu ile kapatılabilir
     - Normal (non-danger) modal backdrop davranışı değişmez
   - Risk: düşük — `confirm_()` helper'a tek koşul ekleniyor.

5. **Period buton wrap dar ekran** — `[S][P1]` (ROADMAP: Sprint Audit Backlog Grup 2)
   - DoD:
     - 320px ekranda dönem butonları (1H/3H/6H/1Y/Tüm) tek satırda kalır veya 2 satıra düzgün kırılır, ezilmez
     - `flex:1; min-width:40px` veya `flex-wrap:wrap` ile çözüm
     - iPhone SE (375px) + eski Android 360px'de test edildi
   - Risk: düşük — pure CSS değişikliği.

---

## Out of Scope (bilinçli ertelenenler)

- **BIST bankalar fundamentals** — UFRS Roman numeral mapping büyük araştırma gerektiriyor; Sprint 4+
- **Sektör-aware fundamental eşikler** — FMP `sector` API araştırması gerek; Sprint 4
- **EDGAR P/E + P/S** — market price × shares outstanding; bağımlılıklar belirsiz; Sprint 4+
- **EUR tablosu sort** — EUR pozisyon sayısı az, düşük etki; Sprint 4
- **TR altın birimleri — işçilik premium ayarlanabilir giriş** — ilk versiyonda sabit tahmin yeterli, interaktif premium slider Sprint 4

---

## Demo / Validation

Sprint sonunda doğrulama akışı:

1. Yeni pozisyon ekle: GOLD → "Çeyrek" birim seç → 5 adet → ₺12.500/adet → kaydet
2. Dashboard'da "5 çeyrek · ₺62,500 · Spot saf ~₺XX,XXX · Premium %Y" görünüyor
3. 0.00345 BTC girişi form reject etmeden kaydediliyor
4. ManuelPosForm'da negatif shares girilip blur'da anında hata metni çıkıyor
5. "Pozisyonları Yeniden Hesapla" danger modal'ında backdrop tıkla → modal kapanmıyor
6. 360px viewport'ta dönem butonları ezilmiyor

---

## Retro Notu (Sprint 2 sonu — bu oturum)

Bu oturumda 8 UX fix tamamlandı: Flash sticky, cur-seg dokunma hedefi, mobil progress strip, Sparkline min-height, Analiz FX warn-card, CSV skip count, Dashboard Piyasa Değeri full-width, otomatik güncelleme (30dk interval + visibility API). Tüm item'lar `[S][P1]` seviyesindeydi — doğru kapsam, tek oturumda bitti. Kalan P1'ler Sprint 3'e aktarıldı; TR altın birimleri sprint'in ağır item'ı olarak öne çıktı.
