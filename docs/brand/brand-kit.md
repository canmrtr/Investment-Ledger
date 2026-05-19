# PORTFOI — Brand Kit
> Machine-readable brand specification for Claude Code.
> Apply these tokens consistently across all UI components, screens, and assets.

---

## 1. Identity

```
APP_NAME        = Portfoi
TAGLINE         = "Portföyün, cebinde."
TAGLINE_EN      = "Your portfolio, in your pocket."
MISSION         = "Paranın nerede olduğunu görmek isteyen herkes için yapıldı. Uzman olman gerekmiyor — meraklı olman yeterli."
DOMAIN          = portfoi.com
CATEGORY        = Fintech / Investment Tracker
TONE            = Intelligent Simplicity — clear, grounded, empowering
```

---

## 2. Color Tokens

Replace all existing `#6366F1` (purple) accent values with `#C9A84C` (Portfoi Gold).

```css
/* === PORTFOI COLOR TOKENS === */

/* Backgrounds */
--color-bg-primary:     #0D1117;   /* Midnight — main background */
--color-bg-card:        #1A1F2E;   /* Surface Dark — card background */
--color-bg-light:       #E8F4F8;   /* Arctic — light mode surface */

/* Accent */
--color-accent:         #C9A84C;   /* Portfoi Gold — FAB, active tab, CTA, border highlight */
--color-accent-muted:   #8A6A1F;   /* Gold Muted — pressed state, secondary icon fill */

/* Text */
--color-text-primary:   #F5F3EE;   /* Near white — primary text on dark */
--color-text-secondary: #6B7280;   /* Slate — secondary text, inactive icons, borders */

/* Semantic */
--color-positive:       #22C55E;   /* Signal Green — gain, increase, positive delta */
--color-negative:       #EF4444;   /* Signal Red — loss, decrease, negative delta */
```

### Migration: Purple → Gold

```
FIND    #6366F1   →   REPLACE   #C9A84C   (primary accent)
FIND    #4F46E5   →   REPLACE   #8A6A1F   (pressed/muted accent)
FIND    #818CF8   →   REPLACE   #C9A84C   (light accent variant)
```

---

## 3. Typography

```css
/* === PORTFOI TYPE TOKENS === */

/* Import */
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap');

/* Font families */
--font-display:  'DM Serif Display', serif;   /* Headings, hero numbers, page titles */
--font-body:     'DM Sans', sans-serif;        /* UI text, labels, buttons, body copy */
--font-numeric:  'DM Mono', monospace;         /* All numbers: prices, % changes, tickers */

/* Scale */
--text-hero:     32px / 500 / --font-display;  /* e.g. $191,764.21 on dashboard */
--text-h1:       24px / 400 / --font-display;  /* Screen titles */
--text-h2:       18px / 500 / --font-body;     /* Section headers */
--text-body:     14px / 400 / --font-body;     /* Default UI text */
--text-label:    12px / 500 / --font-body;     /* Caps labels, tab items */
--text-numeric:  14px / 500 / --font-numeric;  /* Prices, percentages, tickers */
--text-mono-sm:  12px / 400 / --font-numeric;  /* Table cells, small data */
```

### Usage Rules

```
- Dashboard portfolio value ($191,764.21)  → --font-display + --text-hero
- Screen titles (PIYASA DEĞERİ, ANALİZ)   → --font-body + --text-label (uppercase)
- All % values (+74.1%, -0.4%)             → --font-numeric + --color-positive/negative
- All price values ($100,000, 325.00)      → --font-numeric
- Ticker symbols (XAU, NVDA, SPY)          → --font-numeric + --text-mono-sm
- Tab bar labels                           → --font-body + --text-label
- Card body text                           → --font-body + --text-body
```

---

## 4. Component Tokens

```css
/* FAB Button */
--fab-bg:             var(--color-accent);
--fab-size:           56px;
--fab-border-radius:  28px;
--fab-icon-color:     #0D1117;

/* Tab Bar */
--tab-active-color:   var(--color-accent);
--tab-inactive-color: var(--color-text-secondary);
--tab-bg:             var(--color-bg-primary);

/* Cards */
--card-bg:            var(--color-bg-card);
--card-border:        1px solid rgba(201, 168, 76, 0.12);  /* subtle gold border */
--card-radius:        12px;
--card-padding:       16px;

/* Search Bar */
--search-border:      var(--color-accent);
--search-bg:          var(--color-bg-card);
--search-text:        var(--color-text-primary);

/* Delta Badges (+ / - values) */
--badge-positive-bg:  rgba(34, 197, 94, 0.15);
--badge-positive-text: var(--color-positive);
--badge-negative-bg:  rgba(239, 68, 68, 0.15);
--badge-negative-text: var(--color-negative);
```

---

## 5. Brand Voice

```
ADJECTIVES      = Clear, Grounded, Empowering
LANGUAGE        = Turkish (primary), English (secondary)
TONE_DO         = Simple language, direct sentences, no jargon
TONE_DONT       = No "synergy", no "leverage", no Wall Street terminology
COPY_EXAMPLE    = "Portföyünü gör. Anla. Büyüt." (not "Maximize your alpha")
```

---

## 6. Apply Checklist (for Claude Code)

```
[x] Replace all purple hex values with Gold tokens — no #6366F1/#4F46E5/#818CF8 existed; TYPE_COLORS + AnalysisTab updated to brand-kit palette
[x] Import DM font family via Google Fonts — already in index.html at load time
[x] Apply --font-numeric to all price and percentage text elements — App.js + AnalysisTab.js updated (25 occurrences)
[x] Apply --font-display to dashboard hero number — App.js line 636 updated
[x] Update FAB background to --color-accent (#C9A84C) — already var(--info) = #C9A84C; --fab-bg token added to tokens.css
[x] Update active tab color to --color-accent (#C9A84C) — already rgba(201,168,76,…) + var(--info) via CSS class
[x] Update card borders to gold-tinted rgba border — already rgba(201,168,76,0.12) in .card; --card-border token added to tokens.css
[x] Apply delta badge tokens to all +/- percentage displays — tokens defined in tokens.css; .delta-pos/.delta-neg classes in index.html
[x] Remove any remaining #6366F1 or purple variants — none existed; TYPE_COLORS/REGION_META updated to brand-kit
[x] Update app name references from placeholder to "Portfoi" — already "Portfoi" in index.html title & meta
[x] Update domain references to portfoi.com — portfoi-brand-kit.md DOMAIN = portfoi.com; app deployed on GitHub Pages
```

---

## 7. Theme Specifications

### Dark theme (default)
```
--theme-bg:           #0D1117;   /* Midnight */
--theme-wordmark:     #F5F3EE;   /* Near white */
--theme-tagline:      #C9A84C;   /* Portfoi Gold */
--theme-icon-bars:    #C9A84C;   /* Portfoi Gold, with opacity fade */
--theme-icon-frame:   #C9A84C;   /* Portfoi Gold */
```

### Light theme
```
--theme-bg:           #F5F3EE;   /* Arctic */
--theme-wordmark:     #0D1117;   /* Midnight */
--theme-tagline:      #8A6A1F;   /* Gold Muted */
--theme-icon-bars:    #C9A84C;   /* Portfoi Gold, with opacity fade */
--theme-icon-frame:   #C9A84C;   /* Portfoi Gold */
```

### Notes
- Icon bars always stay Gold (#C9A84C) in both themes — only opacity fade changes
- Frame border always stays Gold (#C9A84C) in both themes
- Never use pure black (#000000) or pure white (#FFFFFF)
- Light theme background is Arctic (#F5F3EE), not white

---

## 8. Asset Category Colors

Each investment category has a dedicated color. These are used consistently across charts, tables, badges, and distribution bars throughout the app.

```css
/* === PORTFOI CATEGORY COLORS === */

--category-etf:        #3B82F6;   /* ETF / Fon — Blue, trust & broad market */
--category-gold:       #C9A84C;   /* Altın — Portfoi Gold, natural fit */
--category-us-stock:   #8B5CF6;   /* US Hisse — Purple, premium market */
--category-bist:       #F97316;   /* BIST — Orange, Turkey, warmth */
--category-crypto:     #06B6D4;   /* Kripto — Cyan, digital & modern */
--category-fx:         #10B981;   /* Döviz — Teal, forex convention */
--category-commodity:  #D97706;   /* Emtia — Amber, raw materials & nature */
```

### Critical Rule
```
Signal Green (#22C55E) and Signal Red (#EF4444) are RESERVED for:
  - Positive/negative delta values (+%12.6, -%3.2)
  - Gain/loss indicators
  - Performance badges

NEVER use Signal Green or Signal Red as category colors.
Category colors and semantic colors must never overlap.
```

### Usage Examples
```
- Varlık dağılımı bar chart  → category colors per segment
- Bölge dağılımı             → category colors per region
- Watchlist row indicator    → category color dot on left
- Portfolio breakdown table  → category color swatch
- Asset type badge           → category color background at 15% opacity, full color text
```

### Badge Token (per category)
```css
/* Example for ETF */
--badge-etf-bg:    rgba(59, 130, 246, 0.15);
--badge-etf-text:  #3B82F6;

/* Apply same pattern for all categories */
```

---

## 9. Extended Palette (Spot Palette Update)

Based on ColorSpace Spot Palette derived from Portfoi Gold (#C9A84C).
These colors extend the core palette with richer depth and warmth.

```css
/* === EXTENDED COLOR TOKENS === */

/* Updated tokens */
--color-accent-muted:   #897544;   /* Gold Muted — updated from #8A6A1F, warmer tone */

/* New tokens */
--color-teal:           #005B4D;   /* Deep Teal — secondary backgrounds, card accents, section dividers */
--color-cream:          #FFEFCA;   /* Cream — highlight backgrounds, light surface accent, warm glow */
```

### Usage Guidelines

```
--color-teal:
  - Secondary card backgrounds (alternative to Surface Dark)
  - Section dividers or accent borders
  - Active state backgrounds (tabs, selected rows)
  - Chart background panels

--color-cream:
  - Highlighted metric cards (e.g. top performer)
  - Warm glow behind Gold accent elements
  - Light mode surface alternative to Arctic
  - Toast/notification backgrounds

--color-accent-muted (#897544):
  - Replaces previous #8A6A1F everywhere
  - Pressed states, secondary icon fills, tagline on light bg
```

### Full Updated Core Palette

```
#0D1117   Midnight      Primary background
#1A1F2E   Surface Dark  Card background
#005B4D   Deep Teal     Secondary background / accent surface
#C9A84C   Portfoi Gold  Primary accent
#897544   Gold Muted    Secondary accent / pressed state
#FFEFCA   Cream         Warm highlight surface
#E8F4F8   Arctic        Light mode background
#F5F3EE   Near White    Primary text on dark / light mode bg
#6B7280   Slate         Secondary text / inactive icons
#22C55E   Signal Green  Gain / positive delta
#EF4444   Signal Red    Loss / negative delta
```
