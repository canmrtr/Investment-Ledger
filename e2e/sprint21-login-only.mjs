// Screenshots the Login page (no auto-login) so we can verify the new lockup.
import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const [w, h, name] of [[1280, 800, 'login-desktop'], [390, 844, 'login-mobile']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8765/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear()); // ensure no auto-login
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `e2e/sprint21-${name}.png`, fullPage: false });
  console.log(`wrote e2e/sprint21-${name}.png`);
  await ctx.close();
}
await browser.close();
