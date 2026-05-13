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

  const tickerDelta = ticker => {
    const start = snapPrice(ticker, monthStart);
    const end   = prc[ticker];
    if (start != null && end != null) return { ret: (end - start) / start * 100, approx: false };
    const h = hist[ticker];
    if (h?.p_m1 != null && end != null) return { ret: (end - h.p_m1) / h.p_m1 * 100, approx: true };
    return null;
  };

  const hasSnapshots = pos.some(p => snapPrice(p.ticker, monthStart) != null);

  const monthTxs = txs.filter(t => t.date >= monthStart && t.date < nextStart);

  const dividends = monthTxs
    .filter(t => t.way === 'DIV')
    .reduce((s, t) => s + (cnv(+t.total || (+t.price * +t.shares), t.currency || 'USD') || 0), 0);

  const netInvested = monthTxs
    .filter(t => t.way !== 'DIV')
    .reduce((s, t) => {
      const amt = cnv(+t.total || (+t.price * +t.shares), t.currency || 'USD') || 0;
      return s + (t.way === 'BUY' ? amt : -amt);
    }, 0);

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

  const totalMV = pos.reduce((s, p) => {
    const pr = prc[p.ticker];
    return pr ? s + (cnv(p.shares * pr, priceCurOf(p)) || 0) : s;
  }, 0);

  const posDeltas = pos
    .map(p => { const d = tickerDelta(p.ticker); return d ? { ticker: p.ticker, ret: d.ret } : null; })
    .filter(Boolean)
    .sort((a, b) => b.ret - a.ret);
  const bestPos  = posDeltas[0]  || null;
  const worstPos = posDeltas[posDeltas.length - 1] || null;

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

  const benchDelta = ticker => {
    const start = snapPrice(ticker, monthStart);
    const end   = prc[ticker];
    if (start != null && end != null) return (end - start) / start * 100;
    const h = hist[ticker];
    return (h?.p_m1 != null && end != null) ? (end - h.p_m1) / h.p_m1 * 100 : null;
  };
  const benchmarks = { spy: benchDelta('SPY'), xu100: benchDelta('XU100') };

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

function buildSummaryText({ metrics, monthLbl, dSym }) {
  const { monthReturn, isApprox, totalMV, dividends, netInvested, bestPos, worstPos, ytd, benchmarks, allocation } = metrics;
  const approx = isApprox ? '~' : '';
  const fmtPct  = r => r != null ? `${r >= 0 ? '+' : ''}${r.toFixed(1)}%` : '—';
  const fmtAmt  = v => `${dSym}${Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(1) + 'k' : Math.abs(v).toFixed(0)}`;

  const portR  = monthReturn;
  const spyR   = benchmarks.spy;
  const xu100R = benchmarks.xu100;

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
    'Karşılaştırma:',
    `  Portföy  ${approx}${fmtPct(portR)}`,
    spyLine,
    xu100Line,
    '',
    bestPos  ? `🏆 En İyi:  ${bestPos.ticker}  ${fmtPct(bestPos.ret)}`   : null,
    worstPos ? `📉 En Kötü: ${worstPos.ticker}  ${fmtPct(worstPos.ret)}` : null,
    '',
    `💵 Temettü:     ${fmtAmt(dividends)}`,
    `➕ Net Yatırım: ${netInvested >= 0 ? '+' : ''}${fmtAmt(Math.abs(netInvested))}`,
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

// ── AnalysisTab — Portföy analiz sekmesi (Sprint 1) ────────────
// Şu an: filtreli varlık dağılımı pie. Sprint 2: bölge / komisyon / win-loss.
// Filter chip "Genel" → asset type breakdown; spesifik tip → o tipteki ticker breakdown.
// Sektör dağılımı renk paleti — 10 distinct renk + fallback gri (bilinmiyor)
const SECTOR_COLORS = [
  "#8B5CF6","#3B82F6","#06B6D4","#F97316","#C9A84C",
  "#10B981","#D97706","#EF4444","#A78BFA","#60A5FA",
];
const SECTOR_UNKNOWN_COLOR = "#6B7280";
const TYPE_LABEL_SHORT = {
  all:"Genel", US_STOCK:"US Hisse", BIST:"BIST", FUND:"ETF/Fon",
  CRYPTO:"Kripto", GOLD:"Altın", FX:"Döviz"
};
// Ticker-level pie için palet — TYPE_COLORS sadece 6 entry; bir tip'in altında 6+ ticker olunca distinct renk gerek
const TICKER_PIE_COLORS = ["#8B5CF6","#3B82F6","#06B6D4","#F97316","#C9A84C","#10B981","#D97706","#EF4444","#A78BFA","#60A5FA","#34D399","#FB923C"];

// Region heuristic — type → region key. ETF underlying holdings (MCHI=Çin gibi)
// için ileride per-ticker override gerekebilir; şu an asset_type → region.
const REGION_OF = {
  US_STOCK:"us", FUND:"us",
  BIST:"tr",
  CRYPTO:"crypto", GOLD:"emtia",
  FX:"fx",
};
const REGION_META = {
  us:          { label: "US",                color: "#8B5CF6" },
  tr:          { label: "Türkiye",            color: "#F97316" },
  eu:          { label: "Avrupa",             color: "#3B82F6" },
  "asia-pac":  { label: "Asya-Pasifik",       color: "#06B6D4" },
  em:          { label: "Gelişen Piyasalar",  color: "#D97706" },
  other:       { label: "Diğer",              color: "#6B7280" },
  crypto:      { label: "Global · Kripto",    color: "#06B6D4" },
  emtia:       { label: "Global · Emtia",     color: "#C9A84C" },
  fx:          { label: "Döviz",              color: "#10B981" },
};

const ETF_CW_TTL = 90 * 24 * 60 * 60 * 1000;

// Currency symbol helper
const sym_ = (cur) => cur==="TRY" ? "₺" : cur==="EUR" ? "€" : "$";

// SVG pie path generator — tek-slice ile multi-slice ayrı handle
const buildSlicesPath = (sliceArr, CX, CY, R) => {
  let acc = 0;
  return sliceArr.map(s => {
    const startA = acc * Math.PI * 2;
    acc += s.frac;
    const endA = acc * Math.PI * 2;
    const x1 = CX + R * Math.sin(startA), y1 = CY - R * Math.cos(startA);
    const x2 = CX + R * Math.sin(endA),   y2 = CY - R * Math.cos(endA);
    const large = (endA - startA) > Math.PI ? 1 : 0;
    let path;
    if (sliceArr.length === 1) {
      path = `M ${CX-R} ${CY} A ${R} ${R} 0 1 1 ${CX+R} ${CY} A ${R} ${R} 0 1 1 ${CX-R} ${CY} Z`;
    } else {
      path = `M ${CX} ${CY} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    }
    return {...s, path};
  });
};

function AnalysisTab({pos,txs,splits,prc,hist,hide,mask,setTab,displayCur,fxRates,openDetail,onHealthSummary}){
  // Aylık Özet state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [snapshots, setSnapshots]           = useState({});
  const [snapshotsBusy, setSnapshotsBusy]   = useState(false);
  const shareCardRef                         = useRef(null);
  const [html2canvasReady, setHtml2canvasReady] = useState(false);
  const [assetDistMode,setAssetDistMode]=useState("mv"); // "cost" | "mv"
  const [expandedAssetType,setExpandedAssetType]=useState(null);
  const [activeTypes,setActiveTypes]=useState(()=>BLOCK_TYPES.filter(cfg=>pos.some(p=>p.type===cfg.type)).map(cfg=>cfg.type));
  useEffect(()=>{
    const all=BLOCK_TYPES.filter(cfg=>pos.some(p=>p.type===cfg.type)).map(cfg=>cfg.type);
    setActiveTypes(prev=>{
      const valid=prev.filter(t=>all.includes(t));
      return valid.length>0?valid:all;
    });
  },[pos.length]);
  // Kart collapse state'leri — default kapalı (özet üstte, detay isteğe bağlı).
  const [healthOpen,setHealthOpen]=useState(false);
  const [commOpen,setCommOpen]=useState(false);
  const [resilienceOpen,setResilienceOpen]=useState(false);
  const [assetPieOpen,setAssetPieOpen]=useState(true);
  const [regionPieOpen,setRegionPieOpen]=useState(true);
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
  const [sectorPieOpen,setSectorPieOpen]=useState(true);
  const [sectorMetaBusy,setSectorMetaBusy]=useState(false);
  const [sectorMetaTick,setSectorMetaTick]=useState(0); // inc to force re-render after meta fetch
  // Auto-fetch sector meta on mount for US_STOCK/BIST/FUND positions missing meta
  useEffect(()=>{
    const missing=pos.filter(p=>{
      if(p.type!=="US_STOCK"&&p.type!=="BIST"&&p.type!=="FUND")return false;
      const m=metaCacheGet(p.ticker);
      return!(m&&(m.sic_description||m.industry));
    });
    if(missing.length===0)return;
    setSectorMetaBusy(true);
    (async()=>{
      for(let i=0;i<missing.length;i++){
        const p=missing[i];
        try{
          const r=await edgePriceCall({ticker:p.ticker,mode:"meta",asset_type:p.type});
          const d=await r.json();
          if(r.ok&&d&&typeof d==="object")metaCacheSet(p.ticker,d);
        }catch(e){DEBUG&&console.warn("[sector auto-meta]",p.ticker,e);}
        if(i<missing.length-1)await new Promise(res=>setTimeout(res,600));
      }
      setSectorMetaBusy(false);
      setSectorMetaTick(t=>t+1);
    })();
  },[]);
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
  // Aktif tip filtresi — global chip bar
  const atAll = BLOCK_TYPES.filter(cfg=>pos.some(p=>p.type===cfg.type)).map(cfg=>cfg.type);
  const filteredPos = activeTypes.length >= atAll.length ? pos : pos.filter(p=>activeTypes.includes(p.type));
  const filteredTxs = (() => {
    if (filteredPos === pos) return txs;
    const tickers = new Set(filteredPos.map(p=>p.ticker));
    return txs.filter(t=>tickers.has(t.ticker));
  })();
  const dSym = displaySym(displayCur);
  const cnv = (amt, from) => convert(amt, from, displayCur, fxRates);
  // Sağlık tablosu state — ticker bazlı fund cache, mount'ta LS'ten topla.
  const [fundCache,setFundCache]=useState(()=>{
    const c={};
    pos.forEach(p=>{
      if(p.type!=="US_STOCK"&&p.type!=="BIST")return;
      const v=fundCacheGet(p.ticker);
      if(v?.metrics)c[p.ticker]=v;
    });
    return c;
  });
  const [fundBusy,setFundBusy]=useState(false);
  const [fundProg,setFundProg]=useState("");
  const [healthFilter,setHealthFilter]=useState("all"); // all | US_STOCK | BIST
  const [fundAutoFetchPending,setFundAutoFetchPending]=useState(false);
  const autoFetchGuard=useRef(false);
  // pos değişince veya eager fetch yeni veri yazınca (fundEagerVer) LS'ten senkronla
  useEffect(()=>{
    // 1) localStorage fast-path
    setFundCache(prev=>{
      const next={...prev};
      pos.forEach(p=>{
        if(p.type!=="US_STOCK"&&p.type!=="BIST")return;
        if(next[p.ticker])return;
        const v=fundCacheGet(p.ticker);
        if(v?.metrics)next[p.ticker]=v;
      });
      return next;
    });

    // 2) Supabase fund_cache — pg_cron ile güncellenen merkezi veri
    const tickers=pos
      .filter(p=>p.type==="US_STOCK"||p.type==="BIST")
      .map(p=>p.ticker);
    if(!tickers.length)return;

    sb.from("fund_cache")
      .select("ticker, asset_type, metrics, annual, grades")
      .in("ticker",tickers)
      .then(({data,error})=>{
        const fetched=new Set();
        if(!error&&data?.length){
          setFundCache(prev=>{
            const next={...prev};
            data.forEach(row=>{
              if(!row.metrics)return;
              const d={metrics:row.metrics,annual:row.annual??null,grades:row.grades??null};
              next[row.ticker]=d;
              fundCacheSet(row.ticker,d);
              fetched.add(row.ticker);
            });
            return next;
          });
        }
        // Supabase veya localStorage'da olmayan ticker'lar için auto-fetch tetikle
        if(!autoFetchGuard.current){
          const stillMissing=tickers.filter(t=>!fetched.has(t)&&!fundCacheGet(t)?.metrics&&!fundCacheGet(t)?.unavailable);
          if(stillMissing.length){autoFetchGuard.current=true;setFundAutoFetchPending(true);}
        }
      });
  },[pos]);

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

  // html2canvas hazır mı?
  useEffect(() => {
    if (window.html2canvas) { setHtml2canvasReady(true); return; }
    const t = setInterval(() => {
      if (window.html2canvas) { setHtml2canvasReady(true); clearInterval(t); }
    }, 300);
    return () => clearInterval(t);
  }, []);

  // Sağlık tablosu için 8 kritik metrik (default; tüm 21 metrik FUND_THRESHOLDS'ta)
  const HEALTH_METRICS=[
    ["pe",                "F/K",          "x"],
    ["roe",               "ROE",          "pct"],
    ["netMargin",         "Net Marj",     "pct"],
    ["operatingMargin",   "Op Marj",      "pct"],
    ["revenueGrowth5Y",   "Gelir 5Y",     "pct"],
    ["earningsGrowth5Y",  "Kâr 5Y",       "pct"],
    ["liabToEquity",      "Borç/Özk",     "x"],
    ["netDebtToFcf",      "NetBorç/FCF",  "x"],
  ];
  const healthEligible = filteredPos.filter(p=>p.type==="US_STOCK"||p.type==="BIST");
  const healthFiltered = healthFilter==="all" ? healthEligible : healthEligible.filter(p=>p.type===healthFilter);
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
  const healthMissing = healthFiltered.filter(p=>!fundCache[p.ticker]);
  // Piyasa Düşüşü Dayanıklılık Skoru
  const ISY_KNOWN_BANKS = new Set(["GARAN","AKBNK","YKBNK","ISCTR","HALKB","VAKBN","ALBRK","QNBFB","TSKB","ICBCT","SKBNK"]);
  const resilienceEligible = filteredPos.filter(p =>
    (p.type === "US_STOCK" || p.type === "BIST") && !ISY_KNOWN_BANKS.has(p.ticker)
  );
  const resilienceMissing = resilienceEligible.filter(p => !fundCache[p.ticker]);
  const resilienceScore = (m) => {
    if (!m) return null;
    let raw = 0, counted = 0;
    if (m.liabToEquity != null) { counted++; if (m.liabToEquity < 0.5) raw += 2; }
    if (m.fcfMargin != null) { counted++; if (m.fcfMargin > 0.10) raw += 2; }
    if (m.operatingMargin != null) { counted++; if (m.operatingMargin > 0.15) raw += 2; }
    if (counted === 0) return null;
    return Math.round(raw / (counted * 2) * 9) + 1; // 1–10 scale
  };
  // Bir pozisyonun skoru: kaç metrik "good" (yeşil) / toplam değerli (null hariç)
  const rowScore = (m) => {
    if(!m) return {good:0,total:0};
    let good=0,total=0;
    HEALTH_METRICS.forEach(([key])=>{
      const s=fundScore(key,m[key]);
      if(s===null)return;
      total++;
      if(s==="good")good++;
    });
    return {good,total};
  };
  // force=true: eligible üst kümesinin tamamını yeniden çek (cache fresh olsa bile).
  // force=false (default): sadece eksikler. App.js mount'ta `fetchAllFundamentalsEager`
  // arka planda çoğunu doldurduğu için missing genelde 0 olur — buton "Yenile" davranışına geçer.
  const fetchAllFund = async (force=false) => {
    const dedup = (arr) => [...new Map(arr.map(p=>[p.ticker,p])).values()];
    const targets = force
      ? dedup([...healthEligible, ...resilienceEligible])
      : dedup([...healthMissing, ...resilienceMissing]);
    if(targets.length===0||fundBusy)return;
    setFundBusy(true);
    const next={...fundCache};
    for(let i=0;i<targets.length;i++){
      const p=targets[i];
      setFundProg(`${p.ticker} (${i+1}/${targets.length})`);
      try{
        const r=await edgeCallAuth("fetch-fundamentals",{ticker:p.ticker,asset_type:p.type});
        const d=await r.json();
        if(r.ok&&d?.metrics){
          next[p.ticker]=d;
          fundCacheSet(p.ticker,d);
          setFundCache({...next});  // her başarıda UI tazele
        } else if(d?.code==="OUT_OF_PLAN"||(!r.ok&&!d?.metrics)){
          const sentinel={metrics:null,unavailable:true};
          next[p.ticker]=sentinel;
          fundCacheSet(p.ticker,sentinel);
          setFundCache({...next});
        }
      }catch(e){DEBUG && console.warn(`[health ${p.ticker}]`,e);}
      if(i<targets.length-1) await new Promise(r=>setTimeout(r,800));
    }
    setFundBusy(false);
    setFundProg("");
  };
  // Supabase read sonrası hâlâ eksik ticker varsa otomatik çek (kullanıcı müdahalesi gerekmez)
  useEffect(()=>{
    if(!fundAutoFetchPending||fundBusy)return;
    setFundAutoFetchPending(false);
    fetchAllFund(false);
  },[fundAutoFetchPending]);
  // "son X sa önce" status için en eski fund cache timestamp'i (eligible ticker'lar arası)
  const fundOldestTs = (() => {
    const tickers = [...new Set([...healthEligible, ...resilienceEligible].map(p=>p.ticker))];
    return fundCacheOldestTs(tickers);
  })();
  const fundFreshLabel = (() => {
    if(!fundOldestTs)return null;
    const mins = Math.floor((Date.now()-fundOldestTs)/60000);
    if(mins<1)return "az önce";
    if(mins<60)return `${mins} dk önce`;
    const hrs = Math.floor(mins/60);
    if(hrs<24)return `${hrs} sa önce`;
    return `${Math.floor(hrs/24)} gün önce`;
  })();
  // Pozisyon ham MV (orijinal currency'de) → display cur'a çevir
  const mvDisp = (p) => {
    const raw = (prc[p.ticker] || 0) * p.shares;
    if (raw <= 0) return 0;
    // price_cache stores TRY for BIST (Yahoo), USD for everything else (Massive).
    // Use asset-type-based currency, not p.currency which may be stale.
    const priceCur = p.type === "BIST" ? "TRY" : "USD";
    return cnv(raw, priceCur) || 0;
  };
  // Pozisyon maliyet (avg_cost × shares, orijinal currency'de) → display cur'a çevir
  const costDisp = (p) => {
    const raw = (p.avgCost || 0) * p.shares;
    if (raw <= 0) return 0;
    return cnv(raw, p.currency || "USD") || 0;
  };

  // Split factor lookup — buy/sell tarihinden sonra split olmuşsa fiyatı düzelt.
  // factorAt(ticker,date) = ratio'ların tarihten sonraki çarpımı.
  // adjusted_price = original_price / factor (split sonrası eşdeğer fiyat).
  const splitsByT = {};
  (splits||[]).forEach(s => { (splitsByT[s.ticker]=splitsByT[s.ticker]||[]).push(s); });
  const factorAt = (ticker, date) => {
    const arr = splitsByT[ticker] || [];
    return arr.filter(s => s.split_date > date).reduce((a,s)=>a*+s.ratio,1);
  };

  // Slice hesabı: type breakdown — global filtre zaten aktif tip seçimini yönetiyor.
  // assetDistMode: "mv" → piyasa değeri, "cost" → maliyet. Tüm değerler display cur'a convert.
  const slices = (() => {
    const valFn = assetDistMode === "cost" ? costDisp : mvDisp;
    const byType = {};
    filteredPos.forEach(p => {
      const v = valFn(p);
      if (v > 0) byType[p.type] = (byType[p.type] || 0) + v;
    });
    const total = Object.values(byType).reduce((a,v)=>a+v,0);
    const arr = Object.entries(byType)
      .map(([type,value]) => ({key:type, label:TL[type]||type, value, color:TYPE_COLORS[type]||"#666"}))
      .sort((a,b)=>b.value-a.value);
    arr.forEach(s => s.frac = total > 0 ? s.value/total : 0);
    return {arr, total};
  })();

  // Tüm dağılım kartları display currency sembolünde gösterir
  const sym = dSym;

  // Region slices — type→region mapping. Tüm currency'ler display cur'a convert.
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

  // Komisyon — filtreli tx'ler display cur'a convert; KPI/broker/year tek tutar.
  const commData = (() => {
    let total = 0;
    const byBroker = {};   // {broker: amount}
    const byYear = {};     // {year: amount}
    filteredTxs.forEach(t => {
      const raw = +t.commission || 0;
      if (raw <= 0) return;
      const cur = t.currency || "USD";
      const c = cnv(raw, cur);
      if (c == null) return;  // FX yok → atla
      const broker = (t.broker||"Bilinmiyor").trim() || "Bilinmiyor";
      const year = (t.date||"").slice(0,4);
      total += c;
      byBroker[broker] = (byBroker[broker]||0) + c;
      if (year) byYear[year] = (byYear[year]||0) + c;
    });
    const brokerList = Object.entries(byBroker).map(([broker,sum]) => ({broker, sum}))
      .sort((a,b)=>b.sum-a.sum);
    const yearList = Object.entries(byYear).map(([year,sum]) => ({year, sum}))
      .sort((a,b)=>a.year.localeCompare(b.year));
    return {total, brokerList, yearList};
  })();

  // Win/Loss — BUY ve SELL bağımsız, split-adjusted (NVDA gibi pre-split fiyatlar)
  const winLoss = (() => {
    let buyW=0, buyL=0, buyN=0, sellW=0, sellL=0, sellN=0;
    filteredTxs.forEach(t => {
      const cur = prc[t.ticker];
      if (cur == null || cur <= 0) {
        if (t.way === "BUY") buyN++;
        else if (t.way === "SELL") sellN++;
        return;
      }
      const adj = (+t.price) / factorAt(t.ticker, t.date);
      if (t.way === "BUY") {
        if (cur > adj) buyW++;
        else if (cur < adj) buyL++;
      } else if (t.way === "SELL") {
        if (cur < adj) sellW++;
        else if (cur > adj) sellL++;
      }
    });
    return {
      buy:  {win: buyW,  loss: buyL,  noPrice: buyN},
      sell: {win: sellW, loss: sellL, noPrice: sellN},
    };
  })();

  // Tab-level empty state
  if (pos.length === 0) {
    return (
      <div className="empty-card">
        <div className="ic">📊</div>
        <div className="ttl">Analiz için pozisyon yok</div>
        <div className="sub">Önce pozisyon ekle, sonra dağılım/komisyon/win-loss analizleri burada görünecek.</div>
        <button className="pri" onClick={()=>setTab("add")}>+ İlk işlemi ekle</button>
      </div>
    );
  }

  return(
    <div>
      {!fxRates&&<div className="warn-card" style={{marginBottom:14}}>⚠ FX kuru yüklenemedi — TRY/EUR pozisyonlar doğru toplamayabilir. Topbardaki ↻ butonuyla güncelle.</div>}
      {/* Global varlık türü filtre chip bar */}
      {(()=>{
        const presentTypes = BLOCK_TYPES.filter(cfg => pos.some(p=>p.type===cfg.type));
        if (presentTypes.length <= 1) return null;
        const allSelected = activeTypes.length >= presentTypes.length;
        const toggleType = (type) => {
          setActiveTypes(prev => {
            if (prev.includes(type)) {
              const next = prev.filter(t=>t!==type);
              return next.length > 0 ? next : prev;
            }
            return [...prev, type];
          });
        };
        return (
          <div className="fbar" style={{marginBottom:16}}>
            <button className={"mtab"+(allSelected?" on":"")} onClick={()=>setActiveTypes(atAll)}>Tümü</button>
            {presentTypes.map(cfg=>(
              <button key={cfg.type} className={"mtab"+(activeTypes.includes(cfg.type)?" on":"")}
                onClick={()=>toggleType(cfg.type)}>
                <span style={{opacity:.7,display:"flex"}}>{cfg.icon(12)}</span>{cfg.label}
              </button>
            ))}
          </div>
        );
      })()}
      {/* ── Bölüm başlığı: Performans & Getiri ─────────────────── */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 4px 6px"}}>
        <span style={{fontFamily:"var(--font-display)",fontSize:13,color:"var(--text2)",letterSpacing:"0.04em",whiteSpace:"nowrap"}}>Performans &amp; Getiri</span>
        <div style={{flex:1,height:1,background:"var(--border)"}}/>
      </div>
      {/* ── Kart: Aylık Özet ─────────────────────────────────────── */}
      {(()=>{
        const months   = prevMonths(12);
        const mLabel   = monthLabel(selectedMonth);
        const metrics  = calcMonthlyMetrics({ ym: selectedMonth, pos, txs, prc, hist, snapshots, cnv });
        const { monthReturn, isApprox, totalMV, dividends, netInvested, bestPos, worstPos, ytd, benchmarks, allocation } = metrics;
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
                <div style={{fontFamily:"var(--font-numeric)",fontSize:15,fontWeight:700,marginTop:4,color:"var(--info)"}}>
                  {hide ? mask() : fmtAmt(totalMV)}
                </div>
              </div>
              <div style={{background:"var(--bg4)",borderRadius:10,padding:"10px 12px"}}>
                <div className="lbl">Aylık Getiri {isApprox&&<span style={{color:"var(--text3)"}}>~</span>}</div>
                <div style={{fontFamily:"var(--font-numeric)",fontSize:15,fontWeight:700,marginTop:4,
                             color:monthReturn==null?"var(--text3)":monthReturn>=0?"var(--ok)":"var(--err)"}}>
                  {monthReturn!=null ? fmtPct(monthReturn) : '—'}
                </div>
              </div>
              <div style={{background:"var(--bg4)",borderRadius:10,padding:"10px 12px"}}>
                <div className="lbl">YTD {ytd==null&&<span style={{fontSize:9,color:"var(--text3)"}}>snap. yok</span>}</div>
                <div style={{fontFamily:"var(--font-numeric)",fontSize:15,fontWeight:700,marginTop:4,
                             color:ytd==null?"var(--text3)":ytd>=0?"var(--ok)":"var(--err)"}}>
                  {ytd!=null ? fmtPct(ytd) : '—'}
                </div>
              </div>
              <div style={{background:"var(--bg4)",borderRadius:10,padding:"10px 12px"}}>
                <div className="lbl">Temettü</div>
                <div style={{fontFamily:"var(--font-numeric)",fontSize:15,fontWeight:700,marginTop:4,color:"var(--info)"}}>
                  {hide ? mask() : fmtAmt(dividends)}
                </div>
              </div>
            </div>

            {/* Benchmark */}
            <div className="lbl" style={{marginBottom:6}}>Karşılaştırma</div>
            {[
              {label:"Portföy", ret: monthReturn, approx: isApprox},
              {label:"SPY",     ret: benchmarks.spy},
              {label:"XU100",   ret: benchmarks.xu100},
            ].map(row=>(
              <div key={row.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                                          padding:"5px 0",borderTop:"1px solid var(--border)"}}>
                <span style={{fontSize:12,color:"var(--text2)",fontWeight:500}}>{row.label}</span>
                <span style={{fontFamily:"var(--font-numeric)",fontSize:12,fontWeight:700,
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
                      <div style={{fontFamily:"var(--font-numeric)",fontSize:13,fontWeight:700}}>{p.ticker}</div>
                      <div style={{fontFamily:"var(--font-numeric)",fontSize:12,fontWeight:600,color}}>{fmtPct(p.ret)}</div>
                    </>
                  ) : <div style={{fontSize:11,color:"var(--text3)"}}>—</div>}
                </div>
              ))}
            </div>

            {/* Net yatırım + dağılım */}
            <div style={{marginTop:12,display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--text2)"}}>
              <span>Net Yatırım</span>
              <span style={{fontFamily:"var(--font-numeric)",fontWeight:600,
                            color:netInvested>=0?"var(--ok)":"var(--err)"}}>
                {hide ? mask() : `${netInvested>=0?'+':''}${fmtAmt(Math.abs(netInvested))}`}
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
                  const txt = buildSummaryText({ metrics, monthLbl: mLabel, dSym });
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
                <div style={{fontFamily:"var(--font-numeric)",fontSize:28,fontWeight:700,
                             color:monthReturn==null?"var(--text3)":monthReturn>=0?"var(--ok)":"var(--err)"}}>
                  {isApprox?"~":""}{fmtPct(monthReturn)}
                </div>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>
                  Aylık Getiri · {hide?mask():fmtAmt(totalMV)} toplam değer
                </div>
              </div>
              {[
                {label:"YTD",    val: ytd!=null?fmtPct(ytd):"—",  color: ytd!=null?(ytd>=0?"var(--ok)":"var(--err)"):"var(--text3)"},
                {label:"vs SPY", val: benchmarks.spy!=null&&monthReturn!=null
                  ? `${(monthReturn-benchmarks.spy)>=0?'+':''}${(monthReturn-benchmarks.spy).toFixed(1)}%`
                  : "—",        color: benchmarks.spy!=null&&monthReturn!=null?(monthReturn>=benchmarks.spy?"var(--ok)":"var(--err)"):"var(--text3)"},
                {label:"En iyi", val: bestPos?`${bestPos.ticker} ${fmtPct(bestPos.ret)}`:"—", color:"var(--text)"},
                {label:"Temettü",val: hide?mask():fmtAmt(dividends), color:"var(--info)"},
              ].map(row=>(
                <div key={row.label} style={{display:"flex",justifyContent:"space-between",
                                            padding:"4px 0",fontSize:12}}>
                  <span style={{color:"var(--text3)"}}>{row.label}</span>
                  <span style={{color:row.color,fontFamily:"var(--font-numeric)",fontWeight:600}}>{row.val}</span>
                </div>
              ))}
              <div style={{marginTop:12,textAlign:"center",fontSize:10,color:"rgba(201,168,76,0.5)",letterSpacing:.5}}>
                Portfoi · canmrtr.github.io/Investment-Ledger
              </div>
            </div>
          </div>
        );
      })()}
      {/* ── Bölüm başlığı: Dağılım ──────────────────────────────── */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 4px 6px"}}>
        <span style={{fontFamily:"var(--font-display)",fontSize:13,color:"var(--text2)",letterSpacing:"0.04em",whiteSpace:"nowrap"}}>Dağılım</span>
        <div style={{flex:1,height:1,background:"var(--border)"}}/>
      </div>
      {/* Varlık dağılımı — stacked bar */}
      <div className="card" style={{marginBottom:16,padding:"14px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div className="stitle" style={{marginBottom:0}}>Varlık Dağılımı</div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div className="seg" style={{fontSize:11}}>
              <button className={assetDistMode==="cost"?"on":""} onClick={()=>setAssetDistMode("cost")}>Maliyet</button>
              <button className={assetDistMode==="mv"?"on":""} onClick={()=>setAssetDistMode("mv")}>Piyasa</button>
            </div>
            <button className="btn-xs" onClick={()=>setAssetPieOpen(o=>!o)}>{assetPieOpen?"▴":"▾"}</button>
          </div>
        </div>
        {slices.arr.length > 0 && (
          <div style={{height:12,borderRadius:6,overflow:"hidden",display:"flex",gap:1,marginTop:12}}>
            {slices.arr.map(s=>(
              <div key={s.key} style={{width:(s.frac*100)+"%",height:"100%",background:s.color}}
                data-tip={`${s.label}: ${(s.frac*100).toFixed(1)}%`}/>
            ))}
          </div>
        )}
        {assetPieOpen && (
          <div style={{marginTop:14}}>
            {slices.arr.length === 0 ? (
              <div className="empty" style={{padding:"20px 0"}}>Bu varlık türünde değerli pozisyon yok</div>
            ) : (()=>{
                const valFn=assetDistMode==="cost"?costDisp:mvDisp;
                return(<>
                {slices.arr.map(s=>{
                  const typePos=filteredPos.filter(p=>p.type===s.key).map(p=>({p,v:valFn(p)})).filter(r=>r.v>0).sort((a,b)=>b.v-a.v);
                  const isExpanded=expandedAssetType===s.key;
                  const toggleable=typePos.length>1;
                  return(
                  <React.Fragment key={s.key}>
                    <div className="pie-row" onClick={toggleable?()=>setExpandedAssetType(isExpanded?null:s.key):undefined} style={toggleable?{cursor:"pointer"}:{}}>
                      <span className="pie-sw" style={{background:s.color}}></span>
                      <span style={{flex:1,minWidth:0}}>{s.label}</span>
                      {toggleable&&<span style={{fontSize:9,color:"var(--text3)",marginRight:2}}>{isExpanded?"▾":"▸"}</span>}
                      <span className="dim" style={{textAlign:"right",fontSize:11,flex:"0 0 56px"}}>{(s.frac*100).toFixed(1)}%</span>
                    </div>
                    {isExpanded&&typePos.map(({p,v})=>(
                      <div key={p.ticker} className="pie-row" onClick={()=>openDetail(p.ticker)} style={{paddingLeft:20,cursor:"pointer",opacity:.85}}>
                        <span style={{width:6,height:6,borderRadius:"50%",background:s.color,flexShrink:0,marginRight:2}}></span>
                        <span style={{flex:1,minWidth:0,fontSize:11}}><span style={{fontFamily:"var(--font-numeric)",fontWeight:500}}>{p.ticker}</span><span style={{color:"var(--text3)",marginLeft:5,fontSize:10}}>{p.name}</span></span>
                        <span className="dim" style={{textAlign:"right",fontSize:11,flex:"0 0 56px"}}>{s.value>0?(v/s.value*100).toFixed(1):"—"}%</span>
                      </div>
                    ))}
                  </React.Fragment>
                  );
                })}
                <div className="pie-row" style={{borderTop:"0.5px solid var(--border)",marginTop:6,paddingTop:8,fontWeight:600}}>
                  <span className="pie-sw" style={{visibility:"hidden"}}></span>
                  <span style={{flex:1,minWidth:0}}>Toplam</span>
                  <span className="dim" style={{textAlign:"right",fontSize:11,flex:"0 0 56px"}}>100.0%</span>
                </div>
                </>);
              })()}
          </div>
        )}
      </div>

      {/* Bölge Dağılımı — stacked bar */}
      <div className="card" style={{marginBottom:16,padding:"14px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div className="stitle" style={{marginBottom:0}}>
            Bölge Dağılımı
            {etfCwBusy && <span style={{color:"var(--text3)",fontSize:11,marginLeft:6,fontWeight:400}}>Yükleniyor…</span>}
          </div>
          <button className="btn-xs" onClick={()=>setRegionPieOpen(o=>!o)}>{regionPieOpen?"▴":"▾"}</button>
        </div>
        {regionSlices.arr.length > 0 && (
          <div style={{height:12,borderRadius:6,overflow:"hidden",display:"flex",gap:1,marginTop:12}}>
            {regionSlices.arr.map(s=>(
              <div key={s.key} style={{width:(s.frac*100)+"%",height:"100%",background:s.color}}
                data-tip={`${s.label}: ${(s.frac*100).toFixed(1)}%`}/>
            ))}
          </div>
        )}
        {regionPieOpen && (
          <div style={{marginTop:14}}>
            {regionSlices.arr.length === 0 ? (
              <div className="empty" style={{padding:"20px 0"}}>Pozisyon yok</div>
            ) : (
              <>
                {regionSlices.arr.map(s=>(
                  <div key={s.key} className="pie-row">
                    <span className="pie-sw" style={{background:s.color}}></span>
                    <span style={{flex:1,minWidth:0}}>{s.label}</span>
                    <span className="dim" style={{textAlign:"right",fontSize:11,flex:"0 0 56px"}}>{(s.frac*100).toFixed(1)}%</span>
                  </div>
                ))}
                <div className="pie-row" style={{borderTop:"0.5px solid var(--border)",marginTop:6,paddingTop:8,fontWeight:600}}>
                  <span className="pie-sw" style={{visibility:"hidden"}}></span>
                  <span style={{flex:1,minWidth:0}}>Toplam</span>
                  <span className="dim" style={{textAlign:"right",fontSize:11,flex:"0 0 56px"}}>100.0%</span>
                </div>
                <div style={{fontSize:10,color:"var(--text3)",marginTop:10,lineHeight:1.5}}>
                  ETF/Fon pozisyonları için gerçek ülke dağılımı kullanılır (FMP, 90 gün cache). TEFAS/TRY fonlar ve bilinmeyen ETF'ler için US heuristiği geçerli.
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Bölüm başlığı: Fundamentals ─────────────────────────── */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 4px 6px"}}>
        <span style={{fontFamily:"var(--font-display)",fontSize:13,color:"var(--text2)",letterSpacing:"0.04em",whiteSpace:"nowrap"}}>Fundamentals</span>
        <div style={{flex:1,height:1,background:"var(--border)"}}/>
      </div>
      {/* Portföy Sağlık Tablosu — kapalı özet (3 rozet) + collapsible detay tablosu */}
      {healthEligible.length>0 && (() => {
        // Aggregate sayım: tüm healthFiltered ticker'ların 8 metrikinde good/neutral/bad toplam.
        let aggGood=0, aggWarn=0, aggBad=0;
        healthFiltered.forEach(p => {
          const m = fundCache[p.ticker]?.metrics;
          if(!m) return;
          HEALTH_METRICS.forEach(([key]) => {
            const s = fundScore(key, m[key]);
            if(s==="good") aggGood++;
            else if(s==="neutral") aggWarn++;
            else if(s==="bad") aggBad++;
          });
        });
        return(
        <div className="card" data-card="health" style={{marginBottom:16,padding:"14px 16px"}}>
          {/* Üst bar: başlık + 3 rozet + Detay toggle */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <div className="stitle" style={{marginBottom:0}}>Portföy Sağlık Tablosu</div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span className="hp hp-ok" data-tip="Eşiği geçen (iyi) metrik sayısı">🟢 {aggGood}</span>
              <span className="hp hp-warn" data-tip="Orta seviye metrik sayısı">🟡 {aggWarn}</span>
              <span className="hp hp-err" data-tip="Eşiğin altında kalan (zayıf) metrik sayısı">🔴 {aggBad}</span>
              <button className="btn-xs" onClick={()=>setHealthOpen(o=>!o)} style={{fontSize:11}}>
                {healthOpen?"Detay ▴":"Detay ▾"}
              </button>
            </div>
          </div>

          {/* Portföy F/K KPI — her zaman görünür (healthOpen'dan bağımsız) */}
          {(()=>{
            let weightedSum=0, weightTotal=0, included=0, missing=0;
            healthFiltered.forEach(p => {
              const pe = fundCache[p.ticker]?.metrics?.pe;
              const mv = mvDisp(p);
              if (pe != null && pe > 0 && mv > 0) { weightedSum += pe * mv; weightTotal += mv; included++; }
              else missing++;
            });
            const portfolioPE = weightTotal > 0 ? weightedSum / weightTotal : null;
            if (portfolioPE == null) return null;
            const sp500ref = 22;
            const below = portfolioPE < sp500ref;
            return (
              <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10,flexWrap:"wrap"}}>
                <span style={{fontSize:11,color:"var(--text2)"}}>Portföy F/K</span>
                <span className="mono" style={{fontSize:18,fontWeight:600}}>{portfolioPE.toFixed(1)}x</span>
                <span className={"hp "+(below?"hp-ok":"hp-warn")} style={{fontSize:11}}>
                  {below ? `S&P 500 (${sp500ref}x) altında` : `S&P 500 (${sp500ref}x) üstünde`}
                </span>
                <span style={{fontSize:10,color:"var(--text3)"}}>{included} pozisyon dahil{missing>0?`, ${missing} veri yok`:""}</span>
              </div>
            );
          })()}

          {/* Portföy seviyesi sonuç cümleleri — her zaman görünür */}
          {(()=>{
            // Ağırlıklı ortalama hesapla: her pozisyon için piyasa değeri ağırlığı
            const metricKeys = [
              { key:"liabToEquity",     label:"Borçlanma seviyesi",  good:"sağlıklı",   warn:"orta",        bad:"yüksek",      threshGood:0.80,  threshOk:2.00,  dir:"low",  unit:"x",   thresh:"eşik 0.80x" },
              { key:"netMargin",        label:"Kârlılık",            good:"güçlü",      warn:"orta",        bad:"zayıf",       threshGood:0.10,  threshOk:0.05,  dir:"high", unit:"pct", thresh:"eşik %10"   },
              { key:"revenueGrowth5Y",  label:"Gelir büyümesi",      good:"güçlü",      warn:"ılımlı",      bad:"yavaş",       threshGood:0.10,  threshOk:0.05,  dir:"high", unit:"pct", thresh:"eşik %10"   },
              { key:"roe",              label:"Özkaynak verimliliği", good:"yüksek",     warn:"orta",        bad:"düşük",       threshGood:0.15,  threshOk:0.08,  dir:"high", unit:"pct", thresh:"eşik %15"   },
              { key:"operatingMargin",  label:"Operasyonel kârlılık", good:"güçlü",      warn:"orta",        bad:"zayıf",       threshGood:0.15,  threshOk:0.08,  dir:"high", unit:"pct", thresh:"eşik %15"   },
              { key:"netDebtToFcf",     label:"Borç/Nakit akışı",    good:"kontrollü",  warn:"izlenmeli",   bad:"yüksek",      threshGood:2.00,  threshOk:5.00,  dir:"low",  unit:"x",   thresh:"eşik 2.0x"  },
            ];
            const sentences = metricKeys.map(mk => {
              let wSum=0, wTotal=0, count=0;
              healthFiltered.forEach(p => {
                const v = fundCache[p.ticker]?.metrics?.[mk.key];
                const mv = mvDisp(p);
                if (v != null && isFinite(v) && mv > 0) {
                  // netDebtToFcf negatif = net cash → 0 olarak say (çok iyi)
                  const adjV = (mk.key === "netDebtToFcf" && v < 0) ? 0 : v;
                  wSum += adjV * mv;
                  wTotal += mv;
                  count++;
                }
              });
              if (count === 0 || wTotal === 0) return null;
              const avg = wSum / wTotal;
              // Skor belirle
              let signal;
              if (mk.key === "netDebtToFcf" && avg <= 0) {
                signal = "good";
              } else if (mk.dir === "high") {
                signal = avg >= mk.threshGood ? "good" : avg >= mk.threshOk ? "neutral" : "bad";
              } else {
                signal = avg <= mk.threshGood ? "good" : avg <= mk.threshOk ? "neutral" : "bad";
              }
              const adj = signal === "good" ? mk.good : signal === "neutral" ? mk.warn : mk.bad;
              const icon = signal === "good" ? "🟢" : signal === "neutral" ? "🟡" : "🔴";
              // Tooltip: ham değer + eşik
              const rawStr = mk.unit === "pct" ? `%${(avg*100).toFixed(1)}` : `${avg.toFixed(2)}x`;
              const tip = `Ağırlıklı ort. ${mk.label.toLowerCase()}: ${rawStr} — ${mk.thresh}`;
              return { icon, label: mk.label, adj, tip, signal };
            }).filter(Boolean);
            if (sentences.length === 0) return null;
            return (
              <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:6}}>
                {sentences.map((s, i) => (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--text2)"}}
                    data-tip={s.tip}>
                    <span style={{fontSize:13}}>{s.icon}</span>
                    <span><strong style={{color:"var(--text)",fontWeight:500}}>{s.label}</strong>
                      {" "}<span style={{color: s.signal==="good"?"var(--ok)":s.signal==="neutral"?"var(--warn)":"var(--err)"}}>{s.adj}</span>
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Filter chips + Eksikleri Çek CTA — sadece detay açıkken */}
          {healthOpen && (() => {
            const types=["all"];
            if(healthEligible.some(p=>p.type==="US_STOCK"))types.push("US_STOCK");
            if(healthEligible.some(p=>p.type==="BIST"))types.push("BIST");
            if(types.length<=2)return null;
            return(
              <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
                {types.map(t=>(
                  <button key={t} className={"mtab sm"+(healthFilter===t?" on":"")}
                    onClick={()=>setHealthFilter(t)}>
                    {t==="all"?"Hepsi":TYPE_LABEL_SHORT[t]||t}
                  </button>
                ))}
              </div>
            );
          })()}

          {healthOpen && healthEligible.length>0 && (
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"8px 10px",background:"var(--bg3)",borderRadius:8,marginTop:10,flexWrap:"wrap"}}>
              <span style={{fontSize:11,color:"var(--text2)"}}>
                {fundBusy
                  ? <><span className="spin" style={{width:11,height:11,marginRight:6,verticalAlign:"middle"}}></span>Çekiliyor: {fundProg}</>
                  : healthMissing.length>0
                    ? `${healthMissing.length} pozisyonun fundamental verisi henüz çekilmemiş.`
                    : `Veriler güncel${fundFreshLabel?` · son ${fundFreshLabel}`:""}`}
              </span>
              {!fundBusy && (
                <button className={healthMissing.length>0?"pri btn-xs":"btn-xs"} onClick={()=>fetchAllFund(healthMissing.length===0&&resilienceMissing.length===0)}>
                  {healthMissing.length>0?"Eksikleri Çek":"Yenile"}
                </button>
              )}
            </div>
          )}

          {/* Tablo: sticky ticker + 8 metrik + skor — sadece healthOpen iken */}
          {healthOpen && (() => {
            const rows = healthFiltered.map(p => {
              const fund = fundCache[p.ticker];
              const m = fund?.metrics || null;
              const sc = rowScore(m);
              return {p, m, sc, hasData: !!m};
            }).sort((a,b) => {
              if(a.hasData !== b.hasData) return a.hasData ? -1 : 1;
              if(!a.hasData) return a.p.ticker.localeCompare(b.p.ticker);
              const aPct = a.sc.total>0 ? a.sc.good/a.sc.total : 1;
              const bPct = b.sc.total>0 ? b.sc.good/b.sc.total : 1;
              return aPct - bPct;
            });
            return(
              <div className="tbl-wrap health-wrap">
                <table className="health-tbl">
                  <thead><tr>
                    <th scope="col" className="l health-sticky">Ticker</th>
                    {HEALTH_METRICS.map(([k,lbl])=>(
                      <th key={k} scope="col" className="r" data-tip={fundThreshText(k, HEALTH_METRICS.find(x=>x[0]===k)[2])}>{lbl}</th>
                    ))}
                    <th scope="col" className="r" data-tip="Yeşil sayım / değerli metrik sayımı">Skor</th>
                  </tr></thead>
                  <tbody>
                    {rows.map(({p,m,sc,hasData}) => (
                      <tr key={p.ticker} className="pos-row" onClick={()=>openDetail(p.ticker,p.type,"analysis")}>
                        <td className="l health-sticky">
                          <span className="tsym">{p.ticker}</span>
                          {p.type==="BIST"&&<span style={{fontSize:9,color:"var(--text3)",marginLeft:5}}>BIST</span>}
                        </td>
                        {hasData ? HEALTH_METRICS.map(([k,lbl,type])=>{
                          const v=m[k];
                          const s=fundScore(k,v);
                          const cls = s==="good"?"hp-ok":s==="neutral"?"hp-warn":s==="bad"?"hp-err":"hp-na";
                          return(
                            <td key={k} className="r"><span className={"hp "+cls}>{fmtFundVal(v,type)}</span></td>
                          );
                        }) : HEALTH_METRICS.map(([k])=>(
                          <td key={k} className="r dim" style={{fontSize:11}}>—</td>
                        ))}
                        <td className="r">
                          {hasData
                            ? <span className="hp" style={{background:"var(--bg4)",color:sc.good/sc.total>=0.66?"var(--ok)":sc.good/sc.total>=0.4?"var(--warn)":"var(--err)",fontWeight:600}}>{sc.good}/{sc.total}</span>
                            : <span className="dim" style={{fontSize:11}}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {healthOpen && (
            <div style={{fontSize:10,color:"var(--text3)",marginTop:8,lineHeight:1.5}}>
              Her metrik için eşikler kolon başlığında hover ile görünür. BIST için F/S henüz yok (—). TR enflasyon nominal CAGR'ı şişiriyor — BIST büyüme metriklerine ihtiyatla bak.
            </div>
          )}
        </div>
      );})()}

      {/* Toplam Komisyon — display cur'a convert edilmiş tek tutar */}
      <div className="card" style={{marginBottom:16,padding:"14px 16px"}}>
        {/* Üst bar: başlık + KPI sağda + Detay toggle (commData.total>0 ise) */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div className="stitle" style={{marginBottom:0}}>Toplam Komisyon</div>
          {commData.total>0 && (
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end"}}>
                <span className="mono" style={{fontSize:18,fontWeight:600}}>{mask(dSym+fmt(commData.total,2))}</span>
                {slices.total>0 && (
                  <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>
                    portföy değerinin %{fmt((commData.total/slices.total)*100,1)}'i
                  </div>
                )}
              </div>
              <button className="btn-xs" onClick={()=>setCommOpen(o=>!o)} style={{fontSize:11}}>
                {commOpen?"Detay ▴":"Detay ▾"}
              </button>
            </div>
          )}
        </div>
        {commData.total === 0 && (
          <div className="empty" style={{padding:"40px 0"}}>Henüz komisyon kaydı yok</div>
        )}
        {commData.total > 0 && commOpen && (
          <div style={{marginTop:14}}>
            {/* Broker breakdown */}
            <div className="stitle" style={{marginBottom:8}}>Broker Bazında</div>
            <div style={{marginBottom:18}}>
              {commData.brokerList.map(({broker,sum}) => {
                const pct = (sum / commData.brokerList[0].sum) * 100;
                return (
                  <div key={broker} style={{display:"flex",alignItems:"center",gap:10,padding:"5px 0"}}>
                    <span style={{flex:"0 0 110px",fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{broker}</span>
                    <div style={{flex:1,height:6,background:"var(--bg3)",borderRadius:3,overflow:"hidden"}}>
                      <div style={{width:pct+"%",height:"100%",background:"var(--info)"}}/>
                    </div>
                    <span className="mono" style={{flex:"0 0 auto",textAlign:"right",fontSize:11,color:"var(--text2)"}}>
                      {mask(dSym+fmt(sum,2))}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Year breakdown */}
            <div className="stitle" style={{marginBottom:8}}>Yıl Bazında</div>
            <div>
              {(() => {
                const maxYearSum = Math.max(...commData.yearList.map(y=>y.sum));
                return commData.yearList.map(({year,sum}) => {
                  const pct = (sum / maxYearSum) * 100;
                  return (
                    <div key={year} style={{display:"flex",alignItems:"center",gap:10,padding:"5px 0"}}>
                      <span style={{flex:"0 0 50px",fontFamily:"var(--font-numeric)",fontSize:12}}>{year}</span>
                      <div style={{flex:1,height:6,background:"var(--bg3)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{width:pct+"%",height:"100%",background:"var(--info)",opacity:.6}}/>
                      </div>
                      <span className="mono" style={{flex:"0 0 auto",textAlign:"right",fontSize:11,color:"var(--text2)"}}>
                        {mask(dSym+fmt(sum,2))}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Kazanan/Kaybeden Trade — BUY ve SELL bağımsız, split-adjusted */}
      <div className="card" style={{marginBottom:16,padding:"14px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14}}>
          <div className="stitle" style={{marginBottom:0}}>Kazanan / Kaybeden İşlem</div>
          <span style={{fontSize:10,color:"var(--text3)"}}>güncel fiyatla kıyas · split-adjusted</span>
        </div>
        {(() => {
          const renderBar = (label, data, helpText) => {
            const total = data.win + data.loss;
            if (total === 0 && data.noPrice === 0) {
              return (
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:12,marginBottom:6}}>{label}</div>
                  <div className="empty" style={{padding:"12px 0",fontSize:11}}>İşlem yok</div>
                </div>
              );
            }
            if (total === 0) {
              return (
                <div style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                    <span>{label}</span>
                    <span className="dim">{data.noPrice} işlem fiyat eksik</span>
                  </div>
                  <div className="empty" style={{padding:"8px 0",fontSize:11}}>Tüm işlemlerin güncel fiyatı eksik (ticker artık takipte değil)</div>
                </div>
              );
            }
            const winPct = (data.win / total) * 100;
            return (
              <div style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                  <span>{label}</span>
                  <span className="mono"><span style={{color:"var(--ok)"}}>{data.win}</span> / <span style={{color:"var(--err)"}}>{data.loss}</span> · <strong>%{winPct.toFixed(0)}</strong></span>
                </div>
                <div style={{height:10,background:"var(--bg3)",borderRadius:5,overflow:"hidden",display:"flex"}} data-tip={helpText}>
                  <div style={{width:winPct+"%",background:"var(--ok)",transition:"width .2s"}}/>
                  <div style={{flex:1,background:"var(--err)"}}/>
                </div>
                {data.noPrice > 0 && (
                  <div style={{fontSize:10,color:"var(--text3)",marginTop:4}}>
                    {data.noPrice} işlem fiyat eksik (sayım dışı — ticker fiyat cache'inde yok)
                  </div>
                )}
              </div>
            );
          };
          return (
            <div>
              {renderBar("Alış kararları", winLoss.buy, "Aldıktan sonra fiyat yükseldi mi? Win = current > buy.")}
              {renderBar("Satış kararları", winLoss.sell, "Sattıktan sonra fiyat düştü mü? Win = current < sell (iyi exit).")}
            </div>
          );
        })()}
      </div>

      {/* ── Bölüm başlığı: Risk Değerlendirmesi ─────────────────── */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 4px 6px"}}>
        <span style={{fontFamily:"var(--font-display)",fontSize:13,color:"var(--text2)",letterSpacing:"0.04em",whiteSpace:"nowrap"}}>Risk Değerlendirmesi</span>
        <div style={{flex:1,height:1,background:"var(--border)"}}/>
      </div>
      {/* Konsantrasyon Risk Göstergesi — top3 ağırlık + HHI */}
      <div className="card" style={{marginBottom:16,padding:"14px 16px"}}>
        <div className="stitle" style={{marginBottom:12}}>Konsantrasyon Riski</div>
        {(()=>{
          const posWithMv=filteredPos.filter(p=>p.type!=="CASH"&&p.type!=="DEPOSIT").map(p=>({...p,dispMv:mvDisp(p)})).filter(p=>p.dispMv>0);
          const total=posWithMv.reduce((a,p)=>a+p.dispMv,0);
          if(total<=0||posWithMv.length===0)return <div className="empty" style={{padding:"12px 0",fontSize:11}}>Yeterli pozisyon yok</div>;
          const sorted=[...posWithMv].sort((a,b)=>b.dispMv-a.dispMv);
          const weights=sorted.map(p=>({...p,w:p.dispMv/total}));
          const fundWeights=weights.filter(p=>p.type==="FUND");
          const stockWeights=weights.filter(p=>p.type!=="FUND");
          const top3wStocks=stockWeights.slice(0,3).reduce((a,p)=>a+p.w,0)*100;
          const top3wAll=weights.slice(0,3).reduce((a,p)=>a+p.w,0)*100;
          const hhi=Math.round(weights.reduce((a,p)=>a+(p.w*100)*(p.w*100),0));
          const level=top3wStocks>60?"Yüksek":top3wStocks>40?"Orta":"Düşük";
          const color=top3wStocks>60?"var(--err)":top3wStocks>40?"var(--warn)":"var(--ok)";
          const fundMvPct=fundWeights.reduce((a,p)=>a+p.w,0)*100;
          return(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <div>
                  <div className="mono" style={{fontSize:22,fontWeight:700,color}}>{mask(fmt(top3wStocks,1)+"%")}</div>
                  <div style={{fontSize:10,color:"var(--text3)",marginTop:1}} data-tip="Hisse, Kripto ve Emtia pozisyonları dahil. ETF/Fon pozisyonları iç çeşitlilik sağladığından ayrı gösterilmiştir.">İlk 3 pozisyon ağırlığı</div>
                  {fundWeights.length>0&&<div style={{fontSize:10,color:"var(--text3)",marginTop:2}}>ETF dahil: {fmt(top3wAll,1)}%</div>}
                </div>
                <span style={{fontSize:12,padding:"3px 10px",borderRadius:12,background:color+"22",color,fontWeight:600}}>{level}</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {weights.slice(0,3).map((p,i)=>{
                  const isFund=p.type==="FUND";
                  return(
                    <div key={p.ticker} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>openDetail(p.ticker,p.type,"analysis")}>
                      <span style={{color:"var(--text3)",fontSize:11,minWidth:14}}>{i+1}.</span>
                      <div style={{display:"flex",alignItems:"center",gap:4,minWidth:60}}>
                        <span className="mono" style={{fontSize:13,fontWeight:600}}>{p.ticker}</span>
                        {isFund&&<span className="badge etf" style={{fontSize:9}}>ETF</span>}
                      </div>
                      <div style={{flex:1,height:6,background:"var(--bg3)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{width:(p.w*100)+"%",height:"100%",background:isFund?"var(--info)":color,borderRadius:3,opacity:isFund?0.5:1}}/>
                      </div>
                      <span className="mono" style={{fontSize:12,color:"var(--text2)",minWidth:40,textAlign:"right"}}>{fmt(p.w*100,1)}%</span>
                    </div>
                  );
                })}
              </div>
              <div style={{marginTop:10,fontSize:11,color:"var(--text3)"}}>
                Portföyünün <span style={{fontWeight:600,color}}>{fmt(top3wStocks,1)}%'si</span> ilk 3 hisse/kripto/emtia pozisyonuna yoğunlaşmış.
                {stockWeights.length>3&&` Geri kalan ${stockWeights.length-3} pozisyon riski dağıtıyor.`}
              </div>
              {fundWeights.length>0&&(
                <div style={{marginTop:6,fontSize:10,color:"var(--text3)",borderTop:"1px solid var(--border)",paddingTop:6}}>
                  {fundWeights.length} ETF/Fon pozisyonu ({mask(fmt(fundMvPct,1)+"%")}) iç çeşitlilik nedeniyle ayrı tutulmuştur.
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Break-Even Analizi */}
      <div className="card" style={{marginBottom:16,padding:"14px 16px"}}>
        <div className="stitle" style={{marginBottom:12}} data-tip="Komisyon dahil alış maliyetini karşılamak için gereken minimum satış fiyatı.">Başa Baş Analizi</div>
        {(()=>{
          const beRows = filteredPos
            .filter(p => p.shares > CFG.DUST_THRESHOLD)
            .map(p => {
              const buyTxs = filteredTxs.filter(t => t.ticker === p.ticker && t.way === "BUY");
              const totalComm = buyTxs.reduce((a, t) => a + (t.commission || 0), 0);
              const breakEven = p.shares > 0 ? (p.shares * p.avgCost + totalComm) / p.shares : null;
              const curPrice = prc[p.ticker];
              const distPct = (breakEven != null && breakEven > 0 && curPrice != null)
                ? ((curPrice - breakEven) / breakEven) * 100
                : null;
              return { ...p, breakEven, curPrice, distPct, sym: displaySym(p.currency) };
            });

          const sorted = [...beRows].sort((a, b) => {
            if (a.distPct == null && b.distPct == null) return 0;
            if (a.distPct == null) return 1;
            if (b.distPct == null) return -1;
            return b.distPct - a.distPct;
          });

          if (sorted.length === 0) return <div className="empty" style={{padding:"12px 0",fontSize:11}}>Açık pozisyon yok</div>;

          const aboveBE = sorted.filter(r => r.distPct != null && r.distPct > 0).length;
          const belowBE = sorted.filter(r => r.distPct != null && r.distPct <= 0).length;

          return (
            <div>
              {(aboveBE > 0 || belowBE > 0) && (
                <div style={{fontSize:12, color:"var(--text2)", marginBottom:10}}>
                  <span style={{color:"var(--ok)", fontWeight:600}}>{aboveBE} pozisyon</span>
                  {" "}kâr bölgesinde
                  {belowBE > 0 && (
                    <span style={{color:"var(--text3)"}}>{" · "}<span style={{color:"var(--warn)", fontWeight:600}}>{belowBE} pozisyon</span>{" "}henüz başa baş noktasının altında</span>
                  )}
                </div>
              )}
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr>
                      <th scope="col" style={{textAlign:"left",paddingBottom:8,color:"var(--text3)",fontWeight:500,paddingRight:8}}>Ticker</th>
                      <th scope="col" style={{textAlign:"right",paddingBottom:8,color:"var(--text3)",fontWeight:500,paddingRight:8}}>Başa Baş</th>
                      <th scope="col" style={{textAlign:"right",paddingBottom:8,color:"var(--text3)",fontWeight:500,paddingRight:8}}>Güncel</th>
                      <th scope="col" style={{textAlign:"right",paddingBottom:8,color:"var(--text3)",fontWeight:500}}>Uzaklık</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(r => (
                      <tr key={r.ticker} className="pos-row" onClick={() => openDetail(r.ticker, r.type, "analysis")}
                        style={{cursor:"pointer"}}>
                        <td style={{padding:"5px 8px 5px 0",fontWeight:600,fontFamily:"var(--font-numeric)"}}>
                          {r.ticker}
                        </td>
                        <td style={{padding:"5px 8px 5px 0",textAlign:"right",fontFamily:"var(--font-numeric)"}}>
                          {r.breakEven != null ? mask(r.sym + fmt(r.breakEven, 2)) : <span className="dim">—</span>}
                        </td>
                        <td style={{padding:"5px 8px 5px 0",textAlign:"right",fontFamily:"var(--font-numeric)"}}>
                          {r.curPrice != null
                            ? mask(r.sym + fmt(r.curPrice, 2))
                            : <span style={{fontSize:10,color:"var(--text3)"}}>Fiyat yok</span>}
                        </td>
                        <td style={{padding:"5px 0 5px 0",textAlign:"right",fontFamily:"var(--font-numeric)"}}>
                          {r.distPct != null
                            ? <span className={r.distPct > 0 ? "ok" : "err"} style={{fontWeight:600}}>
                                {fmtP(r.distPct)}
                              </span>
                            : <span className="dim">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{fontSize:10,color:"var(--text3)",marginTop:8}}>Komisyon dahil alış maliyeti bazlı.</div>
            </div>
          );
        })()}
      </div>

      {/* Max Pain Simülasyonu */}
      <div className="card" style={{marginBottom:16,padding:"14px 16px"}}>
        <div className="stitle" style={{marginBottom:12}}>Potansiyel Kayıp Simülasyonu</div>
        {(()=>{
          const totalMV = filteredPos.reduce((a, p) => a + mvDisp(p), 0);
          const hasFx = fxRates && fxRates.USDTRY > 0;
          const needsFx = filteredPos.some(p => {
            const priceCur = p.type === "BIST" ? "TRY" : "USD";
            return priceCur !== displayCur;
          });
          if (totalMV <= 0 || (needsFx && !hasFx)) {
            return (
              <div className="warn-card">
                <div className="wc-ttl">Veri eksik</div>
                <div className="wc-sub">Güncel fiyatlar veya FX kuru eksik — simülasyon hesaplanamıyor.</div>
              </div>
            );
          }
          const scenarios = [
            { pct: 0.10, label: "Piyasa −%10", color: "var(--warn)" },
            { pct: 0.20, label: "Piyasa −%20", color: "#ff6b35" },
            { pct: 0.30, label: "Piyasa −%30", color: "var(--err)" },
          ];
          const losses = scenarios.map(s => ({ ...s, loss: totalMV * s.pct }));
          const maxLoss = losses[losses.length - 1].loss;
          return (
            <div>
              <div style={{fontSize:11,color:"var(--text3)",marginBottom:14}}>
                Güncel Değer: <span className="mono" style={{color:"var(--text2)"}}>{mask(dSym + fmt(totalMV, 0))}</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {losses.map(s => (
                  <div key={s.label}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                      <span style={{fontSize:12,color:"var(--text2)",fontWeight:500}}>{s.label}</span>
                      <span className="mono err" style={{fontSize:13,fontWeight:700}}>
                        {mask("−" + dSym + fmt(s.loss, 0))}
                      </span>
                    </div>
                    <div style={{height:8,background:"var(--bg3)",borderRadius:4,overflow:"hidden"}}>
                      <div style={{
                        width: maxLoss > 0 ? ((s.loss / maxLoss) * 100) + "%" : "0%",
                        height:"100%",
                        background: s.color,
                        borderRadius:4,
                        transition:"width 0.4s ease"
                      }}/>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:10,color:"var(--text3)",marginTop:12}}>
                Fiyatlar eş anlı düşer varsayımı; kur etkisi dahil değil.
              </div>
            </div>
          );
        })()}
      </div>

      {/* Sektör Dağılımı — meta cache'ten sic_description (US) / industry (BIST) */}
      {(()=>{
        // sectorMetaTick'e bağımlı olduğu için her meta fetch sonrası yeniden hesaplar
        void sectorMetaTick;
        // Her pozisyon için sektör etiketi: US → sic_description, BIST → industry, tip bazlı fallback
        const posWithSector = filteredPos.map(p => {
          const m = metaCacheGet(p.ticker);
          const metaSector = m && (m.sic_description || m.industry);
          let sector;
          if (metaSector) sector = metaSector;
          else if (p.type === "CRYPTO") sector = "Kripto";
          else if (p.type === "GOLD") sector = "Emtia";
          else if (p.type === "FX") sector = "Döviz";
          else if (p.type === "FUND") sector = "ETF / Fon";
          else sector = "Bilinmiyor";
          return {...p, sector, dispMv: mvDisp(p)};
        }).filter(p => p.dispMv > 0);

        const total = posWithSector.reduce((a,p)=>a+p.dispMv, 0);

        // Sektör bazında gruplama
        const bySector = {};
        posWithSector.forEach(p => {
          bySector[p.sector] = (bySector[p.sector] || 0) + p.dispMv;
        });

        // "Bilinmiyor" slice en sona, geri kalanlar desc sıralı
        const known = Object.entries(bySector)
          .filter(([k])=>k!=="Bilinmiyor")
          .sort((a,b)=>b[1]-a[1]);
        const unknownVal = bySector["Bilinmiyor"] || 0;
        const sortedEntries = unknownVal > 0 ? [...known, ["Bilinmiyor", unknownVal]] : known;

        // Renk ata: bilinen sektörler → SECTOR_COLORS döngülü, Bilinmiyor → gri
        const colorMap = {};
        let colorIdx = 0;
        sortedEntries.forEach(([k])=>{
          if (k === "Bilinmiyor") colorMap[k] = SECTOR_UNKNOWN_COLOR;
          else { colorMap[k] = SECTOR_COLORS[colorIdx % SECTOR_COLORS.length]; colorIdx++; }
        });

        const sliceArr = sortedEntries.map(([sector, value]) => ({
          key: sector,
          label: sector,
          value,
          color: colorMap[sector],
          frac: total > 0 ? value / total : 0,
        }));

        // Pozisyonlar arasından meta eksik olanları bul (US_STOCK + BIST için anlamlı)
        const metaMissingPos = filteredPos.filter(p => {
          if (p.type !== "US_STOCK" && p.type !== "BIST" && p.type !== "FUND") return false;
          const m = metaCacheGet(p.ticker);
          return !(m && (m.sic_description || m.industry));
        });

        const fetchMissingMeta = async () => {
          if (metaMissingPos.length === 0 || sectorMetaBusy) return;
          setSectorMetaBusy(true);
          for (let i = 0; i < metaMissingPos.length; i++) {
            const p = metaMissingPos[i];
            try {
              const r = await edgePriceCall({ticker: p.ticker, mode: "meta", asset_type: p.type});
              const d = await r.json();
              if (r.ok && d && typeof d === "object") {
                metaCacheSet(p.ticker, d);
              }
            } catch(e) { DEBUG && console.warn("[sector meta]", p.ticker, e); }
            if (i < metaMissingPos.length - 1) await new Promise(res=>setTimeout(res,600));
          }
          setSectorMetaBusy(false);
          setSectorMetaTick(t=>t+1);
        };

        return (
          <div className="card" style={{marginBottom:16,padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div className="stitle" style={{marginBottom:0}}>Sektör Dağılımı</div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {metaMissingPos.length > 0 && (
                  sectorMetaBusy
                    ? <span style={{fontSize:11,color:"var(--text2)",display:"flex",alignItems:"center",gap:5}}>
                        <span className="spin" style={{width:11,height:11}}></span>
                      </span>
                    : <button className="pri btn-xs" onClick={fetchMissingMeta}
                        data-tip={`${metaMissingPos.length} pozisyon için sektör verisi eksik`}>
                        Meta Çek
                      </button>
                )}
                <button className="btn-xs" onClick={()=>setSectorPieOpen(o=>!o)}>{sectorPieOpen?"▴":"▾"}</button>
              </div>
            </div>

            {sliceArr.length > 0 && (
              <div style={{height:12,borderRadius:6,overflow:"hidden",display:"flex",gap:1,marginTop:12}}>
                {sliceArr.map(s=>(
                  <div key={s.key} style={{width:(s.frac*100)+"%",height:"100%",background:s.color}}
                    data-tip={`${s.label}: ${(s.frac*100).toFixed(1)}%`}/>
                ))}
              </div>
            )}

            {sectorPieOpen && (
              <div style={{marginTop:14}}>
                {sliceArr.length === 0 ? (
                  <div className="empty" style={{padding:"20px 0"}}>Pozisyon yok</div>
                ) : (
                  <>
                    {sliceArr.map(s=>(
                      <div key={s.key} className="pie-row">
                        <span className="pie-sw" style={{background:s.color}}></span>
                        <span style={{flex:1,minWidth:0}}>{s.label}</span>
                        <span className="dim" style={{textAlign:"right",fontSize:11,flex:"0 0 56px"}}>{(s.frac*100).toFixed(1)}%</span>
                      </div>
                    ))}
                    <div className="pie-row" style={{borderTop:"0.5px solid var(--border)",marginTop:6,paddingTop:8,fontWeight:600}}>
                      <span className="pie-sw" style={{visibility:"hidden"}}></span>
                      <span style={{flex:1,minWidth:0}}>Toplam</span>
                      <span className="dim" style={{textAlign:"right",fontSize:11,flex:"0 0 56px"}}>100.0%</span>
                    </div>
                    <div style={{fontSize:10,color:"var(--text3)",marginTop:8,lineHeight:1.5}}>
                      Kaynak: US hisseler → SIC açıklaması, BIST → sektör (borsa-mcp). Cache 7 gün.
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Kart: Dönem Bazlı Getiri ─────────────────────────────── */}
      {(()=>{
        const PERIODS = [
          { key:"d1",  label:"1G",  fn:(h,p,pr)=>h?.d1 },
          { key:"w1",  label:"1H",  fn:(h,p,pr)=>h?.w1 },
          { key:"m1",  label:"1A",  fn:(h,p,pr)=>h?.m1 },
          { key:"m3",  label:"3A",  fn:(h,p,pr)=>h?.p_m3&&pr?(pr-h.p_m3)/h.p_m3*100:null },
          { key:"m6",  label:"6A",  fn:(h,p,pr)=>h?.p_m6&&pr?(pr-h.p_m6)/h.p_m6*100:null },
          { key:"y1",  label:"1Y",  fn:(h,p,pr)=>h?.y1 },
        ];
        const priceCurOf = p => p.type==="BIST" ? "TRY" : (p.currency==="EUR" ? "EUR" : "USD");
        const posMV = filteredPos.map(p=>{
          const pr = prc[p.ticker];
          const mv = pr!=null ? cnv(p.shares*pr, priceCurOf(p)) : null;
          return {...p, pr, mv};
        }).filter(p=>p.mv!=null&&p.mv>0);
        const totalMV = posMV.reduce((a,p)=>a+p.mv,0);
        const portfolioReturns = PERIODS.map(pd=>{
          const eligible = posMV.filter(p=>pd.fn(hist[p.ticker],p,p.pr)!=null);
          if(!eligible.length) return {...pd, ret:null};
          const weightedMV = eligible.reduce((a,p)=>a+p.mv,0);
          const ret = eligible.reduce((a,p)=>{
            return a+(pd.fn(hist[p.ticker],p,p.pr)/100)*(p.mv/weightedMV);
          },0)*100;
          return {...pd, ret};
        });
        const benchRet = (ticker,pd)=>{
          const h = hist[ticker];
          const pr = prc[ticker];
          return pd.fn(h,null,pr);
        };
        const fmtRet = r => r==null
          ? React.createElement("span",{className:"dim",style:{color:"var(--text3)"}},"—")
          : React.createElement("span",{
              className: r>=0?"ok":"err",
              style:{fontFamily:"var(--font-numeric)",fontSize:12,fontWeight:600}
            },(r>=0?"+":"")+r.toFixed(2)+"%");
        return (
          <div className="card" style={{marginBottom:14,padding:"16px 18px"}}>
            <div className="stitle" style={{marginBottom:4}}>Dönem Bazlı Getiri</div>
            <div style={{fontSize:11,color:"var(--text3)",marginBottom:14}}>Portföy vs Karşılaştırma (ağırlıklı ortalama)</div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  <th scope="col" style={{textAlign:"left",paddingBottom:8,color:"var(--text3)",fontWeight:500,fontSize:11}}>Dönem</th>
                  <th scope="col" style={{textAlign:"right",paddingBottom:8,color:"var(--text3)",fontWeight:500,fontSize:11}}>Portföy</th>
                  <th scope="col" style={{textAlign:"right",paddingBottom:8,color:"var(--text3)",fontWeight:500,fontSize:11}}>SPY</th>
                  <th scope="col" style={{textAlign:"right",paddingBottom:8,color:"var(--text3)",fontWeight:500,fontSize:11}}>XU100</th>
                </tr>
              </thead>
              <tbody>
                {portfolioReturns.map(pd=>{
                  const spyR = benchRet("SPY",pd);
                  const xu100R = benchRet("XU100",pd);
                  return (
                    <tr key={pd.key} style={{borderTop:"1px solid var(--border)"}}>
                      <td style={{padding:"7px 0",fontSize:12,color:"var(--text2)",fontWeight:500}}>{pd.label}</td>
                      <td style={{textAlign:"right",padding:"7px 0"}}>{fmtRet(pd.ret)}</td>
                      <td style={{textAlign:"right",padding:"7px 0"}}>{fmtRet(spyR)}</td>
                      <td style={{textAlign:"right",padding:"7px 0"}}>{fmtRet(xu100R)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{fontSize:10,color:"var(--text3)",marginTop:10}}>Portföy ağırlığı anlık piyasa değeri bazında; benchmark SPY ve XU100 tarihi veriden.</div>
          </div>
        );
      })()}

      {/* ── Kart: Kur Riski ──────────────────────────────────────── */}
      {(()=>{
        const priceCurOf = p => p.type==="BIST" ? "TRY" : (p.currency==="EUR" ? "EUR" : "USD");
        const fxGroups = {USD:0, TRY:0, EUR:0};
        filteredPos.forEach(p=>{
          const pr = prc[p.ticker];
          if(pr==null) return;
          const priceCur = priceCurOf(p);
          const mv = cnv(p.shares*pr, priceCur);
          if(mv!=null) fxGroups[priceCur] = (fxGroups[priceCur]||0) + mv;
        });
        const fxTotal = Object.values(fxGroups).reduce((a,b)=>a+b,0);
        const usdFrac = fxTotal>0 ? fxGroups.USD/fxTotal : 0;
        const eurFrac = fxTotal>0 ? fxGroups.EUR/fxTotal : 0;
        const usdSens10 = usdFrac*10;
        const CUR_COLORS = {USD:"#0a84ff", TRY:"var(--info)", EUR:"#ffd60a"};
        const dominantFrac = Math.max(usdFrac, eurFrac);
        const dominantCur = usdFrac >= eurFrac ? "USD" : "EUR";
        const fxSubText = fxTotal > 0
          ? dominantFrac > 0.05
            ? `Portföyünün %${(dominantFrac * 100).toFixed(0)}'${dominantCur === "USD" ? "i dolar" : "i euro"} kuru riskine açık.`
            : "Kur dağılımı dengeli."
          : "Fiyat verisi bekleniyor.";
        return (
          <div className="card" style={{marginBottom:14,padding:"16px 18px"}}>
            <div className="stitle" style={{marginBottom:4}}>Kur Riski</div>
            <div style={{fontSize:11,color:"var(--text3)",marginBottom:14}}>{fxSubText}</div>
            {fxTotal>0 ? (
              <div>
                {[["USD","#0a84ff"],["TRY","var(--info)"],["EUR","#ffd60a"]].map(([cur,color])=>{
                  const val = fxGroups[cur]||0;
                  const pct = fxTotal>0 ? val/fxTotal*100 : 0;
                  if(val===0) return null;
                  return (
                    <div key={cur} style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,alignItems:"center"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{width:8,height:8,borderRadius:"50%",background:color,display:"inline-block"}}></span>
                          <span style={{fontSize:12,color:"var(--text2)",fontWeight:500}}>{cur}</span>
                        </div>
                        <div style={{display:"flex",gap:12,alignItems:"center"}}>
                          {!hide&&<span className="mono" style={{fontSize:11,color:"var(--text3)"}}>{mask(dSym+fmt(val,0))}</span>}
                          <span className="mono" style={{fontSize:12,fontWeight:600,minWidth:42,textAlign:"right"}}>{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div style={{height:6,background:"var(--bg3)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{width:pct+"%",height:"100%",background:color,borderRadius:3,transition:"width 0.4s ease"}}/>
                      </div>
                    </div>
                  );
                })}
                {displayCur==="TRY"&&usdFrac>0.05&&(
                  <div className="warn-card" style={{marginTop:8,marginBottom:0,fontSize:11}}>
                    Portföyünün <strong>%{(usdFrac*100).toFixed(0)}</strong>'i dolar cinsinden. USDTRY +%10'luk hareket portföyü yaklaşık <strong className="ok">%{usdSens10.toFixed(1)}</strong> etkiler.
                  </div>
                )}
                {displayCur==="TRY"&&eurFrac>0.05&&(
                  <div className="warn-card" style={{marginTop:8,marginBottom:0,fontSize:11}}>
                    Portföyünün <strong>%{(eurFrac*100).toFixed(0)}</strong>'i euro cinsinden. Kur çeşitlendirmesi riski dağıtabilir.
                  </div>
                )}
              </div>
            ):(
              <div className="dim" style={{fontSize:12}}>Fiyat verisi eksik — kur hesabı yapılamadı.</div>
            )}
          </div>
        );
      })()}

      {/* ── Kart: Temettü Özeti ──────────────────────────────────── */}
      {(()=>{
        const divTxsAll = txs.filter(t=>t.way==="DIV");
        if(divTxsAll.length===0) return null;
        // Total income
        const totalDivAll = divTxsAll.reduce((a,t)=>a+(+t.total||0),0);
        // Per-ticker breakdown
        const byTicker = {};
        divTxsAll.forEach(t=>{
          if(!byTicker[t.ticker]) byTicker[t.ticker]={ticker:t.ticker,total:0,txs:[]};
          byTicker[t.ticker].total += (+t.total||0);
          byTicker[t.ticker].txs.push(t);
        });
        const tickerList = Object.values(byTicker).sort((a,b)=>b.total-a.total);
        // Portfolio-level annual estimate (sum of per-ticker annuals)
        let annualEstAll = 0; let annualEstCount = 0;
        tickerList.forEach(tk=>{
          const sorted = [...tk.txs].sort((a,b)=>a.date.localeCompare(b.date));
          if(sorted.length<2) return;
          const years=(new Date(sorted[sorted.length-1].date)-new Date(sorted[0].date))/(365.25*86400000);
          if(years<0.05) return;
          annualEstAll += tk.total/years;
          annualEstCount++;
        });
        // Total MV for current yield
        const priceCurOf=p=>p.type==="BIST"?"TRY":(p.currency==="EUR"?"EUR":"USD");
        const totalMVAll=pos.reduce((a,p)=>{
          const pr=prc[p.ticker]; if(pr==null) return a;
          return a+(cnv(p.shares*pr,priceCurOf(p))||0);
        },0);
        const portfolioYield=annualEstCount>0&&totalMVAll>0?(annualEstAll/totalMVAll*100):null;
        const dSym=displayCur==="TRY"?"₺":"$";
        return (
          <div className="card" style={{marginBottom:14,padding:"16px 18px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div className="stitle">Temettü Özeti</div>
              <span className="ok mono" style={{fontSize:14,fontWeight:700}}>{mask("+"+dSym+fmt(totalDivAll,2))}</span>
            </div>
            <div style={{fontSize:11,color:"var(--text3)",marginBottom:12}}>Gerçekleşen toplam temettü geliri</div>
            <div style={{display:"flex",gap:16,marginBottom:16,flexWrap:"wrap"}}>
              {annualEstCount>0&&(
                <div style={{background:"var(--bg3)",borderRadius:8,padding:"8px 12px",flex:"1 1 120px"}}>
                  <div className="lbl" style={{marginBottom:4}}>Tahmini Yıllık</div>
                  <div className="ok mono" style={{fontSize:15,fontWeight:700}}>{mask(dSym+fmt(annualEstAll,2))}</div>
                  <div style={{fontSize:10,color:"var(--text3)",marginTop:2}}>{annualEstCount} ticker</div>
                </div>
              )}
              {portfolioYield!=null&&(
                <div style={{background:"var(--bg3)",borderRadius:8,padding:"8px 12px",flex:"1 1 120px"}}>
                  <div className="lbl" style={{marginBottom:4}}>Portföy Verimi</div>
                  <div className="ok mono" style={{fontSize:15,fontWeight:700}}>{fmtP(portfolioYield)}</div>
                  <div style={{fontSize:10,color:"var(--text3)",marginTop:2}}>Yıllık / Piyasa Değeri</div>
                </div>
              )}
            </div>
            <div className="lbl" style={{marginBottom:8}}>En Çok Temettü</div>
            {tickerList.slice(0,5).map(tk=>{
              const pct = totalDivAll>0 ? tk.total/totalDivAll*100 : 0;
              return (
                <div key={tk.ticker} style={{marginBottom:7}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                    <span className="mono" style={{fontSize:12,fontWeight:600,color:"var(--text)"}}>{tk.ticker}</span>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <span className="dim" style={{fontSize:11}}>{pct.toFixed(1)}%</span>
                      <span className="ok mono" style={{fontSize:12,fontWeight:600}}>{mask("+"+dSym+fmt(tk.total,2))}</span>
                    </div>
                  </div>
                  <div style={{height:4,background:"var(--bg3)",borderRadius:2,overflow:"hidden"}}>
                    <div style={{width:pct+"%",height:"100%",background:"var(--ok)",borderRadius:2,transition:"width 0.4s ease"}}/>
                  </div>
                </div>
              );
            })}
            {tickerList.length>5&&<div style={{fontSize:10,color:"var(--text3)",marginTop:6}}>{tickerList.length-5} ticker daha…</div>}
          </div>
        );
      })()}

      {/* ── Kart: 6 Aylık Performans ─────────────────────────────── */}
      {(()=>{
        const priceCurOf = p => p.type==="BIST" ? "TRY" : (p.currency==="EUR" ? "EUR" : "USD");
        const perf6m = filteredPos.map(p=>{
          const pr = prc[p.ticker];
          const h = hist[p.ticker];
          if(pr==null||!h?.p_m6) return null;
          const ret = (pr-h.p_m6)/h.p_m6*100;
          return {ticker:p.ticker, name:p.name, ret, type:p.type, currency:p.currency};
        }).filter(Boolean).sort((a,b)=>b.ret-a.ret);
        const gainers = perf6m.filter(p=>p.ret>=0);
        const losers  = perf6m.filter(p=>p.ret<0);
        const eligibleMV6m = perf6m.map(p=>{
          const pr = prc[p.ticker];
          const pos2 = filteredPos.find(fp=>fp.ticker===p.ticker);
          const priceCur = pos2 ? priceCurOf(pos2) : "USD";
          const mv = pr!=null&&pos2 ? cnv(pos2.shares*pr,priceCur) : null;
          return {...p, mv};
        }).filter(p=>p.mv!=null&&p.mv>0);
        const totalEligibleMV = eligibleMV6m.reduce((a,p)=>a+p.mv,0);
        const portf6m = totalEligibleMV>0
          ? eligibleMV6m.reduce((a,p)=>a+(p.ret/100)*(p.mv/totalEligibleMV),0)*100
          : null;
        return (
          <div className="card" style={{marginBottom:14,padding:"16px 18px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div className="stitle">6 Aylık Performans</div>
              {portf6m!=null&&(
                <span className={portf6m>=0?"ok":"err"} style={{fontFamily:"var(--font-numeric)",fontSize:13,fontWeight:700}}>
                  {portf6m>=0?"+":""}{portf6m.toFixed(2)}%
                </span>
              )}
            </div>
            <div style={{fontSize:11,color:"var(--text3)",marginBottom:14}}>6 ay önceki fiyata göre pozisyon bazlı getiri</div>
            {perf6m.length===0 ? (
              <div className="dim" style={{fontSize:12}}>Yeterli tarihi veri yok — fiyatları güncelle.</div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div>
                  <div className="lbl" style={{marginBottom:8,color:"var(--ok)"}}>En İyi</div>
                  {gainers.slice(0,3).map(p=>(
                    <div key={p.ticker} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                      <span style={{fontFamily:"var(--font-numeric)",fontSize:12,fontWeight:600,color:"var(--text)"}}>{p.ticker}</span>
                      <span className="ok" style={{fontFamily:"var(--font-numeric)",fontSize:12,fontWeight:700}}>+{p.ret.toFixed(1)}%</span>
                    </div>
                  ))}
                  {gainers.length===0&&<div className="dim" style={{fontSize:11}}>—</div>}
                </div>
                <div>
                  <div className="lbl" style={{marginBottom:8,color:"var(--err)"}}>En Kötü</div>
                  {losers.slice(-3).reverse().map(p=>(
                    <div key={p.ticker} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                      <span style={{fontFamily:"var(--font-numeric)",fontSize:12,fontWeight:600,color:"var(--text)"}}>{p.ticker}</span>
                      <span className="err" style={{fontFamily:"var(--font-numeric)",fontSize:12,fontWeight:700}}>{p.ret.toFixed(1)}%</span>
                    </div>
                  ))}
                  {losers.length===0&&<div className="dim" style={{fontSize:11}}>—</div>}
                </div>
              </div>
            )}
            {perf6m.length>0&&(
              <div style={{fontSize:10,color:"var(--text3)",marginTop:12}}>
                {perf6m.length}/{filteredPos.length} pozisyon için veri mevcut.{" "}
                {portf6m!=null&&"Ağırlıklı portföy getirisi gösterildi."}
              </div>
            )}
          </div>
        );
      })()}


      {/* ── Kart: Piyasa Düşüşü Dayanıklılığı ──────────────────────── */}
      {resilienceEligible.length > 0 && (
        <div className="card" style={{marginBottom:16,padding:"14px 16px"}}>
          {(()=>{
            let wSum=0, wTotal=0, resilientMV=0, totalMVRes=0;
            resilienceEligible.forEach(p => {
              const m = fundCache[p.ticker]?.metrics;
              const mv = mvDisp(p);
              const sc = resilienceScore(m);
              if (sc != null && mv > 0) {
                wSum += sc * mv; wTotal += mv;
                if (sc >= 7) resilientMV += mv;
              }
              if (mv > 0) totalMVRes += mv;
            });
            const portfolioScore = wTotal > 0 ? wSum / wTotal : null;
            const resilientPct = totalMVRes > 0 ? (resilientMV / totalMVRes) * 100 : null;
            const scoreColor = portfolioScore == null ? "var(--text3)"
              : portfolioScore >= 7 ? "var(--ok)"
              : portfolioScore >= 5 ? "var(--warn)"
              : "var(--err)";
            return (
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                  <div className="stitle" style={{marginBottom:0}}>Piyasa Düşüşü Dayanıklılığı</div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    {portfolioScore != null && (
                      <span className="mono" style={{fontSize:18,fontWeight:600,color:scoreColor}}>
                        {portfolioScore.toFixed(1)}<span style={{fontSize:11,color:"var(--text3)",fontWeight:400}}>/10</span>
                      </span>
                    )}
                    <button className="btn-xs" onClick={()=>setResilienceOpen(o=>!o)} style={{fontSize:11}}>
                      {resilienceOpen ? "▴" : "▾"}
                    </button>
                  </div>
                </div>

                {resilientPct != null && (
                  <div style={{fontSize:12,color:"var(--text2)",marginTop:8}}>
                    Portföyünüzün{" "}
                    <span style={{color:resilientPct>=60?"var(--ok)":resilientPct>=40?"var(--warn)":"var(--err)",fontWeight:600}}>
                      %{resilientPct.toFixed(0)}
                    </span>
                    {" "}resesyona dayanıklı şirketlerden oluşuyor
                    <span style={{fontSize:10,color:"var(--text3)",marginLeft:6}}>(skor ≥ 7)</span>
                  </div>
                )}

                {resilienceOpen && (
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"8px 10px",background:"var(--bg3)",borderRadius:8,marginTop:10,flexWrap:"wrap"}}>
                    <span style={{fontSize:11,color:"var(--text2)"}}>
                      {fundBusy
                        ? <><span className="spin" style={{width:11,height:11,marginRight:6,verticalAlign:"middle"}}></span>Çekiliyor: {fundProg}</>
                        : resilienceMissing.length>0
                          ? `${resilienceMissing.length} pozisyon için fundamental veri eksik.`
                          : `Veriler güncel${fundFreshLabel?` · son ${fundFreshLabel}`:""}`}
                    </span>
                    {!fundBusy && (
                      <button className={resilienceMissing.length>0?"pri btn-xs":"btn-xs"} onClick={()=>fetchAllFund(healthMissing.length===0&&resilienceMissing.length===0)}>
                        {resilienceMissing.length>0?"Eksikleri Çek":"Yenile"}
                      </button>
                    )}
                  </div>
                )}

                {resilienceOpen && (()=>{
                  const rows = resilienceEligible.map(p => {
                    const m = fundCache[p.ticker]?.metrics;
                    const sc = resilienceScore(m);
                    const mv = mvDisp(p);
                    return {p, m, sc, mv};
                  }).sort((a,b) => {
                    if (a.sc == null && b.sc == null) return 0;
                    if (a.sc == null) return 1;
                    if (b.sc == null) return -1;
                    return b.sc - a.sc;
                  });
                  return (
                    <div style={{marginTop:12}}>
                      {rows.map(({p, sc}) => {
                        const barPct = sc != null ? (sc / 10) * 100 : 0;
                        const barColor = sc == null ? "var(--bg4)"
                          : sc >= 7 ? "var(--ok)"
                          : sc >= 5 ? "var(--warn)"
                          : "var(--err)";
                        return (
                          <div key={p.ticker} style={{display:"flex",alignItems:"center",gap:10,padding:"5px 0"}}
                            className="pos-row" onClick={()=>openDetail(p.ticker,p.type,"analysis")}>
                            <span style={{flex:"0 0 70px",fontSize:12,fontFamily:"var(--font-numeric)"}}>
                              {p.ticker}
                              {p.type==="BIST" && <span style={{fontSize:9,color:"var(--text3)",marginLeft:4}}>BIST</span>}
                            </span>
                            <div style={{flex:1,height:6,background:"var(--bg3)",borderRadius:3,overflow:"hidden"}}>
                              <div style={{width:barPct+"%",height:"100%",background:barColor,transition:"width .3s"}}/>
                            </div>
                            <span className="mono" style={{flex:"0 0 40px",textAlign:"right",fontSize:12,fontWeight:600,color:sc!=null?barColor:"var(--text3)"}}>
                              {sc != null ? sc+"/10" : "—"}
                            </span>
                          </div>
                        );
                      })}
                      <div style={{fontSize:10,color:"var(--text3)",marginTop:8,lineHeight:1.5}}>
                        Skor: Yük./Özk &lt;0.5 (+2), FCF Marjı &gt;10% (+2), Op. Marjı &gt;15% (+2) → 1–10 · CRYPTO/GOLD/FX ve bankalar kapsam dışı
                      </div>
                    </div>
                  );
                })()}
              </>
            );
          })()}
        </div>
      )}

    </div>
  );
}

