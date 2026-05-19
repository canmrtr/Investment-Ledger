import { chromium } from 'playwright';

const BASE = 'https://canmrtr.github.io/Investment-Ledger/';
const EMAIL = 'canmerter@me.com';
const PASS = '123456';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) errs.push(m.text()); });

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.locator('input[type=email]').fill(EMAIL);
await page.locator('input[type=password]').fill(PASS);
await page.locator('button.pri').first().click();
await page.waitForTimeout(6000);

// Expand all dashboard blocks by clicking their headers
const blockHeaders = await page.locator('.block-hdr, [class*="block"] [class*="hdr"]').all();
console.log(`Found ${blockHeaders.length} block headers; expanding...`);
for (const h of blockHeaders) { try { await h.click({ timeout: 1500 }); } catch {} }
await page.waitForTimeout(2000);

// Navigate via Ara (Search) tab → AAPL
const ara = page.locator('button').filter({ hasText: /^Ara$/ }).first();
await ara.click();
await page.waitForTimeout(1500);
await page.locator('input[type=text], input[type=search]').first().fill('AAPL');
await page.waitForTimeout(1500);
// Click first AAPL result
const result = page.locator('text=AAPL').first();
await result.click({ timeout: 5000 });
await page.waitForTimeout(4000);

const body = await page.content();
const hasBar = body.includes('Giriş Kalitesi');
const has52H = body.includes('52H');
const verdict = body.match(/(düşük bantta|orta bantta|zirveye yakın)/);

console.log(`\nDetail page loaded`);
console.log(`"Giriş Kalitesi" rendered: ${hasBar}`);
console.log(`"52H" label rendered: ${has52H}`);
console.log(`Verdict word: ${verdict ? verdict[0] : 'NONE'}`);
console.log(`Page errors: ${errs.length}`);
if (errs.length) errs.slice(0,3).forEach(e => console.log('  - ' + e.slice(0,150)));

await page.screenshot({ path: '/tmp/sprint22-52w-bar.png', fullPage: false });

await browser.close();
