# Handoff: Investment Ledger — Analytics Page

## Overview
Analytics sayfası, kullanıcının yatırım portföyünü dört temel boyutta analiz etmesini sağlar: varlık dağılımı (drilldown destekli), kazanan/kaybeden işlem oranı, ödenen komisyon gideri ve coğrafi bölge dağılımı.

## About the Design Files
Bu klasördeki HTML dosyaları **tasarım referansı** olarak üretilmiş prototiplerdir — doğrudan production'a alınacak kod değildir. Geliştirici görevi, bu HTML tasarımlarını mevcut codebase'in ortamında (React, Next.js, vb.) kurulmuş pattern ve kütüphaneleri kullanarak birebir yeniden oluşturmaktır.

## Fidelity
**High-fidelity (hifi)** — Tüm renkler, tipografi, spacing ve etkileşimler finaldir. Mevcut design system token'ları ile pixel-perfect olarak uygulanmalıdır.

---

## Design Tokens

### Renkler
```
--bg:      #000000          (sayfa arkaplanı)
--s1:      #0c0c0c          (card yüzeyi)
--s2:      #141414          (raised / hover yüzeyi)
--s3:      #1c1c1c          (progress bar track)
--bd:      rgba(255,255,255,0.06)   (border)
--bd2:     rgba(102,88,255,0.28)    (accent border)
--tx:      #f0ede8          (birincil metin)
--tx2:     #666666          (ikincil metin)
--tx3:     #333333          (3. seviye metin / placeholder)
--ac:      #6658ff          (indigo accent)
--ac-dim:  rgba(102,88,255,0.12)    (accent arka plan)
--ok:      #00d97e          (yeşil / kazanan)
--err:     #ff3366          (kırmızı / kaybeden)
--warn:    #ffb800          (sarı / komisyon)
```

### Varlık Renkleri (Pie Chart)
```
US Hisse:  #6658ff
BIST:      #00d97e
Kripto:    #ffb800
Fon/ETF:   #ff6b9d
Tahvil:    #4ec9e8
```

### Bölge Renkleri
```
Kuzey Amerika: #6658ff
Türkiye:       #00d97e
Global/ETF:    #4ec9e8
Kripto:        #ffb800
Avrupa:        #ff6b9d
```

### Tipografi
```
Font ailesi:  'DM Sans' (body), 'DM Mono' (sayılar / mono değerler)
Ağırlıklar:   300, 400, 500, 600, 700
```

### Border Radius
```
--r-sm: 6px
--r-md: 10px
--r-lg: 16px
```

---

## Layout

### Genel Yapı
- **Sidebar** (fixed, 220px genişlik) + **Main** (margin-left: 220px)
- **Topbar** (sticky, 52px yükseklik, backdrop-filter: blur(12px))
- **Content** max-width: 1060px, padding: 28px

### Grid Sistemi
- KPI satırı: `grid-template-columns: repeat(4, 1fr)`, gap: 12px
- Alt satırlar: `grid-template-columns: 1fr 1fr`, gap: 16px

---

## Screens / Views

### 1. KPI Strip (4 kart)
Topbar'ın hemen altında, tam genişlik, 4 eşit sütun.

| Alan | Değer |
|---|---|
| Background | `--s1` |
| Border | `1px solid --bd` |
| Border-radius | `--r-lg` (16px) |
| Padding | 18px 20px |
| Hover | border-color → `--bd2` |

Her kartta:
- **Label**: 10px, font-weight 500, `--tx2`, uppercase, letter-spacing .08em
- **Value**: DM Mono, 22px, font-weight 500, letter-spacing -0.02em
- **Sub**: 11px, `--tx2`, margin-top 6px

Renk varyantları:
- Default: `--tx`
- Pozitif: `--ok`
- Negatif: `--err`
- Accent: `--ac`

---

### 2. Varlık Dağılımı (Pie Chart + Drilldown)

**Kart boyutu**: Grid'in sol yarısı (1/2)  
**Card header**: padding 16px 20px, border-bottom 1px solid `--bd`  
  - Sol: başlık (13px, font-weight 600) + alt başlık (11px, `--tx2`)  
  - Sağ: drilldown aktifken "← Genel" ghost button

**Asset type pills** (sadece genel görünümde):
- Küçük rounded pills (border-radius: 99px), 11px
- Her pill kendi varlık rengiyle border ve text rengi alır (opacity 0.27 alpha border)
- Tıklanınca drilldown moda geçilir

**Pie Chart (SVG Donut)**:
- Boyut: 170×170px
- Dış yarıçap: ~79px, iç yarıçap: 58px (donut deliği)
- Hover'da diğer dilimler opacity: 0.35'e düşer, aktif dilim tam opak kalır
- Donut merkezi: `--s1` rengi daire
- Merkez label:
  - Hover'da: yüzde (15px DM Mono) + varlık adı (9px DM Sans) + değer (9px DM Mono, `--tx2`)
  - Hover yokken: "Dağılım" + "HOVERla"

**Legend** (pie'ın sağında, flex-column):
- Her satır: 8px renkli kare dot + label (12px `--tx`) + değer (11px DM Mono `--tx2`) + yüzde (12px DM Mono `--tx`)
- Hover satır: background `--s2`
- Legend satırına hover pie'daki dilimi de vurgular (bidirectional)

**Drilldown mantığı**: Varlık tipine tıklayınca o tipin alt kırılımı gösterilir. Renk paleti breakdown'da farklı: `['#6658ff','#a855f7','#4ec9e8','#00d97e','#ffb800']`

---

### 3. Kazanan / Kaybeden İşlemler

**Kart boyutu**: Grid'in sağ yarısı (1/2)

**Üst istatistik satırı** (flex, space-between, dikey separator `--bd`):
- Win Rate: 28px DM Mono, `--ok`
- Kazanan sayısı: 28px DM Mono, `--ok`
- Kaybeden sayısı: 28px DM Mono, `--err`
- Toplam: 28px DM Mono, `--tx`
- Her bloğun altında: 10px uppercase label, `--tx2`

**Kompozit progress bar**:
- Yükseklik: 10px, border-radius: 99px
- Yeşil segment (`--ok`) + kırmızı segment (`--err`) yan yana, CSS width transition .5s

**Aylık bar chart** (grid 12 sütun, hizalama: flex-end, yükseklik: 80px):
- Her ay: yeşil bar (kazanan) + kırmızı bar (kaybeden) dikey yığılı
- Bar yüksekliği: o ayın değeri / max değer × 64px
- Yeşil opacity .7, kırmızı opacity .5
- Altında 3 harfli ay etiketi (8px, `--tx3`, uppercase)

---

### 4. Ödenen Komisyon

**Kart boyutu**: Grid'in sol yarısı (1/2)

- **Toplam değer**: DM Mono, 32px, `--warn`, margin-bottom 4px
- **Alt açıklama**: 11px, `--tx2` (işlem başı ort. komisyon)

**Satır listesi** (her varlık tipi için):
- Label: 12px `--tx`
- İşlem sayısı: 11px `--tx2`, text-align right
- Tutar: DM Mono 12px `--warn`, text-align right
- Progress bar: 3px yükseklik, `--s3` track, `--warn` fill opacity .6
  - Genişlik = o satırın değeri / max değer × 100%
- Satırlar arası: `border-bottom: 1px solid --bd`

---

### 5. Bölge Dağılımı

**Kart boyutu**: Grid'in sağ yarısı (1/2)

**Satır listesi** (harita yok):
- Her bölge için bir satır
- Sol: 8px renkli kare dot + bölge adı (12px `--tx`)
- Sağ: değer (11px DM Mono `--tx2`) + yüzde (12px DM Mono `--tx`)
- Altında: 3px yükseklik progress bar, bölge rengiyle opacity .7 fill
- Genişlik = bölge yüzdesi / 100 × %100

---

## Interactions & Behavior

| Etkileşim | Davranış |
|---|---|
| Period pill seçimi | Topbar'daki dönem butonları toggle, seçili → `--ac-dim` bg + `--bd2` border + `--ac` renk |
| Pie dilim hover | Diğer dilimler soluklaşır, merkez label güncellenir |
| Legend satır hover | İlgili pie dilimi vurgulanır (bidirectional) |
| Asset pill tıklama | Drilldown moda geç, pills gizlenir, "← Genel" butonu belirir |
| "← Genel" tıklama | Drilldown kapanır, genel görünüme dön |
| KPI kart hover | Border rengi `--bd2`'ye geçer (transition .15s) |
| Nav item hover | background `--s2`, color `--tx` |
| Nav item active | background `--ac-dim`, color `--ac`, font-weight 500 |

### Transition değerleri
- Border color: `.15s ease`
- Opacity (pie): `.2s ease`
- Bar widths: `.4s–.5s ease`
- Nav bg/color: `.12s`

---

## State

```ts
period: '1A' | '3A' | '6A' | 'YTD' | '1Y' | 'Tümü'  // seçili dönem
assetFilter: string | null  // null = genel pie, string = drilldown
pieHoveredIdx: number | null  // hover'daki pie dilimi index'i
```

---

## Veri Yapısı (Mock → Gerçek API)

```ts
// Genel varlık dağılımı
type AssetSlice = { label: string; pct: number; val: number }

// Drilldown kırılımı (varlık tipine göre)
type BreakdownMap = Record<string, AssetSlice[]>

// Aylık kazanan/kaybeden
type MonthlyTrade = { month: string; win: number; loss: number }

// Komisyon (varlık tipine göre)
type CommissionRow = { label: string; trades: number; amount: number }

// Bölge dağılımı
type RegionRow = { label: string; pct: number; val: number; color: string }
```

---

## Dosyalar

| Dosya | İçerik |
|---|---|
| `Analytics.html` | Tam sayfa prototipi (React/Babel, inline) |
| `Investment Ledger Redesign.html` | Ana portföy sayfası, sidebar + tüm CSS token'ları |
| `Investment Ledger Design System.html` | Üç tema tanımı (Classic, Void, Hybrid) |

---

## Notlar
- Aktif tema: **Hybrid** (siyah zemin + indigo accent + DM Sans/DM Mono)
- Sidebar ve topbar `Investment Ledger Redesign.html` ile aynı component — yeniden kullanılabilir
- Responsive: 760px altında sidebar gizlenir, grid tek sütuna düşer, KPI 2×2 olur
