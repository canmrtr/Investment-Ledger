#!/usr/bin/env node
// Babel/JSX parse check for all src/**/*.js files.  npm run check:babel
'use strict';
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const files = [
  'src/constants.js',
  'src/utils.js',
  'src/components/Login.js',
  'src/components/BesUpdateModal.js',
  'src/components/TickerDetailTab.js',
  'src/components/AccountSection.js',
  'src/components/FeedbackSection.js',
  'src/components/ConfirmBox.js',
  'src/components/HistoryTab.js',
  'src/components/ManuelPosForm.js',
  'src/components/SearchTab.js',
  'src/components/AddTab.js',
  'src/components/AnalysisTab.js',
  'src/components/WatchlistTab.js',
  'src/components/App.js',
];

let ok = 0;
let fail = 0;

for (const f of files) {
  try {
    const src = fs.readFileSync(f, 'utf8');
    parser.parse(src, { sourceType: 'module', plugins: ['jsx'] });
    console.log(`✅ ${f}`);
    ok++;
  } catch (e) {
    const loc = e.loc ? ` | satır ${e.loc.line}, sütun ${e.loc.column}` : '';
    console.error(`❌ ${f}: ${e.message}${loc}`);
    fail++;
  }
}

console.log(`\n${ok} OK, ${fail} hata`);
if (fail > 0) process.exit(2);
