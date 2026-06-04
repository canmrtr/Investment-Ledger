#!/usr/bin/env bash
# Syntax check on root edge function files.  npm run check:edge
# Two gates:
#   1) node --check (always)  — fast baseline JS parse.
#   2) deno check  (if installed) — Deno module-graph + syntax check.
#      Config comes from repo-root deno.json (checkJs:false, so .js bodies
#      are NOT type-checked — only parsed/resolved). Catches the
#      const-redeclaration blind spot inside arrow-function bodies that
#      node --check silently passes (see Lessons.md 2026-05-19, which
#      produced a prod BOOT_ERROR on refresh-price-cache).
#      Resolves the `npm:` deps pinned in deno.json (network on first run;
#      a committed deno.lock would make it offline-safe — TODO once deno
#      is installed). Install once: brew install deno  (or deno.land/install)
set -euo pipefail
FAILED=0
HAS_DENO=0
command -v deno >/dev/null 2>&1 && HAS_DENO=1

for f in \
  fetch-prices-edge-function.js \
  refresh-price-cache-edge-function.js \
  parse-transaction-edge-function.js \
  fetch-fundamentals-edge-function.js
do
  if node --check "$f" 2>&1; then
    echo "✅ node --check  $f"
  else
    echo "❌ node --check  $f"
    FAILED=1
    continue
  fi
  if [ "$HAS_DENO" -eq 1 ]; then
    if deno check "$f" 2>&1; then
      echo "✅ deno check   $f"
    else
      echo "❌ deno check   $f"
      FAILED=1
    fi
  fi
done

if [ "$HAS_DENO" -eq 0 ]; then
  echo "⚠  deno not installed — Deno module-graph gate skipped. Install: brew install deno"
fi

[ $FAILED -eq 0 ] && echo "✅ All edge function files pass syntax checks." || echo "❌ Syntax errors found."
exit $FAILED
