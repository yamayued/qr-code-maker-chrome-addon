const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const extPath = path.resolve(__dirname, '..');
  const userDataDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'qr-ext-'));

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
    ],
  });

  // Wait for extension service worker to appear
  let sw = null;
  try {
    sw = await context.waitForEvent('serviceworker', { timeout: 10000 });
  } catch (e) {
    // ignore
  }
  if (!sw) {
    // Open any page to nudge SW
    const page = await context.newPage();
    await page.goto('https://example.com');
    try { sw = await context.waitForEvent('serviceworker', { timeout: 10000 }); } catch {}
  }
  if (!sw) throw new Error('Service worker not detected');

  // Try to evaluate in SW to get runtime id
  const extId = await sw.evaluate(() => new Promise((resolve) => {
    try {
      chrome.runtime.getPlatformInfo(() => resolve(chrome.runtime.id));
    } catch (e) {
      resolve(null);
    }
  }));
  if (!extId) throw new Error('Failed to read chrome.runtime.id from SW');

  const page = await context.newPage();
  const popupUrl = `chrome-extension://${extId}/popup.html?u=${encodeURIComponent('https://example.com')}`;
  page.on('console', (m) => console.log('[popup]', m.type(), m.text()));
  await page.goto(popupUrl);
  const urlVal = await page.locator('#url').inputValue();
  await page.screenshot({ path: require('path').join(process.cwd(), 'e2e', 'popup-before.png'), fullPage: true });
  const qrCount = await page.locator('#qr img, #qr canvas, #qr table, #qr svg').count();
  if (urlVal !== 'https://example.com') throw new Error(`Unexpected URL value: ${urlVal}`);
  if (qrCount === 0) {
    const html = await page.locator('#qr').innerHTML();
    console.log('[debug] #qr innerHTML (first 300):', html.slice(0, 300));
    throw new Error('QR element not found');
  }

  // Test: download PNG
  const downloadsDir = require('path').join(process.cwd(), 'e2e', 'artifacts');
  require('fs').mkdirSync(downloadsDir, { recursive: true });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#download').click(),
  ]);
  const target = require('path').join(downloadsDir, await download.suggestedFilename());
  await download.saveAs(target);
  const size = require('fs').statSync(target).size;
  if (size < 1000) throw new Error('Downloaded PNG seems too small');
  console.log('[ok] Downloaded PNG:', target, size, 'bytes');

  // Test: change size to 300 and re-render, then assert QR element grows
  await page.locator('#size').selectOption('300');
  await page.locator('#apply').click();
  // Poll for size increase
  let ok = false; let w = 0; const t0 = Date.now();
  while (Date.now() - t0 < 2000) {
    w = await page.evaluate(() => parseInt(getComputedStyle(document.querySelector('#qr')).width, 10));
    if (w >= 280) { ok = true; break; }
    await page.waitForTimeout(100);
  }
  if (!ok) throw new Error('QR size did not increase as expected');
  console.log('[ok] Settings UI increased QR size to', w);

  // Upload a red logo and assert center pixel turns red-ish
  const logoPath = require('path').join(process.cwd(), 'assets', 'logo-red.svg');
  await page.setInputFiles('#logoFile', logoPath);
  await page.locator('#logoScale').fill('30');
  await page.locator('#apply').click();
  // Sample center pixel from final <img>
  const centerRGB = await page.evaluate(() => {
    const img = document.querySelector('#qr img');
    const size = 300;
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    return new Promise((resolve) => {
      if (!img) return resolve({r:0,g:0,b:0});
      const i = new Image();
      i.onload = () => {
        ctx.drawImage(i, 0, 0, size, size);
        const pixel = ctx.getImageData(Math.floor(size/2), Math.floor(size/2), 1, 1).data;
        resolve({ r: pixel[0], g: pixel[1], b: pixel[2] });
      };
      i.src = img.src;
    });
  });
  if (!(centerRGB.r > 150 && centerRGB.g < 100 && centerRGB.b < 100)) {
    throw new Error('Center pixel not red after logo overlay: ' + JSON.stringify(centerRGB));
  }
  console.log('[ok] Center logo overlay detected via pixel:', centerRGB);
  console.log('[ok] Extension popup rendered with ID', extId);
  await context.close();
})();
