// Sprint 21 visual smoke — verifies Brand & Design changes locally.
// Usage:  node e2e/sprint21-visual.mjs
// Requires:  local server on http://localhost:8765 + .env with IL_EMAIL/IL_PASS

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter(Boolean).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)];
  })
);
const BASE = 'http://localhost:8765/';
const EMAIL = env.IL_EMAIL, PASS = env.IL_PASS;

let pass = 0, fail = 0;
const log = (ok, msg, detail = '') => {
  if (ok) { pass++; console.log(`✅ ${msg}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.log(`❌ ${msg}${detail ? ' — ' + detail : ''}`); }
};

const browser = await chromium.launch();

async function check(viewport, label) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log(`  ⚠️ pageerror @${label}:`, e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });

  // 1. Login page should show new lockup
  const lockupSrc = await page.locator('img.theme-logo-dark').first().getAttribute('src');
  log(/portfoi-lockup-dark\.png$/.test(lockupSrc || ''), `[${label}] Login uses new lockup`, lockupSrc);

  const lockupHeight = await page.locator('img.theme-logo-dark').first().evaluate(el => el.height);
  log(lockupHeight > 80 && lockupHeight <= 180, `[${label}] Lockup height ~160px`, `actual ${lockupHeight}`);

  // 2. Favicon serves
  const favicon = await page.evaluate(async () => {
    const r = await fetch('favicon.svg');
    return { ok: r.ok, type: r.headers.get('content-type') };
  });
  log(favicon.ok, `[${label}] favicon.svg loads`, favicon.type);

  // 3. Log in
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button.pri');
  await page.waitForSelector('.topbar-nav, #bottom-tabs', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500); // let initial loadData settle

  // 4. Topbar wordmark — visible on desktop, hidden on mobile
  const wordmark = page.locator('button.topbar-wordmark');
  const wmExists = await wordmark.count() > 0;
  log(wmExists, `[${label}] Topbar wordmark element exists`);

  if (wmExists) {
    const visible = await wordmark.isVisible();
    if (viewport.width >= 640) {
      log(visible, `[${label}] Topbar wordmark visible on desktop`);
      const wmSrc = await wordmark.locator('img.theme-logo-dark').getAttribute('src');
      log(/portfoi-wordmark-dark\.png$/.test(wmSrc || ''), `[${label}] Wordmark src correct`, wmSrc);
    } else {
      log(!visible, `[${label}] Topbar wordmark hidden on mobile`);
    }
  }

  // 5. Screenshot of dashboard
  await page.screenshot({ path: `e2e/sprint21-${label}.png`, fullPage: false });
  console.log(`  📸 wrote e2e/sprint21-${label}.png`);

  await ctx.close();
}

try {
  await check({ width: 1280, height: 800 }, 'desktop');
  await check({ width: 390, height: 844 }, 'mobile');
} catch (e) {
  console.error('UNCAUGHT', e);
  fail++;
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
