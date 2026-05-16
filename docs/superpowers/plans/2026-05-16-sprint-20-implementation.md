# Sprint 20 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sprint 20'nin 3 item'ını canlıya almak: BES "Değer Güncelle" hafif modal + Tam Detay paylaşım UI yanıltıcılığı düzeltmesi + signOut'ta `il_*` localStorage agresif temizliği.

**Architecture:** Üç bağımsız değişiklik kümesi. Item 4 (Tam Detay UI fix) → `App.js` Settings bloğu içinde sadece ~5 satır rewrite. Item 5 (LS hardening) → `utils.js`'e yeni helper + iki signOut call site refactor. Item 3 (BES modal) → yeni `BesUpdateModal.js` component, TickerDetailTab BES Özeti üstüne "Değer Güncelle" butonu, Dashboard pos-row'a `💰` ikon (desktop+mobile) `stopPropagation` ile. Modal `prc[ticker]` için `set-manual-price` edge çağrısı + `positions.dk_current` doğrudan UPDATE yapar (atomik tx gereksiz — `dk_current` rebuildPositions sonraki çağrılarda DB snapshot'tan restore edilir).

**Tech Stack:** React 18 UMD + Babel Standalone (tarayıcıda JSX, build adımı yok). Supabase JS v2. Browser-global pattern (`<script type="text/babel" src>` ile yüklenen `src/*.js` ve `src/components/*.js` dosyaları top-level `const`/`function` ile global'e atar). No bundler, no test framework — parse check = `npm run check:babel`; canlı test = `Cmd+Shift+R` GitHub Pages.

**Reference spec:** `docs/superpowers/specs/2026-05-15-sprint-20-design.md`

---

## Sıralama

3 task ardışık `main` commit. Sıra: en küçük → en büyük; en riski az → riski biraz daha yüksek.

1. **Task 1 — Item 4: Tam Detay UI Fix** (~10 satır, riski 0)
2. **Task 2 — Item 5: LS Key Hardening** (~15 satır, signOut akışı manuel test)
3. **Task 3 — Item 3: BES Update Modal — component dosyası** (yeni dosya, ~85 satır)
4. **Task 4 — Item 3: BES Update Modal — TickerDetailTab entegrasyonu**
5. **Task 5 — Item 3: BES Update Modal — Dashboard entegrasyonu (desktop + mobile)**
6. **Task 6 — Sprint 20 kapanış: ROADMAP + memory güncellemesi**

---

## Task 1: Item 4 — "Tam Detay" Paylaşım UI Fix

**Files:**
- Modify: `src/components/App.js:1200-1220` (togglePrivacyLevel function — kaldır)
- Modify: `src/components/App.js:1247-1270` (Detay Paylaşımı sub-section — toggle disable + "yakında" copy)

**Hedef:** Settings'teki "Tam Detay" toggle'ı çalıştığında görsel hiçbir değişiklik yaratmıyor (public view her zaman allocation_only render ediyor — bkz. App.js:1142-1162). Kullanıcı yanıltılıyor. Çözüm: toggle'ları disabled yap, "yakında" copy ekle, kullanılmayan `togglePrivacyLevel` fonksiyonunu sil.

- [ ] **Step 1.1: `togglePrivacyLevel` fonksiyonunu sil**

`src/components/App.js:1200-1220` arasındaki blok şu an:

```jsx
            const togglePrivacyLevel = async () => {
              const toFull = privLevel !== "full";
              if (toFull) {
                const ok = await confirm_(
                  "Maliyet ve adet bilgileri de herkesle paylaşılacak. Emin misiniz?",
                  {okLbl:"Tam Detay Paylaş", cancelLbl:"İptal", danger:true}
                );
                if (!ok) return;
              }
              try {
                const {error} = await sb.from("portfolios")
                  .update({privacy_level: toFull ? "full" : "allocation_only"})
                  .eq("id", activePortfolioId)
                  .eq("user_id", user.id);
                if (error) throw error;
                await loadData();
                flash_(toFull ? "Tam detay paylaşımı açık" : "Sadece dağılım paylaşılıyor", "ok");
              } catch(e) {
                flash_("Güncelleme başarısız", "err");
              }
            };
```

Bu 21 satırlık `togglePrivacyLevel = async () => { ... };` bloğunu **tamamen sil**. (Sadece sonraki `return (` satırı kalmalı.)

- [ ] **Step 1.2: Detay Paylaşımı sub-section copy + disable**

`src/components/App.js:1247-1270` arasındaki blok şu an:

```jsx
                {isPublic&&(
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderTop:"1px solid var(--border)"}}>
                    <div>
                      <div style={{fontSize:12,color:"var(--text2)"}}>Detay Paylaşımı</div>
                      <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>
                        {privLevel==="full" ? "Adet ve maliyet bilgileri görünür" : "Sadece ticker + yüzde dağılımı görünür"}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      <button
                        className={"btn-xs"+(privLevel!=="full"?" on":"")}
                        style={privLevel!=="full"?{background:"rgba(201,168,76,0.15)",color:"var(--info)",border:"1px solid rgba(201,168,76,0.3)"}:{}}
                        onClick={privLevel==="full"?togglePrivacyLevel:undefined}
                        disabled={privLevel!=="full"}
                      >Sadece Dağılım</button>
                      <button
                        className={"btn-xs"+(privLevel==="full"?" on":"")}
                        style={privLevel==="full"?{background:"rgba(201,168,76,0.15)",color:"var(--info)",border:"1px solid rgba(201,168,76,0.3)"}:{}}
                        onClick={privLevel!=="full"?togglePrivacyLevel:undefined}
                        disabled={privLevel==="full"}
                      >Tam Detay</button>
                    </div>
                  </div>
                )}
```

Şu blok ile değiştir:

```jsx
                {isPublic&&(
                  <div style={{padding:"8px 0",borderTop:"1px solid var(--border)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:12,color:"var(--text2)"}}>Detay Paylaşımı</div>
                        <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>
                          Sadece ticker + yüzde dağılımı görünür
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <button
                          className="btn-xs on"
                          style={{background:"rgba(201,168,76,0.15)",color:"var(--info)",border:"1px solid rgba(201,168,76,0.3)"}}
                          disabled
                        >Sadece Dağılım</button>
                        <button
                          className="btn-xs"
                          disabled
                          style={{opacity:0.5}}
                        >Tam Detay</button>
                      </div>
                    </div>
                    <div style={{fontSize:10,color:"var(--text3)",marginTop:8,lineHeight:1.5}}>
                      💡 Tam detay paylaşımı sosyal güncellemesinde aktif olacak.
                    </div>
                  </div>
                )}
```

Net değişim:
- Wrapping `<div>` dikey-blok'a dönüştü (artık iki satır içeriyor — toggle row + ipucu satırı).
- "Adet ve maliyet bilgileri görünür" metni tamamen kaldırıldı (mevcut render her zaman allocation_only).
- Her iki buton `disabled`; `onClick` handler yok.
- "Sadece Dağılım" `on` ve gold-bg stil korunur (mevcut hâlin görsel doğrulaması).
- "Tam Detay" `opacity:0.5` ile gri görünür.
- Yeni alt satır: "💡 Tam detay paylaşımı sosyal güncellemesinde aktif olacak."

- [ ] **Step 1.3: Babel parse check**

Run: `cd /Users/canmerter/Documents/Claude/Investment-Ledger && npm run check:babel`
Expected: `✓ All JSX files parsed successfully` (veya benzer no-error çıktısı).

- [ ] **Step 1.4: Manuel sanity check (localhost)**

Run terminal: `cd /Users/canmerter/Documents/Claude/Investment-Ledger && npx serve . -l 3000` (arka planda).
Tarayıcı: `http://localhost:3000` → sign-in → Hamburger → Ayarlar → Portföy bölümü → "Herkese Aç" tıkla → "Detay Paylaşımı" alt-bölüm görünmeli; her iki buton disabled; "💡 ... yakında ..." metni görünür.

- [ ] **Step 1.5: Commit**

```bash
cd /Users/canmerter/Documents/Claude/Investment-Ledger
git add src/components/App.js
git commit -m "$(cat <<'EOF'
fix(settings): Tam Detay paylaşım UI'ı gerçek render ile hizala

Settings "Tam Detay" toggle'ı privacy_level=full yazıyordu ama public view (App.js:1142-1162) her zaman allocation_only render ediyor → kullanıcı yanıltılıyordu. Toggle'ları disabled yap, "yakında" copy ekle, kullanılmayan togglePrivacyLevel fonksiyonunu sil. DB schema kalır; gerçek tam-detay paylaşımı Social Faz 2 işi.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Item 5 — LS Key User-Scope Hardening

**Files:**
- Modify: `src/utils.js` (yeni `clearUserLocalKeys` helper ekle)
- Modify: `src/components/App.js:572` (hamburger menü signOut)
- Modify: `src/components/App.js:1391` (Settings danger zone signOut)

**Hedef:** signOut handler'ları şu an sadece 5 hardcoded `il_*` keyi temizliyor; en az 6 per-user key (`il_disp_cur`, `il_nudge_dismissed`, `il_last_fetch`, vb.) silinmiyor. Yeni helper tüm `il_*` keyleri tarayıp temizler (whitelist: `il_theme` cihaz tercihi, `il_fx` paylaşımlı cache).

- [ ] **Step 2.1: `clearUserLocalKeys` helper'ını utils.js'e ekle**

`src/utils.js` dosyasının sonuna (son `const` veya `function` tanımından sonra) şunu ekle:

```js
// signOut'ta çağrılır — tüm il_* localStorage keylerini temizler ki kullanıcı
// değişiminde state sızmasın. Whitelist: il_theme cihaz tercihi, il_fx paylaşımlı
// FX cache.
const clearUserLocalKeys = () => {
  const PRESERVE = new Set(["il_theme", "il_fx"]);
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith("il_") && !PRESERVE.has(k)) {
      localStorage.removeItem(k);
    }
  });
};
```

Browser-global pattern: `const` top-level → otomatik global → `App.js`'ten doğrudan çağrılır. `export`/`import` yok.

- [ ] **Step 2.2: Hamburger menü signOut call site refactor**

`src/components/App.js:571-577` arasındaki blok şu an:

```jsx
              <button className="ham-menu-row danger" onClick={()=>{
                ["il_hide","il_prc","il_hist","il_active_portfolio","il_recent_search",`il_recent_${user?.id}`].forEach(k=>k&&localStorage.removeItem(k));
                sb.auth.signOut();
              }}>
```

Şununla değiştir:

```jsx
              <button className="ham-menu-row danger" onClick={()=>{
                clearUserLocalKeys();
                sb.auth.signOut();
              }}>
```

- [ ] **Step 2.3: Settings danger zone signOut call site refactor**

`src/components/App.js:1388-1393` arasındaki blok şu an:

```jsx
          <div style={{borderTop:"1px solid var(--border)",marginTop:8,paddingTop:20,paddingBottom:16}}>
            <button className="danger" onClick={()=>{
              // Cross-account leak'i önle: privacy mode + cache + portfolio LS key'lerini temizle.
              ["il_hide","il_prc","il_hist","il_active_portfolio","il_recent_search",`il_recent_${user?.id}`].forEach(k=>k&&localStorage.removeItem(k));
              sb.auth.signOut();
            }} style={{width:"100%"}}>Çıkış Yap</button>
          </div>
```

Şununla değiştir:

```jsx
          <div style={{borderTop:"1px solid var(--border)",marginTop:8,paddingTop:20,paddingBottom:16}}>
            <button className="danger" onClick={()=>{
              // Cross-account leak'i önle: tüm il_* keylerini temizle (il_theme/il_fx hariç).
              clearUserLocalKeys();
              sb.auth.signOut();
            }} style={{width:"100%"}}>Çıkış Yap</button>
          </div>
```

- [ ] **Step 2.4: Babel parse check**

Run: `cd /Users/canmerter/Documents/Claude/Investment-Ledger && npm run check:babel`
Expected: parse OK.

- [ ] **Step 2.5: Manuel sanity check (localhost)**

`http://localhost:3000` → sign-in → tema light yap → Display Cur TRY yap → Dashboard'ta birkaç ticker aç (`il_hist`/`il_prc` dolsun) → DevTools Application → Local Storage → `il_*` keyleri görmek olduğunu doğrula → Hamburger menü → Çıkış Yap → DevTools yeniden bak:

**Kalmalı:** `il_theme=light`, `il_fx={...}`
**Silinmeli:** `il_prc`, `il_hist`, `il_hide`, `il_disp_cur`, `il_last_fetch`, `il_nudge_dismissed`, `il_active_portfolio`, `il_recent_*`, `il_etf_cw_*`, `il_divcal_*`

Yeniden sign-in → Display Cur USD default, hide=false (yeni session taze) → tema hâlâ light (whitelist).

- [ ] **Step 2.6: Commit**

```bash
cd /Users/canmerter/Documents/Claude/Investment-Ledger
git add src/utils.js src/components/App.js
git commit -m "$(cat <<'EOF'
fix(auth): signOut'ta tüm il_* localStorage keylerini temizle

Önceden 5 hardcoded key temizleniyordu; il_disp_cur/il_nudge_dismissed/
il_last_fetch/il_etf_cw_*/il_divcal_* silinmiyordu → user A → signOut →
user B sign-in akışında state sızıntısı. Yeni clearUserLocalKeys() helper
tüm il_* taranıp temizler; whitelist: il_theme (cihaz tercihi), il_fx
(paylaşımlı cache).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Item 3 — `BesUpdateModal.js` Component Dosyası

**Files:**
- Create: `src/components/BesUpdateModal.js`
- Modify: `index.html:303` civarı (script tag listesine ekle, TickerDetailTab'dan SONRA — `BesUpdateModal` TickerDetailTab içinden çağrılmıyor ama global tanım sırası önemli değil; standart pattern ile App.js'ten önce eklenir)

**Hedef:** Sadece 2 alanlı (Kişisel Güncel + DK Güncel) hafif modal component. Self-contained: kendi state'i, save handler'ı, render'ı. Henüz bir yerde kullanılmıyor — sonraki task'larda wire edilecek.

- [ ] **Step 3.1: BesUpdateModal.js dosyasını oluştur**

Path: `src/components/BesUpdateModal.js`

İçerik:

```jsx
// BES pozisyonu aylık güncelleme modalı.
// Kullanım: <BesUpdateModal pos={p} prc={prc} user={user} onClose={...} onSaved={...}/>
// pos = {ticker, name, avgCost, dkCurrent, dkPrincipal, portfolioId (opsiyonel)}
// İki alan: Kişisel Güncel + DK Güncel. Anaparalar read-only badge.
// Kaydet: set-manual-price (prc total) + positions.dk_current UPDATE → onSaved().
function BesUpdateModal({pos, prc, user, portfolioId, onClose, onSaved}){
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
```

Önemli notlar:
- `React.useState` kullan (React UMD global). Hook'lar destructure edilmeden çalışır.
- `edgePriceCall`, `flash_`, `sb`, `fmt` zaten global (utils.js + App.js'ten önce yüklenir).
- `mdl-bd`/`mdl-bx` CSS sınıfları index.html'de var (modal pattern, mevcut ConfirmBox kullanıyor).
- `kk`/`stitle`/`finp` ortak class.

- [ ] **Step 3.2: index.html script tag listesine ekle**

`index.html:303` (TickerDetailTab) ile `index.html:312` (App.js) arasında, **TickerDetailTab'dan SONRA, App.js'den ÖNCE**, şu satırı ekle:

Doğru konum — TickerDetailTab'dan hemen sonra:

```html
<script type="text/babel" src="src/components/TickerDetailTab.js"></script>
<script type="text/babel" src="src/components/BesUpdateModal.js"></script>
<script type="text/babel" src="src/components/AccountSection.js"></script>
```

(Alfabetik sırada değil — script tag sırası kritik değil ama component'in App.js'ten önce yüklenmesi şart.)

- [ ] **Step 3.3: Babel parse check**

Run: `cd /Users/canmerter/Documents/Claude/Investment-Ledger && npm run check:babel`
Expected: `BesUpdateModal.js` dahil tüm dosyalar parse OK.

- [ ] **Step 3.4: Commit (component standalone)**

```bash
cd /Users/canmerter/Documents/Claude/Investment-Ledger
git add src/components/BesUpdateModal.js index.html
git commit -m "$(cat <<'EOF'
feat(bes): BesUpdateModal component — aylık güncelleme için 2 alanlı modal

Kişisel Güncel + DK Güncel input; anaparalar read-only. Kaydet:
set-manual-price (total) + positions.dk_current UPDATE. Henüz hiçbir
yerde kullanılmıyor — bir sonraki commit'te TickerDetailTab BES Özeti
üstüne wire edilecek.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Item 3 — TickerDetailTab BES Özeti Entegrasyonu

**Files:**
- Modify: `src/components/TickerDetailTab.js` (BES Özeti kartının üstüne "Değer Güncelle" butonu + modal state + render)

**Hedef:** TickerDetailTab'da BES pozisyonu açıldığında, BES Özeti kartının ÜSTÜNE prominent "💰 Değer Güncelle" butonu. Click → modal aç → save → loadData prop'unu çağır (modal'ı parent'tan al; refresh'i parent'a delegate et).

- [ ] **Step 4.1: TickerDetailTab'da prc/user/portfolioId/loadData prop'larının mevcut olduğunu doğrula**

Run: `cd /Users/canmerter/Documents/Claude/Investment-Ledger && grep -nE "function TickerDetailTab|TickerDetailTab\s*\(\{" src/components/TickerDetailTab.js | head -3`

Sonuç hem fonksiyon imzasını hem App.js'teki çağrıyı gösterir. Eksik prop varsa eklenmeli. Beklenen: `prc`, `user`, `loadData` mevcut.

- [ ] **Step 4.2: BES Özeti kartının üstüne buton + modal state ekle**

`src/components/TickerDetailTab.js:599` civarındaki blok şu an:

```jsx
        {isBes&&(
          <div className="card" style={{marginBottom:8,padding:"14px 16px"}}>
            <div className="stitle" style={{marginBottom:10}}>BES Özeti</div>
```

Bu bloğun **üstüne** (yani `{isBes&&(` satırından önce) şu butonu ve state'i ekle. Önce fonksiyonun başında state tanımı:

`TickerDetailTab` fonksiyonunun içinde, mevcut `useState` tanımlarının arasına (örn. `isBes` tanımının hemen altında):

```jsx
  const [besModalOpen,setBesModalOpen]=React.useState(false);
```

Sonra `{isBes&&(` bloğundan ÖNCE şu butonu ekle:

```jsx
        {isBes&&p&&(
          <button
            className="btn-sm pri"
            onClick={()=>setBesModalOpen(true)}
            style={{width:"100%",marginBottom:8,padding:"10px 16px",fontSize:13,fontWeight:600}}
          >💰 Değer Güncelle</button>
        )}
```

BES Özeti kartının render'ından sonra (`)}` kapanışından sonra), modal'ı render et:

```jsx
        {isBes&&p&&besModalOpen&&(
          <BesUpdateModal
            pos={p}
            prc={prc}
            user={user}
            portfolioId={p.portfolioId||activePortfolioId}
            onClose={()=>setBesModalOpen(false)}
            onSaved={()=>loadData&&loadData()}
          />
        )}
```

**Önemli:** TickerDetailTab BES Özeti kartının render içinde `p` objesi `{ticker, name, avgCost, dkCurrent, dkPrincipal, ...}` formatında — bunlar zaten BesUpdateModal'ın beklediği alanlar.

- [ ] **Step 4.3: `portfolioId` prop'unun TickerDetailTab fonksiyon imzasında destructure edildiğini doğrula**

`portfolioId={activePortfolioId}` zaten `App.js:1104`'te geçiriliyor (kontrol edildi). TickerDetailTab fonksiyon imzasında destructure edilmiş olduğunu doğrula:

Run: `grep -nE "function TickerDetailTab\s*\(\{" /Users/canmerter/Documents/Claude/Investment-Ledger/src/components/TickerDetailTab.js`

İmzada `portfolioId` yoksa, ekle. Örnek: `function TickerDetailTab({ticker, assetTypeHint, pos, txs, prc, hist, user, confirm_, flash_, loadData, closeDetail, hideAmts, mask, portfolioId, inWatchlist, onToggleWatchlist}){`

- [ ] **Step 4.4: Babel parse check**

Run: `cd /Users/canmerter/Documents/Claude/Investment-Ledger && npm run check:babel`
Expected: parse OK.

- [ ] **Step 4.5: Manuel test (localhost)**

`http://localhost:3000` → sign-in → BES pozisyonu olan ticker'a tıkla (Dashboard'da BES bloğu → satıra tıkla → detay açılır).

BES Özeti kartının üstünde "💰 Değer Güncelle" butonu görmeli. Tıkla → modal açılır → Kişisel Güncel = (mevcut total − dkCurrent), DK Güncel = mevcut dk_current default. Değer değiştir → Kaydet → flash "✓" → modal kapanır → BES Özeti yeni değerlerle güncellenir.

Hata senaryosu: ağ kes (DevTools → Network → Offline) → Kaydet → flash "Fiyat güncelleme başarısız" → modal açık kalır.

- [ ] **Step 4.6: Commit**

```bash
cd /Users/canmerter/Documents/Claude/Investment-Ledger
git add src/components/TickerDetailTab.js src/components/App.js
git commit -m "$(cat <<'EOF'
feat(bes): TickerDetailTab'a "Değer Güncelle" butonu wire et

BES pozisyonu için BES Özeti kartının üstüne prominent buton.
BesUpdateModal'i tetikler; onSaved → loadData ile state refresh.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Item 3 — Dashboard pos-row Entegrasyonu (Desktop + Mobile)

**Files:**
- Modify: `src/components/App.js:970-977` (desktop tablo BES pos-row → `💰` inline buton)
- Modify: `src/components/App.js:1006-1020` (mobile pcr → BES için `💰` inline buton)
- Modify: `src/components/App.js` (App-level besModal state + render)

**Hedef:** Dashboard BES bloğunda her BES satırının ticker hücresinde küçük `💰` butonu (desktop+mobile). `stopPropagation` ile row click (detay açma) önlenir. Modal App-level render edilir.

- [ ] **Step 5.1: App.js'te BES modal state'i ekle**

`src/components/App.js`'te diğer modal state tanımlarının yanına (örn. line ~30-100 bölgesinde diğer `useState` tanımlarının yakınına):

```jsx
  const [besModalPos,setBesModalPos]=useState(null);
```

(Bu state, modal açık olduğunda BES pozisyonu objesini tutar; null → kapalı.)

- [ ] **Step 5.2: Desktop tablo BES pos-row'a `💰` butonu ekle**

`src/components/App.js:970-977` arasındaki blok şu an:

```jsx
                          <tr key={p.ticker} className="pos-row" onClick={()=>openDetail(p.ticker)}>
                            <td className="l"><div className="tcell"><span className="tsym">{p.ticker}</span><span className="tname">{p.name}</span>{isPriceStale(prcUpdatedAt[p.ticker])&&<span className="badge stale" data-tip={"Fiyat "+fmtAge(new Date(prcUpdatedAt[p.ticker]).getTime())+" güncellendi"}>Fiyat eski</span>}{isDeposit&&p.maturityDate&&(()=>{const ms=new Date(p.maturityDate)-Date.now();const past=ms<0,soon=ms<30*86400000;const bg=past?"rgba(255,51,102,0.15)":soon?"rgba(255,184,0,0.15)":"rgba(0,217,126,0.08)";const col=past?"var(--err)":soon?"var(--warn)":"var(--ok)";return <span style={{fontSize:9,padding:"1px 5px",borderRadius:8,marginLeft:4,background:bg,color:col,whiteSpace:"nowrap"}}>Vade {fmtDateTR(p.maturityDate)}</span>;})()}</div></td>
```

Önce satırın üst kısmında `isBes` tanımını yap. `isDeposit`/`isCash` tanımları zaten 961-962'de var; satıra ekle:

```jsx
                          const isBes=p.type==="BES";
```

(Mevcut `const isDeposit=p.type==="DEPOSIT";` satırının altına.)

Sonra `<td className="l">...` bloğunda `</div></td>` ile bitişten önce, `}{isDeposit&&p.maturityDate&&...` blok zincirinin sonuna, yeni BES butonu ekle. Düzenlenmiş tam blok:

```jsx
                            <td className="l"><div className="tcell"><span className="tsym">{p.ticker}</span><span className="tname">{p.name}</span>{isPriceStale(prcUpdatedAt[p.ticker])&&<span className="badge stale" data-tip={"Fiyat "+fmtAge(new Date(prcUpdatedAt[p.ticker]).getTime())+" güncellendi"}>Fiyat eski</span>}{isDeposit&&p.maturityDate&&(()=>{const ms=new Date(p.maturityDate)-Date.now();const past=ms<0,soon=ms<30*86400000;const bg=past?"rgba(255,51,102,0.15)":soon?"rgba(255,184,0,0.15)":"rgba(0,217,126,0.08)";const col=past?"var(--err)":soon?"var(--warn)":"var(--ok)";return <span style={{fontSize:9,padding:"1px 5px",borderRadius:8,marginLeft:4,background:bg,color:col,whiteSpace:"nowrap"}}>Vade {fmtDateTR(p.maturityDate)}</span>;})()}{isBes&&<button className="btn-xs" onClick={(e)=>{e.stopPropagation();setBesModalPos(p);}} data-tip="Aylık güncelle" style={{marginLeft:6,padding:"2px 6px",fontSize:11}}>💰</button>}</div></td>
```

(Yani `</div></td>` öncesine `{isBes&&<button...>💰</button>}` eklendi.)

- [ ] **Step 5.3: Mobile pcr BES'e `💰` butonu ekle**

`src/components/App.js:1006-1011` arasındaki blok şu an:

```jsx
                        <div key={p.ticker} className="pcr" onClick={()=>openDetail(p.ticker)}>
                          <div className="pcr-left">
                            <span className="pcr-ticker">{p.ticker}{isPriceStale(prcUpdatedAt[p.ticker])&&<span className="badge stale" data-tip={"Fiyat "+fmtAge(new Date(prcUpdatedAt[p.ticker]).getTime())+" güncellendi"}>Fiyat eski</span>}</span>
                            <span className="pcr-sub">{hide?"•••• | ••••":`${adetStr} | ${priceStr}`}</span>
                            {p.type==="DEPOSIT"&&grossIntM>0&&!hide&&<span style={{fontSize:10,color:"var(--ok)"}}>Net +{mSym}{fmt(netIntM,0)} faiz</span>}
                          </div>
```

`pcr-ticker` span'i içine BES butonunu ekle (ticker'dan sonra):

```jsx
                            <span className="pcr-ticker">{p.ticker}{isPriceStale(prcUpdatedAt[p.ticker])&&<span className="badge stale" data-tip={"Fiyat "+fmtAge(new Date(prcUpdatedAt[p.ticker]).getTime())+" güncellendi"}>Fiyat eski</span>}{p.type==="BES"&&<button className="btn-xs" onClick={(e)=>{e.stopPropagation();setBesModalPos(p);}} data-tip="Aylık güncelle" style={{marginLeft:6,padding:"2px 6px",fontSize:11}}>💰</button>}</span>
```

(Yani `</span>` öncesine `{p.type==="BES"&&<button...>💰</button>}` eklendi.)

- [ ] **Step 5.4: App-level BesUpdateModal render**

Konum: `src/components/App.js:1404` civarı — `</main>` close tag'ından **önce**, son `{tab==="..."&&...}` blok'undan sonra. Yani `)}` ile `</main>` arasına eklenir.

`App.js:1403-1406` mevcut blok:

```jsx
            <div style={{fontSize:13,color:"var(--text3)",maxWidth:280,lineHeight:1.6}}>Yatırım temelleri, portföy yönetimi ve kişisel finans rehberi burada olacak.</div>
          </div>
      )}
      </main>
```

Şununla değiştir:

```jsx
            <div style={{fontSize:13,color:"var(--text3)",maxWidth:280,lineHeight:1.6}}>Yatırım temelleri, portföy yönetimi ve kişisel finans rehberi burada olacak.</div>
          </div>
      )}
      {besModalPos && (
        <BesUpdateModal
          pos={besModalPos}
          prc={prc}
          user={user}
          portfolioId={activePortfolioId}
          onClose={()=>setBesModalPos(null)}
          onSaved={()=>loadData()}
        />
      )}
      </main>
```

- [ ] **Step 5.5: Babel parse check**

Run: `cd /Users/canmerter/Documents/Claude/Investment-Ledger && npm run check:babel`
Expected: parse OK.

- [ ] **Step 5.6: Manuel test (localhost)**

`http://localhost:3000` → sign-in → Dashboard → BES bloğunu genişlet (kapalıysa) →

**Desktop:** BES satırında ticker'ın yanında `💰` butonu görmeli. Tıkla → row click DETAIL'a açmamalı (stopPropagation çalıştı) → modal açılır → değer güncelle → Kaydet → flash + modal kapanır + Dashboard yeni değerle güncellenir.

**Mobile** (Chrome DevTools → Toggle Device Toolbar → iPhone): BES pcr'da ticker yanında `💰` görmeli, aynı akış.

- [ ] **Step 5.7: Commit**

```bash
cd /Users/canmerter/Documents/Claude/Investment-Ledger
git add src/components/App.js
git commit -m "$(cat <<'EOF'
feat(bes): Dashboard pos-row'a aylık güncelleme butonu

BES satırlarında (desktop tablo + mobile pcr) ticker'ın yanına 💰
butonu; stopPropagation ile row click (detay açma) önlenir. Modal
App-level render edilir → onSaved → loadData ile state refresh.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Sprint 20 Kapanış

**Files:**
- Modify: `ROADMAP.md` (Sonraki Adım bölümü → Sprint 20 ✅, Sprint 21 başlamaya hazır)
- Modify: `/Users/canmerter/.claude/projects/-Users-canmerter-Documents-Claude-Investment-Ledger/memory/project_sprint_state.md` (memory güncelle)

**Hedef:** Sprint 20 kapandığını belge ve memory'ye yaz; Item 6 (52W bar) Sprint 21'e taşı.

- [ ] **Step 6.1: ROADMAP.md güncelle — Sprint 20 kapanışı**

`ROADMAP.md` "Sonraki Adım" bölümünü güncelle:

- "Sprint 4–19 ✅" → "Sprint 4–20 ✅"
- "Sprint 19 ✅ kapandı (2026-05-15)" bloğunu kaldır
- Yeni blok ekle:

```markdown
**Sprint 20 ✅ kapandı (2026-05-16):**
- ✅ Item 3 — BES "Değer Güncelle" butonu: BesUpdateModal component + TickerDetailTab BES Özeti üstü + Dashboard BES pos-row 💰 ikon (desktop+mobile).
- ✅ Item 4 — Tam Detay paylaşım UI fix: Settings toggle disable + "yakında" copy; togglePrivacyLevel fonksiyonu kaldırıldı.
- ✅ Item 5 — LS key user-scope hardening: clearUserLocalKeys() helper (il_theme + il_fx whitelist); 2 signOut call site refactor.
- ⏭️ Item 6 (52W giriş kalitesi bar) Sprint 21'e ertelendi — price_cache migration ve fetch-prices değişikliği gerektirdiği için Sprint 20 kapsamı dışında kalır.

**Sprint 21 adayları:** Piyasa Dayanıklılık Skoru, TEFAS WAF testi, 52W giriş kalitesi bar.
```

- [ ] **Step 6.2: Memory güncelle**

`/Users/canmerter/.claude/projects/-Users-canmerter-Documents-Claude-Investment-Ledger/memory/project_sprint_state.md` dosyasındaki:

- "Sprints 1-19 tamamlandı. Sprint 20 başlamaya hazır." → "Sprints 1-20 tamamlandı. Sprint 21 başlamaya hazır."
- "Sprint 19 ✅ kapandı 2026-05-15" bölümünü Sprint 20 versiyonuyla değiştir:

```markdown
**Sprint 20 ✅ kapandı 2026-05-16** (Sprint 19'dan 1 gün sonra; tek günde 3 item).

**Sprint 20 final durumu:**
1. ✅ Item 3 — BES "Değer Güncelle" butonu (modal + 2 entry point).
2. ✅ Item 4 — Tam Detay paylaşım UI fix (toggle disable + copy).
3. ✅ Item 5 — LS key user-scope hardening (signOut tüm il_* temizler).

**Sprint 21 adayları (öncelik sırası, 2026-05-16 grooming):**
1. Piyasa Dayanıklılık Skoru `[M][P2]`
2. TEFAS WAF testi `[S][P1]`
3. 52W giriş kalitesi bar `[S→M][P2]` (Sprint 20'den taşındı; price_cache migration gerekli)
4. "Tam Detay" gerçek tam-detay render (Social Faz 2 ile birlikte)
```

- [ ] **Step 6.3: E2E smoke test (opsiyonel ama önerilir)**

Run: `cd /Users/canmerter/Documents/Claude/Investment-Ledger && IL_EMAIL=canmerter@me.com IL_PASS=123456 node e2e/smoke.mjs`
Expected: pass (signOut + sign-in akışı, hardening regression testi).

Eğer smoke.mjs signOut akışını test etmiyorsa, sadece sign-in akışının pass olmasına bak.

- [ ] **Step 6.4: Final commit + push**

```bash
cd /Users/canmerter/Documents/Claude/Investment-Ledger
git add ROADMAP.md
git commit -m "$(cat <<'EOF'
docs: Sprint 20 kapanışı — 3 item canlıda, Item 6 (52W bar) Sprint 21'e

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"

git push origin main
```

GitHub Pages otomatik deploy. ~1-2 dakika sonra `Cmd+Shift+R` ile canlıda doğrula.

---

## Risk Notları

- **Babel parse check zorunlu her commit öncesi.** Tek dosya tipik typo → tüm uygulama broken (CDN sürümünde build adımı yok).
- **`stopPropagation` BES butonlarında kritik.** Unutursa, BES satırına tıkladığında modal açılır VE detay sayfasına yönlenilir aynı anda.
- **`positions.dk_current` RLS-korumalı.** Modal save sırasında Supabase session aktif olmalı (zaten authenticated app içinde; problem değil).
- **Manuel test BES pozisyonu gerektirir.** Test hesabı `canmerter@me.com`'da BES pozisyonu yoksa önce manuel `ManuelPosForm` ile bir BES pozisyon ekle (X=1000, X_g=50, Y=200, Y_g=10 gibi test değerleri).
- **GitHub Pages cache.** Push sonrası `Cmd+Shift+R` hard reload yapmadan eski JS yüklenebilir; user'a hatırlat.

## Açık Sorular

Yok — tüm tasarım kararları onaylandı (Brainstorming spec: `2026-05-15-sprint-20-design.md`).
