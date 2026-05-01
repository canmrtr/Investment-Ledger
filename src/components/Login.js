// ── Login ────────────────────────────────────────────────────────
function Login(){
  const [email,setEmail]=useState("");
  const [pw,setPw]=useState("");
  const [isReg,setIsReg]=useState(false);
  const [loading,setLoading]=useState(false);
  const [errMsg,setErrMsg]=useState("");
  const [okMsg,setOkMsg]=useState("");

  const submit=async()=>{
    if(!email||!pw)return;
    setLoading(true);setErrMsg("");setOkMsg("");
    const{error}=isReg
      ?await sb.auth.signUp({email,password:pw})
      :await sb.auth.signInWithPassword({email,password:pw});
    if(error)setErrMsg(error.message);
    else if(isReg)setOkMsg("Hesap oluşturuldu!");
    setLoading(false);
  };

  return(
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo">IL</div>
        <div className="login-title">Investment Ledger</div>
        <div className="login-sub">Kişisel yatırım takibi</div>
        <div className="login-field">
          <label>E-posta</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ornek@mail.com" onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </div>
        <div className="login-field">
          <label>Şifre</label>
          <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </div>
        {errMsg&&<div style={{fontSize:12,color:"var(--err)",marginTop:8}}>{errMsg}</div>}
        {okMsg&&<div style={{fontSize:12,color:"var(--ok)",marginTop:8}}>{okMsg}</div>}
        <div style={{marginTop:20,display:"flex",flexDirection:"column",gap:10}}>
          <button className="pri" onClick={submit} disabled={loading||!email||!pw}>
            {loading?<div className="spin" style={{width:14,height:14,margin:"0 auto"}}></div>:(isReg?"Kayıt Ol":"Giriş Yap")}
          </button>
          <button style={{background:"transparent",border:"none",color:"var(--info)",fontSize:13,cursor:"pointer",padding:0}} onClick={()=>{setIsReg(!isReg);setErrMsg("");setOkMsg("");}}>
            {isReg?"Hesabım var → Giriş Yap":"Hesabım yok → Kayıt Ol"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SparkChart kaldırıldı (2026-04-29)
function SparkChart({data}){
  if(!data||data.length<2)return<div className="dim" style={{fontSize:11,padding:"14px 0",textAlign:"center",minHeight:80,display:"flex",alignItems:"center",justifyContent:"center"}}>Grafik için yeterli veri yok</div>;
  const W=400,H=70,pad=6;
  const vals=data.map(d=>d.value);
  const min=Math.min(...vals),max=Math.max(...vals),rng=(max-min)||1;
  const sx=i=>pad+(W-2*pad)*(i/(data.length-1));
  const sy=v=>pad+(H-2*pad)*(1-(v-min)/rng);
  const pts=data.map((d,i)=>`${sx(i).toFixed(1)},${sy(d.value).toFixed(1)}`).join(" ");
  const up=data[data.length-1].value>=data[0].value;
  const col=up?"var(--ok)":"var(--err)";
  const areaPts=`${pad},${H-pad} ${pts} ${W-pad},${H-pad}`;
  return(
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:H,display:"block"}} preserveAspectRatio="none">
        <polygon points={areaPts} fill={col} opacity="0.08"/>
        <polyline points={pts} fill="none" stroke={col} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
        {data.map((d,i)=>(<circle key={i} cx={sx(i)} cy={sy(d.value)} r="2.2" fill={col}/>))}
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--text2)",marginTop:6,padding:"0 4px"}}>
        {data.map((d,i)=>(<span key={i} style={{flex:1,textAlign:i===0?"left":i===data.length-1?"right":"center"}}>{d.lbl}</span>))}
      </div>
    </div>
  );
}
