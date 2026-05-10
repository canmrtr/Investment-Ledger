# Audit Notes

Date: 2026-05-10

Scope: Static review of the current working tree for the React/Supabase Investment Ledger app, focused on portfolio-sharing privacy, ledger correctness, return calculations, and edge-function/data-flow consistency. No production database state was inspected.

## Findings

All 5 findings (1 High, 3 Medium, 1 Low) moved to ROADMAP.md backlog. See:
- **Gerçek Buglar (P1)**: `get_allocation_only_positions` multi-currency; "Tam Detay" UI/data mismatch; dönem getirisi temettü eksikliği
- **Asset Type Genişletme**: AI parse DIV desteği
- **Bug & UX Backlog**: `saveTx` istemci `way` doğrulaması

## Verification Run

- `npm run check:babel` passed.
- `npm run check:edge` passed.
- `npm run check:edge-drift` passed.
