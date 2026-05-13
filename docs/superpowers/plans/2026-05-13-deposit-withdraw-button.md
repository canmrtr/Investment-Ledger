# DEPOSIT Çekim Butonu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DEPOSIT pozisyonlarının TickerDetailTab'ındaki "Mevduat Özeti" kartına "Çek" butonu ve minimal inline form (tarih + tutar) ekle; submit → SELL transaction kaydı.

**Architecture:** Tek dosya değişikliği — `TickerDetailTab.js`. `showCek` boolean state ile form görünürlüğü; `cekForm` state ile tarih/tutar; `saveCek` async fonksiyonu tx insert + rebuildPositions + loadData. Mevduat Özeti IIFE'sinin dışına, kart içine eklenir.

**Tech Stack:** React 18 UMD + Babel Standalone (global scope). `npx serve .` → http://localhost:3000. `npm run check:babel` JSX doğrulama.

---

### Task 1: Çekim state, fonksiyon ve UI

**Files:**
- Modify: `src/components/TickerDetailTab.js`

- [ ] **Step 1: State değişkenlerini ekle**

  `TickerDetailTab.js` içinde şu satırı bul:
  ```js
  const [savingTx,setSavingTx]=useState(false);
  ```

  Hemen ALTINA ekle:
  ```js
  const [showCek,setShowCek]=useState(false);
  const [cekForm,setCekForm]=useState({date:today(),amount:""});
  const [savingCek,setSavingCek]=useState(false);
  ```

- [ ] **Step 2: `saveCek` fonksiyonunu ekle**

  `const delTxRow=async(t)=>{...};` bloğunun kapanış `};` satırından SONRA ekle:

  ```js
  const saveCek=async()=>{
    const amt=+cekForm.amount;
    if(!amt||amt<=0){flash_("Geçersiz tutar","err");return;}
    if(amt>p.shares){flash_(`Çekim tutarı anapara (${sym}${fmt(p.shares,0)}) aşamaz`,"err");return;}
    setSavingCek(true);
    const{error}=await sb.from("transactions").insert({
      user_id:user.id,date:cekForm.date,ticker:p.ticker,
      name:p.name,asset_type:"DEPOSIT",way:"SELL",
      shares:amt,price:1.0,currency:p.currency,total:amt,
      broker:p.broker||"",commission:0,exchange:"",notes:"",
      portfolio_id:portfolioId
    });
    setSavingCek(false);
    if(error){flash_(error.message,"err");return;}
    await rebuildPositions(user.id,portfolioId);await loadData();
    flash_("Çekim eklendi ✓");
    setShowCek(false);setCekForm({date:today(),amount:""});
  };
  ```

- [ ] **Step 3: Mevduat Özeti kartında Çek butonu ve form ekle**

  `TickerDetailTab.js` içinde Mevduat Özeti IIFE'sinin kapanışını bul. Şu pattern'ı ara:
  ```js
          return(
            <div className="kv">
              {rows.map(([k,v])=><div key={k}><div className="kk">{k}</div><div className="kv_">{v}</div></div>)}
            </div>
          );
        })()}
    </div>
  )}
  ```

  Bu kapanış `})()}` ile `</div>` arasına (yani IIFE'den sonra, kart kapanmadan önce) şunu ekle:

  ```js
        <div style={{marginTop:12,borderTop:"0.5px solid var(--border)",paddingTop:12}}>
          {!showCek?(
            <button className="btn-sm" onClick={()=>setShowCek(true)}>Çek</button>
          ):(
            <div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
              <div>
                <div className="kk" style={{marginBottom:3}}>Tarih</div>
                <input className="finp sm" type="date" value={cekForm.date} onChange={e=>setCekForm(f=>({...f,date:e.target.value}))} max={today()}/>
              </div>
              <div>
                <div className="kk" style={{marginBottom:3}}>Tutar ({sym})</div>
                <input className="finp sm" type="number" step="any" min="0" placeholder="0" value={cekForm.amount} onChange={e=>setCekForm(f=>({...f,amount:e.target.value}))} style={{width:120}}/>
              </div>
              <button className="btn-md pri" onClick={saveCek} disabled={savingCek}>{savingCek?"...":"Çek"}</button>
              <button className="btn-md" onClick={()=>{setShowCek(false);setCekForm({date:today(),amount:""});}}>İptal</button>
            </div>
          )}
        </div>
  ```

- [ ] **Step 4: Babel check**

  ```bash
  npm run check:babel
  ```

  Beklenen: `13 OK, 0 hata`. Hata varsa IIFE kapanış parantezlerini kontrol et — `})()}` sonrası yeni `<div>` doğru indent'te başlamalı.

- [ ] **Step 5: Tarayıcıda doğrula**

  `npx serve .` → http://localhost:3000. DEPOSIT pozisyonuna tıkla → TickerDetailTab → Mevduat Özeti kartının altında "Çek" butonu görünmeli.

  Senaryo A — geçerli çekim:
  - Çek butonuna tıkla → tarih + tutar formu açılır
  - Tutar gir (anaparadan az), tarihi bırak → "Çek" buton → "Çekim eklendi ✓" flash → form kapanır → Anapara güncellendi

  Senaryo B — aşım:
  - Anaparadan büyük tutar gir → "Çekim tutarı anapara (₺X) aşamaz" flash → tx eklenmedi

  Senaryo C — iptal:
  - Çek → form açılır → İptal → form kapanır, state sıfırlandı

  Senaryo D — regresyon:
  - US_STOCK pozisyonuna tıkla → Çek butonu YOK (`isDeposit` guard'ı)

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/TickerDetailTab.js
  git commit -m "feat(deposit): add withdraw button with inline form to Mevduat Özeti card

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

- [ ] **Step 7: Push**

  ```bash
  git push
  ```
