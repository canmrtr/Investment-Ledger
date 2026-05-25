// ── HistoryTab ───────────────────────────────────────────────────
function HistoryTab({txs,user,loadData,flash_,confirm_,mask,hideAmts,setTab,openDetail,initialSearch,onConsume,splits,portfolioId,pos,displayCur,fxRates}){
  const [open,setOpen]=useState(()=>initialSearch?{[initialSearch.toUpperCase()]:true}:{});
  const [editId,setEditId]=useState(null);
  const [editForm,setEditForm]=useState({});
  const [saving,setSaving]=useState(false);
  const [search,setSearch]=useState(initialSearch||"");
  const [wayF,setWayF]=useState("all");
  const [dateF,setDateF]=useState("all");
  const [divCalMap,setDivCalMap]=useState({});
  const [divSecOpen,setDivSecOpen]=useState(true);
  useEffect(()=>{
    if(!pos||!pos.length)return;
    const heldUS=pos.filter(p=>p.type==="US_STOCK"&&(+p.shares||0)>0).map(p=>p.ticker);
    if(!heldUS.length)return;
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
    edgeCallAuth("fetch-fundamentals",{mode:"dividend-calendar",tickers:toFetch})
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
  useEffect(()=>{if(initialSearch&&onConsume)onConsume();},[]);

  const filtered=txs.filter(t=>{
    if(search){
      const q=search.toLowerCase();
      if(!t.ticker.toLowerCase().includes(q)&&!(t.name||"").toLowerCase().includes(q))return false;
    }
    if(wayF!=="all"&&t.way!==wayF)return false;
    if(dateF!=="all"){
      const days={d30:30,d90:90,y1:365}[dateF];
      if(days){const cutoff=new Date(Date.now()-days*86400000).toISOString().split("T")[0];if(t.date<cutoff)return false;}
    }
    return true;
  });

  const grouped={};
  filtered.forEach(t=>{if(!grouped[t.ticker])grouped[t.ticker]=[];grouped[t.ticker].push(t);});
  const tickers=Object.keys(grouped).sort();
  const isFiltered=search||wayF!=="all"||dateF!=="all";
  const clearFilters=()=>{setSearch("");setWayF("all");setDateF("all");};

  const startEdit=t=>{
    setEditId(t.id);
    setEditForm({date:t.date,way:t.way,shares:t.shares,price:t.price,currency:t.currency||"USD",broker:t.broker||"",commission:t.commission||0,notes:t.notes||""});
  };

  const saveEdit=async(t)=>{
    setSaving(true);
    const{error}=await sb.from("transactions").update({
      date:editForm.date,way:editForm.way,shares:+editForm.shares,price:+editForm.price,
      currency:editForm.currency,total:+((+editForm.shares)*(+editForm.price)).toFixed(4),
      broker:editForm.broker,commission:+(editForm.commission||0),notes:editForm.notes||""
    }).eq("id",t.id).eq("user_id",user.id);
    if(error){flash_(error.message,"err");}
    else{await rebuildPositions(user.id,portfolioId);await loadData();flash_("Güncellendi ✓");setEditId(null);}
    setSaving(false);
  };

  const delTx=async(t)=>{
    if(!(await confirm_(`${t.ticker} — ${fmtDateTR(t.date)} işlemi silinsin mi?`,{okLbl:"Sil"})))return;
    await sb.from("transactions").delete().eq("id",t.id).eq("user_id",user.id);
    await rebuildPositions(user.id,portfolioId);await loadData();flash_("Silindi ✓");
  };

  if(txs.length===0)return(
    <div className="empty-card">
      <div className="ic">📝</div>
      <div className="ttl">Henüz işlem yok</div>
      <div className="sub">Metin, görüntü, CSV veya manuel giriş — ilk işlemini ekle.</div>
      <button className="pri" onClick={()=>setTab&&setTab("add")}>+ İlk işlemi ekle</button>
    </div>
  );

  return(
    <div>
      {/* Yaklaşan Temettüler — önümüzdeki 30 gün içinde ex-date'i olan held US tickers */}
      {(()=>{
        if(!pos||!pos.length)return null;
        const today=new Date().toISOString().split("T")[0];
        const in30=new Date(Date.now()+30*86400000).toISOString().split("T")[0];
        const dSym=displaySym(displayCur||"USD");
        const rows=[];
        pos.filter(p=>p.type==="US_STOCK"&&(+p.shares||0)>0).forEach(p=>{
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
        return(
          <div className="card" style={{marginBottom:14,padding:0,overflow:"hidden"}}>
            <div
              onClick={()=>setDivSecOpen(o=>!o)}
              style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",cursor:"pointer"}}
            >
              <div className="stitle" style={{marginBottom:0}}>Yaklaşan Temettüler</div>
              <span style={{fontSize:11,color:"var(--text3)"}}>{divSecOpen?"▲":"▼"}</span>
            </div>
            {divSecOpen&&(
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
      {/* Filter toolbar */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <input className="finp sm" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Ticker veya şirket..." style={{flex:"1 1 160px",minWidth:140}}/>
        <select className="finp sm" value={wayF} onChange={e=>setWayF(e.target.value)} style={{flex:"0 0 auto",width:90}}>
          <option value="all">Tümü</option>
          <option value="BUY">Alış</option>
          <option value="SELL">Satış</option>
          <option value="DIV">Temettü</option>
        </select>
        <select className="finp sm" value={dateF} onChange={e=>setDateF(e.target.value)} style={{flex:"0 0 auto",width:120}}>
          <option value="all">Tüm zamanlar</option>
          <option value="d30">Son 30 gün</option>
          <option value="d90">Son 90 gün</option>
          <option value="y1">Son 1 yıl</option>
        </select>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <span className="dim" style={{fontSize:12}}>
          {isFiltered?`${filtered.length} / ${txs.length}`:filtered.length} işlem · {tickers.length} varlık
          {isFiltered&&<button className="btn-xs" style={{marginLeft:8}} onClick={clearFilters}>Temizle</button>}
        </span>
        <div className="brow">
          <button className="pri btn-sm" onClick={()=>setTab&&setTab("add")}>+ Ekle</button>
          <button className="btn-sm" onClick={()=>setOpen(Object.fromEntries(tickers.map(t=>[t,true])))}>Tümünü Aç</button>
          <button className="btn-sm" onClick={()=>setOpen({})}>Kapat</button>
        </div>
      </div>
      {filtered.length===0&&(
        <div className="empty-card" style={{padding:"28px 20px"}}>
          <div className="ic">🔍</div>
          <div className="ttl">Eşleşen işlem yok</div>
          <div className="sub">Filtreleri değiştir ya da temizle.</div>
          <button className="pri" onClick={clearFilters}>Filtreleri temizle</button>
        </div>
      )}
      {tickers.map(tk=>{
        const items=grouped[tk];
        const isOpen=!!open[tk];
        const tot=items.reduce((a,t)=>a+(t.way==="BUY"?-(+t.total):+(+t.total)),0);
        const groupSym=displaySym(items[0]?.currency||"USD");
        return(
          <div key={tk} style={{marginBottom:8,border:"0.5px solid var(--border)",borderRadius:12,overflow:"hidden"}}>
            <div onClick={()=>setOpen(o=>({...o,[tk]:!o[tk]}))} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"var(--bg2)",cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <button type="button" className="link-btn"
                  style={{fontSize:13,fontWeight:700,fontFamily:"DM Mono,monospace"}}
                  onClick={e=>{e.stopPropagation();openDetail&&openDetail(tk,undefined,"history");}}
                  aria-label={`${tk} detayını aç`}
                  data-tip="Detay sayfasını aç">{tk}</button>
                <span className="dim" style={{fontSize:11}}>{items.length} işlem</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                {!hideAmts&&<span className="dim mono" style={{fontSize:11}}>{mask(groupSym+fmt(tot,0))}</span>}
                <span style={{color:"var(--text3)",fontSize:12}}>{isOpen?"▲":"▼"}</span>
              </div>
            </div>
            {isOpen&&items.map(t=>(
              <div key={t.id} style={{borderTop:"0.5px solid var(--border)"}}>
                {editId===t.id?(
                  <div style={{padding:"12px 14px",background:"var(--bg3)"}}>
                    <div className="form-grid-3">
                      <div><div className="kk" style={{marginBottom:3}}>Tarih</div><input className="finp sm" type="date" value={editForm.date} onChange={e=>setEditForm(f=>({...f,date:e.target.value}))} max={today()}/></div>
                      <div><div className="kk" style={{marginBottom:3}}>İşlem</div>
                        <select className="finp sm" value={editForm.way} onChange={e=>setEditForm(f=>({...f,way:e.target.value}))}>
                          <option value="BUY">Alış</option><option value="SELL">Satış</option><option value="DIV">Temettü</option>
                        </select>
                      </div>
                      <div><div className="kk" style={{marginBottom:3}}>Para</div>
                        <select className="finp sm" value={editForm.currency} onChange={e=>setEditForm(f=>({...f,currency:e.target.value}))}>
                          <option>USD</option><option>TRY</option><option>EUR</option>
                        </select>
                      </div>
                      <div><div className="kk" style={{marginBottom:3}}>Adet</div><input className="finp sm" type="number" step="any" value={editForm.shares} onChange={e=>setEditForm(f=>({...f,shares:e.target.value}))}/></div>
                      <div><div className="kk" style={{marginBottom:3}}>Fiyat</div><input className="finp sm" type="number" step="any" value={editForm.price} onChange={e=>setEditForm(f=>({...f,price:e.target.value}))}/></div>
                      <div><div className="kk" style={{marginBottom:3}}>Broker</div><input className="finp sm" maxLength={50} value={editForm.broker} onChange={e=>setEditForm(f=>({...f,broker:e.target.value}))}/></div>
                      <div><div className="kk" style={{marginBottom:3}}>Komisyon</div><input className="finp sm" type="number" step="any" value={editForm.commission||""} onChange={e=>setEditForm(f=>({...f,commission:e.target.value}))}/></div>
                    </div>
                    <div style={{fontSize:11,color:"var(--text2)",marginBottom:10}}>Toplam: {displaySym(editForm.currency)}{fmt((+editForm.shares)*(+editForm.price))}</div>
                    <div className="brow">
                      <button className="pri btn-md" onClick={()=>saveEdit(t)} disabled={saving}>{saving?"Kaydediliyor...":"Kaydet"}</button>
                      <button className="btn-md" onClick={()=>setEditId(null)}>İptal</button>
                    </div>
                  </div>
                ):(
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px"}}>
                    <div style={{display:"flex",gap:10,alignItems:"center",flex:1,flexWrap:"wrap"}}>
                      <span style={{fontSize:11,color:"var(--text2)",fontFamily:"monospace",minWidth:80}}>{fmtDateTR(t.date)}</span>
                      <span className={t.way==="BUY"?"ok":t.way==="DIV"?"warn":"err"} style={{fontSize:11,minWidth:28}}>{t.way==="BUY"?"Alış":t.way==="DIV"?"Temettü":"Satış"}</span>
                      <span className="mono" style={{fontSize:12}}>{fmtShares(t.shares)} adet</span>
                      {!hideAmts&&<span className="mono dim" style={{fontSize:12}}>{mask(displaySym(t.currency)+fmt(t.price))}</span>}
                      {!hideAmts&&<span className="mono" style={{fontSize:12,fontWeight:600}}>{mask(displaySym(t.currency)+fmt(t.total,0))}</span>}
                      {t.broker&&<span className="dim" style={{fontSize:10}}>{t.broker}</span>}
                      {!hideAmts&&+t.commission>0&&<span className="dim" style={{fontSize:10}}>Kom: {mask(displaySym(t.currency)+fmt(+t.commission,2))}</span>}
                      {(()=>{
                        const af=(splits||[]).filter(s=>s.ticker===t.ticker&&s.split_date>t.date);
                        if(!af.length)return null;
                        const fac=af.reduce((a,s)=>a*+s.ratio,1);
                        const tip=`Bu işlem sonrası split: ${af.map(s=>`${s.split_date} ${s.ratio}:1`).join(" · ")}. Pozisyon hesabı ×${fac} uygulanır.`;
                        return<span className="badge split" data-tip={tip}>⚡ ×{fac}</span>;
                      })()}
                    </div>
                    <div className="brow" style={{gap:5}}>
                      <button className="btn-xs" onClick={()=>startEdit(t)}>Düzenle</button>
                      <button className="btn-xs btn-danger-out" onClick={()=>delTx(t)}>Sil</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

