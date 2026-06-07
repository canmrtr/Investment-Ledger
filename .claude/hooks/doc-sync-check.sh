#!/usr/bin/env bash
# PostToolUse hook: Edit/Write/MultiEdit sonrası docs-sync hatırlatması.
# ADVISORY — daima exit 0, asla bloklamaz. Değişen dosyanın tipine göre
# hangi .md'nin AYNI commit'te güncellenmesi gerekebileceğini stdout'a yazar.
# Yargı çağrısı senin; bu sadece in-loop hatırlatıcı (commit-time: commit-helper agent).
#
# Stdin: tool-call JSON. tool_input.file_path okunur.

set -euo pipefail

INPUT=$(cat)

FILE_PATH=$(printf '%s' "$INPUT" | node -e '
  let d = "";
  process.stdin.on("data", c => d += c);
  process.stdin.on("end", () => {
    try { process.stdout.write(JSON.parse(d)?.tool_input?.file_path || ""); } catch (_) {}
  });
' 2>/dev/null || echo "")

# Hiç path yoksa sessiz çık
[ -z "$FILE_PATH" ] && exit 0

# .md dosyalarının kendisini düzenlerken hatırlatma verme (sonsuz gürültü olmasın)
case "$FILE_PATH" in
  *.md) exit 0 ;;
esac

HINTS=""
add() { HINTS="${HINTS}\n  • $1"; }

case "$FILE_PATH" in
  *-edge-function.js|*/supabase/functions/*|*/supabase/migrations/*)
    add "SCHEMA.md — tablo/RPC/cron/RLS değiştiyse"
    add "GOTCHAS.md — yeni edge/Supabase pitfall çıktıysa"
    ;;
esac

case "$FILE_PATH" in
  */index.html|*/src/styles/*)
    add "CONVENTIONS.md — CSS sınıfı/buton katmanı/token eklediysen"
    add "docs/brand/ — tasarım sistemi değiştiyse"
    ;;
esac

# İçerik tabanlı ipuçları (sadece src/ ve index.html için) — dosyayı doğrudan grep'le
case "$FILE_PATH" in
  */src/*.js|*/src/components/*.js|*/index.html)
    if [ -f "$FILE_PATH" ]; then
      grep -qE "localStorage|LS\.(get|set)|CacheGet|CacheSet" "$FILE_PATH" && add "CACHE.md — yeni LS key / cache eklediysen"
      grep -qE "priceCur|mvDisp|allDisp|fxRates|convert\(" "$FILE_PATH" && add "FEATURE_DETAILS.md — fiyat/FX/priceCur mantığı değiştiyse (canonical priceCur orada)"
    fi
    add "ROADMAP.md — sprint/backlog durumu (kapanan madde / yeni iş)"
    ;;
esac

if [ -n "$HINTS" ]; then
  printf '📝 docs-sync (advisory): %s değişti. Aynı commit'\''te gözden geçir:%b\n' \
    "$(basename "$FILE_PATH")" "$HINTS" >&2
fi

exit 0
