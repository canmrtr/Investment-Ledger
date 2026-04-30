/**
 * E2E smoke test for Investment Ledger live app.
 * Usage:  node e2e/smoke.mjs
 * Env:    IL_EMAIL, IL_PASS  (optional — unauthenticated checks run without them)
 */
import { chromium } from 'playwright';

const BASE  = 'https://canmrtr.github.io/Investment-Ledger/';
const EMAIL = process.env.IL_EMAIL || '';
const PASS  = process.env.IL_PASS  || '';

let passed = 0, failed = 0;

function log(ok, label, detail = '') {
  if (ok) { passed++; console.log(`✅ ${label}${detail ? '  — ' + detail : ''}`); }
  else     { failed++; console.error(`❌ ${label}${detail ? '  — ' + detail : ''}`); }
}

const browser = await chromium.launch();
const ctx     = await browser.newContext({ viewport: { width: 390, height: 844 } }); // iPhone size
const page    = await ctx.newPage();

try {
  // ── Unauthenticated checks ──────────────────────────────────────────
  const res = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
  log(res?.status() === 200, 'App loads', `HTTP ${res?.status()}`);

  // Login form
  const emailInput = await page.$('input[type="email"]');
  log(!!emailInput, 'Login email input present');

  const passInput = await page.$('input[type="password"]');
  log(!!passInput, 'Login password input present');

  // IL brand mark
  const brand = await page.$('text=IL');
  log(!!brand, 'IL brand mark visible');

  // ── Authenticated checks (requires IL_EMAIL + IL_PASS) ──────────────
  if (EMAIL && PASS) {
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASS);
    await page.keyboard.press('Enter');

    try {
      await page.waitForSelector('#topbar, #shell, [id*="app"]', { timeout: 15000 });
      log(true, 'Login succeeds');
    } catch {
      log(false, 'Login succeeds', 'shell/topbar not found after submit');
    }

    // Bottom nav tabs
    const tabs = await page.$$('#bottom-tabs button, #topbar nav a, [role="tablist"] button');
    log(tabs.length >= 4, 'Nav tabs present', `found ${tabs.length}`);

    // Dashboard renders (KPI cards or position block)
    await page.waitForTimeout(2000);
    const dashboard = await page.$('#app-main, [class*="kpi"], [class*="block"]');
    log(!!dashboard, 'Dashboard renders');

    // Settings tab navigates
    const settingsBtn = await page.$('text=Ayarlar, button:has-text("Ayarlar")');
    if (settingsBtn) {
      await settingsBtn.click();
      await page.waitForTimeout(1000);
      const settingsContent = await page.$('text=Fiyat, text=Bakım, text=Export');
      log(!!settingsContent, 'Settings tab loads');
    }
  } else {
    console.log('ℹ️  Auth tests skipped — set IL_EMAIL and IL_PASS env vars to enable');
  }
} catch (err) {
  console.error('Fatal:', err.message);
  failed++;
} finally {
  await browser.close();
}

const total = passed + failed;
console.log(`\n${total} checks: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
