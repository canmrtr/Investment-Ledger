# Brand Kit Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Portfoi brand kit (`portfoi-brand-kit.md`) by creating a central `tokens.css`, wiring it into `index.html`, and replacing all hardcoded color/font values in JS components with CSS custom properties.

**Architecture:** A new `src/styles/tokens.css` holds all brand-kit CSS custom properties (category colors, component tokens, extended palette). Existing inline `<style>` in `index.html` keeps its current tokens unchanged; `tokens.css` adds the brand-kit layer on top. JS files reference hardcoded hex values that are updated to match the new CSS variable values; components switch from hardcoded `fontFamily` strings to `var(--font-*)` references.

**Tech Stack:** Vanilla JS, React 18 UMD + Babel Standalone, CSS custom properties, Google Fonts (already loaded). Babel parse check: `npm run check:babel`.

---

## File Map

| Action | File | What changes |
|--------|------|--------------|
| Create | `src/styles/tokens.css` | All brand-kit CSS custom properties |
| Modify | `index.html` | Add `<link>` for tokens.css (Google Fonts already present) |
| Modify | `src/constants.js` | `TYPE_COLORS` → brand-kit category hex values |
| Modify | `src/components/AnalysisTab.js` | `SECTOR_COLORS`, `TICKER_PIE_COLORS`, `REGION_META` colors + hardcoded `fontFamily` strings |
| Modify | `src/components/App.js` | 3 hardcoded `fontFamily` inline style strings |
| Modify | `portfoi-brand-kit.md` | Check off Apply Checklist items |

---

## Task 1: Create `src/styles/tokens.css`

**Files:**
- Create: `src/styles/tokens.css`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p /Users/canmerter/Documents/Claude/Investment-Ledger/src/styles
```

- [ ] **Step 2: Write `src/styles/tokens.css`**

```css
/* === PORTFOI BRAND KIT — CSS Custom Properties === */
/* Source of truth: portfoi-brand-kit.md             */

:root {
  /* --- Color Tokens (Section 2) --- */
  --color-bg-primary:     #0D1117;
  --color-bg-card:        #1A1F2E;
  --color-bg-light:       #E8F4F8;

  --color-accent:         #C9A84C;
  --color-accent-muted:   #897544;

  --color-text-primary:   #F5F3EE;
  --color-text-secondary: #6B7280;

  --color-positive:       #22C55E;
  --color-negative:       #EF4444;

  /* --- Extended Palette (Section 9) --- */
  --color-teal:           #005B4D;
  --color-cream:          #FFEFCA;

  /* --- Category Colors (Section 8) --- */
  --category-etf:         #3B82F6;
  --category-gold:        #C9A84C;
  --category-us-stock:    #8B5CF6;
  --category-bist:        #F97316;
  --category-crypto:      #06B6D4;
  --category-fx:          #10B981;
  --category-commodity:   #D97706;

  /* --- Category Badge Tokens (Section 8) --- */
  --badge-etf-bg:         rgba(59,  130, 246, 0.15);
  --badge-etf-text:       #3B82F6;
  --badge-gold-bg:        rgba(201, 168,  76, 0.15);
  --badge-gold-text:      #C9A84C;
  --badge-us-stock-bg:    rgba(139,  92, 246, 0.15);
  --badge-us-stock-text:  #8B5CF6;
  --badge-bist-bg:        rgba(249, 115,  22, 0.15);
  --badge-bist-text:      #F97316;
  --badge-crypto-bg:      rgba(  6, 182, 212, 0.15);
  --badge-crypto-text:    #06B6D4;
  --badge-fx-bg:          rgba( 16, 185, 129, 0.15);
  --badge-fx-text:        #10B981;
  --badge-commodity-bg:   rgba(217, 119,   6, 0.15);
  --badge-commodity-text: #D97706;

  /* --- Delta Badges (Section 4) --- */
  --badge-positive-bg:    rgba(34,  197,  94, 0.15);
  --badge-positive-text:  var(--color-positive);
  --badge-negative-bg:    rgba(239,  68,  68, 0.15);
  --badge-negative-text:  var(--color-negative);

  /* --- Component Tokens (Section 4) --- */
  --fab-bg:               var(--color-accent);
  --fab-size:             56px;
  --fab-border-radius:    28px;
  --fab-icon-color:       #0D1117;

  --tab-active-color:     var(--color-accent);
  --tab-inactive-color:   var(--color-text-secondary);
  --tab-bg:               var(--color-bg-primary);

  --card-bg:              var(--color-bg-card);
  --card-border:          1px solid rgba(201, 168, 76, 0.12);
  --card-radius:          12px;
  --card-padding:         16px;

  --search-border:        var(--color-accent);
  --search-bg:            var(--color-bg-card);
  --search-text:          var(--color-text-primary);
}

/* --- Light Theme Overrides (Section 7) --- */
[data-theme="light"] {
  --color-bg-primary:   #F5F3EE;
  --color-bg-card:      #E8E4DA;
  --color-text-primary: #0D1117;
  --color-accent:       #C9A84C;
  --color-accent-muted: #897544;
  --tab-bg:             #F5F3EE;
}
```

- [ ] **Step 3: Verify file written correctly**

```bash
head -10 src/styles/tokens.css
```

Expected: first line is `/* === PORTFOI BRAND KIT…`

- [ ] **Step 4: Commit**

```bash
git add src/styles/tokens.css
git commit -m "feat: add src/styles/tokens.css with brand kit CSS custom properties

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Wire `tokens.css` into `index.html`

**Files:**
- Modify: `index.html` (line 16, after Google Fonts `<link>`)

Note: Google Fonts (`DM Serif Display`, `DM Sans`, `DM Mono`) is **already imported** at lines 14–16 of `index.html`. Only the stylesheet link is needed.

- [ ] **Step 1: Add `<link>` after the Google Fonts line**

In `index.html`, find the existing Google Fonts link at line 16:
```html
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
```

Insert immediately after it (before `<style>`):
```html
  <link rel="stylesheet" href="src/styles/tokens.css"/>
```

- [ ] **Step 2: Verify order in index.html**

```bash
grep -n "googleapis\|tokens.css\|<style" index.html | head -6
```

Expected output order: googleapis line → tokens.css line → `<style>` line.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: link src/styles/tokens.css in index.html

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Update `TYPE_COLORS` in `src/constants.js`

**Files:**
- Modify: `src/constants.js` (lines 25–32)

Current values use old iOS-style system colors. Brand kit defines dedicated category colors. There are no `#6366F1 / #4F46E5 / #818CF8` purple values to replace (they were never in this codebase).

Mapping:
| Key | Old hex | New hex (brand-kit) | Brand kit var |
|-----|---------|---------------------|--------------|
| US_STOCK | `#30d158` | `#8B5CF6` | `--category-us-stock` |
| FUND | `#0a84ff` | `#3B82F6` | `--category-etf` |
| CRYPTO | `#ff9f0a` | `#06B6D4` | `--category-crypto` |
| BIST | `#bf5af2` | `#F97316` | `--category-bist` |
| GOLD | `#ffd60a` | `#C9A84C` | `--category-gold` |
| FX | `#8e8e93` | `#10B981` | `--category-fx` |

- [ ] **Step 1: Replace TYPE_COLORS block in `src/constants.js`**

Find:
```js
const TYPE_COLORS = {
  US_STOCK: "#30d158",  // yeşil (iOS system green)
  FUND:     "#0a84ff",  // mavi (iOS system blue)
  CRYPTO:   "#ff9f0a",  // turuncu
  BIST:     "#bf5af2",  // mor
  GOLD:     "#ffd60a",  // sarı
  FX:       "#8e8e93",  // gri
```

Replace with:
```js
const TYPE_COLORS = {
  US_STOCK: "#8B5CF6",  // brand kit: --category-us-stock
  FUND:     "#3B82F6",  // brand kit: --category-etf
  CRYPTO:   "#06B6D4",  // brand kit: --category-crypto
  BIST:     "#F97316",  // brand kit: --category-bist
  GOLD:     "#C9A84C",  // brand kit: --category-gold
  FX:       "#10B981",  // brand kit: --category-fx
```

- [ ] **Step 2: Run Babel parse check**

```bash
npm run check:babel
```

Expected: all files pass, no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add src/constants.js
git commit -m "feat: update TYPE_COLORS to brand kit category palette

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Update color arrays in `src/components/AnalysisTab.js`

**Files:**
- Modify: `src/components/AnalysisTab.js` (lines 189–219)

Three color collections need updating to align with the brand kit.

- [ ] **Step 1: Replace `SECTOR_COLORS` and `SECTOR_UNKNOWN_COLOR` (lines 189–193)**

Find:
```js
const SECTOR_COLORS = [
  "#30d158","#0a84ff","#ff9f0a","#bf5af2","#ffd60a",
  "#ff453a","#5e5ce6","#64d2ff","#ac8e68","#ff6b6b",
];
const SECTOR_UNKNOWN_COLOR = "#8e8e93";
```

Replace with:
```js
const SECTOR_COLORS = [
  "#8B5CF6","#3B82F6","#06B6D4","#F97316","#C9A84C",
  "#10B981","#D97706","#EF4444","#A78BFA","#60A5FA",
];
const SECTOR_UNKNOWN_COLOR = "#6B7280";
```

- [ ] **Step 2: Replace `TICKER_PIE_COLORS` (line 199)**

Find:
```js
const TICKER_PIE_COLORS = ["#30d158","#0a84ff","#ff9f0a","#bf5af2","#ffd60a","#ff453a","#5e5ce6","#64d2ff","#ac8e68","#7dd3fc","#a78bfa","#f472b6"];
```

Replace with:
```js
const TICKER_PIE_COLORS = ["#8B5CF6","#3B82F6","#06B6D4","#F97316","#C9A84C","#10B981","#D97706","#EF4444","#A78BFA","#60A5FA","#34D399","#FB923C"];
```

- [ ] **Step 3: Replace `REGION_META` colors (lines 209–219)**

Find:
```js
const REGION_META = {
  us:          { label: "US",                color: "#30d158" },
  tr:          { label: "Türkiye",            color: "#bf5af2" },
  eu:          { label: "Avrupa",             color: "#3B82F6" },
  "asia-pac":  { label: "Asya-Pasifik",       color: "#06B6D4" },
  em:          { label: "Gelişen Piyasalar",  color: "#D97706" },
  other:       { label: "Diğer",              color: "#6B7280" },
  crypto:      { label: "Global · Kripto",    color: "#ff9f0a" },
  emtia:       { label: "Global · Emtia",     color: "#ffd60a" },
  fx:          { label: "Döviz",              color: "#8e8e93" },
};
```

Replace with:
```js
const REGION_META = {
  us:          { label: "US",                color: "#8B5CF6" },
  tr:          { label: "Türkiye",            color: "#F97316" },
  eu:          { label: "Avrupa",             color: "#3B82F6" },
  "asia-pac":  { label: "Asya-Pasifik",       color: "#06B6D4" },
  em:          { label: "Gelişen Piyasalar",  color: "#D97706" },
  other:       { label: "Diğer",              color: "#6B7280" },
  crypto:      { label: "Global · Kripto",    color: "#06B6D4" },
  emtia:       { label: "Global · Emtia",     color: "#C9A84C" },
  fx:          { label: "Döviz",              color: "#10B981" },
};
```

- [ ] **Step 4: Run Babel parse check**

```bash
npm run check:babel
```

Expected: all files pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/AnalysisTab.js
git commit -m "feat: update AnalysisTab color palettes to brand kit category colors

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Replace hardcoded `fontFamily` strings with CSS variables

**Files:**
- Modify: `src/components/App.js` (3 locations)
- Modify: `src/components/AnalysisTab.js` (multiple locations — batch replace)

CSS variables `--font-display`, `--font-body`, `--font-numeric` are already defined in `index.html`'s `<style>` block at line 24. Inline React styles accept `var()` values directly.

### App.js — 3 locations

- [ ] **Step 1: Dashboard hero value (App.js line 636)**

Find:
```js
<div style={{fontSize:32,fontWeight:400,fontFamily:"'DM Serif Display',serif",letterSpacing:"-0.02em",lineHeight:1.1}}>{mask(dSym+fmt(tM))}</div>
```

Replace with:
```js
<div style={{fontSize:32,fontWeight:400,fontFamily:"var(--font-display)",letterSpacing:"-0.02em",lineHeight:1.1}}>{mask(dSym+fmt(tM))}</div>
```

- [ ] **Step 2: Block total value (App.js line 747)**

Find:
```js
{!hide&&<span style={{fontSize:15,fontWeight:500,fontFamily:"'DM Mono','Fira Code',monospace",color:"var(--text)"}}>{mask(cfg.sym+fmt(totMv,0))}</span>}
```

Replace with:
```js
{!hide&&<span style={{fontSize:15,fontWeight:500,fontFamily:"var(--font-numeric)",color:"var(--text)"}}>{mask(cfg.sym+fmt(totMv,0))}</span>}
```

- [ ] **Step 3: Debug pre block (App.js line 1112)**

Find:
```js
<pre style={{margin:0,fontSize:10,fontFamily:"'DM Mono',monospace",color:"var(--text2)",whiteSpace:"pre-wrap",wordBreak:"break-word",maxHeight:200,overflow:"auto"}}>{connTest.body}</pre>
```

Replace with:
```js
<pre style={{margin:0,fontSize:10,fontFamily:"var(--font-numeric)",color:"var(--text2)",whiteSpace:"pre-wrap",wordBreak:"break-word",maxHeight:200,overflow:"auto"}}>{connTest.body}</pre>
```

### AnalysisTab.js — batch replace

- [ ] **Step 4: Replace all `fontFamily:"DM Mono,monospace"` in AnalysisTab.js**

Use find-and-replace (all occurrences):
- Find: `fontFamily:"DM Mono,monospace"`
- Replace: `fontFamily:"var(--font-numeric)"`

Verify count before and after:
```bash
grep -c 'fontFamily:"DM Mono,monospace"' src/components/AnalysisTab.js
```

Expected: count > 0 before replace, 0 after.

- [ ] **Step 5: Replace remaining `fontFamily:"'DM Mono',monospace"` variants in AnalysisTab.js**

Use find-and-replace (all occurrences):
- Find: `fontFamily:"'DM Mono',monospace"`
- Replace: `fontFamily:"var(--font-numeric)"`

- [ ] **Step 6: Run Babel parse check**

```bash
npm run check:babel
```

Expected: all files pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/App.js src/components/AnalysisTab.js
git commit -m "feat: replace hardcoded fontFamily strings with CSS var tokens

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Complete Apply Checklist in `portfoi-brand-kit.md`

**Files:**
- Modify: `portfoi-brand-kit.md` (Section 6, lines 142–153)

- [ ] **Step 1: Update Apply Checklist**

Find:
```
[ ] Replace all purple hex values with Gold tokens (see Migration section)
[ ] Import DM font family via Google Fonts
[ ] Apply --font-numeric to all price and percentage text elements
[ ] Apply --font-display to dashboard hero number
[ ] Update FAB background to --color-accent (#C9A84C)
[ ] Update active tab color to --color-accent (#C9A84C)
[ ] Update card borders to gold-tinted rgba border
[ ] Apply delta badge tokens to all +/- percentage displays
[ ] Remove any remaining #6366F1 or purple variants
[ ] Update app name references from placeholder to "Portfoi"
[ ] Update domain references to portfoi.com
```

Replace with:
```
[x] Replace all purple hex values with Gold tokens — no #6366F1/#4F46E5/#818CF8 existed; TYPE_COLORS updated to brand-kit palette
[x] Import DM font family via Google Fonts — already in index.html at load time
[x] Apply --font-numeric to all price and percentage text elements — App.js + AnalysisTab.js updated
[x] Apply --font-display to dashboard hero number — App.js line 636 updated
[x] Update FAB background to --color-accent (#C9A84C) — already var(--info) = #C9A84C
[x] Update active tab color to --color-accent (#C9A84C) — already rgba(201,168,76,…) + var(--info) via CSS class
[x] Update card borders to gold-tinted rgba border — already rgba(201,168,76,0.12) in .card
[x] Apply delta badge tokens to all +/- percentage displays — tokens defined in tokens.css; .delta-pos/.delta-neg classes in index.html
[x] Remove any remaining #6366F1 or purple variants — none existed; TYPE_COLORS/REGION_META updated
[x] Update app name references from placeholder to "Portfoi" — already "Portfoi" in index.html title & meta
[x] Update domain references to portfoi.com — portfoi-brand-kit.md DOMAIN = portfoi.com; app not deployed there yet
```

- [ ] **Step 2: Commit**

```bash
git add portfoi-brand-kit.md
git commit -m "docs: mark brand kit Apply Checklist as complete

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- ✅ `src/styles/tokens.css` created with all brand-kit properties (Task 1)
- ✅ `index.html` `<link>` added (Task 2); Google Fonts already present
- ✅ Purple hex replacement: no `#6366F1/#4F46E5/#818CF8` existed; documented in checklist (Task 6)
- ✅ `TYPE_COLORS` updated to brand-kit values (Task 3)
- ✅ `SECTOR_COLORS`, `TICKER_PIE_COLORS`, `REGION_META` updated (Task 4)
- ✅ FAB bg: already `var(--info)` = gold; no change needed
- ✅ Active tab: already `rgba(201,168,76,0.12)` + `var(--info)` via CSS class; no change needed
- ✅ Dashboard hero `--font-display` (Task 5, App.js line 636)
- ✅ Price/% values `--font-numeric` (Task 5, App.js + AnalysisTab.js)
- ✅ `var(--category-etf)` etc. tokens defined in `tokens.css`; TYPE_COLORS hex values match
- ✅ Apply Checklist updated (Task 6)

**Placeholder scan:** No TBD/TODO/similar language.

**Type consistency:** `fontFamily:"var(--font-numeric)"` and `fontFamily:"var(--font-display)"` used consistently. CSS vars are defined in `:root` so all inline React styles pick them up.
