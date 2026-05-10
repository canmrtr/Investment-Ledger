import { chromium } from 'playwright';

const BASE = 'https://canmrtr.github.io/Investment-Ledger/';
const results = [];
const consoleErrors = [];
const pageErrors = [];

function log(status, suite, step, msg) {
  const line = `[${status}] [${suite} / ${step}] ${msg}`;
  console.log(line);
  results.push({ status, step, msg });
}

const browser = await chromium.launch({ headless: false, slowMo: 400 });
const page = await browser.newPage();

page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', err => pageErrors.push(err.message));

try {
  console.log('\n--- Investment Ledger Login UX Smoke Test ---\n');
  console.log('Waiting 10s for GitHub Pages to settle...');
  await new Promise(r => setTimeout(r, 10000));

  console.log('Navigating to', BASE);
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log('Waiting up to 15s for Babel to compile...');
  try {
    await page.waitForSelector(
      'input[type="email"], input[placeholder*="mail"], input[placeholder*="posta"], input[name="email"]',
      { timeout: 15000 }
    );
    console.log('Login form rendered.\n');
  } catch (e) {
    log('FAIL', 'Login UX', 'Babel', 'Login form did NOT appear within 15s');
    await page.screenshot({ path: '/tmp/il-fail-babel.png' });
    await browser.close();
    process.exit(1);
  }

  // Extra render time
  await page.waitForTimeout(2000);

  // Initial screenshot
  await page.screenshot({ path: '/tmp/il-login-initial.png', fullPage: false });
  console.log('Screenshot: /tmp/il-login-initial.png\n');

  // ─────────────────────────────────────────────────────────
  // Check 1: Logo placement — ABOVE the card, not inside it
  // ─────────────────────────────────────────────────────────
  try {
    // Find all images, log them
    const allImgs = await page.$$('img');
    console.log(`  Images on page: ${allImgs.length}`);
    for (const img of allImgs) {
      const src = await img.getAttribute('src');
      const alt = await img.getAttribute('alt');
      const cls = await img.getAttribute('class');
      console.log(`    img: src="${src}" alt="${alt}" class="${cls}"`);
    }

    // Find logo image
    let logoEl = null;
    for (const img of allImgs) {
      const src = await img.getAttribute('src') || '';
      const alt = await img.getAttribute('alt') || '';
      const cls = await img.getAttribute('class') || '';
      if (src.toLowerCase().includes('logo') || alt.toLowerCase().includes('logo') ||
          alt.toLowerCase().includes('portfoi') || cls.toLowerCase().includes('logo')) {
        logoEl = img;
        break;
      }
    }

    // Find form element
    const formEl = await page.$('form');

    if (!logoEl) {
      log('WARN', 'Login UX', 'Check 1 - Logo Placement', 'No logo img found — checking for text/div logo');
      const logoDiv = await page.$('[class*="logo"], [id*="logo"]');
      if (logoDiv && formEl) {
        const logoBox = await logoDiv.boundingBox();
        const formBox = await formEl.boundingBox();
        if (logoBox && formBox) {
          const logoBottom = logoBox.y + logoBox.height;
          if (logoBottom <= formBox.y + 10) {
            log('OK', 'Login UX', 'Check 1 - Logo Placement', `Logo div is above form (logoBottom=${Math.round(logoBottom)}, formTop=${Math.round(formBox.y)})`);
          } else {
            log('FAIL', 'Login UX', 'Check 1 - Logo Placement', `Logo div may be inside/below form (logoBottom=${Math.round(logoBottom)}, formTop=${Math.round(formBox.y)})`);
            await page.screenshot({ path: '/tmp/il-fail-step1.png' });
          }
        }
      } else {
        log('WARN', 'Login UX', 'Check 1 - Logo Placement', 'Could not find logo element at all');
      }
    } else if (!formEl) {
      log('WARN', 'Login UX', 'Check 1 - Logo Placement', 'Logo found but no <form> element — trying card heuristic');
    } else {
      const logoBox = await logoEl.boundingBox();
      const formBox = await formEl.boundingBox();
      console.log(`  Logo box: ${JSON.stringify(logoBox)}`);
      console.log(`  Form box: ${JSON.stringify(formBox)}`);

      if (logoBox && formBox) {
        const logoBottom = logoBox.y + logoBox.height;
        const formTop = formBox.y;

        // Also check if logo is contained within form via DOM
        const logoInsideForm = await page.evaluate((logoSrc) => {
          const form = document.querySelector('form');
          const imgs = document.querySelectorAll('img');
          for (const img of imgs) {
            if ((img.src || '').includes(logoSrc.replace(/^.*\//, ''))) {
              return form ? form.contains(img) : null;
            }
          }
          return null;
        }, await logoEl.getAttribute('src') || '');

        if (logoInsideForm === true) {
          log('FAIL', 'Login UX', 'Check 1 - Logo Placement', `Logo is DOM-child of <form> (inside the card). logoBottom=${Math.round(logoBottom)}, formTop=${Math.round(formTop)}`);
          await page.screenshot({ path: '/tmp/il-fail-step1.png' });
        } else if (logoBottom <= formTop + 10) {
          log('OK', 'Login UX', 'Check 1 - Logo Placement', `Logo is above the form card (logoBottom=${Math.round(logoBottom)}px <= formTop=${Math.round(formTop)}px)`);
        } else {
          log('FAIL', 'Login UX', 'Check 1 - Logo Placement', `Logo does NOT appear above form (logoBottom=${Math.round(logoBottom)}, formTop=${Math.round(formTop)}, insideForm=${logoInsideForm})`);
          await page.screenshot({ path: '/tmp/il-fail-step1.png' });
        }
      } else {
        log('WARN', 'Login UX', 'Check 1 - Logo Placement', 'Bounding boxes unavailable');
      }
    }
  } catch (e) {
    log('FAIL', 'Login UX', 'Check 1 - Logo Placement', `Error: ${e.message}`);
    await page.screenshot({ path: '/tmp/il-fail-step1.png' });
  }

  // ─────────────────────────────────────────────────────────
  // Check 2: Logo size ~100px, horizontally centered
  // ─────────────────────────────────────────────────────────
  try {
    const allImgs = await page.$$('img');
    let logoEl = null;
    for (const img of allImgs) {
      const src = await img.getAttribute('src') || '';
      const alt = await img.getAttribute('alt') || '';
      if (src.toLowerCase().includes('logo') || alt.toLowerCase().includes('logo') ||
          alt.toLowerCase().includes('portfoi')) {
        logoEl = img;
        break;
      }
    }

    if (!logoEl) {
      log('WARN', 'Login UX', 'Check 2 - Logo Size', 'Logo not found');
    } else {
      const box = await logoEl.boundingBox();
      const computedH = await logoEl.evaluate(el => window.getComputedStyle(el).height);
      const computedW = await logoEl.evaluate(el => window.getComputedStyle(el).width);
      console.log(`  Logo computed: height=${computedH} width=${computedW}`);
      console.log(`  Logo bounding box: ${JSON.stringify(box)}`);

      if (box) {
        // Height check (~100px, allow 70-130 range)
        if (box.height >= 80 && box.height <= 130) {
          log('OK', 'Login UX', 'Check 2 - Logo Height', `Logo height=${Math.round(box.height)}px (expected ~100px)`);
        } else if (box.height > 0) {
          log('WARN', 'Login UX', 'Check 2 - Logo Height', `Logo height=${Math.round(box.height)}px (expected ~100px)`);
        } else {
          log('FAIL', 'Login UX', 'Check 2 - Logo Height', `Logo height=0 (not rendered?)`);
          await page.screenshot({ path: '/tmp/il-fail-step2.png' });
        }

        // Centering check
        const viewport = page.viewportSize();
        const logoCenterX = box.x + box.width / 2;
        const viewCenterX = viewport.width / 2;
        const offset = Math.abs(logoCenterX - viewCenterX);
        if (offset <= 50) {
          log('OK', 'Login UX', 'Check 2 - Logo Centered', `Logo centered (offset=${Math.round(offset)}px from viewport center)`);
        } else {
          log('WARN', 'Login UX', 'Check 2 - Logo Centered', `Logo off-center by ${Math.round(offset)}px`);
        }
      }
    }
  } catch (e) {
    log('FAIL', 'Login UX', 'Check 2 - Logo Size', `Error: ${e.message}`);
    await page.screenshot({ path: '/tmp/il-fail-step2.png' });
  }

  // ─────────────────────────────────────────────────────────
  // Check 3: Input heights ~44px
  // ─────────────────────────────────────────────────────────
  try {
    const emailInput = await page.$('input[type="email"]') ||
                       await page.$('input[placeholder*="mail"]') ||
                       await page.$('input[placeholder*="posta"]');
    const passInput = await page.$('input[type="password"]');

    for (const [label, el] of [['Email', emailInput], ['Password', passInput]]) {
      if (!el) {
        log('FAIL', 'Login UX', `Check 3 - ${label} Input Height`, `${label} input not found`);
        await page.screenshot({ path: `/tmp/il-fail-step3-${label.toLowerCase()}.png` });
        continue;
      }
      const box = await el.boundingBox();
      const computedH = await el.evaluate(e => window.getComputedStyle(e).height);
      const minH = await el.evaluate(e => window.getComputedStyle(e).minHeight);
      console.log(`  ${label} input: computed height=${computedH}, minHeight=${minH}, bbox height=${box?.height}`);

      const h = box ? box.height : 0;
      if (h >= 42 && h <= 50) {
        log('OK', 'Login UX', `Check 3 - ${label} Input Height`, `${label} input height=${Math.round(h)}px (expected 44px)`);
      } else if (h >= 36) {
        log('WARN', 'Login UX', `Check 3 - ${label} Input Height`, `${label} input height=${Math.round(h)}px (expected 44px, slightly short)`);
      } else {
        log('FAIL', 'Login UX', `Check 3 - ${label} Input Height`, `${label} input height=${Math.round(h)}px — too small`);
        await page.screenshot({ path: `/tmp/il-fail-step3-${label.toLowerCase()}.png` });
      }
    }
  } catch (e) {
    log('FAIL', 'Login UX', 'Check 3 - Input Heights', `Error: ${e.message}`);
    await page.screenshot({ path: '/tmp/il-fail-step3.png' });
  }

  // ─────────────────────────────────────────────────────────
  // Check 4: Button height >= 44px
  // ─────────────────────────────────────────────────────────
  try {
    // Try submit button first, then any button
    let btn = await page.$('button[type="submit"]');
    if (!btn) {
      const btns = await page.$$('button');
      for (const b of btns) {
        const txt = await b.textContent();
        if (txt && (txt.includes('Giriş') || txt.includes('Login') || txt.includes('Giris'))) {
          btn = b;
          break;
        }
      }
    }
    if (!btn) btn = await page.$('button');

    if (!btn) {
      log('FAIL', 'Login UX', 'Check 4 - Button Height', 'No button found on page');
      await page.screenshot({ path: '/tmp/il-fail-step4.png' });
    } else {
      const box = await btn.boundingBox();
      const text = (await btn.textContent() || '').trim();
      const computedH = await btn.evaluate(e => window.getComputedStyle(e).height);
      const minH = await btn.evaluate(e => window.getComputedStyle(e).minHeight);
      console.log(`  Button "${text}": computed height=${computedH}, minHeight=${minH}, bbox height=${box?.height}`);

      const h = box ? box.height : 0;
      if (h >= 44) {
        log('OK', 'Login UX', 'Check 4 - Button Height', `"${text}" button height=${Math.round(h)}px >= 44px (minHeight CSS: ${minH})`);
      } else if (h >= 40) {
        log('WARN', 'Login UX', 'Check 4 - Button Height', `"${text}" button height=${Math.round(h)}px — slightly under 44px target`);
      } else {
        log('FAIL', 'Login UX', 'Check 4 - Button Height', `"${text}" button height=${Math.round(h)}px < 44px`);
        await page.screenshot({ path: '/tmp/il-fail-step4.png' });
      }
    }
  } catch (e) {
    log('FAIL', 'Login UX', 'Check 4 - Button Height', `Error: ${e.message}`);
    await page.screenshot({ path: '/tmp/il-fail-step4.png' });
  }

  // ─────────────────────────────────────────────────────────
  // Check 5: Form functionality — typing + no JS errors
  // ─────────────────────────────────────────────────────────
  try {
    const emailInput = await page.$('input[type="email"]') ||
                       await page.$('input[placeholder*="mail"]');
    const passInput = await page.$('input[type="password"]');

    if (emailInput) {
      await emailInput.fill('test@example.com');
      const val = await emailInput.inputValue();
      if (val === 'test@example.com') {
        log('OK', 'Login UX', 'Check 5 - Email Typing', 'Email input accepts text');
      } else {
        log('FAIL', 'Login UX', 'Check 5 - Email Typing', `Got "${val}" instead of "test@example.com"`);
        await page.screenshot({ path: '/tmp/il-fail-step5-email.png' });
      }
    } else {
      log('FAIL', 'Login UX', 'Check 5 - Email Typing', 'Email input not found');
    }

    if (passInput) {
      await passInput.fill('testpassword');
      const val = await passInput.inputValue();
      if (val === 'testpassword') {
        log('OK', 'Login UX', 'Check 5 - Password Typing', 'Password input accepts text');
      } else {
        log('FAIL', 'Login UX', 'Check 5 - Password Typing', `Password input value mismatch`);
        await page.screenshot({ path: '/tmp/il-fail-step5-pass.png' });
      }
    } else {
      log('FAIL', 'Login UX', 'Check 5 - Password Typing', 'Password input not found');
    }

    // Check button is enabled
    let btn = await page.$('button[type="submit"]');
    if (!btn) {
      const btns = await page.$$('button');
      for (const b of btns) {
        const txt = await b.textContent();
        if (txt && (txt.includes('Giriş') || txt.includes('Login'))) { btn = b; break; }
      }
    }
    if (!btn) btn = await page.$('button');

    if (btn) {
      const disabled = await btn.isDisabled();
      if (!disabled) {
        log('OK', 'Login UX', 'Check 5 - Button Enabled', 'Login button is enabled');
      } else {
        log('FAIL', 'Login UX', 'Check 5 - Button Enabled', 'Login button is disabled');
        await page.screenshot({ path: '/tmp/il-fail-step5-btn.png' });
      }
    }

    // Clear fields
    if (emailInput) await emailInput.fill('');
    if (passInput) await passInput.fill('');

  } catch (e) {
    log('FAIL', 'Login UX', 'Check 5 - Form Functionality', `Error: ${e.message}`);
    await page.screenshot({ path: '/tmp/il-fail-step5.png' });
  }

  // Wait for any delayed errors
  await page.waitForTimeout(1500);

  // JS errors check
  const filteredConsole = consoleErrors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('net::ERR_') &&
    !e.includes('Failed to load resource')
  );
  const filteredPage = pageErrors.filter(e => !e.includes('favicon'));

  if (filteredConsole.length === 0 && filteredPage.length === 0) {
    log('OK', 'Login UX', 'Check 5 - No JS Errors', 'No JavaScript errors detected');
  } else {
    const allErrs = [...filteredConsole, ...filteredPage];
    log('FAIL', 'Login UX', 'Check 5 - No JS Errors', `${allErrs.length} JS error(s): ${allErrs.slice(0, 3).join(' | ')}`);
    await page.screenshot({ path: '/tmp/il-fail-step5-jserr.png' });
  }

  if (consoleErrors.length > 0) {
    console.log('\n  All console errors:');
    consoleErrors.forEach(e => console.log(`    - ${e}`));
  }

  // Final screenshot
  await page.screenshot({ path: '/tmp/il-login-final.png', fullPage: false });
  console.log('\nFinal screenshot: /tmp/il-login-final.png');

} catch (err) {
  console.error('Fatal test error:', err.message);
  await page.screenshot({ path: '/tmp/il-login-fatal.png' }).catch(() => {});
} finally {
  const passed = results.filter(r => r.status === 'OK').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  console.log('\n─────────────────────────────');
  console.log(`Sonuc: ${passed} gecti | ${failed} basarisiz | ${warned} uyari`);
  console.log('Screenshots: /tmp/il-login-initial.png, /tmp/il-login-final.png');
  console.log('─────────────────────────────\n');
  await browser.close();
}
