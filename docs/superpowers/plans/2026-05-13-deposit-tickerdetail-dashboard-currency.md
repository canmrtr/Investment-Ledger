# Sprint 18 Item 2 & 3 — DEPOSIT TickerDetailTab + Dashboard Sembol Düzeltmesi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DEPOSIT pozisyonlarında TickerDetailTab'da mevduat-spesifik kart göster ve işlem geçmişi label'larını düzelt; Dashboard blok başlığında TRY mevduat için `₺` sembolü kullan.

**Architecture:** İki bağımsız UI değişikliği. (1) TickerDetailTab.js'e `isDeposit` dalı eklenir: generik metrikler (`Adet/Maliyet/P&L`, Şirket Bilgisi, Fundamental, Analist) gizlenir, mevduat-özgü kart gösterilir. (2) App.js Dashboard blok render'ında DEPOSIT/CASH için `totMv` native currency'de hesaplanır ve blok başlığında `nativeSym` kullanılır. `computeDepositGrossInterest` ve `DEPOSIT_TAX_RATE` App.js global scope'ta tanımlı — Babel standalone + `<script src>` mimarisinde tüm scriptler global paylaşır, TickerDetailTab doğrudan çağırabilir.

**Tech Stack:** React 18 UMD + Babel Standalone (browser JSX). Build adımı yok. `npx serve .` → http://localhost:3000. `npm run check:babel` JSX parse doğrulama.

---

### Task 1: Dashboard Blok Header Sembol Düzeltmesi (App.js)

**Files:**
- Modify: `src/components/App.js` (~line 840–866)

- [ ] **Step 1: `isNativeBlock`, `allSameCur`, `nativeSym` ekle**

  `src/components/App.js` içinde `const sortedItems = sortPos(items, sort);` satırını bul. Hemen ALTINA şu üç satırı ekle:

  ```js
  const isNativeBlock=cfg.type==="CASH"||cfg.type==="DEPOSIT";
  const allSameCur=isNativeBlock&&items.length>0&&items.every(p=>p.currency===items[0].currency);
  const nativeSym=allSameCur?displaySym(items[0].currency||"TRY"):dSym;
  ```

- [ ] **Step 2: `totMv` hesabını güncelle**

  Mevcut kod:
  ```js
  const totMv = cfg.mixed
    ? items.reduce((a,p)=>a+(cnv(p.mv??p.cost,p.currency||"TRY")??0),0)
    : items.reduce((a,p)=>a+(p.mv ?? p.cost),0);
  ```

  Yeni kod:
  ```js
  const totMv = cfg.mixed
    ? (allSameCur
        ? items.reduce((a,p)=>a+(p.mv??p.cost),0)
        : items.reduce((a,p)=>a+(cnv(p.mv??p.cost,p.currency||"TRY")??0),0))
    : items.reduce((a,p)=>a+(p.mv ?? p.cost),0);
  ```

- [ ] **Step 3: Blok başlığı sembolünü güncelle**

  Blok başlığında şu span'ı bul:
  ```js
  {!hide&&<span style={{fontSize:15,fontWeight:500,fontFamily:"var(--font-numeric)",color:"var(--text)"}}>{mask((cfg.mixed?dSym:cfg.sym)+fmt(totMv,0))}</span>}
  ```

  `cfg.mixed?dSym` → `cfg.mixed?nativeSym` olarak değiştir:
  ```js
  {!hide&&<span style={{fontSize:15,fontWeight:500,fontFamily:"var(--font-numeric)",color:"var(--text)"}}>{mask((cfg.mixed?nativeSym:cfg.sym)+fmt(totMv,0))}</span>}
  ```

- [ ] **Step 4: Babel check**

  ```bash
  npm run check:babel
  ```

  Beklenen: parse hatası yok.

- [ ] **Step 5: Tarayıcıda doğrula**

  `npx serve .` → http://localhost:3000. Hard-reload. Display currency `$` seç. Dashboard → "Vadeli Mevduat" blok başlığı → `₺1,364,700` (veya yerel tutar) göstermeli; `$XX,XXX` değil. Display `₺`'ya geçince de aynı `₺` sembolü ve aynı tutar. US_STOCK/BIST/GOLD blokları etkilenmemiş.

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/App.js
  git commit -m "fix(dashboard): show native currency symbol in DEPOSIT/CASH block header

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

---

### Task 2: DEPOSIT TickerDetailTab — Özel Mevduat Kartı (2a + 2b)

**Files:**
- Modify: `src/components/TickerDetailTab.js`

- [ ] **Step 1: `isDeposit` ve hesap değişkenlerini tanımla**

  `src/components/TickerDetailTab.js` içinde `const effectiveType = p?.type || assetTypeHint || "US_STOCK";` satırını bul. ALTINA şunları ekle:

  ```js
  const isDeposit=p?.type==="DEPOSIT";
  const depositGross=isDeposit&&p.interestRate!=null?computeDepositGrossInterest(tickerTxs,p.interestRate*(1-(p.reserveRatio||0)),p.maturityDate||null):0;
  const depositNet=depositGross*(1-DEPOSIT_TAX_RATE);
  const _depNow=Date.now();
  const _depMatMs=isDeposit&&p.maturityDate?new Date(p.maturityDate).getTime():null;
  const depositDaysLeft=_depMatMs!=null?Math.round((_depMatMs-_depNow)/86400000):null;
  const _depBuyMs=(()=>{if(!isDeposit)return null;const ds=tickerTxs.filter(t=>t.way==="BUY").map(t=>new Date(t.date).getTime());return ds.length>0?Math.min(...ds):_depNow;})();
  const depositElapsed=_depBuyMs!=null?Math.max(1,Math.round((_depNow-_depBuyMs)/86400000)):1;
  ```

- [ ] **Step 2: Mevduat kartı ile 4-kart grid arasında koşullu render ekle**

  TickerDetailTab.js'te `{p&&(` ile başlayan pozisyon özeti bölümünü bul. İçindeki `<div className="g4" style={{marginBottom:8}}>` (dört kart içeren div) satırını bul.

  Bu `<div className="g4"...>` satırını şöyle değiştir:
  ```js
  {isDeposit&&(
    <div className="card" style={{marginBottom:8,padding:"14px 16px"}}>
      <div className="stitle" style={{marginBottom:10}}>Mevduat Özeti</div>
      {(()=>{
        const rows=[
          ["Anapara",mask(sym+fmt(p.shares,0))],
          ["Yıllık Faiz Oranı",((p.interestRate||0)*100).toFixed(2)+"%"],
          ["Vade Tarihi",p.maturityDate?(()=>{
            const past=depositDaysLeft!=null&&depositDaysLeft<0;
            const soon=depositDaysLeft!=null&&depositDaysLeft<=30&&!past;
            const col=past?"var(--err)":soon?"var(--warn)":"var(--ok)";
            const bg=past?"rgba(255,51,102,0.15)":soon?"rgba(255,184,0,0.15)":"rgba(0,217,126,0.08)";
            return<span>{fmtDateTR(p.maturityDate)}<span style={{marginLeft:6,fontSize:10,padding:"1px 6px",borderRadius:8,background:bg,color:col}}>{past?"Vadesi geçti":depositDaysLeft===0?"Bugün":"+"+depositDaysLeft+" gün"}</span></span>;
          })():<span style={{fontSize:11,padding:"2px 8px",borderRadius:8,background:"rgba(201,168,76,0.12)",color:"var(--info)"}}>Esnek Hesap</span>],
          ["Brüt Faiz",mask(sym+fmt(depositGross,0))],
          ["Stopaj (%17.5)",mask("−"+sym+fmt(depositGross*DEPOSIT_TAX_RATE,0))],
          ["Net Faiz",<span style={{color:"var(--ok)"}} key="nf">{mask("+"+sym+fmt(depositNet,0))}</span>],
          !p.maturityDate?["Günlük Net Kazanç",mask(sym+fmt(depositNet/depositElapsed,2))]:null,
          ["Güncel Değer",mask(sym+fmt(p.shares+depositNet,0))],
        ].filter(Boolean);
        return(
          <div className="kv">
            {rows.map(([k,v])=><div key={k}><div className="kk">{k}</div><div className="kv_">{v}</div></div>)}
          </div>
        );
      })()}
    </div>
  )}
  {!isDeposit&&<div className="g4" style={{marginBottom:8}}>
  ```

  Ve `<div className="g4">` bloğunun kapanış `</div>` satırından sonra `}` ekle:
  ```js
  </div>}
  ```

- [ ] **Step 3: Detay satırını DEPOSIT'te gizle**

  "Ort. Maliyet / Realized / Unrealized / Komisyon" bölümünün başlangıcını bul:
  ```js
  {p&&(
    <div style={{display:"flex",flexWrap:"wrap",gap:14,padding:"8px 14px",marginBottom:14,fontSize:11,color:"var(--text2)",background:"var(--bg2)",borderRadius:8,border:"0.5px solid var(--border)"}}>
  ```

  `{p&&(` → `{p&&!isDeposit&&(` olarak değiştir.

- [ ] **Step 4: Şirket Bilgisi kartını DEPOSIT'te gizle**

  `{(()=>{` ile başlayan ve `const hasDetailMeta = meta && (` içeren Şirket Bilgisi IIFE'sini bul. Dış `{(()=>{` satırını:
  ```js
  {!isDeposit&&(()=>{
  ```
  olarak değiştir.

- [ ] **Step 5: Fundamental kartını DEPOSIT'te gizle**

  ```js
  {supportsFund&&(
  ```
  →
  ```js
  {supportsFund&&!isDeposit&&(
  ```

- [ ] **Step 6: Analist Tavsiyeleri kartını DEPOSIT'te gizle**

  ```js
  {effectiveType==="US_STOCK"&&fund?.grades?.length>0&&(
  ```
  →
  ```js
  {effectiveType==="US_STOCK"&&!isDeposit&&fund?.grades?.length>0&&(
  ```

- [ ] **Step 7: Babel check**

  ```bash
  npm run check:babel
  ```

  Beklenen: parse hatası yok. Hata varsa söz dizimini kontrol et; özellikle Step 2'deki JSX ternary kapanışlarını.

- [ ] **Step 8: Tarayıcıda doğrula (2a — vadeli)**

  TRY vadeli mevduat (`maturityDate` dolu) pozisyonuna tıkla:
  - "Mevduat Özeti" kartı görünmeli: Anapara, Yıllık Faiz Oranı, Vade Tarihi + gün badge, Brüt Faiz, Stopaj, Net Faiz, Güncel Değer
  - Şirket Bilgisi / Fundamental / Analist bölümleri yok
  - "Ort. Maliyet / Realized / Unrealized" satırı yok
  - Header (ticker + isim + fiyat factor) görünüyor

- [ ] **Step 9: Tarayıcıda doğrula (2b — esnek)**

  `maturityDate=null` olan DEPOSIT pozisyonu varsa:
  - Vade Tarihi satırında "Esnek Hesap" badge görünmeli
  - "Günlük Net Kazanç" satırı görünmeli

- [ ] **Step 10: Regresyon kontrolü**

  US_STOCK ve BIST pozisyonlarına tıkla → eski görünüm (4 kart + Şirket Bilgisi + Fundamental) korunuyor.

- [ ] **Step 11: Commit**

  ```bash
  git add src/components/TickerDetailTab.js
  git commit -m "feat(deposit): TickerDetailTab custom card — mevduat özet, generik bölümler gizli

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

---

### Task 3: İşlem Geçmişi Label Düzeltmesi (2c)

**Files:**
- Modify: `src/components/TickerDetailTab.js` (işlem listesi bölümü)

- [ ] **Step 1: `isTxDepositOrCash` ekle**

  `tickerTxs.map(t=>{` içinde `const cSym=t.currency==="TRY"?"₺":"$";` satırını bul. ALTINA ekle:
  ```js
  const isTxDepositOrCash=t.asset_type==="DEPOSIT"||t.asset_type==="CASH";
  ```

- [ ] **Step 2: Adet span'ını güncelle**

  Özet satırdaki şu span'ı bul:
  ```js
  <span className="mono" style={{fontSize:12}}>{fmtShares(t.shares)} adet</span>
  ```

  Şöyle değiştir:
  ```js
  <span className="mono" style={{fontSize:12}}>{isTxDepositOrCash&&t.way==="BUY"?cSym+fmt(t.shares,0)+" yatırılan":isTxDepositOrCash&&t.way==="SELL"?cSym+fmt(t.shares,0)+" çekilen":fmtShares(t.shares)+" adet"}</span>
  ```

- [ ] **Step 3: Birim fiyat span'ını DEPOSIT/CASH BUY'da gizle**

  Adet span'ının hemen altındaki birim fiyat span'ını bul:
  ```js
  {!hideAmts&&<span className="mono dim" style={{fontSize:12}}>{mask(cSym+fmt(t.price))}</span>}
  ```

  Şöyle değiştir:
  ```js
  {!hideAmts&&!isTxDepositOrCash&&<span className="mono dim" style={{fontSize:12}}>{mask(cSym+fmt(t.price))}</span>}
  ```

- [ ] **Step 4: Babel check**

  ```bash
  npm run check:babel
  ```

  Beklenen: hata yok.

- [ ] **Step 5: Tarayıcıda doğrula**

  DEPOSIT TickerDetailTab → İşlem Geçmişi:
  - BUY satırı: `₺1,364,700 yatırılan` görünüyor; `₺1.00` fiyat span'ı yok
  - SELL varsa: `₺XXX,XXX çekilen`
  - US_STOCK BUY: `1.23 adet` eski format korunuyor

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/TickerDetailTab.js
  git commit -m "fix(deposit): transaction history label — yatırılan/çekilen instead of N adet 1.00

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

---

### Task 4: Sprint Kapanışı ve Dokümantasyon

- [ ] **Step 1: Final babel check**

  ```bash
  npm run check:babel
  ```

- [ ] **Step 2: `sprints/sprint-18.md` güncelle**

  Item 2 ve 3 altındaki tüm alt-task checkbox'larını `[x]` yap. DoD maddelerini gözden geçir.

- [ ] **Step 3: `ROADMAP.md` güncelle**

  Sprint 18 scope bölümündeki Item 2 ve 3 satırlarını `✅` ile işaretle. "Sonraki Adım" bölümünde Sprint 18'i tamamlandı olarak güncelle.

- [ ] **Step 4: Commit**

  ```bash
  git add sprints/sprint-18.md ROADMAP.md
  git commit -m "docs: mark Sprint 18 Items 2 and 3 complete

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

- [ ] **Step 5: Push**

  ```bash
  git push
  ```
