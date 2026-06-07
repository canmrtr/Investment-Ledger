---
name: Portfoi
description: Portföyünü gösteren değil, seni yatırımcı olarak geliştiren sakin yatırım defteri.
colors:
  obsidian: "#000000"
  surface-1: "#0c0c0c"
  surface-2: "#141414"
  surface-3: "#1c1c1c"
  gold: "#C9A84C"
  gold-muted: "#8A6A1F"
  ink: "#f0ede8"
  ink-muted: "#b8b8b8"
  ink-faint: "#888888"
  positive: "#00d97e"
  negative: "#ff3366"
  warning: "#ffb800"
  border-hairline: "#ffffff0f"
  border-gold: "#c9a84c47"
  cat-us-stock: "#8B5CF6"
  cat-fund: "#3B82F6"
  cat-crypto: "#06B6D4"
  cat-bist: "#F97316"
  cat-gold: "#C9A84C"
  cat-fx: "#10B981"
  cat-bes: "#EC4899"
  cat-cash: "#64748B"
  cat-deposit: "#6366F1"
  light-arctic: "#F5F3EE"
  light-ink: "#0D1117"
  light-gold: "#8A6A1F"
typography:
  display:
    fontFamily: "DM Serif Display, serif"
    fontSize: "32px"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "DM Serif Display, serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "normal"
  title:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1.3
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.06em"
  numeric:
    fontFamily: "DM Mono, monospace"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.2
  mono-sm:
    fontFamily: "DM Mono, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  pill: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    typography: "{typography.body}"
  button-ghost:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "7px 14px"
    typography: "{typography.body}"
  button-danger:
    backgroundColor: "{colors.obsidian}"
    textColor: "{colors.negative}"
    rounded: "{rounded.md}"
    padding: "7px 14px"
  input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 13px"
    typography: "{typography.mono-sm}"
  card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  badge:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.gold}"
    rounded: "{rounded.sm}"
    padding: "3px 7px"
    typography: "{typography.label}"
---

# Design System: Portfoi

## 1. Overview

**Creative North Star: "The Quiet Ledger"**

Portfoi is a gold-on-black ledger that stays calm while markets do not. The surface is true black, not a tinted near-black, so a single restrained gold (#C9A84C) and one warm off-white (#f0ede8) carry the whole interface without ever raising their voice. Depth is built from four flat tonal steps of black (#000 → #0c0c0c → #141414 → #1c1c1c), never from shadows or glass. Where most fintech reaches for neon gradients and blinking tickers to manufacture urgency, Portfoi does the opposite: it makes the numbers legible, ties every figure to a verdict, and leaves the user calmer than it found them.

The type system is the second voice. DM Serif Display carries hero values and titles with a quiet editorial confidence; DM Mono renders every price, percentage, and ticker in tabular figures so columns of money line up to the digit; DM Sans handles the connective UI tissue. This is a tool that disappears into the task. It earns trust through familiarity and restraint, not through novelty.

This system explicitly rejects the Bloomberg-terminal reflex (dense multi-panel walls, blinking data), the trading-platform reflex (Buy/Sell CTAs shouting for action, red-green excitement engines), and the generic crypto-SaaS reflex (purple-blue gradient templates, decorative glassmorphism, hero-metric cards with gradient accents). Detail is never dumped on the screen; it waits one layer down, behind a Detay toggle or a `<details>`, for the user who asks for it.

**Key Characteristics:**
- True-black surface (#000) with four flat tonal layers for depth, zero structural shadows.
- One gold accent, used on ≤10% of any screen: primary action, active state, selection only.
- Serif display + mono numerics + sans body: three families, each with a fixed job.
- Calm by default; semantic green/red reserved strictly for gain/loss, never decoration.
- Turkish-first, jargon-free copy; every number resolves to a plain-language verdict.

## 2. Colors

A near-monochrome black-and-bone canvas with a single gold accent and a tightly-rationed semantic pair.

### Primary
- **Portfoi Gold** (`#C9A84C`): The one accent. Active nav pill (at 12% tint), the FAB, primary CTAs, focus borders, search border, hairline card edges (at 28% via `--border2`), and the "İzleniyor"/selected states. Its scarcity is the entire point; gold on more than a tenth of the screen reads as decoration and breaks the system.
- **Gold Muted** (`#8A6A1F`): Pressed/secondary gold, and the accent color in light theme where full gold lacks contrast on the Arctic background.

### Neutral
- **Obsidian** (`#000000`): The body. True black, not a tinted dark. Page background and the base tonal layer.
- **Surface 1 / 2 / 3** (`#0c0c0c` / `#141414` / `#1c1c1c`): Flat tonal layers. Cards and inputs sit on Surface 1; hover and nested rows step to Surface 2; menus, chips, and the deepest panels reach Surface 3. Elevation is built by stepping up this ramp, not by casting shadows.
- **Ink** (`#f0ede8`): Primary text, a warm off-white. Body copy and hero numbers.
- **Ink Muted** (`#b8b8b8`): Secondary text, labels, inactive nav, captions.
- **Ink Faint** (`#888888`): Tertiary text, placeholders, disabled values, table column headers.
- **Hairline** (`#ffffff0f`, rgba 255,255,255,0.06): The default 1px divider and card border. Barely-there.
- **Gold Border** (`#c9a84c47`, rgba 201,168,76,0.28): The accent-tinted border for modals, confirm boxes, tooltips, and focused surfaces.

### Semantic (rationed)
- **Signal Green** (`#00d97e`): Gain, positive delta, success flash, "on" status dots only.
- **Signal Red** (`#ff3366`): Loss, negative delta, destructive actions, error flash only.
- **Amber** (`#ffb800`): Warnings, the `.badge.stale` 24h-old-price marker, the hide-mode toggle, caution cards.

### Category Colors (data viz only)
Each asset class owns a fixed hue for charts, distribution bars, badges, and swatches: US Stock `#8B5CF6`, Fund/ETF `#3B82F6`, Crypto `#06B6D4`, BIST `#F97316`, Gold `#C9A84C`, FX `#10B981`, BES `#EC4899`, Cash `#64748B`, Deposit `#6366F1`. These live only in data visualization, never as UI chrome.

### Light Theme
Dark is the default. Light theme swaps the body to Arctic (`#F5F3EE`), ink to Midnight (`#0D1117`), accent to Gold Muted (`#8A6A1F`); gold icon and border identity hold across both. Pure white (`#FFFFFF`) is never the light background.

### Named Rules
**The One Voice Rule.** Gold appears on at most 10% of any screen: one primary action, the current selection, active state indicators. Its rarity is what makes it read as "important."

**The Reserved Signal Rule.** Green (`#00d97e`) and red (`#ff3366`) are reserved for gain/loss and status. A category color may never be green or red; a green or red may never decorate a non-semantic surface. The two vocabularies never overlap.

**The Tonal-Depth Rule.** Depth comes from the black ramp (#000 → #1c1c1c), not from shadow. A surface that needs to feel "higher" steps up one layer; it does not grow a drop shadow.

## 3. Typography

**Display Font:** DM Serif Display (fallback: Georgia, serif)
**Body Font:** DM Sans (fallback: system-ui, sans-serif)
**Numeric / Mono Font:** DM Mono (fallback: Fira Code, monospace)

**Character:** An editorial serif for moments that matter (the portfolio value, screen titles), a quiet humanist sans for everything you read, and a tabular mono for everything you count. The pairing works because the three families sit on genuine contrast axes (serif vs. sans vs. mono), never competing.

### Hierarchy
- **Display** (DM Serif Display, 400, 32px, lh 1.05): The dashboard portfolio value and other hero figures. The one place numbers are allowed to be beautiful rather than merely precise.
- **Headline** (DM Serif Display, 400, 24px): Screen titles where a serif is warranted.
- **Title** (DM Sans, 500, 18px): Section headers within content.
- **Body** (DM Sans, 400, 14px, lh 1.5): Default UI text, card copy, descriptions. Prose capped at 65–75ch.
- **Label** (DM Sans, 500, 10px, letter-spacing 0.06em, UPPERCASE): The `.lbl` / `.stitle` / `.kk` micro-labels above values and on table headers. Max 4 words.
- **Numeric** (DM Mono, 500, 14px, tabular-nums): Every price, percentage, and ticker. Tabular figures so columns align to the digit.
- **Mono Small** (DM Mono, 400, 12px): Table cells, secondary data, sub-values in position rows.

### Named Rules
**The Mono-Money Rule.** Every number the user reads as data, price, percentage, share count, ticker, is DM Mono with `font-variant-numeric: tabular-nums`. Numbers never sit in DM Sans; prose never sits in DM Mono.

**The Serif-For-Hero-Only Rule.** DM Serif Display is reserved for hero values and titles. It is forbidden in buttons, labels, table cells, and body copy. A serif button is the tell that the hierarchy broke.

**The No-Caps-Sentence Rule.** Uppercase is for labels of ≤4 words and badges only. A full sentence in caps is never acceptable at body size.

## 4. Elevation

Flat by default. Portfoi builds depth almost entirely from the four-step black tonal ramp, not from shadows. A card is distinguished from the page by a hairline border and a one-step-lighter surface, not by a drop shadow. This is deliberate: shadows on near-black read as muddy, and the calm aesthetic depends on flatness.

Shadows appear only on genuine overlays (things that float above the page) and as the single intentional gold glow under the FAB. Backdrop blur is reserved for the sticky topbar and modal scrim.

### Shadow Vocabulary
- **Overlay Menu** (`box-shadow: 0 8px 24px rgba(0,0,0,.5)`): The hamburger dropdown menu floating over content.
- **Modal Lift** (`box-shadow: 0 30px 80px rgba(0,0,0,0.6)`): The confirm/dialog box, lifted decisively off the blurred scrim.
- **Tooltip** (`box-shadow: 0 6px 18px rgba(0,0,0,0.45)`): The `[data-tip]` hover/tap bubble.
- **Gold Glow** (`box-shadow: 0 6px 20px rgba(201,168,76,0.45)`, hover `0 8px 28px rgba(201,168,76,0.55)`): The FAB only. The single place a colored glow is sanctioned, because the FAB is the primary action and earns the emphasis.

### Named Rules
**The Flat-Surface Rule.** Content surfaces (cards, rows, panels, inputs) are flat. If a card has a drop shadow, it is wrong; step it up the tonal ramp instead.

**The Float-Earns-Shadow Rule.** Only elements that genuinely float above the page (menu, modal, tooltip) cast a shadow. The FAB's gold glow is the sole colored-shadow exception.

## 5. Components

Refined and restrained: flat surfaces, hairline borders, gold spent only on the primary action. Every control disappears into the task.

### Buttons
- **Shape:** Gently rounded, 10px (`--r`) for standard buttons; the FAB and avatar are full circles (`50%`).
- **Default (Ghost):** Surface-2 (`#141414`) fill, hairline border, Ink text, DM Sans 12px/400, padding 7px 14px. The baseline; most buttons are ghosts.
- **Primary (`.pri` / `.btn-pri`):** Gold (`#C9A84C`) fill, text in the theme-aware **`--on-accent`** token (near-black `#0D1117` on dark theme, white on light theme), weight 500, padding 8px 16px, min-height 38px. The one gold element in a view.
- **Danger:** Transparent fill, red (`#ff3366`) text and 25%-red border; hover fills to 8% red.
- **Hover / Focus / Active:** Hover drops opacity to .82, active to .6; disabled to .35. Focus surfaces (`.pick-card`, inputs) shift their border to gold; `.pick-card:focus-visible` gets a 2px gold outline.
- **Tiers:** `btn-icon` (28×28 square, icon-only, always paired with `aria-label` + `data-tip`) < `btn-xs` (11px) < `btn-sm` (11px, 30px min) < `btn-md` (12px, 34px min) < `btn-pri` (gold CTA, 38px min). On ≤640px, `btn-xs`/`btn-icon`/`btn-sm` grow to 36×36 touch targets.

### Inputs / Fields
- **Style:** Surface-1 (`#0c0c0c`) fill (Obsidian for `.finp` inline variant), hairline or gold-tinted border, 10px radius, DM Sans 13px, padding 10px 13px.
- **Focus:** Border shifts to gold (`#C9A84C`); no glow, no ring beyond the border color change.
- **Placeholder:** Ink Faint (`#888888`).
- **Mobile:** Font forced to 16px at ≤640px to stop iOS Safari auto-zoom.

### Cards / Containers
- **Corner Style:** 16px (`--rl`).
- **Background:** Surface-1 (`#0c0c0c`); `.cbox` confirm boxes and `.metric-mini` use Surface-3.
- **Shadow Strategy:** None. Flat per the Tonal-Depth Rule.
- **Border:** 1px gold-tinted at 12% (`rgba(201,168,76,0.12)`); `.cbox` uses the stronger Gold Border (`--border2`).
- **Internal Padding:** 12–16px.
- **Never nest cards.** A subsection inside a card is a `.row`, `.metric-mini`, or bare block, not another bordered card.

### Badges
- **Style:** DM Mono 9px/500, 6px radius, padding 3px 7px, transparent-tinted background at ~12%, matching colored border. Variants: `.badge.etf` (gold), `.cry`/`.split`/`.stale` (amber). `.delta-pos`/`.delta-neg` carry green/red at 15% tint for gain/loss.

### Navigation
- **Topbar (desktop):** 52px, blurred translucent background, hairline bottom border. Tabs are ghost pills; active tab gets a 12%-gold background (`rgba(201,168,76,0.12)`) and weight 500, **no underline**. Tablet (641–880px) compresses tabs and hides freshness text.
- **Bottom tabs + FAB (mobile ≤640px):** Topbar nav collapses; a fixed 60px bottom bar (active tab in gold) plus a 54px gold FAB at `bottom:76px` take over. The FAB is the only element with a colored glow.

### Segmented Control & Filter Chips
- **`.seg`:** Surface-3 track, 7px radius; active segment lifts to Surface-2 with a 1px-subtle inset shadow. **`.mtab.on`** fills gold. The `.fbar` filter row scrolls horizontally with hidden scrollbars; chips never wrap.

### Signature: Position Row (responsive)
The portfolio list is a table (`.pos-tbl-desktop`) on desktop and a card-row stack (`.pcr`) on mobile, switched at 640px, not a fluid reflow. Mobile rows show ticker (DM Mono 700/15px) + sub-value on the left, market value + colored change on the right, with a mobile sort bar (`.pos-sort-bar`) replacing table headers.

## 6. Do's and Don'ts

### Do:
- **Do** keep gold on ≤10% of any screen (The One Voice Rule): primary action, active state, current selection.
- **Do** render every price, %, share count, and ticker in DM Mono with `tabular-nums`.
- **Do** build depth by stepping up the black ramp (#000 → #0c0c0c → #141414 → #1c1c1c). Cards stay flat.
- **Do** put the theme-aware **`--on-accent`** token on every gold (`--info`) fill: `#0D1117` in dark theme (~8.4:1), white in light theme (~5.0:1). Both themes pass AA. The gold flips light↔dark between themes, so a single hardcoded text color can't be right for both.
- **Do** give icon-only buttons (`btn-icon`: ✎, ×, 💰, ↻) an `aria-label` + `data-tip`, and keep touch targets ≥36×36 on mobile.
- **Do** tie every number to a plain-language verdict ("güçlü / orta / kırılgan"); show the figure, illuminate the behavior.
- **Do** keep all UI, flash, and error copy Turkish and jargon-free.

### Don't:
- **Don't** build a Bloomberg-terminal wall: dense multi-panel screens, blinking tickers, every metric shown at once. Detail waits one layer down (Detay toggle / `<details>`).
- **Don't** make this look like a trading platform: no Buy/Sell CTAs shouting for action, no red-green excitement engine. Calm over urgency.
- **Don't** ship the generic crypto-SaaS look: no purple-blue gradient templates, no decorative glassmorphism, no hero-metric card with a gradient accent.
- **Don't** hardcode `#fff` (or any single color) on a gold fill. White on dark-theme gold (`#C9A84C`) is ~2.2:1 and fails WCAG; use the `--on-accent` token so each theme gets the right text color.
- **Don't** use Signal Green or Signal Red as a category or decorative color, and never use a category color for gain/loss. The vocabularies never cross (The Reserved Signal Rule).
- **Don't** cast drop shadows on content cards or rows; shadows are for floating overlays + the FAB glow only.
- **Don't** set DM Serif Display on buttons, labels, table cells, or body copy. Serif is hero-and-title only.
- **Don't** nest a bordered card inside another card.
- **Don't** rely on `--text3` (`#888888`) for body copy on `#000`; it lands near 4.7:1 and is acceptable only for faint tertiary text, not paragraphs. Body copy uses Ink (`#f0ede8`).
