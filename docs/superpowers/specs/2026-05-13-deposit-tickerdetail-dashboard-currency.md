# Sprint 18 Item 2 & 3 — DEPOSIT TickerDetailTab + Dashboard Sembol Düzeltmesi

**Date:** 2026-05-13
**Status:** Approved
**Sprint:** 18

---

## Bağlam

Sprint 16'da DEPOSIT first-class asset type olarak eklendi. İki eksik kaldı:
1. TickerDetailTab hâlâ generik hisse senedi görünümü sunuyor — DEPOSIT için anlamsız metrikler.
2. Dashboard'da TRY vadeli mevduat bloğu başlığı display currency `$` seçiliyken `$30,127` gösteriyor.

---

## Item 2 — DEPOSIT TickerDetailTab Özel Görünümü

### Kapsam

`src/components/TickerDetailTab.js` — yalnızca `p.type==="DEPOSIT"` dalı.

### Varyant 2a: Vadeli hesap (`maturity_date` dolu)

Mevcut 4-kart grid (`Adet / Toplam Maliyet / Piyasa Değeri / Toplam P&L`) yerine tek kart:

| Satır | Değer |
|-------|-------|
| Anapara | `sym + fmt(p.shares, 0)` |
| Yıllık Faiz Oranı | `(p.interestRate * 100).toFixed(2) + "%"` |
| Vade Tarihi | `fmtDateTR(p.maturityDate)` + kalan gün badge |
| Brüt Faiz | `sym + fmt(grossInterest, 0)` |
| Stopaj (%17.5) | `"−" + sym + fmt(grossInterest * DEPOSIT_TAX_RATE, 0)` |
| Net Faiz | `sym + fmt(netInterest, 0)` · renk: `var(--ok)` |
| Güncel Değer | `sym + fmt(p.shares + netInterest, 0)` |

Kalan gün badge rengi:
- Geçmiş (`days < 0`): `var(--err)` · "Vadesi geçti"
- ≤30 gün: `var(--warn)` · "+N gün"
- >30 gün: `var(--ok)` · "+N gün"

### Varyant 2b: Esnek hesap (`maturity_date` null)

Vade Tarihi satırı → "Esnek Hesap" badge. Ek satır:

| Satır | Değer |
|-------|-------|
| Günlük Net Kazanç | `sym + fmt(netInterest / max(elapsedDays,1), 2)` |

Diğer satırlar (Anapara, Faiz Oranı, Brüt/Net Faiz, Güncel Değer) aynı.

### Gizlenen bölümler

`p.type==="DEPOSIT"` iken aşağıdakiler render edilmez:
- Şirket Bilgisi kartı
- Fundamental / Değer Yatırımı Checklist kartı
- Analist Tavsiyeleri kartı
- Temettü bölümü
- "Ort. Maliyet / Realized / Unrealized / Komisyon" detay satırı

Pozisyon header kartı (ticker + isim + güncel değer) korunur.
İşlem geçmişi bölümü korunur; 2c ile düzeltilir.

### 2c — İşlem geçmişi label düzeltmesi

DEPOSIT/CASH BUY satırlarında:
- Özet satır: `fmtShares(t.shares) adet` → `sym + fmt(t.shares, 0) + " yatırılan"`
- Birim fiyat span'ı (`₺1.00`) gizlenir: `!(isDeposit||isCash)` koşuluyla
- SELL: `sym + fmt(t.shares, 0) + " çekilen"` (isteğe bağlı iyileştirme)

### Teknik not

`computeDepositGrossInterest` ve `DEPOSIT_TAX_RATE` App.js modül seviyesinde tanımlı.
Babel standalone + `<script src>` mimarisinde tüm scriptler global scope paylaşır —
TickerDetailTab.js doğrudan çağırabilir; prop drilling veya taşıma gerekmez.

`grossInterest = computeDepositGrossInterest(tickerTxs, p.interestRate * (1 - (p.reserveRatio||0)), p.maturityDate||null)`

---

## Item 3 — Dashboard Blok Header Para Birimi Düzeltmesi

### Sorun

`App.js:865`:
```js
{mask((cfg.mixed ? dSym : cfg.sym) + fmt(totMv, 0))}
```

`totMv` (line 842): `items.reduce((a,p) => a + (cnv(p.mv??p.cost, p.currency||"TRY") ?? 0), 0)`

`cnv = (amt, from) => convert(amt, from, displayCur, fxRates)` — displayCur="USD" iken TRY → USD convert olur, `dSym="$"` ile gösterilir.

### Fix

Blok render kodunda (line 838 sonrası), DEPOSIT/CASH için:

```js
const isNativeBlock = cfg.type === "CASH" || cfg.type === "DEPOSIT";
const allSameCur = isNativeBlock && items.every(p => p.currency === items[0]?.currency);
const nativeSym = allSameCur ? displaySym(items[0]?.currency || "TRY") : dSym;

const totMv = cfg.mixed
  ? (allSameCur
      ? items.reduce((a, p) => a + (p.mv ?? p.cost), 0)      // native, no conversion
      : items.reduce((a, p) => a + (cnv(p.mv ?? p.cost, p.currency || "TRY") ?? 0), 0))
  : items.reduce((a, p) => a + (p.mv ?? p.cost), 0);
```

Header sembol: `cfg.mixed ? nativeSym : cfg.sym`

### Kapsam sınırı

- Bireysel pozisyon satırları (`depSym`, `mSym`) zaten doğru — dokunulmaz.
- BIST/BES/US_STOCK/FUND/CRYPTO/GOLD blokları dokunulmaz.
- KPI toplamı ve XIRR hesabı dokunulmaz.

---

## Doğrulama

1. TRY vadeli mevduat → Dashboard blok başlığı display `$` iken `₺1,364,700` görünüyor.
2. Display `₺` ile de doğru sembol ve tutar.
3. Vadeli mevduat → TickerDetailTab → Anapara/Faiz Oranı/Vade/Net Faiz satırları görünüyor; Şirket Bilgisi yok.
4. Esnek hesap → "Esnek Hesap" badge + Günlük Net Kazanç satırı.
5. İşlem geçmişinde "₺1,364,700 yatırılan" görünüyor; "1364699.53 adet" yok.
6. Mevcut BUY/SELL/BIST/US_STOCK pozisyonları etkilenmemiş.

---

## Değiştirilecek Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `src/components/TickerDetailTab.js` | DEPOSIT dalı: özel kart, gizlenen bölümler, tx label fix |
| `src/components/App.js` | Dashboard blok header totMv + sembol fix |
