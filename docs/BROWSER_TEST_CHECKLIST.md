# Manual Browser Test Checklist (Live Sites — Not Automated)

Use this after loading `dist/` in Chrome. Test on diverse categories: news (BBC/NYT), docs (MDN/Dev.to), edu (Khan/Coursera), social (Reddit/Twitter), e-commerce (Amazon), dev tools (GitHub), blogs (Medium), dashboards (Grafana), webapps (Notion/Figma). Do *not* claim universal compatibility.

## 1. Install & First Paint
- [ ] `npm run build` succeeds, `dist/manifest.json` version matches `package.json`.
- [ ] Load unpacked `dist/` → no errors in `chrome://extensions`.
- [ ] Open `https://example.com` → dark theme applies, no white flash (early-paint guard).
- [ ] Disable via popup → original colors return exactly (inspect outerHTML diff).
- [ ] Reload tab → state persists.

## 2. Popup (380px)
- [ ] Branding (NightLens + Premium) + master toggle (all sites) works, announces result.
- [ ] Current website detection shows hostname, status badge (Active/Excluded/Natively dark/Scheduled/System).
- [ ] Site toggle excludes/restores; forced-on button appears for native-dark; Back to automatic.
- [ ] Theme selector: 10 premium + legacy + system/custom visible; switching instant.
- [ ] Brightness/Contrast/Warmth sliders live preview; preset chips apply.
- [ ] More → keyboard shortcut info (Alt+Shift+D), website exclusion hint.
- [ ] Reset needs confirmation; cancel/confirm work.
- [ ] Settings link opens `options/index.html` in new tab.
- [ ] Footer shows version, privacy tagline.
- [ ] All controls keyboard-focusable, visible outline, screen-reader labels.

## 3. Settings Dashboard
- [ ] Header: logo + version + enabled toggle + badge.
- [ ] Sidebar: 9 tabs (Overview/Appearance/Themes/Websites/Accessibility/Automation/Performance/Privacy/About) — click switches.
- [ ] Overview: active theme preview, stats (rules/custom themes/custom CSS), appearance at a glance, behavior badges.
- [ ] Appearance: brightness/contrast/warmth/saturation/textSize/accentHue sliders, font preference, reading mode (toggle + fontSize/lineHeight/maxWidth/family when enabled).
- [ ] Themes: grid of 10 premium + 4 essentials + system/custom; create custom (color pickers + preview + create), list with Use/Export/Delete; per-website themes list; import theme JSON.
- [ ] Websites: add exclude (normalize, reject invalid with "Enter website address"), list excluded/forced with Remove, search filter, compatibility profiles list, custom CSS save/list/remove, per-site overrides list.
- [ ] Accessibility: highContrast toggle, underlineLinks, reducedMotion, colorBlindMode select; keyboard/shortcut docs.
- [ ] Automation: schedule enable + start/end time inputs, followSystem toggle + theme select, per-website automation info.
- [ ] Performance: cache toggle, elements per frame slider, debounce slider, developer mode toggle, how-it-stays-fast list.
- [ ] Privacy: What it does NOT do (green), What is stored (JSON snippet), Permissions table, Backup/Restore (export/import), Reset confirmed.
- [ ] About: logo, premium description, shortcuts, limitations, roadmap.
- [ ] Responsive: sidebar collapses / content reflows at <640px, no overflow.
- [ ] Reduced motion: with `prefers-reduced-motion: reduce`, no transitions.

## 4. Themes
- [ ] Each premium theme on news fixture: background dark (<80 max channel), text contrast ≥4.5:1 (use audit helper).
- [ ] Custom theme: pick bg #0a0a0f text #e8e8f2 accent #ff6b6b → preview updates, create → appears in list, can Use, Export (JSON download), Delete.
- [ ] Import theme JSON → appears in list, can apply.
- [ ] Per-website theme: assign `example.com → nord` → visiting example.com uses nord even if global is midnight.
- [ ] Export/import settings: export JSON, edit, import → sanitized, invalid fields dropped, prototype not polluted.

## 5. Engine & Content
- [ ] News page: all text readable, links accent, borders subtle, no blind inversion of images/logos.
- [ ] Docs page: code blocks preserve hue, tables readable, canvas plate on light backdrop.
- [ ] Shop page: cards, prices, selects, inputs themed; hover suppressed (documented) but cursor/transform untouched.
- [ ] Video page: video element filter none (balanced), not recoloured.
- [ ] Webapp page: html bg matches body (no lighter band).
- [ ] Modern page: oklch/lab/display-p3/mix backgrounds dark, readable.
- [ ] Dark page: left alone unless forced.
- [ ] SPA navigation (docs SPA fixture): pushState → theme re-applies.
- [ ] Shadow DOM: open shadow root themed (if fixture includes).
- [ ] Custom CSS: add `body{letter-spacing:0.05em}` for example.com → reflected live, remove → gone.

## 6. Automation
- [ ] Set schedule 00:00–00:01, wait 1 min → badge/status updates (scheduled-off).
- [ ] Set followSystem + system light → waiting-for-system; emulate dark → active.

## 7. Accessibility
- [ ] High contrast on → text contrast 7:1 audit passes (use `auditContrast(page,7)`).
- [ ] Underline links on → computed `text-decoration: underline`.
- [ ] Reduced motion on → no CSS transitions (inspect).
- [ ] Keyboard: Tab through popup/options, Enter/Space toggles, focus visible.

## 8. Performance
- [ ] Large page (7500 nodes) → finishes <1s, no freeze (check console perf stats if devMode).
- [ ] Infinite scroll fixture: new nodes themed lazily.
- [ ] No memory leak: enable/disable 10× → `data-nl-*` cleaned, observers disconnected.

## 9. Security & Privacy
- [ ] No network requests in DevTools Network (extension pages).
- [ ] `chrome.storage.local` contains only expected keys (inspect Application → Storage).
- [ ] Import malformed JSON → error, not crash; __proto__ not polluted.

## 10. E2E Re-run
- [ ] `npm run verify` passes (typecheck + unit + e2e).

Record what works/fails in `docs/LIMITATIONS.md` or issue tracker. Do not invent results.
