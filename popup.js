// popup.js - generate a QR code for the current tab URL

// Uses global QRCode from vendor/qrcode.min.js loaded via <script> in popup.html

const $ = (s) => document.querySelector(s);
const qrBox = $('#qr');
const urlInput = $('#url');
const copyBtn = $('#copy');
const downloadBtn = $('#download');
const sizeSel = $('#size');
const ecSel = $('#ec');
const applyBtn = $('#apply');

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

function getECLevel(letter) {
  // eslint-disable-next-line no-undef
  const levels = QRCode.CorrectLevel;
  return levels[letter] ?? levels.M;
}

function renderQR(text, opts = {}) {
  qrBox.innerHTML = '';
  const size = Number(opts.size || 240); // px
  const ec = opts.ec || 'M';
  // QRCode is provided by qrcode.min.js (global)
  // eslint-disable-next-line no-undef
  new QRCode(qrBox, {
    text,
    width: size,
    height: size,
    correctLevel: getECLevel(ec),
  });
  qrBox.style.width = size + 'px';
  qrBox.style.height = size + 'px';
}

async function main() {
  try {
    console.log('[popup] starting');
    const url = await getActiveTabUrl();
    console.log('[popup] resolved url:', url);
    console.log('[popup] QRCode in window:', typeof window !== 'undefined' ? typeof window.QRCode : 'no-window');
    urlInput.value = url;
    const saved = await loadSettings();
    if (saved.size) sizeSel.value = String(saved.size);
    if (saved.ec) ecSel.value = saved.ec;
    renderQR(url, saved);
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

downloadBtn.addEventListener('click', async () => {
  try {
    // Prefer the generated <img>, fall back to canvas
    const img = qrBox.querySelector('img');
    let dataUrl = '';
    if (img && img.src.startsWith('data:image')) {
      dataUrl = img.src;
    } else {
      const canvas = qrBox.querySelector('canvas');
      if (canvas && canvas.toDataURL) dataUrl = canvas.toDataURL('image/png');
    }
    if (!dataUrl) throw new Error('QR image not ready');
    const a = document.createElement('a');
    a.href = dataUrl;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `qr-${ts}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.error('Download failed', e);
  }
});

applyBtn.addEventListener('click', async () => {
  const size = Number(sizeSel.value);
  const ec = ecSel.value;
  const settings = { size, ec };
  try {
    await saveSettings(settings);
  } catch (e) {
    console.warn('Failed to save settings', e);
  }
  renderQR(urlInput.value, settings);
});

function saveSettings(obj) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage?.sync?.set(obj, () => resolve());
    } catch (e) {
      resolve(); // non-extension context; no-op
    }
  });
}

function loadSettings() {
  return new Promise((resolve) => {
    try {
      chrome.storage?.sync?.get(['size', 'ec'], (res) => resolve(res || {}));
    } catch (e) {
      resolve({});
    }
  });
}

main();
