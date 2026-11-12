# Testing

NightLens has four layers of automated checks plus a manual browser matrix. This document also
states plainly what has and has not been executed, because "it compiles" is not "it was tested".

## What runs today

| Layer | Command | Scope | Result in this environment |
|---|---|---|---|
| Type check | `npm run typecheck` | strict `tsc --noEmit` over `src/`, `tests/`, config | ✅ passes |
| Unit / integration | `npm test` | 19 files, 749 tests (Vitest + jsdom) | ✅ passes |
| Build | `npm run build` | six browser targets | ✅ passes (all six) |
| Build verification | `npm run verify:build` | manifests, referenced files, bundles, remote-resource and `eval` guards | ✅ passes (all six) |
| Packaging | `npm run package` | six ZIPs + checksums | ✅ passes |
| Browser E2E | `npm run test:e2e` | Playwright Chromium with the built extension | ⚠️ **not executable here** - Playwright's browser download is blocked in this environment; the suite is wired to run in CI |
| Firefox / Safari real-browser testing | manual | see matrix below | ❌ not performed here |

Nothing is reported as verified unless the table above can show it ran.

## Unit and integration suites

| File | What it protects |
|---|---|
| `tests/unit/adapters.test.ts` | Browser detection, engine families, namespace selection, callback-style vs promise-style calls, error mapping, missing-API fallbacks, adapter caching, tab messaging, Firefox host grants |
| `tests/unit/manifest.test.ts` | Every generated manifest validates; per-engine background shape; Gecko identity/data collection; rejection of wider permissions, `<all_urls>`, wrong content-script timing, unnecessary API surfaces |
| `tests/unit/architecture.test.ts` | No `chrome.*`/`browser.*` outside the adapter layer; no UA sniffing outside adapters; engine has no per-browser branches; generated manifests replace the old single manifest |
| `tests/unit/engine*.test.ts`, `color`, `detect`, `theme`, `presets` | The dark-mode engine: mapping, contrast, native-dark detection, batching, shadow DOM, SPA navigation |
| `tests/unit/security.test.ts` | Message validation, sender identity, sanitisation, stale-context behaviour |
| `tests/unit/privacy.test.ts` | No network APIs, no HTML/eval injection, no non-local storage areas, minimal permissions in every manifest, no tracking dependencies |
| `tests/unit/popup.test.tsx`, `ui-accessibility.test.tsx`, `ui-contrast.test.ts` | Popup/options behaviour, accessible names, keyboard focus, UI contrast |
| `tests/unit/hostAccess.test.tsx` | Firefox "Grant access" notice: wording, gesture-bound request, denied result |
| `tests/unit/shared.test.ts`, `css.test.ts`, `content.test.ts`, `background.test.ts` | Settings persistence/import, custom CSS validation, content lifecycle, badge/command handlers |

The mock in `tests/unit/chromeMock.ts` models a current browser namespace (async methods). The
callback-style namespace that older Chromium forks still use is covered explicitly in
`adapters.test.ts` with a hand-written callback API.

## Browser end-to-end suite

`tests/e2e/extension.spec.ts` launches a persistent Chromium context with the built extension,
serves local fixtures over two origins, and asserts real rendering: WCAG contrast of every visible
text node, images/canvas untouched, SPA navigation, dynamic content, storage persistence, the popup
and the options page.

```bash
npm run test:e2e                                  # builds dist/chrome, runs the suite
NIGHTLENS_TARGET=edge npm run test:e2e            # same suite against the Edge build
NIGHTLENS_CHROMIUM="C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe" \
  NIGHTLENS_TARGET=brave npx playwright test      # Brave/Vivaldi/Opera GX binaries
```

`NIGHTLENS_TARGET` selects `dist/<target>`; `NIGHTLENS_CHROMIUM` replaces Playwright's bundled
Chromium with any Chromium-family executable. Because all Chromium targets ship identical bundles,
this is a genuine per-browser check of the *build*, and a check of the engine behaviour in one real
Chromium browser per run.

Firefox and Safari cannot be automated by Playwright for extension loading (Playwright's Firefox
does not install extensions, and Safari is macOS-only). They are covered by the manual matrix below.

## Manual browser matrix

Run this before a release. Tick only what you actually did.

| # | Check | Chrome | Edge | Brave | Opera GX | Firefox | Safari |
|---|---|---|---|---|---|---|---|
| 1 | Extension loads without a manifest error | | | | | | |
| 2 | Light page turns dark (news site) | | | | | | |
| 3 | Text remains readable (contrast spot-check) | | | | | | |
| 4 | Images, video and canvas charts unchanged | | | | | | |
| 5 | Already-dark site left alone ("Native dark") | | | | | | |
| 6 | Per-site exclude, then include again | | | | | | |
| 7 | Toggle global switch; page restores original look | | | | | | |
| 8 | Settings persist after browser restart | | | | | | |
| 9 | Second tab open: change in popup reaches it | | | | | | |
| 10 | Infinite scroll / SPA route change still themed | | | | | | |
| 11 | Keyboard shortcut toggles (or documented as absent) | | | | | | |
| 12 | Settings page opens from the popup | | | | | | |
| 13 | Firefox: "Grant access" appears when access is revoked | n/a | n/a | n/a | n/a | | n/a |
| 14 | No console errors from NightLens | | | | | | |

### Website coverage

The Chromium E2E fixtures model these categories: news/blog, documentation, search, e-commerce,
education, code hosting, complex web app, gradients/shadows, iframes, CSP-restricted pages, and
pages with an existing dark theme. For manual runs, use real sites: Google Search, YouTube, GitHub,
Wikipedia, Reddit, Amazon, a news site, a documentation site and one web app.

## Performance checks

When changing the engine, also check a large DOM page (e.g. a long GitHub thread or a dense docs
site):

- page interaction stays responsive while NightLens processes inserted content;
- CPU settles when nothing changes (no MutationObserver feedback loop - covered by
  `engine-hardening.test.ts`);
- disabling NightLens removes every owned style and observer.

## CI

`.github/workflows/ci.yml` runs:

1. `verify` - typecheck, unit tests, all-target build, build verification, packaging, artifact upload;
2. `targets` - a matrix that builds, verifies and packages each browser **in isolation**;
3. `e2e` - Chromium with the extension loaded, publishing failure output as a check annotation.

CI is the first place the browser suite runs for this project. If it fails, the failure output is
attached to the run and (on pull requests) posted as a comment.
