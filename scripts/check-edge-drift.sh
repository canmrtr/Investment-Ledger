#!/usr/bin/env bash
# Detect drift between root *.js files and supabase/functions/*/index.ts deploy copies.
# Run before any edge function deploy.  npm run check:edge-drift
set -euo pipefail
FAILED=0
check() {
  local root="$1" deploy="$2"
  if [ ! -f "$deploy" ]; then
    echo "❌ MISSING deploy copy: $deploy"
    FAILED=1
  elif ! diff -q "$root" "$deploy" > /dev/null 2>&1; then
    echo "❌ DRIFT: $root vs $deploy"
    diff --unified=3 "$root" "$deploy" | head -40
    FAILED=1
  else
    echo "✅ OK: $root"
  fi
}
check fetch-prices-edge-function.js          supabase/functions/fetch-prices/index.ts
check refresh-price-cache-edge-function.js   supabase/functions/refresh-price-cache/index.ts
check fetch-fundamentals-edge-function.js    supabase/functions/fetch-fundamentals/index.ts
check parse-transaction-edge-function.js     supabase/functions/parse-transaction/index.ts

[ $FAILED -eq 0 ] \
  && echo "✅ All edge functions in sync — safe to deploy." \
  || echo "❌ Drift detected — resolve before deploy. Edit supabase/functions/<fn>/index.ts and keep root *.js in sync."
exit $FAILED
