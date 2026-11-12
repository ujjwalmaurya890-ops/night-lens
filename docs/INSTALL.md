# Install NightLens

NightLens builds one extension per browser. Pick your browser below; every command assumes you are
in the repository root.

```bash
npm install
```

| Browser | Build | Load from |
|---|---|---|
| Chrome | `npm run build:chrome` | `dist/chrome` |
| Edge | `npm run build:edge` | `dist/edge` |
| Brave | `npm run build:brave` | `dist/brave` |
| Opera / Opera GX | `npm run build:opera` | `dist/opera` |
| Vivaldi | `npm run build:chrome` | `dist/chrome` |
| Firefox | `npm run build:firefox` | `dist/firefox` (temporary add-on) |
| Safari | `npm run build:safari` | convert with Xcode first - see [SAFARI_INSTALL.md](SAFARI_INSTALL.md) |

`npm run build` produces all six at once. Detailed per-browser steps:

- [Chrome](#google-chrome) · [Edge](EDGE_INSTALL.md) · [Brave](BRAVE_INSTALL.md) ·
  [Opera](#opera--opera-gx) · [Firefox](FIREFOX_INSTALL.md) · [Safari](SAFARI_INSTALL.md)

## Google Chrome

1. `npm run build:chrome`
2. Open `chrome://extensions`
3. Turn on **Developer mode** (top right)
4. **Load unpacked** → select `dist/chrome`
5. Pin NightLens (puzzle-piece icon → pin)
6. Open any `http`/`https` page. Dark mode applies if it is enabled and the site is not excluded.

After changing code: `npm run build:chrome`, then **Reload** (↻) on the NightLens card and reload
open tabs (an old content script cannot reconnect to a reloaded extension).

## Microsoft Edge

See [EDGE_INSTALL.md](EDGE_INSTALL.md). Short version: `edge://extensions` → **Developer mode** →
**Load unpacked** → `dist/edge`.

## Brave

See [BRAVE_INSTALL.md](BRAVE_INSTALL.md). Short version: `brave://extensions` → **Developer mode**
→ **Load unpacked** → `dist/brave`.

## Opera / Opera GX

1. `npm run build:opera`
2. Go to `opera://extensions` (works the same in Opera GX)
3. Enable **Developer mode**
4. **Load unpacked** → select `dist/opera`

Opera asks for confirmation on start-up for unpacked extensions; allow it. Opera's manifest key
`minimum_opera_version` is set to 95 in `manifests/opera.json`.

## Vivaldi and other Chromium forks

Vivaldi, Arc, SigmaOS and similar forks use the Chromium build:

1. `npm run build:chrome`
2. Open the fork's extensions page (`vivaldi://extensions`) and load `dist/chrome` unpacked.

These forks are *expected* to work but have not been tested here - see
[BROWSER_COMPATIBILITY.md](BROWSER_COMPATIBILITY.md).

## Mozilla Firefox

See [FIREFOX_INSTALL.md](FIREFOX_INSTALL.md). Short version: `about:debugging#/runtime/this-firefox`
→ **Load Temporary Add-on…** → `dist/firefox/manifest.json`. A permanent install requires a signed
XPI (`web-ext sign`), which needs an AMO account.

## Apple Safari

See [SAFARI_INSTALL.md](SAFARI_INSTALL.md). Safari requires macOS, Xcode and Apple's
`safari-web-extension-converter`; `dist/safari/browser-extension` is the converter's input, not an
installable extension.

## Requirements

- **Node ≥ 22.12** (Vite 8 requires a modern Node). Check with `node -v`.
- No global build tools.

## Windows notes

- Use PowerShell or Terminal; `npm install` once per checkout.
- Paths with spaces are fine, but copy the exact folder: `dist\chrome`, `dist\edge`,
  `dist\brave`, `dist\opera`.
- If PowerShell blocks `npm.ps1`: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- To load Firefox builds on Windows, `about:debugging` → **Load Temporary Add-on…** → choose
  `dist\firefox\manifest.json`.

## Updating

```bash
git pull
npm install        # only if package.json changed
npm run build      # or build:<target>
```

Then reload the extension in the browser's extensions page and reload the tabs you are testing.

## Verify the installation

1. The NightLens toolbar icon opens the popup with a **Current website** card.
2. On a light page the popup shows **Active** and the page turns dark.
3. Toggling the global switch writes immediately; the change also reaches already-open tabs.
4. Settings → About shows the NightLens version and the browser it detected.
5. Disable NightLens and the page returns to its original appearance.

## Debugging

| Surface | How to open it |
|---|---|
| Popup console | Right-click the NightLens icon → **Inspect popup** |
| Options console | Open the settings page → F12 |
| Content script | F12 on a web page → filter `[NightLens]` |
| Background | Chrome/Edge/Brave/Opera: extensions page → **Service worker** (inspect). Firefox: `about:debugging` → **Inspect** |
| Stored settings | DevTools → Application → Extension storage, key `nightlens:settings` |

Developer mode in NightLens Settings → Performance also logs engine statistics to the page console.

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md). The most common issues:

- **"Could not establish connection"** in the popup → reload the tab; the content script is not
  injected into tabs that were open before the extension was installed/reloaded.
- **Firefox: pages are not darkened** → the host access grant is missing. Open the popup and click
  **Grant access**, or allow the site in `about:addons` → NightLens → Permissions.
- **Manifest version 0.0.0** → run the build; the version is injected from `package.json`.

## Icons

Generated by `scripts/make-icons.mjs` (pure JavaScript PNG writer, no third-party assets).
