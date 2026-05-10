# Hamburger Menü + Rehber Sekmesi

**Date:** 2026-05-10  
**Status:** Approved

## Özet

Topbar'daki logo yerine hamburger menü ikonu eklenir. Ayarlar sekmesi ana navigasyondan kaldırılıp hamburger dropdown'una taşınır. Boşalan yere "Rehber" sekmesi eklenir (şimdilik "Çok Yakında" placeholder).

---

## Değişiklikler

### 1. Topbar Sol — Logo → Hamburger İkonu

- `Logo/logo-mark-dark.png` / `logo-mark-light.png` ikonları topbar'dan kaldırılır.
- Yerine hamburger butonu eklenir: 3 yatay çizgi, `var(--info)` (gold) renk, 18×13px.
- Açıkken ✕ (X) ikonuna geçer (`menuOpen` state ile CSS transform).
- Buton: `background:transparent`, `border:none`, `cursor:pointer`, `padding:6px`, `border-radius:6px`.

### 2. Hamburger Dropdown Paneli

**Tetikleyici:** Hamburger butona tıklama → `menuOpen` state toggle.  
**Kapanma:** Dropdown dışına tıklama (document click listener) veya bir öğeye tıklama.  
**Konum:** `position:absolute; top:52px; left:0; z-index:200`.

**Panel içeriği (yukarıdan aşağı):**

1. **Profil satırı** — Avatar (baş harfi, gold gradient daire 30px) + display_name + email. `profile` state'inden okunur.
2. **Ayarlar** — Settings ikonu + "Ayarlar" metni; tıklanınca `setTab("settings")` + `setMenuOpen(false)`.
3. **Yatay ayraç.**
4. **Çıkış Yap** — Logout ikonu, `color:var(--err)` kırmızı; tıklanınca `sb.auth.signOut()`.

**Stil:** `background:var(--bg4)`, `border:1px solid var(--border2)`, `border-radius:10px`, `padding:10px`, `min-width:200px`, `box-shadow:0 8px 24px rgba(0,0,0,0.5)`.

### 3. TABS Dizisi — `settings` → `rehber`

```js
// Önce
const TABS = [
  ["dashboard","Dashboard"],["watchlist","Watchlist"],
  ["analysis","Analiz"],["search","Ara"],
  ["add","+ Ekle"],["settings","Ayarlar"]
];

// Sonra
const TABS = [
  ["dashboard","Dashboard"],["watchlist","Watchlist"],
  ["analysis","Analiz"],["search","Ara"],
  ["add","+ Ekle"],["rehber","Rehber"]
];
```

- Topbar nav: `TABS.filter(([id])=>id!=="add")` — `settings` yerine `rehber` görünür.
- Alt sekmeler (`#bottom-tabs`): aynı filtre, `settings` yerine `rehber`.
- `tab==="settings"` → FAB `display:none` kuralı `tab==="rehber"` olarak güncellenir.

### 4. NAV_ICONS — Rehber İkonu Eklenir

`src/utils.js` içindeki `NAV_ICONS` objesine eklenir:

```js
rehber: (s)=><svg width={s} height={s} viewBox="0 0 16 16" fill="none"
  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
  <path d="M3 2h7l3 3v9H3z"/>
  <line x1="6" y1="6" x2="10" y2="6"/>
  <line x1="6" y1="9" x2="10" y2="9"/>
</svg>,
```

### 5. RehberTab Bileşeni — "Çok Yakında"

`src/components/App.js` içinde inline olarak render edilir (ayrı dosyaya gerek yok, çok basit):

```jsx
{tab==="rehber" && (
  <div style={{display:"flex",flexDirection:"column",alignItems:"center",
    justifyContent:"center",minHeight:"60vh",gap:12,textAlign:"center",padding:24}}>
    <span style={{fontSize:36}}>📖</span>
    <div style={{fontSize:16,fontWeight:600,color:"var(--text)"}}>Rehber</div>
    <div style={{fontSize:11,fontWeight:600,color:"var(--info)",
      letterSpacing:"0.08em",textTransform:"uppercase"}}>Çok Yakında</div>
    <div style={{fontSize:13,color:"var(--text3)",maxWidth:280,lineHeight:1.6}}>
      Yatırım temelleri, portföy yönetimi ve kişisel finans rehberi burada olacak.
    </div>
  </div>
)}
```

### 6. CSS Değişiklikleri

```css
/* Hamburger butonu */
.hamburger-btn {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 18px; height: 13px;
  background: transparent; border: none;
  cursor: pointer; padding: 6px; box-sizing: content-box;
  border-radius: 6px; flex-shrink: 0;
}
.hamburger-btn span {
  display: block; height: 2px;
  background: var(--info); border-radius: 1px;
  transition: transform .15s, opacity .15s;
}
.hamburger-btn.open span:nth-child(1) { transform: rotate(45deg) translate(4px,4px); }
.hamburger-btn.open span:nth-child(2) { opacity: 0; }
.hamburger-btn.open span:nth-child(3) { transform: rotate(-45deg) translate(4px,-4px); }

/* Menü dropdown */
.ham-menu {
  position: absolute; top: 52px; left: 0; z-index: 200;
  background: var(--bg4); border: 1px solid var(--border2);
  border-radius: 10px; padding: 10px; min-width: 200px;
  box-shadow: 0 8px 24px rgba(0,0,0,.5);
}
.ham-menu-row {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 6px; border-radius: 6px; cursor: pointer;
  font-size: 13px; color: var(--text2);
  transition: background .1s, color .1s;
}
.ham-menu-row:hover { background: var(--bg3); color: var(--text); }
.ham-menu-row.danger { color: var(--err); }
.ham-menu-row.danger:hover { background: rgba(255,51,102,.08); }
```

### 7. Ayarlar Tab Referansları

`tab==="settings"` ile yapılan diğer kontroller güncellenir:
- FAB `style`: `tab==="settings"` → `tab==="rehber"` (FAB Rehber'de de gizlenir).
- Settings tab render bloğu (`{tab==="settings"&&...}`) korunur — hamburger'dan erişilir.

---

## Kapsam Dışı

- `Investment-Guide.md` içeriğinin render edilmesi — ROADMAP "Öğrenme & Eğitim" kapsamında, sonraki sprint.
- Portföy switcher veya başka öğelerin hamburgere taşınması.
- Hamburger menüsünde bildirim / badge gösterimi.

---

## Etkilenen Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `src/components/App.js` | TABS, hamburger state+render, dropdown panel, RehberTab placeholder, FAB kural |
| `src/utils.js` | `NAV_ICONS.rehber` eklenir |
| `index.html` | `.hamburger-btn`, `.ham-menu`, `.ham-menu-row` CSS sınıfları |
