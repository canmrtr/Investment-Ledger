/**
 * Investment Ledger — Unauthenticated smoke test (no password needed)
 */
import { chromium } from 'playwright';

const BASE = 'https://canmrtr.github.io/Investment-Ledger/';
let passed = 0, failed = 0;
const consoleErrors = [];

function log(ok, label, detail = '') {
  if (ok) { passed++; console.log(`  [PASS] ${label}${detail ? '  — ' + detail : ''}`); }
  else     { failed++; console.error(`  [FAIL] ${label}${detail ? '  — ' + detail : ''}`); }
}

const browser = await chromium.launch({ headless: false, slowMo: 400 });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();

page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', err => consoleErrors.push(`[JS CRASH] ${err.message}`));

try {
  console.log('\n=== Unauthenticated Checks ===');

  const res = await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  log(res?.status() === 200, 'Sayfa yuklendi', `HTTP ${res?.status()}`);

  await page.waitForTimeout(3000);

  const emailInput = await page.$('input[type="email"]');
  log(!!emailInput, 'Email input gorunur');

  const passInput = await page.$('input[type="password"]');
  log(!!passInput, 'Password input gorunur');

  // Check for logo / brand
  const body = await page.textContent('body');
  const hasLogo = body?.includes('Portfoi') || body?.includes('IL') || await page.$('img[src*="logo"], img[src*="Logo"]');
  log(!!hasLogo, 'Logo/Brand gorunur');

  // Check for login button
  const loginBtn = await page.$('button[type="submit"], button:has-text("Giriş"), button:has-text("Login"), input[type="submit"]');
  log(!!loginBtn, 'Login butonu gorunur');

  // Check page title
  const title = await page.title();
  log(!!title && title.length > 0, 'Sayfa title mevcut', title);

  await page.screenshot({ path: '/tmp/il-login-screen.png', fullPage: true });
  console.log('  Screenshot: /tmp/il-login-screen.png');

  console.log('\n=== Console Errors (unauthenticated) ===');
  if (consoleErrors.length === 0) {
    console.log('  Hata yok');
  } else {
    consoleErrors.forEach(e => console.error(`  - ${e.slice(0, 150)}`));
  }

} catch (err) {
  console.error('[FATAL]', err.message);
  failed++;
} finally {
  await browser.close();
}

console.log(`\nSonuc: ${passed}/${passed + failed} gecti`);
process.exit(failed > 0 ? 1 : 0);
