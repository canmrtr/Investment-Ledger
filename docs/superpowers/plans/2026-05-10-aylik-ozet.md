# Aylık Özet Kopyala/Paylaş Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AnalysisTab'a takvim ayı bazlı portföy özeti kartı ekle; kullanıcı ay seçince 8 metrik hesaplanır, metin panoya kopyalanır veya PNG kart indirilir.

**Architecture:** Hibrit veri: transaction tabanlı metrikler (temettü, net yatırım) her zaman anında hesaplanır; fiyat bazlı metrikler (aylık %, benchmark, best/worst) yeni `price_snapshots` tablosundan gelir, tablo boşsa `price_cache.p_m1` fallback. Tüm hesaplama frontend'de; yeni edge function yok. pg_cron her ayın 1'inde snapshot alır.

**Tech Stack:** React 18 UMD + Babel Standalone (JSX, no build), Supabase JS v2, html2canvas CDN, Web Share API (mobile)

---

## Dosya Haritası

| Dosya | Değişiklik |
|-------|-----------|
| `supabase/migrations/013_price_snapshots.sql` | Yeni tablo + RLS + pg_cron job |
| `index.html` | html2canvas CDN `<script>` ekle |
| `src/components/AnalysisTab.js` | Helper fonksiyonlar + state/useEffect + kart IIFE |

---

## Task 1: Migration — price_snapshots tablosu

**Files:**
- Create: `supabase/migrations/013_price_snapshots.sql`

- [ ] **Adım 1: Dosyayı oluştur**

```sql
-- Migration 013: price_snapshots — aylık fiyat snapshot'ları.
-- Her ayın 1'inde pg_cron tarafından price_cache'den otomatik doldurulur.
-- Frontend read-only (anon + authenticated). Service_role / pg_cron write.

CREATE TABLE IF NOT EXISTS price_snapshots (
  ticker        text    NOT NULL,
  snapshot_date date    NOT NULL,
  price         numeric NOT NULL,
  PRIMARY KEY (ticker, snapshot_date)
);

ALTER TABLE price_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read price_snapshots"
  ON price_snapshots FOR SELECT USING (true);

-- pg_cron: her ayın 1'i saat 00:05 UTC — price_cache'deki tüm kayıtları snapshot al.
-- Çalıştığında MEVCUT AY'ın 1. günü tarihi yazılır (date_trunc('month', now())).
SELECT cron.schedule(
  'monthly-price-snapshot',
  '5 0 1 * *',
  $$
    INSERT INTO price_snapshots (ticker, snapshot_date, price)
    SELECT ticker, date_trunc('month', now())::date, price
    FROM price_cache
    WHERE price IS NOT NULL
    ON CONFLICT (ticker, snapshot_date) DO NOTHING;
  $$
);
```

- [ ] **Adım 2: Supabase MCP ile deploy et**

```
mcp__supabase__apply_migration ile 013_price_snapshots.sql içeriğini uygula.
```

Beklenen: tablo oluştu, RLS aktif, cron job `cron.job` tablosunda görünür.

- [ ] **Adım 3: Tabloyu doğrula**

```sql
-- Supabase MCP execute_sql ile:
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'price_snapshots';
SELECT jobname, schedule FROM cron.job WHERE jobname = 'monthly-price-snapshot';
```

Beklenen: `rowsecurity = true`, `schedule = '5 0 1 * *'`.

- [ ] **Adım 4: Commit**

```bash
git add supabase/migrations/013_price_snapshots.sql
git commit -m "feat: add price_snapshots table + monthly pg_cron snapshot job"
```

---

## Task 2: html2canvas CDN

**Files:**
- Modify: `index.html`

- [ ] **Adım 1: index.html'de mevcut CDN bloğunu bul**

`index.html`'de şu satırı bul (babel script):
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js"
```

- [ ] **Adım 2: html2canvas'ı babel satırının hemen altına ekle**

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"
        defer crossorigin="anonymous"></script>
```

- [ ] **Adım 3: babel-checker çalıştır**

```bash
npm run check:babel
```

Beklenen: tüm dosyalar parse OK (index.html Babel inline içermiyor; sadece src/*.js kontrol edilir).

- [ ] **Adım 4: Commit**

```bash
git add index.html
git commit -m "feat: add html2canvas CDN for monthly summary PNG export"
```

---

## Task 3: AnalysisTab — Helper fonksiyonlar

**Files:**
- Modify: `src/components/AnalysisTab.js` (dosyanın en üstüne, `SECTOR_COLORS` sabitinin hemen öncesine)

Bu task'ta bileşen dışı yardımcı fonksiyonlar eklenir — state veya props gerektirmez.

- [ ] **Adım 1: `src/components/AnalysisTab.js` dosyasını oku, ilk satırları bul**

Dosyanın 1. satırı:
```
// ── AnalysisTab — Portföy analiz sekmesi (Sprint 1) ────────────
```

- [ ] **Adım 2: Bu yorum satırının hemen öncesine helper fonksiyonları ekle**

```js
// ── Aylık Özet helper fonksiyonları ─────────────────────────────

const TR_MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
                   'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function monthLabel(ym) { // "2026-04" → "Nisan 2026"
  const [y, m] = ym.split('-');
  return `${TR_MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

function prevMonths(n) { // Son n tamamlanmış ay listesi (en yeni önce)
  const months = [];
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1); // Bir önceki ay
  for (let i = 0; i < n; i++) {
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ value: ym, label: monthLabel(ym) });
    d.setMonth(d.getMonth() - 1);
  }
  return months;
}

function calcMonthlyMetrics({ ym, pos, txs, prc, hist, snapshots, cnv }) {
  const [y, m] = ym.split('-').map(Number);
  const monthStart  = `${ym}-01`;
  const nextStart   = m === 12
    ? `${y + 1}-01-01`
    : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  const priceCurOf = p => p.type === 'BIST' ? 'TRY' : (p.currency === 'EUR' ? 'EUR' : 'USD');
  const snapKey    = (ticker, date) => `${ticker}_${date}`;
  const snapPrice  = (ticker, date) => snapshots[snapKey(ticker, date)];

  // Fiyat deltası: snapshot varsa gerçek, yoksa p_m1 fallback
  const tickerDelta = ticker => {
    const start = snapPrice(ticker, monthStart);
    const end   = prc[ticker];
    if (start != null && end != null) return { ret: (end - start) / start * 100, approx: false };
    const h = hist[ticker];
    if (h?.p_m1 != null && end != null) return { ret: (end - h.p_m1) / h.p_m1 * 100, approx: true };
    return null;
  };

  const hasSnapshots = pos.some(p => snapPrice(p.ticker, monthStart) != null);

  // Transactions for month
  const monthTxs = txs.filter(t => t.date >= monthStart && t.date < nextStart);

  // Temettü
  const dividends = monthTxs
    .filter(t => t.way === 'DIV')
    .reduce((s, t) => s + (cnv(+t.total || (+t.price * +t.shares), t.currency || 'USD') || 0), 0);

  // Net yatırım (pozitif = sermaye girişi)
  const netInvested = monthTxs
    .filter(t => t.way !== 'DIV')
    .reduce((s, t) => {
      const amt = cnv(+t.total || (+t.price * +t.shares), t.currency || 'USD') || 0;
      return s + (t.way === 'BUY' ? amt : -amt);
    }, 0);

  // Ağırlıklı portföy aylık getirisi
  const eligible = pos.map(p => {
    const delta = tickerDelta(p.ticker);
    const pr    = prc[p.ticker];
    if (!delta || !pr) return null;
    const mv = cnv(p.shares * pr, priceCurOf(p)) || 0;
    return { ticker: p.ticker, delta, mv };
  }).filter(Boolean);

  const eligibleMV  = eligible.reduce((s, p) => s + p.mv, 0);
  const monthReturn = eligibleMV > 0
    ? eligible.reduce((s, p) => s + (p.delta.ret / 100) * (p.mv / eligibleMV), 0) * 100
    : null;
  const isApprox = !hasSnapshots;

  // Toplam portföy değeri (current price × shares)
  const totalMV = pos.reduce((s, p) => {
    const pr = prc[p.ticker];
    return pr ? s + (cnv(p.shares * pr, priceCurOf(p)) || 0) : s;
  }, 0);

  // Best / worst pozisyon
  const posDeltas = pos
    .map(p => { const d = tickerDelta(p.ticker); return d ? { ticker: p.ticker, ret: d.ret } : null; })
    .filter(Boolean)
    .sort((a, b) => b.ret - a.ret);
  const bestPos  = posDeltas[0]  || null;
  const worstPos = posDeltas[posDeltas.length - 1] || null;

  // YTD — Ocak 1 snapshot gerekli
  const janStart   = `${y}-01-01`;
  const ytdEligible = pos.map(p => {
    const start = snapPrice(p.ticker, janStart);
    const end   = prc[p.ticker];
    if (!start || !end) return null;
    const mv = cnv(p.shares * end, priceCurOf(p)) || 0;
    return { ret: (end - start) / start * 100, mv };
  }).filter(Boolean);
  const ytdMV = ytdEligible.reduce((s, p) => s + p.mv, 0);
  const ytd   = ytdMV > 0
    ? ytdEligible.reduce((s, p) => s + (p.ret / 100) * (p.mv / ytdMV), 0) * 100
    : null;

  // Benchmark (SPY + XU100)
  const benchDelta = ticker => {
    const start = snapPrice(ticker, monthStart);
    const end   = prc[ticker];
    if (start != null && end != null) return (end - start) / start * 100;
    const h = hist[ticker];
    return (h?.p_m1 != null && end != null) ? (end - h.p_m1) / h.p_m1 * 100 : null;
  };
  const benchmarks = { spy: benchDelta('SPY'), xu100: benchDelta('XU100') };

  // Dağılım (anlık, snapshot gerektirmez)
  const TYPE_LBL = { US_STOCK:'ABD', BIST:'BIST', FUND:'ETF', CRYPTO:'Kripto', GOLD:'Altın', FX:'Döviz' };
  const allocMap = {};
  pos.forEach(p => {
    const pr = prc[p.ticker];
    if (!pr) return;
    const mv  = cnv(p.shares * pr, priceCurOf(p)) || 0;
    const lbl = TYPE_LBL[p.type] || p.type;
    allocMap[lbl] = (allocMap[lbl] || 0) + mv;
  });
  const allocTotal = Object.values(allocMap).reduce((s, v) => s + v, 0);
  const allocation = Object.fromEntries(
    Object.entries(allocMap).map(([k, v]) => [k, allocTotal > 0 ? v / allocTotal * 100 : 0])
  );

  return { monthReturn, isApprox, totalMV, dividends, netInvested, bestPos, worstPos, ytd, benchmarks, allocation, monthTxsCount: monthTxs.length };
}

function buildSummaryText({ metrics, monthLbl, dSym, fxRates, displayCur }) {
  const { monthReturn, isApprox, totalMV, dividends, netInvested, bestPos, worstPos, ytd, benchmarks, allocation } = metrics;
  const approx = isApprox ? '~' : '';
  const fmtPct  = r => r != null ? `${r >= 0 ? '+' : ''}${r.toFixed(1)}%` : '—';
  const fmtAmt  = v => `${dSym}${Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`;

  const spyR   = benchmarks.spy;
  const xu100R = benchmarks.xu100;
  const portR  = monthReturn;

  const spyLine   = `  SPY      ${fmtPct(spyR)}${spyR != null && portR != null ? (portR >= spyR ? '  ✓ yendim' : '  ✗ geride') : ''}`;
  const xu100Line = `  XU100    ${fmtPct(xu100R)}${xu100R != null && portR != null ? (portR >= xu100R ? '  ✓ yendim' : '  ✗ geride') : ''}`;
  const ytdLine   = ytd != null ? `📅 YTD:      ${fmtPct(ytd)}` : null;
  const allocStr  = Object.entries(allocation)
    .filter(([, v]) => v >= 1)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} %${v.toFixed(0)}`)
    .join(' · ');

  const lines = [
    `📊 ${monthLbl} — Portföy Özeti`,
    '',
    `💰 Değer:    ${fmtAmt(totalMV)}`,
    portR != null ? `📈 Aylık:    ${approx}${fmtPct(portR)}` : null,
    ytdLine,
    '',
    'Benchmark:',
    `  Portföy  ${approx}${fmtPct(portR)}`,
    spyLine,
    xu100Line,
    '',
    bestPos  ? `🏆 En İyi:  ${bestPos.ticker}  ${fmtPct(bestPos.ret)}`   : null,
    worstPos ? `📉 En Kötü: ${worstPos.ticker}  ${fmtPct(worstPos.ret)}` : null,
    '',
    `💵 Temettü:     ${fmtAmt(dividends)}`,
    `➕ Net Yatırım: ${netInvested >= 0 ? '+' : ''}${fmtAmt(netInvested)}`,
    allocStr ? `🗂 Dağılım: ${allocStr}` : null,
    '',
    '— Portfoi ile hesaplandı',
  ].filter(l => l !== null);

  return lines.join('\n');
}

async function downloadOrShareCard(ref, monthLbl) {
  if (!window.html2canvas || !ref.current) return;
  const canvas = await window.html2canvas(ref.current, { backgroundColor: '#0c0c0c', scale: 2 });
  const fileName = `portfoi-${monthLbl.replace(/ /g, '-')}.png`;
  canvas.toBlob(async blob => {
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (_) {}
    }
    const a = document.createElement('a');
    a.download = fileName;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png');
}
```

- [ ] **Adım 3: babel-checker çalıştır**

```bash
npm run check:babel
```

Beklenen: `src/components/AnalysisTab.js` parse OK.

- [ ] **Adım 4: Commit**

```bash
git add src/components/AnalysisTab.js
git commit -m "feat: add monthly summary helpers (calcMonthlyMetrics, buildSummaryText, downloadOrShareCard)"
```

---

## Task 4: AnalysisTab — State, ref ve Supabase fetch

**Files:**
- Modify: `src/components/AnalysisTab.js` — `AnalysisTab` fonksiyonu içi, mevcut `useState` bloklarının altına

- [ ] **Adım 1: `function AnalysisTab` içinde `assetDistMode` state'ini bul**

```js
const [assetDistMode,setAssetDistMode]=useState("mv");
```

- [ ] **Adım 2: Bu satırın hemen üstüne (fonksiyonun başına) yeni state ve ref ekle**

```js
  // Aylık Özet state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [snapshots, setSnapshots]       = useState({}); // { "AAPL_2026-04-01": 185.20 }
  const [snapshotsBusy, setSnapshotsBusy] = useState(false);
  const shareCardRef = useRef(null);
  const [html2canvasReady, setHtml2canvasReady] = useState(false);
```

- [ ] **Adım 3: `useRef` import'unu kontrol et**

`AnalysisTab.js` dosyasında `useRef` kullanıldığını doğrula:
```bash
grep -n "useRef" src/components/AnalysisTab.js | head -5
```
Eğer `const autoFetchGuard=useRef(false)` gibi bir satır varsa — zaten `useRef` mevcut, ekstra import gerekmez (Babel UMD `React.useRef` global'den alıyor).

- [ ] **Adım 4: `snapshots` fetch useEffect ekle — `fundBusy` state'inin hemen altına**

```js
  // price_snapshots fetch — mount'ta bir kez yükle
  useEffect(() => {
    setSnapshotsBusy(true);
    sb.from('price_snapshots')
      .select('ticker, snapshot_date, price')
      .then(({ data }) => {
        if (data) {
          const map = {};
          data.forEach(r => { map[`${r.ticker}_${r.snapshot_date}`] = +r.price; });
          setSnapshots(map);
        }
        setSnapshotsBusy(false);
      });
  }, []);
```

- [ ] **Adım 5: html2canvas hazır kontrolü için useEffect ekle — bir öncekinin hemen altına**

```js
  useEffect(() => {
    if (window.html2canvas) { setHtml2canvasReady(true); return; }
    const t = setInterval(() => {
      if (window.html2canvas) { setHtml2canvasReady(true); clearInterval(t); }
    }, 300);
    return () => clearInterval(t);
  }, []);
```

- [ ] **Adım 6: babel-checker çalıştır**

```bash
npm run check:babel
```

Beklenen: parse OK.

- [ ] **Adım 7: Commit**

```bash
git add src/components/AnalysisTab.js
git commit -m "feat: add selectedMonth state and price_snapshots fetch to AnalysisTab"
```

---

## Task 5: MonthlySnapshotCard — UI kartı

**Files:**
- Modify: `src/components/AnalysisTab.js` — return içi, filtre chip bar IIFE'den hemen sonra

- [ ] **Adım 1: Doğru ekleme noktasını bul**

`src/components/AnalysisTab.js` içinde bu satırı bul (filtre chip bar kapanışı):
```js
      {/* Varlık dağılımı — stacked bar */}
```

MonthlySnapshotCard bu satırın hemen öncesine eklenecek.

- [ ] **Adım 2: Kartı ekle**

Bu IIFE bloğunu `{/* Varlık dağılımı */}` yorumunun hemen öncesine yapıştır:

```jsx
      {/* ── Kart: Aylık Özet ─────────────────────────────────────── */}
      {(()=>{
        const months   = prevMonths(12);
        const mLabel   = monthLabel(selectedMonth);
        const metrics  = calcMonthlyMetrics({ ym: selectedMonth, pos, txs, prc, hist, snapshots, cnv });
        const { monthReturn, isApprox, totalMV, dividends, netInvested, bestPos, worstPos, ytd, benchmarks, allocation, monthTxsCount } = metrics;
        const fmtPct   = r => r != null ? `${r >= 0 ? '+' : ''}${r.toFixed(1)}%` : '—';
        const fmtAmt   = v => `${dSym}${fmt(Math.abs(v),0)}`;
        return (
          <div className="card" style={{marginBottom:14,padding:"16px 18px"}}>
            {/* Başlık + ay seçici */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div className="stitle">Aylık Özet</div>
              <select
                value={selectedMonth}
                onChange={e=>setSelectedMonth(e.target.value)}
                style={{background:"var(--bg4)",border:"1px solid var(--border2)",color:"var(--text)",
                        borderRadius:8,padding:"5px 10px",fontSize:12,fontFamily:"inherit"}}
              >
                {months.map(mo=>(
                  <option key={mo.value} value={mo.value}>{mo.label}</option>
                ))}
              </select>
            </div>

            {/* 2×2 metrik grid */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div style={{background:"var(--bg4)",borderRadius:10,padding:"10px 12px"}}>
                <div className="lbl">Portföy Değeri</div>
                <div style={{fontFamily:"DM Mono,monospace",fontSize:15,fontWeight:700,marginTop:4,color:"var(--info)"}}>
                  {hide ? mask() : fmtAmt(totalMV)}
                </div>
              </div>
              <div style={{background:"var(--bg4)",borderRadius:10,padding:"10px 12px"}}>
                <div className="lbl">Aylık Getiri {isApprox&&<span style={{color:"var(--text3)"}}>~</span>}</div>
                <div style={{fontFamily:"DM Mono,monospace",fontSize:15,fontWeight:700,marginTop:4,
                             color:monthReturn==null?"var(--text3)":monthReturn>=0?"var(--ok)":"var(--err)"}}>
                  {monthReturn!=null ? fmtPct(monthReturn) : '—'}
                </div>
              </div>
              <div style={{background:"var(--bg4)",borderRadius:10,padding:"10px 12px"}}>
                <div className="lbl">YTD {ytd==null&&<span style={{fontSize:9,color:"var(--text3)"}}>snap. yok</span>}</div>
                <div style={{fontFamily:"DM Mono,monospace",fontSize:15,fontWeight:700,marginTop:4,
                             color:ytd==null?"var(--text3)":ytd>=0?"var(--ok)":"var(--err)"}}>
                  {ytd!=null ? fmtPct(ytd) : '—'}
                </div>
              </div>
              <div style={{background:"var(--bg4)",borderRadius:10,padding:"10px 12px"}}>
                <div className="lbl">Temettü</div>
                <div style={{fontFamily:"DM Mono,monospace",fontSize:15,fontWeight:700,marginTop:4,color:"var(--info)"}}>
                  {hide ? mask() : fmtAmt(dividends)}
                </div>
              </div>
            </div>

            {/* Benchmark */}
            <div className="lbl" style={{marginBottom:6}}>Benchmark</div>
            {[
              {label:"Portföy", ret: monthReturn, approx: isApprox},
              {label:"SPY",     ret: benchmarks.spy},
              {label:"XU100",   ret: benchmarks.xu100},
            ].map(row=>(
              <div key={row.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                                          padding:"5px 0",borderTop:"1px solid var(--border)"}}>
                <span style={{fontSize:12,color:"var(--text2)",fontWeight:500}}>{row.label}</span>
                <span style={{fontFamily:"DM Mono,monospace",fontSize:12,fontWeight:700,
                              color:row.ret==null?"var(--text3)":row.ret>=0?"var(--ok)":"var(--err)"}}>
                  {row.approx&&row.ret!=null?"~":""}{fmtPct(row.ret)}
                </span>
              </div>
            ))}

            {/* Best / worst */}
            <div style={{display:"flex",gap:10,marginTop:12}}>
              {[
                {lbl:"En İyi",  pos:bestPos,  color:"var(--ok)"},
                {lbl:"En Kötü", pos:worstPos, color:"var(--err)"},
              ].map(({lbl,pos:p,color})=>(
                <div key={lbl} style={{flex:1,background:"var(--bg4)",borderRadius:10,padding:"10px 12px"}}>
                  <div className="lbl" style={{color,marginBottom:5}}>{lbl}</div>
                  {p ? (
                    <>
                      <div style={{fontFamily:"DM Mono,monospace",fontSize:13,fontWeight:700}}>{p.ticker}</div>
                      <div style={{fontFamily:"DM Mono,monospace",fontSize:12,fontWeight:600,color}}>{fmtPct(p.ret)}</div>
                    </>
                  ) : <div style={{fontSize:11,color:"var(--text3)"}}>—</div>}
                </div>
              ))}
            </div>

            {/* Net yatırım + dağılım */}
            <div style={{marginTop:12,display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--text2)"}}>
              <span>Net Yatırım</span>
              <span style={{fontFamily:"DM Mono,monospace",fontWeight:600,
                            color:netInvested>=0?"var(--ok)":"var(--err)"}}>
                {hide ? mask() : `${netInvested>=0?'+':''}${fmtAmt(netInvested)}`}
              </span>
            </div>
            <div style={{marginTop:6,fontSize:11,color:"var(--text3)",lineHeight:1.6}}>
              <span className="lbl">Dağılım </span>
              {Object.entries(allocation).filter(([,v])=>v>=1).sort((a,b)=>b[1]-a[1])
                .map(([k,v])=>`${k} %${v.toFixed(0)}`).join(' · ')}
            </div>

            {isApprox&&(
              <div style={{marginTop:8,fontSize:10,color:"var(--text3)"}}>
                ~ Getiri yaklaşık (30 günlük rolling) — snapshot henüz yok.
              </div>
            )}

            {/* Aksiyon butonları */}
            <div style={{display:"flex",gap:8,marginTop:14}}>
              <button
                className="btn-sm"
                style={{flex:1,border:"1px solid var(--border2)",color:"var(--info)",background:"transparent"}}
                onClick={async()=>{
                  const txt = buildSummaryText({ metrics, monthLbl: mLabel, dSym, fxRates, displayCur });
                  await navigator.clipboard.writeText(txt);
                  flash_("Metin kopyalandı","ok");
                }}
              >📋 Metni Kopyala</button>
              {html2canvasReady&&(
                <button
                  className="btn-sm"
                  style={{flex:1,background:"rgba(201,168,76,0.12)",border:"1px solid var(--border2)",color:"var(--info)"}}
                  onClick={()=>downloadOrShareCard(shareCardRef, mLabel)}
                >🖼 Kart İndir</button>
              )}
            </div>

            {/* Paylaşım kartı (PNG hedefi) */}
            <div ref={shareCardRef} style={{
              marginTop:16,
              background:"linear-gradient(145deg,#0c0c0c 0%,#141414 100%)",
              border:"1px solid rgba(201,168,76,0.28)",
              borderRadius:16,padding:20,
            }}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <div style={{width:32,height:32,background:"rgba(201,168,76,0.15)",borderRadius:8,
                             display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>📊</div>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:"var(--text)"}}>Portföy Özeti</div>
                  <div style={{fontSize:11,color:"var(--text3)"}}>{mLabel} · Portfoi</div>
                </div>
              </div>
              <div style={{textAlign:"center",padding:"12px 0",borderBottom:"1px solid var(--border)",marginBottom:12}}>
                <div style={{fontFamily:"DM Mono,monospace",fontSize:28,fontWeight:700,
                             color:monthReturn==null?"var(--text3)":monthReturn>=0?"var(--ok)":"var(--err)"}}>
                  {isApprox?"~":""}{fmtPct(monthReturn)}
                </div>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>
                  Aylık Getiri · {hide?mask():fmtAmt(totalMV)} toplam değer
                </div>
              </div>
              {[
                {label:"YTD",    val: ytd!=null?fmtPct(ytd):"—",  color: ytd!=null&&ytd>=0?"var(--ok)":"var(--err)"},
                {label:"vs SPY", val: benchmarks.spy!=null&&monthReturn!=null
                  ? `${(monthReturn-benchmarks.spy)>=0?'+':''}${(monthReturn-benchmarks.spy).toFixed(1)}%`
                  : "—",        color: benchmarks.spy!=null&&monthReturn!=null&&monthReturn>=benchmarks.spy?"var(--ok)":"var(--err)"},
                {label:"En iyi", val: bestPos?`${bestPos.ticker} ${fmtPct(bestPos.ret)}`:"—", color:"var(--text)"},
                {label:"Temettü",val: hide?mask():fmtAmt(dividends), color:"var(--info)"},
              ].map(row=>(
                <div key={row.label} style={{display:"flex",justifyContent:"space-between",
                                            padding:"4px 0",fontSize:12}}>
                  <span style={{color:"var(--text3)"}}>{row.label}</span>
                  <span style={{color:row.color,fontFamily:"DM Mono,monospace",fontWeight:600}}>{row.val}</span>
                </div>
              ))}
              <div style={{marginTop:12,textAlign:"center",fontSize:10,color:"rgba(201,168,76,0.5)",letterSpacing:.5}}>
                portfoi · canmerter.github.io/Investment-Ledger
              </div>
            </div>
          </div>
        );
      })()}
```

- [ ] **Adım 3: babel-checker çalıştır**

```bash
npm run check:babel
```

Beklenen: parse OK.

- [ ] **Adım 4: Commit**

```bash
git add src/components/AnalysisTab.js
git commit -m "feat: add MonthlySnapshotCard to AnalysisTab (8 metrics, copy text, PNG card)"
```

---

## Task 6: Manuel Doğrulama

- [ ] **Adım 1: Dev sunucu başlat**

```bash
npx serve . -p 3000
```

Tarayıcıda: http://localhost:3000

- [ ] **Adım 2: Analiz sekmesini aç**

Giriş yap → Analiz sekmesine geç → Sayfanın en üstünde "Aylık Özet" kartının göründüğünü doğrula.

- [ ] **Adım 3: Ay seçiciyi test et**

Dropdown'dan farklı aylar seç → metrikler güncelleniyor mu kontrol et.

- [ ] **Adım 4: "Metni Kopyala" testi**

Butona bas → flash "Metin kopyalandı" görünmeli → bir metin editörüne yapıştır, formatı doğrula.

- [ ] **Adım 5: "Kart İndir" testi**

Butona bas → PNG dosyası indirilmeli. Dosyayı aç, paylaşım kartı görünümünü kontrol et.

- [ ] **Adım 6: Gizle modu testi**

Topbarda 👁 butonuna bas → parasal değerler `••••` ile maskelenmiş olmalı.

- [ ] **Adım 7: price_snapshots boşken yaklaşık badge kontrolü**

Tablo henüz boşsa: getiri satırlarının başında `~` görünmeli, altta "Getiri yaklaşık..." notu olmalı.

- [ ] **Adım 8: Commit (gerekirse düzeltmeler sonrası)**

```bash
git add -A
git commit -m "fix: address manual verification findings for MonthlySnapshotCard"
```

---

## Bağımlılıklar

```
Task 1 (Migration) ──► bağımsız, önce deploy et
Task 2 (CDN)       ──► bağımsız
Task 3 (Helpers)   ──► Task 2'den bağımsız; Task 4 bu fonksiyonları kullanıyor
Task 4 (State)     ──► Task 3 tamamlandıktan sonra
Task 5 (Card UI)   ──► Task 3 + Task 4 tamamlandıktan sonra
Task 6 (Verify)    ──► Task 1-5 tamamlandıktan sonra
```
