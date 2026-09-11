# Odoo Groove

**One-click Odoo developer mode toggle for Chrome & Edge.**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blueviolet)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#license)
[![Chrome 102+](https://img.shields.io/badge/Chrome-102%2B-orange)](https://www.google.com/chrome/)
[![Edge](https://img.shields.io/badge/Edge-Chromium-blue)](https://www.microsoft.com/edge)

> A lightweight Manifest V3 extension that toggles
> [Odoo Developer Mode](https://www.odoo.com/documentation/19.0/applications/general/developer_mode.html)
> (`debug=1` / `debug=0`) on the current page with one click. An original
> monkey character raises its hand when developer mode is ON and lowers it
> when OFF.

> **AR** — إضافة متصفح خفيفة لتفعيل/إيقاف وضع المطوّر في Odoo بنقرة واحدة،
> بقرد أصلي يتغيّر شكله حسب الحالة، ودعم كامل للعربية (RTL).

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Install](#install-development)
- [Project Structure](#project-structure)
- [Development](#development)
- [Testing](#testing)
- [Manual QA Checklist](#manual-qa-checklist-chrome--edge)
- [i18n](#i18n)
- [Publishing](#publishing)
- [Roadmap](#roadmap-post-mvp)
- [License](#license)

---

## Features

| Feature | Details |
| --- | --- |
| **One-click toggle** | Flip `?debug=1` ↔ `?debug=0` on the active Odoo tab |
| **Advanced modes** | Normal (`debug=1`), Assets (`debug=assets`), Tests (`debug=tests`), Off (`debug=0`) |
| **Visual feedback** | Monkey character, status line, and domain shown for each state |
| **8 visual states** | ON · OFF · Assets · Tests · Unknown · Unsupported · Loading · Error |
| **Keyboard shortcut** | `Ctrl+Shift+O` (macOS `Command+Shift+O`), remappable |
| **Bilingual UI** | English + Arabic with full RTL layout support |
| **URL-safe** | Preserves pathname, existing query params, and hash fragments |
| **Minimal footprint** | No host permissions, no remote code, no analytics, no backend |
| **Accessibility** | Keyboard-only navigation, focus rings, screen reader announcements |
| **Reduced motion** | Respects `prefers-reduced-motion` system preference |

---

## How It Works

```
Click toolbar icon → Popup opens
        │
        ▼
  Read active tab URL  (via activeTab permission)
        │
        ▼
  Classify URL state   (src/url-state.js)
  ┌─────────────────────────────────┐
  │  on / off / assets / tests /    │
  │  unknown / unsupported          │
  └─────────────────────────────────┘
        │
        ▼
  User clicks toggle
        │
        ▼
  Rebuild URL (URL + searchParams)
  Preserve existing params & hash
        │
        ▼
  chrome.tabs.update(newUrl)
  Wait for navigation to finish
        │
        ▼
  Re-read state → update UI
```

**Odoo detection** is deliberately conservative. A page is treated as Odoo
when the `debug` param is present, the path matches known Odoo UI roots
(`/web`, `/odoo`, `/my`, `/website`, `/shop`, …), or the hostname contains
`odoo`. Anything else shows *"This page doesn't look like Odoo"*.

The extension does **not** change account permissions, run Odoo-internal
commands, or touch server settings — it only toggles the `debug` URL param.

---

## Install (Development)

1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this project folder (the one with
   `manifest.json`).
4. Open any Odoo page, click the monkey.

### Permissions

| Permission | Why |
| --- | --- |
| `activeTab` | Read/update the current tab only after you click the icon or shortcut |
| `storage` | Save UI language and default debug mode locally |

No `tabs`, `scripting`, `cookies`, `webRequest`, or `host_permissions` are used.

---

## Project Structure

```
odoo-groove/
├── _locales/                  # i18n strings
│   ├── en/messages.json       #   English
│   └── ar/messages.json       #   Arabic
├── dist/                      # Pre-built ZIP for store upload
│   └── odoo-groove-1.0.0.zip
├── scripts/                   # Build & utility scripts (Python)
│   ├── check_i18n.py          #   Locale key parity checker
│   ├── make_icons.py          #   Icon generator (Pillow)
│   └── package.py             #   Store ZIP packager
├── src/                       # Extension source
│   ├── assets/icons/          #   Icons (16/32/48/128 px)
│   ├── core.js                #   Core toggle logic
│   ├── service-worker.js      #   Background service worker (ES module)
│   ├── url-state.js           #   URL classification engine
│   ├── storage.js             #   chrome.storage abstraction
│   ├── popup.{html,js,css}    #   Popup UI
│   ├── options.{html,js,css}  #   Options page
│   └── tokens.css             #   Design tokens / CSS variables
├── tests/                     # Test suite
│   ├── fixtures.json          #   Shared URL test fixtures
│   ├── run.py                 #   Python test runner
│   ├── python/                #   Python mirror of url-state.js
│   ├── js/                    #   Node.js unit tests (node --test)
│   └── browser/               #   Browser-based test harness
├── manifest.json              # Chrome/Edge Manifest V3
├── package.json               # npm scripts (no dependencies)
└── README.md
```

---

## Development

### Prerequisites

- **Python 3** — for packaging, icon generation, and i18n checks
- **Node.js ≥ 18** — for running JS unit tests

### Quick Start

```sh
# Load unpacked in chrome://extensions, then:
npm test            # Python URL engine tests
npm run test:js     # Node.js unit tests (url-state + core + popup-guard)
npm run check-i18n  # Locale key parity (en ↔ ar) + placeholder validation
```

### Testing

| Command | What it runs |
| --- | --- |
| `npm test` | Python mirror of `url-state.js` via `tests/run.py` |
| `npm run test:js` | Node.js built-in test runner: `url-state` (20) + `core` (10) + `popup-guard` (2) |
| `npm run check-i18n` | Validates locale key parity between `en` and `ar` |
| `npm run test:browser` | Starts `python3 -m http.server 8000` — open `http://localhost:8000/tests/browser/` |

### Utilities

| Command | What it does |
| --- | --- |
| `npm run icons` | Regenerate extension icons from source (requires Pillow) |
| `npm run package` | Build `dist/odoo-groove-<version>.zip` for store upload |

### Preview Without Chrome APIs

Open `src/popup.html` directly in a browser with demo query params:

```
src/popup.html?demo=on        # Developer mode ON
src/popup.html?demo=assets    # Assets mode
src/popup.html?demo=unknown   # Unknown state
src/popup.html?demo=error     # Error state
src/popup.html?host=staging.example.com  # Custom hostname
```

---

## Manual QA Checklist (Chrome & Edge)

Run these by hand before shipping — they require a real browser:

| # | Test | Expected Result |
| --- | --- | --- |
| 1 | **Load & install** | No errors in `chrome://extensions`, icon renders at 16/32/48 px, popup opens |
| 2 | **Toggle cycle** | Click ON → `?debug=1`, monkey arm up, status "Developer mode: ON" · Click OFF → `?debug=0`, arm down |
| 3 | **Advanced modes** | Normal / Assets / Tests / Off each applies the correct `debug` value |
| 4 | **URL preservation** | `?debug=1&action=jump#action=...` toggles `debug` while keeping `action` and hash intact |
| 5 | **Unsupported URLs** | `chrome://`, `edge://`, `javascript:`, `about:`, `file://` → "doesn't look like Odoo", button inert |
| 6 | **Non-Odoo page** | Unrelated site → unsupported state, no URL mutation |
| 7 | **Keyboard shortcut** | `Ctrl+Shift+O` / `Command+Shift+O` toggles; remapping works in shortcuts page |
| 8 | **RTL layout** | Browser language Arabic → flipped layout, hostname stays LTR |
| 9 | **Accessibility** | Tab+Enter toggle, arrow-key radio group, visible focus ring, screen reader announcements |
| 10 | **Retry on error** | Toggle fails (e.g. tab closed) → Error state with Retry button re-attempts |

---

## i18n

Strings live in `_locales/{en,ar}/messages.json`. The UI language follows
the browser by default and can be overridden in the extension options
(`chrome://extensions` → Details → Extension options), which is also where
the default debug mode is set.

Run `npm run check-i18n` to verify that both locales share identical keys.

---

## Publishing

### Chrome Web Store

1. Run `npm run package` to build `dist/odoo-groove-<version>.zip`.
2. Create a developer account at
   [Chrome Web Store DevConsole](https://chrome.google.com/webstore/devconsole).
3. Provide icons, screenshots, and a short privacy statement (no data
   collection).
4. Upload the ZIP.

### Microsoft Edge Add-ons

The same Chromium package works for Edge. Submit via
[Microsoft Edge Partner Center](https://partner.microsoft.com/dashboard/microsoftedge).
Edge requires Manifest V3 for new submissions.

---

## Roadmap (Post-MVP)

- Saved profiles per environment (production / staging / local) with a
  production guard
- Separate keyboard shortcuts per debug mode
- Side panel UI for Edge
- "Open a new URL with debug" option
- Odoo version display (without telemetry)

---

## License

MIT — see `package.json` for details.

The monkey is an original character. No third-party assets are used.