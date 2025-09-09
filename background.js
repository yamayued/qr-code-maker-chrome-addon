// background.js - minimal service worker for E2E test discovery
// Logs the extension ID so external automation can read it and construct
// chrome-extension://<ID>/ URLs for testing popup.html.

console.log("[qr-ext] runtime.id:", chrome.runtime.id);

// Keep SW alive briefly so Playwright can see the console log on startup.
setTimeout(() => {
  // no-op; service worker will suspend automatically later
}, 3000);

