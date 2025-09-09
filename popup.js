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
const logoFile = $('#logoFile');
const logoScaleInput = $('#logoScale');

let sessionLogoDataUrl = '';

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

async function renderQR(text, opts = {}) {
  qrBox.innerHTML = '';
  const size = Number(opts.size || 240); // px
  const ec = opts.ec || 'M';
  // eslint-disable-next-line no-undef
  new QRCode(qrBox, {
    text,
    width: size,
    height: size,
    correctLevel: getECLevel(ec),
  });
  qrBox.style.width = size + 'px';
  qrBox.style.height = size + 'px';
  if (sessionLogoDataUrl) {
    await overlayLogo(size, sessionLogoDataUrl);
  }
}

async function overlayLogo(size, logoUrl) {
  const baseImg = qrBox.querySelector('img');
  const baseCanvas = qrBox.querySelector('canvas');
  const out = document.createElement('canvas');
  out.width = size; out.height = size;
  const ctx = out.getContext('2d');
  if (baseImg && baseImg.naturalWidth) {
    ctx.drawImage(baseImg, 0, 0, size, size);
  } else if (baseCanvas) {
    ctx.drawImage(baseCanvas, 0, 0, size, size);
  }
  const scalePct = Number(logoScaleInput?.value || 20);
  const logoSize = Math.round(size * Math.max(0, Math.min(scalePct, 100)) / 100);
  const x = Math.round((size - logoSize) / 2);
  const y = Math.round((size - logoSize) / 2);
  // draw white backing to improve readability
  const pad = Math.round(logoSize * 0.08);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - pad, y - pad, logoSize + 2*pad, logoSize + 2*pad);
  await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, x, y, logoSize, logoSize); resolve(); };
    img.onerror = reject;
    img.src = logoUrl;
  });
  const final = new Image();
  final.src = out.toDataURL('image/png');
  qrBox.innerHTML = '';
  qrBox.appendChild(final);
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
    if (saved.logoScale) logoScaleInput.value = String(saved.logoScale);
    await renderQR(url, saved);
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
  const logoScale = Number(logoScaleInput.value || 20);
  const settings = { size, ec, logoScale };
  try {
    await saveSettings(settings);
  } catch (e) {
    console.warn('Failed to save settings', e);
  }
  await renderQR(urlInput.value, settings);
});

logoFile.addEventListener('change', async (ev) => {
  const f = ev.target.files?.[0];
  if (!f) return;
  const dataUrl = await fileToDataUrl(f);
  sessionLogoDataUrl = dataUrl;
  await renderQR(urlInput.value, { size: Number(sizeSel.value), ec: ecSel.value, logoScale: Number(logoScaleInput.value || 20) });
});

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('read failed'));
    fr.onload = () => resolve(String(fr.result));
    fr.readAsDataURL(file);
  });
}

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
      chrome.storage?.sync?.get(['size', 'ec', 'logoScale'], (res) => resolve(res || {}));
    } catch (e) {
      resolve({});
    }
  });
}

main();
