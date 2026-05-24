/**
 * Investment Ledger — Sprint 15 E2E Test
 * Tests: Login, Dashboard, AnalysisTab, SearchTab, WatchlistTab, Hamburger Menu
 * Usage: IL_EMAIL=... IL_PASS=... node /tmp/il-sprint15-test.mjs
 */
import { chromium } from 'playwright';

const BASE  = 'https://canmrtr.github.io/Investment-Ledger/';
const EMAIL = process.env.IL_EMAIL || 'canmerter85@gmail.com';
const PASS  = process.env.IL_PASS  || '';

if (!PASS) {
  console.error('ERROR: IL_PASS environment variable is required.');
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
  await page.screenshot({ path, fullPage: true });
  console.log(`  Screenshot: ${path}`);
  return path;
}

const browser = await chromium.launch({ headless: false, slowMo: 400 });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await ctx.newPage();

// Collect console errors
page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
  }
});

// Also track uncaught exceptions
page.on('pageerror', err => {
  consoleErrors.push(`[JS CRASH] ${err.message}`);
});

try {

  // ────────────────────────────────────────────
  // SUITE 1: LOGIN
  // ────────────────────────────────────────────
  console.log('\n=== Suite 1: Login ===');

  const res = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  log('login', res?.status() === 200, 'Sayfa yüklendi', `HTTP ${res?.status()}`);

  // Wait for React to hydrate
  await page.waitForTimeout(2000);

  const emailInput = await page.$('input[type="email"]');
  log('login', !!emailInput, 'Email input görünür');

  const passInput = await page.$('input[type="password"]');
  log('login', !!passInput, 'Password input görünür');

  if (!emailInput || !passInput) {
    await screenshot(page, 'login-no-inputs');
    console.error('  [FATAL] Login form bulunamadı, tüm auth testleri atlanıyor.');
    await browser.close();
    process.exit(1);
  }

  // Fill credentials and login
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.keyboard.press('Enter');

  // Wait for app shell (topbar or #shell)
  let loginOk = false;
  try {
    await page.waitForSelector('#topbar, #shell, #app-main', { timeout: 20000 });
    loginOk = true;
    log('login', true, 'Giriş başarılı — App shell göründü');
  } catch {
    log('login', false, 'Giriş başarısız — shell/topbar görünmedi');
    await screenshot(page, 'login-fail');
  }

  if (!loginOk) {
    console.error('  [FATAL] Login olmadan devam edilemiyor.');
    await browser.close();
    process.exit(1);
  }

  // Allow data to load
  await page.waitForTimeout(3000);

  // ────────────────────────────────────────────
  // SUITE 2: DASHBOARD
  // ────────────────────────────────────────────
  console.log('\n=== Suite 2: Dashboard ===');

  // Make sure we are on dashboard
  // Try clicking the Dashboard tab (bottom nav or top nav)
  try {
    const dashTab = page.locator('#bottom-tabs button').first();
    await dashTab.click({ timeout: 3000 });
    await page.waitForTimeout(1000);
  } catch {
    // Might already be on dashboard
  }

  // Check KPI / summary cards — look for Maliyet, Piyasa, XIRR text
  const kpiText = await page.textContent('body');
  const hasMaliyet = kpiText?.includes('Maliyet') || kpiText?.includes('maliyet');
  const hasPiyasa  = kpiText?.includes('Piyasa') || kpiText?.includes('piyasa');
  log('dashboard', hasMaliyet, 'Dashboard "Maliyet" KPI görünür');
  log('dashboard', hasPiyasa, 'Dashboard "Piyasa Değeri" KPI görünür');

  // Check for any price/value display (numbers with ₺ or $)
  const hasCurrency = kpiText?.includes('₺') || kpiText?.includes('$');
  log('dashboard', !!hasCurrency, 'Dashboard fiyat/değer gösteriliyor');

  // Check for positions or empty card
  const posRow = await page.$('.pos-row, .empty-card, [class*="pos-row"], [class*="block"]');
  log('dashboard', !!posRow, 'Pozisyon satırı veya empty-card görünür');

  // Check for SVG (pie chart)
  const svg = await page.$('svg');
  log('dashboard', !!svg, 'SVG (pie chart veya grafik) mevcut');

  if (!hasMaliyet || !hasPiyasa) {
    await screenshot(page, 'dashboard-missing-kpi');
  }

  // ────────────────────────────────────────────
  // SUITE 3: ANALYSIS TAB
  // ────────────────────────────────────────────
  console.log('\n=== Suite 3: AnalysisTab ===');

  // Click Analysis tab — look for "Analiz" in nav
  let analysisOpened = false;
  try {
    // Try bottom tabs first
    const bottomBtns = await page.$$('#bottom-tabs button');
    let analysisBtn = null;
    for (const btn of bottomBtns) {
      const txt = await btn.textContent();
      if (txt && (txt.includes('Analiz') || txt.includes('analiz'))) {
        analysisBtn = btn;
        break;
      }
    }
    if (analysisBtn) {
      await analysisBtn.click();
    } else {
      // Try top nav links
      await page.click('text=Analiz', { timeout: 5000 });
    }
    await page.waitForTimeout(2500);
    analysisOpened = true;
    log('analysis', true, 'AnalysisTab açıldı');
  } catch (e) {
    log('analysis', false, 'AnalysisTab açılamadı', e.message.slice(0, 80));
    await screenshot(page, 'analysis-open-fail');
  }

  if (analysisOpened) {
    const bodyText = await page.textContent('body');

    // Check for key section headers
    const hasPerf       = bodyText?.includes('Performans') || bodyText?.includes('Getiri');
    const hasDistrib    = bodyText?.includes('Dağılım');
    const hasFundament  = bodyText?.includes('Fundamental') || bodyText?.includes('Sağlık') || bodyText?.includes('Komisyon');
    const hasRisk       = bodyText?.includes('Risk');

    log('analysis', !!hasPerf, 'AnalysisTab "Performans/Getiri" bölümü görünür');
    log('analysis', !!hasDistrib, 'AnalysisTab "Dağılım" bölümü görünür');
    log('analysis', !!hasFundament, 'AnalysisTab Fundamentals/Komisyon bölümü görünür');
    log('analysis', !!hasRisk, 'AnalysisTab "Risk" bölümü görünür');

    // Specifically check Sprint-15 cards
    const hasBreakEven    = bodyText?.includes('Break-Even') || bodyText?.includes('Kırılım');
    const hasKonsan       = bodyText?.includes('Konsantrasyon');
    const hasFX           = bodyText?.includes('Kur Risk') || bodyText?.includes('FX Risk');
    const hasKomisyon     = bodyText?.includes('Komisyon');

    log('analysis', !!hasBreakEven, 'BreakEven kartı görünür');
    log('analysis', !!hasKonsan, 'Konsantrasyon Riski kartı görünür');
    log('analysis', !!hasFX, 'Kur Riski (FX) kartı görünür');
    log('analysis', !!hasKomisyon, 'Toplam Komisyon kartı görünür');

    if (!hasBreakEven || !hasKonsan || !hasFX || !hasKomisyon) {
      await screenshot(page, 'analysis-missing-cards');
    }

    // Check no JS crash happened while on this tab
    const jsErrors = consoleErrors.filter(e => e.includes('TypeError') || e.includes('ReferenceError') || e.includes('Cannot read'));
    log('analysis', jsErrors.length === 0, 'AnalysisTab JS hatası yok', jsErrors.length > 0 ? jsErrors[0].slice(0, 100) : '');
  }

  // ────────────────────────────────────────────
  // SUITE 4: SEARCH TAB
  // ────────────────────────────────────────────
  console.log('\n=== Suite 4: SearchTab ===');

  let searchOpened = false;
  try {
    // Try bottom tabs
    const bottomBtns = await page.$$('#bottom-tabs button');
    let searchBtn = null;
    for (const btn of bottomBtns) {
      const txt = await btn.textContent();
      if (txt && (txt.includes('Ara') || txt.includes('ara') || txt.includes('Search'))) {
        searchBtn = btn;
        break;
      }
    }
    if (searchBtn) {
      await searchBtn.click();
    } else {
      await page.click('text=Ara', { timeout: 5000 });
    }
    await page.waitForTimeout(2500);
    searchOpened = true;
    log('search', true, 'SearchTab açıldı');
  } catch (e) {
    log('search', false, 'SearchTab açılamadı', e.message.slice(0, 80));
    await screenshot(page, 'search-open-fail');
  }

  if (searchOpened) {
    // Check search input is present
    const searchInput = await page.$('input[type="search"], input[placeholder*="Ara"], input[placeholder*="ara"], input[placeholder*="Ticker"], input[placeholder*="ticker"]');
    log('search', !!searchInput, 'Arama input alanı görünür');

    // Type a ticker and check results appear
    if (searchInput) {
      await searchInput.click();
      await page.keyboard.type('AAPL');
      await page.waitForTimeout(2000);

      const bodyText = await page.textContent('body');
      const hasResult = bodyText?.includes('AAPL') || bodyText?.includes('Apple');
      log('search', !!hasResult, 'AAPL araması sonuç getirdi');

      if (!hasResult) {
        await screenshot(page, 'search-no-result');
      }

      // Clear search
      await searchInput.triple_click?.() || await searchInput.click({ clickCount: 3 });
      await page.keyboard.press('Escape');
    }

    // Check for 401 or ticker-list fetch errors
    const fetchErrors = consoleErrors.filter(e => e.includes('401') || e.includes('ticker') || e.includes('fetch'));
    if (fetchErrors.length > 0) {
      log('search', false, 'SearchTab fetch hatası', fetchErrors[0].slice(0, 120));
    } else {
      log('search', true, 'SearchTab fetch hatası yok');
    }
  }

  // ────────────────────────────────────────────
  // SUITE 5: WATCHLIST TAB
  // ────────────────────────────────────────────
  console.log('\n=== Suite 5: WatchlistTab ===');

  let watchlistOpened = false;
  try {
    const bottomBtns = await page.$$('#bottom-tabs button');
    let wlBtn = null;
    for (const btn of bottomBtns) {
      const txt = await btn.textContent();
      if (txt && (txt.includes('Watchlist') || txt.includes('watchlist') || txt.includes('İzle'))) {
        wlBtn = btn;
        break;
      }
    }
    if (wlBtn) {
      await wlBtn.click();
    } else {
      await page.click('text=Watchlist', { timeout: 5000 });
    }
    await page.waitForTimeout(2000);
    watchlistOpened = true;
    log('watchlist', true, 'WatchlistTab açıldı');
  } catch (e) {
    log('watchlist', false, 'WatchlistTab açılamadı', e.message.slice(0, 80));
    await screenshot(page, 'watchlist-open-fail');
  }

  if (watchlistOpened) {
    const bodyText = await page.textContent('body');
    // Either shows watchlist content or empty card CTA
    const hasContent = bodyText?.includes('İzle') || bodyText?.includes('Watchlist') ||
                       bodyText?.includes('empty') || bodyText?.includes('ekle') ||
                       await page.$('.empty-card, .pos-row, [class*="watch"]');
    log('watchlist', !!hasContent, 'WatchlistTab içerik veya empty-card görünür');
  }

  // ────────────────────────────────────────────
  // SUITE 6: HAMBURGER MENU
  // ────────────────────────────────────────────
  console.log('\n=== Suite 6: Hamburger Menu ===');

  // Find hamburger button (usually in topbar)
  let hamburgerOpened = false;
  try {
    // Try common hamburger selectors
    const hamburger = await page.$('#topbar button:first-child, button[aria-label*="menu"], button[aria-label*="Menu"], #hamburger, .hamburger');
    if (hamburger) {
      await hamburger.click();
    } else {
      // Try to find by position — first button in topbar
      await page.click('#topbar button', { timeout: 5000 });
    }
    await page.waitForTimeout(1000);
    hamburgerOpened = true;
    log('hamburger', true, 'Hamburger menu tıklandı');
  } catch (e) {
    log('hamburger', false, 'Hamburger menu açılamadı', e.message.slice(0, 80));
    await screenshot(page, 'hamburger-fail');
  }

  if (hamburgerOpened) {
    const bodyText = await page.textContent('body');
    const hasSignOut = bodyText?.includes('Çıkış') || bodyText?.includes('SignOut') ||
                       bodyText?.includes('Sign Out') || bodyText?.includes('Oturumu Kapat');
    log('hamburger', !!hasSignOut, 'Hamburger menüde SignOut/Çıkış butonu görünür');

    const hasSettings = bodyText?.includes('Ayarlar') || bodyText?.includes('Settings');
    log('hamburger', !!hasSettings, 'Hamburger menüde Ayarlar görünür');

    if (!hasSignOut) {
      await screenshot(page, 'hamburger-no-signout');
    }

    // Close hamburger by pressing Escape or clicking elsewhere
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // ────────────────────────────────────────────
  // CONSOLE ERRORS SUMMARY
  // ────────────────────────────────────────────
  console.log('\n=== Console Errors ===');
  if (consoleErrors.length === 0) {
    console.log('  Hata bulunamadı — temiz');
  } else {
    const critical = consoleErrors.filter(e =>
      e.includes('401') || e.includes('500') ||
      e.includes('TypeError') || e.includes('ReferenceError') ||
      e.includes('Cannot read') || e.includes('undefined') ||
      e.includes('CRASH') || e.includes('SyntaxError')
    );
    const other = consoleErrors.filter(e => !critical.includes(e));

    if (critical.length > 0) {
      console.error(`  KRITIK HATALAR (${critical.length}):`);
      critical.slice(0, 10).forEach(e => console.error(`    - ${e.slice(0, 150)}`));
    }
    if (other.length > 0) {
      console.log(`  Diger hatalar (${other.length}):`);
      other.slice(0, 5).forEach(e => console.log(`    - ${e.slice(0, 100)}`));
    }
  }

  // Final screenshot
  await page.screenshot({ path: '/tmp/il-sprint15-final.png', fullPage: true });
  console.log('\n  Final screenshot: /tmp/il-sprint15-final.png');

} catch (err) {
  console.error('\n[FATAL]', err.message);
  try { await page.screenshot({ path: '/tmp/il-sprint15-fatal.png', fullPage: true }); } catch {}
  failed++;
} finally {
  await browser.close();
}

// ────────────────────────────────────────────
// RESULTS
// ────────────────────────────────────────────
console.log('\n─────────────────────────────');
console.log(`Sonuc: ${passed}/${passed + failed} gecti | ${failed} basarisiz`);
console.log('─────────────────────────────');

// Per-suite summary
for (const [suite, results] of Object.entries(suiteResults)) {
  const s = results.filter(r => r.ok).length;
  const f = results.filter(r => !r.ok).length;
  const status = f === 0 ? 'PASS' : (s === 0 ? 'FAIL' : 'PARTIAL');
  console.log(`  ${suite.padEnd(12)} ${status} (${s}/${s+f})`);
}

process.exit(failed > 0 ? 1 : 0);
