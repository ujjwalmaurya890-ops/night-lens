# Install, Build, Load, Debug, Update

## Requirements

- **Node ≥ 22.12** (developed on 22.22.2, check `node -v`) — Vite 8 requires modern Node. Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) if needed.
- **Chrome/Chromium ≥ 141** (Edge/Brave should work; Firefox not verified).

## Windows Setup

1. **Install Node:**
   - Via [nodejs.org](https://nodejs.org) LTS installer, or
   - `winget install OpenJS.NodeJS.LTS` (Windows Package Manager), or
   - `choco install nodejs` (Chocolatey)
   - Verify: open **PowerShell** or **CMD** and run `node -v` and `npm -v`.

2. **Clone & Build:**
   ```powershell
   git clone <repo-url>
   cd night-lens
   npm install
   npm run build
   ```

3. **Load in Chrome:**
   - Open `chrome://extensions`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked** → select the `dist/` folder inside the project.

4. **If `npm run build` fails with "tsc not found":**
   ```powershell
   npm install
   ```

5. **PowerShell execution policy** (if script blocked):
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```

## macOS / Linux

```bash
git clone <repo-url>
cd night-lens
npm install
npm run build
# Chrome → chrome://extensions → Developer mode → Load unpacked → dist/
```

## Build Commands

| Command | What it does |
|---|---|
| `npm install` | Install deps (React only for UI; content script has none) |
| `npm run build` | Bundles popup/settings (Vite multi-page, minified) + content.js/background.js (IIFE) + manifest (version from package.json) + icons → `dist/` |
| `npm run typecheck` | `tsc --noEmit` strict (noUnusedLocals, etc.) |
| `npm test` | Unit/integration tests (Vitest + jsdom) |
| `npm run test:e2e` | Rebuilds, then ~40 E2E in real Chromium with extension loaded (Playwright) |
| `npm run verify` | typecheck + test + test:e2e |

## Load Unpacked (Chrome)

1. `chrome://extensions` → Developer mode ON
2. **Load unpacked** → select `dist/` (must contain `manifest.json`)
3. Pin NightLens (puzzle icon → pin)
4. Open any `http/https` page — dark mode applies if enabled and not excluded.
5. **After updating code:** `npm run build` → Extensions page → **Reload** (↻) on NightLens card. Reload open tabs (or close/reopen) — old content scripts orphan until reload.

## Debugging

- **Popup console:** Right-click NightLens icon → Inspect popup.
- **Options console:** Open settings → F12.
- **Content script console:** F12 on any web page → filter `[NightLens]`.
- **Service worker:** `chrome://extensions` → NightLens → **Service worker** (inspect) → check `chrome.storage.local`.
- **Check storage:** DevTools → Application → Storage → Extension Storage.
- **Logs when developerMode on:** Enable in Settings → Performance → Developer Mode → open page console for `[NightLens] Engine stats`.

## Updating

```bash
git pull
npm install   # if package.json changed
npm run build
# chrome://extensions → Reload on NightLens
# Reload tabs
```

## Troubleshooting

- **"Manifest version 0.0.0"** — Run `npm run build`; version injected from `package.json`.
- **"Could not establish connection"** in popup — Reload the tab (content script not injected until navigation after install).
- **Light islands / unreadable logos** — Use popup toggle to exclude site, or add custom CSS in Settings → Websites.
- **Schedule not triggering** — Check `chrome://extensions` → NightLens → Service worker → Alarms; ensure start/end valid HH:MM and enabled.
- **Build fails on Node 18/20** — Upgrade to Node 22.12+ (Vite 8 requirement).

## E2E Chromium Binary

The default is Playwright's installed Chromium (`npx playwright install chromium`). Override:

```bash
NIGHTLENS_CHROMIUM=/path/to/chrome npm run test:e2e
# Windows: set NIGHTLENS_CHROMIUM=C:\path\to\chrome.exe && npm run test:e2e
```

## Icons

Generated via `scripts/make-icons.mjs` (no deps, pure JS PNG). Icons are simple, original, no third-party assets.

## Permissions

From `dist/manifest.json`: `storage`, `content_scripts` on `http/https`, `Alt+Shift+D` command. No remote code, no extra hosts. See `SECURITY_AND_PRIVACY.md`.

