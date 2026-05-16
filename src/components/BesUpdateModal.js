// BES pozisyonu aylık güncelleme modalı.
// Kullanım: <BesUpdateModal pos={p} prc={prc} user={user} onClose={...} onSaved={...}/>
// pos = {ticker, name, avgCost, dkCurrent, dkPrincipal, portfolioId (opsiyonel)}
// İki alan: Kişisel Güncel + DK Güncel. Anaparalar read-only badge.
// Kaydet: set-manual-price (prc total) + positions.dk_current UPDATE → onSaved().
function BesUpdateModal({pos, prc, user, portfolioId, flash_, onClose, onSaved}){
  const curTotal = prc?.[pos.ticker];
  const initKisGuncel = (curTotal!=null && pos.dkCurrent!=null)
    ? Math.max(0, curTotal - pos.dkCurrent)
    : (pos.avgCost||0);
  const initDkGuncel = pos.dkCurrent!=null ? pos.dkCurrent : (pos.dkPrincipal||0);
  const [kisGuncel,setKisGuncel]=React.useState(initKisGuncel);
  const [dkGuncel,setDkGuncel]=React.useState(initDkGuncel);
  const [saving,setSaving]=React.useState(false);

  const kisNum=+kisGuncel, dkNum=+dkGuncel;
  const valid = !isNaN(kisNum) && !isNaN(dkNum) && kisNum>=0 && dkNum>=0;
  const total = valid ? (kisNum + dkNum) : 0;

  const save = async () => {
    if(!valid || saving) return;
    if(!portfolioId){ flash_("Portföy bulunamadı","err"); return; }
    setSaving(true);
    try{
      await edgePriceCall({mode:"set-manual-price", ticker:pos.ticker, price:total, asset_type:"BES"});
    }catch(e){
      console.warn("[BesUpdateModal set-manual-price]", e);
      flash_("Fiyat güncelleme başarısız", "err");
      setSaving(false);
      return;
    }
    const {error} = await sb.from("positions")
      .update({dk_current: dkNum})
      .eq("user_id", user.id)
      .eq("ticker", pos.ticker)
      .eq("portfolio_id", portfolioId);
    if(error){
      console.warn("[BesUpdateModal dk_current update]", error);
      flash_("DK güncel kaydedilemedi (fiyat güncellendi)", "err");
      setSaving(false);
      return;
    }
    flash_(`${pos.ticker} güncellendi ✓`, "ok");
    setSaving(false);
    onSaved && onSaved();
    onClose && onClose();
  };

  return (
    <div className="mdl-bd" onClick={onClose}>
      <div className="mdl-bx" onClick={e=>e.stopPropagation()} style={{maxWidth:380}}>
        <div className="stitle" style={{marginBottom:12}}>BES Güncelle — {pos.ticker}</div>

        <div style={{display:"flex",gap:8,marginBottom:14,fontSize:11,color:"var(--text3)"}}>
          <div style={{flex:1,padding:"6px 10px",background:"var(--bg3)",borderRadius:6}}>
            <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>Kişisel Anapara</div>
            <div className="mono" style={{fontSize:12,color:"var(--text2)"}}>₺{fmt(pos.avgCost||0, 0)}</div>
          </div>
          <div style={{flex:1,padding:"6px 10px",background:"var(--bg3)",borderRadius:6}}>
            <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>DK Anaparası</div>
            <div className="mono" style={{fontSize:12,color:"var(--text2)"}}>₺{fmt(pos.dkPrincipal||0, 0)}</div>
          </div>
        </div>

        <div style={{marginBottom:12}}>
          <div className="kk" style={{marginBottom:4}}>Kişisel Güncel (₺)</div>
          <input className="finp" type="number" min="0" step="0.01"
            value={kisGuncel}
            onChange={e=>setKisGuncel(e.target.value)}
            autoFocus/>
        </div>

        <div style={{marginBottom:12}}>
          <div className="kk" style={{marginBottom:4}}>DK Güncel (₺)</div>
          <input className="finp" type="number" min="0" step="0.01"
            value={dkGuncel}
            onChange={e=>setDkGuncel(e.target.value)}/>
        </div>

        <div style={{padding:"8px 10px",background:"rgba(201,168,76,0.06)",border:"1px solid rgba(201,168,76,0.15)",borderRadius:6,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
          <span style={{fontSize:11,color:"var(--text2)"}}>Toplam Değer</span>
          <span className="mono" style={{fontSize:14,fontWeight:600,color:"var(--info)"}}>₺{fmt(total, 0)}</span>
        </div>

        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button className="btn-sm" onClick={onClose} disabled={saving}>İptal</button>
          <button className="btn-sm pri" onClick={save} disabled={!valid || saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}
