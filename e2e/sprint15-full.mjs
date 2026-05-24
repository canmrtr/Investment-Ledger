/**
 * Investment Ledger — Sprint 15 Full E2E Test
 * Tests: Login, Dashboard, AnalysisTab, SearchTab, WatchlistTab, Hamburger Menu
 * Usage: IL_EMAIL=... IL_PASS=... node e2e/sprint15-full.mjs
 */
import { chromium } from 'playwright';

const BASE  = 'https://canmrtr.github.io/Investment-Ledger/';
const EMAIL = process.env.IL_EMAIL || 'canmerter85@gmail.com';
const PASS  = process.env.IL_PASS  || '';

if (!PASS) {
  console.error('ERROR: IL_PASS environment variable is required.');
  console.error('Usage: IL_EMAIL=... IL_PASS=... node e2e/sprint15-full.mjs');
  process.exit(1);
}

let passed = 0, failed = 0;
const consoleErrors = [];
const suiteResults = {};

function log(suite, ok, label, detail = '') {
  const prefix = ok ? 'PASS' : 'FAIL';
  if (ok) {
    passed++;
    console.log(`  [${prefix}] ${label}${detail ? '  — ' + detail : ''}`);
  } else {
    failed++;
    console.error(`  [${prefix}] ${label}${detail ? '  — ' + detail : ''}`);
  }
  if (!suiteResults[suite]) suiteResults[suite] = [];
  suiteResults[suite].push({ ok, label, detail });
}

async function screenshot(page, name) {
  const path = `/tmp/il-fail-${name}.png`;
  try { await page.screenshot({ path, fullPage: true }); } catch {}
  console.log(`  Screenshot: ${path}`);
  return path;
}

async function clickTabByText(page, texts) {
  for (const text of texts) {
    try {
      // Try bottom tabs first
      const bottomBtns = await page.$$('#bottom-tabs button');
      for (const btn of bottomBtns) {
        const txt = await btn.textContent();
        if (txt && texts.some(t => txt.includes(t))) {
          await btn.click();
          return true;
        }
      }
      // Try any clickable element with text
      await page.click(`text=${text}`, { timeout: 3000 });
      return true;
    } catch {}
  }
  return false;
}

const browser = await chromium.launch({ headless: false, slowMo: 350 });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await ctx.newPage();

// Collect console errors
page.on('console', msg => {
  if (msg.type() === 'error') {
    const text = msg.text();
    consoleErrors.push(text);
  }
});
page.on('pageerror', err => {
  consoleErrors.push(`[JS CRASH] ${err.message}`);
});

try {

  // ─────────────────────────────────────────────────────────────
  // SUITE 1: LOGIN
  // ─────────────────────────────────────────────────────────────
  console.log('\n=== Suite 1: Login ===');

  const res = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  log('login', res?.status() === 200, 'Sayfa yuklendi', `HTTP ${res?.status()}`);

  await page.waitForTimeout(2500);

  const emailInput = await page.$('input[type="email"]');
  log('login', !!emailInput, 'Email input gorunur');

  const passInput = await page.$('input[type="password"]');
  log('login', !!passInput, 'Password input gorunur');

  if (!emailInput || !passInput) {
    await screenshot(page, 'login-no-inputs');
    throw new Error('Login form bulunamadi');
  }

  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.keyboard.press('Enter');

  let loginOk = false;
  try {
    await page.waitForSelector('#topbar, #shell, #app-main', { timeout: 20000 });
    loginOk = true;
    log('login', true, 'Giris basarili — App shell gorundu');
  } catch {
    log('login', false, 'Giris basarisiz — shell/topbar gorunmedi');
    await screenshot(page, 'login-fail');
    throw new Error('Login failed');
  }

  await page.waitForTimeout(4000); // let data load

  // ─────────────────────────────────────────────────────────────
  // SUITE 2: DASHBOARD
  // ─────────────────────────────────────────────────────────────
  console.log('\n=== Suite 2: Dashboard ===');

  // Navigate to dashboard tab (first bottom tab or first nav item)
  try {
    const firstTab = await page.$('#bottom-tabs button:first-child');
    if (firstTab) await firstTab.click();
    await page.waitForTimeout(2000);
  } catch {}

  const bodyText1 = await page.textContent('body');
  log('dashboard', !!(bodyText1?.includes('Maliyet') || bodyText1?.includes('maliyet')), 'KPI "Maliyet" gorunur');
  log('dashboard', !!(bodyText1?.includes('Piyasa') || bodyText1?.includes('piyasa')), 'KPI "Piyasa Degeri" gorunur');
  log('dashboard', !!(bodyText1?.includes('₺') || bodyText1?.includes('$')), 'Para birimi sembolü gorunur');

  const posRow = await page.$('.pos-row, .empty-card, [class*="block"]');
  log('dashboard', !!posRow, 'Pozisyon satiri veya empty-card mevcut');

  const svg = await page.$('svg');
  log('dashboard', !!svg, 'SVG element mevcut (pie/grafik)');

  // ─────────────────────────────────────────────────────────────
  // SUITE 3: ANALYSIS TAB
  // ─────────────────────────────────────────────────────────────
  console.log('\n=== Suite 3: AnalysisTab ===');

  const errsBefore = consoleErrors.length;
  const analysisOpened = await clickTabByText(page, ['Analiz', 'analysis']);
  await page.waitForTimeout(3000);

  if (analysisOpened) {
    log('analysis', true, 'AnalysisTab acildi');
  } else {
    log('analysis', false, 'AnalysisTab acilamadi');
    await screenshot(page, 'analysis-open-fail');
  }

  const bodyText2 = await page.textContent('body');

  log('analysis', !!(bodyText2?.includes('Performans') || bodyText2?.includes('Getiri')), '"Performans/Getiri" bolumu gorunur');
  log('analysis', !!bodyText2?.includes('Dağılım'), '"Dagilim" bolumu gorunur');
  log('analysis', !!(bodyText2?.includes('Risk')), '"Risk" bolumu gorunur');
  log('analysis', !!(bodyText2?.includes('Komisyon')), '"Komisyon" kartı gorunur');
  log('analysis', !!(bodyText2?.includes('Break-Even') || bodyText2?.includes('Kırılım') || bodyText2?.includes('Break')), 'BreakEven kartı gorunur');
  log('analysis', !!bodyText2?.includes('Konsantrasyon'), 'Konsantrasyon Riski kartı gorunur');
  log('analysis', !!(bodyText2?.includes('Kur Risk') || bodyText2?.includes('FX') || bodyText2?.includes('Döviz')), 'Kur Riski (FX) kartı gorunur');

  const errsAfter = consoleErrors.length;
  const newErrors = consoleErrors.slice(errsBefore, errsAfter).filter(e =>
    e.includes('TypeError') || e.includes('ReferenceError') || e.includes('Cannot read') || e.includes('CRASH')
  );
  log('analysis', newErrors.length === 0, 'AnalysisTab JS crash yok', newErrors[0]?.slice(0, 100) || '');

  if (newErrors.length > 0 || !bodyText2?.includes('Konsantrasyon')) {
    await screenshot(page, 'analysis-state');
  }

  // ─────────────────────────────────────────────────────────────
  // SUITE 4: SEARCH TAB
  // ─────────────────────────────────────────────────────────────
  console.log('\n=== Suite 4: SearchTab ===');

  const searchErrorsBefore = consoleErrors.length;
  const searchOpened = await clickTabByText(page, ['Ara', 'Search', 'ara']);
  await page.waitForTimeout(3000);

  if (searchOpened) {
    log('search', true, 'SearchTab acildi');
  } else {
    log('search', false, 'SearchTab acilamadi');
    await screenshot(page, 'search-open-fail');
  }

  const searchInput = await page.$('input[type="search"], input[type="text"], input[placeholder]');
  log('search', !!searchInput, 'Arama input alani gorunur');

  if (searchInput) {
    try {
      await searchInput.click({ timeout: 3000 });
      await page.keyboard.type('AAPL', { delay: 100 });
      await page.waitForTimeout(2500);

      const bodyTextSearch = await page.textContent('body');
      const hasAAPL = bodyTextSearch?.includes('AAPL') || bodyTextSearch?.includes('Apple');
      log('search', !!hasAAPL, 'AAPL araması sonuç getirdi');

      if (!hasAAPL) {
        await screenshot(page, 'search-no-aapl');
      }

      // Clear
      await searchInput.click({ clickCount: 3 });
      await page.keyboard.press('Backspace');
    } catch (e) {
      log('search', false, 'Arama yazma/sonuç hatasi', e.message.slice(0, 80));
    }
  }

  // Check for 401 errors from ticker-list fetch
  const searchErrors = consoleErrors.slice(searchErrorsBefore).filter(e =>
    e.includes('401') || e.includes('403') || e.includes('500')
  );
  log('search', searchErrors.length === 0, 'SearchTab API hata yok (401/403/500)', searchErrors[0]?.slice(0, 100) || '');

  // ─────────────────────────────────────────────────────────────
  // SUITE 5: WATCHLIST TAB
  // ─────────────────────────────────────────────────────────────
  console.log('\n=== Suite 5: WatchlistTab ===');

  const watchOpened = await clickTabByText(page, ['Watchlist', 'watchlist', 'İzle']);
  await page.waitForTimeout(2000);

  if (watchOpened) {
    log('watchlist', true, 'WatchlistTab acildi');
    const bodyText3 = await page.textContent('body');
    // Either shows items or empty-card
    const hasContent = bodyText3?.includes('İzle') || bodyText3?.includes('Watchlist') ||
                       await page.$('.empty-card') !== null;
    log('watchlist', !!hasContent, 'WatchlistTab icerik veya empty-card gorunur');
  } else {
    log('watchlist', false, 'WatchlistTab acilamadi');
    await screenshot(page, 'watchlist-open-fail');
  }

  // ─────────────────────────────────────────────────────────────
  // SUITE 6: HAMBURGER MENU
  // ─────────────────────────────────────────────────────────────
  console.log('\n=== Suite 6: Hamburger Menu ===');

  // Try clicking the first button in topbar (hamburger)
  let hamburgerOpened = false;
  const topbarBtns = await page.$$('#topbar button');
  if (topbarBtns.length > 0) {
    try {
      await topbarBtns[0].click();
      await page.waitForTimeout(1000);
      hamburgerOpened = true;
      log('hamburger', true, 'Hamburger menu tıklandı');
    } catch (e) {
      log('hamburger', false, 'Hamburger ilk button tıklama hatasi', e.message.slice(0, 60));
    }
  } else {
    // Try by aria-label or class
    try {
      await page.click('#topbar button:first-child, button.hamburger, [aria-label*="menu"]', { timeout: 5000 });
      await page.waitForTimeout(1000);
      hamburgerOpened = true;
      log('hamburger', true, 'Hamburger menu acildi (fallback)');
    } catch (e) {
      log('hamburger', false, 'Hamburger menu acilamadi', e.message.slice(0, 80));
      await screenshot(page, 'hamburger-fail');
    }
  }

  if (hamburgerOpened) {
    const bodyHamb = await page.textContent('body');
    const hasSignOut = bodyHamb?.includes('Çıkış') || bodyHamb?.includes('Sign Out') ||
                       bodyHamb?.includes('Oturumu') || bodyHamb?.includes('çıkış');
    log('hamburger', !!hasSignOut, 'Hamburger menude SignOut/Cikis butonu gorunur');

    const hasSettings = bodyHamb?.includes('Ayarlar') || bodyHamb?.includes('Settings');
    log('hamburger', !!hasSettings, 'Hamburger menude Ayarlar gorunur');

    const hasProfile = bodyHamb?.includes('Profil') || bodyHamb?.includes('canmerter') || bodyHamb?.includes('@');
    log('hamburger', !!hasProfile, 'Hamburger menude profil bilgisi gorunur');

    if (!hasSignOut) {
      await screenshot(page, 'hamburger-no-signout');
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // Final screenshot of app state
  await page.screenshot({ path: '/tmp/il-sprint15-final.png', fullPage: true });
  console.log('\n  Final screenshot: /tmp/il-sprint15-final.png');

} catch (err) {
  console.error(`\n[FATAL] ${err.message}`);
  try { await page.screenshot({ path: '/tmp/il-sprint15-fatal.png', fullPage: true }); } catch {}
  failed++;
} finally {
  await browser.close();
}

// ─────────────────────────────────────────────────────────────
// CONSOLE ERRORS SUMMARY
// ─────────────────────────────────────────────────────────────
console.log('\n=== Console Hatalar Ozeti ===');
if (consoleErrors.length === 0) {
  console.log('  Hic console error yok — temiz');
} else {
  const critical = consoleErrors.filter(e =>
    e.includes('401') || e.includes('500') ||
    e.includes('TypeError') || e.includes('ReferenceError') ||
    e.includes('Cannot read') || e.includes('CRASH') ||
    e.includes('SyntaxError')
  );
  const authErrors = consoleErrors.filter(e => e.includes('401') || e.includes('403'));
  const serverErrors = consoleErrors.filter(e => e.includes('500') || e.includes('502') || e.includes('503'));
  const jsErrors = consoleErrors.filter(e => e.includes('TypeError') || e.includes('ReferenceError') || e.includes('Cannot read') || e.includes('CRASH'));

  if (authErrors.length > 0) {
    console.error(`  AUTH HATALARI (${authErrors.length}):`);
    authErrors.slice(0, 5).forEach(e => console.error(`    ${e.slice(0, 150)}`));
  }
  if (serverErrors.length > 0) {
    console.error(`  SUNUCU HATALARI (${serverErrors.length}):`);
    serverErrors.slice(0, 5).forEach(e => console.error(`    ${e.slice(0, 150)}`));
  }
  if (jsErrors.length > 0) {
    console.error(`  JS HATALARI (${jsErrors.length}):`);
    jsErrors.slice(0, 5).forEach(e => console.error(`    ${e.slice(0, 150)}`));
  }
  const other = consoleErrors.filter(e => !critical.includes(e));
  if (other.length > 0) {
    console.log(`  Diger hatalar (${other.length}):`);
    other.slice(0, 3).forEach(e => console.log(`    ${e.slice(0, 100)}`));
  }
}

// ─────────────────────────────────────────────────────────────
// FINAL RESULTS
// ─────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────');
console.log(`Sonuc: ${passed}/${passed + failed} gecti | ${failed} basarisiz`);
console.log('─────────────────────────────────────────');
for (const [suite, results] of Object.entries(suiteResults)) {
  const s = results.filter(r => r.ok).length;
  const f = results.filter(r => !r.ok).length;
  const status = f === 0 ? 'PASS' : (s === 0 ? 'FAIL' : 'PARTIAL');
  console.log(`  ${suite.padEnd(12)} ${status}   (${s}/${s+f})`);
}
console.log('─────────────────────────────────────────');

process.exit(failed > 0 ? 1 : 0);
