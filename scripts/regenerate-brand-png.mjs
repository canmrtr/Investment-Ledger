#!/usr/bin/env node
// Regenerates Logo/new/portfoi-{wordmark,lockup}-{dark,light}.png from
// scripts/brand-export-source.html with TRANSPARENT backgrounds so the
// PNGs blend seamlessly into any topbar / login surface.
//
// The source HTML uses JS to inject candle dots above the "ı" glyph,
// so we drive it via document.fonts.ready + showVariant() before screenshot.
//
// Usage: node scripts/regenerate-brand-png.mjs

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const srcUrl = pathToFileURL(resolve(__dirname, 'brand-export-source.html')).href;

// Override the source-html container styles so the variant element shrinks
// to its content (with breathing room for the absolute-positioned candle
// SVGs above the "ı"). Then screenshot the element with transparent bg.
const variants = [
  { id: 'wm-dark',     out: 'Logo/new/portfoi-wordmark-dark.png'  },
  { id: 'wm-light',    out: 'Logo/new/portfoi-wordmark-light.png' },
  { id: 'lockup-dark', out: 'Logo/new/portfoi-lockup-dark.png'    },
  { id: 'lockup-light',out: 'Logo/new/portfoi-lockup-light.png'   },
];

const browser = await chromium.launch();
for (const { id, out } of variants) {
  const ctx = await browser.newContext({
    viewport: { width: 1024, height: 256 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(srcUrl, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((id) => window.showVariant(id), id);

  // Shrink container to content size with generous top padding so the
  // candle-dot SVGs above "ı" are not clipped. Transparent bg for alpha.
  await page.addStyleTag({ content: `
    html, body { background: transparent !important; }
    .v#${id} {
      background: transparent !important;
      width: auto !important;
      height: auto !important;
      padding: 36px 28px 16px !important;
      display: inline-flex !important;
    }
  `});
  await page.waitForTimeout(200);

  const buf = await page.locator(`#${id}`).screenshot({ omitBackground: true, type: 'png' });
  writeFileSync(resolve(repoRoot, out), buf);
  console.log(`  wrote ${out} (${buf.length} bytes)`);
  await ctx.close();
}
await browser.close();
console.log('done.');
