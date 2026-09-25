## QR for Current Page (Chrome Extension)

Generate a QR code for the URL of the current tab. Handy for opening the page on your phone.

### Install (Developer Mode)

- Open Chrome → `chrome://extensions/`
- Toggle `Developer mode` (top-right)
- Click `Load unpacked` and select this folder
- Pin the extension and click the toolbar icon to show the QR code

### Build/Dependencies

No build step or dependencies. The extension ships a small bundled QR generator (`vendor/qrcode.min.js`).

### Permissions

- `activeTab` — grants temporary access to the current tab URL when you click the extension.

### Files

- `manifest.json` — Chrome MV3 manifest
- `popup.html` — popup UI
- `popup.js` — logic to fetch the current tab URL and render the QR
- `vendor/qrcode.min.js` — bundled QR generator

### License Notice

This repository includes `qrcode.min.js` by Kazuhiko Arase under the MIT License. Source: https://github.com/kazuhikoarase/qrcode-generator.


## Developer / 開発・運営元

- 開発・運営: [株式会社こころび（Cocorobi Inc.）公式サイト](https://cocorobi.co.jp)
- 提供ソリューション: 紹介AIエージェント、営業支援DXソリューション
