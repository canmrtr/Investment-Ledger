// ── WatchlistTab ─────────────────────────────────────────────────
function WatchlistTab({items,prc,hist,prcUpdatedAt,onToggle,openDetail,setTab,hideAmts,mask,confirm_}){
  React.useEffect(()=>{
    // prices are fetched by App's existing pos-change effect; no extra fetch needed
  },[]);
  if(!items.length)return(
    <div className="empty-card" style={{margin:"32px 16px"}}>
      <div className="ic">👀</div>
      <div className="ttl">İzleme listeniz boş</div>
      <div className="sub">Arama sayfasında hisse bulup izlemeye ekleyebilirsiniz.</div>
      <button className="pri btn-pri" onClick={()=>setTab("search")}>+ Hisse ara</button>
    </div>
  );
  return(
    <div>
      <div style={{padding:"12px 16px 4px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span className="stitle">İzleme Listesi</span>
        <span className="lbl" style={{color:"var(--text3)"}}>{items.length} hisse</span>
      </div>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr style={{borderBottom:"1px solid var(--border)"}}>
            <th style={{textAlign:"left",padding:"6px 16px",fontSize:11,color:"var(--text3)",fontWeight:500,letterSpacing:"0.04em"}}>HİSSE</th>
            <th style={{textAlign:"right",padding:"6px 8px",fontSize:11,color:"var(--text3)",fontWeight:500,letterSpacing:"0.04em"}}>FİYAT</th>
            <th style={{textAlign:"right",padding:"6px 8px",fontSize:11,color:"var(--text3)",fontWeight:500,letterSpacing:"0.04em"}}>GÜN</th>
            <th style={{width:72}}></th>
          </tr>
        </thead>
        <tbody>
          {items.map(w=>{
            const price=prc[w.ticker];
            const d1pct=hist[w.ticker]?.d1;
            return(
              <tr key={w.ticker} className="pos-row" onClick={()=>openDetail(w.ticker,w.asset_type)}>
                <td style={{padding:"10px 16px",fontFamily:"var(--mono)",fontWeight:600,fontSize:13}}>{w.ticker}{isPriceStale(prcUpdatedAt?.[w.ticker])&&<span className="badge stale" data-tip={"Fiyat "+fmtAge(new Date(prcUpdatedAt[w.ticker]).getTime())+" güncellendi"}>Fiyat eski</span>}</td>
                <td style={{textAlign:"right",padding:"10px 8px",fontFamily:"var(--mono)",fontSize:13}}>{hideAmts?mask("••••"):(price!=null?fmt(price,2):"—")}</td>
                <td style={{textAlign:"right",padding:"10px 8px",fontFamily:"var(--mono)",fontSize:13,color:d1pct==null?"var(--text3)":d1pct>=0?"var(--ok)":"var(--err)"}}>
                  {hideAmts?mask("••••"):(d1pct!=null?fmtP(d1pct):"—")}
                </td>
                <td style={{textAlign:"right",padding:"10px 16px 10px 4px"}}>
                  <button className="btn-xs btn-danger-out" onClick={async e=>{e.stopPropagation();if(await confirm_(`${w.ticker} izleme listesinden çıkarılsın mı?`,{okLbl:"Çıkar",danger:true}))onToggle(w.ticker);}}>Çıkar</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

