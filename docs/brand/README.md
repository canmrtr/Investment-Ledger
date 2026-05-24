# Brand & Design

Single entry point for everything related to Portfoi's visual identity, design
system, and brand assets. Read `brand-kit.md` first when working on UI.

## Specs (in this folder)

| File | What it is |
|------|------------|
| [brand-kit.md](brand-kit.md) | Master brand spec — identity, color tokens, typography (DM Serif / DM Sans / DM Mono), component tokens, dark + light palette, gold accent system |
| [design-audit-2026-05-15.md](design-audit-2026-05-15.md) | Last UI/UX audit — text hierarchy, button hit areas, table density, responsive behavior. Snapshot in time; not authoritative for current state |

## Brand assets (kept in place — paths are hard-coded in code)

These files **cannot move** without updating the listed code references.

| Asset | Path | Referenced by |
|-------|------|---------------|
| Wordmark (dark) | `Logo/new/portfoi-wordmark-dark.png` | `src/components/Login.js`, `src/components/App.js` |
| Wordmark (light) | `Logo/new/portfoi-wordmark-light.png` | same |
| Lockup (dark) | `Logo/new/portfoi-lockup-dark.png` | Marketing / app-store splash; not used in app today |
| Lockup (light) | `Logo/new/portfoi-lockup-light.png` | same |
| Master icon SVG | `Logo/portfoi-icon.svg` | `scripts/generate-pwa-icons.mjs` (source for PWA icons) |
| PWA icon 192 | `icon-192.png` (repo root) | `index.html`, `manifest.json`, `service-worker.js` |
| PWA icon 512 | `icon-512.png` (repo root) | `manifest.json`, `service-worker.js` |
| Favicon SVG | `favicon.svg` (repo root) | `index.html`, `service-worker.js` |
| Favicon 32 | `favicon-32.png` (repo root) | `index.html`, `service-worker.js` |

Legacy / pre-Sprint-21 assets live under `Logo/legacy/` for rollback only —
nothing in code references them.

## Design tokens (CSS layer)

- `src/styles/tokens.css` — CSS custom properties derived from `brand-kit.md`
  (category colors, badge tokens, component tokens, extended palette). `<link>`-ed
  from `index.html`. Source of truth for what JSX inline styles should reference
  via `var(--…)`.

The 4-5 most-used tokens (also inlined in CLAUDE.md):
- `--bg #000` / `--bg2 #0c0c0c` / `--text #f0ede8`
- `--info #C9A84C` (Portfoi Gold — primary accent in both themes)
- Light theme: `--bg #F5F3EE` (Arctic), `--text #0D1117` (Midnight), `--info #8A6A1F`
- Fonts: `var(--font-display)` (DM Serif Display), `var(--font-body)` (DM Sans), `var(--font-numeric)` (DM Mono)

## Generation scripts

| Script | Purpose |
|--------|---------|
| `scripts/generate-pwa-icons.mjs` | Regenerates `icon-192.png` + `icon-512.png` from `Logo/portfoi-icon.svg` via Playwright headless |
| `scripts/regenerate-brand-png.mjs` | Regenerates `Logo/new/portfoi-{wordmark,lockup}-{dark,light}.png` from `scripts/brand-export-source.html` |
| `scripts/brand-export-source.html` | HTML source used by the brand PNG export script |

## Related plans

Historical implementation plans live in `docs/superpowers/plans/`:

- `2026-05-10-brand-kit-tokens.md` — original brand-kit-tokens rollout plan
  (created `src/styles/tokens.css`, wired CSS variables, migrated inline styles)
- Sprint 21 brand refresh plans — search `docs/superpowers/plans/` for files
  mentioning "brand", "logo", "wordmark", or "Sprint 21"

## How Claude should use this folder

- Starting any UI work → read `brand-kit.md` for the design language
- Adding/modifying a UI component → also check `ui-builder` skill in `.claude/skills/`
- Regenerating brand assets → use the scripts in `scripts/`, do not edit PNGs by hand
- Discussing past UX issues → consult `design-audit-2026-05-15.md` but verify
  against current code (audit is a snapshot)
