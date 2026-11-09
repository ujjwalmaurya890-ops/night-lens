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
| Unit / integration | `npm test` | **701 / 701 passing** | 15 Vitest files in jsdom, ~65 s. Breakdown below. |
| Production build | `npm run build` | **Pass** | `dist/` built; manifest version injected from `package.json`. |
| Built manifest review | `node -e` on `dist/manifest.json` | **Pass** | `permissions: ["storage"]`, `host_permissions: []`, `manifest_version: 3`. |
| Playwright test discovery | `npx playwright test --list` | Pass | 42 tests discovered in `tests/e2e/extension.spec.ts`. |

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

Baseline before this work: 606 tests in 9 files, all passing. **+95 tests, 0 tests deleted or
weakened.** Two existing tests were updated only where behaviour intentionally changed… in fact none
had to be changed: the whole pre-existing suite passes unmodified. The only edits to existing test
files were additive (`color.test.ts`) and a one-line selector update in
`tests/unit/popup.test.tsx` was **not** required.

## Not executed here: browser E2E

`npm run test:e2e` was **not** run in the environment where this report was produced.

- `npx playwright install --with-deps chromium` fails: the Chromium/Chrome-for-Testing download
  host is unreachable from this sandbox (`Download failure, code=1`), and
  `npx playwright install chromium` fails the same way.
- No system Chromium/Chrome binary is present (`which chromium`, `google-chrome`, … all empty), so
  `NIGHTLENS_CHROMIUM` cannot point at one either.
- `npx playwright test --list` confirms the 42 tests are discoverable and type-correct, but
  discovery is not execution.

Therefore **no browser-level pass, screenshot, or live-site result is claimed for this change set.**

### What *was* executed from the CI definition

The `verify` job was replayed outside GitHub: its `run:` steps are extracted from
`.github/workflows/ci.yml` and executed in order in the repository root, with `CI=true`.

| CI step | Locally replayed | Result |
|---|---|---|
| `npm ci` | yes | pass — lockfile is reproducible, 0 vulnerabilities |
| `npm run typecheck` | yes | pass (2.5 s) |
| `npm test` | yes | pass (62 s) |
| `npm run build` | yes | pass — `NightLens built to dist` |
| built-manifest assertion (inline `node -e`) | yes | pass — `manifest OK: {"permissions":["storage"],"host_permissions":[]}` |
| job summary (heredoc into `$GITHUB_STEP_SUMMARY`) | yes | pass — markdown table rendered |
| `checkout`, `setup-node`, `upload-artifact`, `cache` | no — GitHub-only `uses:` steps | action SHAs verified against the GitHub API instead |

All 42 Playwright tests remain **unexecuted**. The suite's config now records `trace` and screenshots
on failure and writes an HTML report, so the first CI failure — if there is one — arrives with
evidence attached rather than as a bare red X.
`.github/workflows/ci.yml` runs the suite on `ubuntu-24.04` with `npx playwright install --with-deps
chromium` in the `e2e` job. One new browser test was added
(`options page: a purpose preset and a per-site override reach the live page`) and is unverified
until CI runs it; it is written against unit-tested behaviour (the preset writes theme/brightness/
contrast and the override writes `siteOverrides`) and uses the existing harness helpers.

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
