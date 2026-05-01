// ── AccountSection — Ayarlar içinde hesap yönetimi ──────────────
function AccountSection({user,profile,flash_,confirm_,onSaved}){
  const [editing,setEditing]=useState(null); // null | "pw" | "email" | "uname"
  const [pw1,setPw1]=useState("");
  const [pw2,setPw2]=useState("");
  const [email,setEmail]=useState("");
  const [uname,setUname]=useState("");
  const [busy,setBusy]=useState(false);

  // Profilim state
  const [profileOpen,setProfileOpen]=useState(false);
  const [bioVal,setBioVal]=useState("");
  const [avatarVal,setAvatarVal]=useState("👤");
  const [profilePublic,setProfilePublic]=useState(false);
  const [profileBusy,setProfileBusy]=useState(false);

  const saveProfile=async()=>{
    if(bioVal.length>160){flash_("Bio 160 karakteri geçemez","err");return;}
    setProfileBusy(true);
    const{error}=await sb.from("profiles").upsert({
      user_id:user.id,
      bio:bioVal.trim()||null,
      avatar_emoji:avatarVal,
      is_profile_public:profilePublic,
      updated_at:new Date().toISOString()
    },{onConflict:"user_id"});
    setProfileBusy(false);
    if(error){flash_("Kaydedilemedi","err");return;}
    flash_("Profil güncellendi ✓");
    if(onSaved)onSaved();
  };

  const cancel=()=>{setEditing(null);setPw1("");setPw2("");setEmail("");setUname("");};

  const savePw=async()=>{
    if(pw1.length<6){flash_("Şifre en az 6 karakter olmalı","err");return;}
    if(pw1!==pw2){flash_("Şifreler eşleşmiyor","err");return;}
    setBusy(true);
    const{error}=await sb.auth.updateUser({password:pw1});
    setBusy(false);
    if(error){flash_(error.message,"err");return;}
    flash_("Şifre güncellendi ✓");cancel();
  };

  const saveEmail=async()=>{
    if(!email||!email.includes("@")){flash_("Geçerli bir e-posta gir","err");return;}
    if(!(await confirm_(`${email} adresine onay maili gönderilecek. Onay verene kadar eski e-posta geçerli kalır.`,{okLbl:"Devam"})))return;
    setBusy(true);
    const{error}=await sb.auth.updateUser({email});
    setBusy(false);
    if(error){flash_(error.message,"err");return;}
    flash_("Onay maili gönderildi — yeni e-postanı kontrol et");cancel();
  };

  const saveUname=async()=>{
    if(!/^[a-z0-9_]{3,20}$/.test(uname)){
      flash_("3-20 karakter, küçük harf / rakam / alt tire","err");return;
    }
    setBusy(true);
    const{error}=await sb.from("profiles").upsert({
      user_id:user.id,username:uname,updated_at:new Date().toISOString()
    },{onConflict:"user_id"});
    setBusy(false);
    if(error){
      if(error.code==="23505"||(error.message||"").includes("duplicate")){
        flash_("Bu kullanıcı adı zaten alınmış","err");
      } else {
        flash_(error.message,"err");
      }
      return;
    }
    flash_("Kullanıcı adı kaydedildi ✓");cancel();
    if(onSaved)onSaved();
  };

  return(
    <div className="sg">
      <label>Hesap</label>
      {/* Profilim — collapsible */}
      <div style={{borderBottom:"1px solid var(--border)",paddingBottom:10,marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0"}}>
          <div>
            <div style={{fontSize:11,color:"var(--text2)",textTransform:"uppercase",letterSpacing:".05em"}}>Profilim</div>
            <div style={{fontSize:13,marginTop:2}}>
              <span style={{marginRight:6}}>{profile?.avatar_emoji||"👤"}</span>
              {profile?.bio
                ?<span style={{color:"var(--text2)",fontSize:12}}>{profile.bio.slice(0,40)}{profile.bio.length>40?"…":""}</span>
                :<span className="dim" style={{fontSize:12}}>Bio eklenmemiş</span>}
            </div>
          </div>
          <button className="btn-sm" onClick={()=>{
            if(!profileOpen){
              setBioVal(profile?.bio||"");
              setAvatarVal(profile?.avatar_emoji||"👤");
              setProfilePublic(profile?.is_profile_public||false);
            }
            setProfileOpen(o=>!o);
          }}>{profileOpen?"Kapat":"Düzenle"}</button>
        </div>

        {profileOpen&&(
          <div style={{background:"var(--bg3)",borderRadius:8,padding:"12px 14px",marginTop:8}}>
            <div className="kk" style={{marginBottom:6}}>Avatar</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
              {["👤","🦁","🐯","🦊","🐻","🦅","🌊","⚡","🔥","💎","🚀","🎯"].map(e=>(
                <button key={e} onClick={()=>setAvatarVal(e)}
                  style={{
                    width:36,height:36,borderRadius:8,border:`2px solid ${avatarVal===e?"var(--info)":"transparent"}`,
                    background:avatarVal===e?"rgba(102,88,255,0.15)":"var(--bg4)",
                    fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"
                  }}>{e}</button>
              ))}
            </div>

            <div className="kk" style={{marginBottom:4}}>Bio <span style={{color:"var(--text3)",fontWeight:400}}>{bioVal.length}/160</span></div>
            <textarea
              className="finp sm"
              value={bioVal}
              onChange={e=>setBioVal(e.target.value.slice(0,160))}
              placeholder="Kendini kısaca tanıt..."
              rows={3}
              maxLength={160}
              style={{resize:"none",width:"100%",marginBottom:12,boxSizing:"border-box"}}
            />

            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div>
                <div style={{fontSize:12,fontWeight:500}}>Profili herkese göster</div>
                <div style={{fontSize:11,color:"var(--text3)"}}>Diğer kullanıcılar adını ve biyografini görebilir</div>
              </div>
              <button
                className={"btn-sm"+(profilePublic?" btn-danger-out":"")}
                onClick={()=>setProfilePublic(v=>!v)}
                style={{flexShrink:0}}
              >{profilePublic?"Gizle":"Göster"}</button>
            </div>

            <div className="brow">
              <button className="pri btn-md" onClick={saveProfile} disabled={profileBusy}>
                {profileBusy?"Kaydediliyor...":"Kaydet"}
              </button>
              <button className="btn-md" onClick={()=>setProfileOpen(false)} disabled={profileBusy}>İptal</button>
            </div>
          </div>
        )}
      </div>

      {/* Kullanıcı adı satırı */}
      <div className="row" style={{borderBottom:"none",padding:"5px 0"}}>
        <div>
          <div style={{fontSize:11,color:"var(--text2)",textTransform:"uppercase",letterSpacing:".05em"}}>Kullanıcı Adı</div>
          <div className="mono" style={{fontSize:13}}>
            {profile?.username?<span>@{profile.username}</span>:<span className="dim">Henüz yok</span>}
          </div>
        </div>
        {editing!=="uname"&&<button className="btn-sm" onClick={()=>{setEditing("uname");setUname(profile?.username||"");}}>{profile?.username?"Değiştir":"Oluştur"}</button>}
      </div>
      {editing==="uname"&&(
        <div style={{background:"var(--bg3)",borderRadius:8,padding:"10px 12px",marginTop:8}}>
          <div className="kk" style={{marginBottom:4}}>Kullanıcı adı</div>
          <input className="finp sm" value={uname} onChange={e=>setUname(e.target.value.toLowerCase())} placeholder="ornek_user" maxLength={20} style={{marginBottom:4}}/>
          <div style={{fontSize:10,color:"var(--text3)",marginBottom:8}}>3-20 karakter · küçük harf, rakam, alt tire</div>
          <div className="brow">
            <button className="pri btn-md" onClick={saveUname} disabled={busy||!uname}>{busy?"Kaydediliyor...":"Kaydet"}</button>
            <button className="btn-md" onClick={cancel} disabled={busy}>İptal</button>
          </div>
        </div>
      )}
      {/* E-posta satırı */}
      <div className="row" style={{borderBottom:"none",padding:"5px 0"}}>
        <div>
          <div style={{fontSize:11,color:"var(--text2)",textTransform:"uppercase",letterSpacing:".05em"}}>E-posta</div>
          <div className="mono" style={{fontSize:13}}>{user.email}</div>
        </div>
        {editing!=="email"&&<button className="btn-sm" onClick={()=>{setEditing("email");setEmail("");}}>Değiştir</button>}
      </div>
      {editing==="email"&&(
        <div style={{background:"var(--bg3)",borderRadius:8,padding:"10px 12px",marginTop:8}}>
          <div className="kk" style={{marginBottom:4}}>Yeni e-posta</div>
          <input className="finp sm" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="yeni@ornek.com" style={{marginBottom:8}}/>
          <div className="brow">
            <button className="pri btn-md" onClick={saveEmail} disabled={busy||!email}>{busy?"Kaydediliyor...":"Onay Gönder"}</button>
            <button className="btn-md" onClick={cancel} disabled={busy}>İptal</button>
          </div>
        </div>
      )}
      {/* Şifre satırı */}
      <div className="row" style={{borderBottom:"none",padding:"5px 0"}}>
        <div>
          <div style={{fontSize:11,color:"var(--text2)",textTransform:"uppercase",letterSpacing:".05em"}}>Şifre</div>
          <div className="mono" style={{fontSize:13,color:"var(--text2)"}}>••••••••</div>
        </div>
        {editing!=="pw"&&<button className="btn-sm" onClick={()=>{setEditing("pw");setPw1("");setPw2("");}}>Değiştir</button>}
      </div>
      {editing==="pw"&&(
        <div style={{background:"var(--bg3)",borderRadius:8,padding:"10px 12px",marginTop:8}}>
          <div className="kk" style={{marginBottom:4}}>Yeni şifre</div>
          <input className="finp sm" type="password" value={pw1} onChange={e=>setPw1(e.target.value)} placeholder="En az 6 karakter" style={{marginBottom:8}}/>
          <div className="kk" style={{marginBottom:4}}>Yeni şifre (tekrar)</div>
          <input className="finp sm" type="password" value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="Tekrar yaz" style={{marginBottom:8}}/>
          <div className="brow">
            <button className="pri btn-md" onClick={savePw} disabled={busy||!pw1||!pw2}>{busy?"Kaydediliyor...":"Şifreyi Güncelle"}</button>
            <button className="btn-md" onClick={cancel} disabled={busy}>İptal</button>
          </div>
        </div>
      )}
    </div>
  );
}

