# Product Strategy

Long-horizon thinking for Portfoi — vision, positioning, go-to-market. Not
engineering tickets (those live in `ROADMAP.md` and `sprints/`).

## Files in this folder

| File | What it is |
|------|------------|
| [product-vision.md](product-vision.md) | 4-layer product vision (Tracker → Nudge → Coach → Advisor), target persona, what Portfoi is *not* |
| [product-brief.md](product-brief.md) | Short-form product register — user, purpose, brand personality, anti-references, design principles, accessibility target. Condensed companion to product-vision.md |
| [launch-plan.md](launch-plan.md) | Go-to-market strategy, positioning vs Midas / Fintables / FinAi, distribution & messaging |

## Related but lives elsewhere

- `docs/brand/README.md` — Visual identity, design tokens, logo assets
- `ROADMAP.md` (repo root) — Engineering roadmap and sprint history
- `CLAUDE.md` (repo root) — Claude Code session context
- `audit.md` (repo root) — Latest security audit
- `docs/brand/design-audit-2026-05-15.md` — Latest UX audit snapshot

## How Claude should use this folder

- Pricing / positioning / persona questions → read `product-vision.md` first
- "Should we ship X before launch?" → check `launch-plan.md` for current GTM stage
- Feature prioritization that hinges on which product *layer* a feature serves → vision doc defines the layers
- Do not edit these without explicit user request; they're strategy decisions, not implementation notes
