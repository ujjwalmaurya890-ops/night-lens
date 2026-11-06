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
