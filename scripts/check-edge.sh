#!/usr/bin/env bash
# node --check on all root edge function files.  npm run check:edge
set -euo pipefail
FAILED=0
for f in \
  fetch-prices-edge-function.js \
  refresh-price-cache-edge-function.js \
  parse-transaction-edge-function.js \
  fetch-fundamentals-edge-function.js
do
  if node --check "$f" 2>&1; then
    echo "✅ $f"
  else
    echo "❌ $f"
    FAILED=1
  fi
done
[ $FAILED -eq 0 ] && echo "✅ All edge function files pass node --check." || echo "❌ Syntax errors found."
exit $FAILED
