// ── AnalysisTab — Portföy analiz sekmesi (Sprint 1) ────────────
// Şu an: filtreli varlık dağılımı pie. Sprint 2: bölge / komisyon / win-loss.
// Filter chip "Genel" → asset type breakdown; spesifik tip → o tipteki ticker breakdown.
// Sektör dağılımı renk paleti — 10 distinct renk + fallback gri (bilinmiyor)
const SECTOR_COLORS = [
  "#30d158","#0a84ff","#ff9f0a","#bf5af2","#ffd60a",
  "#ff453a","#5e5ce6","#64d2ff","#ac8e68","#ff6b6b",
];
const SECTOR_UNKNOWN_COLOR = "#8e8e93";
const TYPE_LABEL_SHORT = {
  all:"Genel", US_STOCK:"US Hisse", BIST:"BIST", FUND:"ETF/Fon",
  CRYPTO:"Kripto", GOLD:"Altın", FX:"Döviz"
};
// Ticker-level pie için palet — TYPE_COLORS sadece 6 entry; bir tip'in altında 6+ ticker olunca distinct renk gerek
const TICKER_PIE_COLORS = ["#30d158","#0a84ff","#ff9f0a","#bf5af2","#ffd60a","#ff453a","#5e5ce6","#64d2ff","#ac8e68","#7dd3fc","#a78bfa","#f472b6"];

// Region heuristic — type → region key. ETF underlying holdings (MCHI=Çin gibi)
// için ileride per-ticker override gerekebilir; şu an asset_type → region.
const REGION_OF = {
  US_STOCK:"us", FUND:"us",
  BIST:"tr",
  CRYPTO:"crypto", GOLD:"emtia",
  FX:"fx",
};
const REGION_META = {
  us:     {label:"US",              color:"#30d158"},
  tr:     {label:"Türkiye",         color:"#bf5af2"},
  crypto: {label:"Global · Kripto",  color:"#ff9f0a"},
  emtia:  {label:"Global · Emtia",   color:"#ffd60a"},
  fx:     {label:"Döviz",            color:"#8e8e93"},
};

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

function AnalysisTab({pos,txs,splits,prc,hist,hide,mask,setTab,displayCur,fxRates,openDetail}){
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
          const r=await edgeCall("fetch-prices",{ticker:p.ticker,mode:"meta",asset_type:p.type});
          const d=await r.json();
          if(r.ok&&d&&typeof d==="object")metaCacheSet(p.ticker,d);
        }catch(e){DEBUG&&console.warn("[sector auto-meta]",p.ticker,e);}
        if(i<missing.length-1)await new Promise(res=>setTimeout(res,600));
      }
      setSectorMetaBusy(false);
      setSectorMetaTick(t=>t+1);
    })();
  },[]);
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
  // pos değişince yeni eklenen pozisyonların cache'lerini de topla
  useEffect(()=>{
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
  },[pos]);
  // Sağlık tablosu için 8 kritik metrik (default; tüm 21 metrik FUND_THRESHOLDS'ta)
  const HEALTH_METRICS=[
    ["pe",                "P/E",          "x"],
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
  const fetchAllFund = async () => {
    const allMissing = [...new Map([...healthMissing, ...resilienceMissing].map(p=>[p.ticker,p])).values()];
    if(allMissing.length===0||fundBusy)return;
    setFundBusy(true);
    const next={...fundCache};
    for(let i=0;i<allMissing.length;i++){
      const p=allMissing[i];
      setFundProg(`${p.ticker} (${i+1}/${allMissing.length})`);
      try{
        const r=await edgeCall("fetch-fundamentals",{ticker:p.ticker,asset_type:p.type});
        const d=await r.json();
        if(r.ok&&d?.metrics){
          next[p.ticker]=d;
          fundCacheSet(p.ticker,d);
          setFundCache({...next});  // her başarıda UI tazele
        }
      }catch(e){DEBUG && console.warn(`[health ${p.ticker}]`,e);}
      if(i<allMissing.length-1) await new Promise(r=>setTimeout(r,800));
    }
    setFundBusy(false);
    setFundProg("");
  };
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
      const region = REGION_OF[p.type] || "fx";
      const mv = mvDisp(p);
      if (mv > 0) byRegion[region] = (byRegion[region] || 0) + mv;
    });
    const total = Object.values(byRegion).reduce((a,v)=>a+v,0);
    const arr = Object.entries(byRegion).map(([key,value]) => ({
      key, label: REGION_META[key]?.label || key, value, color: REGION_META[key]?.color || "#666"
    })).sort((a,b)=>b.value-a.value);
    arr.forEach(s => s.frac = total > 0 ? s.value/total : 0);
    return {arr, total};
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
                        <span style={{flex:1,minWidth:0,fontSize:11}}><span style={{fontFamily:"'DM Mono',monospace",fontWeight:500}}>{p.ticker}</span><span style={{color:"var(--text3)",marginLeft:5,fontSize:10}}>{p.name}</span></span>
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
          <div className="stitle" style={{marginBottom:0}}>Bölge Dağılımı</div>
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
                  Heuristik: US_STOCK/FUND→US, BIST→Türkiye, CRYPTO→Global·Kripto, GOLD→Global·Emtia, FX→Döviz. ETF içerikleri (MCHI=Çin gibi) ileride.
                </div>
              </>
            )}
          </div>
        )}
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
        <div className="card" style={{marginBottom:16,padding:"14px 16px"}}>
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

          {healthOpen && healthMissing.length>0 && (
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"8px 10px",background:"var(--bg3)",borderRadius:8,marginTop:10,flexWrap:"wrap"}}>
              <span style={{fontSize:11,color:"var(--text2)"}}>
                {fundBusy
                  ? <><span className="spin" style={{width:11,height:11,marginRight:6,verticalAlign:"middle"}}></span>Çekiliyor: {fundProg}</>
                  : `${healthMissing.length} pozisyonun fundamental verisi henüz çekilmemiş.`}
              </span>
              {!fundBusy && <button className="pri btn-xs" onClick={fetchAllFund}>Eksikleri Çek</button>}
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
              Eşikler `FUND_THRESHOLDS`'tan; kolon başlığında hover ile detay. BIST için P/S henüz yok (—). TR enflasyon nominal CAGR'ı şişiriyor — BIST büyüme metriklerine ihtiyatla bak.
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
              <span className="mono" style={{fontSize:18,fontWeight:600}}>{mask(dSym+fmt(commData.total,2))}</span>
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
                      <span style={{flex:"0 0 50px",fontFamily:"'DM Mono',monospace",fontSize:12}}>{year}</span>
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
          <div className="stitle" style={{marginBottom:0}}>Kazanan / Kaybeden Trade</div>
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

      {/* Konsantrasyon Risk Göstergesi — top3 ağırlık + HHI */}
      <div className="card" style={{marginBottom:16,padding:"14px 16px"}}>
        <div className="stitle" style={{marginBottom:12}}>Konsantrasyon Riski</div>
        {(()=>{
          const posWithMv=filteredPos.map(p=>({...p,dispMv:mvDisp(p)})).filter(p=>p.dispMv>0);
          const total=posWithMv.reduce((a,p)=>a+p.dispMv,0);
          if(total<=0||posWithMv.length===0)return <div className="empty" style={{padding:"12px 0",fontSize:11}}>Yeterli pozisyon yok</div>;
          const sorted=[...posWithMv].sort((a,b)=>b.dispMv-a.dispMv);
          const weights=sorted.map(p=>({...p,w:p.dispMv/total}));
          const top3w=weights.slice(0,3).reduce((a,p)=>a+p.w,0)*100;
          const hhi=Math.round(weights.reduce((a,p)=>a+(p.w*100)*(p.w*100),0));
          const level=top3w>60?"Yüksek":top3w>40?"Orta":"Düşük";
          const color=top3w>60?"var(--err)":top3w>40?"var(--warn)":"var(--ok)";
          return(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <div>
                  <div className="mono" style={{fontSize:22,fontWeight:700,color}}>{mask(fmt(top3w,1)+"%")}</div>
                  <div style={{fontSize:10,color:"var(--text3)",marginTop:1}}>İlk 3 pozisyon ağırlığı</div>
                </div>
                <span style={{fontSize:12,padding:"3px 10px",borderRadius:12,background:color+"22",color,fontWeight:600}}>{level}</span>
                <div style={{marginLeft:"auto",textAlign:"right"}}>
                  <div className="mono" style={{fontSize:13,fontWeight:600}}>{hhi}</div>
                  <div style={{fontSize:10,color:"var(--text3)"}}>HHI skoru</div>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {weights.slice(0,3).map((p,i)=>(
                  <div key={p.ticker} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>openDetail(p.ticker,p.type,"analysis")}>
                    <span style={{color:"var(--text3)",fontSize:11,minWidth:14}}>{i+1}.</span>
                    <span className="mono" style={{fontSize:13,fontWeight:600,minWidth:60}}>{p.ticker}</span>
                    <div style={{flex:1,height:6,background:"var(--bg3)",borderRadius:3,overflow:"hidden"}}>
                      <div style={{width:(p.w*100)+"%",height:"100%",background:color,borderRadius:3}}/>
                    </div>
                    <span className="mono" style={{fontSize:12,color:"var(--text2)",minWidth:40,textAlign:"right"}}>{fmt(p.w*100,1)}%</span>
                  </div>
                ))}
              </div>
              <div style={{marginTop:10,fontSize:10,color:"var(--text3)"}}>
                HHI = Σ(ağırlık²) × 10000 · {posWithMv.length} pozisyon · {posWithMv.length>3?`geri kalan ${posWithMv.length-3} pozisyon dağılımı etkiliyor`:""}{" "}
                <span data-tip="Herfindahl-Hirschman Endeksi: 0=tam çeşitlenmiş, 10000=tek pozisyon. >2500 konsantre sayılır.">HHI nedir?</span>
              </div>
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

          return (
            <div>
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
                        <td style={{padding:"5px 8px 5px 0",fontWeight:600,fontFamily:"'DM Mono',monospace"}}>
                          {r.ticker}
                        </td>
                        <td style={{padding:"5px 8px 5px 0",textAlign:"right",fontFamily:"'DM Mono',monospace"}}>
                          {r.breakEven != null ? mask(r.sym + fmt(r.breakEven, 2)) : <span className="dim">—</span>}
                        </td>
                        <td style={{padding:"5px 8px 5px 0",textAlign:"right",fontFamily:"'DM Mono',monospace"}}>
                          {r.curPrice != null
                            ? mask(r.sym + fmt(r.curPrice, 2))
                            : <span style={{fontSize:10,color:"var(--text3)"}}>Fiyat yok</span>}
                        </td>
                        <td style={{padding:"5px 0 5px 0",textAlign:"right",fontFamily:"'DM Mono',monospace"}}>
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
              const r = await edgeCall("fetch-prices", {ticker: p.ticker, mode: "meta", asset_type: p.type});
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
              style:{fontFamily:"DM Mono,monospace",fontSize:12,fontWeight:600}
            },(r>=0?"+":"")+r.toFixed(2)+"%");
        return (
          <div className="card" style={{marginBottom:14,padding:"16px 18px"}}>
            <div className="stitle" style={{marginBottom:4}}>Dönem Bazlı Getiri</div>
            <div style={{fontSize:11,color:"var(--text3)",marginBottom:14}}>Portföy vs Benchmark (ağırlıklı ortalama)</div>
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
        return (
          <div className="card" style={{marginBottom:14,padding:"16px 18px"}}>
            <div className="stitle" style={{marginBottom:4}}>Kur Riski</div>
            <div style={{fontSize:11,color:"var(--text3)",marginBottom:14}}>Para birimi bazında piyasa değeri dağılımı</div>
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
                    USD pozisyon <strong>%{(usdFrac*100).toFixed(0)}</strong> — USDTRY +%10'da portföy ≈{" "}
                    <strong className="ok">+%{usdSens10.toFixed(1)}</strong>
                  </div>
                )}
                {displayCur==="TRY"&&eurFrac>0.05&&(
                  <div className="warn-card" style={{marginTop:8,marginBottom:0,fontSize:11}}>
                    EUR pozisyon <strong>%{(eurFrac*100).toFixed(0)}</strong> — portföyde karışık kur riski mevcut.
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
                <span className={portf6m>=0?"ok":"err"} style={{fontFamily:"DM Mono,monospace",fontSize:13,fontWeight:700}}>
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
                      <span style={{fontFamily:"DM Mono,monospace",fontSize:12,fontWeight:600,color:"var(--text)"}}>{p.ticker}</span>
                      <span className="ok" style={{fontFamily:"DM Mono,monospace",fontSize:12,fontWeight:700}}>+{p.ret.toFixed(1)}%</span>
                    </div>
                  ))}
                  {gainers.length===0&&<div className="dim" style={{fontSize:11}}>—</div>}
                </div>
                <div>
                  <div className="lbl" style={{marginBottom:8,color:"var(--err)"}}>En Kötü</div>
                  {losers.slice(-3).reverse().map(p=>(
                    <div key={p.ticker} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                      <span style={{fontFamily:"DM Mono,monospace",fontSize:12,fontWeight:600,color:"var(--text)"}}>{p.ticker}</span>
                      <span className="err" style={{fontFamily:"DM Mono,monospace",fontSize:12,fontWeight:700}}>{p.ret.toFixed(1)}%</span>
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

                {resilienceMissing.length > 0 && (
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"8px 10px",background:"var(--bg3)",borderRadius:8,marginTop:10,flexWrap:"wrap"}}>
                    <span style={{fontSize:11,color:"var(--text2)"}}>
                      {fundBusy
                        ? <><span className="spin" style={{width:11,height:11,marginRight:6,verticalAlign:"middle"}}></span>Çekiliyor: {fundProg}</>
                        : `${resilienceMissing.length} pozisyon için fundamental veri eksik.`}
                    </span>
                    {!fundBusy && <button className="pri btn-xs" onClick={fetchAllFund}>Eksikleri Çek</button>}
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
                            <span style={{flex:"0 0 70px",fontSize:12,fontFamily:"'DM Mono',monospace"}}>
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

