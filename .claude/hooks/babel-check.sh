#!/usr/bin/env bash
# PostToolUse hook: Edit/Write/MultiEdit sonrası index.html babel/JSX parse kontrolü.
# Build step yok — parse fail = broken production. Hata → exit 2 (fail closed).
#
# Stdin: tool-call JSON. tool_input.file_path okunur; index.html değilse skip.

set -euo pipefail

INPUT=$(cat)

# JSON'dan file_path çıkar — node ile (python3 bağımlılığı yok).
FILE_PATH=$(printf '%s' "$INPUT" | node -e '
  let d = "";
  process.stdin.on("data", c => d += c);
  process.stdin.on("end", () => {
    try { process.stdout.write(JSON.parse(d)?.tool_input?.file_path || ""); } catch (_) {}
  });
' 2>/dev/null || echo "")

# Sadece index.html için çalış
case "$FILE_PATH" in
  *index.html) ;;
  *) exit 0 ;;
esac

# @babel/parser: proje node_modules (npm install) → /tmp → lazy install → fail closed.
# Fail open değil: parser yoksa exit 2 — parse atlanamaz.
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

NODE_PATH="$PARSER_PATH" FILE_PATH="$FILE_PATH" node -e '
  const fs = require("fs");
  const path = process.env.FILE_PATH;
  const h = fs.readFileSync(path, "utf8");
  const m = h.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
  if (!m) {
    console.error("❌ babel-checker: <script type=\"text/babel\"> bloğu bulunamadı");
    process.exit(2);
  }
  try {
    require("@babel/parser").parse(m[1], { sourceType: "module", plugins: ["jsx"] });
    console.log("✅ babel-checker: parse OK");
  } catch (e) {
    const line = e.loc ? " | satır " + e.loc.line + ", sütun " + e.loc.column : "";
    console.error("❌ babel-checker: " + e.message + line);
    process.exit(2);
  }
'
