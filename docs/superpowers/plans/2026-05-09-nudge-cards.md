# Akıllı Nudge Kartları Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard'da KPI kartlarının üstünde proaktif portföy sinyalleri gösteren nudge kartları: konsantrasyon, inaktivite, çeşitlendirme uyarıları; 7 günlük kapatma mekanizması.

**Architecture:** `computeNudges()` pure function `src/utils.js`'e eklenir; Dashboard render bloğu `src/components/App.js`'te `nudgeDismissed` state ile kapatma mekanizmasını yönetir. Fiyat verisi yoksa (`Object.keys(prc).length===0`) tüm nudge'lar susturulur.

**Tech Stack:** React 18 UMD + Babel Standalone (browser JSX), localStorage via `LS` helper, `src/utils.js` + `src/components/App.js`

---

## File Structure

| Dosya | Değişiklik |
|-------|-----------|
| `src/utils.js` | `computeNudges(positions, transactions, annualRate)` eklenir — line 352'den sonra (rebuildPositions'dan önce) |
| `src/components/App.js` | `nudgeDismissed` state (line ~59) + Dashboard nudge render bloğu (line ~581) |

---

### Task 1: `computeNudges()` pure function

**Files:**
- Modify: `src/utils.js` (line 352'den sonra, Icons bölümünden önce)

- [ ] **Step 1: Fonksiyonu ekle**

`src/utils.js`'te `// Icons` satırından (line ~353) hemen önce şu bloğu ekle:

```javascript
// ── Akıllı Nudge kuralları ────────────────────────────────────────
// positions: allDisp dizisi — {ticker, name, type, mv, cost, ...}
// transactions: raw txs dizisi — {way, date, ...}
// annualRate: xirr sonucu (şimdilik rezerv, gelecek kurallar için)
// Returns: [{id, priority, message, actionTab}] sorted by priority asc
const computeNudges = (positions, transactions, annualRate) => {
  if (!positions || positions.length === 0) return [];
  const nudges = [];

  // P0: Konsantrasyon — tek pozisyon >%35
  // hasMV: tüm pozisyonlarda fiyat verisi mevcut olduğunda çalış
  const hasMV = positions.every(p => p.mv != null);
  const totalMV = positions.reduce((a, p) => a + (p.mv ?? p.cost ?? 0), 0);
  if (hasMV && totalMV > 0) {
    for (const p of positions) {
      const mv = p.mv ?? p.cost ?? 0;
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
  const buys = transactions.filter(t => t.way === 'BUY');
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
    const TYPE_LABELS = {
      US_STOCK: 'ABD hisselerinden',
      BIST: 'BIST hisselerinden',
      CRYPTO: 'kripto varlıklardan',
      GOLD: 'altından',
      FUND: 'fonlardan',
      FX: 'dövizden'
    };
    const label = TYPE_LABELS[types[0]] || types[0];
    nudges.push({
      id: 'diversification',
      priority: 1,
      message: `Portföyün tamamı ${label} oluşuyor`,
      actionTab: 'search'
    });
  }

  return nudges.sort((a, b) => a.priority - b.priority);
};
```

- [ ] **Step 2: Babel syntax kontrolü**

```bash
npm run check:babel
```

Beklenen çıktı: tüm dosyalar `OK` — hata yoksa devam et.

- [ ] **Step 3: Browser console'da manuel doğrulama**

`npx serve .` ile sunucu başlat (zaten çalışıyorsa atla). `http://localhost:3000` aç.
Browser console'da (F12):

```javascript
// Konsantrasyon testi — AAPL %40 ağırlık
computeNudges(
  [{ticker:'AAPL',type:'US_STOCK',mv:400,cost:300},{ticker:'MSFT',type:'US_STOCK',mv:600,cost:500}],
  [{way:'BUY',date:'2026-04-01'}],
  0.15
)
// Beklenen: [] — AAPL %40 ama totalMV=1000, AAPL/1000=40% > 35% → [{id:'concentration_AAPL',...}]
// DÜZELTME: AAPL 400/1000=40% → nudge olmalı ✓

// İnaktivite testi — 95 gün önce alım
computeNudges(
  [{ticker:'AAPL',type:'US_STOCK',mv:1000,cost:900}],
  [{way:'BUY',date:new Date(Date.now()-95*86400000).toISOString().split('T')[0]}],
  null
)
// Beklenen: [{id:'inactivity',priority:1,message:'95 gündür yeni işlem yok',...}]

// Çeşitlendirme testi — tek tip
computeNudges(
  [{ticker:'AAPL',type:'US_STOCK',mv:500,cost:400},{ticker:'MSFT',type:'US_STOCK',mv:500,cost:450}],
  [{way:'BUY',date:'2026-05-01'}],
  null
)
// Beklenen: [{id:'diversification',priority:1,message:'Portföyün tamamı ABD hisselerinden oluşuyor',...}]

// Boş portföy — []
computeNudges([], [], null)
// Beklenen: []
```

- [ ] **Step 4: Commit**

```bash
git add src/utils.js
git commit -m "feat: add computeNudges pure function (concentration/inactivity/diversification rules)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: `nudgeDismissed` state — App.js

**Files:**
- Modify: `src/components/App.js` (line ~59, `statusOpen` state'inden sonra)

- [ ] **Step 1: State ekle**

`src/components/App.js`'te şu satırı bul:

```javascript
  const [statusOpen,setStatusOpen]=useState(false);
```

Hemen altına ekle:

```javascript
  const [nudgeDismissed,setNudgeDismissed]=useState(()=>LS.get('il_nudge_dismissed',{}));
```

- [ ] **Step 2: Babel syntax kontrolü**

```bash
npm run check:babel
```

Beklenen çıktı: tüm dosyalar `OK`.

---

### Task 3: Dashboard nudge render bloğu

**Files:**
- Modify: `src/components/App.js` (Dashboard return bloğu içinde, FX uyarısından sonra, KPI `.g3` kartlarından önce)

- [ ] **Step 1: Render bloğunu ekle**

`src/components/App.js`'te Dashboard return bloğunda şu satırı bul (line ~580):

```javascript
            {!fxOk && (try_.length>0||eur.length>0) && (
              <div className="warn-card">
```

Bu FX warn-card bloğunun kapanışından (`)}`) sonra, `{/* Summary cards...` yorumundan önce şu bloğu ekle:

```jsx
            {/* Nudge kartları — KPI üstünde, max 2; fiyat yoksa gösterme */}
            {Object.keys(prc).length>0&&(()=>{
              const now=Date.now();
              const dismiss=(id)=>{
                const next={...nudgeDismissed,[id]:now+7*24*60*60*1000};
                setNudgeDismissed(next);
                LS.set('il_nudge_dismissed',next);
              };
              const activeNudges=computeNudges(allDisp,txs,annualRate)
                .filter(n=>!nudgeDismissed[n.id]||nudgeDismissed[n.id]<now)
                .slice(0,2);
              if(!activeNudges.length)return null;
              return activeNudges.map(n=>(
                <div key={n.id} className="warn-card" style={{alignItems:'center'}}>
                  <div className="wc-sub" style={{flex:1}}>{n.message}</div>
                  <button
                    style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:20,lineHeight:1,padding:'0 0 0 12px',flexShrink:0}}
                    onClick={()=>dismiss(n.id)}
                    aria-label="Kapat"
                  >×</button>
                </div>
              ));
            })()}
```

- [ ] **Step 2: Babel syntax kontrolü**

```bash
npm run check:babel
```

Beklenen çıktı: tüm dosyalar `OK`.

- [ ] **Step 3: ui-builder agent ile görsel onay**

`ui-builder` agentını çağır — yeni Dashboard bileşeni için onay zorunlu (CLAUDE.md gereksinimi). Agent'a şunu ilet:
> "Dashboard'da KPI kartlarının üstüne `.warn-card` stili nudge kartları eklendi. Her kart: flex row, sol taraf `.wc-sub` mesaj, sağ taraf × kapat butonu. `src/components/App.js`'teki değişikliği incele ve onay ver."

- [ ] **Step 4: Browser'da manuel E2E testi**

`npx serve .` → `http://localhost:3000` aç. Aşağıdaki senaryoları test et:

**Senaryo A — Nudge görünür:**
- Tek pozisyonlu portföy (ya da %40+ ağırlıklı pozisyon) varsa Dashboard'da warn-card çıkmalı
- Kart üzerinde `×` butonuna bas → kart kaybolmalı
- Sayfayı yenile → kart tekrar çıkmamalı (7 gün dismiss)

**Senaryo B — Fiyat verisi yok:**
- `prc = {}` iken Dashboard açıkken nudge kartı görünmemeli
- "Fiyatlar çekilmedi" warn-card zaten gösteriyor

**Senaryo C — Dismiss TTL:**
Browser console'da: `localStorage.removeItem('il_nudge_dismissed')` → sayfayı yenile → nudge tekrar görünmeli

- [ ] **Step 5: Commit**

```bash
git add src/components/App.js
git commit -m "feat: add nudge cards to Dashboard (concentration/inactivity/diversification)

- nudgeDismissed state with 7-day LS TTL
- max 2 nudges above KPI cards, warn-card style
- guarded by prc data presence

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

### Spec Coverage (sprint-11.md 4a + 4b)

| Gereksinim | Plan Görevi |
|-----------|------------|
| `computeNudges(positions, transactions, xirr)` pure fn | Task 1 |
| P0-Nudge: konsantrasyon >%35 | Task 1 Step 1 |
| P1-Nudge: son BUY >90 gün | Task 1 Step 1 |
| P1-Nudge: yalnızca 1 asset_type | Task 1 Step 1 |
| Return `[{id, priority, message, actionTab}]` | Task 1 Step 1 |
| Boş portföy → `[]` | Task 1 Step 3 (doğrulama) |
| `nudgeDismissed` state | Task 2 |
| Dashboard KPI üstünde render | Task 3 |
| max 2 nudge (öncelik sırasına göre) | Task 3 Step 1 |
| `.warn-card` stili + × butonu | Task 3 Step 1 |
| `il_nudge_dismissed` LS key, 7 günlük TTL | Task 3 Step 1 |
| Fiyat verisi yoksa sustur | Task 3 Step 1 (`Object.keys(prc).length>0` guard) |
| ui-builder agent onayı | Task 3 Step 3 |

### Placeholder Scan ✓
Tüm adımlarda gerçek kod mevcut. "TBD" veya "TODO" yok.

### Type Consistency ✓
- `computeNudges` Task 1'de tanımlandı; Task 3'te `computeNudges(allDisp,txs,annualRate)` olarak çağrılıyor — `allDisp` `{ticker,type,mv,cost,...}` nesneleri içeriyor, `txs` `{way,date,...}` içeriyor, `annualRate` App.js line 319'da hesaplanan `xirr(...)` sonucu. ✓
- `nudgeDismissed` Task 2'de `useState` ile tanımlandı; Task 3'te `.filter` ve `setNudgeDismissed` ile kullanılıyor. ✓
