// ── AddTab ───────────────────────────────────────────────────────
// AddTab giriş noktası: context-free butonlardan açılınca önce varlık türü
// seçtirir. Detay sayfasından gelen "+ Ekle" akışı AddTxInline kullandığı
// için bu adım sadece AddTab'a özel.
const ADD_TYPES = [
  {type:"US_STOCK", label:"US Hisse",   desc:"NYSE / NASDAQ — AAPL, TSLA"},
  {type:"BIST",     label:"BIST",       desc:"Borsa İstanbul — THYAO, ASELS"},
  {type:"FUND",     label:"ETF / Fon",  desc:"SPY, QQQ, VT"},
  {type:"CRYPTO",   label:"Kripto",     desc:"BTC, ETH"},
  {type:"GOLD",     label:"Altın",      desc:"Spot ons (XAUUSD)"},
  {type:"FX",       label:"Döviz",      desc:"USDTRY, EURUSD"},
  {type:"BES",      label:"BES Fonu",        desc:"Bireysel Emeklilik — AGS001, PEB011"},
  {type:"TEFAS",    label:"TEFAS Fonu",      desc:"Yatırım fonu — YAC, MAC, GAH"},
  {type:"CASH",     label:"Nakit",           desc:"Banka hesabı — TRY, USD, EUR"},
  {type:"DEPOSIT",  label:"Vadeli Mevduat",  desc:"Faizli sabit vadeli hesap"},
];

const MANUEL_ONLY_TYPES = new Set(["CASH","DEPOSIT"]);

function AddTab({session,user,pos,loadData,flash_,confirm_,portfolioId}){
  const [pickedType,setPickedType]=useState(null);  // null = picker; set → mode tabs
  const [mode,setMode]=useState("text");
  const [parsed,setParsed]=useState(null);
  const [parsing,setParsing]=useState(false);
  const [parseErr,setParseErr]=useState("");
  const [textInput,setTextInput]=useState("");
  const [imgFile,setImgFile]=useState(null);
  const [csvText,setCsvText]=useState("");
  const [csvRows,setCsvRows]=useState([]);
  const [csvSkipped,setCsvSkipped]=useState(0);
  const [csvBusy,setCsvBusy]=useState(false);
  const [progStep,setProgStep]=useState("");
  const [progPct,setProgPct]=useState(0);
  const [progDone,setProgDone]=useState(false);
  const fileRef=useRef(null);

  const switchMode=m=>{setMode(m);setParsed(null);setParseErr("");};

  // Tipi değiştir → buffer temizle, mode'u text'e resetle, picker'a dön
  const resetType=()=>{
    setPickedType(null);
    setMode("text");
    setParsed(null);setParseErr("");
    setTextInput("");setImgFile(null);
    setCsvText("");setCsvRows([]);
  };

  const callParse=async(body)=>{
    setParsing(true);setParseErr("");setParsed(null);
    try{
      const r=await edgeCallAuth("parse-transaction",body);
      const d=await r.json();
      if(!r.ok||d.error||d.code)throw new Error(d.message||d.error||`HTTP ${r.status}`);
      // Yeni edge function `transactions` array döner; eski tek-obje formatına da fallback
      const list = Array.isArray(d.transactions) ? d.transactions : (d.ticker && d.date ? [d] : []);
      if(list.length===0)throw new Error("Geçersiz yanıt — işlem bulunamadı");
      setParsed(await enrichParseListWithPrices(list));
    }catch(e){setParseErr("Hata: "+e.message);}
    setParsing(false);
  };

  const parseText=()=>{if(textInput.trim())callParse({text:textInput});};

  const parseImage=async()=>{
    if(!imgFile)return;
    const b64=await new Promise((res,rej)=>{
      const rd=new FileReader();
      rd.onload=()=>res(rd.result.split(",")[1]);
      rd.onerror=rej;
      rd.readAsDataURL(imgFile);
    });
    callParse({imageBase64:b64,imageType:imgFile.type||"image/png"});
  };

  // Bulk save — parsed bir array (1 veya N işlem). Hepsini batch insert et,
  // sonra rebuildPositions ile pozisyon tablosunu split-aware yeniden hesapla.
  const saveTx=async(list)=>{
    const items = Array.isArray(list) ? list : (parsed||[]);
    if(!items||items.length===0)return;
    const valid=items.filter(p=>{const sh=+p.shares,pr=+p.price;return !isNaN(sh)&&sh>0&&!isNaN(pr)&&pr>=0&&["BUY","SELL","DIV"].includes((p.way||"").toUpperCase());});
    const invalidCnt=items.length-valid.length;
    if(valid.length===0){flash_("Geçerli işlem bulunamadı","err");return;}
    const rows = valid.map(p=>({
      user_id:user.id,date:p.date,ticker:p.ticker,name:p.name||"",
      asset_type:p.asset_type,way:p.way,shares:+p.shares,price:+p.price,
      currency:p.currency||"USD",total:+((+p.shares)*(+p.price)).toFixed(4),
      broker:p.broker||"",commission:+(p.commission||0),exchange:p.exchange||"",notes:p.notes||"",
      portfolio_id:portfolioId
    }));
    // belt-and-suspenders: way must be BUY/SELL/DIV
    const VALID_WAYS = ["BUY","SELL","DIV"];
    const invalidWay = rows.find(r=>!VALID_WAYS.includes((r.way||"").toUpperCase()));
    if(invalidWay){flash_(`Geçersiz işlem türü: ${invalidWay.way}. BUY, SELL veya DIV olmalı.`,"err");return;}
    const{error}=await sb.from("transactions").insert(rows);
    if(error){flash_(error.message,"err");return;}
    const syncTickers=[...new Set(rows.filter(r=>r.asset_type!=="BIST").map(r=>r.ticker))];
    if(syncTickers.length)await syncSplits(syncTickers,portfolioId);
    await rebuildPositions(user.id,portfolioId);
    await loadData();
    setParsed(null);setTextInput("");setImgFile(null);
    const msg=rows.length===1?"Kaydedildi ✓":`${rows.length} işlem kaydedildi ✓`;
    flash_(invalidCnt>0?msg+` · ${invalidCnt} geçersiz atlandı`:msg);
  };

  const handleFile=f=>{
    if(!f)return;
    const rd=new FileReader();
    rd.onload=ev=>{setCsvText(ev.target.result);setCsvRows([]);};
    rd.readAsText(f);
  };

  // RFC 4180 style splitter: quotes içinde virgül ve "" (escaped quote) destekler.
  const splitCSVLine=(line)=>{
    const out=[];let cur="",inQ=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='"'){
        if(inQ&&line[i+1]==='"'){cur+='"';i++;}
        else inQ=!inQ;
      } else if(c===','&&!inQ){out.push(cur);cur="";}
      else cur+=c;
    }
    out.push(cur);
    return out.map(v=>v.trim());
  };

  const parseCSV=()=>{
    const lines=csvText.trim().split(/\r?\n/).filter(l=>l.trim());
    if(lines.length===0){setCsvRows([]);flash_("CSV boş","err");return;}
    const hdrs=splitCSVLine(lines[0]).map(h=>h.toLowerCase().replace(/ /g,"_"));
    // Beklenen header (en az biri) yoksa format yanlış.
    if(!hdrs.some(h=>["ticker","date","way","shares"].includes(h))){
      setCsvRows([]);
      flash_('Header bulunamadı. İlk satır şöyle olmalı: "Date,Ticker,Name,Type,Way,Shares,Price,Currency,Total,Broker,Commission"',"err");
      return;
    }
    if(lines.length<2){setCsvRows([]);flash_("Header var ama veri satırı yok","err");return;}
    const allDataRows=lines.slice(1).map(line=>{
      const vals=splitCSVLine(line);
      const obj={};
      hdrs.forEach((h,i)=>obj[h]=(vals[i]||""));
      return obj;
    });
    const rows=allDataRows.filter(r=>r.ticker&&["BUY","SELL","DIV"].includes((r.way||"").toUpperCase()));
    const skipped=allDataRows.length-rows.length;
    setCsvSkipped(skipped);
    if(rows.length===0){flash_("Geçerli BUY/SELL/DIV satırı bulunamadı","err");}
    setCsvRows(rows);
  };

  const importCSV=async()=>{
    if(!csvRows.length)return;
    setCsvBusy(true);setProgStep("Başlıyor...");setProgPct(5);setProgDone(false);

    const allCsvMapped=csvRows.map(r=>({
      user_id:user.id,
      date:r.date||today(),
      ticker:(r.ticker||"").toUpperCase(),
      name:r.name||r.ticker||"",
      asset_type:r.type||r.asset_type||"US_STOCK",
      way:(r.way||"BUY").toUpperCase(),
      shares:parseFloat(r.shares),
      price:parseFloat(r.price),
      currency:r.currency||"USD",
      total:+(parseFloat(r.shares)*parseFloat(r.price)).toFixed(4),
      broker:r.broker||"",
      commission:parseFloat(r.commission)||0,
      exchange:r.exchange||"",
      notes:r.notes||"",
      portfolio_id:portfolioId
    }));
    const txInserts=allCsvMapped.filter(r=>{
      const ok=r.shares>0&&isFinite(r.shares)&&r.price>=0&&isFinite(r.price);
      if(!ok)DEBUG&&console.warn("[CSV skip]",r.ticker,"shares="+r.shares,"price="+r.price);
      return ok;
    });
    const csvExtraSkip=allCsvMapped.length-txInserts.length;

    let ok=0;
    const bsz=CFG.CSV_BATCH_SIZE;
    for(let i=0;i<txInserts.length;i+=bsz){
      const{error}=await sb.from("transactions").insert(txInserts.slice(i,i+bsz));
      if(!error)ok+=Math.min(bsz,txInserts.length-i);
      const pct=Math.min(65,Math.round(((i+bsz)/txInserts.length)*60)+5);
      setProgStep(`${ok} / ${txInserts.length} işlem eklendi`);
      setProgPct(pct);
    }

    setProgStep("Splitler senkronize ediliyor...");setProgPct(72);
    const syncTickers=[...new Set(txInserts.filter(r=>r.asset_type!=="BIST").map(r=>r.ticker))];
    if(syncTickers.length)await syncSplits(syncTickers,portfolioId);
    setProgStep("Pozisyonlar hesaplanıyor...");setProgPct(82);
    setProgStep("Supabase güncelleniyor...");setProgPct(90);
    const posCount=await rebuildPositions(user.id,portfolioId);
    await loadData();

    if(posCount===null){flash_("Pozisyonlar güncellenemedi","err");}
    else{setProgStep(`✓ ${ok} işlem · ${posCount} pozisyon aktarıldı`+(csvExtraSkip>0?` · ${csvExtraSkip} satır atlandı`:""));}
    setProgPct(100);setProgDone(true);setCsvBusy(false);
    setTimeout(()=>{setCsvText("");setCsvRows([]);setProgStep("");setProgPct(0);setProgDone(false);},CFG.CSV_PROGRESS_MS);
  };

  const MODES=[["text","📝 Metin"],["image","📷 Görüntü"],["csv","📋 CSV"],["manuel","📌 Manuel"]];

  // Picker — kullanıcı henüz tip seçmediyse sadece bunu göster
  if(!pickedType){
    return(
      <div>
        <div className="cbox" style={{padding:18}}>
          <div className="lbl" style={{marginBottom:6,fontSize:13}}>Hangi tür işlem ekliyorsun?</div>
          <div style={{fontSize:12,color:"var(--text2)",marginBottom:14}}>Devam etmek için varlık türünü seç. Sonradan değiştirebilirsin.</div>
          <div className="type-picker-grid">
            {ADD_TYPES.map(({type,label,desc})=>(
              <button key={type} data-test={`pick-${type}`} className="pick-card"
                onClick={()=>{setPickedType(type);if(MANUEL_ONLY_TYPES.has(type))setMode("manuel");}}>
                <span style={{color:"var(--info)",display:"flex",alignItems:"center"}}>{ASSET_ICONS[type]&&ASSET_ICONS[type](28)}</span>
                <span style={{fontSize:14,fontWeight:600}}>{label}</span>
                <span style={{fontSize:11,color:"var(--text2)"}}>{desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const pickedMeta = ADD_TYPES.find(t=>t.type===pickedType);

  return(
    <div>
      {/* Tip context header */}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:8,marginBottom:14,fontSize:12}}>
        <span style={{color:"var(--info)",display:"flex",alignItems:"center"}}>{ASSET_ICONS[pickedMeta.type]&&ASSET_ICONS[pickedMeta.type](18)}</span>
        <span><span className="dim">Tip:</span> <strong>{pickedMeta.label}</strong></span>
        <div style={{flex:1}}></div>
        <button className="btn-xs" onClick={resetType} data-test="change-type">Tipi değiştir</button>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {(pickedType && MANUEL_ONLY_TYPES.has(pickedType)
          ? MODES.filter(([m])=>m==="manuel")
          : MODES).map(([m,l])=>(
          <button key={m} className={"mtab"+(mode===m?" on":"")} onClick={()=>switchMode(m)}>{l}</button>
        ))}
      </div>

      {mode==="text"&&(
        <div>
          <textarea value={textInput} onChange={e=>setTextInput(e.target.value)} rows={4}
            placeholder={"\"NVDA 5 adet $210 Akbank bugün\"\n\"SPY 2 lot sattım $715 QNB komisyon $3\"\n\"BTC 0.001 adet 95000 TRY Binance\""}
            style={{marginBottom:10,lineHeight:1.6,resize:"vertical"}}/>
          <button className="pri" onClick={parseText} disabled={parsing||!textInput.trim()}>
            {parsing?"Parse ediliyor...":"AI ile Parse Et"}
          </button>
          {parseErr&&<div className="inline-alert err">{parseErr}</div>}
          <ConfirmBox data={parsed} onSave={saveTx} onCancel={()=>setParsed(null)}/>
        </div>
      )}

      {mode==="image"&&(
        <div>
          <div style={{marginBottom:12}}>
            <div className="lbl" style={{marginBottom:8}}>Broker ekran görüntüsü</div>
            <input type="file" accept="image/*" onChange={e=>setImgFile(e.target.files[0])} style={{fontSize:13}}/>
            {imgFile&&<div style={{fontSize:12,color:"var(--text2)",marginTop:6}}>{imgFile.name} · {(imgFile.size/1024).toFixed(0)} KB</div>}
          </div>
          <button className="pri" onClick={parseImage} disabled={parsing||!imgFile}>
            {parsing?"Okunuyor...":"Görüntüyü Oku"}
          </button>
          {parseErr&&<div className="inline-alert err">{parseErr}</div>}
          <ConfirmBox data={parsed} onSave={saveTx} onCancel={()=>setParsed(null)}/>
        </div>
      )}

      {mode==="csv"&&(
        <div>
          <div style={{marginBottom:12}}>
            <div className="lbl" style={{marginBottom:8}}>Dosya Yükle</div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
            <button onClick={()=>fileRef.current&&fileRef.current.click()} style={{marginBottom:10}}>📂 Dosya Seç</button>
          </div>
          <div style={{marginBottom:12}}>
            <div className="lbl" style={{marginBottom:6}}>veya Yapıştır</div>
            <textarea value={csvText} onChange={e=>{setCsvText(e.target.value);setCsvRows([]);}} rows={4}
              placeholder={"Date,Ticker,Name,Type,Way,Shares,Price,Currency,Total,Broker,Commission\n2021-03-03,TSLA,Tesla Inc,US_STOCK,BUY,2,692.08,USD,1384.16,QNB,20"}
              style={{fontSize:11,fontFamily:"monospace",resize:"vertical",marginBottom:0}}/>
          </div>
          <div className="brow" style={{marginBottom:14}}>
            <button onClick={parseCSV} disabled={!csvText.trim()||csvBusy}>Önizle</button>
            {csvRows.length>0&&!csvBusy&&!progDone&&(
              <button className="pri" onClick={importCSV}>{csvRows.length} İşlemi İçe Aktar</button>
            )}
          </div>
          {progStep&&(
            <div style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:12,color:progDone?"var(--ok)":"var(--text2)"}}>{progStep}</span>
                <span style={{fontSize:11,color:"var(--text3)"}}>{progPct}%</span>
              </div>
              <div className="pbar">
                <div className="pbar-fill" style={{width:progPct+"%",background:progDone?"var(--ok)":"var(--info)"}}/>
              </div>
            </div>
          )}
          {csvRows.length>0&&!csvBusy&&(
            <div>
              <div className="stitle">{csvRows.length} işlem bulundu{csvSkipped>0?` · ${csvSkipped} satır atlandı`:""} — ilk 5:</div>
              <div className="tbl-wrap">
                <table aria-label="CSV önizleme — ilk 5 işlem">
                  <thead><tr>{["Tarih","Ticker","İşlem","Adet","Fiyat","Broker"].map(h=><th key={h} scope="col" className="l">{h}</th>)}</tr></thead>
                  <tbody>
                    {csvRows.slice(0,5).map((r,i)=>(
                      <tr key={i}>
                        <td className="l" style={{fontSize:11}}>{fmtDateTR(r.date)}</td>
                        <td className="l" style={{fontWeight:700}}>{r.ticker}</td>
                        <td className={"l "+((r.way||"").toUpperCase()==="BUY"?"ok":(r.way||"").toUpperCase()==="DIV"?"warn":"err")} style={{fontSize:11}}>{(r.way||"").toUpperCase()==="BUY"?"Alış":(r.way||"").toUpperCase()==="DIV"?"Temettü":"Satış"}</td>
                        <td className="l">{r.shares}</td>
                        <td className="l">{r.price}</td>
                        <td className="l" style={{fontSize:11}}>{r.broker}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvRows.length>5&&<div className="dim" style={{fontSize:11,marginTop:4}}>...ve {csvRows.length-5} işlem daha</div>}
            </div>
          )}
        </div>
      )}

      {mode==="manuel"&&(
        <ManuelPosForm key={pickedType} session={session} user={user} pos={pos} loadData={loadData} flash_={flash_} confirm_={confirm_} prefillType={pickedType} portfolioId={portfolioId}/>
      )}
    </div>
  );
}

