# Akıllı Nudge (c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `computeNudges`'a sağlık skoru + XIRR kuralları ekle; nudge kartına AnalysisTab scroll linki ekle.

**Architecture:** `fundCache`'deki kırmızı metrik sayısı AnalysisTab → App.js callback prop ile taşınır; `computeNudges` yeni parametre alır; nudge kartı `actionCard` varsa scroll link gösterir.

**Tech Stack:** React 18 UMD, Babel Standalone (tarayıcıda JSX), `npx serve .` ile yerel test.

---

## Değişen Dosyalar

| Dosya | Değişiklik |
|-------|------------|
| `src/utils.js` | `computeNudges` — yeni signature + 2 kural |
| `src/components/App.js` | `healthRedCount` state; AnalysisTab prop; nudge çağrısı; scroll link render |
| `src/components/AnalysisTab.js` | `onHealthSummary` prop; `useEffect`; `data-card="health"` |

---

## Task 1: computeNudges — yeni signature ve 2 kural (utils.js)

**Files:**
- Modify: `src/utils.js:395-446`

- [ ] **Adım 1: computeNudges fonksiyonunu güncelle**

`src/utils.js` satır 381–446 arasındaki yorum + fonksiyonu aşağıdakiyle değiştir:

```js
// ── Akıllı Nudge kuralları ────────────────────────────────────────
// positions: allDisp dizisi — {ticker, name, type, mv, cost, ...}
// transactions: raw txs dizisi — {way, date, ...}
// healthRedCount: AnalysisTab'dan gelen kırmızı metrik sayısı (number|null)
// annualRate: xirr sonucu (number|null|NaN)
// displayCur: "USD"|"TRY"
// Returns: [{id, priority, message, actionTab, actionCard?}] sorted by priority asc
const TYPE_LABELS = {
  US_STOCK: 'ABD hisselerinden',
  BIST: 'BIST hisselerinden',
  CRYPTO: 'kripto varlıklardan',
  GOLD: 'altından',
  FUND: 'fonlardan',
  FX: 'dövizden'
};

const computeNudges = (positions, transactions, healthRedCount, annualRate, displayCur) => {
  if (!positions || positions.length === 0) return [];
  const nudges = [];

  // P0: Konsantrasyon — tek pozisyon >%35
  const hasMV = positions.every(p => p.mv != null);
  const totalMV = positions.reduce((a, p) => a + (p.mv ?? p.cost ?? 0), 0);
  if (hasMV && totalMV > 0) {
    for (const p of positions) {
      const mv = p.mv;
      const pct = (mv / totalMV) * 100;
      if (pct > 35) {
        nudges.push({
          id: `concentration_${p.ticker}`,
          priority: 0,
          message: `${p.ticker} pozisyonun portföyün %${Math.round(pct)}'ini oluşturuyor`,
          actionTab: 'analysis'
        });
      }
    }
  }

  // P1: İnaktivite — son BUY'dan >90 gün
  const buys = (transactions || []).filter(t => t.way === 'BUY');
  if (buys.length > 0) {
    const lastBuyDate = buys.reduce((max, t) => t.date > max ? t.date : max, '');
    const daysSince = Math.floor((Date.now() - new Date(lastBuyDate).getTime()) / 86400000);
    if (daysSince > 90) {
      nudges.push({
        id: 'inactivity',
        priority: 1,
        message: `${daysSince} gündür yeni işlem yok`,
        actionTab: 'add'
      });
    }
  }

  // P1: Çeşitlendirme — yalnızca 1 asset_type
  const types = [...new Set(positions.map(p => p.type).filter(Boolean))];
  if (types.length === 1) {
    const label = TYPE_LABELS[types[0]] || types[0];
    nudges.push({
      id: 'diversification',
      priority: 1,
      message: `Portföyün tamamı ${label} oluşuyor`,
      actionTab: 'search'
    });
  }

  // P1: Sağlık skoru — 3+ kırmızı metrik
  if (healthRedCount != null && healthRedCount >= 3) {
    nudges.push({
      id: 'health_score',
      priority: 1,
      message: `${healthRedCount} metrikte zayıf sağlık göstergesi var`,
      actionTab: 'analysis',
      actionCard: 'health'
    });
  }

  // P1: XIRR — enflasyon altı getiri
  const xirrNum = annualRate != null ? Number(annualRate) : NaN;
  if (!isNaN(xirrNum) && xirrNum !== 0) {
    const threshold = displayCur === 'TRY' ? 0.40 : 0.05;
    if (xirrNum < threshold) {
      nudges.push({
        id: 'xirr_low',
        priority: 1,
        message: 'Portföy getirisi enflasyonun altında kalıyor olabilir (tahmini)',
        actionTab: 'analysis'
      });
    }
  }

  return nudges.sort((a, b) => a.priority - b.priority);
};
```

- [ ] **Adım 2: Babel syntax kontrolü**

```bash
cd /Users/canmerter/Documents/Claude/Investment-Ledger && npm run check:babel
```

Beklenen: tüm dosyalar ✓, hata yok.

- [ ] **Adım 3: Commit**

```bash
git add src/utils.js
git commit -m "feat: add health_score and xirr_low rules to computeNudges"
```

---

## Task 2: App.js — healthRedCount state, AnalysisTab prop, nudge render

**Files:**
- Modify: `src/components/App.js:60` (state)
- Modify: `src/components/App.js:592-605` (nudge render)
- Modify: `src/components/App.js:866` (AnalysisTab prop)

- [ ] **Adım 1: healthRedCount state ekle**

`src/components/App.js` satır 60'taki `nudgeDismissed` state'inin hemen altına ekle:

```js
  const [nudgeDismissed,setNudgeDismissed]=useState(()=>LS.get('il_nudge_dismissed',{}));
  const [healthRedCount,setHealthRedCount]=useState(null);
```

- [ ] **Adım 2: computeNudges çağrısını güncelle**

Satır 592'deki çağrıyı değiştir:

```js
// ÖNCE:
const activeNudges=computeNudges(allDisp,txs,annualRate)

// SONRA:
const activeNudges=computeNudges(allDisp,txs,healthRedCount,annualRate,displayCur)
```

- [ ] **Adım 3: Nudge kart render'ını güncelle (actionCard scroll linki)**

Satır 596–605 arasındaki `activeNudges.map(...)` bloğunu değiştir:

```js
              return activeNudges.map(n=>(
                <div key={n.id} className="warn-card" style={{alignItems:'center'}}>
                  <div className="wc-sub" style={{flex:1}}>{n.message}</div>
                  {n.actionCard&&(
                    <button
                      style={{background:'none',border:'none',color:'var(--info)',cursor:'pointer',fontSize:12,padding:'0 8px',flexShrink:0,whiteSpace:'nowrap'}}
                      onClick={()=>{
                        setTab(n.actionTab);
                        setTimeout(()=>document.querySelector(`[data-card="${n.actionCard}"]`)?.scrollIntoView({behavior:'smooth',block:'start'}),150);
                      }}
                    >Analiz'e Git →</button>
                  )}
                  <button
                    style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:20,lineHeight:1,padding:'0 0 0 12px',flexShrink:0}}
                    onClick={()=>dismiss(n.id)}
                    aria-label="Kapat"
                  >×</button>
                </div>
              ));
```

- [ ] **Adım 4: AnalysisTab'a onHealthSummary prop geç**

Satır 866'daki `<AnalysisTab .../>` çağrısını güncelle:

```js
// ÖNCE:
<AnalysisTab pos={pos} txs={txs} splits={splits} prc={prc} hist={hist} hide={hide} mask={mask} setTab={setTab} displayCur={displayCur} fxRates={fxRates} openDetail={openDetail}/>

// SONRA:
<AnalysisTab pos={pos} txs={txs} splits={splits} prc={prc} hist={hist} hide={hide} mask={mask} setTab={setTab} displayCur={displayCur} fxRates={fxRates} openDetail={openDetail} onHealthSummary={setHealthRedCount}/>
```

- [ ] **Adım 5: Babel syntax kontrolü**

```bash
cd /Users/canmerter/Documents/Claude/Investment-Ledger && npm run check:babel
```

Beklenen: tüm dosyalar ✓.

- [ ] **Adım 6: Commit**

```bash
git add src/components/App.js
git commit -m "feat: wire healthRedCount state and actionCard scroll to nudge cards"
```

---

## Task 3: AnalysisTab.js — onHealthSummary prop, useEffect, data-card

**Files:**
- Modify: `src/components/AnalysisTab.js:240` (prop signature)
- Modify: `src/components/AnalysisTab.js` (useEffect — fundCache sonrası)
- Modify: `src/components/AnalysisTab.js:919` (health card div)

- [ ] **Adım 1: onHealthSummary prop'u function signature'a ekle**

Satır 240'ı değiştir:

```js
// ÖNCE:
function AnalysisTab({pos,txs,splits,prc,hist,hide,mask,setTab,displayCur,fxRates,openDetail}){

// SONRA:
function AnalysisTab({pos,txs,splits,prc,hist,hide,mask,setTab,displayCur,fxRates,openDetail,onHealthSummary}){
```

- [ ] **Adım 2: fundCache useEffect'in hemen altına kırmızı sayım useEffect ekle**

`src/components/AnalysisTab.js`'de `fundCache` state tanımından (satır ~303) sonra gelen `useEffect`'lerin bir sonrasına — `healthEligible` ve `healthFiltered` değişkenlerinin tanımlandığı satırların (satır ~398) hemen **altına** ekle:

```js
  // Kırmızı metrik toplam → App.js nudge için callback
  // healthFiltered render'da hesaplanan derived değer olduğundan dep'e almak sonsuz döngü yapar;
  // bunun yerine fundCache ve pos'u dep al, eligible hesaplamasını inline yap.
  useEffect(()=>{
    if(!onHealthSummary)return;
    let redCount=0;
    const eligible=pos.filter(p=>p.type==="US_STOCK"||p.type==="BIST");
    eligible.forEach(p=>{
      const m=fundCache[p.ticker]?.metrics;
      if(!m)return;
      HEALTH_METRICS.forEach(([key])=>{
        if(fundScore(key,m[key])==='bad')redCount++;
      });
    });
    onHealthSummary(redCount);
  },[fundCache,pos]);

- [ ] **Adım 3: Portföy Sağlık kartına data-card ekle**

Satır 919'daki health kart `<div className="card" ...>` açılış tag'ini güncelle:

```js
// ÖNCE:
        <div className="card" style={{marginBottom:16,padding:"14px 16px"}}>

// SONRA:
        <div className="card" data-card="health" style={{marginBottom:16,padding:"14px 16px"}}>
```

- [ ] **Adım 4: Babel syntax kontrolü**

```bash
cd /Users/canmerter/Documents/Claude/Investment-Ledger && npm run check:babel
```

Beklenen: tüm dosyalar ✓.

- [ ] **Adım 5: Commit**

```bash
git add src/components/AnalysisTab.js
git commit -m "feat: add onHealthSummary callback and data-card scroll target to AnalysisTab"
```

---

## Task 4: Manuel Test

**Önkoşul:** `npx serve .` çalışıyor, http://localhost:3000 açık.

- [ ] **Test A — Sağlık nudge'ı (healthRedCount >= 3)**

  1. AnalysisTab → "Portföy Sağlık" kısmında `fundCache` doluysa 🔴 sayısı görünür.
  2. Dashboard'a dön. 🔴 >= 3 ise "X metrikte zayıf sağlık göstergesi var" nudge'ı + "Analiz'e Git →" butonu çıkmalı.
  3. "Analiz'e Git →" tıkla → AnalysisTab açılır ve Portföy Sağlık kartına scroll yapılır.
  4. Nudge dismiss edilirse 7 gün gösterilmez.

- [ ] **Test B — XIRR nudge'ı**

  - `displayCur=TRY` ve XIRR < %40 → "Portföy getirisi enflasyonun altında..." nudge'ı görünür, "Analiz'e Git →" butonu **yok** (actionCard tanımlı değil).
  - `displayCur=USD` ve XIRR >= %5 → nudge çıkmaz.

- [ ] **Test C — Null safety**

  - AnalysisTab hiç açılmadan Dashboard'a bak → sağlık nudge'ı çıkmaz (healthRedCount=null).
  - XIRR kısa periyotta "—" gösterilirken Dashboard'da xirr nudge'ı çıkmaz.

- [ ] **Test D — Mevcut kurallar bozulmadı**

  Konsantrasyon, inaktivite, çeşitlendirme nudge'larının davranışı değişmedi.

- [ ] **Final commit (gerekirse fix sonrası)**

```bash
git add -p
git commit -m "fix: nudge (c) manual test fixes"
```

---

## Definition of Done

- [ ] `npm run check:babel` hata vermiyor
- [ ] 5 nudge kuralının tamamı `computeNudges`'da mevcut
- [ ] Sağlık nudge "Analiz'e Git →" tıklanınca AnalysisTab + scroll çalışıyor
- [ ] null safety: healthRedCount=null veya annualRate=null → ilgili nudge çıkmıyor
- [ ] `ui-builder` agent scroll UX'ini onaylıyor (scroll hedef görünür mü, renk/boyut uygun mu)
