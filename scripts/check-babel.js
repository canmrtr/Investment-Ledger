#!/usr/bin/env node
// Babel/JSX parse check for index.html.  npm run check:babel
'use strict';
const fs = require('fs');
const parser = require('@babel/parser');

const html = fs.readFileSync('index.html', 'utf8');
const m = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
if (!m) {
  console.error('❌ Babel: <script type="text/babel"> bloğu bulunamadı');
  process.exit(2);
}
try {
  parser.parse(m[1], { sourceType: 'module', plugins: ['jsx'] });
  console.log('✅ Babel: parse OK');
} catch (e) {
  const loc = e.loc ? ` | satır ${e.loc.line}, sütun ${e.loc.column}` : '';
  console.error(`❌ Babel: ${e.message}${loc}`);
  process.exit(2);
}
