// ── ManuelPosForm ────────────────────────────────────────────────
function ManuelPosForm({session,user,pos,loadData,flash_,confirm_,prefillType,portfolioId}){
  // prefillType: AddTab type-picker'dan gelen başlangıç tipi (US_STOCK/BIST/...).
  // BIST için currency varsayılanı TRY; diğerleri USD. Kullanıcı dropdown'larla
  // istediği zaman değiştirebilir; type değişimi `onChange`'de currency'i de
  // BIST'e göre günceller (mevcut davranış korunuyor).
  const initType = prefillType || "US_STOCK";
  const initCurrency = (initType==="BIST"||initType==="BES"||initType==="CASH"||initType==="DEPOSIT") ? "TRY" : "USD";
  const E={ticker:"",name:"",type:initType,shares:"",avgCost:"",currency:initCurrency,broker:"",commission:"",date:today(),unit:"oz",currentValue:"",interestRate:"",maturityDate:"",reserveRatio:"",dkPrincipal:"",dkCurrent:""};
  const [form,setForm]=useState(E);
  const [curPrice,setCurPrice]=useState(null);
  // Fiyat fetch sonucu hakkında inline uyarı/bilgi: {type:"ok"|"warn", text}.
  // warn: tarihin fiyatı yok, fallback kullanıldı → kullanıcı bilinçli kontrol etsin.
  const [priceNote,setPriceNote]=useState(null);
  const [fetchP,setFetchP]=useState(false);
  const [saving,setSaving]=useState(false);
  const [editTk,setEditTk]=useState(null);
  const [errs,setErrs]=useState({});
  const set=f=>setForm(p=>({...p,...f}));
  const validate=()=>{
    const e={};
    const isCashType=form.type==="CASH"||form.type==="DEPOSIT";
    if(form.type!=="BES"&&(+form.shares<=0||isNaN(+form.shares)))e.shares="Bakiye 0'dan büyük olmalı";
    if(!isCashType&&(+form.avgCost<=0||isNaN(+form.avgCost)))e.avgCost=form.type==="BES"?"Tutar 0'dan büyük olmalı":"Fiyat 0'dan büyük olmalı";
    if(form.type==="DEPOSIT"){
      if(+form.interestRate<=0||isNaN(+form.interestRate))e.interestRate="Faiz oranı 0'dan büyük olmalı";
    }
    if(form.type==="BES"){
      if(+form.currentValue<=0||isNaN(+form.currentValue))e.currentValue="Kişisel portföy değeri 0'dan büyük olmalı";
      if(+form.dkPrincipal<=0||isNaN(+form.dkPrincipal))e.dkPrincipal="DK anaparası 0'dan büyük olmalı";
      if(+form.dkCurrent<=0||isNaN(+form.dkCurrent))e.dkCurrent="DK güncel değeri 0'dan büyük olmalı";
    }
    setErrs(e);
    return Object.keys(e).length===0;
  };

  const NAMES={SCHD:"Schwab US Dividend ETF",SPY:"SPDR S&P 500 ETF",QQQ:"Invesco QQQ Trust",MCHI:"iShares MSCI China ETF",VT:"Vanguard Total World ETF",NVDA:"NVIDIA Corp",SOFI:"SoFi Technologies",GOOGL:"Alphabet Inc",META:"Meta Platforms",KO:"Coca-Cola Co",UBER:"Uber Technologies",MNSO:"MINISO Group",AEVA:"Aeva Technologies",PYPL:"PayPal Holdings",SKLZ:"Skillz Inc",NNOX:"Nano-X Imaging",TSLA:"Tesla Inc",AAPL:"Apple Inc",MSFT:"Microsoft Corp",AMZN:"Amazon.com",BTC:"Bitcoin"};

  const fetchPrice=async(tk,date,typeOverride)=>{
    const upper=(tk||form.ticker).toUpperCase();
    const useDate=date||form.date||today();
    // typeOverride: onChange'lerden çağrıldığında stale closure yerine yeni tipi geçirmek için
    const at=typeOverride||form.type;
    if(!upper)return;
    if(NAMES[upper])set({name:NAMES[upper]});
    if(at==="BES"||at==="CASH"||at==="DEPOSIT")return;  // BES/CASH/DEPOSIT: auto-fetch atla
    setFetchP(true);setCurPrice(null);setPriceNote(null);
    // Sembol: form.currency'den (kullanıcı override edebildiği için type yerine currency referans).
    const sym = displaySym(form.currency);
    try{
      // Önce date-spesifik dene; hafta sonu / tatil 403 verirse latest close'a fallback.
      const r=await edgePriceCall({ticker:upper,mode:"price",date:useDate,asset_type:at});
      const d=await r.json();
      let price=d.result?.price;
      let fallback=false;
      let fallbackDate=null;
      if(!price){
        DEBUG && console.warn(`[fetchPrice ${upper}] date fail`,d.result?.error||d.error);
        const r2=await edgePriceCall({ticker:upper,mode:"price",asset_type:at});
        const d2=await r2.json();
        if(d2.result?.price){
          price=d2.result.price;
          fallback=true;
          fallbackDate=d2.date||null;
        } else {
          const msg=d2.result?.error||d.result?.error||d.error||"fiyat alınamadı";
          DEBUG && console.warn(`[fetchPrice ${upper}] no fallback`,msg);
          setPriceNote({type:"err", text:`${upper}: ${msg}`});
        }
      }
      if(price){
        setCurPrice(price);
        set({avgCost:price.toFixed(2)});
        if(fallback){
          // avgCost yine de doldurulur ama uyarı persistent: kullanıcı tarihi
          // kontrol edip gerekirse manuel düzeltsin.
          setPriceNote({
            type:"warn",
            text:`⚠ ${fmtDateTR(useDate)} için veri yok${fallbackDate?` — ${fmtDateTR(fallbackDate)} kapanışı kullanıldı`:" — en son kapanış kullanıldı"} (${sym}${fmt(price)}). Tarih hafta sonu/tatil olabilir; düzeltebilir veya devam edebilirsin.`,
          });
        } else {
          setPriceNote({type:"ok", text:`${fmtDateTR(useDate)} fiyatı: ${sym}${fmt(price)}`});
        }
      }
    }catch(e){
      DEBUG && console.warn(`[fetchPrice ${upper}]`,e);
      setPriceNote({type:"err", text:`${upper} fiyatı alınamadı: ${e.message}`});
    }
    setFetchP(false);
  };

  const startEdit=p=>{
    setEditTk(p.ticker);
    setForm({...E,ticker:p.ticker,name:p.name,type:p.type,shares:p.shares,avgCost:p.type==="CASH"||p.type==="DEPOSIT"?"":p.avgCost,currency:p.currency,broker:p.broker||"",
      interestRate:p.interestRate!=null?(p.interestRate*100).toString():"",
      maturityDate:p.maturityDate||"",
      reserveRatio:p.reserveRatio!=null&&p.reserveRatio>0?(p.reserveRatio*100).toString():"",
      dkPrincipal:p.dkPrincipal!=null?p.dkPrincipal.toString():"",
      dkCurrent:p.dkCurrent!=null?p.dkCurrent.toString():""});
    if(p.type!=="BES"&&p.type!=="CASH"&&p.type!=="DEPOSIT")fetchPrice(p.ticker);
  };

  const savePos=async()=>{
    const isCashType=form.type==="CASH"||form.type==="DEPOSIT";
    if(!form.ticker||(form.type!=="BES"&&!isCashType&&!form.shares)||(isCashType&&!form.shares))return;
    if(!validate())return;
    setSaving(true);
    const tk=form.ticker.toUpperCase();
    const nm=form.name||tk;
    const ozFactor = form.type==="GOLD" ? goldOzPerUnit(form.unit||'oz') : 1;
    const sh = form.type==="BES" ? 1 : isCashType ? +form.shares : +form.shares * ozFactor;
    const pr = form.type==="BES" ? +form.avgCost : isCashType ? 1.0 : +form.avgCost / ozFactor;

    const goldUnitNote = form.type==="GOLD"&&form.unit&&form.unit!=="oz" ? `Manuel giriş (${form.unit})` : "Manuel giriş";
    const tx={
      user_id:user.id,
      date:form.date||today(),
      ticker:tk,name:nm,
      asset_type:form.type,
      way:"BUY",
      shares:sh,price:pr,
      currency:form.currency,
      total:+(sh*pr).toFixed(4),
      broker:form.broker||"",
      commission:+(form.commission||0),exchange:"",notes:goldUnitNote,
      portfolio_id:portfolioId
    };
    const{error:te}=await sb.from("transactions").insert(tx);
    if(te){flash_(te.message,"err");setSaving(false);return;}

    if(form.type==="BES"){
      const total=+form.currentValue + +form.dkCurrent;
      try{
        await edgePriceCall({mode:"set-manual-price",ticker:tk,price:total,asset_type:"BES"});
      }catch(e){
        console.warn("[BES set-manual-price]",e);
      }
    }
    const extraMeta = form.type==="DEPOSIT"
      ? {[tk]:{interest_rate:+form.interestRate/100,maturity_date:form.maturityDate||null,reserve_ratio:+form.reserveRatio/100||0}}
      : form.type==="BES"
        ? {[tk]:{dk_principal:+form.dkPrincipal,dk_current:+form.dkCurrent}}
        : {};
    const rebuilt=await rebuildPositions(user.id,portfolioId,extraMeta);
    if(rebuilt===null){flash_("Pozisyon güncellenemedi","err");setSaving(false);return;}

    await loadData();
    flash_(`${tk} işlem geçmişine ve pozisyona eklendi ✓`);
    setEditTk(null);setForm(E);setCurPrice(null);
    setSaving(false);
  };

  const delPos=async(tk)=>{
    if(!(await confirm_(`${tk} pozisyonu ve tüm işlem geçmişi silinsin mi?`,{okLbl:"Sil",danger:true})))return;
    await sb.from("transactions").delete().eq("user_id",user.id).eq("ticker",tk).eq("portfolio_id",portfolioId);
    await rebuildPositions(user.id,portfolioId);
    await loadData();flash_(`${tk} silindi`);
  };

  const isCashType = form.type==="CASH"||form.type==="DEPOSIT";
  return(
    <div>
      <div className="cbox" style={{marginBottom:16}}>
        <div className="lbl" style={{marginBottom:12}}>{editTk?`${editTk} — Düzenle`:"Yeni Pozisyon Ekle"}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div>
            <div className="kk" style={{marginBottom:4}}>Tarih</div>
            <input className="finp" type="date" value={form.date}
              onChange={e=>{
                const newDate=e.target.value;
                set({date:newDate});
                setCurPrice(null);
                // Ticker zaten girilmişse, yeni tarihin fiyatını otomatik çek
                if(form.ticker&&newDate)fetchPrice(form.ticker,newDate);
              }}
              max={today()}/>
          </div>
          <div>
            <div className="kk" style={{marginBottom:4}}>{form.type==="BES"?"Hesap Kodu *":form.type==="CASH"||form.type==="DEPOSIT"?"Hesap Etiketi *":"Ticker *"}</div>
            <div style={{display:"flex",gap:6}}>
              <input className="finp" style={{textTransform:"uppercase"}} maxLength={20} value={form.ticker}
                onChange={e=>{set({ticker:e.target.value.toUpperCase(),name:"",avgCost:""});setCurPrice(null);setPriceNote(null);}}
                onBlur={e=>e.target.value&&form.type!=="CASH"&&form.type!=="DEPOSIT"&&fetchPrice(e.target.value)}
                placeholder={form.type==="BES"?"AH, GARANTI...":form.type==="CASH"?"ZIRAAT_TRY":form.type==="DEPOSIT"?"AKBANK_VAD_1":"AAPL"} disabled={!!editTk}/>
              {form.type!=="BES"&&form.type!=="CASH"&&form.type!=="DEPOSIT"&&(
                <button style={{whiteSpace:"nowrap",fontSize:12,padding:"7px 10px"}}
                  onClick={()=>fetchPrice()} disabled={fetchP||!form.ticker}>
                  {fetchP?<div className="spin" style={{width:12,height:12}}></div>:"↻"}
                </button>
              )}
            </div>
            {form.type==="CRYPTO"&&!editTk&&(
              <div style={{marginTop:6}}>
                <div style={{fontSize:10,color:"var(--text3)",marginBottom:4}}>Popüler:</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {CRYPTO_SYMBOLS.map(({sym,name})=>(
                    <button key={sym} type="button" className="btn-xs"
                      onClick={()=>{set({ticker:sym,name});setCurPrice(null);fetchPrice(sym);}}
                      style={{fontSize:10,padding:"3px 8px"}}>{sym}</button>
                  ))}
                </div>
              </div>
            )}
            {form.type==="GOLD"&&!editTk&&(
              <div style={{marginTop:6}}>
                <div style={{fontSize:10,color:"var(--text3)",marginBottom:4}}>Emtia (1 ons = 31.1035 g):</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {COMMODITY_SYMBOLS.map(({sym,name})=>(
                    <button key={sym} type="button" className="btn-xs"
                      onClick={()=>{set({ticker:sym,name:`${name} (1 ons)`});setCurPrice(null);fetchPrice(sym);}}
                      style={{fontSize:10,padding:"3px 8px",display:"inline-flex",alignItems:"center",gap:4}}>
                      <span style={{color:"var(--warn)",display:"flex"}}>{COMMODITY_ICONS[sym]&&COMMODITY_ICONS[sym](14)}</span>{sym}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {form.type==="GOLD"&&(
              <div style={{marginTop:8}}>
                <div style={{fontSize:10,color:"var(--text3)",marginBottom:4}}>Birim:</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {GOLD_UNITS.map(({key,label})=>(
                    <button key={key} type="button"
                      className={"btn-xs"+(form.unit===key?" on":"")}
                      onClick={()=>set({unit:key})}
                      style={{fontSize:10,padding:"3px 8px"}}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {priceNote&&(
              <div style={{
                fontSize:11,
                marginTop:6,
                padding:priceNote.type==="ok"?"0":"6px 10px",
                borderRadius:priceNote.type==="ok"?0:6,
                background:priceNote.type==="warn"?"rgba(255,184,0,0.08)":priceNote.type==="err"?"rgba(255,51,102,0.08)":"transparent",
                border:priceNote.type==="warn"?"1px solid rgba(255,184,0,0.25)":priceNote.type==="err"?"1px solid rgba(255,51,102,0.25)":"none",
                color:priceNote.type==="ok"?"var(--ok)":priceNote.type==="warn"?"var(--warn)":"var(--err)",
                lineHeight:1.4,
              }}>{priceNote.text}</div>
            )}
          </div>
          <div>
            <div className="kk" style={{marginBottom:4}}>{form.type==="BES"?"Plan Adı":"Şirket Adı"}</div>
            <input className="finp" maxLength={100} value={form.name} onChange={e=>set({name:e.target.value})} placeholder={form.type==="BES"?"Bireysel Emeklilik Planım...":"Apple Inc"}/>
          </div>
          <div>
            <div className="kk" style={{marginBottom:4}}>Varlık Türü</div>
            <select className="finp" value={form.type} onChange={e=>{
              const newType=e.target.value;
              const upd={type:newType};
              // Currency varsayılanları — kullanıcı manuel override edebilir
              if(newType==="BIST"||newType==="BES"||newType==="CASH"||newType==="DEPOSIT")upd.currency="TRY";
              else if(newType==="CRYPTO"||newType==="US_STOCK"||newType==="FUND"||newType==="GOLD")upd.currency="USD";
              set(upd);
              // Type değişince eski fiyat geçersiz; ticker varsa yeniden çek
              setCurPrice(null);setPriceNote(null);
              if(form.ticker&&newType!=="CASH"&&newType!=="DEPOSIT")fetchPrice(form.ticker,form.date,newType);
            }}>
              <option value="US_STOCK">Hisse (US)</option>
              <option value="FUND">ETF / Fon</option>
              <option value="CRYPTO">Kripto</option>
              <option value="BIST">BIST</option>
              <option value="GOLD">Altın</option>
              <option value="FX">Döviz</option>
              <option value="BES">BES Fonu</option>
              <option value="CASH">Nakit</option>
              <option value="DEPOSIT">Vadeli Mevduat</option>
            </select>
          </div>
          {form.type!=="BES"&&(
            <div>
              <div className="kk" style={{marginBottom:4}}>Para Birimi</div>
              <select className="finp" value={form.currency} onChange={e=>set({currency:e.target.value})}>
                <option>USD</option><option>TRY</option><option>EUR</option>
              </select>
            </div>
          )}
          {form.type!=="BES"&&(
            <div>
              <div className="kk" style={{marginBottom:4}}>{form.type==="GOLD"?`Adet * (${GOLD_UNITS.find(g=>g.key===form.unit)?.label||'oz'})`:form.type==="CASH"||form.type==="DEPOSIT"?"Bakiye *":"Adet *"}</div>
              <input className="finp" type="number" step="any" value={form.shares}
                aria-invalid={!!errs.shares}
                style={errs.shares?{borderColor:"var(--err)"}:{}}
                onChange={e=>{set({shares:e.target.value});if(errs.shares)setErrs(p=>({...p,shares:undefined}));}}
                onBlur={()=>{if(form.shares&&+form.shares<=0)setErrs(p=>({...p,shares:"Adet 0'dan büyük olmalı"}));}}
                placeholder="0"/>
              {errs.shares&&<div style={{fontSize:11,color:"var(--err)",marginTop:3}}>{errs.shares}</div>}
            </div>
          )}
          {!isCashType&&(
          <div>
            <div className="kk" style={{marginBottom:4}}>{form.type==="BES"?"Kişisel Yatırılan (₺) *":form.type==="GOLD"?`Ort. Maliyet * (${form.currency}/${GOLD_UNITS.find(g=>g.key===form.unit)?.label||'oz'})`:"Ort. Maliyet *"}</div>
            <input className="finp" type="number" step="any" value={form.avgCost}
              aria-invalid={!!errs.avgCost}
              style={errs.avgCost?{borderColor:"var(--err)"}:{}}
              onChange={e=>{set({avgCost:e.target.value});if(errs.avgCost)setErrs(p=>({...p,avgCost:undefined}));}}
              onBlur={()=>{if(form.avgCost&&+form.avgCost<=0)setErrs(p=>({...p,avgCost:form.type==="BES"?"Tutar 0'dan büyük olmalı":"Fiyat 0'dan büyük olmalı"}));}}
              placeholder={form.type==="BES"?"10000":"0.00"}/>
            {errs.avgCost&&<div style={{fontSize:11,color:"var(--err)",marginTop:3}}>{errs.avgCost}</div>}
          </div>
          )}
          {form.type==="BES"&&(
            <div>
              <div className="kk" style={{marginBottom:4}}>Kişisel Portföy Güncel Değeri (₺) *</div>
              <input className="finp" type="number" step="any" value={form.currentValue}
                aria-invalid={!!errs.currentValue}
                style={errs.currentValue?{borderColor:"var(--err)"}:{}}
                onChange={e=>{set({currentValue:e.target.value});if(errs.currentValue)setErrs(p=>({...p,currentValue:undefined}));}}
                placeholder="kişisel portföy güncel değeri"/>
              {errs.currentValue&&<div style={{fontSize:11,color:"var(--err)",marginTop:3}}>{errs.currentValue}</div>}
            </div>
          )}
          {form.type==="BES"&&(
            <div>
              <div className="kk" style={{marginBottom:4}}>Devlet Katkısı Anaparası (₺) *</div>
              <input className="finp" type="number" step="any" value={form.dkPrincipal}
                aria-invalid={!!errs.dkPrincipal}
                style={errs.dkPrincipal?{borderColor:"var(--err)"}:{}}
                onChange={e=>{set({dkPrincipal:e.target.value});if(errs.dkPrincipal)setErrs(p=>({...p,dkPrincipal:undefined}));}}
                placeholder="devlet katkısı anaparası"/>
              {errs.dkPrincipal&&<div style={{fontSize:11,color:"var(--err)",marginTop:3}}>{errs.dkPrincipal}</div>}
            </div>
          )}
          {form.type==="BES"&&(
            <div>
              <div className="kk" style={{marginBottom:4}}>DK Portföy Güncel Değeri (₺) *</div>
              <input className="finp" type="number" step="any" value={form.dkCurrent}
                aria-invalid={!!errs.dkCurrent}
                style={errs.dkCurrent?{borderColor:"var(--err)"}:{}}
                onChange={e=>{set({dkCurrent:e.target.value});if(errs.dkCurrent)setErrs(p=>({...p,dkCurrent:undefined}));}}
                placeholder="DK portföy güncel değeri"/>
              {errs.dkCurrent&&<div style={{fontSize:11,color:"var(--err)",marginTop:3}}>{errs.dkCurrent}</div>}
              {+form.dkCurrent>0&&+form.dkPrincipal>0&&+form.dkCurrent<+form.dkPrincipal&&(
                <div style={{fontSize:11,color:"var(--warn)",marginTop:3}}>DK güncel değeri anaparadan düşük — devam edebilirsin.</div>
              )}
            </div>
          )}
          <div>
            <div className="kk" style={{marginBottom:4}}>{form.type==="BES"?"Emeklilik Şirketi":isCashType?"Banka (isteğe bağlı)":"Broker"}</div>
            <input className="finp" maxLength={50} value={form.broker} onChange={e=>set({broker:e.target.value})} placeholder={form.type==="BES"?"Anadolu Hayat, Garanti, Allianz...":isCashType?"Ziraat, Akbank, Garanti...":"Akbank, Midas..."}/>
          </div>
          {form.type!=="BES"&&!isCashType&&(
            <div>
              <div className="kk" style={{marginBottom:4}}>Komisyon</div>
              <input className="finp" type="number" step="any" value={form.commission} onChange={e=>set({commission:e.target.value})} placeholder="0.00"/>
            </div>
          )}
          {form.type==="DEPOSIT"&&(
            <div>
              <div className="kk" style={{marginBottom:4}}>Faiz Oranı (%) *</div>
              <input className="finp" type="number" step="any" value={form.interestRate}
                aria-invalid={!!errs.interestRate}
                style={errs.interestRate?{borderColor:"var(--err)"}:{}}
                onChange={e=>{set({interestRate:e.target.value});if(errs.interestRate)setErrs(p=>({...p,interestRate:undefined}));}}
                placeholder="42"/>
              {errs.interestRate&&<div style={{fontSize:11,color:"var(--err)",marginTop:3}}>{errs.interestRate}</div>}
            </div>
          )}
          {form.type==="DEPOSIT"&&(
            <div>
              <div className="kk" style={{marginBottom:4}}>Rezerv Oranı (%)</div>
              <input className="finp" type="number" step="any" min="0" max="100" value={form.reserveRatio}
                onChange={e=>set({reserveRatio:e.target.value})}
                placeholder="0"/>
              <div style={{fontSize:10,color:"var(--text3)",marginTop:3}}>Kazanç dışı talep hesabı (örn. Serbest Plus: 10)</div>
            </div>
          )}
          {form.type==="DEPOSIT"&&(
            <div>
              <div className="kk" style={{marginBottom:4}}>Vade Tarihi</div>
              <input className="finp" type="date" value={form.maturityDate}
                onChange={e=>set({maturityDate:e.target.value})}
                min={today()}/>
              <div style={{fontSize:10,color:"var(--text3)",marginTop:3}}>Boş bırakın = süresiz hesap (Serbest Plus vb.)</div>
            </div>
          )}
          {form.type==="DEPOSIT"&&form.shares&&+form.shares>0&&form.interestRate&&+form.interestRate>0&&form.date&&(()=>{
            const effectiveRate=(+form.interestRate/100)*(1-(+form.reserveRatio||0)/100);
            const days=Math.max(0,(Date.now()-new Date(form.date).getTime())/86400000);
            const grossInt=(+form.shares)*(Math.pow(1+effectiveRate/365,days)-1);
            const netInt=grossInt*(1-0.175);
            return(
              <div style={{fontSize:11,color:"var(--text2)",padding:"7px 0",gridColumn:"1/-1"}}>
                <span>Anapara: {displaySym(form.currency)}{fmt(+form.shares,0)}</span>
                <span style={{marginLeft:12}}>Etkin faiz: %{fmt(effectiveRate*100,2)}</span>
                <span style={{marginLeft:12}}>{Math.floor(days)} gün</span>
                {days>0&&<><br/>
                  <span style={{color:"var(--text3)"}}>Brüt faiz: +{displaySym(form.currency)}{fmt(grossInt,0)}</span>
                  <span style={{marginLeft:12,color:"var(--ok)"}}>Net (stopaj sonrası): +{displaySym(form.currency)}{fmt(netInt,0)}</span>
                </>}
              </div>
            );
          })()}
          <div style={{display:"flex",alignItems:"flex-end"}}>
            {form.type==="BES"?(
              form.avgCost&&+form.avgCost>0?(
                <div style={{fontSize:11,color:"var(--text2)",padding:"7px 0"}}>
                  <span>Kişisel katkı: ₺{fmt(+form.avgCost,0)}</span>
                  {+form.dkPrincipal>0&&<span style={{marginLeft:8}}>· DK: ₺{fmt(+form.dkPrincipal,0)}</span>}
                  {+form.currentValue>0&&+form.dkCurrent>0&&(()=>{
                    const total=+form.currentValue+ +form.dkCurrent;
                    const gain=total- +form.avgCost;
                    const pct=gain/(+form.avgCost)*100;
                    return(
                      <>
                        <br/>Toplam hesap değeri: ₺{fmt(total,0)}
                        <br/><span style={{color:gain>=0?"var(--ok)":"var(--err)"}}>
                          Toplam getiri: {gain>=0?"+":""}₺{fmt(gain,0)} ({gain>=0?"+":""}{fmt(pct,1)}%)
                        </span>
                      </>
                    );
                  })()}
                </div>
              ):null
            ):(!isCashType&&form.shares&&form.avgCost?(
                <div style={{fontSize:11,color:"var(--text2)",padding:"7px 0"}}>
                  Maliyet: {displaySym(form.currency)}{fmt((+form.shares)*(+form.avgCost),0)}
                  {curPrice&&<><br/>Piyasa: {displaySym(form.currency)}{fmt((+form.shares)*curPrice,0)}</>}
                </div>
              ):null
            )}
          </div>
        </div>
        <div className="brow">
          <button className="pri" onClick={savePos} disabled={saving||!form.ticker||(form.type!=="BES"&&!form.shares)||(form.type==="DEPOSIT"&&!form.interestRate)||(!isCashType&&!form.avgCost)}>
            {saving?"Kaydediliyor...":(editTk?"Güncelle":"Pozisyon Kaydet")}
          </button>
          {editTk&&<button onClick={()=>{setEditTk(null);setForm(E);setCurPrice(null);}}>İptal</button>}
        </div>
        <div style={{fontSize:11,color:"var(--text2)",marginTop:8}}>ℹ Bu form bir BUY işlemi kaydeder ve mevcut pozisyonu günceller.</div>
      </div>

      {pos.filter(p=>p.shares>CFG.DUST_THRESHOLD).length>0&&(
        <div>
          <div className="stitle">Mevcut Pozisyonlar</div>
          {[...pos].filter(p=>p.shares>CFG.DUST_THRESHOLD).sort((a,b)=>a.ticker.localeCompare(b.ticker)).map(p=>(
            <div key={p.ticker} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"0.5px solid var(--border)"}}>
              <div>
                <span style={{fontWeight:700,fontSize:13,fontFamily:"monospace"}}>{p.ticker}</span>
                {p.type==="BES"
                  ?<span className="dim" style={{fontSize:11,marginLeft:8}}>₺{fmt(p.avgCost,0)} kişisel{p.dkPrincipal!=null?` · DK: ₺${fmt(p.dkPrincipal,0)} · Güncel DK: ₺${fmt(p.dkCurrent,0)}`:""}</span>
                  :(p.type==="CASH"||p.type==="DEPOSIT")
                    ?<span className="dim" style={{fontSize:11,marginLeft:8}}>{displaySym(p.currency)}{fmt(p.shares,0)} bakiye{p.type==="DEPOSIT"&&p.interestRate?` · %${fmt(p.interestRate*100,1)} yıllık`:""}</span>
                  :<span className="dim" style={{fontSize:11,marginLeft:8}}>{fmtShares(p.shares)} adet · {displaySym(p.currency)}{fmt(p.avgCost)} ort.</span>
                }
                {p.broker&&<span className="dim" style={{fontSize:10,marginLeft:6}}>· {p.broker}</span>}
              </div>
              <div className="brow" style={{gap:5}}>
                <button className="btn-xs" onClick={()=>startEdit(p)}>Düzenle</button>
                <button className="btn-xs btn-danger-out" onClick={()=>delPos(p.ticker)}>Sil</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

