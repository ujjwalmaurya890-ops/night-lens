# Cross-browser migration - final report

Date: 2026-11-12 · Branch: `arena/22ed3f93-night-lens` · Base commit: `9ecb211`

## 1. Final compatibility report

| Browser | Build generated | Installation tested | Status |
|---|---|---|---|
| Chrome | Yes - `dist/chrome` | **No** (no desktop browser in this environment) | Build, manifest, bundle and adapter verified; Chromium E2E suite runs in CI |
| Edge | Yes - `dist/edge` | **No** | Same Chromium engine and identical bundles as Chrome; Edge-specific manifest keys verified |
| Brave | Yes - `dist/brave` | **No** | Same Chromium engine and identical bundles as Chrome |
| Opera | Yes - `dist/opera` | **No** | Same Chromium engine; `minimum_opera_version` verified |
| Opera GX | Yes - `dist/opera` (shared) | **No** | Same Chromium engine as Opera |
| Firefox | Yes - `dist/firefox` | **No** | Event-page background, gecko id, host grant flow and AMO manifest rules verified by tests |
| Safari | Yes - `dist/safari/browser-extension` + documentation | **No** (needs macOS + Xcode) | Web extension source + converter instructions produced; not converted or signed |

**Nothing in this report claims a browser passed a test that was not executed.** The two layers that
were executed are the 749-test Vitest suite (including adapter and manifest verification) and
`npm run build` + `npm run verify:build` + `npm run package` for all six targets. The Playwright
Chromium suite is wired up but could not run here: downloading a browser is blocked in this
environment. It is the primary job of CI.

## 2. Architecture delivered

- `src/adapters/browser/` - a single typed facade: runtime messaging, local storage, tabs, commands,
  toolbar action, options page, permissions, capabilities. Chromium/Firefox/Safari adapters differ
  only in call style and documented engine quirks; `compose.ts` assembles them, `capabilities.ts`
  derives what is actually available.
- `manifests/` - one shared MV3 base plus six target overrides, merged and validated by
  `scripts/build/manifest.mjs` (deep merge; `null` deletes a key).
- `scripts/build.mjs` - one Vite pass, then per-target output with a generated manifest.
- `scripts/verify-build.mjs`, `scripts/package.mjs`, `scripts/build/zip.mjs` - built-output
  verification and dependency-free store archives.
- Firefox host-grant UX: the popup detects a revoked/absent host permission and offers a
  gesture-bound **Grant access** request.
- Graceful degradation: typed `BrowserApiError`s, no-op unsubscribes, cosmetic calls that never
  throw, and an environment notice when the UI is not running as an extension.

## 3. Files

### Created (45)

`src/adapters/browser/`: `index.ts`, `types.ts`, `errors.ts`, `call.ts`, `capabilities.ts`,
`compose.ts`, `chrome.adapter.ts`, `firefox.adapter.ts`, `safari.adapter.ts`,
`runtime.adapter.ts`, `storage.adapter.ts`, `tabs.adapter.ts`, `commands.adapter.ts`,
`action.adapter.ts`, `permissions.adapter.ts`

`src/ui/copy.ts`

`manifests/`: `base.mv3.json`, `chrome.json`, `edge.json`, `brave.json`, `opera.json`,
`firefox.json`, `safari.json`

`scripts/`: `build/targets.mjs`, `build/targets.d.mts`, `build/manifest.mjs`, `build/manifest.d.mts`,
`build/safari-docs.mjs`, `build/zip.mjs`, `verify-build.mjs`, `package.mjs`, `safari-project.mjs`

`tests/unit/`: `adapters.test.ts`, `manifest.test.ts`, `architecture.test.ts`, `hostAccess.test.tsx`

`docs/`: `BROWSER_COMPATIBILITY.md`, `BUILD.md`, `TESTING.md`, `RELEASE_GUIDE.md`,
`FIREFOX_INSTALL.md`, `SAFARI_INSTALL.md`, `EDGE_INSTALL.md`, `BRAVE_INSTALL.md`,
`FINAL_CROSS_BROWSER_REPORT.md`

### Modified (24)

`.github/workflows/ci.yml`, `.gitignore`, `CHANGELOG.md`, `CONTRIBUTING.md`, `README.md`,
`package.json`, `playwright.config.ts`, `scripts/build.mjs`,
`src/background/{index,handlers}.ts`, `src/content/content.ts`, `src/shared/storage.ts`,
`src/ui/{hooks.ts,components.tsx}`, `src/popup/App.tsx`, `src/options/Options.tsx`,
`src/options/tabs/SystemTabs.tsx`, `tests/e2e/harness.ts`, `tests/unit/{chromeMock,setup,popup.test,privacy.test}.ts(x)`,
`docs/{ARCHITECTURE,INSTALL,TROUBLESHOOTING,SECURITY_AND_PRIVACY,PRIVACY,DEVELOPMENT,BROWSER_TEST_CHECKLIST}.md`

### Deleted

`src/manifest.json` (replaced by `manifests/`), the committed `dist/` output (now git-ignored and
regenerated per target), and the stale pre-migration `nightlens.zip`.

## 4. Dependencies

| Change | Package |
|---|---|
| Added | **none** |
| Removed | **none** |

`webextension-polyfill` was evaluated and **not** added. Reasons: it is a runtime dependency inside a
privacy-first extension; Chromium MV3 already returns promises (and older forks are handled by the
callback path in `call.ts`); Firefox's native `browser.*` is already promise-based; and Safari
exposes both namespaces. The adapter achieves the same normalisation in ~120 lines that can be
audited with the rest of the source. `tests/unit/privacy.test.ts` still pins the runtime dependency
list.

## 5. Commands executed

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run verify:build
npm run package
npx vitest run <individual suites>          # during development
npx playwright install chromium             # attempted: blocked by the sandbox network
```

## 6. Results

| Check | Outcome |
|---|---|
| `npm run typecheck` | ✅ pass (strict, `noUnusedLocals`, `noUnusedParameters`) |
| `npm test` | ✅ 749 tests / 19 files pass (was 704 / 15 before this pass) |
| `npm run build` | ✅ 6/6 targets, 15 files each, version 1.0.0 |
| `npm run verify:build` | ✅ 6/6 manifests, files and bundles verified |
| `npm run package` | ✅ 6/6 ZIPs + `checksums.json` |
| `npm run test:e2e` | ⚠️ not executed (browser download blocked); runs in CI |
| Real-browser installation | ❌ not performed - no browser is installed in this environment |

Tests failed: 0. During development, three pre-existing tests needed updating for the architectural
change (the message-call shape assertion in `popup.test.tsx` and the manifest/privacy invariants);
their intent is unchanged.

## 7. Known issues and limitations

1. **Host access on Firefox is a user grant.** With it revoked, no content script runs. NightLens
   explains it and offers **Grant access**; a tab reload is still required afterwards.
2. **No `ancestorOrigins` on Gecko**, so inside a cross-origin iframe the frame's own hostname
   decides theming rather than the top-level page. Chromium and Safari use the top-level hostname.
3. **Safari has no shortcut rebinding** and no `runtime.onStartup`; the badge is refreshed on install
   and on settings changes.
4. **Safari/iOS and Firefox Android are not claimed.** The UI is responsive but untested there.
5. **Firefox 140 floor.** `data_collection_permissions` (mandatory on AMO since November 2025)
   requires it. Versions 121-139 would work at runtime but are not the build target.
6. **The Chromium E2E suite is CI's job.** If it fails on the first run, the failure output is
   published as a check annotation and a PR comment (already configured).
7. **Store review is out of scope.** No package was submitted anywhere; per-store checklists are in
   `RELEASE_GUIDE.md`.

## 8. Remaining manual steps

1. Run `npm run test:e2e` on a machine with internet access (or let CI do it) to execute the real
   Chromium suite against `dist/chrome`.
2. Install `dist/chrome` unpacked on Windows, then repeat the manual matrix in `TESTING.md`.
3. Install `dist/edge`, `dist/brave`, `dist/opera` the same way (Edge may need
   "Allow extensions from other stores" while testing store packages).
4. `dist/firefox` via `about:debugging` → **Load Temporary Add-on…**; check the **Grant access**
   flow by revoking site access in `about:addons`.
5. On a Mac: `npm run safari:project`, run the Xcode scheme, allow the extension in Safari.
6. When ready to publish: bump `package.json`, run `npm run verify && npm run package`, then follow
   `RELEASE_GUIDE.md` per store.
