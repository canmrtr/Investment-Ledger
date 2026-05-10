# Akıllı Nudge (c) — Sağlık Skoru + XIRR Kuralları + AnalysisTab Scroll

**Tarih**: 2026-05-10  
**Sprint**: 13, Item 1  
**Büyüklük**: S  
**Bağımlılık**: Sprint 11'de teslim edilen (a)+(b) kuralları mevcut ve çalışıyor

---

## Bağlam

Sprint 11'de `computeNudges()` fonksiyonu ve Dashboard nudge render/dismiss mekanizması teslim edildi:
- (a) Konsantrasyon kuralı (P0): tek pozisyon >%35
- (b) İnaktivite (P1) + Çeşitlendirme (P1)

Bu spec yalnızca (c) alt-task'ı kapsar: iki yeni kural + scroll UX.

---

## Mimari

### computeNudges Signature Değişimi

**Mevcut**: `computeNudges(positions, transactions, annualRate)`  
**Yeni**: `computeNudges(positions, transactions, healthRedCount, annualRate, displayCur)`

| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `healthRedCount` | `number \| null` | AnalysisTab'dan callback ile gelir; null ise sağlık nudge'ı atlanır |
| `annualRate` | `number \| null` | Mevcut XIRR sonucu (App.js line ~321'deki `annualRate`) |
| `displayCur` | `"USD" \| "TRY"` | Topbar toggle durumu; eşik seçimi için |

### Veri Akışı: healthRedCount

`fundCache` AnalysisTab local state'inde yaşıyor. App.js'e taşıma yöntemi: **callback prop**.

```
App.js
  └── healthRedCount state (null)
  └── <AnalysisTab onHealthSummary={setHealthRedCount} />

AnalysisTab
  └── useEffect([fundCache, healthFiltered])
        → redCount = kırmızı metrik aggregate
        → onHealthSummary?.(redCount)
```

---

## Yeni Kurallar

### Kural: health_score (P1)

```
koşul: healthRedCount != null && healthRedCount >= 3
id: "health_score"
priority: 1
message: "${healthRedCount} metrikte dikkat gerektiren sağlık göstergesi var"
actionTab: "analysis"
actionCard: "health"
```

- `healthRedCount` null ise (AnalysisTab hiç açılmamışsa): nudge atlanır — crash yok
- Kırmızı metrik sayısı AnalysisTab'daki mevcut aggregate hesabından türetilir (healthFiltered × 8 metrik)

### Kural: xirr_low (P1)

```
koşul (TRY): annualRate != null && displayCur === "TRY" && annualRate < 0.40
koşul (USD): annualRate != null && displayCur === "USD" && annualRate < 0.05
id: "xirr_low"
priority: 1
message: "Portföy getirisi enflasyonun altında kalıyor olabilir (tahmini)"
actionTab: "analysis"
```

- `annualRate` null veya 0 ise: atlanır
- XIRR kısa periyotta hesaplanmaz (App.js'de `longPeriod` kontrolü); `annualRate` zaten `null` gelir → safe
- Mesajda "tahmini" notu: eşik sabit, kişiselleştirilmemiş

---

## UI Değişiklikleri

### Nudge Kart — "Analiz'e Git" Linki

`actionCard: "health"` içeren nudge'larda dismiss butonunun soluna link eklenir:

```
[ℹ️ X metrikte dikkat gerektiren sağlık göstergesi var]  [Analiz'e Git →] [×]
```

Tıklama:
1. `setTab("analysis")`
2. `setTimeout(() => document.querySelector('[data-card="health"]')?.scrollIntoView({behavior:"smooth", block:"start"}), 150)`

`actionTab` olan ama `actionCard` olmayan nudge'larda link çıkmaz (mevcut davranış korunur).

### AnalysisTab — data-card="health" Attribute

Portföy Sağlık başlık container'ına `data-card="health"` eklenir (scroll hedefi).

---

## Değişen Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `src/utils.js` | `computeNudges` 2 yeni param + 2 yeni kural |
| `src/components/App.js` | `healthRedCount` state; AnalysisTab prop; nudge call güncelleme; "Analiz'e Git" link render |
| `src/components/AnalysisTab.js` | `onHealthSummary` prop; `useEffect` kırmızı sayım; `data-card="health"` attribute |

---

## Definition of Done

- [ ] `computeNudges` 5 nudge kuralını içeriyor; pure function
- [ ] `healthRedCount >= 3` olan test senaryosunda Dashboard'da sağlık nudge'ı çıkıyor
- [ ] "Analiz'e Git →" tıklanınca AnalysisTab açılıyor ve Portföy Sağlık kartı görünüyor
- [ ] XIRR eşiği aşıldığında `xirr_low` nudge'ı çıkıyor; `displayCur` değişince eşik değişiyor
- [ ] `healthRedCount` null → sağlık nudge'ı yok; `annualRate` null → xirr nudge'ı yok
- [ ] Babel check geçiyor (`npm run check:babel`)
- [ ] `ui-builder` agent scroll UX'ini onaylıyor
