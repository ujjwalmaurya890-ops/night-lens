# Test report

**Verification date:** 2026-11-06
**Working tree:** `arena/f283cf16-night-lens` (uncommitted changes)

## Executed successfully

| Check | Result | Evidence |
|---|---|---|
| `npm ci` | Pass | 107 packages installed in the initial verification; dependency audit completed. |
| `npm run typecheck` | Pass | Strict TypeScript, no errors. |
| `npm test` | **606/606 passed** | 9 Vitest/jsdom files; no failures. |
| `npm run build` | Pass | Production Manifest V3 extension generated in `dist/`. |
| `npm audit --audit-level=high` | **0 vulnerabilities** | Point-in-time result, not a continuing supply-chain guarantee. |
| `git diff --check` | Pass | No whitespace errors at the time of the check. |
| Unsafe source-pattern scan | No matches | No `fetch(`, XHR, WebSocket, beacon, eval, `new Function`, `innerHTML`, `document.write`, or browser web-storage APIs in `src/`. |
| Manifest review | Pass | Only `storage` permission; HTTP/HTTPS content scripts and configurable command retained. |

### Unit/integration coverage

| File | Tests | Main coverage |
|---|---:|---|
| `background.test.ts` | 4 | Global keyboard-command handler, badge, install/startup persistence. |
| `color.test.ts` | 35 | Hex/RGB/HSL/modern color parsing, alpha, conversion, WCAG contrast. |
| `css.test.ts` | 7 | Ordinary CSS, URL restrictions, data-image policy, comment/escape obfuscation, storage sanitization. |
| `engine.test.ts` | 31 | Background/foreground/border mapping, readable controls, images/media, SVG/canvas, shadow DOM, gradients/shadows, restoration, dynamic DOM, batching/cache/debounce, native-dark changes. |
| `popup.test.tsx` | 21 | Global/site toggles, status filtering, themes/sliders, failure notices, reset confirmation, accessible names, options forms, website-preference reset. |
| `shared.test.ts` | 50 | Host normalization/inheritance/specificity, settings sanitization, queued writes, imports, effective site settings, schedule/system decisions, message validation. |
| `theme.test.ts` | 417 | All theme IDs × brightness/contrast/warmth extremes, custom-theme warmth, normal media preservation, explicit media-only dimming, mapper behavior. |
| `ui-contrast.test.ts` | 40 | Extension UI text/control/focus contrast and reduced-motion rules. |
| `content.test.ts` | 1 | Duplicate-injection guard and final-pagehide listener/style cleanup. |

These are unit/integration tests, not proof of universal live-site behavior. jsdom does not validate actual paint, browser layout, physical shortcuts, or assistive technology.

## Browser E2E status

**Not executed in this sandbox.** No compatible Chromium executable was present. `npx playwright install chromium` was attempted, but the browser download from `cdn.playwright.dev` failed because the sandbox could not establish the TLS connection. Therefore no new E2E pass, screenshot, browser console check, or live-site result is claimed.

The Playwright suite was updated for portable browser resolution (`chromium.executablePath()` or `NIGHTLENS_CHROMIUM`) and includes a real-browser gradient/shadow/media fixture test. The CI workflow installs Chromium and runs the suite. It still needs to run locally or in CI before this working tree is considered browser-verified.

To verify:

```bash
npx playwright install chromium
npm run test:e2e
```

For a manual browser check, load the freshly built `dist/` directory and follow [Browser test checklist](BROWSER_TEST_CHECKLIST.md). In particular, verify popup visuals/keyboard order, gradient rendering, dynamic SPAs, native-dark behavior, and error consoles.

## Historical results

Older documentation contained different test totals and browser results from earlier revisions. They are not presented as evidence for the current changes. Current executed results are limited to the commands listed above.
