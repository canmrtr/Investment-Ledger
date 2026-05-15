
// ── AddTxInline — Detail sayfasından hızlı işlem ekleme ────────
// Tek ticker için: Manuel form veya AI ile metin parse.
function AddTxInline({ticker,user,pos,loadData,flash_,onClose,assetType,portfolioId}){
  const [mode,setMode]=useState("manuel");
  const E={date:today(),way:"BUY",shares:"",price:"",broker:"",commission:"",notes:""};
  const [form,setForm]=useState(E);
  const [saving,setSaving]=useState(false);
  const [aiText,setAiText]=useState("");
  const [aiParsing,setAiParsing]=useState(false);
  const [aiParsed,setAiParsed]=useState(null);
  const [aiErr,setAiErr]=useState("");

  const tkPos=pos.find(x=>x.ticker===ticker);
  // Effective asset type: pozisyondan, yoksa parent'tan gelen hint'ten, yoksa US_STOCK default.
  // Non-held BIST detayından eklemede asset_type doğru olsun diye kritik.
  const effType = tkPos?.type || assetType || "US_STOCK";
  const effCur  = tkPos?.currency || (effType==="BIST" ? "TRY" : "USD");

  const saveManual=async()=>{
    const sh=+form.shares,pr=+form.price;
    if(!form.shares||isNaN(sh)||sh<=0){flash_("Geçersiz adet","err");return;}
    if(!form.price||isNaN(pr)||pr<0){flash_("Geçersiz fiyat","err");return;}
    setSaving(true);
    const{error}=await sb.from("transactions").insert({
      user_id:user.id,date:form.date,ticker,
      name:tkPos?.name||ticker,
      asset_type:effType,
      way:form.way,shares:sh,price:pr,
      currency:effCur,
      total:+(sh*pr).toFixed(4),
      broker:form.broker||"",
      commission:+(form.commission||0),
      exchange:"",notes:form.notes||"",
      portfolio_id:portfolioId
    });
    setSaving(false);
    if(error){flash_(error.message,"err");return;}
    await rebuildPositions(user.id,portfolioId);await loadData();
    flash_(`${ticker} ${form.way==="BUY"?"alış":form.way==="DIV"?"temettü":"satış"} eklendi ✓`);
    onClose();
  };

  const parseAI=async()=>{
    if(!aiText.trim())return;
    setAiParsing(true);setAiErr("");setAiParsed(null);
    try{
      // Ticker'ı prompt'a göm — AI doğru ticker bulsun
      const r=await edgeCallAuth("parse-transaction",{text:`Ticker: ${ticker}. ${aiText}`});
      const d=await r.json();
      if(!r.ok||d.error)throw new Error(d.message||d.error||`HTTP ${r.status}`);
      const list = Array.isArray(d.transactions) ? d.transactions : (d.ticker && d.date ? [d] : []);
      if(list.length===0)throw new Error("Geçersiz yanıt — işlem bulunamadı");
      // Detay sayfasından eklendiği için ticker'ı zorla override et + name fallback
      list.forEach(t=>{ t.ticker=ticker; if(!t.name)t.name=tkPos?.name||ticker; });
      setAiParsed(await enrichParseListWithPrices(list));
    }catch(e){setAiErr("Hata: "+e.message);}
    setAiParsing(false);
  };

  const saveAI=async(list)=>{
    const items = Array.isArray(list) ? list : (aiParsed||[]);
    if(!items||items.length===0)return;
    const valid=items.filter(p=>{const sh=+p.shares,pr=+p.price;return !isNaN(sh)&&sh>0&&!isNaN(pr)&&pr>=0;});
    const invalidCnt=items.length-valid.length;
    if(valid.length===0){flash_("Geçerli işlem bulunamadı","err");return;}
    const rows = valid.map(p=>({
      user_id:user.id,date:p.date,ticker,
      name:p.name||tkPos?.name||ticker,
      asset_type:p.asset_type||effType,
      way:p.way,shares:+p.shares,price:+p.price,
      currency:p.currency||effCur,
      total:+((+p.shares)*(+p.price)).toFixed(4),
      broker:p.broker||"",commission:+(p.commission||0),
      exchange:p.exchange||"",notes:p.notes||"",
      portfolio_id:portfolioId
    }));
    const{error}=await sb.from("transactions").insert(rows);
    if(error){flash_(error.message,"err");return;}
    await rebuildPositions(user.id,portfolioId);await loadData();
    const msg=rows.length===1?"İşlem eklendi ✓":`${rows.length} işlem eklendi ✓`;
    flash_(invalidCnt>0?msg+` · ${invalidCnt} geçersiz atlandı`:msg);
    onClose();
  };

  return(
    <div className="cbox" style={{marginTop:10,marginBottom:14}}>
      <div className="seg" style={{marginBottom:12}}>
        <button className={mode==="manuel"?"on":""} onClick={()=>setMode("manuel")}>📌 Manuel</button>
        <button className={mode==="ai"?"on":""} onClick={()=>setMode("ai")}>📝 AI ile</button>
      </div>

      {mode==="manuel"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
            <div><div className="kk" style={{marginBottom:3}}>Tarih</div>
              <input className="finp sm" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} max={today()}/></div>
            <div><div className="kk" style={{marginBottom:3}}>İşlem</div>
              <select className="finp sm" value={form.way} onChange={e=>setForm(f=>({...f,way:e.target.value}))}>
                <option value="BUY">Alış</option><option value="SELL">Satış</option><option value="DIV">Temettü</option>
              </select></div>
            <div><div className="kk" style={{marginBottom:3}}>Broker</div>
              <input className="finp sm" value={form.broker} maxLength={50} onChange={e=>setForm(f=>({...f,broker:e.target.value}))} placeholder="Akbank..."/></div>
            <div><div className="kk" style={{marginBottom:3}}>Adet *</div>
              <input className="finp sm" type="number" step="any" value={form.shares} onChange={e=>setForm(f=>({...f,shares:e.target.value}))} placeholder="0"/></div>
            <div><div className="kk" style={{marginBottom:3}}>Fiyat *</div>
              <input className="finp sm" type="number" step="any" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} placeholder="0.00"/></div>
            <div><div className="kk" style={{marginBottom:3}}>Komisyon</div>
              <input className="finp sm" type="number" step="any" value={form.commission} onChange={e=>setForm(f=>({...f,commission:e.target.value}))} placeholder="0"/></div>
          </div>
          <div style={{marginBottom:8}}>
            <div className="kk" style={{marginBottom:3}}>Not (opsiyonel)</div>
            <input className="finp sm" value={form.notes} maxLength={200} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="e.g. Q1 temettü, ikramiye..."/>
          </div>
          {form.shares&&form.price&&(
            <div style={{fontSize:11,color:"var(--text2)",marginBottom:10}}>Toplam: {displaySym(effCur)}{fmt((+form.shares)*(+form.price),2)}</div>
          )}
          <div className="brow">
            <button className="pri btn-md" onClick={saveManual} disabled={saving||!form.shares||!form.price}>{saving?"...":"Kaydet"}</button>
            <button className="btn-md" onClick={onClose} disabled={saving}>İptal</button>
          </div>
        </div>
      )}

      {mode==="ai"&&(
        <div>
          <textarea value={aiText} onChange={e=>setAiText(e.target.value)} rows={3}
            placeholder={`"5 adet $200 bugün Akbank komisyon $2"\n"3 adet $150 dün satış QNB"`}
            style={{lineHeight:1.5,marginBottom:8,resize:"vertical"}}/>
          <div className="brow" style={{marginBottom:aiParsed||aiErr?10:0}}>
            <button className="pri btn-md" onClick={parseAI} disabled={aiParsing||!aiText.trim()}>{aiParsing?"Parse...":"AI Parse"}</button>
            <button className="btn-md" onClick={onClose} disabled={aiParsing}>İptal</button>
          </div>
          {aiErr&&<div className="flash err" style={{fontSize:12}}>{aiErr}</div>}
          <ConfirmBox data={aiParsed} onSave={saveAI} onCancel={()=>setAiParsed(null)}/>
        </div>
      )}
    </div>
  );
}

// ── TickerDetailTab — pozisyon + meta + transactions ───────────
// LS cache: 7 gün TTL (ticker meta'sı yavaş değişir)
const META_TTL_MS = 7 * 86400000;
const metaCacheGet = (ticker) => {
  const c = LS.get(`meta_${ticker}`, null);
  if (!c || !c.t) return null;
  if (Date.now() - c.t > META_TTL_MS) return null;
  return c.d;
};
// Provider compromise koruması: description multi-MB string olabilir → LS quota'yı şişirir.
// 5KB cap (içerik anlamlı kalır, render'da `cursor:help` ile zaten clamp'liyor).
const META_DESC_CAP = 5000;
const sanitizeMeta = (data) => {
  if (!data || typeof data !== "object") return data;
  const clean = {...data};
  if (typeof clean.description === "string" && clean.description.length > META_DESC_CAP) {
    clean.description = clean.description.slice(0, META_DESC_CAP) + "…";
  }
  return clean;
};
const metaCacheSet = (ticker, data) => LS.set(`meta_${ticker}`, { d: sanitizeMeta(data), t: Date.now() });

// Dividend calendar cache — 24 saat TTL
const DIVCAL_TTL_MS = 24 * 3600000;
const divCalCacheGet = (ticker) => {
  const c = LS.get(`il_divcal_${ticker}`, null);
  if (!c || !c.t) return null;
  if (Date.now() - c.t > DIVCAL_TTL_MS) return null;
  return c.d;
};
const divCalCacheSet = (ticker, data) => LS.set(`il_divcal_${ticker}`, { d: data, t: Date.now() });

// Value-investing checklist eşikleri.
// dir: "high"=büyük iyi, "low"=küçük iyi. Örn. ROE yüksek, P/E düşük olsun.
const FUND_THRESHOLDS = {
  revenueGrowth5Y:    {dir:"high", good:0.10,  ok:0.05},
  earningsGrowth5Y:   {dir:"high", good:0.10,  ok:0.05},
  grossMargin:        {dir:"high", good:0.40,  ok:0.25},
  operatingMargin:    {dir:"high", good:0.15,  ok:0.08},
  netMargin:          {dir:"high", good:0.10,  ok:0.05},
  fcfMargin:          {dir:"high", good:0.10,  ok:0.05},
  sgaToGrossProfit:   {dir:"low",  good:0.30,  ok:0.50},
  depToGrossProfit:   {dir:"low",  good:0.10,  ok:0.25},
  interestToOpIncome: {dir:"low",  good:0.15,  ok:0.30},
  liabToEquity:       {dir:"low",  good:0.80,  ok:2.00},
  retainedToEquity:   {dir:"high", good:1.00,  ok:0.50},
  roe:                {dir:"high", good:0.15,  ok:0.08},
  roa:                {dir:"high", good:0.07,  ok:0.03},
  roic:               {dir:"high", good:0.15,  ok:0.08},
  pe:                 {dir:"low",  good:15,    ok:25},
  ps:                 {dir:"low",  good:2,     ok:5},
  capexToNetIncome:   {dir:"low",  good:0.25,  ok:0.50},
  capexToSales:       {dir:"low",  good:0.05,  ok:0.10},
  capexToOcf:         {dir:"low",  good:0.30,  ok:0.50},
  ebitToInterest:     {dir:"high", good:10,    ok:5},
  netDebtToFcf:       {dir:"low",  good:2,     ok:5},
};

const fundScore = (key, val) => {
  if (val == null || !isFinite(val)) return null;
  const t = FUND_THRESHOLDS[key];
  if (!t) return null;
  // netDebtToFcf negatif = net cash → koşulsuz iyi
  if (key === "netDebtToFcf" && val < 0) return "good";
  if (t.dir === "high") {
    if (val >= t.good) return "good";
    if (val >= t.ok)   return "neutral";
    return "bad";
  } else {
    if (val <= t.good) return "good";
    if (val <= t.ok)   return "neutral";
    return "bad";
  }
};

// Checklist gruplaması — UI render sırası
const FUND_GROUPS = [
  ["Büyüme (5Y CAGR)", [
    ["revenueGrowth5Y",    "Gelir Büyüme",  "pct"],
    ["earningsGrowth5Y",   "Kâr Büyüme",    "pct"],
  ]],
  ["Kâr Marjları", [
    ["grossMargin",        "Brüt Marj",      "pct"],
    ["operatingMargin",    "Operasyonel",    "pct"],
    ["netMargin",          "Net Kâr",        "pct"],
    ["fcfMargin",          "FCF Marj",       "pct"],
  ]],
  ["Verimlilik", [
    ["roe",                "ROE",            "pct"],
    ["roa",                "ROA",            "pct"],
    ["roic",               "ROIC",           "pct"],
  ]],
  ["Gider Disiplini", [
    ["sgaToGrossProfit",   "SG&A / Brüt",    "pct"],
    ["depToGrossProfit",   "D&A / Brüt",     "pct"],
    ["interestToOpIncome", "Faiz / Op Kâr",  "pct"],
  ]],
  ["Bilanço Sağlığı", [
    ["liabToEquity",       "Yük. / Özk.",    "x"],
    ["retainedToEquity",   "Birikmiş / Özk.","x"],
    ["ebitToInterest",     "Faiz Karşılama", "x"],
    ["netDebtToFcf",       "Net Borç / FCF", "x"],
  ]],
  ["Sermaye Yatırımı", [
    ["capexToNetIncome",   "CapEx / Net Kâr","pct"],
    ["capexToSales",       "CapEx / Gelir",  "pct"],
    ["capexToOcf",         "CapEx / OCF",    "pct"],
  ]],
  ["Değerleme", [
    ["pe",                 "F/K (P/E)",      "x"],
    ["ps",                 "F/S (P/S)",      "x"],
  ]],
];

const fmtFundVal = (val, type) => {
  if (val == null || !isFinite(val)) return "—";
  if (type === "pct") return (val * 100).toFixed(1) + "%";
  if (type === "x")   return val.toFixed(2) + "×";
  return val.toFixed(2);
};

// "iyi ≥40% · orta ≥25%" gibi eşik metni — listede sublabel olarak gösterilir.
const fundThreshText = (key, type) => {
  const t = FUND_THRESHOLDS[key];
  if (!t) return "";
  const fmtT = (v) => {
    if (type === "pct") return (v*100).toFixed(0) + "%";
    if (type === "x")   return v + "×";
    return String(v);
  };
  const op = t.dir === "high" ? "≥" : "≤";
  return `iyi ${op}${fmtT(t.good)} · orta ${op}${fmtT(t.ok)}`;
};

const SCORE_COLOR = { good: "var(--ok)", neutral: "var(--warn)", bad: "var(--err)" };

// Metrik açıklaması (data-tip için, kısa ve sade)
const FUND_TIP = {
  revenueGrowth5Y:    "Son 5 yılda yıllık ortalama gelir büyümesi (CAGR). 10%+ güçlü.",
  earningsGrowth5Y:   "Son 5 yılda yıllık net kâr büyümesi. 10%+ güçlü.",
  grossMargin:        "Brüt kâr / Gelir. 40%+ güçlü pricing power.",
  operatingMargin:    "Operasyonel kâr / Gelir. 15%+ verimli operasyon.",
  netMargin:          "Net kâr / Gelir. 10%+ sağlıklı.",
  fcfMargin:          "Serbest nakit akışı / Gelir. 10%+ güçlü cash generation.",
  sgaToGrossProfit:   "SG&A gideri / Brüt kâr. ≤30% gider disiplini.",
  depToGrossProfit:   "Amortisman / Brüt kâr. ≤10% düşük capital intensity.",
  interestToOpIncome: "Faiz gideri / Op. kâr. ≤15% sağlam borç servisi.",
  liabToEquity:       "Toplam Yükümlülük / Özkaynak. ≤0.8 düşük kaldıraç.",
  retainedToEquity:   "Birikmiş kâr / Özkaynak. 1.0+ uzun süreli kâr birikimi.",
  roe:                "Net kâr / Özkaynak (TTM). 15%+ güçlü.",
  roa:                "Net kâr / Toplam varlık (TTM). 7%+ verimli.",
  roic:               "Yatırılan sermayenin getirisi. 15%+ ekonomik moat işareti.",
  pe:                 "Fiyat / Kâr (TTM). ≤15 cazip değerleme (sektöre göre).",
  ps:                 "Fiyat / Satış (TTM). ≤2 cazip (sektöre göre).",
  capexToNetIncome:   "CapEx / Net kâr. ≤25% düşük yeniden-yatırım yükü.",
  capexToSales:       "CapEx / Gelir. ≤5% düşük capital intensity.",
  capexToOcf:         "CapEx / Operasyonel nakit. ≤30% sağlıklı reinvestment.",
  ebitToInterest:     "Faiz Karşılama (EBIT/Faiz). ≥10× rahat borç servisi.",
  netDebtToFcf:       "(Borç − Nakit) / FCF. ≤2 yıl borçtan rahat çıkar; negatifse net cash.",
};

// homepage_url'den domain çıkar — Clearbit logo için.
const extractDomain = (url) => {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : "https://" + url).hostname.replace(/^www\./, "");
  } catch (e) { return null; }
};

// Güvenli href — sadece http/https protokolüne izin ver. javascript:/data: gibi
// URL'leri (provider compromise edilirse) engelle. Geçersizse "#" döner.
const safeUrl = (url) => {
  if (!url || typeof url !== "string") return "#";
  try {
    const u = new URL(url.startsWith("http") ? url : "https://" + url);
    return (u.protocol === "http:" || u.protocol === "https:") ? u.href : "#";
  } catch (e) { return "#"; }
};

// Sayı formatı: 4014264110200 → "4.01T", 166000 → "166K"
const fmtCompact = (n) => {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n/1e12).toFixed(2)+"T";
  if (abs >= 1e9)  return (n/1e9).toFixed(2)+"B";
  if (abs >= 1e6)  return (n/1e6).toFixed(1)+"M";
  if (abs >= 1e3)  return (n/1e3).toFixed(1)+"K";
  return ""+n;
};

function TickerDetailTab({ticker,assetTypeHint,pos,txs,prc,hist,user,confirm_,flash_,loadData,closeDetail,hideAmts,mask,portfolioId,inWatchlist,onToggleWatchlist}){
  const [meta,setMeta]=useState(()=>metaCacheGet(ticker));
  const [metaLoading,setMetaLoading]=useState(false);
  const [metaErr,setMetaErr]=useState("");
  const [fund,setFund]=useState(()=>fundCacheGet(ticker));
  const [fundLoading,setFundLoading]=useState(false);
  const [fundErr,setFundErr]=useState("");
  const [fundErrCode,setFundErrCode]=useState("");  // edge function code, ör. "OUT_OF_PLAN"
  const [divCal,setDivCal]=useState(()=>divCalCacheGet(ticker));
  const [showFullDesc,setShowFullDesc]=useState(false);
  const [showAdd,setShowAdd]=useState(false);
  // FAB context-aware (App'taki +) bu detail tab'ı açtığı için, custom event ile setShowAdd tetikle
  useEffect(()=>{
    const onFab=()=>setShowAdd(true);
    window.addEventListener("il-detail-add",onFab);
    return()=>window.removeEventListener("il-detail-add",onFab);
  },[]);
  const [expandedTx,setExpandedTx]=useState(null);   // tıklanan tx.id
  const [editTxId,setEditTxId]=useState(null);
  const [editForm,setEditForm]=useState({});
  const [savingTx,setSavingTx]=useState(false);
  const [showCek,setShowCek]=useState(false);
  const [cekForm,setCekForm]=useState({date:today(),amount:""});
  const [savingCek,setSavingCek]=useState(false);

  const startEditTx=t=>{
    setEditTxId(t.id);
    setEditForm({date:t.date,way:t.way,shares:t.shares,price:t.price,currency:t.currency||"USD",broker:t.broker||"",commission:t.commission||0,notes:t.notes||""});
  };
  const cancelEditTx=()=>{setEditTxId(null);setEditForm({});};
  const saveEditTx=async(t)=>{
    setSavingTx(true);
    const{error}=await sb.from("transactions").update({
      date:editForm.date,way:editForm.way,shares:+editForm.shares,price:+editForm.price,
      currency:editForm.currency,total:+((+editForm.shares)*(+editForm.price)).toFixed(4),
      broker:editForm.broker,commission:+(editForm.commission||0),notes:editForm.notes||""
    }).eq("id",t.id).eq("user_id",user.id);
    if(error){flash_(error.message,"err");}
    else{await rebuildPositions(user.id,portfolioId);await loadData();flash_("Güncellendi ✓");setEditTxId(null);setEditForm({});}
    setSavingTx(false);
  };
  const delTxRow=async(t)=>{
    if(!(await confirm_(`${fmtDateTR(t.date)} tarihli ${t.way==="BUY"?"alış":t.way==="DIV"?"temettü":"satış"} silinsin mi?`,{okLbl:"Sil"})))return;
    await sb.from("transactions").delete().eq("id",t.id).eq("user_id",user.id);
    await rebuildPositions(user.id,portfolioId);await loadData();flash_("Silindi ✓");
    setExpandedTx(null);
  };
  const saveCek=async()=>{
    const amt=+cekForm.amount;
    if(!amt||amt<=0){flash_("Geçersiz tutar","err");return;}
    if(amt>p.shares){flash_(`Çekim tutarı anapara (${sym}${fmt(p.shares,0)}) aşamaz`,"err");return;}
    setSavingCek(true);
    const{error}=await sb.from("transactions").insert({
      user_id:user.id,date:cekForm.date,ticker:p.ticker,
      name:p.name,asset_type:"DEPOSIT",way:"SELL",
      shares:amt,price:1.0,currency:p.currency,total:amt,
      broker:p.broker||"",commission:0,exchange:"",notes:"",
      portfolio_id:portfolioId
    });
    setSavingCek(false);
    if(error){flash_(error.message,"err");return;}
    await rebuildPositions(user.id,portfolioId);await loadData();
    flash_("Çekim eklendi ✓");
    setShowCek(false);setCekForm({date:today(),amount:""});
  };

  const p=pos.find(x=>x.ticker===ticker);
  const tickerTxs=txs.filter(t=>t.ticker===ticker);
  // Effective asset type — held varsa onun type'ı, non-held ise search'ten gelen hint
  // (BIST veya US_STOCK varsayılan). Provider routing + currency display için kullanılır.
  const effectiveType = p?.type || assetTypeHint || "US_STOCK";
  const isDeposit=p?.type==="DEPOSIT";
  const isBes=p?.type==="BES";
  const depositGross=isDeposit&&p.interestRate!=null?computeDepositGrossInterest(tickerTxs,p.interestRate*(1-(p.reserveRatio||0)),p.maturityDate||null):0;
  const depositNet=depositGross*(1-DEPOSIT_TAX_RATE);
  const _depNow=Date.now();
  const _depMatMs=isDeposit&&p.maturityDate?new Date(p.maturityDate).getTime():null;
  const depositDaysLeft=_depMatMs!=null?Math.round((_depMatMs-_depNow)/86400000):null;
  const _depBuyMs=(()=>{if(!isDeposit)return null;const ds=tickerTxs.filter(t=>t.way==="BUY").map(t=>new Date(t.date).getTime());return ds.length>0?Math.min(...ds):_depNow;})();
  const depositElapsed=_depBuyMs!=null?Math.max(1,Math.round((_depNow-_depBuyMs)/86400000)):1;
  const isBist = effectiveType==="BIST";
  const displayCurrency = p?.currency || (isBist ? "TRY" : "USD");
  const sym = displayCurrency==="TRY" ? "₺" : displayCurrency==="EUR" ? "€" : "$";

  // Non-held için canlı fiyat (search'ten açıldı, prc[ticker] yok). Held için prc cache'ten.
  const [livePrice,setLivePrice]=useState(null);
  useEffect(()=>{
    if(p)return;
    // Non-held için live price fetch — assetTypeHint BIST ise Yahoo, yoksa Massive
    edgePriceCall({ticker,mode:"price",asset_type:effectiveType})
      .then(r=>r.json())
      .then(d=>{if(d?.result?.price)setLivePrice(d.result.price);})
      .catch(()=>{});
  },[ticker,p,effectiveType]);
  const price = p ? prc[ticker] : livePrice;
  const currentCost=p?p.shares*p.avgCost:0;
  const mv=p&&price!=null?p.shares*price:null;
  const dayChange=hist[ticker]?.d1; // % değişim son 1G (held için)

  // Realize / Unrealize / Toplam — bu ticker için tüm zaman
  const totalInvested=tickerTxs.filter(t=>t.way==="BUY").reduce((a,t)=>a+(+t.total+(+t.commission||0)),0);
  const divTxs=tickerTxs.filter(t=>t.way==="DIV").sort((a,b)=>a.date.localeCompare(b.date));
  const totalDivIncome=divTxs.reduce((a,t)=>a+(+t.total||0),0);
  // Yıllık temettü tahmini: en az 2 işlem + yeterli zaman aralığı gerekir.
  const annualDivEst=(()=>{
    if(divTxs.length<2)return null;
    const first=new Date(divTxs[0].date),last=new Date(divTxs[divTxs.length-1].date);
    const years=(last.getTime()-first.getTime())/(365.25*86400000);
    if(years<0.05)return null;
    return totalDivIncome/years;
  })();
  const yieldOnCost=totalInvested>0&&annualDivEst!=null?(annualDivEst/totalInvested*100):null;
  const currentYield=mv!=null&&mv>0&&annualDivEst!=null?(annualDivEst/mv*100):null;
  const totalReceived=tickerTxs.filter(t=>t.way==="SELL").reduce((a,t)=>a+(+t.total-(+t.commission||0)),0);
  const totalCommission=tickerTxs.filter(t=>t.way!=="DIV").reduce((a,t)=>a+(+t.commission||0),0);
  const realized=totalReceived+currentCost-totalInvested;
  const unrealized=mv!=null?mv-currentCost:null;
  const totalPL=unrealized!=null?realized+unrealized:null;
  const totalPLPct=totalInvested>0&&totalPL!=null?(totalPL/totalInvested)*100:null;

  // Meta fetch — cache'te yoksa veya zorla yenile
  const fetchMeta=async(force)=>{
    if(!force){
      const cached=metaCacheGet(ticker);
      if(cached){setMeta(cached);return;}
    }
    setMetaLoading(true);setMetaErr("");
    try{
      const r=await edgePriceCall({ticker,mode:"meta",asset_type:effectiveType});
      const d=await r.json();
      if(d.result&&!d.result.error){
        const safe=sanitizeMeta(d.result);
        setMeta(safe);
        metaCacheSet(ticker,safe);
      } else {
        setMetaErr(d.result?.error||d.error||"Bilinmeyen hata");
      }
    }catch(e){setMetaErr(e.message);}
    setMetaLoading(false);
  };
  useEffect(()=>{if(!isBes&&!meta)fetchMeta(false);},[ticker,effectiveType]);

  // Dividend calendar — yalnızca held US_STOCK için; BIST'te FMP temettü güvenilir değil
  useEffect(()=>{
    if(isBist||isBes||!p||divCal!==null)return;
    edgeCallAuth("fetch-fundamentals",{mode:"dividend-calendar",tickers:[ticker]})
      .then(r=>r.json())
      .then(data=>{
        const items=data?.dividends?.[ticker]||[];
        setDivCal(items);
        divCalCacheSet(ticker,items);
      })
      .catch(()=>setDivCal([]));
  },[ticker]);

  // Fundamental fetch — US_STOCK (FMP/EDGAR) veya BIST (İş Yatırım MaliTablo).
  const supportsFund = effectiveType==="US_STOCK"||effectiveType==="BIST";
  const fetchFund=async(force)=>{
    if(!force){
      const cached=fundCacheGet(ticker);
      if(cached){setFund(cached);return;}
    }
    setFundLoading(true);setFundErr("");setFundErrCode("");
    try{
      const r=await edgeCallAuth("fetch-fundamentals",{ticker,asset_type:effectiveType});
      let d=null;
      try{d=await r.json();}catch(_){/* non-JSON */}
      if(r.ok&&d&&d.metrics){
        setFund(d);
        fundCacheSet(ticker,d);
      } else {
        const msg=d?.error||d?.message||`HTTP ${r.status}`;
        setFundErr(msg);
        if(d?.code)setFundErrCode(d.code);
      }
    }catch(e){setFundErr(e.message);}
    setFundLoading(false);
  };
  useEffect(()=>{
    // Desteklenen tipler için fetch (BIST'te İş Yatırım, US'te FMP/EDGAR).
    if(supportsFund&&!fund)fetchFund(false);
  },[ticker,effectiveType]);

  const exchangeShort={XNAS:"NASDAQ",XNYS:"NYSE",ARCX:"NYSE Arca",BATS:"CBOE",IEXG:"IEX"}[meta?.primary_exchange]||meta?.primary_exchange;

  return(
    <div>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
        <button className="btn-sm" onClick={closeDetail}>← Geri</button>
        <div style={{flex:1}}></div>
        {!isBes&&<button className="btn-sm" onClick={()=>fetchMeta(true)} disabled={metaLoading}>{metaLoading?"...":"↻ Meta"}</button>}
      </div>

      {/* Ticker + price */}
      <div className="card" style={{marginBottom:14,padding:"16px 18px"}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:22,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>{ticker}</span>
              {p?.type==="FUND"&&<span className="badge etf">ETF</span>}
              {p?.type==="CRYPTO"&&<span className="badge cry">₿</span>}
              {!p&&<span className="badge etf" data-tip="Portföyünde yok — keşif modu" style={{cursor:"help"}}>YOK</span>}
              {inWatchlist&&<span className="badge" style={{background:"rgba(201,168,76,0.15)",color:"var(--info)",fontSize:10,padding:"2px 7px"}}>İzleniyor</span>}
            </div>
            <div className="dim" style={{fontSize:13,marginTop:2}}>
              {meta?.name||p?.name||"—"}
              {exchangeShort&&<span> · {exchangeShort}</span>}
              {meta?.type&&<span> · {meta.type}</span>}
            </div>
          </div>
          {!hideAmts&&price!=null&&(
            <div style={{textAlign:"right"}}>
              <div className="mono" style={{fontSize:18,fontWeight:600}}>{sym}{fmt(price)}</div>
              {dayChange!=null&&<div className={"mono"+pc(dayChange)} style={{fontSize:12}}>{fmtP(dayChange)} bugün</div>}
            </div>
          )}
        </div>
      </div>

      {onToggleWatchlist&&<div style={{marginBottom:10}}>
        <button className="btn-sm" style={inWatchlist?{color:"var(--err)",border:"1px solid rgba(255,51,102,0.3)"}:{}} onClick={()=>onToggleWatchlist(ticker,assetTypeHint)}>
          {inWatchlist?"− İzlemeden Çıkar":"+ İzlemeye Ekle"}
        </button>
      </div>}

      {/* Pozisyon özeti — 4 ana kart (sadece held ticker için) */}
      {p&&(
        <React.Fragment>
        {isDeposit&&(
          <div className="card" style={{marginBottom:8,padding:"14px 16px"}}>
            <div className="stitle" style={{marginBottom:10}}>Mevduat Özeti</div>
            {(()=>{
              const rows=[
                ["Anapara",mask(sym+fmt(p.shares,0))],
                ["Yıllık Faiz Oranı",((p.interestRate||0)*100).toFixed(2)+"%"],
                ["Vade Tarihi",p.maturityDate?(()=>{
                  const past=depositDaysLeft!=null&&depositDaysLeft<0;
                  const soon=depositDaysLeft!=null&&depositDaysLeft<=30&&!past;
                  const col=past?"var(--err)":soon?"var(--warn)":"var(--ok)";
                  const bg=past?"rgba(255,51,102,0.15)":soon?"rgba(255,184,0,0.15)":"rgba(0,217,126,0.08)";
                  return<span>{fmtDateTR(p.maturityDate)}<span style={{marginLeft:6,fontSize:10,padding:"1px 6px",borderRadius:8,background:bg,color:col}}>{past?"Vadesi geçti":depositDaysLeft===0?"Bugün":"+"+depositDaysLeft+" gün"}</span></span>;
                })():<span style={{fontSize:11,padding:"2px 8px",borderRadius:8,background:"rgba(201,168,76,0.12)",color:"var(--info)"}}>Esnek Hesap</span>],
                ["Brüt Faiz",mask(sym+fmt(depositGross,0))],
                ["Stopaj (%17.5)",mask("−"+sym+fmt(depositGross*DEPOSIT_TAX_RATE,0))],
                ["Net Faiz",<span style={{color:"var(--ok)"}} key="nf">{mask("+"+sym+fmt(depositNet,0))}</span>],
                !p.maturityDate?["Günlük Net Kazanç",mask(sym+fmt(depositNet/depositElapsed,2))]:null,
                ["Güncel Değer",mask(sym+fmt(p.shares+depositNet,0))],
              ].filter(Boolean);
              return(
                <div className="kv">
                  {rows.map(([k,v])=><div key={k}><div className="kk">{k}</div><div className="kv_">{v}</div></div>)}
                </div>
              );
            })()}
            <div style={{marginTop:12,borderTop:"0.5px solid var(--border)",paddingTop:12}}>
              {!showCek?(
                <button className="btn-sm" onClick={()=>setShowCek(true)}>Çek</button>
              ):(
                <div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
                  <div>
                    <div className="kk" style={{marginBottom:3}}>Tarih</div>
                    <input className="finp sm" type="date" value={cekForm.date} onChange={e=>setCekForm(f=>({...f,date:e.target.value}))} max={today()}/>
                  </div>
                  <div>
                    <div className="kk" style={{marginBottom:3}}>Tutar ({sym})</div>
                    <input className="finp sm" type="number" step="any" min="0" placeholder="0" value={cekForm.amount} onChange={e=>setCekForm(f=>({...f,amount:e.target.value}))} style={{width:120}}/>
                  </div>
                  <button className="btn-md pri" onClick={saveCek} disabled={savingCek}>{savingCek?"...":"Çek"}</button>
                  <button className="btn-md" onClick={()=>{setShowCek(false);setCekForm({date:today(),amount:""});}}>İptal</button>
                </div>
              )}
            </div>
          </div>
        )}
        {isBes&&(
          <div className="card" style={{marginBottom:8,padding:"14px 16px"}}>
            <div className="stitle" style={{marginBottom:10}}>BES Özeti</div>
            {(()=>{
              const dkNull=p.dkCurrent==null;
              const kisGuncel=dkNull?null:price-p.dkCurrent;
              const kisGetiri=kisGuncel!=null?kisGuncel-p.avgCost:null;
              const dkGetiri=(p.dkCurrent!=null&&p.dkPrincipal!=null)?p.dkCurrent-p.dkPrincipal:null;
              return(
                <React.Fragment>
                  <div style={{marginBottom:8}}>
                    <div style={{fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"rgba(201,168,76,0.55)",marginBottom:5}}>Kişisel Portföy</div>
                    <div className="kv">
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div className="kk">Yatırılan Tutar</div>
                        <div className="kv_">{mask(sym+fmt(p.avgCost,0))}</div>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div className="kk">Kişisel Güncel</div>
                        <div className="kv_">
                          {dkNull
                            ?<span style={{fontSize:11,color:"var(--warn)"}}>⚠ DK bilgisi güncellenmeli</span>
                            :mask(sym+fmt(kisGuncel,0))}
                        </div>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div className="kk" style={{fontSize:9}}>Yatırım Getirisi</div>
                        <div style={{fontFamily:"var(--font-numeric)",fontSize:12,fontWeight:500}}>
                          {kisGetiri!=null
                            ?<span style={{color:kisGetiri>=0?"var(--ok)":"var(--err)"}}>{mask((kisGetiri>=0?"+":"−")+sym+fmt(Math.abs(kisGetiri),0))}</span>
                            :"—"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{background:"rgba(201,168,76,0.05)",border:"1px solid rgba(201,168,76,0.1)",borderRadius:8,padding:"8px 10px",marginBottom:8}}>
                    <div style={{fontSize:9,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"rgba(201,168,76,0.55)",marginBottom:5}}>Devlet Katkısı</div>
                    <div className="kv">
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div className="kk">DK Anaparası</div>
                        <div className="kv_">{p.dkPrincipal!=null?mask(sym+fmt(p.dkPrincipal,0)):"—"}</div>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div className="kk">DK Güncel</div>
                        <div className="kv_">{p.dkCurrent!=null?mask(sym+fmt(p.dkCurrent,0)):"—"}</div>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div className="kk" style={{fontSize:9}}>DK Getirisi</div>
                        <div style={{fontFamily:"var(--font-numeric)",fontSize:12,fontWeight:500}}>
                          {dkGetiri!=null
                            ?<span style={{color:dkGetiri>=0?"var(--ok)":"var(--err)"}}>{mask((dkGetiri>=0?"+":"−")+sym+fmt(Math.abs(dkGetiri),0))}</span>
                            :"—"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{borderTop:"0.5px solid var(--border)",paddingTop:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",color:"var(--text2)"}}>Toplam Değer</div>
                    <div style={{fontFamily:"var(--font-numeric)",fontSize:16,fontWeight:700,color:"var(--info)"}}>{price!=null?mask(sym+fmt(price,0)):"—"}</div>
                  </div>
                </React.Fragment>
              );
            })()}
          </div>
        )}
        {!isDeposit&&<div className="g4" style={{marginBottom:8}}>
          <div className="card" data-tip="Pozisyondaki toplam adet (split-adjusted)" style={{cursor:"help"}}>
            <div className="lbl">Adet</div>
            <div className="mono" style={{fontSize:16,fontWeight:600}}>{fmtShares(p.shares)}</div>
          </div>
          <div className="card" data-tip="Mevcut pozisyonun toplam maliyeti (Adet × Ort. Maliyet). Daha önce sattıklarının maliyeti dahil değil." style={{cursor:"help"}}>
            <div className="lbl">Toplam Maliyet</div>
            <div className="mono" style={{fontSize:16,fontWeight:600}}>{mask(sym+fmt(currentCost,0))}</div>
          </div>
          <div className="card" data-tip="Bugünkü güncel fiyatla pozisyonun piyasa değeri" style={{cursor:"help"}}>
            <div className="lbl">Piyasa Değeri</div>
            <div className="mono" style={{fontSize:16,fontWeight:600}}>{mv!=null?mask(sym+fmt(mv,0)):"—"}</div>
          </div>
          <div className="card" data-tip="Toplam P&L = Realized + Unrealized = MV + Toplam Satış − Toplam Alış (komisyonlar dahil)" style={{cursor:"help"}}>
            <div className="lbl">Toplam P&L</div>
            <div className={"mono"+(totalPL!=null?pc(totalPL):"")} style={{fontSize:16,fontWeight:600}}>{totalPL!=null?mask((totalPL>=0?"+":"-")+sym+fmt(Math.abs(totalPL),2)):"—"}</div>
            {totalPLPct!=null&&<div className={"mono"+pc(totalPLPct)} style={{fontSize:11,marginTop:2}}>{fmtP(totalPLPct)}</div>}
          </div>
        </div>}
        {p&&price!=null&&p.type!=="BIST"&&p.currency!=="TRY"&&p.avgCost>price*30&&(
          <div className="warn-card" style={{marginBottom:8}}>
            Maliyet tutarı TRY cinsinden girilmiş olabilir ({displaySym(p.currency)} bekleniyor). İşlemi düzeltin ve <b>Ayarlar → ♻️ Yeniden Hesapla</b> çalıştırın.
          </div>
        )}
        {totalDivIncome>0&&(
          <div style={{marginTop:6,padding:"10px 12px",background:"var(--bg3)",borderRadius:8,border:"1px solid rgba(0,217,126,0.15)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:annualDivEst!=null?6:0}}>
              <span className="lbl" style={{color:"var(--ok)"}}>Temettü Geliri</span>
              <span className="ok mono" style={{fontSize:14,fontWeight:600}}>{mask("+"+sym+fmt(totalDivIncome,2))}</span>
            </div>
            {annualDivEst!=null&&(
              <div style={{display:"flex",flexWrap:"wrap",gap:"4px 16px",fontSize:11,color:"var(--text2)"}}>
                <span data-tip="Geçmiş temettülerden hesaplanan tahmini yıllık gelir" style={{cursor:"help"}}>
                  Tahmini Yıllık: <span className="ok mono" style={{fontWeight:600}}>{mask(sym+fmt(annualDivEst,2))}</span>
                </span>
                {yieldOnCost!=null&&(
                  <span data-tip="Tahmini yıllık temettü / Toplam maliyet × 100" style={{cursor:"help"}}>
                    Maliyete Getiri: <span className="ok mono" style={{fontWeight:600}}>{fmtP(yieldOnCost)}</span>
                  </span>
                )}
                {currentYield!=null&&(
                  <span data-tip="Tahmini yıllık temettü / Piyasa değeri × 100" style={{cursor:"help"}}>
                    Cari Getiri: <span className="ok mono" style={{fontWeight:600}}>{fmtP(currentYield)}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}
        </React.Fragment>
      )}

      {/* Detay satırı — Ort. Maliyet · Realized · Unrealized · Komisyon (sadece held için) */}
      {p&&!isDeposit&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:14,padding:"8px 14px",marginBottom:14,fontSize:11,color:"var(--text2)",background:"var(--bg2)",borderRadius:8,border:"0.5px solid var(--border)"}}>
          <span data-tip="Bugün satın alsan birim başına ödediğin ortalama" style={{cursor:"help"}}>
            Ort. Maliyet: <span className="mono" style={{color:"var(--text)"}}>{mask(sym+fmt(p.avgCost))}</span>
          </span>
          <span data-tip="Daha önce yaptığın satışlardan gerçekleşen kâr/zarar (komisyonlar dahil)" style={{cursor:"help"}}>
            Realized: <span className={"mono"+pc(realized)}>{mask((realized>=0?"+":"-")+sym+fmt(Math.abs(realized),2))}</span>
          </span>
          <span data-tip="Mevcut pozisyondaki kağıttaki kâr/zarar (Piyasa Değeri − Toplam Maliyet)" style={{cursor:"help"}}>
            Unrealized: <span className={"mono"+(unrealized!=null?pc(unrealized):"")}>{unrealized!=null?mask((unrealized>=0?"+":"-")+sym+fmt(Math.abs(unrealized),2)):"—"}</span>
          </span>
          <span data-tip="Bu ticker için ödenen tüm komisyonların toplamı (Alış + Satış)" style={{cursor:"help"}}>
            Komisyon: <span className="mono" style={{color:"var(--text)"}}>{mask(sym+fmt(totalCommission,2))}</span>
          </span>
        </div>
      )}

      {/* Non-held için keşif CTA satırı */}
      {!p&&(
        <div className="warn-card" style={{marginBottom:14}}>
          <div>
            <div className="wc-ttl">Bu ticker portföyünde yok</div>
            <div className="wc-sub">Şirket bilgisi ve fundamental analiz aşağıda. Pozisyon eklemek istersen alttaki "+ Ekle" butonunu kullan.</div>
          </div>
        </div>
      )}

      {/* Şirket bilgisi — meta'da gösterilebilir bir alan yoksa hiç render etme. */}
      {!isDeposit&&(()=>{
        const hasDetailMeta = meta && (
          meta.sic_description || meta.industry || meta.market_cap || meta.shares_outstanding ||
          meta.total_employees || meta.list_date || meta.homepage_url || meta.description ||
          meta.pe_ratio || meta.dividend_yield || meta.week_52_high
        );
        if (!hasDetailMeta && !metaLoading && !metaErr) return null;
        return (
        <div className="card" style={{marginBottom:14,padding:"14px 16px"}}>
          <div className="stitle" style={{marginBottom:10}}>Şirket Bilgisi</div>
          {metaLoading&&<SkeletonRows n={3} gap={8}/>}
          {metaErr&&<div className="err" style={{fontSize:12}}>{metaErr}</div>}
          {meta&&!metaLoading&&(()=>{
            const titleCase=(s)=>s?s.replace(/_/g," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()):s;
            const rows=[
              ["Sektör",titleCase(meta.sic_description)],
              ["Endüstri",isBist?titleCase(meta.industry):null],
              ["Market Cap",meta.market_cap?sym+fmtCompact(meta.market_cap):null],
              ["Hisse Sayısı",meta.shares_outstanding?fmtCompact(meta.shares_outstanding):null],
              ["Çalışan",meta.total_employees?meta.total_employees.toLocaleString("tr-TR"):null],
              ["Halka Açılma",meta.list_date?fmtDateTR(meta.list_date):null],
              ["F/K (P/E)",meta.pe_ratio?meta.pe_ratio.toFixed(2):null],
              ["Temettü Verimi",meta.dividend_yield!=null?meta.dividend_yield.toFixed(2)+"%":null],
              (()=>{
                if(isBist||!p||!divCal)return null;
                const todayStr=new Date().toISOString().split("T")[0];
                const next=divCal.find(d=>d.ex_date>=todayStr);
                if(!next||next.amount==null)return null;
                const est=next.amount*(+p.shares);
                return["Sonraki Temettü",`${fmtDateTR(next.ex_date)} · $${fmt(next.amount,4)}/hisse · Tahmini ${mask("$"+fmt(est,2))}`];
              })(),
              ["52H Yüksek",meta.week_52_high?sym+fmt(meta.week_52_high,2):null],
              ["52H Düşük",meta.week_52_low?sym+fmt(meta.week_52_low,2):null],
              // extractDomain malformed URL'de null döner; "null ↗" basmamak için
              // homepage_url ham değil parse-edilebilir doğrulamayla geçer
              ["Web",meta.homepage_url&&extractDomain(meta.homepage_url)?meta.homepage_url:null],
            ].filter(Boolean).filter(([,v])=>v);
            return(
              <div>
                <div className="kv" style={{marginBottom:meta.description?12:0}}>
                  {rows.map(([k,v])=>(
                    <div key={k}>
                      <div className="kk">{k}</div>
                      <div className="kv_">{k==="Web"?<a href={safeUrl(v)} target="_blank" rel="noopener noreferrer" style={{color:"var(--info)",textDecoration:"none"}}>{extractDomain(v)} ↗</a>:v}</div>
                    </div>
                  ))}
                </div>
                {meta.description&&(
                  <div style={{fontSize:12,lineHeight:1.55,color:"var(--text2)"}}>
                    {showFullDesc?meta.description:meta.description.slice(0,260)+(meta.description.length>260?"…":"")}
                    {meta.description.length>260&&(
                      <button onClick={()=>setShowFullDesc(s=>!s)} style={{background:"none",border:"none",color:"var(--info)",fontSize:12,cursor:"pointer",padding:"0 0 0 4px"}}>
                        {showFullDesc?"daha az":"devamı"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        );
      })()}

      {/* Fundamental — değer yatırımı checklist (US_STOCK + BIST) */}
      {supportsFund&&!isDeposit&&(
        <div className="card" style={{marginBottom:14,padding:"14px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <div className="stitle" style={{marginBottom:0}}>Fundamental · Değer Yatırımı Checklist</div>
              {fund?.source==="edgar"&&<span className="badge etf" data-tip="FMP free planında yok; SEC EDGAR'dan çekildi. PE/PS bu modda boş kalır." style={{cursor:"help"}}>EDGAR</span>}
              {fund?.source==="fmp"&&<span className="badge etf" style={{opacity:.5}}>FMP</span>}
              {fund?.source==="isyatirim"&&<span className="badge etf" data-tip="İş Yatırım MaliTablo (XI_29). PE/PS henüz yok; eşikler US tarafıyla aynı (sektör-aware ileride)." style={{cursor:"help"}}>İş Yatırım</span>}
            </div>
            <button className="btn-sm" onClick={()=>fetchFund(true)} disabled={fundLoading}>{fundLoading?"...":(fund?"↻":"Çek")}</button>
          </div>
          {fundLoading&&<SkeletonRows n={5} gap={10}/>}
          {fundErr&&!fundLoading&&fundErrCode==="OUT_OF_PLAN"&&(
            <div className="warn-card">
              <div>
                <div className="wc-ttl">Ticker FMP free planında yok</div>
                <div className="wc-sub">{ticker} için FMP "Special Endpoint" gerekiyor; SEC EDGAR fallback de başarısız oldu (genelde XBRL dosyalanmamış küçük/orta şirketler). Alternatif provider gerek.</div>
              </div>
            </div>
          )}
          {fundErr&&!fundLoading&&fundErrCode!=="OUT_OF_PLAN"&&<div className="err" style={{fontSize:12}}>{fundErr}</div>}
          {!fund&&!fundLoading&&!fundErr&&<div className="dim" style={{fontSize:12}}>Henüz çekilmedi.</div>}
          {fund?.metrics&&!fundLoading&&(()=>{
            // BIST'te PE edge function'da null kalır (market price + shares gerekir).
            // borsa-mcp profile meta.pe_ratio zaten ekranda; fund.metrics'e inject edip
            // checklist'te skor üret. Cache mutate etmemek için lokal kopya.
            const metrics = (fund.source==="isyatirim"&&fund.metrics.pe==null&&meta?.pe_ratio!=null)
              ? {...fund.metrics, pe: meta.pe_ratio}
              : fund.metrics;
            const allScores=Object.entries(metrics).map(([k,v])=>fundScore(k,v)).filter(Boolean);
            const goodN=allScores.filter(s=>s==="good").length;
            // Toplam her zaman tam checklist boyutu (21) — null metrikler de kriter sayılır,
            // sadece "iyi" işareti almazlar
            const totalN=Object.keys(metrics).length;
            const fy=fund.raw?.latestFiscalYear;
            const yb=fund.raw?.yearsBackUsed;
            return(
              <div>
                <div style={{fontSize:11,color:"var(--text2)",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                  <span>{fy?`FY${fy}`:"TTM"}{yb?` · ${yb}Y CAGR`:""} · <strong style={{color:"var(--text)"}}>{goodN}/{totalN}</strong> kriter ✓</span>
                  <span style={{display:"flex",gap:10,alignItems:"center",fontSize:10}}>
                    <span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:7,height:7,borderRadius:"50%",background:"var(--ok)"}}></span>iyi</span>
                    <span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:7,height:7,borderRadius:"50%",background:"var(--warn)"}}></span>orta</span>
                    <span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:7,height:7,borderRadius:"50%",background:"var(--err)"}}></span>zayıf</span>
                  </span>
                </div>
                {FUND_GROUPS.map(([groupName,items])=>(
                  <div key={groupName} style={{marginBottom:14}}>
                    <div className="stitle" style={{marginBottom:6,fontSize:9}}>{groupName}</div>
                    <div style={{background:"var(--bg3)",borderRadius:8,overflow:"hidden"}}>
                      {items.map(([key,label,type],i)=>{
                        const val=metrics[key];
                        const score=fundScore(key,val);
                        const color=score?SCORE_COLOR[score]:"var(--text2)";
                        const dotColor=score?SCORE_COLOR[score]:"var(--text3)";
                        return(
                          <div key={key} data-tip={FUND_TIP[key]}
                            style={{
                              display:"flex",alignItems:"center",gap:10,
                              padding:"8px 12px",
                              borderTop:i>0?"0.5px solid var(--border)":"none",
                              cursor:"help"
                            }}>
                            <span style={{width:7,height:7,borderRadius:"50%",background:dotColor,flex:"0 0 auto"}}></span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:12,color:"var(--text)",lineHeight:1.3}}>{label}</div>
                              <div style={{fontSize:10,color:"var(--text3)",marginTop:1,fontFamily:"'DM Mono',monospace"}}>{fundThreshText(key,type)}</div>
                            </div>
                            <span className="mono" style={{fontSize:14,fontWeight:600,color,flex:"0 0 auto"}}>
                              {fmtFundVal(val,type)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <TrendMiniChart annual={fund?.annual} currency={fund?.raw?.currency==="TRY"?"₺":"$"}/>
                <div style={{fontSize:10,color:"var(--text3)",marginTop:8,lineHeight:1.5}}>
                  Kaynak: {
                    fund?.source==="edgar"?"SEC EDGAR (annual 10-K, son 5 yıl). PE/PS bu modda boş — market price gerek." :
                    fund?.source==="isyatirim"?"İş Yatırım MaliTablo (XI_29 yıllık, son 5 yıl). PE meta'dan; PS henüz yok. Tutarlar TRY; eşikler nominal — TR enflasyonu büyüme metriklerini şişirebilir." :
                    "Financial Modeling Prep (TTM + son 5 yıl)"
                  }. Eşikler genel value-investing kılavuzudur; sektör kıyaslaması her metriğe doğrudan uygulanmaz.
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Analist Tavsiyeleri — sadece US_STOCK + fund.grades */}
      {effectiveType==="US_STOCK"&&!isDeposit&&fund?.grades?.length>0&&(
        <div className="card" style={{marginBottom:16,padding:"14px 16px"}}>
          <div className="stitle" style={{marginBottom:10}}>Analist Tavsiyeleri</div>
          {fund.grades.map((g,i)=>{
            const r=(g.rating||"").toLowerCase();
            const isGood=r.includes("buy")||r.includes("outperform")||r.includes("overweight")||r.includes("strong buy");
            const isBad=r.includes("sell")||r.includes("underperform")||r.includes("underweight")||r.includes("reduce");
            const clr=isGood?"var(--ok)":isBad?"var(--err)":"var(--warn)";
            const bg=isGood?"rgba(0,217,126,0.12)":isBad?"rgba(255,51,102,0.12)":"rgba(255,184,0,0.12)";
            return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderTop:i>0?"1px solid var(--border)":"none"}}>
                <span style={{fontSize:11,color:"var(--text3)",minWidth:72,fontFamily:"'DM Mono',monospace",flexShrink:0}}>{fmtDateTR(g.date)}</span>
                <span style={{flex:1,fontSize:12,color:"var(--text2)",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.company}</span>
                <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,background:bg,color:clr,whiteSpace:"nowrap",flexShrink:0}}>{g.rating}</span>
              </div>
            );
          })}
          <div style={{fontSize:10,color:"var(--text3)",marginTop:8}}>Kaynak: FMP · Son 5 analist tavsiyesi. ↻ ile yenile.</div>
        </div>
      )}

      {/* İşlem geçmişi */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div className="stitle" style={{marginBottom:0}}>İşlem Geçmişi · {tickerTxs.length}</div>
        {!showAdd&&<button className="pri btn-sm" onClick={()=>setShowAdd(true)}>+ Ekle</button>}
      </div>
      {showAdd&&(
        <AddTxInline ticker={ticker} user={user} pos={pos} loadData={loadData} flash_={flash_} onClose={()=>setShowAdd(false)} assetType={effectiveType} portfolioId={portfolioId}/>
      )}
      {tickerTxs.length===0?(
        <div className="dim" style={{fontSize:13,padding:"14px 0"}}>Bu ticker için işlem yok.</div>
      ):(
        <div style={{border:"0.5px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
          {tickerTxs.map(t=>{
            const cSym=t.currency==="TRY"?"₺":"$";
            const isTxDepositOrCash=t.asset_type==="DEPOSIT"||t.asset_type==="CASH";
            const isOpen=expandedTx===t.id;
            const isEdit=editTxId===t.id;
            return(
              <div key={t.id} style={{borderBottom:"0.5px solid var(--border)"}}>
                {/* Özet satır */}
                <div onClick={()=>!isEdit&&setExpandedTx(isOpen?null:t.id)}
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",cursor:isEdit?"default":"pointer"}}>
                  <div style={{display:"flex",gap:10,alignItems:"center",flex:1,flexWrap:"wrap"}}>
                    <span style={{fontSize:11,color:"var(--text2)",fontFamily:"monospace",minWidth:80}}>{fmtDateTR(t.date)}</span>
                    <span className={t.way==="BUY"?"ok":t.way==="DIV"?"warn":"err"} style={{fontSize:11,minWidth:28}}>{t.way==="BUY"?"Alış":t.way==="DIV"?"Temettü":"Satış"}</span>
                    <span className="mono" style={{fontSize:12}}>{isTxDepositOrCash&&t.way==="BUY"?cSym+fmt(t.shares,0)+" yatırılan":isTxDepositOrCash&&t.way==="SELL"?cSym+fmt(t.shares,0)+" çekilen":fmtShares(t.shares)+" adet"}</span>
                    {!hideAmts&&!isTxDepositOrCash&&<span className="mono dim" style={{fontSize:12}}>{mask(cSym+fmt(t.price))}</span>}
                    {!hideAmts&&<span className="mono" style={{fontSize:12,fontWeight:600}}>{mask(cSym+fmt(t.total,0))}</span>}
                    {t.broker&&<span className="dim" style={{fontSize:10}}>{t.broker}</span>}
                    {!hideAmts&&+t.commission>0&&<span className="dim" style={{fontSize:10}}>Kom: {mask(cSym+fmt(+t.commission,2))}</span>}
                  </div>
                  <span style={{color:"var(--text3)",fontSize:11,marginLeft:8}}>{isOpen?"▲":"▼"}</span>
                </div>

                {/* Expand: detay + Düzenle/Sil */}
                {isOpen&&!isEdit&&(
                  <div style={{padding:"10px 14px 12px",background:"var(--bg2)",borderTop:"0.5px solid var(--border)"}}>
                    <div className="kv" style={{marginBottom:10}}>
                      {[
                        ["Tarih",fmtDateTR(t.date)],
                        ["İşlem",t.way==="BUY"?"Alış":t.way==="DIV"?"Temettü":"Satış"],
                        isTxDepositOrCash
                          ?[t.way==="SELL"?"Çekilen Tutar":"Yatırılan Tutar",hideAmts?"••••":cSym+fmt(t.shares,0)]
                          :["Adet",fmtShares(t.shares,6)],
                        !isTxDepositOrCash&&["Birim Fiyat",hideAmts?"••••":cSym+fmt(t.price)],
                        ["Toplam",hideAmts?"••••":cSym+fmt(t.total,2)],
                        ["Komisyon",hideAmts?"••••":cSym+fmt(+t.commission||0,2)],
                        ["Para Birimi",t.currency||"USD"],
                        ["Broker",t.broker||"—"],
                        ["Borsa",t.exchange||"—"],
                        ["Tür",TL[t.asset_type]||t.asset_type||"—"],
                      ].filter(Boolean).map(([k,v])=>(
                        <div key={k}><div className="kk">{k}</div><div className="kv_">{String(v)}</div></div>
                      ))}
                    </div>
                    {t.notes&&(
                      <div style={{marginBottom:10}}>
                        <div className="kk" style={{marginBottom:3}}>Not</div>
                        <div style={{fontSize:12,color:"var(--text2)"}}>{t.notes}</div>
                      </div>
                    )}
                    <div className="brow">
                      <button className="btn-sm" onClick={()=>startEditTx(t)}>Düzenle</button>
                      <button className="btn-sm btn-danger-out" onClick={()=>delTxRow(t)}>Sil</button>
                    </div>
                  </div>
                )}

                {/* Edit form */}
                {isEdit&&(
                  <div style={{padding:"12px 14px",background:"var(--bg3)",borderTop:"0.5px solid var(--border)"}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                      <div><div className="kk" style={{marginBottom:3}}>Tarih</div><input className="finp sm" type="date" value={editForm.date} onChange={e=>setEditForm(f=>({...f,date:e.target.value}))} max={today()}/></div>
                      <div><div className="kk" style={{marginBottom:3}}>İşlem</div>
                        <select className="finp sm" value={editForm.way} onChange={e=>setEditForm(f=>({...f,way:e.target.value}))}>
                          <option value="BUY">Alış</option><option value="SELL">Satış</option><option value="DIV">Temettü</option>
                        </select></div>
                      <div><div className="kk" style={{marginBottom:3}}>Para</div>
                        <select className="finp sm" value={editForm.currency} onChange={e=>setEditForm(f=>({...f,currency:e.target.value}))}>
                          <option>USD</option><option>TRY</option><option>EUR</option>
                        </select></div>
                      <div><div className="kk" style={{marginBottom:3}}>Adet</div><input className="finp sm" type="number" step="any" value={editForm.shares} onChange={e=>setEditForm(f=>({...f,shares:e.target.value}))}/></div>
                      <div><div className="kk" style={{marginBottom:3}}>Fiyat</div><input className="finp sm" type="number" step="any" value={editForm.price} onChange={e=>setEditForm(f=>({...f,price:e.target.value}))}/></div>
                      <div><div className="kk" style={{marginBottom:3}}>Komisyon</div><input className="finp sm" type="number" step="any" value={editForm.commission} onChange={e=>setEditForm(f=>({...f,commission:e.target.value}))}/></div>
                      <div style={{gridColumn:"span 3"}}><div className="kk" style={{marginBottom:3}}>Broker</div><input className="finp sm" maxLength={50} value={editForm.broker} onChange={e=>setEditForm(f=>({...f,broker:e.target.value}))}/></div>
                    </div>
                    <div style={{fontSize:11,color:"var(--text2)",marginBottom:10}}>Toplam: {displaySym(editForm.currency)}{fmt((+editForm.shares)*(+editForm.price),2)}</div>
                    <div className="brow">
                      <button className="pri btn-md" onClick={()=>saveEditTx(t)} disabled={savingTx}>{savingTx?"...":"Kaydet"}</button>
                      <button className="btn-md" onClick={cancelEditTx} disabled={savingTx}>İptal</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

