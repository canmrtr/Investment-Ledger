# Hamburger Menü + Rehber Sekmesi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Topbar'daki logoyu hamburger menüyle değiştir; Ayarlar'ı dropdown'a taşı; Ana nav'a "Rehber" sekmesi ekle (Çok Yakında placeholder).

**Architecture:** Üç dosya değişir — `index.html` (CSS), `src/utils.js` (NAV_ICONS), `src/components/App.js` (state, render, TABS). Hamburger state (`menuOpen`) App bileşeninde tutulur; dropdown dışına tıklama document-level click listener ile kapatılır ve cleanup useEffect'te yapılır.

**Tech Stack:** React 18 UMD + Babel Standalone (browser-side JSX), inline CSS custom properties (`var(--bg4)`, `var(--info)` vb.), Supabase auth (`sb.auth.signOut()`).

---

## Dosya Haritası

| Dosya | Değişiklik |
|-------|-----------|
| `index.html` | CSS: `.hamburger-btn`, `.ham-menu`, `.ham-menu-row` sınıfları eklenir; `.theme-logo` satırları kaldırılır |
| `src/utils.js` | `NAV_ICONS` objesine `rehber` ikonu eklenir |
| `src/components/App.js` | TABS güncellenir; `menuOpen` state; hamburger butonu render; dropdown panel; RehberTab placeholder; FAB kuralı güncellenir |

---

## Task 1: CSS — Hamburger ve Dropdown Stilleri

**Files:**
- Modify: `index.html` (topbar CSS bloğu, satır 40–46 civarı)

- [ ] **Adım 1: Logo CSS satırlarını kaldır, hamburger + dropdown CSS ekle**

`index.html` içindeki şu 4 satırı bul ve **kaldır** (artık kullanılmıyor):

```css
.logo-mark{width:28px;height:28px;background:var(--info);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;letter-spacing:-0.03em;flex-shrink:0;}
.logo-text{font-size:13px;font-weight:600;color:var(--text);letter-spacing:-0.02em;}
.theme-logo{height:32px;width:auto;flex-shrink:0;display:block;}
.theme-logo-light{display:none;}
[data-theme="light"] .theme-logo-dark{display:none;}
[data-theme="light"] .theme-logo-light{display:block;}
```

Aynı yere (`.topbar-left{...}` satırının hemen altına) şunları **ekle**:

```css
.hamburger-btn{display:flex;flex-direction:column;justify-content:space-between;width:18px;height:13px;background:transparent;border:none;cursor:pointer;padding:6px;box-sizing:content-box;border-radius:6px;flex-shrink:0;}
.hamburger-btn span{display:block;height:2px;background:var(--info);border-radius:1px;transition:transform .15s,opacity .15s;}
.hamburger-btn.open span:nth-child(1){transform:rotate(45deg) translate(4px,4px);}
.hamburger-btn.open span:nth-child(2){opacity:0;}
.hamburger-btn.open span:nth-child(3){transform:rotate(-45deg) translate(4px,-4px);}
.ham-menu{position:absolute;top:52px;left:0;z-index:200;background:var(--bg4);border:1px solid var(--border2);border-radius:10px;padding:10px;min-width:200px;box-shadow:0 8px 24px rgba(0,0,0,.5);}
.ham-menu-profile{display:flex;align-items:center;gap:8px;padding-bottom:8px;border-bottom:1px solid var(--border);margin-bottom:6px;}
.ham-menu-avatar{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--info),#8A6A1F);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#000;flex-shrink:0;}
.ham-menu-row{display:flex;align-items:center;gap:8px;padding:7px 6px;border-radius:6px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:13px;color:var(--text2);background:transparent;border:none;width:100%;text-align:left;transition:background .1s,color .1s;}
.ham-menu-row:hover{background:var(--bg3);color:var(--text);}
.ham-menu-row.danger{color:var(--err);}
.ham-menu-row.danger:hover{background:rgba(255,51,102,.08);}
.ham-divider{height:1px;background:var(--border);margin:4px 0;}
```

- [ ] **Adım 2: Babel check**

```bash
npm run check:babel
```

Beklenen çıktı: tüm dosyalar `OK` — CSS değişikliği JS parse'ı etkilemez, hata olmamalı.

- [ ] **Adım 3: Commit**

```bash
git add index.html
git commit -m "style: add hamburger-btn and ham-menu CSS classes"
```

---

## Task 2: NAV_ICONS — Rehber İkonu

**Files:**
- Modify: `src/utils.js` (satır 485–486 civarı, `settings` girişinden sonra)

- [ ] **Adım 1: `rehber` ikonunu NAV_ICONS'a ekle**

`src/utils.js` içinde `NAV_ICONS` objesinde `settings:` satırından sonra şunu ekle:

```js
  rehber:    (s)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2h7l3 3v9H3z"/><line x1="6" y1="6" x2="10" y2="6"/><line x1="6" y1="9" x2="10" y2="9"/></svg>,
```

- [ ] **Adım 2: Babel check**

```bash
npm run check:babel
```

Beklenen: `OK` — JSX içinde sadece yeni bir SVG elementi var.

- [ ] **Adım 3: Commit**

```bash
git add src/utils.js
git commit -m "feat: add rehber nav icon to NAV_ICONS"
```

---

## Task 3: TABS + menuOpen State

**Files:**
- Modify: `src/components/App.js` (satır 414 — TABS; satır ~56-62 arası — state'ler)

- [ ] **Adım 1: TABS dizisini güncelle (satır 414)**

```js
// ÖNCE:
const TABS=[["dashboard","Dashboard"],["watchlist","Watchlist"],["analysis","Analiz"],["search","Ara"],["add","+ Ekle"],["settings","Ayarlar"]];

// SONRA:
const TABS=[["dashboard","Dashboard"],["watchlist","Watchlist"],["analysis","Analiz"],["search","Ara"],["add","+ Ekle"],["rehber","Rehber"]];
```

- [ ] **Adım 2: `menuOpen` state'ini ekle**

`App.js`'de diğer `useState` çağrılarının bulunduğu blokta (satır 56-62 civarı, `const [flash,...` satırının altı uygun bir yer), şunu ekle:

```js
const [menuOpen,setMenuOpen]=useState(false);
```

- [ ] **Adım 3: Babel check**

```bash
npm run check:babel
```

Beklenen: `OK`.

- [ ] **Adım 4: Commit**

```bash
git add src/components/App.js
git commit -m "feat: update TABS (settings→rehber) and add menuOpen state"
```

---

## Task 4: Hamburger Butonu ve Dropdown Paneli

**Files:**
- Modify: `src/components/App.js` (satır 431–462, `return(` bloğu içindeki topbar)

- [ ] **Adım 1: `topbar-left` içindeki logoları hamburger butonuyla değiştir**

`App.js` içinde şu bloğu bul:

```jsx
<div className="topbar-left">
  <img src="Logo/logo-mark-dark.png" className="theme-logo theme-logo-dark" alt="Portfoi"/>
  <img src="Logo/logo-mark-light.png" className="theme-logo theme-logo-light" alt="Portfoi"/>
</div>
```

Şununla değiştir:

```jsx
<div className="topbar-left" style={{position:"relative"}}>
  <button
    className={"hamburger-btn"+(menuOpen?" open":"")}
    onClick={()=>setMenuOpen(o=>!o)}
    aria-label="Menü"
    aria-expanded={menuOpen}
  >
    <span/><span/><span/>
  </button>
  {menuOpen&&(
    <div className="ham-menu">
      <div className="ham-menu-profile">
        <div className="ham-menu-avatar">
          {(profile?.display_name||user.email||"?")[0].toUpperCase()}
        </div>
        <div>
          <div style={{fontSize:12,fontWeight:600,color:"var(--text)"}}>{profile?.display_name||"Kullanıcı"}</div>
          <div style={{fontSize:11,color:"var(--text3)"}}>{user.email}</div>
        </div>
      </div>
      <button className="ham-menu-row" onClick={()=>{setTab("settings");setMenuOpen(false);}}>
        {NAV_ICONS.settings(14)}Ayarlar
      </button>
      <div className="ham-divider"/>
      <button className="ham-menu-row danger" onClick={()=>sb.auth.signOut()}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 8h7M10 5l3 3-3 3"/><path d="M10 3H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h6"/></svg>
        Çıkış Yap
      </button>
    </div>
  )}
</div>
```

- [ ] **Adım 2: `useEffect` ile dışarı tıklayınca kapat**

`App.js`'de `menuOpen` state'inin hemen altına şu `useEffect`'i ekle:

```js
useEffect(()=>{
  if(!menuOpen)return;
  const close=e=>{
    if(!e.target.closest('.ham-menu')&&!e.target.closest('.hamburger-btn'))setMenuOpen(false);
  };
  document.addEventListener("mousedown",close);
  return()=>document.removeEventListener("mousedown",close);
},[menuOpen]);
```

- [ ] **Adım 3: Babel check**

```bash
npm run check:babel
```

Beklenen: `OK`.

- [ ] **Adım 4: Commit**

```bash
git add src/components/App.js
git commit -m "feat: replace topbar logo with hamburger dropdown (profile + settings + signout)"
```

---

## Task 5: RehberTab Placeholder + FAB Kuralı

**Files:**
- Modify: `src/components/App.js` (settings tab render bloğunun yanına; satır 1207 — FAB style)

- [ ] **Adım 1: RehberTab render bloğunu ekle**

`App.js`'de `{tab==="settings"&&(` bloğunun hemen **sonrasına** (settings bloğu kapandıktan sonra) şunu ekle:

```jsx
{tab==="rehber"&&(
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",gap:12,textAlign:"center",padding:24}}>
    <span style={{fontSize:36}}>📖</span>
    <div style={{fontSize:16,fontWeight:600,color:"var(--text)"}}>Rehber</div>
    <div style={{fontSize:11,fontWeight:600,color:"var(--info)",letterSpacing:"0.08em",textTransform:"uppercase"}}>Çok Yakında</div>
    <div style={{fontSize:13,color:"var(--text3)",maxWidth:280,lineHeight:1.6}}>Yatırım temelleri, portföy yönetimi ve kişisel finans rehberi burada olacak.</div>
  </div>
)}
```

- [ ] **Adım 2: FAB kuralını güncelle (satır ~1207)**

```jsx
// ÖNCE:
style={tab==="settings"?{display:"none"}:{}}

// SONRA:
style={(tab==="settings"||tab==="rehber")?{display:"none"}:{}}
```

- [ ] **Adım 3: Babel check**

```bash
npm run check:babel
```

Beklenen: `OK`.

- [ ] **Adım 4: Commit**

```bash
git add src/components/App.js
git commit -m "feat: add Rehber tab (coming soon) and hide FAB on rehber"
```

---

## Task 6: Manuel Doğrulama

**Ön koşul:** Tüm önceki task'lar tamamlandı.

- [ ] **Adım 1: Yerel sunucu başlat**

```bash
npx serve .
```

Tarayıcıda `http://localhost:3000` aç.

- [ ] **Adım 2: Topbar kontrol**

- Logo yok, sol üstte 3 çizgi (hamburger) var, gold renk.
- Nav tabs: Dashboard, Watchlist, Analiz, Ara, Rehber — "Ayarlar" yok.

- [ ] **Adım 3: Hamburger dropdown kontrol**

- Hamburger'a tıkla → ✕ ikonuna geçmeli, panel açılmalı.
- Panel: avatar + isim + email, Ayarlar satırı, ayraç, kırmızı Çıkış Yap.
- Panel dışına tıkla → kapanmalı.
- Ayarlar'a tıkla → Settings sekmesine geçmeli, panel kapanmalı.

- [ ] **Adım 4: Rehber sekmesi kontrol**

- Nav'dan "Rehber"e tıkla → 📖 ikonu, "Çok Yakında" yazısı.
- FAB görünmüyor olmalı.

- [ ] **Adım 5: Mobil kontrol (640px altı)**

- DevTools'da mobil görünüme geç.
- Alt sekmeler: Dashboard, Watchlist, Analiz, Ara, Rehber — "Ayarlar" yok.
- Hamburger topbar'da hâlâ görünüyor (topbar-left gizlenmez, sadece topbar-nav gizlenir).

- [ ] **Adım 6: Light tema kontrol**

- Settings → light tema seç.
- Hamburger gold rengi `var(--info)` light modda `#8A6A1F` — görünür olmalı.
- Dropdown panel arka planı `var(--bg4)` → light'ta doğru renk.

- [ ] **Adım 7: Final commit (gerekirse)**

Herhangi bir küçük düzeltme varsa commit'le:

```bash
git add -p
git commit -m "fix: <kısa açıklama>"
```
