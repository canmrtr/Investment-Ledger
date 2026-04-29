# Design Handoff: Investment Ledger Redesign

## Genel Bakış

Bu paket, mevcut `index.html` uygulamasının görsel tasarımını yenilemek için hazırlanmıştır. Tüm iş mantığı, Supabase bağlantısı, XIRR hesabı, tooltip'ler, split ayarlamaları, AI parse özelliği ve fundamental checklist **değiştirilmeyecektir** — yalnızca CSS ve layout güncellenmektedir.

## Bu Dosyalar Hakkında

`design_handoff/` klasöründeki HTML dosyaları **tasarım referanslarıdır** — production'a alınacak kod değil. Görev: bu referanslardaki görsel sistemi mevcut `index.html` dosyasına uygulamak. React component'leri, state yönetimi ve Supabase logic'i aynen korunacak; CSS tokenları, layout ve navigasyon güncellenecek.

## Fidelity

**High-fidelity** — Renk, tipografi, spacing ve etkileşimler piksel düzeyinde uygulanmalıdır. Referans dosyaları inceleyerek tam uyum sağlanmalıdır.

---

## Değiştirilecek Şeyler (Sıralı)

### 1. Başlamadan Önce — Kullanıcıya Sor

Aşağıdaki her adım için kullanıcıya onay aldıktan sonra ilerle:

1. CSS token'larını güncelliyorum, onaylar mısınız?
2. Fontları DM Sans + DM Mono olarak değiştiriyorum, onaylar mısınız?
3. Navigasyonu top navbar (masaüstü) + bottom tab bar (mobil) olarak yeniliyorum, onaylar mısınız?
4. Dashboard layout'unu güncelliyorum (grafik üstte, tablo altta), onaylar mısınız?
5. Component stillerini (buton, kart, badge, input, tablo) güncelliyorum, onaylar mısınız?

---

## 1. Design Tokens — CSS Değişkenleri

Mevcut `:root` bloğunu tamamen aşağıdakiyle değiştir:

```css
:root {
  --bg:       #000000;
  --bg2:      #0c0c0c;
  --bg3:      #141414;
  --bg4:      #1c1c1c;
  --border:   rgba(255,255,255,0.06);
  --border2:  rgba(102,88,255,0.28);
  --text:     #f0ede8;
  --text2:    #666666;
  --text3:    #333333;
  --ok:       #00d97e;
  --err:      #ff3366;
  --info:     #6658ff;
  --warn:     #ffb800;
  --r:        10px;
  --rl:       16px;
}
```

`@media(prefers-color-scheme:light)` bloğunu kaldır — bu uygulama yalnızca dark theme kullanacak.

---

## 2. Tipografi — Font Değişikliği

### `<head>` içine ekle:
```html
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
```

### CSS değişiklikleri:
```css
/* ÖNCE */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
}

/* SONRA */
body {
  font-family: 'DM Sans', sans-serif;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
}
```

Tüm `.mono` sınıfı ve `font-family:'SF Mono','Fira Code',monospace` kullanımlarını aşağıdakiyle değiştir:
```css
font-family: 'DM Mono', 'Fira Code', monospace;
```

CSS'teki tüm `font-family` tanımlarında `-apple-system, BlinkMacSystemFont` referanslarını `'DM Sans', sans-serif` olarak değiştir.

---

## 3. Navigasyon — Tam Değişiklik

Mevcut navigasyon yapısı **yoktur** (sadece `.tabs` sınıfıyla tab'lar var). Yeni yapı şu şekilde olacak:

### Masaüstü: Top Navbar

```
┌─────────────────────────────────────────────────────────┐
│ [IL] Investment Ledger  Dashboard  Portföy  İşlemler  Analiz  ···  [+ Ekle] │
└─────────────────────────────────────────────────────────┘
│                    İçerik alanı                         │
```

#### HTML yapısı (mevcut `#app` div'ini şu şekilde sar):

```html
<div id="shell">
  <header id="topbar">
    <div class="topbar-left">
      <div class="logo-mark">IL</div>
      <span class="logo-text">Investment Ledger</span>
    </div>
    <nav class="topbar-nav">
      <!-- Tab butonları buraya gelecek (JS ile render edilecek) -->
    </nav>
    <div class="topbar-right">
      <button class="btn-refresh">↻ Güncelle</button>
      <button class="btn-add-primary">+ İşlem Ekle</button>
    </div>
  </header>
  <main id="app-main">
    <!-- Mevcut #app içeriği buraya taşınır -->
  </main>
</div>
```

#### CSS:

```css
#shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

#topbar {
  height: 52px;
  background: rgba(0,0,0,0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-right: 28px;
}

.logo-mark {
  width: 28px;
  height: 28px;
  background: var(--info);
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.03em;
  flex-shrink: 0;
}

.logo-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  letter-spacing: -0.02em;
}

.topbar-nav {
  display: flex;
  align-items: stretch;
  height: 52px;
  flex: 1;
}

.topbar-nav .tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  height: 100%;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text2);
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 400;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.12s, border-color 0.12s;
  margin-bottom: -1px;
}

.topbar-nav .tab:hover {
  color: var(--text);
}

.topbar-nav .tab.on {
  color: var(--info);
  border-bottom-color: var(--info);
  font-weight: 500;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

#app-main {
  flex: 1;
  max-width: 920px;
  margin: 0 auto;
  padding: 24px 20px 60px;
  width: 100%;
}
```

**Mevcut `.tabs` ve `.tab` sınıflarını kaldır** — yerine yukarıdaki `topbar-nav` gelecek.

---

### Mobil: Bottom Tab Bar

`max-width: 640px` altında top navbar'daki nav linkleri gizlenip bottom tab bar aktif olacak:

```css
@media (max-width: 640px) {
  .topbar-nav { display: none; }
  .logo-text  { display: none; }
  #app-main   { padding: 16px 12px 80px; }

  #bottom-tabs {
    display: flex;
  }
}

#bottom-tabs {
  display: none;
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: 60px;
  background: var(--bg2);
  border-top: 1px solid var(--border);
  z-index: 100;
}

#bottom-tabs .btab {
  flex: 1;
  height: 100%;
  background: transparent;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  color: var(--text2);
  font-family: 'DM Sans', sans-serif;
  font-size: 9px;
  font-weight: 400;
  transition: color 0.12s;
}

#bottom-tabs .btab.on {
  color: var(--info);
  font-weight: 500;
}

#bottom-tabs .btab svg {
  opacity: 0.7;
}

#bottom-tabs .btab.on svg {
  opacity: 1;
}
```

Bottom tabs HTML'i `</body>` kapanış etiketinin hemen üstüne ekle:

```html
<div id="bottom-tabs">
  <!-- JS ile mevcut tab state'i ile sync edilecek -->
  <!-- Her sekme için bir .btab butonu -->
</div>
```

**JS tarafında:** Mevcut tab değiştirme logic'ine `#bottom-tabs` butonlarını da dahil et. Active tab değiştiğinde hem `.tab.on` hem `.btab.on` class'larını güncelle.

---

## 4. Dashboard Layout — Grafik Üstte, Tablo Altta

Mevcut dashboard tab'ında KPI kartları + tablo mevcut. Yeni sıralama:

```
[KPI Kartları x4]
[Sparkline Chart (geniş)] [Pie Chart (dar)]
[Pozisyonlar Tablosu — tam genişlik]
```

#### CSS grid düzeni:

```css
/* Grafik satırı */
.dashboard-charts {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 12px;
  margin-bottom: 16px;
}

@media (max-width: 640px) {
  .dashboard-charts {
    grid-template-columns: 1fr;
  }
}
```

Mevcut `SparkChart` ve dağılım (allocation) bölümlerini `.dashboard-charts` wrapper'a al. Pozisyon tablosunu bu wrapper'ın altına taşı.

---

## 5. Component Stilleri

### Kartlar `.card`

```css
.card {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--rl);
  overflow: hidden;
}

.card:hover {
  border-color: var(--border2);
  transition: border-color 0.15s;
}
```

### Butonlar

```css
/* Primary */
button.pri {
  background: var(--info);
  border: none;
  border-radius: var(--r);
  color: #fff;
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  font-weight: 500;
  padding: 8px 16px;
  cursor: pointer;
  transition: opacity 0.12s;
}
button.pri:hover:not(:disabled) { opacity: 0.82; }

/* Ghost */
button:not(.pri):not(.danger) {
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: var(--r);
  color: var(--text);
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  font-weight: 400;
  padding: 7px 14px;
  cursor: pointer;
  transition: opacity 0.12s;
}

/* Danger */
button.danger {
  background: transparent;
  border: 1px solid rgba(255,51,102,0.25);
  border-radius: var(--r);
  color: var(--err);
  font-family: 'DM Sans', sans-serif;
  font-size: 12px;
  font-weight: 400;
  padding: 7px 14px;
  cursor: pointer;
}
```

### Tablo

```css
th {
  font-size: 10px;
  font-weight: 500;
  color: var(--text3);
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}

tbody tr {
  transition: background 0.1s;
  cursor: pointer;
}

tbody tr:hover {
  background: var(--bg3);
}
```

### Badges

```css
.badge {
  display: inline-flex;
  align-items: center;
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  font-weight: 500;
  padding: 3px 7px;
  border-radius: 6px;
  letter-spacing: 0.05em;
  border: 1px solid transparent;
}

.badge.etf  { background: rgba(102,88,255,0.12); color: var(--info);  border-color: rgba(102,88,255,0.28); }
.badge.cry  { background: rgba(255,184,0,0.10);  color: var(--warn);  border-color: rgba(255,184,0,0.20); }
.badge.split{ background: rgba(255,184,0,0.10);  color: var(--warn);  border-color: rgba(255,184,0,0.20); }
```

### Input / Select

```css
input, textarea, select {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--r);
  color: var(--text);
  font-family: 'DM Sans', sans-serif;
  font-size: 13px;
  font-weight: 400;
  padding: 10px 13px;
  width: 100%;
  outline: none;
  transition: border-color 0.15s;
}

input:focus, textarea:focus, select:focus {
  border-color: var(--info);
}

input::placeholder, textarea::placeholder {
  color: var(--text3);
}
```

### Modal

```css
.mdl-bd {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: rgba(0,0,0,0.7);
}

.mdl-bx {
  background: var(--bg2);
  border: 1px solid var(--border2);
  border-radius: var(--rl);
  box-shadow: 0 30px 80px rgba(0,0,0,0.6);
}
```

### Login kutusu

```css
.login-box {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--rl);
}

.login-logo {
  /* Emoji yerine metin logo mark */
  width: 40px;
  height: 40px;
  background: var(--info);
  border-radius: var(--r);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 800;
  color: #fff;
  margin: 0 auto 16px;
  /* İçine "IL" yaz, emoji kaldır */
}
```

---

## 6. Korunacaklar — Dokunma

Aşağıdakilere **kesinlikle dokunma:**

- Supabase client ve tüm `sb.from(...)` çağrıları
- `rebuildPositions()` fonksiyonu
- `xirr()` ve `buildCashflows()` hesaplamaları
- `edgeCall()` ve tüm edge function çağrıları
- Tüm `[data-tip]` tooltip attribute'ları ve CSS'i
- `LS.get/set` localStorage cache logic'i
- `metaCacheGet/Set`, `fundCacheGet/Set`
- `TickerDetailTab` component'i (fundamental checklist dahil)
- CSV import logic'i
- Split (stock split) hesaplamaları
- `CFG` config objesi
- Tüm React state ve effect hook'ları
- `TYPE_COLORS` objesi

---

## 7. Referans Dosyalar

| Dosya | İçerik |
|-------|--------|
| `Investment Ledger Redesign.html` | Ana redesign — tüm ekranlar |
| `Nav Alternatifleri.html` | Nav seçenekleri (masaüstü C + mobil M1 seçildi) |
| `Investment Ledger Design System.html` | Renk/tipo/komponent referansı |

---

## Uygulama Sırası

1. `:root` token'larını güncelle → test et
2. Font import'larını ekle, `font-family` değerlerini güncelle → test et
3. Top navbar HTML + CSS ekle, eski `.tabs` kaldır → test et
4. Bottom tab bar ekle, JS sync'i yap → mobilde test et
5. Dashboard layout'unu düzenle → test et
6. Component stillerini uygula (kart, buton, tablo, badge, input) → test et
7. Login ekranını güncelle → test et
