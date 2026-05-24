import { chromium } from 'playwright';

const BASE = 'https://canmrtr.github.io/Investment-Ledger/';
const EMAIL = 'canmerter@me.com';
const PASS = '123456';

const browser = await chromium.launch({ headless: false, slowMo: 400 });
const results = [];

function pass(label, detail = '') {
  const msg = `[PASS] ${label}${detail ? ' — ' + detail : ''}`;
  console.log(msg);
  results.push({ ok: true, label });
}

function fail(label, detail = '') {
  const msg = `[FAIL] ${label}${detail ? ' — ' + detail : ''}`;
  console.log(msg);
  results.push({ ok: false, label, detail });
}

async function screenshot(page, name) {
  const p = `/tmp/il-sprint21-${name}.png`;
  await page.screenshot({ path: p });
  console.log(`  Screenshot: ${p}`);
}

// ── Static asset checks ────────────────────────────────────────────────────

async function checkStaticAssets() {
  const checks = [
    { url: `${BASE}favicon.svg`, ct: 'image/svg+xml', body: '<svg viewBox="0 0 512 512"', label: 'favicon.svg returns 200 with SVG content' },
    { url: `${BASE}icon-192.png`, ct: 'image/png', label: 'icon-192.png returns 200 PNG' },
    { url: `${BASE}icon-512.png`, ct: 'image/png', label: 'icon-512.png returns 200 PNG' },
    { url: `${BASE}manifest.json`, ct: 'application/json', label: 'manifest.json returns 200 JSON' },
  ];

  for (const c of checks) {
    try {
      const res = await fetch(c.url);
      const ct = res.headers.get('content-type') || '';
      if (!res.ok) { fail(c.label, `HTTP ${res.status}`); continue; }
      if (!ct.includes(c.ct.split('/')[1])) { fail(c.label, `content-type: ${ct}`); continue; }
      if (c.body) {
        const text = await res.text();
        if (!text.includes(c.body)) { fail(c.label, `Body missing: ${c.body}`); continue; }
      }
      pass(c.label);
    } catch (e) {
      fail(c.label, String(e));
    }
  }

  // manifest.json icon paths check
  try {
    const res = await fetch(`${BASE}manifest.json`);
    const json = await res.json();
    const icons = json.icons || [];
    const has192 = icons.some(i => i.src && i.src.includes('icon-192'));
    const has512 = icons.some(i => i.src && i.src.includes('icon-512'));
    if (has192 && has512) {
      pass('manifest.json icons array contains icon-192 and icon-512');
    } else {
      fail('manifest.json icons array contains icon-192 and icon-512', JSON.stringify(icons.map(i => i.src)));
    }
  } catch (e) {
    fail('manifest.json icon paths check', String(e));
  }
}

// ── Playwright page checks ─────────────────────────────────────────────────

const page = await browser.newPage();
const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', err => consoleErrors.push('PAGE ERROR: ' + err.message));

try {
  // 1. Static asset checks (no browser needed)
  console.log('\n-- Static Asset Checks --');
  await checkStaticAssets();

  // 2. Login page — lockup image check
  console.log('\n-- Login Page Checks --');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });

  // Check for theme-logo-dark or theme-logo-light img on login page
  const darkLogoEl = await page.$('img.theme-logo-dark');
  const lightLogoEl = await page.$('img.theme-logo-light');

  if (darkLogoEl || lightLogoEl) {
    const el = darkLogoEl || lightLogoEl;
    const src = await el.getAttribute('src');
    if (src && (src.includes('portfoi-lockup-dark') || src.includes('portfoi-lockup-light'))) {
      pass('Login page shows new lockup image', `src=${src}`);
    } else {
      fail('Login page lockup image src does not match portfoi-lockup-*', `src=${src}`);
      await screenshot(page, 'login-lockup');
    }
  } else {
    fail('Login page has no img.theme-logo-dark or img.theme-logo-light');
    await screenshot(page, 'login-no-logo');
  }

  // Check no JS console errors on login page
  const loginErrors = [...consoleErrors];
  consoleErrors.length = 0;
  if (loginErrors.length === 0) {
    pass('No JS console errors on Login page');
  } else {
    fail('JS console errors on Login page', loginErrors.slice(0, 3).join(' | '));
  }

  // 3. Login
  console.log('\n-- Login & Dashboard Checks --');
  const emailInput = await page.$('input[type="email"]');
  const passInput = await page.$('input[type="password"]');
  if (!emailInput || !passInput) {
    fail('Login form inputs not found — cannot proceed');
  } else {
    await emailInput.fill(EMAIL);
    await passInput.fill(PASS);
    await passInput.press('Enter');

    // Wait for dashboard
    try {
      await page.waitForSelector('.kpi-card, .summary-card, [class*="card"]', { timeout: 15000 });
      pass('Login succeeded — Dashboard loaded');
    } catch (e) {
      fail('Login did not reach Dashboard within 15s');
      await screenshot(page, 'dashboard-fail');
    }

    // Give page a moment to settle
    await page.waitForTimeout(1500);

    // 4. Topbar wordmark
    const wordmarkEl = await page.$('.topbar-wordmark');
    if (wordmarkEl) {
      const imgInWordmark = await wordmarkEl.$('img');
      if (imgInWordmark) {
        const src = await imgInWordmark.getAttribute('src');
        if (src && (src.includes('portfoi-wordmark-dark') || src.includes('portfoi-wordmark-light') || src.includes('portfoi-wordmark'))) {
          pass('.topbar-wordmark contains wordmark img', `src=${src}`);
        } else {
          fail('.topbar-wordmark img src does not match portfoi-wordmark-*', `src=${src}`);
          await screenshot(page, 'topbar-wordmark-src');
        }
      } else {
        fail('.topbar-wordmark found but contains no img');
        await screenshot(page, 'topbar-wordmark-no-img');
      }
    } else {
      fail('.topbar-wordmark element not found in DOM');
      await screenshot(page, 'topbar-no-wordmark');
    }

    // 5. Mobile viewport — .topbar-wordmark should be hidden at 390x844
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);

    const wordmarkMobile = await page.$('.topbar-wordmark');
    if (wordmarkMobile) {
      const isVisible = await wordmarkMobile.isVisible();
      if (!isVisible) {
        pass('.topbar-wordmark is hidden on 390px mobile viewport');
      } else {
        // Also check computed style
        const display = await page.evaluate(() => {
          const el = document.querySelector('.topbar-wordmark');
          if (!el) return 'not found';
          return window.getComputedStyle(el).display;
        });
        if (display === 'none') {
          pass('.topbar-wordmark is hidden (display:none) on 390px mobile viewport');
        } else {
          fail('.topbar-wordmark is VISIBLE on 390px mobile viewport', `display=${display}`);
          await screenshot(page, 'mobile-wordmark-visible');
        }
      }
    } else {
      // Not in DOM at all on mobile — also acceptable
      pass('.topbar-wordmark not rendered on 390px mobile viewport');
    }

    // Restore desktop viewport for console error check
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(500);

    // 6. No JS console errors on Dashboard
    const dashErrors = [...consoleErrors];
    consoleErrors.length = 0;
    if (dashErrors.length === 0) {
      pass('No JS console errors on Dashboard page');
    } else {
      fail('JS console errors on Dashboard page', dashErrors.slice(0, 3).join(' | '));
    }
  }

} catch (err) {
  console.log(`[ERROR] Unexpected: ${err.message}`);
  await screenshot(page, 'unexpected-error');
} finally {
  await browser.close();

  // Summary
  console.log('\n' + '─'.repeat(50));
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`Sonuc: ${passed}/${results.length} gecti | ${failed} basarisiz`);
  if (failed > 0) {
    console.log('\nFailed checks:');
    results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.label}: ${r.detail || ''}`));
  }
  console.log('─'.repeat(50));
}
