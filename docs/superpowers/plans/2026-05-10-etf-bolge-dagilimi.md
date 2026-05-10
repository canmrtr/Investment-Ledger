# ETF Bölge Dağılımı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** VT, VWO, EEM gibi ETF pozisyonlarını FMP country-weightings ile gerçek ülke dağılımına göre Bölge Dağılımı pie'ına yansıtmak; LS'de 90 gün cache.

**Architecture:** Edge fn `mode:"etf-country"` tickers[] → FMP paralel çekme → bucket normalizasyon → frontend `etfCw` state (LS-seeded) → `regionSlices` FUND pozisyonlarını weight'e göre expand eder.

**Tech Stack:** Deno edge fn (TypeScript), React 18 UMD + Babel Standalone, Supabase LS cache, FMP `/stable/etf/country-weightings`

---

## Files

| Dosya | İşlem |
|-------|-------|
| `supabase/functions/fetch-fundamentals/index.ts` | Modify — `mode:"etf-country"` dalı ekle |
| `fetch-fundamentals-edge-function.js` | Sync (index.ts'nin aynası) |
| `src/components/AnalysisTab.js` | Modify — REGION_META, etfCw state, useEffect, regionSlices, UI |

---

## Task 1: Edge Function — `mode:"etf-country"` Dalı

**Files:**
- Modify: `supabase/functions/fetch-fundamentals/index.ts`

- [ ] **Step 1.1: `dividend-calendar` bloğunun hemen arkasına `etf-country` dalını ekle**

`supabase/functions/fetch-fundamentals/index.ts` dosyasında, satır 728'deki `return json({ dividends: results });` satırının hemen ardına (yani `// Mode: refresh-fund-cache` yorumundan önce) şu bloğu ekle:

```typescript
    // Mode: etf-country — FMP ETF ülke ağırlıkları. Frontend 90 gün LS cache'ler.
    // Body: { mode: "etf-country", tickers: ["VT", "VWO"] }
    if (body.mode === "etf-country") {
      const tickers: string[] = Array.isArray(body.tickers) ? body.tickers.slice(0, 10) : [];
      if (tickers.length === 0) return json({ error: "tickers array required" }, 400);
      const fmpKey = Deno.env.get("FMP_KEY");
      if (!fmpKey) return json({ error: "FMP_KEY secret eksik" }, 500);

      const COUNTRY_REGION: Record<string, string> = {
        "United States": "us",
        "United Kingdom": "eu", "Germany": "eu", "France": "eu", "Switzerland": "eu",
        "Netherlands": "eu", "Sweden": "eu", "Denmark": "eu", "Norway": "eu",
        "Finland": "eu", "Belgium": "eu", "Italy": "eu", "Spain": "eu",
        "Austria": "eu", "Portugal": "eu", "Ireland": "eu", "Luxembourg": "eu",
        "Poland": "eu", "Czech Republic": "eu", "Hungary": "eu", "Greece": "eu",
        "Romania": "eu", "Slovakia": "eu", "Estonia": "eu", "Latvia": "eu",
        "Lithuania": "eu",
        "Japan": "asia-pac", "China": "asia-pac", "Australia": "asia-pac",
        "South Korea": "asia-pac", "Taiwan": "asia-pac", "Hong Kong": "asia-pac",
        "Singapore": "asia-pac", "India": "asia-pac", "New Zealand": "asia-pac",
        "Indonesia": "asia-pac", "Thailand": "asia-pac", "Malaysia": "asia-pac",
        "Philippines": "asia-pac", "Vietnam": "asia-pac", "Pakistan": "asia-pac",
        "Brazil": "em", "Mexico": "em", "South Africa": "em", "Saudi Arabia": "em",
        "United Arab Emirates": "em", "Qatar": "em", "Kuwait": "em", "Turkey": "em",
        "Russia": "em", "Egypt": "em", "Colombia": "em", "Chile": "em",
        "Peru": "em", "Argentina": "em", "Nigeria": "em", "Morocco": "em", "Kenya": "em",
      };

      const weights: Record<string, Record<string, number>> = {};
      await Promise.all(
        tickers
          .filter((t: string) => /^[A-Z0-9.\-]{1,12}$/i.test(t))
          .map(async (tk: string) => {
            try {
              const url = `https://financialmodelingprep.com/stable/etf/country-weightings?symbol=${encodeURIComponent(tk)}&apikey=${fmpKey}`;
              const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
              if (!r.ok) { weights[tk] = {}; return; }
              const raw = await r.json();
              const arr: Array<{ country: string; weightPercentage: string }> = Array.isArray(raw) ? raw : [];
              if (arr.length === 0) { weights[tk] = {}; return; }
              const buckets: Record<string, number> = {};
              for (const row of arr) {
                const bucket = COUNTRY_REGION[row.country] ?? "other";
                buckets[bucket] = (buckets[bucket] ?? 0) + (parseFloat(row.weightPercentage) || 0);
              }
              weights[tk] = buckets;
            } catch { weights[tk] = {}; }
          })
      );
      return json({ weights });
    }
```

- [ ] **Step 1.2: Edge fn syntax kontrolü**

```bash
npm run check:edge
```

Beklenen çıktı: hata yok.

- [ ] **Step 1.3: `edge-reviewer` agent ile güvenlik/kalite incelemesi yaptır**

Agent(`edge-reviewer`): "`fetch-fundamentals` edge fn'a `mode:"etf-country"` dalı eklendi. Deploy öncesi güvenlik ve hata yönetimi incelemesi yap. Sorunları raporla, dosyayı değiştirme."

Raporlanan kritik sorun varsa düzelt, ardından devam et.

- [ ] **Step 1.4: Commit**

```bash
git add supabase/functions/fetch-fundamentals/index.ts
git commit -m "feat: add etf-country mode to fetch-fundamentals edge fn"
```

---

## Task 2: Edge Function Sync + Deploy

**Files:**
- Modify: `fetch-fundamentals-edge-function.js` (index.ts'nin root kopyası)

- [ ] **Step 2.1: index.ts'ye eklediğin bloğun aynısını root dosyaya ekle**

`fetch-fundamentals-edge-function.js` dosyasında da satır 728'deki `return json({ dividends: results });` satırının hemen ardına Task 1'deki bloğun **birebir aynısını** ekle (TypeScript syntax aynı — Deno .js'te de geçerli).

- [ ] **Step 2.2: Drift check**

```bash
npm run check:edge-drift
```

Beklenen çıktı: "OK" veya fark yok mesajı.

- [ ] **Step 2.3: Deploy**

```bash
npx supabase functions deploy fetch-fundamentals --no-verify-jwt
```

- [ ] **Step 2.4: Smoke test**

Supabase Dashboard → Edge Functions → `fetch-fundamentals` → Test sekmesinden:
```json
{ "mode": "etf-country", "tickers": ["VT"] }
```
Beklenen yanıt: `{ "weights": { "VT": { "us": <float>, "eu": <float>, ... } } }` — boş `{}` değil.

- [ ] **Step 2.5: Commit**

```bash
git add fetch-fundamentals-edge-function.js
git commit -m "chore: sync fetch-fundamentals root js with index.ts (etf-country mode)"
```

---

## Task 3: AnalysisTab — REGION_META + ETF State

**Files:**
- Modify: `src/components/AnalysisTab.js`

- [ ] **Step 3.1: REGION_META'ya 4 yeni bucket ekle**

`src/components/AnalysisTab.js` dosyasında mevcut `REGION_META` bloğunu bul (satır ~209) ve şu şekilde güncelle:

```js
const REGION_META = {
  us:          { label: "US",                color: "#30d158" },
  tr:          { label: "Türkiye",            color: "#bf5af2" },
  eu:          { label: "Avrupa",             color: "#3B82F6" },
  "asia-pac":  { label: "Asya-Pasifik",       color: "#06B6D4" },
  em:          { label: "Gelişen Piyasalar",  color: "#D97706" },
  other:       { label: "Diğer",              color: "#6B7280" },
  crypto:      { label: "Global · Kripto",    color: "#ff9f0a" },
  emtia:       { label: "Global · Emtia",     color: "#ffd60a" },
  fx:          { label: "Döviz",              color: "#8e8e93" },
};
```

- [ ] **Step 3.2: `ETF_CW_TTL` sabitini bileşen dışına ekle**

`src/components/AnalysisTab.js` dosyasında `REGION_META` bloğunun hemen ardına (bileşen fonksiyonu dışında) şu satırı ekle:

```js
const ETF_CW_TTL = 90 * 24 * 60 * 60 * 1000;
```

- [ ] **Step 3.3: `etfCw` ve `etfCwBusy` state'lerini ekle**

`AnalysisTab` fonksiyonunun state bölümünde, `regionPieOpen` state'inin hemen altına şunları ekle:

```js
const [etfCw, setEtfCw] = useState(() => {
  const cache = {};
  pos.filter(p => p.type === "FUND" && p.currency !== "TRY").forEach(p => {
    const stored = LS.get(`il_etf_cw_${p.ticker.toUpperCase()}`, null);
    if (stored?.ts && (Date.now() - stored.ts) < ETF_CW_TTL && stored.weights) {
      cache[p.ticker] = stored.weights;
    }
  });
  return cache;
});
const [etfCwBusy, setEtfCwBusy] = useState(false);
```

- [ ] **Step 3.4: ETF country weights fetch useEffect'i ekle**

Mevcut `sectorMetaBusy` useEffect'inin (satır ~270) hemen ardına, yeni bir useEffect ekle:

```js
useEffect(() => {
  const fundTickers = pos
    .filter(p => p.type === "FUND" && p.currency !== "TRY")
    .map(p => p.ticker);
  if (fundTickers.length === 0) return;
  const missing = fundTickers.filter(tk => !etfCw[tk]);
  if (missing.length === 0) return;
  setEtfCwBusy(true);
  (async () => {
    try {
      const r = await edgeCallAuth("fetch-fundamentals", { mode: "etf-country", tickers: missing.slice(0, 10) });
      if (!r.ok) return;
      const data = await r.json();
      if (!data?.weights) return;
      setEtfCw(prev => {
        const next = { ...prev };
        Object.entries(data.weights).forEach(([tk, w]) => {
          if (w && Object.keys(w).length > 0) {
            next[tk] = w;
            LS.set(`il_etf_cw_${tk.toUpperCase()}`, { weights: w, ts: Date.now() });
          }
        });
        return next;
      });
    } catch (e) {
      DEBUG && console.warn("[etf-country]", e);
    } finally {
      setEtfCwBusy(false);
    }
  })();
}, []);
```

- [ ] **Step 3.5: Babel parse kontrolü**

```bash
npm run check:babel
```

Beklenen çıktı: hata yok.

- [ ] **Step 3.6: Commit**

```bash
git add src/components/AnalysisTab.js
git commit -m "feat: add etfCw state and fetch useEffect to AnalysisTab"
```

---

## Task 4: AnalysisTab — regionSlices ETF Expand

**Files:**
- Modify: `src/components/AnalysisTab.js`

- [ ] **Step 4.1: `regionSlices` hesabını güncelle**

Mevcut `regionSlices` hesabını (satır ~536) şu şekilde değiştir:

```js
const regionSlices = (() => {
  const byRegion = {};
  filteredPos.forEach(p => {
    const mv = mvDisp(p);
    if (mv <= 0) return;
    if (p.type === "FUND" && p.currency !== "TRY") {
      const cw = etfCw[p.ticker];
      if (cw && Object.keys(cw).length > 0) {
        const total = Object.values(cw).reduce((a, v) => a + v, 0);
        if (total > 0) {
          Object.entries(cw).forEach(([bucket, pct]) => {
            byRegion[bucket] = (byRegion[bucket] || 0) + mv * (pct / total);
          });
          return;
        }
      }
    }
    const region = REGION_OF[p.type] || "fx";
    byRegion[region] = (byRegion[region] || 0) + mv;
  });
  const total = Object.values(byRegion).reduce((a, v) => a + v, 0);
  const arr = Object.entries(byRegion).map(([key, value]) => ({
    key, label: REGION_META[key]?.label || key, value, color: REGION_META[key]?.color || "#666"
  })).sort((a, b) => b.value - a.value);
  arr.forEach(s => s.frac = total > 0 ? s.value / total : 0);
  return { arr, total };
})();
```

- [ ] **Step 4.2: Babel parse kontrolü**

```bash
npm run check:babel
```

Beklenen çıktı: hata yok.

- [ ] **Step 4.3: Commit**

```bash
git add src/components/AnalysisTab.js
git commit -m "feat: expand ETF positions in regionSlices using country weights"
```

---

## Task 5: AnalysisTab — Bölge Dağılımı UI Güncellemesi

**Files:**
- Modify: `src/components/AnalysisTab.js`

- [ ] **Step 5.1: Başlıkta "Yükleniyor…" göstergesi ekle**

Bölge Dağılımı kartındaki başlık satırını bul (satır ~879):

```jsx
<div className="stitle" style={{marginBottom:0}}>Bölge Dağılımı</div>
```

Şu şekilde güncelle:

```jsx
<div className="stitle" style={{marginBottom:0}}>
  Bölge Dağılımı
  {etfCwBusy && <span style={{color:"var(--text3)",fontSize:11,marginLeft:6,fontWeight:400}}>Yükleniyor…</span>}
</div>
```

- [ ] **Step 5.2: Dipnot metnini güncelle**

Mevcut dipnot metnini bul:

```
Heuristik: US_STOCK/FUND→US, BIST→Türkiye, CRYPTO→Global·Kripto, GOLD→Global·Emtia, FX→Döviz. ETF içerikleri (MCHI=Çin gibi) ileride.
```

Şu şekilde değiştir:

```jsx
<div style={{fontSize:10,color:"var(--text3)",marginTop:10,lineHeight:1.5}}>
  ETF/Fon pozisyonları için gerçek ülke dağılımı kullanılır (FMP, 90 gün cache). TEFAS/TRY fonlar ve bilinmeyen ETF'ler için US heuristiği geçerli.
</div>
```

- [ ] **Step 5.3: `ui-builder` agent ile UI incelemesi yaptır**

Agent(`ui-builder`): "AnalysisTab Bölge Dağılımı kartına `etfCwBusy` yükleniyor göstergesi ve yeni dipnot metni eklendi. Mevcut tasarım sistemi (dark/light tema, CSS değişkenleri, font ve renk token'ları) ile uyumu kontrol et. Dosyayı değiştirme, sadece raporla."

Raporlanan sorun varsa düzelt.

- [ ] **Step 5.4: Babel parse kontrolü**

```bash
npm run check:babel
```

Beklenen çıktı: hata yok.

- [ ] **Step 5.5: Commit**

```bash
git add src/components/AnalysisTab.js
git commit -m "feat: add ETF country weight loading indicator and update region footnote"
```

---

## Task 6: Tarayıcıda Doğrulama

- [ ] **Step 6.1: Yerel sunucu başlat**

```bash
npx serve .
```

Tarayıcıda `http://localhost:3000` aç.

- [ ] **Step 6.2: Senaryoları doğrula**

Uygulamaya giriş yap, AnalysisTab → Bölge Dağılımı kartını aç:

**Senaryo 1 — ETF pozisyonu varsa:**
- `type:"FUND"` + `currency:"USD"` pozisyon (VT, VWO, SPY vb.) portföyde varsa:
  - Kart açıldığında birkaç saniye "Yükleniyor…" görünür
  - Pie/legend güncellenir: VT için "US + Avrupa + Asya-Pasifik + ..." slice'ları çıkar
  - İkinci kez AnalysisTab açınca "Yükleniyor…" görünmez (LS cache devreye girer)

**Senaryo 2 — FUND pozisyonu yoksa:**
- "Yükleniyor…" hiç görünmez, pie değişmez

**Senaryo 3 — SPY (saf US ETF):**
- FMP %100 US döndürür → pie "US" slice'ı etkilenmez, sonuç aynı

**Senaryo 4 — LS cache kontrolü:**
- DevTools → Application → Local Storage → `il_etf_cw_VT` anahtarını bul
- `{ "weights": {...}, "ts": <epoch> }` formatında olmalı

- [ ] **Step 6.3: Push**

```bash
git push
```

GitHub Pages `https://canmrtr.github.io/Investment-Ledger/` — `main` branch deploy olur.
