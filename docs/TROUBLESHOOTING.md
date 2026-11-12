# Troubleshooting

## Install / Build

**`tsc not found` or `vitest not found`**
```bash
npm install
```

**`Node version` errors (Vite 8 requires 22.12+)**
- Check `node -v`
- Install Node 22 via `nvm install 22`, `fnm install 22`, or [nodejs.org](https://nodejs.org).

**`Manifest version 0.0.0`**
- Run `npm run build` — version injected from `package.json`.

**`No built extension at dist/<target>` when running the browser suite**
- The E2E harness reads `dist/<target>`. Run `npm run build:chrome` (or `NIGHTLENS_TARGET=<id> npm
  run test:e2e` with that target built).

**`Unknown build target` from `npm run build -- --target ...`**
- Valid targets: `chrome`, `edge`, `brave`, `opera`, `firefox`, `safari`. Safari additionally needs
  `npm run build:safari` before packaging.

## Cross-browser loading

**Chrome/Edge/Brave/Opera load the wrong folder**
- Each target lives in `dist/<target>`; the repository root and `dist/` itself no longer contain a
  `manifest.json`.

**A Chromium fork reports "Manifest file is missing or unreadable"**
- You probably selected `dist/firefox` or `dist/safari/browser-extension`. Chromium forks need the
  `dist/chrome` (or `dist/edge`/`dist/brave`/`dist/opera`) build; only Firefox and Safari accept an
  event-page background.

**Firefox: pages stay light and the popup says the page is unsupported**
- Host access is missing. Click **Grant access** in the popup (then reload the tab), or enable
  *Access your data for all websites* in `about:addons` → NightLens → Permissions. This is Firefox
  MV3 behaviour, not a NightLens failure.

**Firefox: "This add-on could not be installed because it has not been verified"**
- Firefox only installs signed add-ons. Use `about:debugging` for a temporary add-on, or sign the
  package (`web-ext sign`) - see [FIREFOX_INSTALL.md](FIREFOX_INSTALL.md).

**Safari: `browser-extension` will not install**
- Safari cannot load unpacked extensions. Run `safari-web-extension-converter` (or
  `npm run safari:project`) on macOS with Xcode - see [SAFARI_INSTALL.md](SAFARI_INSTALL.md).

**Safari: no keyboard shortcut**
- Safari does not expose shortcut rebinding; use the popup switch. The `commands` entry is still
  declared for browsers that support it.

**Extension updated but a tab keeps the old behaviour**
- Reload the tab. An orphaned content script cannot reconnect to a reloaded extension; NightLens
  then leaves the page untouched instead of half-themed.

## Loading Extension

**"Could not establish connection" in popup (unsupported page)**
- Browser pages (`chrome://`, Web Store), `file://`, PDFs, `about:blank` not supported.
- If you just installed/updated NightLens, **reload the tab** (old content script orphaned until navigation).

**Popup says “Checking this page…” forever**
- Reload tab. Check service worker logs (`chrome://extensions` → NightLens → Service worker).
- Ensure page is `http/https`.

**Theme not applying on a site**
- Check popup status: Excluded? Waiting for system? Scheduled off?
- Try **Force dark mode on this site** if native-dark detected.
- Check if page uses inline `!important` — may defeat override (limitation).

## Appearance Issues

**Light islands or image backgrounds remain light**
- Literal gradient stops are remapped, but non-gradient background images are left as authored. Unknown gradient color syntax may also remain. Use **per-site exclusion** or trusted **custom CSS** to adjust a specific site.

**Dark logo unreadable**
- Exclude site or add custom CSS: `img[src*="logo"]{filter:brightness(1.2)}` (example).

**Hover background not changing**
- Known limitation — `!important` attribute rules suppress hover backgrounds. Non-color hover effects untouched.

**Canvas chart bright rectangle**
- By design — canvas placed on original light backdrop so pixels stay readable.

**Text too small/large**
- Adjust **Text size** in popup/Appearance, or per-site override in Websites.

## Settings & Data

**Settings not persisting**
- Check DevTools → Application → Extension Storage.
- If `quota exceeded`, remove some site rules (max 2000) or custom CSS (max 20k each).

**Import fails**
- Validate JSON syntax. Unknown keys dropped; invalid values fallback to defaults.
- Check `__proto__` keys rejected for safety.

**Reset not working**
- Must **confirm** (click Reset… then Reset). Check live region for success message.

## Performance

**Page laggy / large page slow**
- Lower **Elements per frame** in Settings → Performance (default 400, try 200).
- Increase **Debounce** (default 150ms, try 250ms).
- Disable **Developer Mode** (adds overhead).

**Schedule not triggering**
- Enable the schedule and set valid HH:MM times.
- Keep a matching page open and active enough for its content-script timer to run; hidden pages skip schedule checks.
- After changing schedule settings, allow up to one minute for the next check.

## Keyboard & Accessibility

**Alt+Shift+D not working**
- Rebind at `chrome://extensions/shortcuts` (may conflict with other extensions/OS).
- Check popup → Adjustments → More → Keyboard Shortcut info.

**Screen reader not announcing**
- Ensure focus visible and role attributes exist (inspect). File issue with steps.

## After Update

1. `npm run build`
2. `chrome://extensions` → NightLens → **Reload** (↻)
3. **Reload all open tabs** (or close/reopen browser).

If problem persists, open DevTools console, copy logs (filter `[NightLens]`), and file issue with: Chrome version, OS, page URL (or fixture), steps to reproduce, screenshot of computed styles.
