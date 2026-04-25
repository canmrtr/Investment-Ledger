#!/usr/bin/env bash
# PostToolUse hook: Edit/Write/MultiEdit sonrası index.html'in babel/JSX
# parse edilebilirliğini doğrular. Build step yok — parse fail = canlı sitedeki
# tüm kullanıcılar için broken page. Hata durumunda exit 2 + stderr ile
# Claude'a feedback verir, ana akış düzeltir.
#
# Stdin: tool-call JSON. tool_input.file_path okunur; index.html değilse skip.

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("file_path",""))' 2>/dev/null || echo "")

# Sadece index.html için çalış
case "$FILE_PATH" in
  *index.html) ;;
  *) exit 0 ;;
esac

# @babel/parser ilk çalıştırmada /tmp'ye lazy install
if [ ! -d /tmp/node_modules/@babel/parser ]; then
  (cd /tmp && npm install --no-save --silent @babel/parser >/dev/null 2>&1) || {
    echo "⚠️  babel-checker: @babel/parser yüklenemedi, parse skip" >&2
    exit 0
  }
fi

# /tmp'deki node_modules'u resolve için cwd'yi /tmp yap
NODE_PATH=/tmp/node_modules FILE_PATH="$FILE_PATH" node -e '
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
