---
name: ui-builder
description: Use when adding or modifying UI in Investment Ledger — new tab, card, form, modal, table, or any visual element in `index.html` / `src/components/*.js`. Encodes the full design system: CSS classes, button tiers, form grids, color palette, helper functions (fmt, fmtD, fmtP, mask, flash_, confirm_), Turkish UI language, and Supabase state patterns (`pos`/`txs`/`splits`/`prc`/`hist`). Skip for 1-2 line tweaks.
---

# UI Builder — Investment Ledger

You are acting as a UI developer for **Investment Ledger** — a React 18 app split across `index.html` (shell) + `src/components/*.js` using Babel Standalone (no build step, no TypeScript, no imports). Every component must work with CDN React.

## Design System

### Buton katmanları (Sprint 21)
- `.btn-icon` — square icon-only, 28×28 desktop / 36×36 mobile
- `.btn-xs` — 11px
- `.btn-sm` — 11px, 30px min-height
- `.btn-md` — 12px, 34px min-height
- `.btn-pri` / `button.pri` — 12px gold CTA, 38px min-height
- `.btn-danger-out` — danger ghost
- `@media(max-width:640px)`: `.btn-xs/.btn-icon/.btn-sm` 36×36 min, dense table/pos-row için 8/10 padding
- **Inline `<button style="...">` yazma** — bu sınıfları kullan

### Form grid'leri
- `.form-grid-2` / `.form-grid-3` — ≤640px tek kolona çöker
- Inline `gridTemplateColumns` yerine bu sınıfları kullan (ManuelPosForm, TickerDetailTab quick-add/edit, HistoryTab edit row)

### Diğer CSS sınıfları
- Inputs: `.finp` `.finp.sm`
- States: `.empty-card` (CTA for empty state), `.warn-card` (orange warning)
- Table rows: `.pos-row` (clickable, hover bg shift)
- Badges: `.badge.etf`, `.badge.cry`, `.badge.split` (⚡ ×N for splits), `.badge.stale`
- Modal: `.mdl-bd` `.mdl-bx`
- Segmented toggle: `.seg`, `.mtab`
- Filter bar: `.fbar` (overflow-x:auto; scrollbar-width:none)
- Pie: `.pie-row` (`flex:0 0 70px` $ + `flex:0 0 56px` %), `.pie-sw`
- Tooltip: `[data-tip]` attribute (NOT native `title` — Chrome delays 1-2s)
- Theme logo: `.theme-logo-dark` / `.theme-logo-light` (auto-switch via `[data-theme="light"]`)
- Delta: `.delta-pos` / `.delta-neg`

### Dark renk tokenleri (CSS variables — kullan, hardcode etme)
- `--bg #000` / `--bg2 #0c0c0c` / `--bg3 #141414` / `--bg4 #1c1c1c`
- `--text #f0ede8` / `--text2 #b8b8b8` / `--text3 #888888`
- `--info #C9A84C` (Portfoi Gold) / `--ok #00d97e` / `--err #ff3366` / `--warn #ffb800`
- `--border rgba(255,255,255,0.06)` 1px solid / `--border2 rgba(201,168,76,0.28)`

### Asset Colors (TYPE_COLORS)
```
US_STOCK → #8B5CF6  FUND     → #3B82F6
CRYPTO   → #06B6D4  BIST     → #F97316
GOLD     → #C9A84C  FX       → #10B981
BES      → #EC4899  CASH     → #64748B
DEPOSIT  → #6366F1
```

### Font
- `--font-display` (DM Serif Display — hero sayılar/başlıklar)
- `--font-body` (DM Sans — body 300-700)
- `--font-numeric` (DM Mono — sayılar/ticker)
- Inline style'larda hardcoded font string yok — `fontFamily:"var(--font-display)"` kullan
- `.lbl`/`.stitle`/`.kk`: 10px uppercase `font-weight:500`

## Helper Functions (always use, never reinvent)

- `fmt(n, d=2)` — number formatting
- `fmtD(n)` — ±$ with sign (**BIST için kullanma** — hardcoded `$` döner; `fmtSign(n, sym)` kullan)
- `fmtSign(n, sym)` — currency-aware ±
- `fmtP(n)` — ±% with sign
- `fmtShares(n)` — share count
- `fmtDateTR(iso)` — DD/MM/YYYY display (storage: ISO `YYYY-MM-DD`)
- `displaySym(cur)` — USD→`$`, TRY→`₺`, EUR→`€`
- `mask()` — returns `"••••"` when `hide` state is true (privacy mode)
- `flash_(msg, "ok"|"err")` — 3.5s auto-dismiss toast
- `confirm_(msg, {okLbl, cancelLbl, danger})` — **async/await gerekir**. NEVER use `window.confirm`.
- `CFG.FLASH_MS`, `CFG.DUST_THRESHOLD`, `CFG.RATE_LIMIT_MS`, `CFG.CSV_BATCH_SIZE` — use constants, don't hardcode
- `edgeCall(fn, body)` — anon edge call (`fetch-prices` için kullanma)
- `edgeCallAuth(fn, body)` — JWT'li edge call (session yoksa 401)
- `edgePriceCall(body)` — `fetch-prices` kısayolu

## Closures (App.js içinde, prop olarak forward edilmeli)

**Bunlar global DEĞİL — yeni component yazarken App'ten prop olarak geç:**
- `flash_`, `confirm_`, `loadData`, `mask`

**Bunlar global (doğrudan kullanılabilir):**
- `sb` (supabase client), `edgePriceCall`, `fmt`, `fmtD`, `fmtP`, `fmtSign`, `displaySym`

## Dil

- **UI text, labels, error messages, flash messages** → **Türkçe**
- **Variable names, comments, function names, commit messages** → **English**

## State Patterns

- Data from Supabase is in `pos`, `txs`, `splits`, `prc`, `hist` state
- Loading states use `busy` object (e.g. `busy.fetch`, `busy.save`)
- User ID from `supabase.auth.getUser()` or `user.id`
- Display Currency: topbar toggle $/₺; KPI+Pie+Analiz convert, pozisyon blokları natural currency'de kalır
- Gizli mod: `hide` state true ise tüm value display'leri `mask()` ile sarmala

## Component Yerleşimi

- New tabs go inside `App` as sibling to `Dashboard`, `HistoryTab`, `AddTab`, `Settings`
- Tab listesi: `TABS = [["dashboard","Dashboard"],["watchlist","Watchlist"],["analysis","Analiz"],["search","Ara"],["add","+ Ekle"],["rehber","Rehber"]]`
- Mobile: `#bottom-tabs` + `#fab` (context-aware; rehber sekmesinde gizli)

## CASH / DEPOSIT / BES gotcha

- **CASH**: `shares=bakiye, avg_cost=1.0`; `prc[ticker]=1.0` (synthetic)
- **DEPOSIT**: `shares=anapara, avg_cost=1.0, interest_rate, reserve_ratio, maturity_date`; `prc[ticker]=(anapara+brütFaiz)/anapara`
- **BES**: `shares=1, avg_cost=kişisel_yatırılan`; `dk_principal`/`dk_current` ayrı; `prc[ticker]` total (X+X_g + Y+Y_g)
- Bunlar `fetchPrices` dışı — `prc` `loadData`'da `setPrc_` ile synthetic inject edilir

## Before Writing

1. Read `index.html` ve ilgili `src/components/*.js` dosyalarını oku — current component structure
2. Find where the new component fits in the tree (CLAUDE.md component map)
3. Grep for similar existing components to match style exactly

## Output Rules

- Write complete, self-contained JSX — no partial snippets
- No TypeScript, no import/export, no require()
- Use `React.useState`, `React.useEffect` (not destructured imports unless file already does)
- After writing, the `babel-check.sh` PostToolUse hook validates syntax automatically — eğer hook fail ederse hatayı düzelt
