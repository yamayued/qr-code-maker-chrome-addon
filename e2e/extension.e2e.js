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
  console.log('[ok] Extension popup rendered with ID', extId);
  await context.close();
})();
