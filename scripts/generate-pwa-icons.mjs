#!/usr/bin/env node
// Generates icon-192.png, icon-512.png from Logo/portfoi-icon.svg
// using Playwright. Renders with Google Fonts loaded so the "p" glyph
// uses DM Serif Display (not the fallback).
//
// Usage: node scripts/generate-pwa-icons.mjs

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const svgPath = resolve(repoRoot, 'Logo/portfoi-icon.svg');
const svg = readFileSync(svgPath, 'utf8');

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;padding:0;background:#0D1117;}
  #wrap{display:block;line-height:0;}
  #wrap svg{display:block;width:100%;height:100%;}
</style>
</head><body><div id="wrap">${svg}</div></body></html>`;

const targets = [
  { size: 192, out: 'icon-192.png' },
  { size: 512, out: 'icon-512.png' },
  { size: 32, out: 'favicon-32.png' },
];

const browser = await chromium.launch();
for (const { size, out } of targets) {
  const ctx = await browser.newContext({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({ omitBackground: false, type: 'png' });
  writeFileSync(resolve(repoRoot, out), buf);
  console.log(`  wrote ${out} (${size}x${size}, ${buf.length} bytes)`);
  await ctx.close();
}
await browser.close();
console.log('done.');
