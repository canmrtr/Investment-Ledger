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

  // Hesap silme (Tehlikeli Bölge) state
  const [delOpen,setDelOpen]=useState(false);
  const [delConfirm,setDelConfirm]=useState("");
  const [delBusy,setDelBusy]=useState(false);

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

  // Hesabı kalıcı sil: delete-account edge fn → auth.users + FK CASCADE ile
  // tüm kullanıcı-scope veri silinir; ardından local key temizliği + signOut.
  // İki kapı: type-to-confirm "SİL" + confirm_ danger dialog.
  const deleteAccount=async()=>{
    // "SİL" Türkçe noktalı büyük İ (U+0130) içerir — ASCII "SIL"e indirgeme;
    // karakter farkı kazara silmeye karşı ek bariyer (label ile birebir eşleşir).
    if(delConfirm!=="SİL")return;
    if(!(await confirm_("Hesabın ve tüm verin (pozisyon, işlem, portföy, watchlist) kalıcı olarak silinecek. Bu işlem geri alınamaz.",{okLbl:"Hesabı Sil",cancelLbl:"Vazgeç",danger:true})))return;
    setDelBusy(true);
    try{
      const r=await edgeCallAuth("delete-account",{});
      if(!r.ok){
        const d=await r.json().catch(()=>({}));
        flash_(d.error||"Hesap silinemedi","err");
        setDelConfirm(""); // başarısızlıkta tekrar denemek için "SİL" yeniden yazılmalı
        setDelBusy(false);
        return;
      }
      // Başarı: local key temizliği + signOut → auth listener login ekranına döner.
      // Component unmount olacağı için setDelBusy(false) çağrılmaz.
      clearUserLocalKeys();
      await sb.auth.signOut();
    }catch(e){
      flash_("Hesap silinemedi","err");
      setDelBusy(false);
    }
  };

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
                    background:avatarVal===e?"rgba(201,168,76,0.15)":"var(--bg4)",
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
          <div style={{fontSize:12,color:"var(--text3)",marginBottom:8}}>3-20 karakter · küçük harf, rakam, alt tire</div>
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

      {/* Tehlikeli Bölge — hesap silme */}
      <div style={{marginTop:18,border:"1px solid var(--err)",borderRadius:8,background:"rgba(255,51,102,0.06)",padding:"14px 16px"}}>
        <div style={{fontSize:11,color:"var(--err)",textTransform:"uppercase",letterSpacing:".05em",fontWeight:600,marginBottom:6}}>Tehlikeli Bölge</div>
        {!delOpen?(
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <div style={{fontSize:13,color:"var(--text2)",lineHeight:1.5,flex:"1 1 200px"}}>
              Hesabını kalıcı olarak sil. Tüm pozisyon, işlem, portföy ve watchlist verin geri dönüşsüz silinir.
            </div>
            <button className="btn-danger-out btn-md" onClick={()=>setDelOpen(true)} style={{flexShrink:0}}>Hesabı Sil</button>
          </div>
        ):(
          <div>
            <div style={{fontSize:13,color:"var(--text)",marginBottom:10,lineHeight:1.5}}>
              Bu işlem <strong>geri alınamaz</strong>. Tüm verin kalıcı silinecek ve oturumun kapanacak.
            </div>
            <div className="kk" style={{marginBottom:4}}>Onaylamak için <strong style={{color:"var(--err)"}}>SİL</strong> yaz</div>
            <input className="finp sm" value={delConfirm} onChange={e=>setDelConfirm(e.target.value)} placeholder="SİL" disabled={delBusy} style={{marginBottom:10}}/>
            <div className="brow">
              <button className="btn-danger-out btn-md" onClick={deleteAccount} disabled={delConfirm!=="SİL"||delBusy}>{delBusy?"Siliniyor...":"Hesabı Kalıcı Sil"}</button>
              <button className="btn-md" onClick={()=>{setDelOpen(false);setDelConfirm("");}} disabled={delBusy}>İptal</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

