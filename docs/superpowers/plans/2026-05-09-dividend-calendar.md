# Temettü Takvimi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Held US_STOCK pozisyonlar için FMP'den temettü ex-date/amount çekip TickerDetailTab'da "Sonraki Temettü" satırı ve HistoryTab'da "Yaklaşan Temettüler" collapsible bölümü göstermek.

**Architecture:** `fetch-fundamentals` edge function'a `mode:"dividend-calendar"` dalı eklenir; FMP `/stable/stock/dividends` endpoint'i tickers array için paralel fetch yapar. Frontend LS cache (24h TTL, `il_divcal_${ticker}`) kullanarak edge fn'ı seyrek çağırır. TickerDetailTab tek ticker için useEffect ile fetch yapar; HistoryTab tüm held US_STOCK tickerlar için bulk fetch yapar.

**Tech Stack:** Deno edge function (TypeScript), React 18 UMD + Babel Standalone, localStorage via `LS` helper, FMP API (`FMP_KEY` secret)

---

## File Structure

| Dosya | Değişiklik |
|-------|-----------|
| `supabase/functions/fetch-fundamentals/index.ts` | `dividend-calendar` mode dalı eklenir (line ~663'ten önce, `const { ticker, asset_type } = body;` öncesi) |
| `fetch-fundamentals-edge-function.js` (root) | index.ts ile identik → aynı değişiklik uygulanır |
| `src/components/TickerDetailTab.js` | divCal state + LS cache + useEffect fetch + Şirket Bilgisi card'a "Sonraki Temettü" satırı |
| `src/components/HistoryTab.js` | pos/displayCur/fxRates props + divCalMap state + "Yaklaşan Temettüler" collapsible section |
| `src/components/App.js` | HistoryTab'a `pos`, `displayCur`, `fxRates` prop'ları geçilir |

---

### Task 1: Edge Function — dividend-calendar mode

**Files:**
- Modify: `supabase/functions/fetch-fundamentals/index.ts` (line ~663, `sync-ticker-db` bloğunun kapanışından `const { ticker, asset_type } = body;` satırına kadar olan boşluğa ekle)
- Modify: `fetch-fundamentals-edge-function.js` (aynı değişiklik — her zaman identik tutulur)

- [ ] **Step 1: index.ts'e dividend-calendar mode ekle**

`supabase/functions/fetch-fundamentals/index.ts` dosyasında şu satırı bul:

```typescript
    const { ticker, asset_type } = body;
    if (!ticker) return json({ error: "ticker required" }, 400);
```

Hemen **önüne** şu bloğu ekle:

```typescript
    // Mode: dividend-calendar — held ticker'lar için FMP'den sonraki temettü verisi.
    // Body: { mode: "dividend-calendar", tickers: ["AAPL", "MSFT"] }
    if (body.mode === "dividend-calendar") {
      const tickers: string[] = Array.isArray(body.tickers) ? body.tickers.slice(0, 20) : [];
      if (tickers.length === 0) return json({ error: "tickers array required" }, 400);
      const fmpKey = Deno.env.get("FMP_KEY");
      if (!fmpKey) return json({ error: "FMP_KEY secret eksik" }, 500);
      const today = new Date().toISOString().split("T")[0];
      const results: Record<string, Array<{ex_date: string; pay_date: string|null; amount: number|null; currency: string}>> = {};
      await Promise.all(tickers.map(async (tk: string) => {
        try {
          const url = `https://financialmodelingprep.com/stable/stock/dividends?symbol=${encodeURIComponent(tk)}&limit=5&apikey=${fmpKey}`;
          const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (!r.ok) { results[tk] = []; return; }
          const raw = await r.json();
          // FMP stable/stock/dividends: düz array veya {historical:[...]} wrapper
          const arr: any[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.historical) ? raw.historical : []);
          const future = arr.filter((d: any) => d.date >= today);
          const past   = arr.filter((d: any) => d.date <  today).slice(0, 1);
          results[tk] = [...future, ...past].map((d: any) => ({
            ex_date:  d.date,
            pay_date: d.paymentDate || null,
            amount:   d.dividend ?? d.adjDividend ?? null,
            currency: "USD",
          }));
        } catch { results[tk] = []; }
      }));
      return json({ dividends: results });
    }

```

- [ ] **Step 2: Root JS'e aynı değişikliği uygula**

`fetch-fundamentals-edge-function.js` (root'taki) identik dosyaya aynı bloğu ekle — aynı konum, aynı kod.

- [ ] **Step 3: Söz dizimi ve drift kontrolü**

```bash
npm run check:edge && npm run check:edge-drift
```

Beklenen çıktı: her iki komut da hata vermeden geçer. `check:edge-drift` "OK" der (index.ts == root JS).

- [ ] **Step 4: edge-reviewer agent ile güvenlik incelemesi**

`edge-reviewer` agentını çalıştır (CLAUDE.md gereksinimi — deploy öncesi zorunlu):
> "fetch-fundamentals edge function'a dividend-calendar mode eklendi. supabase/functions/fetch-fundamentals/index.ts dosyasını incele — rate limit, input validation (slice(0,20)), AbortSignal timeout, CORS header kullanımı ve Deno güvenlik açıkları açısından değerlendir."

Bulgu varsa düzelt ve Step 3'ü tekrar çalıştır.

- [ ] **Step 5: Edge function'ı deploy et**

```bash
npx supabase functions deploy fetch-fundamentals --no-verify-jwt
```

- [ ] **Step 6: Smoke test — curl ile endpoint doğrula**

```bash
# SUPA_URL ve ANON_KEY'i .env veya ortam değişkenlerinden al
curl -s -X POST "$SUPA_URL/functions/v1/fetch-fundamentals" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -d '{"mode":"dividend-calendar","tickers":["AAPL"]}' | jq '.dividends.AAPL | length'
```

Beklenen: 0 veya pozitif integer (AAPL büyük ihtimalle temettü verisi döner). `null` veya HTTP hata → debug et.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/fetch-fundamentals/index.ts fetch-fundamentals-edge-function.js
git commit -m "feat: add dividend-calendar mode to fetch-fundamentals edge function

- FMP /stable/stock/dividends per ticker, parallel fetch
- Future ex-dates prioritized + 1 past for TTM yield
- tickers slice(0,20) guard, AbortSignal.timeout(8000) per fetch

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: TickerDetailTab — "Sonraki Temettü" satırı

**Files:**
- Modify: `src/components/TickerDetailTab.js`

**Bağlam:** `TickerDetailTab.js`'te line ~142'de meta cache helper'ları var (`META_TTL_MS`, `metaCacheGet`, `metaCacheSet`). Line ~333'te `fund` state başlar. Line ~597'de "Şirket Bilgisi" card render bloğu var; içinde `rows` array'i var (line ~612). Şu anda `["Temettü Verimi", ...]` satırı rows'da var (line ~620).

- [ ] **Step 1: divCal cache helper'larını ekle**

`TickerDetailTab.js`'te şu satırı bul:

```javascript
// Fundamental cache (FMP TTM + 5Y) — 7 gün TTL
const FUND_TTL_MS = 7 * 86400000;
```

Hemen **önüne** ekle:

```javascript
// Dividend calendar cache — 24 saat TTL
const DIVCAL_TTL_MS = 24 * 3600000;
const divCalCacheGet = (ticker) => {
  const c = LS.get(`il_divcal_${ticker}`, null);
  if (!c || !c.t) return null;
  if (Date.now() - c.t > DIVCAL_TTL_MS) return null;
  return c.d;
};
const divCalCacheSet = (ticker, data) => LS.set(`il_divcal_${ticker}`, { d: data, t: Date.now() });

```

- [ ] **Step 2: divCal state ve useEffect ekle**

`TickerDetailTab.js`'te şu satırı bul (line ~336):

```javascript
  const [fundErr,setFundErr]=useState("");
  const [fundErrCode,setFundErrCode]=useState("");  // edge function code, ör. "OUT_OF_PLAN"
```

Hemen **altına** ekle:

```javascript
  const [divCal,setDivCal]=useState(()=>divCalCacheGet(ticker));
```

Sonra şu satırı bul (line ~441):

```javascript
  useEffect(()=>{if(!meta)fetchMeta(false);},[ticker,effectiveType]);
```

Hemen **altına** ekle:

```javascript
  // Dividend calendar — yalnızca held US_STOCK için; BIST'te FMP temettü güvenilir değil
  useEffect(()=>{
    if(isBist||!p||divCal!==null)return;
    edgeCall("fetch-fundamentals",{mode:"dividend-calendar",tickers:[ticker]})
      .then(r=>r.json())
      .then(data=>{
        const items=data?.dividends?.[ticker]||[];
        setDivCal(items);
        divCalCacheSet(ticker,items);
      })
      .catch(()=>setDivCal([]));
  },[ticker]);
```

- [ ] **Step 3: Şirket Bilgisi card'a "Sonraki Temettü" satırı ekle**

`TickerDetailTab.js`'te Şirket Bilgisi card bloğunu bul (line ~610). `rows` array'ini bul. Şu satırı bul:

```javascript
              ["Temettü Verimi",meta.dividend_yield!=null?meta.dividend_yield.toFixed(2)+"%":null],
```

Hemen **altına** ekle (rows array içinde):

```javascript
              (()=>{
                if(isBist||!p||!divCal)return null;
                const todayStr=new Date().toISOString().split("T")[0];
                const next=divCal.find(d=>d.ex_date>=todayStr);
                if(!next||next.amount==null)return null;
                const est=next.amount*(+p.shares);
                return["Sonraki Temettü",`${fmtDateTR(next.ex_date)} · $${fmt(next.amount,4)}/hisse · Tahmini ${mask("$"+fmt(est,2))}`];
              })(),
```

**Not:** `rows.filter(([,v])=>v)` satırı null değerleri zaten filtreler — IIFE `null` döndüğünde row'a eklenmez.

- [ ] **Step 4: Babel syntax kontrolü**

```bash
npm run check:babel
```

Beklenen: 13 OK, 0 hata.

- [ ] **Step 5: Browser'da manuel test**

`npx serve .` → `http://localhost:3000`. Held US_STOCK pozisyonu olan ticker'ı aç (ör. AAPL). "Şirket Bilgisi" bölümünde "Sonraki Temettü" satırı görünmeli. THYAO.IS için görünmemeli.

- [ ] **Step 6: Commit**

```bash
git add src/components/TickerDetailTab.js
git commit -m "feat: add next dividend row to TickerDetailTab for held US_STOCK

- 24h LS cache per ticker (il_divcal_${ticker})
- Only for held US_STOCK, hidden for BIST
- Shows ex-date, amount/share, estimated total (mask-aware)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: HistoryTab — "Yaklaşan Temettüler" bölümü + App.js prop geçişi

**Files:**
- Modify: `src/components/App.js` (line ~854, HistoryTab render)
- Modify: `src/components/HistoryTab.js` (props + divCalMap state + section render)

**Bağlam:**
- `App.js` line ~854: `<HistoryTab txs={txs} user={user} ... />` — `pos`, `displayCur`, `fxRates` prop'ları şu an yok, eklenmesi gerekiyor.
- `HistoryTab.js` line ~2: function signature — `{txs,user,loadData,flash_,confirm_,mask,hideAmts,setTab,openDetail,initialSearch,onConsume,splits,portfolioId}` — 3 yeni prop eklenecek.
- `convert(amount, from, to, fxRates)` global helper (src/utils.js) — para birimi dönüşümü için.
- `displaySym(cur)` global helper — `"USD"→"$"`, `"TRY"→"₺"`.
- `LS` helper — divCalCacheGet/Set HistoryTab'da inline kullanılır (module-level helper yok, TickerDetailTab'a özel).
- `DIVCAL_TTL_MS = 24 * 3600000` — TickerDetailTab'da tanımlandı; HistoryTab'da inline `24 * 3600000` kullan (iki farklı component).
- `edgeCall(fn, body)` global helper — fetch-fundamentals çağrısı için.

- [ ] **Step 1: App.js'te HistoryTab prop'larını güncelle**

`App.js`'te şu satırı bul:

```javascript
        <HistoryTab txs={txs} user={user} loadData={loadData} flash_={flash_} confirm_={confirm_} mask={mask} hideAmts={hide} setTab={setTab} openDetail={openDetail} initialSearch={navTicker} onConsume={()=>setNavTicker("")} splits={splits} portfolioId={activePortfolioId}/>
```

Şununla değiştir:

```javascript
        <HistoryTab txs={txs} user={user} loadData={loadData} flash_={flash_} confirm_={confirm_} mask={mask} hideAmts={hide} setTab={setTab} openDetail={openDetail} initialSearch={navTicker} onConsume={()=>setNavTicker("")} splits={splits} portfolioId={activePortfolioId} pos={pos} displayCur={displayCur} fxRates={fxRates}/>
```

- [ ] **Step 2: HistoryTab function signature'ı güncelle**

`HistoryTab.js`'te şu satırı bul:

```javascript
function HistoryTab({txs,user,loadData,flash_,confirm_,mask,hideAmts,setTab,openDetail,initialSearch,onConsume,splits,portfolioId}){
```

Şununla değiştir:

```javascript
function HistoryTab({txs,user,loadData,flash_,confirm_,mask,hideAmts,setTab,openDetail,initialSearch,onConsume,splits,portfolioId,pos,displayCur,fxRates}){
```

- [ ] **Step 3: divCalMap state ve fetch useEffect ekle**

`HistoryTab.js`'te `const [dateF,setDateF]=useState("all");` satırını bul. Hemen **altına** ekle:

```javascript
  const [divCalMap,setDivCalMap]=useState({});
  useEffect(()=>{
    if(!pos||!pos.length)return;
    const heldUS=pos.filter(p=>p.type==="US_STOCK"&&(+p.shares||0)>0).map(p=>p.ticker);
    if(!heldUS.length)return;
    // Cache'den oku; 24h TTL
    const now=Date.now();
    const cached={};
    const toFetch=[];
    heldUS.forEach(tk=>{
      const c=LS.get(`il_divcal_${tk}`,null);
      if(c&&c.t&&(now-c.t)<24*3600000){cached[tk]=c.d;}
      else toFetch.push(tk);
    });
    setDivCalMap(m=>({...m,...cached}));
    if(!toFetch.length)return;
    edgeCall("fetch-fundamentals",{mode:"dividend-calendar",tickers:toFetch})
      .then(r=>r.json())
      .then(data=>{
        if(!data?.dividends)return;
        const fresh={};
        toFetch.forEach(tk=>{
          const items=data.dividends[tk]||[];
          fresh[tk]=items;
          LS.set(`il_divcal_${tk}`,{d:items,t:Date.now()});
        });
        setDivCalMap(m=>({...m,...fresh}));
      })
      .catch(()=>{});
  },[]);
```

- [ ] **Step 4: "Yaklaşan Temettüler" collapsible section render**

`HistoryTab.js`'te `if(txs.length===0)return(...)` bloğu var (line ~54). Bu bloğun **altından** başlayan ana return'ü bul. İlk JSX render satırını bul (filtreleme satırları ve toolbar'dan önce), yani:

```javascript
  return(
    <div>
```

Bu `<div>`'in içinde, filtre toolbar'ından (`.fbar` div'inden) **önce** şu bloğu ekle:

```javascript
      {/* Yaklaşan Temettüler — önümüzdeki 30 gün içinde ex-date'i olan held US tickers */}
      {(()=>{
        if(!pos||!pos.length)return null;
        const today=new Date().toISOString().split("T")[0];
        const in30=new Date(Date.now()+30*86400000).toISOString().split("T")[0];
        const dSym=displaySym(displayCur||"USD");
        const rows=[];
        (pos||[]).filter(p=>p.type==="US_STOCK"&&(+p.shares||0)>0).forEach(p=>{
          const cal=divCalMap[p.ticker]||[];
          cal.filter(d=>d.ex_date>=today&&d.ex_date<=in30&&d.amount!=null).forEach(d=>{
            const rawEst=d.amount*(+p.shares);
            const est=convert(rawEst,"USD",displayCur||"USD",fxRates)??rawEst;
            rows.push({ticker:p.ticker,ex_date:d.ex_date,pay_date:d.pay_date,est,sym:dSym});
          });
        });
        if(!rows.length)return null;
        rows.sort((a,b)=>a.ex_date.localeCompare(b.ex_date));
        const total=rows.reduce((a,r)=>a+r.est,0);
        const [divOpen,setDivOpen]=useState(true);
        return(
          <div className="card" style={{marginBottom:14,padding:0,overflow:"hidden"}}>
            <div
              onClick={()=>setDivOpen(o=>!o)}
              style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",cursor:"pointer"}}
            >
              <div className="stitle" style={{marginBottom:0}}>Yaklaşan Temettüler</div>
              <span style={{fontSize:11,color:"var(--text3)"}}>{divOpen?"▲":"▼"}</span>
            </div>
            {divOpen&&(
              <div style={{padding:"0 14px 12px"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr style={{color:"var(--text3)"}}>
                      <th style={{textAlign:"left",paddingBottom:6,fontWeight:500}}>Ticker</th>
                      <th style={{textAlign:"left",paddingBottom:6,fontWeight:500}}>Ex-Date</th>
                      <th style={{textAlign:"left",paddingBottom:6,fontWeight:500}}>Ödeme</th>
                      <th style={{textAlign:"right",paddingBottom:6,fontWeight:500}}>Tahmini</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r,i)=>(
                      <tr key={i} style={{borderTop:"0.5px solid var(--border)"}}>
                        <td style={{padding:"5px 0",fontFamily:"var(--mono)",fontWeight:600,color:"var(--text)"}}>{r.ticker}</td>
                        <td style={{padding:"5px 0",color:"var(--text2)"}}>{fmtDateTR(r.ex_date)}</td>
                        <td style={{padding:"5px 0",color:"var(--text3)"}}>{r.pay_date?fmtDateTR(r.pay_date):"—"}</td>
                        <td style={{padding:"5px 0",textAlign:"right",color:"var(--ok)",fontFamily:"var(--mono)"}}>{mask(r.sym+fmt(r.est,2))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{marginTop:8,fontSize:11,color:"var(--text2)",textAlign:"right"}}>
                  Bu ay beklenen toplam: {mask(dSym+fmt(total,2))}
                </div>
              </div>
            )}
          </div>
        );
      })()}
```

**Not:** `useState` bir IIFE içinde kullanılamaz (React Hooks kuralı). Bu bloktaki `divOpen` state'i IIFE dışına taşınmalı. Step 3'teki `divCalMap` state'inin hemen altına ekle:

```javascript
  const [divSecOpen,setDivSecOpen]=useState(true);
```

Sonra IIFE içindeki `const [divOpen,setDivOpen]=useState(true);` satırını ve `setDivOpen` kullanımlarını şu şekilde değiştir:
- `const [divOpen,setDivOpen]=useState(true);` → sil (IIFE'den çıkar)
- `divOpen` → `divSecOpen`
- `setDivOpen(o=>!o)` → `setDivSecOpen(o=>!o)`

- [ ] **Step 5: Babel syntax kontrolü**

```bash
npm run check:babel
```

Beklenen: 13 OK, 0 hata.

- [ ] **Step 6: Browser'da manuel test**

`npx serve .` → `http://localhost:3000`. Settings → "İşlem Geçmişi" → "Tüm İşlemleri Gör →". HistoryTab açılır. Held US_STOCK ile temettü verisi varsa "Yaklaşan Temettüler" card'ı görünmeli. Olmayan portföy için section çıkmamalı.

- [ ] **Step 7: Commit**

```bash
git add src/components/App.js src/components/HistoryTab.js
git commit -m "feat: add Yaklaşan Temettüler section to HistoryTab

- collapsible card showing 30-day ex-date window for held US_STOCK
- 24h LS cache reused from TickerDetailTab (il_divcal_${ticker})
- sum total line, display currency conversion, mask-aware

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

### Spec Coverage (sprint-11.md 2a + 2b + 2c)

| Gereksinim | Plan Görevi |
|-----------|------------|
| `mode:"dividend-calendar"` → `tickers[]` array | Task 1 Step 1 |
| FMP `/stable/stock/dividends?symbol=X&limit=5` | Task 1 Step 1 |
| ex-date >= today öncelikli + geçmişten 1 kayıt | Task 1 Step 1 (future + past.slice(0,1)) |
| Response: `{dividends: {AAPL: [{ex_date, pay_date, amount, currency}]}}` | Task 1 Step 1 |
| AbortSignal.timeout(8000) | Task 1 Step 1 |
| CORS header korunur | Task 1 Step 1 (mevcut `json()` helper zaten corsHeaders ekliyor) |
| edge-reviewer sign-off | Task 1 Step 4 |
| Held US_STOCK için "Sonraki Temettü" satırı | Task 2 Step 3 |
| ex_date >= today ise göster | Task 2 Step 3 |
| Veri yoksa satır çıkmaz | Task 2 Step 3 (null filter) |
| Tahmini tutar: amount × shares, mask() uyumlu | Task 2 Step 3 |
| BIST için çıkmaz | Task 2 Step 2 (isBist guard) |
| LS cache 24h TTL: `il_divcal_${ticker}` | Task 2 Step 1+2, Task 3 Step 3 |
| HistoryTab collapsible "Yaklaşan Temettüler" | Task 3 Step 4 |
| Önümüzdeki 30 gün içinde ex-date'ler | Task 3 Step 4 |
| Ticker \| Ex-Date \| Pay-Date \| Tahmini tutar | Task 3 Step 4 (table columns) |
| Tutar toplamı satırı | Task 3 Step 4 ("Bu ay beklenen toplam") |
| Veri yoksa section çıkmaz | Task 3 Step 4 (`if(!rows.length)return null`) |

### Placeholder Scan ✓
Tüm adımlarda gerçek kod. "TBD" veya "TODO" yok.

### Type Consistency ✓
- `il_divcal_${ticker}` LS key: Task 1'de frontend'de kullanılmaz; Task 2'de `divCalCacheGet/Set` ile; Task 3'te `LS.get/set` inline ile — aynı key. ✓
- `divCalMap[p.ticker]` array'i: Task 3 Step 3'te `[]` fallback ile güvenli. ✓
- `divSecOpen` state: Task 3 Step 3'te tanımlanır, Step 4'te IIFE içinde kullanılır. ✓
- `convert(rawEst,"USD",displayCur||"USD",fxRates)`: `convert` fonksiyonu `src/utils.js`'te global; `displayCur` ve `fxRates` App.js'ten prop olarak geçilir (Step 1). ✓
- edge fn response `data?.dividends?.[ticker]`: Task 1'deki `return json({ dividends: results })` ile uyumlu. ✓
