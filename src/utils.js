// ── Skeleton loading components ──────────────────────────────────
const SkeletonLine=({w="100%",h=12,mb=0,style={}})=>(
  <div className="skel" style={{width:w,height:h,borderRadius:4,marginBottom:mb,...style}}/>
);
const SkeletonCard=()=>(
  <div className="card" style={{gap:6}}>
    <SkeletonLine w={70} h={10} mb={8}/>
    <SkeletonLine w="60%" h={18} mb={4}/>
    <SkeletonLine w={90} h={10}/>
  </div>
);
const SkeletonRows=({n=4,gap=10})=>(
  <div style={{display:"flex",flexDirection:"column",gap}}>
    {Array.from({length:n},(_,i)=>(
      <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
        <SkeletonLine w={`${55+i*15}%`} h={11}/>
        <SkeletonLine w={44} h={20}/>
      </div>
    ))}
  </div>
);
// ── TrendMiniChart ───────────────────────────────────────────────
// annual = [{year,revenue,netIncome,operatingIncome}] (oldest→newest)
// Gelir = dim bar (full), Net Kâr = renkli ince overlay içinde
function TrendMiniChart({annual,currency="$"}){
  if(!annual||annual.length<2)return null;
  const fmtB=v=>{if(v==null)return"—";const a=Math.abs(v);if(a>=1e12)return(v/1e12).toFixed(1)+"T";if(a>=1e9)return(v/1e9).toFixed(1)+"B";if(a>=1e6)return(v/1e6).toFixed(0)+"M";return(v/1e3).toFixed(0)+"K";};
  const W=280,H=80,PL=4,PR=4,PT=6,PB=18;
  const cW=W-PL-PR,cH=H-PT-PB;
  const maxV=Math.max(...annual.map(y=>Math.abs(y.revenue||0)||0));
  if(!maxV)return null;
  const n=annual.length;
  const bW=cW/n,gap=bW*0.18,bw=bW-gap;
  const barH=v=>v==null?0:(Math.abs(v)/maxV)*cH;
  return(
    <div style={{marginTop:10}}>
      <div className="stitle" style={{marginBottom:6,fontSize:9}}>Yıllık Trend (Gelir / Net Kâr)</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block",overflow:"visible"}}>
        {annual.map((y,i)=>{
          const x=PL+i*bW+gap/2;
          const rh=barH(y.revenue);
          const nh=barH(y.netIncome);
          const profit=(y.netIncome??0)>=0;
          return(
            <g key={y.year} data-tip={`${y.year} Gelir: ${currency}${fmtB(y.revenue)} · Net: ${currency}${fmtB(y.netIncome)}`}>
              {y.revenue!=null&&<rect x={x} y={PT+cH-rh} width={bw} height={rh} fill="var(--bg4)" rx={2}/>}
              {y.netIncome!=null&&<rect x={x+bw*.2} y={PT+cH-nh} width={bw*.6} height={Math.max(nh,2)} fill={profit?"var(--ok)":"var(--err)"} opacity={.85} rx={1}/>}
              <text x={x+bw/2} y={H-4} textAnchor="middle" fontSize={8} fill="var(--text3)">{String(y.year).slice(-2)}</text>
            </g>
          );
        })}
      </svg>
      <div style={{display:"flex",gap:12,marginTop:2,fontSize:10,color:"var(--text3)"}}>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,background:"var(--bg4)",borderRadius:2,display:"inline-block"}}/> Gelir</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,background:"var(--ok)",borderRadius:2,display:"inline-block"}}/> Net Kâr</span>
      </div>
    </div>
  );
}
// Currency / FX — display currency toggle (USD/TRY) için merkez yardımcılar.
// fxRates: {USDTRY: 32.5, EURUSD: 1.08} formatında. EUR↔TRY için EUR→USD→TRY chain.
const FX_TTL_MS = 86400000;  // 24 saat
const fxCacheGet = () => {
  const c = LS.get("il_fx", null);
  if(!c || !c.t) return null;
  if(Date.now() - c.t > FX_TTL_MS) return c;  // stale ama yine döndür (fallback)
  return c;
};
const fxCacheSet = (rates) => LS.set("il_fx", { rates, t: Date.now() });

// Fundamental cache (FMP TTM + 5Y + grades) — 24 saat TTL.
// AnalysisTab health/resilience tabloları + TickerDetailTab + App.js eager fetch paylaşır.
const FUND_TTL_MS = 86400000;
const fundCacheGet = (ticker) => {
  const c = LS.get(`fund_${ticker}`, null);
  if (!c || !c.t) return null;
  if (Date.now() - c.t > FUND_TTL_MS) return null;
  return c.d;
};
const fundCacheSet = (ticker, data) => LS.set(`fund_${ticker}`, { d: data, t: Date.now() });
// LS'teki en eski fund cache zamanı (status satırı için "son X sa önce")
const fundCacheOldestTs = (tickers) => {
  let oldest = null;
  for (const t of tickers) {
    const c = LS.get(`fund_${t}`, null);
    if (c?.t && (oldest == null || c.t < oldest)) oldest = c.t;
  }
  return oldest;
};

// Dividend calendar cache — 24 saat TTL. TickerDetailTab "Sonraki Temettü" + Dashboard
// "Bu Ay Beklenen Temettüler" kartı paylaşır. Key: il_divcal_${ticker}.
const DIVCAL_TTL_MS = 24 * 3600000;
const divCalCacheGet = (ticker) => {
  const c = LS.get(`il_divcal_${ticker}`, null);
  if (!c || !c.t) return null;
  if (Date.now() - c.t > DIVCAL_TTL_MS) return null;
  return c.d;
};
const divCalCacheSet = (ticker, data) => LS.set(`il_divcal_${ticker}`, { d: data, t: Date.now() });

// price_cache.updated_at için stale kontrolü. 24 saatten eski ise true.
// Synthetic tipler (CASH/DEPOSIT/BES) price_cache'te değil — onlar için updated_at undefined
// olur ve fonksiyon false döner. CASH/DEPOSIT/BES tip kontrolü caller'da değil, burada
// güvenli (undefined → false).
const isPriceStale = (updatedAtISO, thresholdHours = 24) => {
  if (!updatedAtISO) return false;
  const ts = new Date(updatedAtISO).getTime();
  if (isNaN(ts)) return false;
  return (Date.now() - ts) > thresholdHours * 3600000;
};

const displaySym = (cur) => cur==="TRY" ? "₺" : cur==="EUR" ? "€" : "$";
// from/to currency arasında çeviri. Aynıysa as-is. fxRates eksikse null döner (caller fallback).
const convert = (amount, from, to, fxRates) => {
  if(amount==null||isNaN(+amount)) return null;
  const a = +amount;
  if(from===to) return a;
  if(!fxRates) return null;
  const usdtry = +fxRates.USDTRY;
  const eurusd = +fxRates.EURUSD || 1;  // fallback: EUR ≈ USD (sadece EUR pozisyon yoksa devreye girmez)
  if(!usdtry || usdtry<=0) return null;
  // Önce USD'ye normalize, sonra hedefe çevir
  let usd;
  if(from==="USD") usd = a;
  else if(from==="TRY") usd = a / usdtry;
  else if(from==="EUR") usd = a * eurusd;
  else return null;
  if(to==="USD") return usd;
  if(to==="TRY") return usd * usdtry;
  if(to==="EUR") return usd / eurusd;
  return null;
};
// "DD/MM/YYYY" → "YYYY-MM-DD"; geçersizse null
const parseTRDate = (s)=>{
  if(!s||typeof s!=="string")return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(!m)return null;
  const dd=+m[1], mm=+m[2], yy=+m[3];
  if(mm<1||mm>12||dd<1||dd>31)return null;
  return `${yy}-${String(mm).padStart(2,"0")}-${String(dd).padStart(2,"0")}`;
};

// AI parse sonucunda price boşsa, ticker+date için kapanış fiyatını
// otomatik çekip parsed objesine doldurur. Önce tarih-spesifik dener;
// hafta sonu / market kapalı / Polygon 403 olursa latest (mode:price,
// no date) fallback'i denenir. Hepsi fail olursa sessizce orijinal d
// döner — kullanıcı ConfirmBox'tan manuel girebilir.
const enrichParseWithPrice = async (d) => {
  if (!d || !d.ticker || !d.date) return d;
  if (d.price != null && +d.price > 0) return d;
  const ticker = String(d.ticker).toUpperCase();
  const tryFetch = async (body) => {
    try {
      const r = await edgePriceCall(body);
      const j = await r.json();
      return j?.result?.price || null;
    } catch (_) { return null; }
  };
  const at = d.asset_type;  // edge function BIST routing için
  // 1) Tarih-spesifik kapanış
  let price = await tryFetch({ ticker, mode: "price", date: d.date, asset_type: at });
  if (price) return { ...d, price, _priceAutoFilled: true };
  // 2) Fallback: latest (hafta sonu / future date / 403 senaryoları)
  price = await tryFetch({ ticker, mode: "price", asset_type: at });
  return price ? { ...d, price, _priceAutoFilled: true, _priceFallback: true } : d;
};

// Multi-line parse için array enrichment — paralel çalışır
const enrichParseListWithPrices = async (list) =>
  Promise.all((list||[]).map(d => enrichParseWithPrice(d)));

// SEC ticker DB cache — SearchTab tarafından lazy yüklenir, edge function
// `fetch-fundamentals` mode:"ticker-list" üzerinden proxy ile gelir.
// Dashboard pozisyon blokları — varlık türüne göre gruplama (currency yerine asset_type).
// Her blok kendi natural currency'sinde ham değerlerle render olur. Üst KPI'lar tüm
// pozisyonları display cur'a convert ediyor (ayrı sistem).
const BLOCK_TYPES = [
  {type:"US_STOCK", label:"US Hisse",  cur:"USD", sym:"$", badge:null,  icon:(s=14)=>ASSET_ICONS.US_STOCK(s)},
  {type:"FUND",     label:"ETF / Fon", cur:"USD", sym:"$", badge:"etf", icon:(s=14)=>ASSET_ICONS.FUND(s)},
  {type:"BIST",     label:"BIST",      cur:"TRY", sym:"₺", badge:null,  icon:(s=14)=>ASSET_ICONS.BIST(s)},
  {type:"CRYPTO",   label:"Kripto",    cur:"USD", sym:"$", badge:"cry", icon:(s=14)=>ASSET_ICONS.CRYPTO(s)},
  {type:"GOLD",     label:"Altın",     cur:"USD", sym:"$", badge:null,  icon:(s=14)=>ASSET_ICONS.GOLD(s)},
  {type:"FX",       label:"Döviz",     cur:"USD", sym:"$", badge:null,  icon:(s=14)=>ASSET_ICONS.FX(s)},
  {type:"BES",      label:"BES Fonları",cur:"TRY", sym:"₺", badge:"bes",  icon:(s=14)=>ASSET_ICONS.BES(s)},
  {type:"TEFAS",    label:"TEFAS Fonları",cur:"TRY", sym:"₺", badge:"bes", icon:(s=14)=>ASSET_ICONS.TEFAS(s)},
  {type:"CASH",     label:"Nakit",      cur:"",    sym:"",  mixed:true, badge:null, icon:(s=14)=>ASSET_ICONS.CASH(s)},
  {type:"DEPOSIT",  label:"Vadeli Mevduat",cur:"", sym:"",  mixed:true, badge:null, icon:(s=14)=>ASSET_ICONS.DEPOSIT(s)},
];

// Massive desteği olan emtialar — picker chip listesi.
// Edge function `asset_type:"GOLD"` ile bu sembolleri `C:{SYM}USD` formatına çevirir.
// MVP: pozisyon ons cinsinden (1 ons = 31.1035 gram); gram/TRY display schema migration sonrası.
const COMMODITY_SYMBOLS = [
  {sym:"XAU", name:"Altın"},
  {sym:"XAG", name:"Gümüş"},
  {sym:"XPT", name:"Platin"},
  {sym:"XPD", name:"Paladyum"},
];

// Altın birimleri → troy oz dönüşüm tablosu.
// oz_equivalent = grams * purity / 31.1034
// Piyasa fiyatı XAU/USD ($/oz) × goldOzPerUnit(unit) = $/birim
const GOLD_UNITS = [
  {key:"oz",       label:"Ons (Troy oz)",     grams:31.1034, purity:1},
  {key:"g",        label:"Gram",              grams:1,       purity:1},
  {key:"quarter",  label:"Çeyrek Altın",      grams:1.75,    purity:0.9167},
  {key:"half",     label:"Yarım Altın",       grams:3.5,     purity:0.9167},
  {key:"full",     label:"Tam Altın",         grams:7.0,     purity:0.9167},
  {key:"republic", label:"Cumhuriyet Altını", grams:7.216,   purity:0.9167},
];
const goldOzPerUnit = unit => {
  const u = GOLD_UNITS.find(g => g.key === (unit||'oz')) || GOLD_UNITS[0];
  return (u.grams * u.purity) / 31.1034;
};

// Massive desteği olan popüler kriptolar — picker chip listesi.
// Edge function `asset_type:"CRYPTO"` ile bu sembolleri `X:{SYM}USD` formatına çevirir.
const BENCHMARKS = [
  {ticker:"SPY",   label:"S&P 500",  type:"US_STOCK"},
  {ticker:"XU100", label:"BIST 100", type:"BIST"},
];

const CRYPTO_SYMBOLS = [
  {sym:"BTC",  name:"Bitcoin"},
  {sym:"ETH",  name:"Ethereum"},
  {sym:"SOL",  name:"Solana"},
  {sym:"BNB",  name:"BNB"},
  {sym:"XRP",  name:"XRP"},
  {sym:"ADA",  name:"Cardano"},
  {sym:"DOGE", name:"Dogecoin"},
  {sym:"AVAX", name:"Avalanche"},
  {sym:"DOT",  name:"Polkadot"},
  {sym:"MATIC",name:"Polygon"},
  {sym:"LINK", name:"Chainlink"},
  {sym:"UNI",  name:"Uniswap"},
];

const TICKER_DB_TTL_MS = 86400000;  // 24 saat
// Memory-only fallback — 10k+ ticker LS quota'yı zorlayabilir; LS write fail olsa bile
// sayfa session'ı boyunca cache çalışsın diye memory'de de tut.
let _tickerDbMem = null;
const tickerDbCacheGet = () => {
  if (_tickerDbMem) return _tickerDbMem;
  const c = LS.get("sec_ticker_db_v3", null);
  if (!c || !c.t) return null;
  if (Date.now() - c.t > TICKER_DB_TTL_MS) return null;
  _tickerDbMem = c.list;
  return c.list;
};
const tickerDbCacheSet = (list) => {
  _tickerDbMem = list;  // her durumda memory'de tut
  LS.set("sec_ticker_db_v3", { list, t: Date.now() });  // LS try-catch içinde, fail sessiz
};

// TEFAS fon kataloğu LS cache (24h TTL) — SearchTab birleşik araması besler.
// Ticker-keyed paylaşımlı veri; user-scope prefix gerekmez.
const tefasFundCacheGet = () => {
  const c = LS.get("tefas_fund_db_v1", null);
  if (!c || !c.list || Date.now() - c.t > 24 * 3600 * 1000) return null;
  return c.list;
};
const tefasFundCacheSet = (list) => {
  LS.set("tefas_fund_db_v1", { list, t: Date.now() });
};

const edgeCall = (fn, body) => fetch(`${SUPA_URL}/functions/v1/${fn}`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SUPA_ANON}`
  },
  body: JSON.stringify(body)
});

// parse-transaction için: gerçek kullanıcı JWT'si ile çağır (rate limit doğrulama için).
const edgeCallAuth = async (fn, body) => {
  const { data: { session: sess } } = await sb.auth.getSession();
  if (!sess?.access_token) return new Response(JSON.stringify({error:"Oturum sona erdi"}),{status:401});
  return fetch(`${SUPA_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${sess.access_token}` },
    body: JSON.stringify(body),
  });
};
const edgePriceCall = (body) => edgeCallAuth("fetch-prices", body);

// Fetches split history from FMP for non-BIST tickers and upserts into splits table.
// Called before rebuildPositions so splits are applied in the same cycle.
// Silently ignores failures — worst case the user still has the old (manual) split data.
const syncSplits = async (tickers, portfolioId) => {
  if (!tickers || !tickers.length || !portfolioId) return { inserted: 0, checked: 0 };
  try {
    const r = await edgeCallAuth("sync-splits", { tickers, portfolioId });
    return r.ok ? await r.json() : { inserted: 0, checked: tickers.length };
  } catch (e) {
    DEBUG && console.warn("[syncSplits] failed:", e);
    return { inserted: 0, checked: 0 };
  }
};

// ── Return metrics: Total Return & XIRR ──────────────────────────
// XIRR = düzensiz aralıklı cash flow'ların yıllık getirisi (Excel XIRR).
// cashflows: [{date: Date, amount: number}] — negatif=yatırım, pozitif=geri dönüş.
const yearsBetween = (d1, d0) => (d1.getTime() - d0.getTime()) / (365.25 * 86400000);
const xnpv = (rate, cfs) => cfs.reduce((a, cf) =>
  a + cf.amount / Math.pow(1 + rate, yearsBetween(cf.date, cfs[0].date)), 0);
const xirr = (cfs) => {
  if (!cfs || cfs.length < 2) return null;
  const sorted = [...cfs].sort((a, b) => a.date - b.date);
  // En az bir negatif ve bir pozitif cash flow olmalı — yoksa IRR tanımsız
  const hasNeg = sorted.some(c => c.amount < 0);
  const hasPos = sorted.some(c => c.amount > 0);
  if (!hasNeg || !hasPos) return null;
  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const n = xnpv(rate, sorted);
    if (Math.abs(n) < 1e-6) return rate;
    const deriv = sorted.reduce((a, cf) => {
      const t = yearsBetween(cf.date, sorted[0].date);
      return a - t * cf.amount / Math.pow(1 + rate, t + 1);
    }, 0);
    if (Math.abs(deriv) < 1e-10) return null;
    const next = rate - n / deriv;
    if (!isFinite(next)) return null;
    if (Math.abs(next - rate) < 1e-7) return next;
    rate = next;
  }
  return null; // yakınsamadı
};

// Transaction listesi + bugünkü MV → cash flow serisi (XIRR/TR için).
// BUY: -(total + commission), SELL: (total - commission), bugün: +MV.
const buildCashflows = (txs, todayMV) => {
  const cfs = [];
  for (const t of txs) {
    const c = +t.commission || 0;
    const total = +t.total || 0;
    if (t.way === "BUY") cfs.push({ date: new Date(t.date), amount: -(total + c) });
    else if (t.way === "SELL") cfs.push({ date: new Date(t.date), amount: total - c });
    else if (t.way === "DIV") cfs.push({ date: new Date(t.date), amount: total }); // temettü = net nakit geliri
  }
  if (todayMV > 0) cfs.push({ date: new Date(), amount: todayMV });
  return cfs;
};

// ── Position rebuild (shared by HistoryTab + CSV import) ─────────
// SELL pozisyonda yoksa / shares yetmezse güvenli davran:
// negatif shares/cost oluşturmaz, fazla satış yok sayılır.
// Stock split'ler: bir işlemin tarihinden SONRA gelen her split'in
// ratio'su birikimli olarak uygulanır (shares × factor). Toplam cost
// aynı kalır, shares artar → avg_cost otomatik düşer.
const rebuildPositions = async (userId, portfolioId = null, extraMeta = {}) => {
  let pid = portfolioId;
  if (!pid) {
    const {data:pf} = await sb.from("portfolios").select("id").eq("user_id",userId).order("created_at").limit(1).maybeSingle();
    pid = pf?.id || null;
  }
  if (!pid) { DEBUG && console.warn("[rebuildPositions] no portfolio for user",userId); return null; }

  const [txRes,splitRes] = await Promise.all([
    sb.from("transactions").select("*").eq("user_id",userId).eq("portfolio_id",pid).order("date"),
    sb.from("splits").select("*").eq("user_id",userId).eq("portfolio_id",pid)
  ]);
  const all = txRes.data || [];
  const splits = splitRes.data || [];
  const splitsByT = {};
  splits.forEach(s => { (splitsByT[s.ticker] = splitsByT[s.ticker] || []).push(s); });
  const factorFor = (ticker, date) => {
    const arr = splitsByT[ticker] || [];
    return arr.filter(s => s.split_date > date).reduce((a,s) => a * +s.ratio, 1);
  };

  const pm = {};
  for (const t of all) {
    if (!pm[t.ticker]) {
      const normCur = t.asset_type==="BIST" ? "TRY" : (t.currency==="EUR" ? "EUR" : t.currency==="TRY" ? "TRY" : "USD");
      pm[t.ticker] = {ticker:t.ticker,name:t.name,type:t.asset_type,shares:0,cost:0,currency:normCur,broker:t.broker};
    }
    const p = pm[t.ticker];
    const f = factorFor(t.ticker, t.date);
    const adjShares = +t.shares * f;
    if (t.way === "BUY") {
      p.cost += +t.shares * +t.price;
      p.shares += adjShares;
    } else if (t.way === "SELL" && p.shares > 0) {
      const avg = p.cost / p.shares;
      const qty = Math.min(adjShares, p.shares);
      p.cost = Math.max(0, p.cost - avg * qty);
      p.shares -= qty;
    }
  }

  const snapRes = await sb.from("positions").select("ticker,type,unit,interest_rate,maturity_date,reserve_ratio,dk_principal,dk_current").eq("user_id",userId).eq("portfolio_id",pid);
  const unitMap = Object.fromEntries((snapRes.data||[]).map(p=>[p.ticker,p.unit||null]));
  const depositSnapMap = {};
  const besSnapMap = {};
  for(const p of (snapRes.data||[])){
    if(p.interest_rate!=null||p.maturity_date!=null||p.reserve_ratio){
      depositSnapMap[p.ticker]={interest_rate:p.interest_rate,maturity_date:p.maturity_date,reserve_ratio:p.reserve_ratio??0};
    }
    if(p.type==="BES"){
      besSnapMap[p.ticker]={dk_principal:p.dk_principal,dk_current:p.dk_current};
    }
  }
  const depositMap = {...depositSnapMap, ...extraMeta};
  const besMap = {...besSnapMap, ...extraMeta};

  const np = Object.values(pm).filter(p => p.shares > CFG.DUST_THRESHOLD).map(p => ({
    ticker: p.ticker, name: p.name, type: p.type,
    shares: +p.shares.toFixed(6), avg_cost: +(p.cost/p.shares).toFixed(6),
    currency: p.currency, broker: p.broker,
    unit: unitMap[p.ticker] ?? null,
    interest_rate: depositMap[p.ticker]?.interest_rate ?? null,
    maturity_date: depositMap[p.ticker]?.maturity_date ?? null,
    reserve_ratio: depositMap[p.ticker]?.reserve_ratio ?? 0,
    dk_principal: besMap[p.ticker]?.dk_principal ?? null,
    dk_current:   besMap[p.ticker]?.dk_current   ?? null,
    updated_at: new Date().toISOString()
  }));

  const { error } = await sb.rpc("rebuild_positions_atomic", {
    p_user_id: userId,
    p_portfolio_id: pid,
    p_positions: np
  });

  if (error) {
    DEBUG && console.warn("[rebuildPositions] RPC error:", error);
    return null;
  }
  return np.length;
};

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

  // P0: Piyasa düşüşü — MV-ağırlıklı günlük değişim ≤ -%5 (Sprint 26, Katman 2 davranışsal nudge).
  // Yalnızca d1 olan (fiyat-takipli) pozisyonlar üzerinden ağırlıklandırılır; CASH/DEPOSIT/BES
  // (synthetic, d1 yok) ağırlığa girmez. id gün-damgalı → dismiss 7g sürse de id ertesi gün
  // değişir, böylece her yeni sert düşüş günü nudge yeniden görünür (yeni LS key gerekmez).
  {
    let wMv = 0, wChg = 0;
    for (const p of positions) {
      if (p.mv != null && p.d1 != null) { wMv += p.mv; wChg += p.mv * p.d1; }
    }
    if (wMv > 0) {
      const portChg = wChg / wMv;  // MV-ağırlıklı günlük % değişim
      if (portChg <= -5) {
        const today = new Date().toISOString().split('T')[0];
        nudges.push({
          id: `market_drop_${today}`,
          priority: 0,
          message: `Portföyün bugün %${Math.abs(portChg).toFixed(1)} değer kaybetti. Tezin hâlâ geçerli mi, yoksa duygularla mı karar veriyorsun?`,
          actionTab: 'analysis'
        });
      }
    }
  }

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
  if (!isNaN(xirrNum)) {
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

// Icons
const IconEye    = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="12" rx="11" ry="8"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>;
const IconEyeOff = ()=><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18"/><path d="M10.5 10.7a3 3 0 0 0 3.8 3.8"/><path d="M6.1 6.3A10.9 10.9 0 0 0 1 12s4 8 11 8a10.7 10.7 0 0 0 5.9-1.9"/><path d="M9.4 4.4A10.5 10.5 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.7 3.8"/></svg>;

// Nav ikonları — desktop topbar (s=14) ve mobile bottom-tabs (s=20) için
const NAV_ICONS = {
  dashboard: (s)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>,
  history:   (s)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="3" y1="4" x2="13" y2="4"/><line x1="3" y1="8" x2="13" y2="8"/><line x1="3" y1="12" x2="13" y2="12"/></svg>,
  watchlist: (s)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2h10v12l-5-3-5 3z"/></svg>,
  search:    (s)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="5"/><line x1="11" y1="11" x2="14" y2="14"/></svg>,
  analysis:  (s)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 2 V8 H14"/></svg>,
  settings:  (s)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="2"/><path d="M8 1.5v1.5 M8 13v1.5 M14.5 8h-1.5 M3 8H1.5 M12.6 3.4l-1.1 1.1 M4.5 11.5l-1.1 1.1 M12.6 12.6l-1.1-1.1 M4.5 4.5L3.4 3.4"/></svg>,
  rehber:    (s)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2h7l3 3v9H3z"/><line x1="6" y1="6" x2="10" y2="6"/><line x1="6" y1="9" x2="10" y2="9"/></svg>,
};
const IconPlus = ()=><svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="11" y1="4" x2="11" y2="18"/><line x1="4" y1="11" x2="18" y2="11"/></svg>;

// Varlık türü SVG ikonları — currentColor, ölçeklendirilebilir (s parametresi).
// NAV_ICONS pattern ile aynı — hardcoded renk yok.
const ASSET_ICONS = {
  US_STOCK: (s=24)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  BIST:     (s=24)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="1"/><path d="M3 11 L12 4 L21 11"/><line x1="9" y1="21" x2="9" y2="15"/><line x1="15" y1="21" x2="15" y2="15"/></svg>,
  FUND:     (s=24)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="16" width="20" height="4" rx="1"/><rect x="4" y="10" width="16" height="4" rx="1"/><rect x="7" y="4" width="10" height="4" rx="1"/></svg>,
  CRYPTO:   (s=24)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 20 7 20 17 12 22 4 17 4 7"/><path d="M9 9 C9 9 9 7 12 7 C15 7 15 9 15 10 C15 11.5 12 12 12 12 C15 12 15 13.5 15 15 C15 16 15 18 12 18 C9 18 9 16 9 16"/><line x1="12" y1="6" x2="12" y2="7"/><line x1="12" y1="18" x2="12" y2="19"/></svg>,
  GOLD:     (s=24)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>,
  FX:       (s=24)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12 C2 12 6 4 12 4 C18 4 22 12 22 12 C22 12 18 20 12 20 C6 20 2 12 2 12 Z"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="4" x2="12" y2="2"/><line x1="12" y1="20" x2="12" y2="22"/></svg>,
  BES:      (s=24)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6L12 2z"/><path d="M9 12l2 2 4-4"/></svg>,
  CASH:     (s=24)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>,
  DEPOSIT:  (s=24)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 14h2m2 0h4"/><path d="M8 17h2"/></svg>,
  TEFAS:    (s=24)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 12h8M12 8v8"/></svg>,
};

// Emtia SVG ikonları (COMMODITY_SYMBOLS için)
const COMMODITY_ICONS = {
  XAU: (s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>,
  XAG: (s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12 L11 15 L16 9"/></svg>,
  XPT: (s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>,
  XPD: (s=16)=><svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 L21 7.5 V16.5 L12 21 L3 16.5 V7.5 Z"/><circle cx="12" cy="12" r="3"/></svg>,
};

// signOut'ta çağrılır — tüm il_* localStorage keylerini temizler ki kullanıcı
// değişiminde state sızmasın. Whitelist: il_theme + il_disp_cur cihaz tercihi,
// il_fx paylaşımlı FX cache. User-scoped suffix'li key'ler (il_prc_<uid> vs.)
// startsWith("il_") ile zaten yakalanır.
const clearUserLocalKeys = () => {
  const PRESERVE = new Set(["il_theme", "il_fx", "il_disp_cur"]);
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith("il_") && !PRESERVE.has(k)) {
      localStorage.removeItem(k);
    }
  });
};

// Sprint 22 #5: User-scope LS key prefix. Pattern `il_<base>_<userId>` matches
// the existing SearchTab `il_recent_${userId}` convention so all user-scoped
// keys share one shape. Device-pref keys (`il_theme`, `il_fx`, `il_disp_cur`)
// stay global — they're not in this list.
const USER_SCOPED_LS_BASES = [
  "il_prc",
  "il_hist",
  "il_hide",
  "il_last_fetch",
  "il_nudge_dismissed",
  "il_active_portfolio",
];

const userLSKey = (base, uid) => (uid ? `${base}_${uid}` : base);

// One-time migrator: copies legacy non-scoped value to `il_<base>_<uid>` on
// first login post-deploy. Idempotent — runs every App mount; no-op once the
// legacy key is gone. Existing user-scoped data is never overwritten (per-user
// key wins). Call at the top of App before useState initializers so reads pick
// up the migrated values immediately.
const migrateUserLSKeys = (uid) => {
  if (!uid) return;
  for (const base of USER_SCOPED_LS_BASES) {
    const scopedKey = `${base}_${uid}`;
    if (localStorage.getItem(scopedKey) !== null) continue; // already migrated
    const legacy = localStorage.getItem(base);
    if (legacy === null) continue;
    localStorage.setItem(scopedKey, legacy);
    localStorage.removeItem(base);
  }
};

