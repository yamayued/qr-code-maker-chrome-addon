// popup.js - generate a QR code for the current tab URL

import './vendor/qrcode.min.js';

const $ = (s) => document.querySelector(s);
const qrBox = $('#qr');
const urlInput = $('#url');
const copyBtn = $('#copy');

async function getActiveTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url || '';
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
    const url = await getActiveTabUrl();
    urlInput.value = url;
    renderQR(url);
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

