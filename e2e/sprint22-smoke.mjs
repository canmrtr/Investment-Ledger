import { chromium } from 'playwright';

const BASE = 'https://canmrtr.github.io/Investment-Ledger/';
const EMAIL = 'canmerter@me.com';
const PASS = '123456';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const consoleErrors = [];
const reqs422 = [];
page.on('console', (msg) => {
  if (msg.type() === 'error' && !msg.text().includes('Failed to load resource') && !msg.text().includes('favicon')) {
    consoleErrors.push(msg.text());
  }
});
page.on('pageerror', e => consoleErrors.push('[UNCAUGHT] ' + e.message));
page.on('response', async (r) => {
  if (r.status() === 422 && r.url().includes('fetch-fundamentals')) {
    let body = '';
    try { body = (await r.text()).slice(0, 150); } catch {}
    reqs422.push({ url: r.url().split('/').pop(), req: r.request().postData()?.slice(0, 100), resp: body });
  }
});

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
await page.locator('input[type=email]').fill(EMAIL);
await page.locator('input[type=password]').fill(PASS);
await page.locator('button.pri').first().click();
await page.waitForTimeout(5000);

console.log('[1/4] Login OK');

// Dashboard already on
await page.waitForTimeout(2000);
console.log('[2/4] Dashboard rendered');

// Analiz
const analiz = await page.locator('button').filter({ hasText: /^Analiz$/ }).first();
await analiz.click();
await page.waitForTimeout(15000);
console.log('[3/4] Analiz tab loaded');

// Check Dayanıklılık verdict cümlesi exists
const dayBody = await page.content();
const hasDayanklVerdict = dayBody.includes('Portföyün piyasa düşüşlerine karşı dayanıklılığı');
console.log(`[4/4] Dayanıklılık verdict cümlesi present: ${hasDayanklVerdict}`);

console.log(`\n=== RESULT ===`);
console.log(`422 from fetch-fundamentals: ${reqs422.length}`);
if (reqs422.length) reqs422.forEach(r => console.log(`  - ${r.url} | req: ${r.req} | resp: ${r.resp}`));
console.log(`Console errors: ${consoleErrors.length}`);
if (consoleErrors.length) consoleErrors.slice(0, 5).forEach(e => console.log('  - ' + e.slice(0, 200)));

await browser.close();
