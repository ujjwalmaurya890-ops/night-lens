# Test report

**Verification date:** 2026-11-09
**Branch:** `arena/bfb506ae-night-lens`
**Working tree:** committed (see [FINAL_ENGINEERING_REPORT.md](FINAL_ENGINEERING_REPORT.md#d-git-summary))

Only executed results are listed. Anything that could not be executed is stated as such.

## Executed successfully

| Check | Command | Result | Evidence |
|---|---|---|---|
| Dependency install | `npm ci` | Pass | Lockfile respected, no install errors. |
| Type check | `npm run typecheck` | **Pass** | `tsc --noEmit`, strict mode, 0 errors. |
| Unit / integration | `npm test` | **704 / 704 passing** | 15 Vitest files in jsdom, ~65 s. Breakdown below. |
| Production build | `npm run build` | **Pass** | `dist/` built; manifest version injected from `package.json`. |
| Built manifest review | `node -e` on `dist/manifest.json` | **Pass** | `permissions: ["storage"]`, `host_permissions: []`, `manifest_version: 3`. |
| Browser E2E | `npm run test:e2e` (CI) | **42 / 42 passing** | GitHub Actions [run 42561937603](https://github.com/ujjwalmaurya890-ops/night-lens/actions/runs/42561937603), `e2e` job, 1 m 42 s, real Chromium with the unpacked extension. |

## Unit / integration coverage (measured)

| File | Tests | Main coverage |
|---|---:|---|
| `theme.test.ts` | 417 | Every theme id × brightness/contrast/warmth extremes, custom-theme warmth, media handling, mapper behaviour |
| `shared.test.ts` | 50 | Host normalisation/inheritance, settings sanitisation, queued writes, imports, schedules/system decisions, message validation |
| `ui-contrast.test.ts` | 40 | Extension UI token contrast (text ≥ 4.5:1, non-text ≥ 3:1), reduced-motion rule, zero `!important`/remote URLs in CSS |
| `color.test.ts` | 39 | hex/rgb/hsl/oklab/lab/display-p3/hwb parsing, the CSS named-colour table, contrast maths, deterministic adjustment |
| `engine.test.ts` | 31 | Background/foreground/border mapping, controls, media, SVG/canvas plates, gradients/shadows, shadow DOM, dynamic DOM, batching/cache/debounce, native-dark changes |
| `security.test.ts` | 22 | Message validators, worker sender/type checks, sanitised replies, minimal diagnostics payload, stale-context recovery, storage bounds |
| `popup.test.tsx` | 21 | Popup and options behaviour, persistence, failure notices, reset confirmation, per-site rules |
| `ui-accessibility.test.tsx` | 18 | Accessible names on every tab, unique ids, skip link, sidebar arrow keys, live regions, live theme preview, override editor, purpose presets |
| `engine-hardening.test.ts` | 17 | Dynamic attribute detection, large single insertion, native-dark meta/CSS-variable paths, shared history patch, shadow-host removal, config fingerprint, rect elision, restoration cycles |
| `presets.test.ts` | 14 | Purpose-preset application, persistence through sanitisation, contrast floors, no side effects on unrelated settings |
| `privacy.test.ts` | 11 | No network/eval/HTML-injection APIs, no tracking deps, minimal permissions, `chrome.storage.local` only, documented data flows |
| `detect.test.ts` | 9 | Native-dark heuristic ordering (background, meta, CSS property, design-system variable) |
| `css.test.ts` | 7 | Custom-CSS validation, URL policy, obfuscation rejection |
| `background.test.ts` | 4 | Command toggle, badge, install/startup |
| `content.test.ts` | 1 | Duplicate-injection guard, pagehide cleanup |

Baseline before this work: 606 tests in 9 files, all passing. **+98 tests, 0 tests deleted or
weakened.** Two existing tests were updated only where behaviour intentionally changed… in fact none
had to be changed: the whole pre-existing suite passes unmodified. The only edits to existing test
files were additive (`color.test.ts`) and a one-line selector update in
`tests/unit/popup.test.tsx` was **not** required.

## Browser E2E (executed in CI)

The browser suite **cannot run in the development sandbox** — `npx playwright install chromium` fails
there (download host unreachable), there is no system Chromium, and the only npm-shipped Chromium is
an extension-less headless shell. It runs in GitHub Actions instead, and it has now run:

| Item | Value |
|---|---|
| Run | [42561937603](https://github.com/ujjwalmaurya890-ops/night-lens/actions/runs/42561937603) — `success`, zero annotations |
| Jobs | `verify` 28 s · `e2e` 1 m 42 s |
| Tests | **42 / 42 passing**, 1 file, 1 worker, one persistent browser context with the extension loaded |
| Browser | Playwright 1.64.1 Chromium, `--headless=new`, `--load-extension=dist` |
| Runner | `ubuntu-24.04`, Node 22 |

What the suite actually covers: theming of seven representative local pages with a WCAG AA contrast
audit over rendered text (and a light-mode baseline proving the audit is not vacuous), canvas
backdrops, original-background regression, follow-system mode, per-site exclusion and force-on,
runtime rule changes, native-dark detection, shadow DOM and iframe fixtures, a strict-CSP page,
the real popup page (switches, theme select, per-site toggle, reset flow, tab order and focus rings),
the options page (purpose preset and per-site override reaching a live page, exclusion list), and
console/error hygiene.

### What the first execution found

The suite had never run, so its first run was also a code review by execution. It found four defects:

| # | Defect | Kind | Fix |
|---|---|---|---|
| 1 | `getByLabel('Theme')` matched both the theme select and the new `aria-label="Favorite themes"` group | Test bug | Exact-match selectors (3 places) |
| 2 | The harness seeded `schemaVersion: 1`, sending every test through the legacy migration path | Test bug | Seed `schemaVersion: 2` |
| 3 | The popup tab-order test hardcoded seven stops from the pre-redesign popup | Test bug | Derive the control list from the live DOM; assert every control is reachable, in order, with a focus ring |
| 4 | **`chrome.runtime.onInstalled` overwrote settings written concurrently** (read "empty", then wrote defaults unconditionally) | **Product bug** | `ensureSettings()` — check and seed inside the write queue; 3 regression tests |

Defect 4 is the one that matters: a page opened with per-site rules stored loaded the default
palette instead, because the install seed had already replaced them.

### How CI failures are made readable

Log bundles and artifacts download from hosts a restricted network cannot reach, so the `e2e` job
prints up to five check annotations (readable through the checks API) and comments the last 200 lines
of Playwright output on the pull request when it fails. `playwright.config.ts` records a trace and a
failure screenshot and writes an HTML report. Every failure above was diagnosed from those
annotations rather than from logs.

## Static checks performed manually (and now automated)

| Check | Result |
|---|---|
| No network APIs in `src/` | 0 matches — automated in `privacy.test.ts` |
| No `eval` / `new Function` / `innerHTML` / `document.write` | 0 matches — automated |
| No `localStorage` / `sessionStorage` / IndexedDB | 0 matches — automated |
| No `chrome.history`, `chrome.cookies`, `chrome.webRequest`, `chrome.scripting` | 0 matches — automated |
| Manifest permissions | `storage` only; no host permissions, no `externally_connectable` — automated |
| `any` in `src/` | Removed from storage sanitiser, palette preview helper and UI debug consumer; two narrowed casts remain in the history patch (`Parameters<...>` args) |
| UI CSS `!important` count | 0 — automated in `ui-contrast.test.ts` |

## Known verification gaps

- Real-browser paint, first-paint flash timing, GPU/memory behaviour, and battery impact: not
  measured.
- Screen-reader interaction, OS high-contrast mode, RTL, print, and zoom/DPI combinations: not
  tested, only reasoned about from markup and CSS.
- Physical `Alt+Shift+D` key press: cannot be simulated; the command registration and the handler
  are tested separately (unit + the existing browser test asserting registration).
- Cross-origin iframe theming is covered by a fixture in the browser suite only.
