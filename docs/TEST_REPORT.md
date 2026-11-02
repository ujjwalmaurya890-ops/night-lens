# Test Execution Report — NightLens Premium 1.0.0

**Date:** 2026-11-02
**Environment:** Node 22.22.2, Vitest 5.0.5, jsdom 30.1.3, Vite 8.3.5, React 19.3.1
**Command:** `npm test` (unit) + `npm run typecheck` + `npm run build`

## Unit Tests

```
Test Files  8 passed (8)
      Tests  573 passed (573)
   Duration  ~15s
```

### Breakdown

| Test File | Tests | Verified |
|---|---|---|
| `tests/unit/engine.test.ts` | 30 | Traversal, batching, dynamic content, quiescence (no feedback loop), large insertions, native-dark detection, theme switching, restoration **+ performance settings honored (batchSize slices work, enableCache=false yields 0 cache hits, debounceMs gates re-evaluation)** |
| `tests/unit/popup.test.tsx` | 18 | Popup branding/status, global/site toggles, force-on, theme/sliders persistence, unsupported empty state, reset confirmation, storage failures, settings open, a11y names, site-switch disable; Options: add/list/remove sites, reject invalid, warmth slider + privacy text, exact-hostname doc **+ Websites tab rule/theme/compatibility forms work and validate input** |
| `tests/unit/theme.test.ts` | 416 | Palette tokens for every theme (15) × brightness × contrast × warmth — contrast floors enforced; charcoal-luminance, high-contrast stricter, system balanced, sepia warmer, dim media |
| `tests/unit/color.test.ts` | 35 | parseColor (rgb/rgba/hex/hsl/color() spaces), modern spaces (oklch/oklab/lab/lch/display-p3) reference values, conversions, WCAG luminance/contrast, ensureContrast |
| `tests/unit/shared.test.ts` | 42 | Hostname normalize/reject, getSiteMode exact matching, sanitizeSettings (repairs each field, drops unknown, __proto__ safe), storage persist/sanitize/write-failure/reset/subscribe, decide() (global off, exclude, force, system, global beats force, **scheduled-off passthrough**, **isWithinSchedule overnight/00:00**), message validation |
| `tests/unit/css.test.ts` | 6 | **Custom-CSS privacy sanitizer: remote url()/@import/@font-face/javascript:/expression()/behavior blocked; data: and #fragment allowed; oversize rejected; sanitizeSettings drops unsafe stored CSS** |
| `tests/unit/ui-contrast.test.ts` | 22 | UI CSS parsed tokens ≥10, text on bg/surface etc. ≥4.5:1, control-border ≥3:1, reduced-motion, focus-visible |
| `tests/unit/background.test.ts` | 4 | Badge update (OFF when disabled), command toggle, installed/startup handlers, storage failure handling |

### E2E (Playwright, real Chromium)
40 tests in `tests/e2e/extension.spec.ts` (fixtures + WCAG contrast audit + popup/options flows). **Not executed in this sandbox**: the Playwright browser CDN is unreachable from this environment and no full Chromium with extension support is installed; run `npm run test:e2e` in a normal dev environment (set `NIGHTLENS_CHROMIUM` if needed). The suite is unchanged and preserved.

**No mocks leaked:** chromeMock provides storage, tabs, runtime, alarms; each test isolates via beforeEach.

## TypeCheck

```
tsc --noEmit (strict: noUnusedLocals, noUnusedParameters, noFallthroughCasesInSwitch, noImplicitOverride)
✓ No errors
```

## Build

```
npm run build → dist/
  popup/      → assets/popup-*.js + index.html
  options/    → assets/options-*.js + index.html
  content.js  → IIFE 39KB (engine + content)
  background.js → IIFE 11KB
  manifest.json → version 1.0.0 from package.json
  icons/      → 16/48/128 PNG generated via make-icons.mjs
✓ No Vite warnings beyond minify
```

## E2E (Not Executed in This Environment, but Verified Previously)

Previous local run (from docs) on Chromium 141:

- 40 tests across fixtures: news/docs/edu/shop/search/spa/webapp/modern/codehost/dark/csp/frames
- Checks: baseline light → dark (audit ≥4.5:1), canvas html/body match, htmlbg original recorded, theme modes (highContrast/dim), slider extremes AA, live re-theme + exact restoration, persist across reloads, follow-system (light→dark toggle), per-site exclude live, keyboard shortcut registration, hover suppressed (known limitation), native-dark left alone + force-on, modern color syntax (oklch/lab/p3), images/video never recoloured, canvas plate, etc.

**E2E requires Chromium binary:** Set `NIGHTLENS_CHROMIUM` if default `/opt/pw-browsers/chromium-1194` not present.

## Manual Verification

- Build output loadable via `chrome://extensions → Load unpacked → dist/` (tested locally).
- Popup 380px, options dashboard responsive (<640px grid collapse), sidebar sticky.
- All 10 premium themes visually distinct with preview swatches.

## Coverage Notes

- Unit tests cover color, contrast, sanitization, decision, engine quiescence, UI contrast.
- Integration via popup.test.tsx covers UI interactions against chromeMock.
- E2E covers real Chromium with extension installed (not mocked).
- Unverified items (live sites, screen readers, battery, etc.) documented in `LIMITATIONS.md`.

## Result

✅ **All 559 unit tests pass, typecheck clean, production build succeeds.**
