// ── Main App ─────────────────────────────────────────────────────
function App({session}){
  const user=session.user;
  const [tab,setTab]=useState("dashboard");
  const [navTicker,setNavTicker]=useState("");
  const [selectedTicker,setSelectedTicker]=useState(null); // detay sayfası için
  const [selectedAssetType,setSelectedAssetType]=useState(null); // search'ten gelen non-held için (BIST vs US)
  const [selectedFromTab,setSelectedFromTab]=useState("dashboard"); // detay'dan "← Geri" hangi sekmeye dönsün
  const openHistory=tk=>{setNavTicker(tk);setTab("history");};
  // openDetail: 3. parametre fromTab — closeDetail kullanıcıyı geldiği sekmeye geri götürür.
  // Default "dashboard" (geri-uyumluluk). Search/History/Analiz'den çağıran taraf kendi tab'ını geçer.
  const openDetail=(tk,assetType,fromTab)=>{
    setSelectedTicker(tk);
    setSelectedAssetType(assetType||null);
    setSelectedFromTab(fromTab||tab||"dashboard");
    setTab("detail");
  };
  const closeDetail=()=>{
    const back=selectedFromTab||"dashboard";
    setSelectedTicker(null);
    setSelectedAssetType(null);
    setTab(back);
  };
  const [period,setPeriod]=useState("max"); // selected period on dashboard
  const [pos,setPos]=useState([]);
  const [txs,setTxs]=useState([]);
  const [splits,setSplits]=useState([]);
  const [profile,setProfile]=useState(null);
  // Portföy listesi + aktif portföy — Faz 1 altyapı.
  // activePortfolioId ileride switcher'dan değişir; şimdilik Ana Portföy otomatik seçilir.
  const [portfolios,setPortfolios]=useState([]);
  // Public portfolio read-only view — ?portfolio=<uuid> URL param
  const [publicViewId,setPublicViewId]=useState(()=>{
    const p=new URLSearchParams(window.location.search).get("portfolio");
    return (p&&/^[0-9a-f-]{36}$/i.test(p))?p:null;
  });
  const [publicViewData,setPublicViewData]=useState(null);
  const [activePortfolioId,setActivePortfolioId]=useState(null); // set by loadData after server validation
  const [prc,setPrc_]=useState(()=>{const p=LS.get("il_prc",null);return p?p.p:{};});
  const [pdate,setPdate]=useState(()=>{const p=LS.get("il_prc",null);return p?p.d:"—";});
  const [hist,setHist_]=useState(()=>LS.get("il_hist",{}));
  const [hide,setHide_]=useState(()=>LS.get("il_hide",false));
  const [displayCur,setDisplayCur_]=useState(()=>LS.get("il_disp_cur","USD"));
  const [themeMode,setThemeMode_]=useState(()=>LS.get("il_theme","system"));
  const [fxRates,setFxRates]=useState(()=>{const c=fxCacheGet();return c?c.rates:null;});
  const [fxAt,setFxAt]=useState(()=>{const c=fxCacheGet();return c?c.t:null;});
  const [sort,setSort]=useState({by:"plPct",dir:"desc"});
  const [sortTry,setSortTry]=useState({by:"plPct",dir:"desc"});
  const [dashTypeFilter,setDashTypeFilter]=useState(()=>BLOCK_TYPES.map(b=>b.type));
  const [collapsedBlocks,setCollapsedBlocks]=useState(()=>new Set(BLOCK_TYPES.map(b=>b.type)));
  const [distMode,setDistMode]=useState("mv"); // "cost" | "mv" — pie chart mode
  const [busy,setBusy]=useState({p:false,h:false,d:false});
  const [pprog,setPprog]=useState("");
  const [lastFetchAt,setLastFetchAt_]=useState(()=>LS.get("il_last_fetch",null));
  const setLastFetchAt=ts=>{setLastFetchAt_(ts);LS.set("il_last_fetch",ts);};
  const [flash,setFlash]=useState(null);
  const [watchlistItems,setWatchlistItems]=useState([]);
  const [connTest,setConnTest]=useState(null);  // {ok:bool, status:int, body:str} — Settings → Bağlantı Test çıktısı
  const [statusOpen,setStatusOpen]=useState(false);
  const [nudgeDismissed,setNudgeDismissed]=useState(()=>LS.get('il_nudge_dismissed',{}));
  const [healthRedCount,setHealthRedCount]=useState(null);

  const savePrc=(p,d)=>{setPrc_(p);setPdate(d);LS.set("il_prc",{p,d});};
  const saveHist=h=>{setHist_(h);LS.set("il_hist",h);};
  const saveHide=v=>{setHide_(v);LS.set("il_hide",v);};
  const setDisplayCur=v=>{setDisplayCur_(v);LS.set("il_disp_cur",v);};
  const applyTheme=(mode)=>{
    let resolved=mode;
    if(mode==="system"){
      resolved=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
    }
    document.documentElement.setAttribute("data-theme",resolved);
  };
  const setThemeMode=v=>{setThemeMode_(v);LS.set("il_theme",v);applyTheme(v);};
  // Tema init — mount'ta bir kez çalıştır
  useEffect(()=>{
    applyTheme(themeMode);
    // "system" modunda sistem tercihi değişirse otomatik güncelle
    const mq=window.matchMedia("(prefers-color-scheme: dark)");
    const handler=()=>{if(LS.get("il_theme","system")==="system")applyTheme("system");};
    mq.addEventListener("change",handler);
    return()=>mq.removeEventListener("change",handler);
  },[]);
  // FX rate fetch — Frankfurter API (ECB resmi rates, auth-free, CORS-friendly).
  // Browser'dan doğrudan çağrılır; edge function gerekmez. Hafta içi günlük güncellenir.
  // Mount'ta + ↻ Güncelle ile tetiklenir; LS cache 24h TTL, fail'de last-known kalır.
  const fetchFxRates=async()=>{
    const needEur = pos.some(p=>p.currency==="EUR") || txs.some(t=>t.currency==="EUR");
    const symbols = needEur ? "TRY,EUR" : "TRY";
    try{
      const r = await fetch(`https://api.frankfurter.dev/v1/latest?from=USD&to=${symbols}`);
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if(!d?.rates) throw new Error("rates field yok");
      const next = {...(fxRates||{})};
      if(d.rates.TRY) next.USDTRY = +d.rates.TRY;
      if(d.rates.EUR) next.EURUSD = 1 / +d.rates.EUR;  // Frankfurter USD→EUR döner; convert helper EUR→USD bekler
      setFxRates(next);
      const t = Date.now();
      setFxAt(t);
      fxCacheSet(next);
    }catch(e){
      DEBUG && console.warn("[fetchFx]",e);
    }
  };
  const flash_=(msg,t="ok")=>{setFlash({msg,t});setTimeout(()=>setFlash(null),CFG.FLASH_MS);};
  const mask=v=>hide?<span className="mask">••••</span>:v;

  const inWatchlist=t=>watchlistItems.some(w=>w.ticker===t);
  const toggleWatchlist=async(ticker,assetType=null)=>{
    if(inWatchlist(ticker)){
      await sb.from("watchlist").delete().eq("user_id",user.id).eq("ticker",ticker);
      setWatchlistItems(prev=>prev.filter(w=>w.ticker!==ticker));
      flash_("İzleme listesinden çıkarıldı","ok");
    } else {
      const row={user_id:user.id,ticker,...(assetType&&{asset_type:assetType})};
      const{data,error}=await sb.from("watchlist").insert(row).select().single();
      if(error){flash_("Eklenemedi","err");return;}
      setWatchlistItems(prev=>[data,...prev]);
      flash_("İzleme listesine eklendi","ok");
    }
  };

  // Async confirm dialog — window.confirm yerine.
  // Kullanım: if(!(await confirm_("Silinsin mi?"))) return;
  const [confirmSt,setConfirmSt]=useState(null);
  const confirm_=(msg,{okLbl="Evet",cancelLbl="İptal",danger=true}={})=>
    new Promise(resolve=>setConfirmSt({msg,okLbl,cancelLbl,danger,resolve}));
  const closeConfirm=(val)=>{if(confirmSt){confirmSt.resolve(val);setConfirmSt(null);}};
  useEffect(()=>{
    if(!confirmSt)return;
    // Esc her zaman iptal eder. Enter sadece güvenli (danger=false) confirm'lerde onaylar;
    // destructive aksiyon için kullanıcı butona tıklamak zorunda — kazara onay riski yok.
    const onKey=e=>{
      if(e.key==="Escape") closeConfirm(false);
      else if(e.key==="Enter" && !confirmSt.danger) closeConfirm(true);
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[confirmSt]);

  // Touch tooltip — dokunmatik cihazlarda hover çalışmadığı için tap-to-show.
  // Tıklanan veya üst elementinde data-tip olan non-interactive element'e
  // data-tip-visible attribute'u ekle → CSS ile hover ile aynı görünüme kavuşur.
  // 2.5 sn sonra otomatik kapanır; dışarı dokunulunca hemen kapanır.
  useEffect(()=>{
    let hideTimer=null;
    const handle=(e)=>{
      // Mevcut açık tooltip'leri temizle
      document.querySelectorAll("[data-tip-visible]").forEach(el=>el.removeAttribute("data-tip-visible"));
      clearTimeout(hideTimer);
      const target=e.target.closest("[data-tip]");
      if(!target)return;
      // button ve a tag'leri için gösterme — bunlar zaten tıklanabilir (data-tip-force ile override edilebilir)
      const tag=target.tagName.toLowerCase();
      const isInteractive=(tag==="button"||tag==="a")&&!target.dataset.tipForce;
      if(isInteractive)return;
      target.setAttribute("data-tip-visible","");
      hideTimer=setTimeout(()=>target.removeAttribute("data-tip-visible"),2500);
    };
    document.addEventListener("touchstart",handle,{passive:true});
    return()=>{document.removeEventListener("touchstart",handle);clearTimeout(hideTimer);};
  },[]);

  const loadData=async()=>{
    setBusy(b=>({...b,d:true}));
    // Adım 1: portfolios + activePortfolioId belirle
    const pfls=await sb.from("portfolios").select("id,name,is_public,privacy_level").eq("user_id",user.id).order("created_at");
    const plist=pfls.data||[];
    setPortfolios(plist);
    let pid=localStorage.getItem("il_active_portfolio");
    const pids=plist.map(p=>p.id);
    if(!pid||!pids.includes(pid)){pid=plist[0]?.id||null;if(pid)localStorage.setItem("il_active_portfolio",pid);}
    setActivePortfolioId(pid);
    if(!pid){setBusy(b=>({...b,d:false}));return;}
    // Adım 2: portfolio-scoped data paralel çek
    const[pr,tr,sr,pc,pf,wl]=await Promise.all([
      sb.from("positions").select("*").eq("user_id",user.id).eq("portfolio_id",pid),
      sb.from("transactions").select("*").eq("user_id",user.id).eq("portfolio_id",pid).order("date",{ascending:false}),
      sb.from("splits").select("*").eq("user_id",user.id),
      sb.from("price_cache").select("*"),
      sb.from("profiles").select("*").eq("user_id",user.id).maybeSingle(),
      sb.from("watchlist").select("id,ticker,asset_type,added_at").eq("user_id",user.id).order("added_at",{ascending:false})
    ]);
    if(pr.data)setPos(pr.data.map(p=>({ticker:p.ticker,name:p.name,type:p.type,shares:+p.shares,avgCost:+p.avg_cost,currency:p.currency,broker:p.broker,unit:p.unit||null})));
    if(tr.data)setTxs(tr.data.map(t=>({id:t.id,date:t.date,ticker:t.ticker,name:t.name,asset_type:t.asset_type,way:t.way,shares:+t.shares,price:+t.price,currency:t.currency,total:+t.total,broker:t.broker,commission:+t.commission,notes:t.notes||""})));
    if(sr.data)setSplits(sr.data);
    if(wl.data)setWatchlistItems(wl.data);
    setProfile(pf?.data||null);
    // Paylaşımlı fiyat cache'ini uygula — LS'teki hist/prc üstüne yazar.
    const cachedSet=new Set((pc.data||[]).map(c=>c.ticker));
    if(pc.data&&pc.data.length){
      const num=v=>v==null?null:+v;
      const nh={...hist},np={...prc};
      let latestDate=pdate;
      for(const c of pc.data){
        nh[c.ticker]={last:num(c.price),d1:num(c.d1),w1:num(c.w1),m1:num(c.m1),y1:num(c.y1),p_d1:num(c.p_d1),p_w1:num(c.p_w1),p_m1:num(c.p_m1),p_m3:num(c.p_m3),p_m6:num(c.p_m6),p_y1:num(c.p_y1)};
        if(c.price!=null)np[c.ticker]=+c.price;
        const d=c.updated_at?.split("T")[0];
        if(d&&(latestDate==="—"||d>latestDate))latestDate=d;
      }
      saveHist(nh);savePrc(np,latestDate);
    }
    setBusy(b=>({...b,d:false}));
  };
  useEffect(()=>{loadData();},[]);
  // Public portfolio view — URL param ile açıldığında portföyü çek
  useEffect(()=>{
    if(!publicViewId)return;
    (async()=>{
      const{data:pf}=await sb.from("portfolios").select("id,name,is_public,privacy_level,user_id").eq("id",publicViewId).eq("is_public",true).maybeSingle();
      if(!pf){flash_("Bu portföy bulunamadı veya gizli","err");setPublicViewId(null);return;}
      let positions=[];
      if(pf.privacy_level==="full"){
        const{data}=await sb.from("positions").select("ticker,name,type,shares,avg_cost,currency").eq("portfolio_id",publicViewId);
        positions=data||[];
      } else if(pf.privacy_level==="allocation_only"){
        const{data,error}=await sb.rpc("get_allocation_only_positions",{p_portfolio_id:publicViewId});
        if(error||data?.error){flash_("Portföy yüklenemedi","err");setPublicViewId(null);return;}
        positions=Array.isArray(data)?data:[];  // guard against null/unexpected shape from RPC
      }
      const{data:owner}=await sb.from("profiles").select("username,display_name,avatar_emoji").eq("user_id",pf.user_id).maybeSingle();
      setPublicViewData({portfolio:pf,positions,owner:owner||{}});
      setTab("publicview");
    })();
  },[publicViewId]);
  // FX: mount + pos/txs değişince EUR ihtiyacı oluşursa tetikle. Cache 24h fresh ise atla.
  useEffect(()=>{
    const fresh = fxAt && (Date.now() - fxAt) < FX_TTL_MS;
    const needEur = pos.some(p=>p.currency==="EUR") || txs.some(t=>t.currency==="EUR");
    const missingEur = needEur && !(fxRates && fxRates.EURUSD);
    if(!fresh || missingEur) fetchFxRates();
  },[pos.length, txs.length]);

  // Sekme geri geldiğinde fiyatlar 30 dk'dan eskiyse otomatik güncelle.
  useEffect(()=>{
    if(!pos.length)return;
    const handle=()=>{
      if(document.visibilityState!=="visible")return;
      const age=lastFetchAt?Date.now()-lastFetchAt:Infinity;
      if(age>30*60*1000&&!busy.p&&!busy.h)fetchPrices();
    };
    document.addEventListener("visibilitychange",handle);
    return()=>document.removeEventListener("visibilitychange",handle);
  },[pos.length,lastFetchAt,busy.p,busy.h]);

  // Her 30 dakikada bir fiyatları otomatik yenile (sekme açık kaldığında).
  useEffect(()=>{
    if(!pos.length)return;
    const id=setInterval(()=>{
      const age=lastFetchAt?Date.now()-lastFetchAt:Infinity;
      if(age>30*60*1000&&!busy.p&&!busy.h)fetchPrices();
    },30*60*1000);
    return()=>clearInterval(id);
  },[pos.length,lastFetchAt,busy.p,busy.h]);

  // pos/watchlist yüklendikten sonra cache'te olmayan ticker'lar için arka planda otomatik fetchHist.
  useEffect(()=>{
    if((!pos.length&&!watchlistItems.length)||busy.h||busy.p)return;
    const posSet=new Set(pos.map(p=>p.ticker));
    const posTickers=pos.filter(p=>p.currency==="USD"||p.type==="BIST"||p.type==="GOLD"||p.type==="CRYPTO").map(p=>p.ticker);
    const wlTickers=watchlistItems.filter(w=>!posSet.has(w.ticker)&&(w.asset_type||"US_STOCK")!=="FX").map(w=>w.ticker);
    const tickers=[...new Set([...posTickers,...wlTickers])];
    const missingPos=tickers.filter(t=>!hist[t]||hist[t].p_y1==null);
    const missingBench=BENCHMARKS.map(b=>b.ticker).filter(t=>!hist[t]||hist[t].p_y1==null);
    const missing=[...new Set([...missingPos,...missingBench])];
    if(missing.length){
      if(missingPos.length)flash_(`${missingPos.length} ticker için tarihi veri otomatik yükleniyor...`,"ok");
      fetchHist(missing);
    }
  },[pos,watchlistItems]);

  // Derived
  // Per-position raw mantık (her currency kendi sembolüyle render edilen tablolar için)
  const wrapPos=(p)=>{
    const price=prc[p.ticker],cost=p.shares*p.avgCost;
    const mv=price!=null?p.shares*price:null,pl=mv!=null?mv-cost:null;
    const h=hist[p.ticker]||null;
    return{...p,price,cost,mv,pl,plPct:(pl!=null&&cost>0)?(pl/cost)*100:null,d1:h?.d1??null,w1:h?.w1??null,m1:h?.m1??null,y1:h?.y1??null};
  };
  // dashTypeFilter: seçili varlık türlerine göre filtrelenmiş pos/txs
  const filteredPos = dashTypeFilter.length === BLOCK_TYPES.length
    ? pos
    : pos.filter(p => dashTypeFilter.includes(p.type));
  const filteredTickers = new Set(filteredPos.map(p=>p.ticker));
  const txsForFilter = txs.filter(t => filteredTickers.has(t.ticker));
  const usd=filteredPos.filter(p=>p.currency==="USD").map(wrapPos);
  const try_=filteredPos.filter(p=>p.currency==="TRY").map(wrapPos);
  const eur=filteredPos.filter(p=>p.currency==="EUR").map(p=>({...p,cost:p.shares*p.avgCost}));
  const dSym=displaySym(displayCur);
  // FX missing: convert null dönerse pozisyon hesap dışı kalır (sayım için tut)
  const fxOk=!!(fxRates && fxRates.USDTRY);
  const cnv=(amt,from)=>convert(amt,from,displayCur,fxRates);
  // Tüm pozisyonların display cur'a normalize edilmiş hali — KPI/pie/sparkline için
  const allDisp=filteredPos.map(p=>{
    const cur=p.currency||"USD";
    // price_cache stores TRY for BIST (Yahoo), USD for all other asset types (Massive).
    const priceCur = p.type==="BIST" ? "TRY" : "USD";
    const price=prc[p.ticker];
    const rawCost=p.shares*p.avgCost;
    const rawMv=price!=null?p.shares*price:null;
    const cost=cnv(rawCost,cur);
    const mv=rawMv!=null?cnv(rawMv,priceCur):null;
    const pl=(mv!=null&&cost!=null)?mv-cost:null;
    return{...p,cost,mv,pl,plPct:(pl!=null&&cost>0)?(pl/cost)*100:null};
  });
  const skipped=allDisp.filter(p=>p.cost==null).length;  // FX yok → kaç pozisyon dışlandı
  const tC=allDisp.reduce((a,p)=>a+(p.cost||0),0);
  const tM=allDisp.reduce((a,p)=>a+(p.mv ?? p.cost ?? 0),0);
  const tP=tM-tC,tPct=tC>0?(tP/tC)*100:null;
  // Total Return: filtreli tx'ler display cur'a convert edilip hesaplanır.
  const txsDisp=txsForFilter.map(t=>{
    const cur=t.currency||"USD";
    return{...t,total:cnv(+t.total||0,cur)??0,commission:cnv(+t.commission||0,cur)??0};
  });
  const totalInvested=txsDisp.filter(t=>t.way==="BUY").reduce((a,t)=>a+(+t.total+(+t.commission||0)),0);
  const totalDivs=txsDisp.filter(t=>t.way==="DIV").reduce((a,t)=>a+(+t.total||0),0);
  const totalReceived=txsDisp.filter(t=>t.way==="SELL").reduce((a,t)=>a+(+t.total-(+t.commission||0)),0)+totalDivs;
  const totalReturn=tM+totalReceived-totalInvested;
  const totalReturnPct=totalInvested>0?(totalReturn/totalInvested)*100:null;
  // XIRR — yıllık % (ondalık olarak döner: 0.23 → %23)
  const annualRate=xirr(buildCashflows(txsDisp,tM));
  // Varlık türü başına iki dağılım: cost ve market value (pie chart toggle için)
  const byTCost={},byTMV={};
  allDisp.forEach(p=>{
    byTCost[p.type]=(byTCost[p.type]||0)+(p.cost||0);
    byTMV[p.type]=(byTMV[p.type]||0)+(p.mv ?? p.cost ?? 0);
  });
  const byT=distMode==="cost"?byTCost:byTMV;
  const pPerf=k=>{const v=usd.filter(p=>p[k]!=null&&p.mv!=null);if(!v.length)return null;const s=v.reduce((a,p)=>a+p.mv,0);return v.reduce((a,p)=>a+p[k]*(p.mv/s),0);};
  const hasH=Object.keys(hist).length>0;
  const sortPos=(arr,st)=>[...arr].sort((a,b)=>{const def=st.dir==="desc"?-Infinity:Infinity;const va=a[st.by]??def,vb=b[st.by]??def;return st.dir==="asc"?va-vb:vb-va;});
  const sorted=sortPos(usd,sort);
  const sortedTry=sortPos(try_,sortTry);
  const tsort=k=>setSort(s=>({by:k,dir:s.by===k&&s.dir==="asc"?"desc":"asc"}));
  const tsortTry=k=>setSortTry(s=>({by:k,dir:s.by===k&&s.dir==="asc"?"desc":"asc"}));
  const sa=k=>sort.by===k?(sort.dir==="asc"?" ↑":" ↓"):"";
  const saTry=k=>sortTry.by===k?(sortTry.dir==="asc"?" ↑":" ↓"):"";
  const top4=fn=>[...usd].filter(p=>p.plPct!=null).sort(fn).slice(0,4);

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const fetchPrices=async()=>{
    setBusy(b=>({...b,p:true}));
    const posSet=new Set(pos.map(p=>p.ticker));
    const posFetchable=pos.filter(p=>p.currency==="USD"||p.type==="BIST"||p.type==="GOLD"||p.type==="CRYPTO")
      .map(p=>({ticker:p.ticker,type:p.type}));
    const wlFetchable=watchlistItems.filter(w=>!posSet.has(w.ticker)&&(w.asset_type||"US_STOCK")!=="FX")
      .map(w=>({ticker:w.ticker,type:w.asset_type||"US_STOCK"}));
    const fetchable=[...posFetchable,...wlFetchable];
    const np={...prc};let cnt=0;const failed=[];
    for(let i=0;i<fetchable.length;i++){
      const {ticker:t,type:at}=fetchable[i];
      setPprog(`${t} (${i+1}/${fetchable.length})`);
      try{
        const r=await edgePriceCall({ticker:t,mode:"price",asset_type:at});
        const d=await r.json();
        if(d.result?.price){np[t]=d.result.price;cnt++;}
        else{failed.push(t);DEBUG && console.warn(`[fetchPrices ${t}]`,d.result?.error||d.error||"no price");}
      }catch(e){failed.push(t);DEBUG && console.warn(`[fetchPrices ${t}]`,e);}
      if(i<fetchable.length-1)await sleep(CFG.RATE_LIMIT_MS);
    }
    savePrc(np,new Date(Date.now()-86400000).toISOString().split("T")[0]);
    // FX rate refresh — display currency conversion için güncel kur
    fetchFxRates();
    setBusy(b=>({...b,p:false}));setPprog("");
    setLastFetchAt(Date.now());
    flash_(`${cnt}/${fetchable.length} fiyat güncellendi`+(failed.length?` · başarısız: ${failed.join(", ")}`:""),failed.length?"err":"ok");
  };

  const fetchHist=async(tickersOverride)=>{
    setBusy(b=>({...b,h:true}));
    // tickersOverride array of strings ise, asset_type'ı pos'tan lookup et
    const benchTypeMap=Object.fromEntries(BENCHMARKS.map(b=>[b.ticker,b.type]));
    const wlTypeMap=Object.fromEntries(watchlistItems.filter(w=>w.asset_type).map(w=>[w.ticker,w.asset_type]));
    const fetchable = tickersOverride
      ? tickersOverride.map(t=>{const p=pos.find(x=>x.ticker===t);return{ticker:t,type:p?.type||wlTypeMap[t]||benchTypeMap[t]||"US_STOCK"};})
      : pos.filter(p=>p.currency==="USD"||p.type==="BIST"||p.type==="GOLD"||p.type==="CRYPTO").map(p=>({ticker:p.ticker,type:p.type}));
    const nh={...hist};const np={...prc};let cnt=0;const failed=[];
    for(let i=0;i<fetchable.length;i++){
      const {ticker:t,type:at}=fetchable[i];
      setPprog(`${t} tarihi (${i+1}/${fetchable.length})`);
      try{
        const r=await edgePriceCall({ticker:t,mode:"historical",asset_type:at});
        const d=await r.json();
        const v=d.result;
        if(v?.price){
          nh[t]={
            last:v.price,
            d1:v.d1,w1:v.w1,m1:v.m1,y1:v.y1,
            p_d1:v.p_d1,p_w1:v.p_w1,p_m1:v.p_m1,
            p_m3:v.p_m3,p_m6:v.p_m6,p_y1:v.p_y1
          };
          np[t]=v.price;cnt++;
        } else {
          failed.push(t);DEBUG&&console.warn(`[fetchHist ${t}]`,v?.error||d.error||"no data");
        }
      }catch(e){failed.push(t);DEBUG && console.warn(`[fetchHist ${t}]`,e);}
      if(i<fetchable.length-1)await sleep(CFG.RATE_LIMIT_MS);
    }
    saveHist(nh);
    savePrc(np,new Date(Date.now()-86400000).toISOString().split("T")[0]);
    setBusy(b=>({...b,h:false}));setPprog("");
    flash_(`${cnt}/${fetchable.length} tarihi veri yüklendi`+(failed.length?` · başarısız: ${failed.join(", ")}`:""),failed.length?"err":"ok");
  };

  const dlCSV=(rows,hdr,name)=>{const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent([hdr,...rows].join("\n"));a.download=name;a.click();};
  // CSV round-trip: virgül / tırnak / satır sonu içeren alanları tırnak içine al.
  const csvEsc=(v)=>{const s=v==null?"":String(v);return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
  const csvRow=(cols)=>cols.map(csvEsc).join(",");
  const expTx=()=>dlCSV(txs.map(t=>csvRow([t.date,t.ticker,t.name||"",t.asset_type||"",t.way,t.shares,t.price,t.currency||"USD",t.total||"",t.broker||"",t.commission||0])),"Date,Ticker,Name,Type,Way,Shares,Price,Currency,Total,Broker,Commission",`txs_${today()}.csv`);
  const expPos=()=>dlCSV(pos.map(p=>csvRow([p.ticker,p.name,p.type,p.shares,p.avgCost,p.currency,p.broker])),"Ticker,Name,Type,Shares,AvgCost,Currency,Broker",`pos_${today()}.csv`);

  const TABS=[["dashboard","Dashboard"],["watchlist","Watchlist"],["analysis","Analiz"],["search","Ara"],["add","+ Ekle"],["settings","Ayarlar"]];

  if(busy.d&&pos.length===0)return(
    <div style={{padding:"16px 16px 0"}}>
      <div className="g3" style={{marginBottom:16}}><SkeletonCard/><SkeletonCard/><SkeletonCard/></div>
      {Array.from({length:5},(_,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 0",borderBottom:"1px solid var(--border)"}}>
          <SkeletonLine w={60} h={13}/>
          <SkeletonLine w={130} h={11}/>
          <div style={{marginLeft:"auto",display:"flex",gap:10}}>
            <SkeletonLine w={60} h={13}/><SkeletonLine w={50} h={13}/>
          </div>
        </div>
      ))}
    </div>
  );

  return(
    <div id="shell">
      <header id="topbar">
        <div className="topbar-left">
          <img src="Logo/logo-mark-dark.png" className="theme-logo theme-logo-dark" alt="Portfoi"/>
          <img src="Logo/logo-mark-light.png" className="theme-logo theme-logo-light" alt="Portfoi"/>
        </div>
        <nav className="topbar-nav">
          {TABS.filter(([id])=>id!=="add").map(([id,lbl])=>(
            // Detay sayfasındayken kullanıcı geldiği sekmeyi vurgulu görür
            <button key={id} className={"tab"+((tab===id||(tab==="detail"&&selectedFromTab===id))?" on":"")} onClick={()=>setTab(id)}>
              {NAV_ICONS[id]&&NAV_ICONS[id](14)}{lbl}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          {(busy.p||busy.h)&&(
            <button disabled style={{minWidth:90}}>
              <span className="spin" style={{width:11,height:11,marginRight:5,verticalAlign:"middle"}}/>
              {pprog||"…"}
            </button>
          )}
          {!(busy.p||busy.h)&&lastFetchAt&&(
            <span style={{fontSize:11,color:"var(--text3)",padding:"4px 4px",whiteSpace:"nowrap"}}
              data-tip="Fiyatlar otomatik yenilenir · Ayarlar'dan manuel güncelle">
              {fmtAge(lastFetchAt)}
            </span>
          )}
          <button className={"eye-btn"+(hide?" on":"")} onClick={()=>saveHide(!hide)} aria-pressed={hide} aria-label={hide?"Tutarları göster":"Tutarları gizle"}>{hide?<IconEyeOff/>:<IconEye/>}</button>
          <button className="pri btn-add-primary" onClick={()=>setTab("add")}>+ İşlem Ekle</button>
        </div>
      </header>

      {flash&&<div className={"flash "+flash.t}>{flash.msg}</div>}

      <main id="app-main">

        {/* DASHBOARD */}
      {tab==="dashboard"&&pos.length===0&&(
        <div className="empty-card">
          <div className="ic">📊</div>
          <div className="ttl">Henüz pozisyon yok</div>
          <div className="sub">İlk yatırımını ekle ve takibe başla. Metin, görüntü, CSV veya manuel giriş yapabilirsin.</div>
          <button className="pri" onClick={()=>setTab("add")}>+ İlk işlemi ekle</button>
        </div>
      )}
      {tab==="dashboard"&&pos.length>0&&(()=>{
        const PERIODS=[
          {key:"d1",  lbl:"1G",  priceKey:"p_d1", days:1},
          {key:"m1",  lbl:"1A",  priceKey:"p_m1", days:30},
          {key:"m3",  lbl:"3A",  priceKey:"p_m3", days:90},
          {key:"m6",  lbl:"6A",  priceKey:"p_m6", days:180},
          {key:"y1",  lbl:"1Y",  priceKey:"p_y1", days:365},
          {key:"max", lbl:"Max", priceKey:null,   days:null},
        ];
        const sel=PERIODS.find(p=>p.key===period)||PERIODS[5];
        // Per-pozisyon seçili periyot değişimi — max=P&L bazlı, diğerleri hist bazlı
        const periodChange=(p)=>{
          const cur=prc[p.ticker];
          if(cur==null)return null;
          if(sel.key==="max"){
            if(p.cost==null||p.mv==null||p.cost<=0)return null;
            const maxRatio=p.mv/p.cost;
            if(maxRatio<0.05||maxRatio>100)return null;
            return{pct:p.plPct,dlr:p.mv-p.cost};
          }
          const base=hist[p.ticker]?.[sel.priceKey];
          if(base==null||base<=0)return null;
          // Sanity: if ratio >100x or <0.05x the currencies almost certainly differ
          // (USD cur vs TRY historic base → ratio ≈ 1/38 ≈ 0.026, caught by <0.05)
          const ratio=cur/base;
          if(ratio>100||ratio<0.05)return null;
          return{pct:(cur/base-1)*100,dlr:p.shares*(cur-base)};
        };

        // Split-aware shares at given date (returns split-adjusted shares
        // in today's reference; uses same factor logic as rebuildPositions).
        const splitsByT={};
        splits.forEach(s=>{(splitsByT[s.ticker]=splitsByT[s.ticker]||[]).push(s);});
        const factorAt=(ticker,date)=>{
          const arr=splitsByT[ticker]||[];
          return arr.filter(s=>s.split_date>date).reduce((a,s)=>a*+s.ratio,1);
        };
        const sharesAt=(ticker,dateStr)=>{
          let s=0;
          for(const t of txs){
            if(t.ticker!==ticker||t.date>dateStr)continue;
            const f=factorAt(t.ticker,t.date);
            if(t.way==="BUY")s+=+t.shares*f;
            else if(t.way==="SELL")s-=+t.shares*f;
          }
          return s;
        };

        // Period-specific Total Return + XIRR. MAX kullanıldığında App-level değerlere düşer.
        // Tüm currency'ler display cur'a convert edilerek birleştirilir.
        const computePeriod=()=>{
          if(sel.key==="max"){
            return{tr:totalReturn,trPct:totalReturnPct,xirrRate:annualRate,startMV:null};
          }
          if(!hasH||sel.priceKey==null)return null;
          const startDate=new Date(Date.now()-sel.days*86400000).toISOString().split("T")[0];
          // Period başı portföy değeri — bugün aktif tickerlar üzerinden, display cur.
          let startMV=0;
          for(const p of allDisp){
            const sh=sharesAt(p.ticker,startDate);
            if(sh<=0)continue;
            const pr=hist[p.ticker]?.[sel.priceKey];
            if(pr==null)continue;
            const raw=sh*pr;
            const conv=cnv(raw,p.currency||"USD");
            if(conv==null)continue;
            startMV+=conv;
          }
          if(startMV<=0)return null;
          const periodTxs=txsDisp.filter(t=>t.date>startDate);
          const buys=periodTxs.filter(t=>t.way==="BUY").reduce((a,t)=>a+(+t.total+(+t.commission||0)),0);
          const sells=periodTxs.filter(t=>t.way==="SELL").reduce((a,t)=>a+(+t.total-(+t.commission||0)),0);
          const tr=(tM+sells)-(startMV+buys);
          const trPct=(startMV+buys)>0?(tr/(startMV+buys))*100:null;
          // XIRR cash flows: başta -startMV, period içi BUY/SELL, son +tM
          const cfs=[{date:new Date(startDate),amount:-startMV}];
          for(const t of periodTxs){
            const c=+t.commission||0,tot=+t.total||0;
            if(t.way==="BUY")cfs.push({date:new Date(t.date),amount:-(tot+c)});
            else if(t.way==="SELL")cfs.push({date:new Date(t.date),amount:tot-c});
          }
          cfs.push({date:new Date(),amount:tM});
          return{tr,trPct,xirrRate:xirr(cfs),startMV};
        };
        const pInfo=computePeriod();

        return(
          <div>
            {/* Fiyat yok uyarısı */}
            {pos.length>0 && Object.keys(prc).length===0 && !busy.p && (
              <div className="warn-card">
                <div>
                  <div className="wc-ttl">Fiyatlar çekilmedi</div>
                  <div className="wc-sub">P&L hesaplamaları için güncel fiyatlar gerekli.</div>
                </div>
                <button className="pri" onClick={fetchPrices}>Şimdi çek</button>
              </div>
            )}
            {/* FX kuru yoksa uyarı — TRY/EUR pozisyonları display cur'a convert edilemiyor */}
            {!fxOk && (try_.length>0||eur.length>0) && (
              <div className="warn-card">
                <div>
                  <div className="wc-ttl">FX kuru yok</div>
                  <div className="wc-sub">{skipped} pozisyon ({displayCur==="USD"?"₺/€":"$/€"}) toplama dahil edilemiyor. Fiyatları güncelle.</div>
                </div>
                <button className="pri" onClick={fetchFxRates}>Şimdi çek</button>
              </div>
            )}
            {/* Nudge kartları — KPI üstünde, max 2; fiyat yoksa gösterme */}
            {Object.keys(prc).length>0&&(()=>{
              const now=Date.now();
              const dismiss=(id)=>{
                const next={...nudgeDismissed,[id]:now+7*24*60*60*1000};
                setNudgeDismissed(next);
                LS.set('il_nudge_dismissed',next);
              };
              const activeNudges=computeNudges(allDisp,txs,healthRedCount,annualRate,displayCur)
                .filter(n=>!nudgeDismissed[n.id]||nudgeDismissed[n.id]<now)
                .slice(0,2);
              if(!activeNudges.length)return null;
              return activeNudges.map(n=>(
                <div key={n.id} className="warn-card" style={{alignItems:'center'}}>
                  <div className="wc-sub" style={{flex:1}}>{n.message}</div>
                  {n.actionCard&&(
                    <button
                      style={{background:'none',border:'none',color:'var(--info)',cursor:'pointer',fontSize:12,padding:'0 8px',flexShrink:0,whiteSpace:'nowrap'}}
                      onClick={()=>{
                        setTab(n.actionTab);
                        setTimeout(()=>{
                          const el=document.querySelector(`[data-card="${n.actionCard}"]`);
                          if(el)window.scrollTo({top:el.offsetTop-68,behavior:'smooth'});
                        },400);
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
            })()}
            {/* Summary cards. Maliyet/MV period-bağımsız; TR period'a göre.
                XIRR sadece ≥1Y periyotlarda anlamlı — kısa periyotta "—" + hint.
                Tüm değerler displayCur ($ veya ₺) — TRY/EUR pozisyonlar fxRates ile convert. */}
            {(()=>{
              const longPeriod=sel.key==="max"||sel.key==="y1";
              return(
                <div className="g3">
                  {/* Kart 1: Piyasa Değeri (büyük) + Maliyet (ikincil) */}
                  <div className="card" data-tip="Bugünkü güncel fiyatlarla portföy değeri. Tüm currency'ler displayCur'a convert. Period'dan bağımsız." style={{cursor:"help"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <div className="lbl" style={{marginBottom:0}}>Piyasa Değeri</div>
                      <div className="cur-seg" style={{background:"var(--bg3)"}} data-tip={fxRates?.USDTRY?`1 $ ≈ ₺${fmt(fxRates.USDTRY,2)}`:"FX kuru henüz çekilmedi"}>
                        <button className={displayCur==="USD"?"on":""} onClick={()=>setDisplayCur("USD")} aria-label="USD göster">$</button>
                        <button className={displayCur==="TRY"?"on":""} onClick={()=>setDisplayCur("TRY")} aria-label="TRY göster">₺</button>
                      </div>
                    </div>
                    <div style={{fontSize:32,fontWeight:400,fontFamily:"var(--font-display)",letterSpacing:"-0.02em",lineHeight:1.1}}>{mask(dSym+fmt(tM))}</div>
                    <div style={{marginTop:8,paddingTop:7,borderTop:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                      <span className="lbl" style={{marginBottom:0}}>Maliyet</span>
                      <span className="mono dim" style={{fontSize:12}}>{mask(dSym+fmt(tC))}</span>
                    </div>
                  </div>
                  {/* Kart 2: Total Return % (büyük) + tutar (ikincil) */}
                  <div className="card" data-tip={"Period boyunca toplam getiri: (Bugün MV + Period Satışları) − (Period Başı MV + Period Alımları). Tüm currency'ler displayCur'a convert. Realize + unrealize, komisyonlar dahil."} style={{cursor:"help"}}>
                    <div className="lbl">Total Return ({sel.lbl})</div>
                    <div className={"mono"+(pInfo&&pInfo.trPct!=null?pc(pInfo.trPct):"")} style={{fontSize:16,fontWeight:600}}>
                      {pInfo&&pInfo.trPct!=null?mask(fmtP(pInfo.trPct)):"—"}
                    </div>
                    {pInfo&&pInfo.tr!=null&&(
                      <div className={"mono"+(pc(pInfo.tr))} style={{fontSize:11,marginTop:2}}>
                        {mask((pInfo.tr>=0?"+":"-")+dSym+fmt(Math.abs(pInfo.tr),2))}
                      </div>
                    )}
                  </div>
                  {/* Kart 3: XIRR */}
                  <div className="card" data-tip="Cash flow tabanlı yıllıklandırılmış iç verim oranı (Excel XIRR). Para zamanlamasını dikkate alır. Kısa periyotlarda matematiksel olarak hesaplanabilir ama yanıltıcı olduğu için ≥1Y'de gösterilir." style={{cursor:"help"}}>
                    <div className="lbl">Yıllık (XIRR)</div>
                    <div className={"mono"+(longPeriod&&pInfo&&pInfo.xirrRate!=null?pc(pInfo.xirrRate):"")} style={{fontSize:16,fontWeight:600}}>
                      {longPeriod&&pInfo&&pInfo.xirrRate!=null?mask(fmtP(pInfo.xirrRate*100)):"—"}
                    </div>
                    {!longPeriod&&<div className="dim" style={{fontSize:10,marginTop:2}}>≥1Y için gösterilir</div>}
                  </div>
                </div>
              );
            })()}

            {/* Period selector */}
            <div className="fbar" style={{marginBottom:16}}>
              {PERIODS.map(p=>{
                const refTk=(usd[0]||try_[0])?.ticker;
                const available=p.key==="max"||(hasH&&refTk&&hist[refTk]?.[p.priceKey]!=null);
                return(
                  <button key={p.key}
                    onClick={()=>setPeriod(p.key)}
                    disabled={!available&&p.key!=="max"}
                    style={{
                      flex:"0 0 auto",fontSize:12,padding:"5px 14px",
                      background:period===p.key?"var(--info)":"var(--bg2)",
                      borderColor:period===p.key?"var(--info)":"var(--border2)",
                      color:period===p.key?"#fff":available?"var(--text)":"var(--text3)",
                    }}>{p.lbl}</button>
                );
              })}
            </div>

            {/* Benchmark karşılaştırması — SPY + XU100, seçili periyot */}
            {sel.key!=="max"&&BENCHMARKS.some(b=>hist[b.ticker]?.last)&&(
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                <span style={{fontSize:10,color:"var(--text3)",fontWeight:500,textTransform:"uppercase",letterSpacing:.5}}>Benchmark</span>
                {BENCHMARKS.map(b=>{
                  const h=hist[b.ticker];
                  if(!h?.last)return null;
                  const ret=(["d1","w1","m1","y1"].includes(sel.key))
                    ?h[sel.key]
                    :(h[{m3:"p_m3",m6:"p_m6"}[sel.key]]?((h.last/h[{m3:"p_m3",m6:"p_m6"}[sel.key]])-1)*100:null);
                  return(
                    <span key={b.ticker} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 9px",borderRadius:8,background:"var(--bg3)",fontSize:11}}>
                      <span style={{color:"var(--text2)"}}>{b.label}</span>
                      {ret!=null
                        ?<span className={"mono"+(ret>=0?" ok":" err")} style={{fontWeight:600}}>{fmtP(ret)}</span>
                        :<span style={{color:"var(--text3)"}}>—</span>}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Period başlangıç bilgisi — hist yoksa veya yetersizse uyarı */}
            {sel.key!=="max"&&!pInfo&&(
              <div className="warn-card" style={{marginBottom:16}}>
                <div>
                  <div className="wc-ttl">{sel.lbl} için yeterli veri yok</div>
                  <div className="wc-sub">Tarihi fiyatlar eksik veya bu period başında pozisyonunuz yoktu.</div>
                </div>
              </div>
            )}

            {[...BLOCK_TYPES].sort((a,b)=>{
              const mvOf=t=>filteredPos.filter(p=>p.type===t).map(wrapPos).reduce((s,p)=>s+(p.mv??p.cost),0);
              const toUsd=(mv,t)=>t==="BIST"?(convert(mv,"TRY","USD",fxRates)??0):mv;
              return toUsd(mvOf(b.type),b.type)-toUsd(mvOf(a.type),a.type);
            }).map((cfg, idx) => {
              const items = filteredPos.filter(p => p.type===cfg.type).map(p=>{const w=wrapPos(p);const chg=periodChange(w);return{...w,periodChgPct:chg?.pct??null,periodChgDlr:chg?.dlr??null};});
              if(items.length===0) return null;
              const sortedItems = sortPos(items, sort);
              const totMv = items.reduce((a,p)=>a+(p.mv ?? p.cost),0);
              const itemsWithChg = items.filter(p=>p.periodChgDlr!=null);
              const blockDeltaDlr = itemsWithChg.reduce((s,p)=>s+p.periodChgDlr,0);
              const blockStartMv = itemsWithChg.reduce((s,p)=>s+(p.mv??p.cost)-p.periodChgDlr,0);
              const blockDeltaPct = blockStartMv>0 ? (blockDeltaDlr/blockStartMv*100) : null;
              const missingPriceCount = items.length - itemsWithChg.length;
              const isOpen = !collapsedBlocks.has(cfg.type);
              const toggleBlock = () => setCollapsedBlocks(prev=>{const n=new Set(prev);n.has(cfg.type)?n.delete(cfg.type):n.add(cfg.type);return n;});
              return(
                <div key={cfg.type} style={{marginTop:idx===0?0:20}}>
                  {/* Blok başlık — tıklanınca collapse; Alt B: accent-line pattern */}
                  <div onClick={toggleBlock} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:"var(--bg3)",borderRadius:isOpen?"10px 10px 0 0":"10px",cursor:"pointer",userSelect:"none"}}>
                    <span style={{fontSize:17,fontWeight:700,color:"var(--text)",letterSpacing:"-0.3px"}}>{cfg.label}</span>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      {blockDeltaPct!=null&&(
                        <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,background:blockDeltaDlr>=0?"rgba(0,217,126,0.15)":"rgba(255,51,102,0.15)",color:blockDeltaDlr>=0?"var(--ok)":"var(--err)"}}>
                          {(blockDeltaDlr>=0?"+":"")+blockDeltaPct.toFixed(1)+"%"}
                        </span>
                      )}
                      {missingPriceCount>0&&blockDeltaPct!=null&&(
                        <span style={{fontSize:10,color:"var(--text3)"}} data-tip={`${missingPriceCount} ticker için ${sel.lbl} fiyatı eksik`}>{missingPriceCount} eksik</span>
                      )}
                      {!hide&&<span style={{fontSize:15,fontWeight:500,fontFamily:"var(--font-numeric)",color:"var(--text)"}}>{mask(cfg.sym+fmt(totMv,0))}</span>}
                      <span style={{fontSize:11,color:"var(--text3)"}}>{isOpen?"▾":"▸"}</span>
                    </div>
                  </div>

                  {isOpen&&<div style={{borderLeft:"3px solid var(--info)",background:"var(--bg2)",borderRadius:"0 0 10px 10px",paddingTop:4,paddingBottom:4,marginBottom:8}}>
                  {/* Desktop tablo */}
                  <div className="tbl-wrap pos-tbl-desktop">
                    <table>
                      <thead><tr>
                        <th scope="col" className="l" onClick={()=>tsort("ticker")}>Ticker{sa("ticker")}</th>
                        {!hide&&<th scope="col" className="r" onClick={()=>tsort("shares")}>Adet{sa("shares")}</th>}
                        {!hide&&<th scope="col" className="r">Fiyat</th>}
                        {!hide&&<th scope="col" className="r" onClick={()=>tsort("mv")}>Değer{sa("mv")}</th>}
                        <th scope="col" className="r" onClick={()=>tsort("plPct")} data-tip="(Değer − Maliyet) / Maliyet × 100">P&L%{sa("plPct")}</th>
                        {hasH&&<th scope="col" className="r" onClick={()=>tsort("periodChgPct")} data-tip={`Seçili periyot (${sel.lbl}) fiyat değişimi`}>Δ {sel.lbl}{sa("periodChgPct")}</th>}
                      </tr></thead>
                      <tbody>
                        {sortedItems.map(p=>{
                          const isGU2=p.type==="GOLD"&&p.unit&&p.unit!=="oz";
                          const ozF2=isGU2?goldOzPerUnit(p.unit):1;
                          const curPrc=prc[p.ticker];
                          return(
                          <tr key={p.ticker} className="pos-row" onClick={()=>openDetail(p.ticker)}>
                            <td className="l"><div className="tcell"><span className="tsym">{p.ticker}</span><span className="tname">{p.name}</span></div></td>
                            {!hide&&<td className="r">{(()=>{if(isGU2){const lbl={g:"g",quarter:"çeyrek",half:"yarım",full:"tam",republic:"Cumh."}[p.unit]||p.unit;return <>{fmtShares(p.shares/ozF2)}<span style={{fontSize:10,color:"var(--text2)",marginLeft:2}}>{lbl}</span></>;}return fmtShares(p.shares);})()}</td>}
                            {!hide&&<td className="r mono" style={{color:"var(--text2)"}}>{curPrc!=null?mask(cfg.sym+fmt(curPrc*ozF2,2)):"—"}</td>}
                            {!hide&&<td className="r">{p.mv?mask(cfg.sym+fmt(p.mv,0)):"—"}</td>}
                            <td className={"r"+pc(p.plPct)}>{fmtP(p.plPct)}</td>
                            {hasH&&<td className="r">{(()=>{if(p.periodChgPct==null)return"—";return<><div className={"mono"+pc(p.periodChgPct)} style={{fontWeight:600,fontSize:12,lineHeight:1.25}}>{fmt(Math.abs(p.periodChgPct),1)}%</div><div className={"mono"+pc(p.periodChgPct)} style={{fontSize:10,opacity:.75}}>{cfg.sym}{fmt(Math.abs(p.periodChgDlr),0)}</div></>;})()}</td>}
                          </tr>
                        );})}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile kart listesi */}
                  <div className="pos-card-list">
                    <div className="pos-sort-bar">
                      <span>Sırala</span>
                      {[["plPct","P&L%"],["periodChgPct","Δ "+sel.lbl],["mv","Değer"]].map(([k,lbl])=>(
                        <button key={k} className={"psb-btn"+(sort.by===k?" on":"")} onClick={()=>tsort(k)}>{lbl}{sa(k)}</button>
                      ))}
                    </div>
                    {sortedItems.map(p=>{
                      const isGU=p.type==="GOLD"&&p.unit&&p.unit!=="oz";
                      const ozF=isGU?goldOzPerUnit(p.unit):1;
                      const uLbl=isGU?({g:"g",quarter:"çeyrek",half:"yarım",full:"tam",republic:"Cumh."}[p.unit]||p.unit):"";
                      const adetStr=fmtShares(p.shares/ozF)+(uLbl?" "+uLbl:"");
                      const curPrice=prc[p.ticker];
                      const priceStr=curPrice!=null?cfg.sym+fmt(curPrice*ozF,2):"—";
                      const cPct=p.periodChgPct,cDlr=p.periodChgDlr,hasC=cPct!=null;
                      const pos=hasC&&cPct>=0;
                      return(
                        <div key={p.ticker} className="pcr" onClick={()=>openDetail(p.ticker)}>
                          <div className="pcr-left">
                            <span className="pcr-ticker">{p.ticker}</span>
                            <span className="pcr-sub">{hide?"•••• | ••••":`${adetStr} | ${priceStr}`}</span>
                          </div>
                          <div className="pcr-right">
                            <span className="pcr-mv">{p.mv!=null?mask(cfg.sym+fmt(p.mv,0)):"—"}</span>
                            <span className={"pcr-chg"+(hasC?(pos?" ok":" err"):"")}>
                              {hide?"••••":hasC?`${cfg.sym}${fmt(Math.abs(cDlr),0)}  ${fmt(Math.abs(cPct),1)}%`:"—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </div>}

                </div>
              );
            })}

            <div style={{fontSize:11,color:"var(--text2)",marginTop:8}}>
              {txs.length} işlem · {pos.length} pozisyon
              {!hasH&&<span style={{marginLeft:8}}>· Tarihi veri için Ayarlar → "Tarihi Veri" butonu</span>}
            </div>
            <div style={{fontSize:10,color:"var(--text3)",marginTop:6,lineHeight:1.5}}>
              <strong style={{color:"var(--text2)"}}>P&L%</strong>: alış maliyetinden bugüne unrealized · <strong style={{color:"var(--text2)"}}>1G</strong>: dünkü kapanışa göre fiyat değişimi · Detay için satıra tıkla
            </div>

            {/* EUR pozisyonları — provider yok, cost-only kalır */}
            {eur.length>0 && (()=>{
              const totCost=eur.reduce((a,p)=>a+p.cost,0);
              return(
                <div style={{marginTop:22}}>
                  <div className="stitle">EUR Pozisyonları · {mask("€"+fmt(totCost,0))} maliyet</div>
                  <div className="tbl-wrap">
                    <table>
                      <thead><tr>
                        <th scope="col" className="l">Ticker</th>
                        {!hide&&<th scope="col" className="r">Adet</th>}
                        {!hide&&<th scope="col" className="r">Ort. Maliyet</th>}
                        {!hide&&<th scope="col" className="r">Toplam</th>}
                        <th scope="col" className="l">Broker</th>
                      </tr></thead>
                      <tbody>
                        {[...eur].sort((a,b)=>a.ticker.localeCompare(b.ticker)).map(p=>(
                          <tr key={p.ticker} className="pos-row" onClick={()=>openDetail(p.ticker)}>
                            <td className="l"><div className="tcell"><span className="tsym">{p.ticker}</span><span className="tname">{p.name}</span></div></td>
                            {!hide&&<td className="r">{fmtShares(p.shares)}</td>}
                            {!hide&&<td className="r">{mask("€"+fmt(p.avgCost))}</td>}
                            {!hide&&<td className="r">{mask("€"+fmt(p.cost,0))}</td>}
                            <td className="l" style={{fontSize:11,color:"var(--text2)"}}>{p.broker||"—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="dim" style={{fontSize:10,marginTop:4}}>ℹ EUR için güncel fiyat desteği yok — yalnızca maliyet gösteriliyor.</div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* HISTORY */}
      {tab==="history"&&(
        <HistoryTab txs={txs} user={user} loadData={loadData} flash_={flash_} confirm_={confirm_} mask={mask} hideAmts={hide} setTab={setTab} openDetail={openDetail} initialSearch={navTicker} onConsume={()=>setNavTicker("")} splits={splits} portfolioId={activePortfolioId} pos={pos} displayCur={displayCur} fxRates={fxRates}/>
      )}

      {/* WATCHLIST */}
      {tab==="watchlist"&&(
        <WatchlistTab items={watchlistItems} prc={prc} hist={hist} onToggle={toggleWatchlist} openDetail={openDetail} setTab={setTab} hideAmts={hide} mask={mask}/>
      )}


      {/* ANALYSIS */}
      {tab==="analysis"&&(
        <AnalysisTab pos={pos} txs={txs} splits={splits} prc={prc} hist={hist} hide={hide} mask={mask} setTab={setTab} displayCur={displayCur} fxRates={fxRates} openDetail={openDetail} onHealthSummary={setHealthRedCount}/>
      )}

      {/* SEARCH */}
      {tab==="search"&&(
        <SearchTab pos={pos} txs={txs} openDetail={openDetail} flash_={flash_} watchlistItems={watchlistItems} onToggleWatchlist={toggleWatchlist} userId={user?.id}/>
      )}

      {/* ADD */}
      {tab==="add"&&(
        <AddTab session={session} user={user} pos={pos} loadData={loadData} flash_={flash_} confirm_={confirm_} portfolioId={activePortfolioId}/>
      )}

      {/* DETAIL — pos-row click ile açılır, tab listesinde yok */}
      {tab==="detail"&&selectedTicker&&(
        <TickerDetailTab
          ticker={selectedTicker} assetTypeHint={selectedAssetType}
          pos={pos} txs={txs} prc={prc} hist={hist}
          user={user} confirm_={confirm_} flash_={flash_} loadData={loadData}
          closeDetail={closeDetail} hideAmts={hide} mask={mask} portfolioId={activePortfolioId}
          inWatchlist={inWatchlist(selectedTicker||"")} onToggleWatchlist={toggleWatchlist}/>
      )}

      {/* PUBLIC PORTFOLIO VIEW — ?portfolio=<uuid> */}
      {tab==="publicview"&&publicViewData&&(()=>{
        const{portfolio,positions,owner}=publicViewData;
        const isFull=portfolio.privacy_level==="full";
        const rows=isFull
          ? (()=>{
              const totalVal=positions.reduce((a,p)=>a+(p.avg_cost||0)*p.shares,0);
              return positions.map(p=>({
                ...p,
                pct:totalVal>0?(p.avg_cost||0)*p.shares/totalVal*100:0,
              })).sort((a,b)=>b.pct-a.pct);
            })()
          : [...positions].sort((a,b)=>b.pct-a.pct);
        return(
          <div>
            {/* Banner */}
            <div style={{position:"sticky",top:52,zIndex:90,background:"rgba(255,184,0,0.12)",borderBottom:"1px solid rgba(255,184,0,0.25)",padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:"var(--warn)"}}>🔒 Bu portföy salt okunur görünümdür — tutar ve maliyet bilgileri gizlidir</span>
              <button className="btn-xs" onClick={()=>{setPublicViewId(null);setPublicViewData(null);setTab("dashboard");}}>Kendi Portföyüne Dön</button>
            </div>
            <div style={{padding:"16px 16px 80px"}}>
              {/* Portföy başlık kartı */}
              <div className="card" style={{marginBottom:16,padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:28}}>{owner.avatar_emoji||"👤"}</span>
                  <div>
                    <div style={{fontSize:15,fontWeight:600}}>{portfolio.name}</div>
                    <div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>
                      {owner.display_name||owner.username||"Anonim kullanıcı"}
                      {owner.username&&<span className="mono" style={{marginLeft:6,fontSize:11}}>@{owner.username}</span>}
                    </div>
                  </div>
                </div>
              </div>
              {/* Pozisyon listesi */}
              {rows.length===0?(
                <div className="empty-card"><div className="ttl">Bu portföyde pozisyon yok</div></div>
              ):(
                <div className="card" style={{padding:"14px 16px"}}>
                  <div className="stitle" style={{marginBottom:12}}>
                    {isFull?"Pozisyonlar":"Varlık Dağılımı"}
                    {" "}<span style={{fontWeight:400,color:"var(--text3)"}}>{rows.length} varlık</span>
                  </div>
                  {rows.map((p,i)=>(
                    <div key={p.ticker} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:i<rows.length-1?"1px solid var(--border)":"none"}}>
                      <span className="tsym" style={{flex:"0 0 70px"}}>{p.ticker}</span>
                      <span style={{flex:1,fontSize:11,color:"var(--text3)"}}>{p.name||p.type}</span>
                      <div style={{flex:"0 0 120px",height:6,background:"var(--bg3)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{width:p.pct+"%",height:"100%",background:TYPE_COLORS[p.type]||"var(--info)"}}/>
                      </div>
                      <span className="mono" style={{flex:"0 0 48px",textAlign:"right",fontSize:12,color:"var(--text2)"}}>{p.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* SETTINGS */}
      {tab==="settings"&&(
        <div>
          {/* 1. Hesap */}
          <AccountSection user={user} profile={profile} flash_={flash_} confirm_={confirm_} onSaved={loadData}/>

          {/* 2. Portföy — conditional */}
          {activePortfolioId && portfolios.length > 0 && (()=>{
            const portfolio = portfolios.find(p => p.id === activePortfolioId);
            if (!portfolio) return null;
            const isPublic = portfolio.is_public;
            const privLevel = portfolio.privacy_level || "allocation_only";
            const togglePublic = async () => {
              if (!isPublic) {
                const ok = await confirm_(
                  "Portföyünüz herkese açık olacak. Varsayılan olarak yalnızca varlık dağılımı (ticker + yüzdeler) paylaşılır. Detay paylaşımını aşağıdaki seçenekten değiştirebilirsiniz.",
                  {okLbl:"Herkese Aç", cancelLbl:"İptal", danger:true}
                );
                if (!ok) return;
              }
              try {
                const {error} = await sb.from("portfolios")
                  .update({is_public: !isPublic, privacy_level: "allocation_only"})
                  .eq("id", activePortfolioId)
                  .eq("user_id", user.id);
                if (error) throw error;
                await loadData();
                flash_(!isPublic ? "Portföy herkese açıldı" : "Portföy gizlendi", "ok");
              } catch(e) {
                flash_("Güncelleme başarısız", "err");
              }
            };
            const togglePrivacyLevel = async () => {
              const toFull = privLevel !== "full";
              if (toFull) {
                const ok = await confirm_(
                  "Maliyet ve adet bilgileri de herkesle paylaşılacak. Emin misiniz?",
                  {okLbl:"Tam Detay Paylaş", cancelLbl:"İptal", danger:true}
                );
                if (!ok) return;
              }
              try {
                const {error} = await sb.from("portfolios")
                  .update({privacy_level: toFull ? "full" : "allocation_only"})
                  .eq("id", activePortfolioId)
                  .eq("user_id", user.id);
                if (error) throw error;
                await loadData();
                flash_(toFull ? "Tam detay paylaşımı açık" : "Sadece dağılım paylaşılıyor", "ok");
              } catch(e) {
                flash_("Güncelleme başarısız", "err");
              }
            };
            return (
              <div key="portfolio-section" className="sg">
                <label>Portföy</label>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:"10px 0"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:"var(--text)"}}>{portfolio.name}</div>
                    <div style={{fontSize:11,color:isPublic?"var(--ok)":"var(--text3)",marginTop:3}}>
                      {isPublic ? "Herkese açık — bağlantısı olan herkes görebilir" : "Sadece siz görebilirsiniz"}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    {isPublic&&(
                      <button className="btn-sm" onClick={()=>{
                        const url=`${window.location.origin}${window.location.pathname}?portfolio=${activePortfolioId}`;
                        navigator.clipboard?.writeText(url).then(()=>flash_("Bağlantı kopyalandı ✓")).catch(()=>flash_("Kopyalanamadı","err"));
                      }}>Paylaş</button>
                    )}
                    <button
                      className={"btn-sm"+(isPublic?" btn-danger-out":"")}
                      onClick={togglePublic}
                      style={{whiteSpace:"nowrap"}}
                    >
                      {isPublic ? "Gizle" : "Herkese Aç"}
                    </button>
                  </div>
                </div>
                {isPublic&&(
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderTop:"1px solid var(--border)"}}>
                    <div>
                      <div style={{fontSize:12,color:"var(--text2)"}}>Detay Paylaşımı</div>
                      <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>
                        {privLevel==="full" ? "Adet ve maliyet bilgileri görünür" : "Sadece ticker + yüzde dağılımı görünür"}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button
                        className={"btn-xs"+(privLevel!=="full"?" on":"")}
                        style={privLevel!=="full"?{background:"rgba(201,168,76,0.15)",color:"var(--info)",border:"1px solid rgba(201,168,76,0.3)"}:{}}
                        onClick={privLevel==="full"?togglePrivacyLevel:undefined}
                        disabled={privLevel!=="full"}
                      >Sadece Dağılım</button>
                      <button
                        className={"btn-xs"+(privLevel==="full"?" on":"")}
                        style={privLevel==="full"?{background:"rgba(201,168,76,0.15)",color:"var(--info)",border:"1px solid rgba(201,168,76,0.3)"}:{}}
                        onClick={privLevel!=="full"?togglePrivacyLevel:undefined}
                        disabled={privLevel==="full"}
                      >Tam Detay</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* 3. Görünüm */}
          <div className="sg">
            <label>Görünüm</label>
            <div className="seg">
              {[["system","Sistem"],["light","Açık"],["dark","Koyu"]].map(([v,l])=>(
                <button key={v} className={themeMode===v?"on":""} onClick={()=>setThemeMode(v)}>{l}</button>
              ))}
            </div>
            <div className="hint">Tema tercihi tarayıcıda kaydedilir.</div>
          </div>

          {/* 4. Fiyat & Veri */}
          <div className="sg">
            <label>Fiyat & Veri</label>
            <div className="hint" style={{marginBottom:10}}>Portföyündeki tüm tickerların güncel fiyatları çekilir. Sekme ön plana geldiğinde ve her 30 dakikada bir otomatik yenilenir.</div>
            {(busy.p||busy.h)
              ?<div className="dim" style={{fontSize:13,display:"flex",alignItems:"center",gap:8}}><div className="spin" style={{width:14,height:14}}></div><span className="mono">{pprog}</span></div>
              :<div className="brow">
                <button onClick={fetchPrices}>↻ Şimdi Güncelle{lastFetchAt&&<span className="dim" style={{fontSize:10,marginLeft:6}}>{fmtAge(lastFetchAt)}</span>}</button>
                <button onClick={fetchHist}>Tarihi Veri (1G/1H/1A/1Y)</button>
                <button onClick={async()=>{
                  setConnTest({loading:true});
                  try{
                    const r=await edgePriceCall({ticker:"NVDA",mode:"price"});
                    const txt=await r.text();
                    setConnTest({ok:r.ok, status:r.status, body:txt.slice(0,600)});
                  }catch(e){setConnTest({ok:false, status:"—", body:"HATA: "+e.message});}
                }} style={{fontSize:11,padding:"5px 10px",color:"var(--warn)",borderColor:"var(--warn)"}}>🔍 Bağlantı Test</button>
              </div>}
            <div className="hint">Ticker başına ~8 sn · "Bağlantı Test" ile önce tek ticker dene</div>
            {connTest&&(
              <div style={{marginTop:8,background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 12px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span className="lbl">Test Sonucu</span>
                  <button className="btn-xs" onClick={()=>setConnTest(null)}>Kapat</button>
                </div>
                {connTest.loading
                  ?<div className="dim" style={{fontSize:12}}><span className="spin" style={{width:11,height:11,marginRight:6,verticalAlign:"middle"}}></span>İstek gönderiliyor…</div>
                  :<>
                    <div style={{fontSize:12,marginBottom:6}}>
                      <span className={"dot "+(connTest.ok?"ok":"off")}></span>
                      <span className="mono">HTTP {connTest.status}</span>
                    </div>
                    <pre style={{margin:0,fontSize:10,fontFamily:"var(--font-numeric)",color:"var(--text2)",whiteSpace:"pre-wrap",wordBreak:"break-word",maxHeight:200,overflow:"auto"}}>{connTest.body}</pre>
                  </>}
              </div>
            )}
          </div>

          {/* 5. Araçlar — Pozisyon Bakımı + Export + İşlem Geçmişi */}
          <div className="sg">
            <label>Araçlar</label>
            <div className="brow">
              <button onClick={async()=>{
                if(!(await confirm_("Tüm pozisyonlar sıfırlanıp işlemlerden yeniden hesaplanacak. Devam edilsin mi?",{okLbl:"Yeniden Hesapla",danger:true})))return;
                const n=await rebuildPositions(user.id,activePortfolioId);
                await loadData();
                if(n===null){flash_("Pozisyonlar güncellenemedi","err");}
                else{flash_(`Pozisyonlar yeniden hesaplandı · ${n} pozisyon`);}
              }}>♻️ Pozisyonları Yeniden Hesapla</button>
              <button onClick={async()=>{
                const tickers=pos.filter(p=>p.type!=="BIST").map(p=>p.ticker);
                if(!tickers.length){flash_("Senkronize edilecek US/ETF/Kripto pozisyonu yok","err");return;}
                flash_("Splitler kontrol ediliyor...","ok");
                const{inserted}=await syncSplits(tickers,activePortfolioId);
                if(inserted>0){
                  const n=await rebuildPositions(user.id,activePortfolioId);
                  await loadData();
                  if(n===null){flash_("Pozisyonlar güncellenemedi","err");}
                  else{flash_(`${inserted} yeni split bulundu · ${n} pozisyon güncellendi`);}
                }else{
                  flash_("Split verisi güncel, değişiklik yok");
                }
              }}>🔄 Splitleri Senkronize Et</button>
            </div>
            <div className="hint" style={{marginBottom:10}}>Split eklendi/değiştirildiyse basın — tüm işlemler split-aware yeniden hesaplanır. Senkronize Et butonu US/ETF/Kripto için FMP'den otomatik çeker (BIST hariç).</div>
            <div className="brow" style={{marginBottom:10}}>
              <button onClick={expTx}>İşlemler CSV</button>
              <button onClick={expPos}>Pozisyonlar CSV</button>
            </div>
            <div className="brow">
              <button onClick={()=>setTab("history")}>İşlem Geçmişi →</button>
            </div>
          </div>

          {/* 6. Sistem Durumu — collapsible */}
          <div className="sg">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",userSelect:"none"}} onClick={()=>setStatusOpen(o=>!o)}>
              <label style={{cursor:"pointer",marginBottom:0}}>Sistem Durumu</label>
              <span style={{fontSize:12,color:"var(--text3)"}}>{statusOpen?"▴":"▾"}</span>
            </div>
            {statusOpen&&(
              <div style={{marginTop:8}}>
                {[
                  [true,"Supabase","Bağlı · RLS aktif"],
                  [true,"Edge Functions","parse-transaction · fetch-prices"],
                  [hasH,"Tarihi Veri",hasH?Object.keys(hist).length+" ticker":"Yüklenmedi"],
                  [pdate!=="—","Son Fiyat",pdate],
                  [!!fxRates?.USDTRY,"FX Kuru",fxRates?.USDTRY?`1$ ≈ ₺${fmt(fxRates.USDTRY,2)}${fxAt?` · ${Math.round((Date.now()-fxAt)/3600000)}sa önce`:""}`:"Yüklenmedi"],
                  [true,"Pozisyonlar",pos.length+" açık"],
                  [true,"İşlemler",txs.length+" kayıtlı"],
                  [splits.length>0,"Split Kayıtları",splits.length>0?splits.length+" tanımlı":"Yok / okunamıyor"],
                ].map(([ok,l,v])=>(
                  <div key={l} className="row">
                    <span style={{fontSize:13}}><span className={"dot "+(ok?"ok":"off")}></span>{l}</span>
                    <span className="dim" style={{fontSize:12}}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 7. Danger zone */}
          <div style={{borderTop:"1px solid var(--border)",marginTop:8,paddingTop:20,paddingBottom:16}}>
            <button className="danger" onClick={()=>{
              // Cross-account leak'i önle: privacy mode + cache + portfolio LS key'lerini temizle.
              ["il_hide","il_prc","il_hist","il_active_portfolio","il_recent_search",`il_recent_${user?.id}`].forEach(k=>k&&localStorage.removeItem(k));
              sb.auth.signOut();
            }} style={{width:"100%"}}>Çıkış Yap</button>
          </div>
        </div>
      )}
      </main>

      <nav id="bottom-tabs">
        {TABS.filter(([id])=>id!=="add").map(([id,lbl])=>(
          <button key={id} className={"btab"+((tab===id||(tab==="detail"&&selectedFromTab===id))?" on":"")} onClick={()=>setTab(id)}>
            {NAV_ICONS[id]&&NAV_ICONS[id](20)}<span>{lbl}</span>
          </button>
        ))}
      </nav>
      {/* FAB context-aware: Detail'da AddTxInline aç, Search'te input focus, diğerlerinde + Ekle */}
      <button id="fab" aria-label={tab==="detail"?`+ Ekle (${selectedTicker})`:tab==="search"?"Ara":"İşlem Ekle"}
        onClick={()=>{
          if(tab==="detail"){window.dispatchEvent(new CustomEvent("il-detail-add"));}
          else if(tab==="search"){const el=document.querySelector('[data-test="search-input"]')||document.querySelector('input[type="text"]');if(el){el.focus();el.scrollIntoView({behavior:"smooth",block:"center"});}}
          else{setTab("add");}
        }}
        style={tab==="settings"?{display:"none"}:{}}><IconPlus/></button>

      {/* Confirm modal */}
      {confirmSt&&(
        <div className="mdl-bd" onClick={()=>!confirmSt.danger&&closeConfirm(false)}>
          <div className="mdl-bx" onClick={e=>e.stopPropagation()}>
            <div className="mdl-msg">{confirmSt.msg}</div>
            <div className="brow">
              {/* danger durumunda autoFocus iptal butonuna — Enter ile kazara onay riski yok */}
              <button onClick={()=>closeConfirm(false)} autoFocus={confirmSt.danger}>{confirmSt.cancelLbl}</button>
              <button className={confirmSt.danger?"danger":"pri"} onClick={()=>closeConfirm(true)} autoFocus={!confirmSt.danger}>{confirmSt.okLbl}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────
function Root(){
  const [session,setSession]=useState(undefined);
  useEffect(()=>{
    sb.auth.getSession().then(({data:{session}})=>setSession(session));
    const{data:{subscription}}=sb.auth.onAuthStateChange((_,s)=>setSession(s));
    return()=>subscription.unsubscribe();
  },[]);
  if(session===undefined)return<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"80vh",gap:10,color:"#888",fontSize:13}}><div className="spin"></div>Yükleniyor...</div>;
  if(!session)return<Login/>;
  return<App session={session}/>;
}

ReactDOM.createRoot(document.getElementById("app")).render(<Root/>);
