#!/usr/bin/env bash
# PostToolUse hook: Edit/Write/MultiEdit sonrası JSX parse kontrolü.
# Build step yok — parse fail = broken production. Hata → exit 2 (fail closed).
#
# Desteklenen dosyalar:
#   - src/*.js ve src/components/*.js  → ilgili dosyayı parse et
#   - index.html                       → inline Babel bloğu kalmadı, skip
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

# Hangi dosyayı kontrol edeceğimizi belirle
TARGET=""
case "$FILE_PATH" in
  *index.html)
    # index.html artık inline Babel içermiyor — skip
    exit 0
    ;;
  */src/*.js|*/src/components/*.js)
    TARGET="$FILE_PATH"
    ;;
  *)
    exit 0
    ;;
esac

# @babel/parser: proje node_modules → /tmp → lazy install → fail closed.
if [ -d "./node_modules/@babel/parser" ]; then
  PARSER_PATH="./node_modules"
elif [ -d "/tmp/node_modules/@babel/parser" ]; then
  PARSER_PATH="/tmp/node_modules"
elif (cd /tmp && npm install --no-save --silent @babel/parser >/dev/null 2>&1); then
  PARSER_PATH="/tmp/node_modules"
else
  echo "❌ babel-checker: @babel/parser bulunamadı. Çözüm: proje kökünde 'npm install' çalıştırın." >&2
  exit 2
fi

NODE_PATH="$PARSER_PATH" FILE_PATH="$TARGET" node -e '
  const fs = require("fs");
  const path = process.env.FILE_PATH;
  const src = fs.readFileSync(path, "utf8");
  try {
    require("@babel/parser").parse(src, { sourceType: "module", plugins: ["jsx"] });
    console.log("✅ babel-checker: parse OK —", path.split("/").slice(-2).join("/"));
  } catch (e) {
    const line = e.loc ? " | satır " + e.loc.line + ", sütun " + e.loc.column : "";
    console.error("❌ babel-checker: " + e.message + line + " — " + path.split("/").slice(-2).join("/"));
    process.exit(2);
  }
'
