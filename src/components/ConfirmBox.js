// ── ConfirmBox (AddTab dışında!) ─────────────────────────────────
// Parse sonuç onayı — array (1 veya N işlem) destekler. Tek işlemde detay
// kv-grid; çoklu işlemde compact satır listesi + per-row remove.
function ConfirmBox({data,onSave,onCancel}){
  const toArr=(d)=>Array.isArray(d)?d:(d?[d]:[]);
  const [items,setItems]=useState(()=>toArr(data));
  useEffect(()=>setItems(toArr(data)),[data]);
  if(!items||items.length===0)return null;

  const symFor=(cur)=>cur==="TRY"?"₺":(cur==="EUR"?"€":"$");
  const upd=(idx,patch)=>setItems(prev=>prev.map((it,i)=>i===idx?{...it,...patch}:it));

  // Tek işlem: kv-grid + düzenlenebilir alanlar
  if(items.length===1){
    const d=items[0];
    const c=symFor(d.currency);
    const total=(+(d.shares)||0)*(+(d.price)||0);
    const priceFlag=d._priceFallback
      ?<span style={{fontSize:10,padding:"1px 6px",borderRadius:10,background:"rgba(255,184,0,0.15)",color:"var(--warn)",fontWeight:600}}>⚠ son kapanış</span>
      :d._priceAutoFilled
        ?<span style={{fontSize:10,padding:"1px 6px",borderRadius:10,background:"rgba(0,217,126,0.12)",color:"var(--ok)",fontWeight:600}}>↻ otomatik</span>
        :null;
    const inp=(val,onChange,type="text",extra={})=>(
      <input className="finp sm" type={type} value={val||""} onChange={e=>onChange(e.target.value)}
        style={{marginBottom:0,padding:"3px 8px",height:28,...extra}}/>
    );
    const rows=[
      ["Tarih",inp(d.date,v=>upd(0,{date:v}),"date")],
      ["Ticker",<span className="mono" style={{fontWeight:700}}>{d.ticker}</span>],
      ["Şirket",d.name||"—"],
      ["Tür",TL[d.asset_type]||d.asset_type||"—"],
      ["İşlem",d.way==="BUY"?"Alış":d.way==="DIV"?"Temettü":"Satış"],
      ["Adet",inp(d.shares,v=>upd(0,{shares:v}),"number",{width:80})],
      ["Fiyat",<span style={{display:"flex",alignItems:"center",gap:6}}>{inp(d.price,v=>upd(0,{price:v}),"number",{width:90})}{priceFlag}</span>],
      ["Toplam",c+fmt(total,0)],
      ["Broker",inp(d.broker||"",v=>upd(0,{broker:v}))],
      ["Komisyon",inp(d.commission||"",v=>upd(0,{commission:v}),"number",{width:90})],
    ];
    return(
      <div className="cbox" style={{marginTop:16}}>
        <div className="lbl" style={{marginBottom:12}}>Parse sonucu — düzenle ve doğrula</div>
        <div className="kv">
          {rows.map(([k,v])=>(
            <div key={k}><div className="kk">{k}</div><div className="kv_" style={{display:"flex",alignItems:"center"}}>{typeof v==="string"?v:v}</div></div>
          ))}
        </div>
        <div className="brow">
          <button className="pri" onClick={()=>onSave(items)}>Kaydet</button>
          <button onClick={onCancel}>İptal</button>
        </div>
      </div>
    );
  }

  // Çoklu işlem: satır listesi + per-row edit
  const [editIdx,setEditIdx]=useState(null);
  const remove=(idx)=>{setItems(prev=>prev.filter((_,i)=>i!==idx));if(editIdx===idx)setEditIdx(null);};
  return(
    <div className="cbox" style={{marginTop:16}}>
      <div className="lbl" style={{marginBottom:12}}>Parse sonucu — {items.length} işlem doğrula</div>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
        {items.map((tx,idx)=>{
          const c=symFor(tx.currency);
          const total=(+tx.shares)*(+tx.price);
          const isEdit=editIdx===idx;
          return(
            <div key={idx} style={{background:"var(--bg3)",borderRadius:8,overflow:"hidden"}}>
              <div style={{padding:"9px 12px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"var(--text2)",minWidth:80}}>{fmtDateTR(tx.date)}</span>
                <span style={{fontWeight:600,fontSize:13,minWidth:60}}>{tx.ticker}</span>
                <span className={tx.way==="BUY"?"ok":tx.way==="DIV"?"warn":"err"} style={{fontSize:11,minWidth:32}}>{tx.way==="BUY"?"Alış":tx.way==="DIV"?"Temettü":"Satış"}</span>
                <span className="mono" style={{fontSize:12,color:"var(--text2)",display:"flex",alignItems:"center",gap:5}}>
                  {fmtShares(tx.shares)} × {c}{fmt(tx.price)}
                  {tx._priceFallback&&<span style={{fontSize:10,padding:"1px 5px",borderRadius:10,background:"rgba(255,184,0,0.15)",color:"var(--warn)",fontWeight:600}}>⚠ son kapanış</span>}
                  {!tx._priceFallback&&tx._priceAutoFilled&&<span style={{fontSize:10,padding:"1px 5px",borderRadius:10,background:"rgba(0,217,126,0.12)",color:"var(--ok)",fontWeight:600}}>↻ otomatik</span>}
                </span>
                <span className="mono" style={{fontSize:12,fontWeight:600,marginLeft:"auto"}}>{c}{fmt(total,0)}</span>
                <button className="btn-icon" onClick={()=>setEditIdx(isEdit?null:idx)}
                  data-tip={isEdit?"Düzenlemeyi kapat":"Bu işlemi düzenle"} aria-label={isEdit?"Düzenlemeyi kapat":"Bu işlemi düzenle"}
                  style={{color:isEdit?"var(--info)":"var(--text3)",background:"transparent"}}>✎</button>
                <button className="btn-icon btn-danger-out" onClick={()=>remove(idx)}
                  data-tip="Bu işlemi listeden çıkar" aria-label="Bu işlemi listeden çıkar"
                  style={{background:"transparent"}}>×</button>
              </div>
              {isEdit&&(
                <div style={{padding:"8px 12px 10px",borderTop:"1px solid var(--border)",display:"flex",flexWrap:"wrap",gap:8,alignItems:"flex-end"}}>
                  <div><div className="kk" style={{marginBottom:3}}>Tarih</div><input className="finp sm" type="date" value={tx.date||""} onChange={e=>upd(idx,{date:e.target.value})} style={{height:28,padding:"3px 8px"}}/></div>
                  <div><div className="kk" style={{marginBottom:3}}>Adet</div><input className="finp sm" type="number" step="any" value={tx.shares||""} onChange={e=>upd(idx,{shares:e.target.value})} style={{height:28,padding:"3px 8px",width:80}}/></div>
                  <div><div className="kk" style={{marginBottom:3}}>Fiyat ({c})</div><input className="finp sm" type="number" step="any" value={tx.price||""} onChange={e=>upd(idx,{price:e.target.value})} style={{height:28,padding:"3px 8px",width:90}}/></div>
                  <div><div className="kk" style={{marginBottom:3}}>Broker</div><input className="finp sm" type="text" value={tx.broker||""} onChange={e=>upd(idx,{broker:e.target.value})} style={{height:28,padding:"3px 8px",width:90}}/></div>
                  <div><div className="kk" style={{marginBottom:3}}>Komisyon</div><input className="finp sm" type="number" step="any" value={tx.commission||""} onChange={e=>upd(idx,{commission:e.target.value})} style={{height:28,padding:"3px 8px",width:80}}/></div>
                  <button className="btn-xs" style={{color:"var(--info)",borderColor:"var(--info)"}} onClick={()=>setEditIdx(null)}>✓ Tamam</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="brow">
        <button className="pri" onClick={()=>onSave(items)}>{items.length} İşlemi Kaydet</button>
        <button onClick={onCancel}>İptal</button>
      </div>
    </div>
  );
}

