# DEPOSIT Çekim Butonu — Design Spec

**Date:** 2026-05-13  
**Status:** Approved

---

## Kapsam

`src/components/TickerDetailTab.js` — yalnızca `isDeposit===true` dalı, Mevduat Özeti kartı içi.

---

## UI

"Mevduat Özeti" kartının en altına küçük `Çek` butonu eklenir. Tıklayınca kartın içinde inline form açılır:

```
[Tarih input]   [₺ Tutar input]   [Çek butonu]  [İptal butonu]
```

- `showCek` boolean state (`useState(false)`) — form görünürlüğü
- Form state: `{ date: today(), amount: "" }`
- Tarih: `<input type="date">` default today, max today
- Tutar: `<input type="number" step="any">` placeholder `0`
- Sembol: `sym` (pozisyonun para birimi)

---

## İş Mantığı

Submit validasyonu:
- `amount > 0` — zorunlu
- `amount <= p.shares` — anaparadan fazla çekilemesin; hata: `"Çekim tutarı anapara (₺X) aşamaz"`

İşlem kaydı:
```js
sb.from("transactions").insert({
  user_id: user.id,
  date: form.date,
  ticker: p.ticker,
  name: p.name,
  asset_type: "DEPOSIT",
  way: "SELL",
  shares: +form.amount,
  price: 1.0,
  currency: p.currency,
  total: +form.amount,
  broker: p.broker || "",
  commission: 0,
  exchange: "",
  notes: "",
  portfolio_id: portfolioId
})
```

Sonrası: `rebuildPositions(user.id, portfolioId)` → `loadData()` → `flash_("Çekim eklendi ✓")` → `setShowCek(false)` → form reset.

Hata durumu: `flash_(error.message, "err")`.

---

## Değiştirilecek Dosya

| Dosya | Değişiklik |
|-------|-----------|
| `src/components/TickerDetailTab.js` | `showCek` state, Çek butonu + form Mevduat Özeti kartı altına |
