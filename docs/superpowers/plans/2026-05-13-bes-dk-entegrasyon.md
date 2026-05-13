# BES Devlet Katkısı Entegrasyonu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BES pozisyonlarında devlet katkısı (DK) anaparası ve güncel değeri ayrı alanlar olarak saklanır; cost basis yalnızca kişisel katkıdan oluşur; P&L doğru hesaplanır.

**Architecture:** `positions` tablosuna `dk_principal` (Y) ve `dk_current` (Y+Y_g) sütunları eklenir. `rebuild_positions_atomic` RPC yeni sütunları INSERT eder. `rebuildPositions` util'i snapshot'ı okuyup nesneye yazar. `ManuelPosForm` kullanıcıdan 4 BES değerini alır; `total = kişisel_güncel + dk_güncel` `price_cache`'e yazılır (mevcut MV hesabı değişmez). `App.js` `loadData` map'ine iki yeni alan eklenir.

**Tech Stack:** Supabase PostgreSQL (migration + RPC), React 18 UMD/JSX (src/components), Babel Standalone (no build step)

---

## File Map

| Dosya | Değişiklik |
|---|---|
| `supabase/migrations/018_bes_dk.sql` | Yeni — `dk_principal`, `dk_current` sütun; `rebuild_positions_atomic` güncelleme |
| `src/utils.js` | Modify — `rebuildPositions` snapshot select + `besSnapMap` + position nesne çıktısı |
| `src/components/App.js` | Modify — `loadData` setPos map'ine `dkPrincipal`, `dkCurrent` ekleme |
| `src/components/ManuelPosForm.js` | Modify — form state/validate/savePos/JSX label/fields/preview/poslist |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/018_bes_dk.sql`

- [ ] **Step 1: Dosyayı yaz**

```sql
-- =============================================================================
-- Migration: 018_bes_dk.sql
-- Add dk_principal and dk_current to positions for BES state contributions.
-- Update rebuild_positions_atomic to persist the new columns.
-- =============================================================================

BEGIN;

ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS dk_principal numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dk_current   numeric DEFAULT NULL;

CREATE OR REPLACE FUNCTION rebuild_positions_atomic(
  p_user_id      uuid,
  p_portfolio_id uuid,
  p_positions    jsonb
)
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  inserted int := 0;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  DELETE FROM positions
  WHERE user_id = p_user_id AND portfolio_id = p_portfolio_id;

  IF p_positions IS NOT NULL AND jsonb_array_length(p_positions) > 0 THEN
    INSERT INTO positions (
      user_id, portfolio_id, ticker, name, type,
      shares, avg_cost, currency, broker, unit,
      interest_rate, maturity_date, reserve_ratio,
      dk_principal, dk_current,
      updated_at
    )
    SELECT
      p_user_id,
      p_portfolio_id,
      el->>'ticker',
      el->>'name',
      el->>'type',
      (el->>'shares')::numeric,
      (el->>'avg_cost')::numeric,
      el->>'currency',
      el->>'broker',
      el->>'unit',
      NULLIF(el->>'interest_rate', '')::numeric,
      NULLIF(el->>'maturity_date', '')::date,
      COALESCE(NULLIF(el->>'reserve_ratio', '')::numeric, 0),
      NULLIF(el->>'dk_principal', '')::numeric,
      NULLIF(el->>'dk_current', '')::numeric,
      (el->>'updated_at')::timestamptz
    FROM jsonb_array_elements(p_positions) AS el;

    GET DIAGNOSTICS inserted = ROW_COUNT;
  END IF;

  RETURN inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION rebuild_positions_atomic(uuid, uuid, jsonb) TO authenticated;

COMMIT;
```

- [ ] **Step 2: Supabase MCP ile uygula**

Supabase MCP `apply_migration` aracını kullan:
- migration_name: `018_bes_dk`
- query: yukarıdaki SQL içeriği

Beklenen: migration başarılı, positions tablosunda `dk_principal` ve `dk_current` sütunları görünür.

- [ ] **Step 3: Doğrula**

Supabase MCP `execute_sql` ile kontrol:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'positions'
  AND column_name IN ('dk_principal', 'dk_current');
```
Beklenen: 2 satır — her iki sütun `numeric`, default `NULL`.

---

## Task 2: utils.js — rebuildPositions

**Files:**
- Modify: `src/utils.js:360-378`

- [ ] **Step 1: Snapshot select'i genişlet**

`src/utils.js` satır 360:

Eski:
```js
const snapRes = await sb.from("positions").select("ticker,unit,interest_rate,maturity_date,reserve_ratio").eq("user_id",userId).eq("portfolio_id",pid);
```

Yeni:
```js
const snapRes = await sb.from("positions").select("ticker,type,unit,interest_rate,maturity_date,reserve_ratio,dk_principal,dk_current").eq("user_id",userId).eq("portfolio_id",pid);
```

- [ ] **Step 2: besSnapMap oluştur**

`src/utils.js` satır 362 civarı — `depositSnapMap` bloğunun hemen altına ekle:

Eski (satır 361-368):
```js
  const unitMap = Object.fromEntries((snapRes.data||[]).map(p=>[p.ticker,p.unit||null]));
  const depositSnapMap = {};
  for(const p of (snapRes.data||[])){
    if(p.interest_rate!=null||p.maturity_date!=null||p.reserve_ratio){
      depositSnapMap[p.ticker]={interest_rate:p.interest_rate,maturity_date:p.maturity_date,reserve_ratio:p.reserve_ratio??0};
    }
  }
  const depositMap = {...depositSnapMap, ...extraMeta};
```

Yeni:
```js
  const unitMap = Object.fromEntries((snapRes.data||[]).map(p=>[p.ticker,p.unit||null]));
  const depositSnapMap = {};
  const besSnapMap = {};
  for(const p of (snapRes.data||[])){
    if(p.interest_rate!=null||p.maturity_date!=null||p.reserve_ratio){
      depositSnapMap[p.ticker]={interest_rate:p.interest_rate,maturity_date:p.maturity_date,reserve_ratio:p.reserve_ratio??0};
    }
    if(p.type==="BES"){
      besSnapMap[p.ticker]={dk_principal:p.dk_principal,dk_current:p.dk_current};
    }
  }
  const depositMap = {...depositSnapMap, ...extraMeta};
  const besMap = {...besSnapMap, ...extraMeta};
```

- [ ] **Step 3: Position nesnesine dk alanlarını ekle**

`src/utils.js` satır 370-379 — `np` map fonksiyonu içinde `reserve_ratio` satırından sonra:

Eski:
```js
    reserve_ratio: depositMap[p.ticker]?.reserve_ratio ?? 0,
    updated_at: new Date().toISOString()
```

Yeni:
```js
    reserve_ratio: depositMap[p.ticker]?.reserve_ratio ?? 0,
    dk_principal: besMap[p.ticker]?.dk_principal ?? null,
    dk_current:   besMap[p.ticker]?.dk_current   ?? null,
    updated_at: new Date().toISOString()
```

- [ ] **Step 4: Babel check**

```bash
npm run check:babel
```
Beklenen: 0 hata.

- [ ] **Step 5: Commit**

```bash
git add src/utils.js
git commit -m "feat(bes-dk): extend rebuildPositions with dk_principal/dk_current snapshot"
```

---

## Task 3: App.js — loadData setPos map

**Files:**
- Modify: `src/components/App.js:227`

- [ ] **Step 1: setPos map'ine dk alanlarını ekle**

`src/components/App.js` satır 227:

Eski:
```js
    if(pr.data)setPos(pr.data.map(p=>({ticker:p.ticker,name:p.name,type:p.type,shares:+p.shares,avgCost:+p.avg_cost,currency:p.currency,broker:p.broker,unit:p.unit||null,interestRate:p.interest_rate!=null?+p.interest_rate:null,maturityDate:p.maturity_date||null,reserveRatio:p.reserve_ratio??0})));
```

Yeni:
```js
    if(pr.data)setPos(pr.data.map(p=>({ticker:p.ticker,name:p.name,type:p.type,shares:+p.shares,avgCost:+p.avg_cost,currency:p.currency,broker:p.broker,unit:p.unit||null,interestRate:p.interest_rate!=null?+p.interest_rate:null,maturityDate:p.maturity_date||null,reserveRatio:p.reserve_ratio??0,dkPrincipal:p.dk_principal!=null?+p.dk_principal:null,dkCurrent:p.dk_current!=null?+p.dk_current:null})));
```

- [ ] **Step 2: Babel check**

```bash
npm run check:babel
```
Beklenen: 0 hata.

- [ ] **Step 3: Commit**

```bash
git add src/components/App.js
git commit -m "feat(bes-dk): add dkPrincipal/dkCurrent to loadData setPos map"
```

---

## Task 4: ManuelPosForm.js — Form state, validate, startEdit

**Files:**
- Modify: `src/components/ManuelPosForm.js:9,20-29,87-93`

- [ ] **Step 1: E initial state'e dk alanlarını ekle**

`src/components/ManuelPosForm.js` satır 9:

Eski:
```js
  const E={ticker:"",name:"",type:initType,shares:"",avgCost:"",currency:initCurrency,broker:"",commission:"",date:today(),unit:"oz",currentValue:"",interestRate:"",maturityDate:"",reserveRatio:""};
```

Yeni:
```js
  const E={ticker:"",name:"",type:initType,shares:"",avgCost:"",currency:initCurrency,broker:"",commission:"",date:today(),unit:"oz",currentValue:"",interestRate:"",maturityDate:"",reserveRatio:"",dkPrincipal:"",dkCurrent:""};
```

- [ ] **Step 2: validate() — BES dk validation ekle**

`src/components/ManuelPosForm.js` satır 20-29, `validate` fonksiyonu içinde:

Eski:
```js
  const validate=()=>{
    const e={};
    const isCashType=form.type==="CASH"||form.type==="DEPOSIT";
    if(form.type!=="BES"&&(+form.shares<=0||isNaN(+form.shares)))e.shares="Bakiye 0'dan büyük olmalı";
    if(!isCashType&&(+form.avgCost<=0||isNaN(+form.avgCost)))e.avgCost=form.type==="BES"?"Tutar 0'dan büyük olmalı":"Fiyat 0'dan büyük olmalı";
    if(form.type==="DEPOSIT"){
      if(+form.interestRate<=0||isNaN(+form.interestRate))e.interestRate="Faiz oranı 0'dan büyük olmalı";
    }
    setErrs(e);
    return Object.keys(e).length===0;
  };
```

Yeni:
```js
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
```

- [ ] **Step 3: startEdit — dk alanlarını pre-populate et**

`src/components/ManuelPosForm.js` satır 87-93:

Eski:
```js
  const startEdit=p=>{
    setEditTk(p.ticker);
    setForm({...E,ticker:p.ticker,name:p.name,type:p.type,shares:p.shares,avgCost:p.type==="CASH"||p.type==="DEPOSIT"?"":p.avgCost,currency:p.currency,broker:p.broker||"",
      interestRate:p.interestRate!=null?(p.interestRate*100).toString():"",
      maturityDate:p.maturityDate||"",
      reserveRatio:p.reserveRatio!=null&&p.reserveRatio>0?(p.reserveRatio*100).toString():""});
    if(p.type!=="BES"&&p.type!=="CASH"&&p.type!=="DEPOSIT")fetchPrice(p.ticker);
  };
```

Yeni:
```js
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
```

Not: BES edit için `currentValue` (X+X_g = price_cache − dk_current) `price_cache`'den türetilmeli. Spec'te belirtildiği gibi, edit anında `price_cache − p.dkCurrent` hesaplanabilir; ancak bu değer zaten kullanıcı tarafından `savePos`'ta `total = currentValue + dkCurrent` olarak set edildiğinden `total − dkCurrent` doğru X+X_g'yi verir. Şimdilik `currentValue` boş bırakılır ve kullanıcı edit ekranında tekrar girer (future: price_cache'den çekip doldurmak mümkün).

- [ ] **Step 4: Babel check**

```bash
npm run check:babel
```
Beklenen: 0 hata.

---

## Task 5: ManuelPosForm.js — savePos güncelle

**Files:**
- Modify: `src/components/ManuelPosForm.js:96-141`

- [ ] **Step 1: savePos'u BES DK desteğiyle güncelle**

`src/components/ManuelPosForm.js` satır 124-138 — `depositMeta` ve sonraki blok:

Eski:
```js
    const depositMeta = form.type==="DEPOSIT"
      ? {[tk]:{interest_rate:+form.interestRate/100,maturity_date:form.maturityDate||null,reserve_ratio:+form.reserveRatio/100||0}}
      : {};
    const rebuilt=await rebuildPositions(user.id,portfolioId,depositMeta);
    if(rebuilt===null){flash_("Pozisyon güncellenemedi","err");setSaving(false);return;}

    await loadData();
    flash_(`${tk} işlem geçmişine ve pozisyona eklendi ✓`);
    if(form.type==="BES"&&+form.currentValue>0){
      try{
        await edgePriceCall({mode:"set-manual-price",ticker:tk,price:+form.currentValue,asset_type:"BES"});
      }catch(e){
        console.warn("[BES set-manual-price]",e);
      }
    }
```

Yeni:
```js
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
```

- [ ] **Step 2: Babel check**

```bash
npm run check:babel
```
Beklenen: 0 hata.

---

## Task 6: ManuelPosForm.js — Form JSX: alanlar ve preview

**Files:**
- Modify: `src/components/ManuelPosForm.js:286-391`

- [ ] **Step 1: "Yatırılan Toplam Tutar" → "Kişisel Yatırılan" label**

`src/components/ManuelPosForm.js` satır 286:

Eski:
```js
            <div className="kk" style={{marginBottom:4}}>{form.type==="BES"?"Yatırılan Toplam Tutar (₺) *":form.type==="GOLD"?`Ort. Maliyet * (${form.currency}/${GOLD_UNITS.find(g=>g.key===form.unit)?.label||'oz'})`:"Ort. Maliyet *"}</div>
```

Yeni:
```js
            <div className="kk" style={{marginBottom:4}}>{form.type==="BES"?"Kişisel Yatırılan (₺) *":form.type==="GOLD"?`Ort. Maliyet * (${form.currency}/${GOLD_UNITS.find(g=>g.key===form.unit)?.label||'oz'})`:"Ort. Maliyet *"}</div>
```

- [ ] **Step 2: "Güncel Değer" alanını yeniden adlandır + required yap + 3 yeni BES alanı ekle**

`src/components/ManuelPosForm.js` satır 296-303:

Eski:
```js
          {form.type==="BES"&&(
            <div>
              <div className="kk" style={{marginBottom:4}}>Güncel Değer (₺) — opsiyonel</div>
              <input className="finp" type="number" step="any" value={form.currentValue}
                onChange={e=>set({currentValue:e.target.value})}
                placeholder="güncel portföy değeri"/>
            </div>
          )}
```

Yeni:
```js
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
```

- [ ] **Step 3: Form preview (BES) — 4 bileşenli özet**

`src/components/ManuelPosForm.js` satır 361-374 — BES preview bloğu:

Eski:
```js
            {form.type==="BES"?(
              form.avgCost&&+form.avgCost>0?(
                <div style={{fontSize:11,color:"var(--text2)",padding:"7px 0"}}>
                  Yatırılan: ₺{fmt(+form.avgCost,0)}
                  {form.currentValue&&+form.currentValue>0&&(
                    <>
                      <br/>Güncel: ₺{fmt(+form.currentValue,0)}
                      <br/><span style={{color:+form.currentValue>=+form.avgCost?"var(--ok)":"var(--err)"}}>
                        {+form.currentValue>=+form.avgCost?"+":""}{fmt((+form.currentValue-+form.avgCost)*100/(+form.avgCost),1)}%
                      </span>
                    </>
                  )}
                </div>
              ):null
```

Yeni:
```js
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
```

- [ ] **Step 4: Hint satırını kaldır**

`src/components/ManuelPosForm.js` satır 391:

Eski:
```js
        {form.type==="BES"&&<div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>Devlet katkısı için farklı bir hesap kodu ile ayrı pozisyon ekleyin (örn: AH_DK).</div>}
```

Yeni: Bu satırı tamamen sil.

- [ ] **Step 5: Babel check**

```bash
npm run check:babel
```
Beklenen: 0 hata.

---

## Task 7: ManuelPosForm.js — Pozisyon listesi BES display

**Files:**
- Modify: `src/components/ManuelPosForm.js:401-402`

- [ ] **Step 1: BES satırı dk bilgisi göster**

`src/components/ManuelPosForm.js` satır 401-402:

Eski:
```js
                {p.type==="BES"
                  ?<span className="dim" style={{fontSize:11,marginLeft:8}}>₺{fmt(p.avgCost,0)} yatırılan</span>
```

Yeni:
```js
                {p.type==="BES"
                  ?<span className="dim" style={{fontSize:11,marginLeft:8}}>
                    ₺{fmt(p.avgCost,0)} kişisel
                    {p.dkPrincipal!=null&&<> · DK: ₺{fmt(p.dkPrincipal,0)}</>}
                    {p.dkPrincipal!=null&&<> · Toplam: ₺{fmt(p.avgCost+(p.dkCurrent||0)+(/* kişisel kazanç */ 0),0)}</>}
                  </span>
```

**DİKKAT:** Toplam değer `price_cache`'den gelir (not `avgCost + dkCurrent` doğrudan), ama pozisyon listesi `prc` state'e erişimi olmadığından sadece kişisel + DK bilgisini göster:

Eski:
```js
                {p.type==="BES"
                  ?<span className="dim" style={{fontSize:11,marginLeft:8}}>₺{fmt(p.avgCost,0)} yatırılan</span>
```

Yeni:
```js
                {p.type==="BES"
                  ?<span className="dim" style={{fontSize:11,marginLeft:8}}>
                    ₺{fmt(p.avgCost,0)} kişisel{p.dkPrincipal!=null?` · DK: ₺${fmt(p.dkPrincipal,0)} · Güncel DK: ₺${fmt(p.dkCurrent,0)}`:""}
                  </span>
```

- [ ] **Step 2: Babel check**

```bash
npm run check:babel
```
Beklenen: 0 hata.

- [ ] **Step 3: Commit — tüm ManuelPosForm değişiklikleri**

```bash
git add src/components/ManuelPosForm.js
git commit -m "feat(bes-dk): BES form 4-component DK fields, savePos total price, position list display"
```

---

## Task 8: End-to-End Doğrulama

- [ ] **Step 1: Yerel sunucu başlat**

```bash
npx serve .
```
`http://localhost:3000` aç.

- [ ] **Step 2: Tam babel check**

```bash
npm run check:babel
```
Beklenen: 0 hata.

- [ ] **Step 3: Test — yeni BES pozisyonu ekle**

1. "BES Fonu" tipinde yeni pozisyon ekle:
   - Hesap kodu: `TEST_BES`
   - Plan adı: herhangi
   - Kişisel Yatırılan: `10000`
   - Kişisel Portföy Güncel Değeri: `11500`
   - DK Anaparası: `2500`
   - DK Güncel Değeri: `2800`
2. "Pozisyon Kaydet" tıkla.
3. Beklenen: flash "TEST_BES işlem geçmişine ve pozisyona eklendi ✓"
4. Beklenen form preview: "Kişisel katkı: ₺10,000 · DK: ₺2,500 / Toplam hesap değeri: ₺14,300 / Toplam getiri: +₺4,300 (+43.0%)"
5. Pozisyon listesinde: "₺10,000 kişisel · DK: ₺2,500 · Güncel DK: ₺2,800" görünmeli.

- [ ] **Step 4: Test — edit modu**

1. TEST_BES pozisyonunun "Düzenle" butonuna tıkla.
2. Beklenen: dkPrincipal alanında `2500`, dkCurrent alanında `2800` dolu olmalı.

- [ ] **Step 5: Test — validation**

1. Yeni BES ekle, DK alanlarını boş bırak ve "Pozisyon Kaydet" tıkla.
2. Beklenen: hata mesajları görünmeli ("DK anaparası 0'dan büyük olmalı", "DK güncel değeri 0'dan büyük olmalı").

- [ ] **Step 6: Test — DK < anapara uyarısı**

1. DK Anaparası: `2500`, DK Güncel Değeri: `2000` gir.
2. Beklenen: sarı warn mesajı "DK güncel değeri anaparadan düşük — devam edebilirsin." — kayıt ENGELLENMEZ.

- [ ] **Step 7: Supabase'de doğrula**

Supabase MCP `execute_sql` ile:
```sql
SELECT ticker, avg_cost, dk_principal, dk_current
FROM positions
WHERE type = 'BES'
ORDER BY updated_at DESC
LIMIT 5;
```
Beklenen: TEST_BES satırında `dk_principal=2500`, `dk_current=2800`.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat(sprint18): BES devlet katkısı entegrasyonu tamamlandı"
```

---

## Notlar

- Mevcut BES pozisyonları (migration öncesi): `dk_principal` ve `dk_current` NULL olacak; pozisyon listesinde eski görünüm korunur ("₺X yatırılan"). Kullanıcı edit yapınca DK değerleri güncellenebilir.
- `price_cache` MV hesabı değişmez — BES için `total = kişisel_güncel + dk_güncel` zaten `set-manual-price` ile price_cache'e yazılıyor.
- TickerDetailTab BES breakdown (X, X_g, Y, Y_g ayrı satırlar) bu sprint'in kapsamı dışında (Sprint 18 Item 2 değil, future work olarak spec'te belirtildi).
