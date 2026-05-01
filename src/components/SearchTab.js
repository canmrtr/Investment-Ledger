// ── SearchTab ────────────────────────────────────────────────────
// Global ticker arama: portföydeki + tüm SEC kayıtlı US hisseler.
// Sonuca tıklayınca TickerDetailTab açılır (held veya not held).
function SearchTab({pos,txs,openDetail,flash_,watchlistItems,onToggleWatchlist}){
  const [q,setQ]=useState("");
  const [tickerDb,setTickerDb]=useState(()=>tickerDbCacheGet());
  const [loading,setLoading]=useState(false);
  const [recent,setRecent]=useState(()=>LS.get("il_recent_search",[]));
  const clearRecent=()=>{setRecent([]);LS.set("il_recent_search",[]);};
  const handleOpen=(ticker,type)=>{
    const next=[ticker,...recent.filter(t=>t!==ticker)].slice(0,8);
    setRecent(next);LS.set("il_recent_search",next);
    openDetail(ticker,type);
  };

  useEffect(()=>{
    if(tickerDb)return;
    setLoading(true);
    // ticker_db tablosunu doğrudan Supabase'den oku (edge function / SEC EDGAR bypass).
    // PostgREST 1k satır limiti aşmak için paralel sayfalama: 12 × 1000 = 12k kapsam.
    const PAGE=1000;
    Promise.all(
      Array.from({length:12},(_,i)=>
        sb.from("ticker_db").select("ticker,name,exchange").range(i*PAGE,(i+1)*PAGE-1)
      )
    ).then(results=>{
      const all=results.flatMap(r=>r.data||[]);
      if(all.length===0){
        return edgeCall("fetch-fundamentals",{mode:"ticker-list"})
          .then(r=>r.json())
          .then(d=>{ if(Array.isArray(d.list)){tickerDbCacheSet(d.list);setTickerDb(d.list);} });
      }
      tickerDbCacheSet(all);
      setTickerDb(all);
    })
    .catch(e=>flash_("Ticker DB hatası: "+e.message,"err"))
    .finally(()=>setLoading(false));
  },[]);

  const qTrim=q.trim();
  const qLower=qTrim.toLowerCase();
  const qUpper=qTrim.toUpperCase();

  // Portföy ticker'ları: aktif pozisyon + geçmiş işlem (kapatılmış pozisyon dahil)
  // type da tutulur — search'ten detay'a giderken asset_type'ı geçirmek için.
  const portfolioMap=new Map();
  pos.forEach(p=>portfolioMap.set(p.ticker,{name:p.name||"",held:true,type:p.type}));
  txs.forEach(t=>{ if(!portfolioMap.has(t.ticker))portfolioMap.set(t.ticker,{name:t.name||"",held:false,type:t.asset_type}); });

  const portfolioMatches=qTrim?[...portfolioMap.entries()].filter(([t,info])=>
    t.includes(qUpper)||info.name.toLowerCase().includes(qLower)
  ).map(([ticker,info])=>({ticker,name:info.name,held:info.held,type:info.type,exchange:info.type==="BIST"?"XIST":"US"})):[];

  const portfolioSet=new Set(portfolioMap.keys());
  const allMatches=qTrim&&tickerDb?tickerDb.filter(({ticker,name})=>
    !portfolioSet.has(ticker)&&(ticker.startsWith(qUpper)||(name||"").toLowerCase().includes(qLower))
  ).slice(0,50):[];

  // exchange → asset_type mapping (openDetail'e geçirilir)
  const exchToType = (ex) => ex==="XIST" ? "BIST" : "US_STOCK";

  const nameFor=(ticker)=>{const pm=portfolioMap.get(ticker);if(pm?.name)return pm.name;return tickerDb?.find(x=>x.ticker===ticker)?.name||"";};
  const typeFor=(ticker)=>{const pm=portfolioMap.get(ticker);if(pm?.type)return pm.type;return tickerDb?.find(x=>x.ticker===ticker)?.exchange==="XIST"?"BIST":"US_STOCK";};

  const Row=({ticker,name,held,exchange,type})=>{
    const ex = exchange || (type==="BIST"?"XIST":"US");
    const at = type || exchToType(ex);
    return (
      <div onClick={()=>handleOpen(ticker,at)} className="pos-row" style={{
        display:"flex",alignItems:"center",gap:10,
        padding:"11px 14px",borderBottom:"0.5px solid var(--border)"
      }}>
        <span style={{fontFamily:"'DM Mono',monospace",fontWeight:600,fontSize:13,minWidth:72}}>{ticker}</span>
        <span style={{flex:1,fontSize:12,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name||"—"}</span>
        {ex==="XIST"&&<span className="badge cry" style={{fontSize:9}}>BIST</span>}
        {held&&<span className="badge etf" style={{fontSize:9}}>açık</span>}
        {!held&&onToggleWatchlist&&<span onClick={e=>{e.stopPropagation();onToggleWatchlist(ticker,at);}} style={{padding:"2px 7px",borderRadius:5,fontSize:11,fontWeight:500,cursor:"pointer",background:watchlistItems?.some(w=>w.ticker===ticker)?"rgba(102,88,255,0.15)":"rgba(255,255,255,0.06)",color:watchlistItems?.some(w=>w.ticker===ticker)?"var(--info)":"var(--text2)"}}>
          {watchlistItems?.some(w=>w.ticker===ticker)?"✓ İzleniyor":"+ İzle"}
        </span>}
        <span style={{color:"var(--text3)",fontSize:14}}>›</span>
      </div>
    );
  };

  return(
    <div>
      <input type="text" autoFocus value={q} onChange={e=>setQ(e.target.value)}
        placeholder="🔍 Ticker (AAPL) veya şirket adı (Apple)…"
        maxLength={64} data-test="search-input"
        style={{marginBottom:14}}/>

      {loading&&<div className="dim" style={{fontSize:13,padding:"20px 0",textAlign:"center"}}>
        <span className="spin" style={{width:14,height:14,marginRight:8,verticalAlign:"middle"}}></span>
        Ticker veritabanı yükleniyor…
      </div>}

      {!qTrim&&!loading&&(
        <div>
          {recent.length>0&&(
            <div style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span className="stitle" style={{marginBottom:0}}>Son Aramalar</span>
                <button onClick={clearRecent} style={{fontSize:11,color:"var(--text3)",background:"transparent",border:"none",cursor:"pointer",padding:"2px 4px"}}>Temizle</button>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {recent.map(t=>(
                  <button key={t} onClick={()=>handleOpen(t,typeFor(t))}
                    style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:600,
                      padding:"5px 12px",borderRadius:8,background:"var(--bg3)",
                      border:"1px solid var(--border)",cursor:"pointer",color:"var(--text)"}}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="dim" style={{fontSize:13,padding:recent.length>0?"12px 0":"30px 0",textAlign:"center"}}>
            Ticker veya şirket adı yazarak başla
            {tickerDb&&(()=>{
              const us=tickerDb.filter(x=>x.exchange!=="XIST").length;
              const bist=tickerDb.filter(x=>x.exchange==="XIST").length;
              return <div style={{fontSize:11,marginTop:6,color:"var(--text3)"}}>{us.toLocaleString("tr-TR")} US + {bist.toLocaleString("tr-TR")} BIST hisse aranabilir</div>;
            })()}
          </div>
        </div>
      )}

      {qTrim&&!loading&&(()=>{
        const noResults=portfolioMatches.length===0&&allMatches.length===0;
        if(noResults){
          return(
            <div className="empty-card" style={{padding:"30px 20px"}}>
              <div className="ic">🔍</div>
              <div className="ttl">Sonuç yok</div>
              <div className="sub">"{qTrim}" için eşleşen ticker veya şirket bulunamadı.</div>
            </div>
          );
        }
        return(
          <div>
            {portfolioMatches.length>0&&(
              <div style={{marginBottom:18,border:"0.5px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
                <div className="stitle" style={{padding:"10px 14px",margin:0,background:"var(--bg3)"}}>Portföyünden · {portfolioMatches.length}</div>
                {portfolioMatches.map(m=><Row key={m.ticker} {...m}/>)}
              </div>
            )}
            {allMatches.length>0&&(
              <div style={{border:"0.5px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
                <div className="stitle" style={{padding:"10px 14px",margin:0,background:"var(--bg3)"}}>Tüm hisseler · {allMatches.length}{allMatches.length===50?"+":""}</div>
                {allMatches.map(m=><Row key={m.ticker} {...m} held={false}/>)}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

