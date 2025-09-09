// popup.js - generate a QR code for the current tab URL

// Uses global QRCode from vendor/qrcode.min.js loaded via <script> in popup.html

const $ = (s) => document.querySelector(s);
const qrBox = $('#qr');
const urlInput = $('#url');
const copyBtn = $('#copy');

async function getActiveTabUrl() {
  // Test hook: if ?u=<url> is provided, prefer it (works in chrome-extension://, http(s) and file://)
  const paramUrl = new URLSearchParams(location.search).get('u');
  if (paramUrl) return paramUrl;
  // Otherwise, in extension popup context use activeTab
  if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.url || '';
  }
  return '';
}

function renderQR(text) {
  qrBox.innerHTML = '';
  const size = 240; // px
  // QRCode is provided by qrcode.min.js (global)
  // eslint-disable-next-line no-undef
  new QRCode(qrBox, {
    text,
    width: size,
    height: size,
    correctLevel: QRCode.CorrectLevel.M,
  });
}

async function main() {
  try {
    console.log('[popup] starting');
    const url = await getActiveTabUrl();
    console.log('[popup] resolved url:', url);
    console.log('[popup] QRCode in window:', typeof window !== 'undefined' ? typeof window.QRCode : 'no-window');
    urlInput.value = url;
    renderQR(url);
    console.log('[popup] renderQR done');
    qrBox.setAttribute('aria-busy', 'false');
  } catch (e) {
    console.error(e);
    qrBox.textContent = 'Failed to get current tab URL';
    qrBox.setAttribute('aria-busy', 'false');
  }
}

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(urlInput.value);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
  } catch (e) {
    copyBtn.textContent = 'Copy failed';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
  }
});

main();
