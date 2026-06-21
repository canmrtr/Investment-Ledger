// ── FeedbackSection — Ayarlar içinde Geri Bildirim / Destek (Sprint 28 #2) ──
// In-app Support & Feature Request. `feedback` tablosuna RLS-korumalı insert
// (user_id = auth.uid()). UPDATE/DELETE yok — kullanıcı gönderince immutable.
function FeedbackSection({user,flash_}){
  const [type,setType]=useState("bug"); // "bug" | "feature"
  const [msg,setMsg]=useState("");
  const [busy,setBusy]=useState(false);

  const submit=async()=>{
    const text=msg.trim();
    if(text.length<3){flash_("Lütfen biraz daha açıklayıcı yaz (en az 3 karakter)","err");return;}
    if(text.length>2000){flash_("Mesaj 2000 karakteri geçemez","err");return;}
    setBusy(true);
    // user_id default auth.uid() ama açıkça gönder (WITH CHECK zaten doğrular).
    const{error}=await sb.from("feedback").insert({user_id:user.id,type,message:text});
    setBusy(false);
    if(error){flash_("Gönderilemedi, tekrar dene","err");return;}
    flash_("Teşekkürler! Geri bildirimin alındı ✓");
    setMsg("");
  };

  return(
    <div className="sg">
      <label>Geri Bildirim / Destek</label>
      <div className="hint" style={{marginBottom:10}}>Bir hata mı buldun, bir fikrin mi var? Bize yaz — her mesaj okunuyor.</div>
      <div className="seg" style={{marginBottom:10}}>
        <button type="button" className={"mtab"+(type==="bug"?" on":"")} onClick={()=>setType("bug")}>🐞 Hata</button>
        <button type="button" className={"mtab"+(type==="feature"?" on":"")} onClick={()=>setType("feature")}>💡 Öneri</button>
      </div>
      <textarea className="finp" value={msg} onChange={e=>setMsg(e.target.value)} maxLength={2000}
        placeholder={type==="bug"?"Ne oldu? Hangi ekranda, ne yapınca karşına çıktı?":"Hangi özelliği istersin? Sana nasıl fayda sağlardı?"}
        rows={4} style={{resize:"vertical",marginBottom:6,width:"100%"}}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
        <span className="hint" style={{margin:0}}>{msg.length}/2000</span>
        <button className="pri" disabled={busy} onClick={submit}>{busy?"Gönderiliyor…":"Gönder"}</button>
      </div>
    </div>
  );
}
