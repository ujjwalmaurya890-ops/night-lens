# Final engineering report

**Project:** NightLens — Manifest V3 dark-mode extension
**Branch:** `arena/bfb506ae-night-lens` (branched from `47fd171`)
**Date:** 2026-11-09
**Scope:** 20 engineering contributions across engine, UX, reliability, security, testing, CI and
documentation

---

## A. Executive summary

NightLens was already a substantial project: a contrast-aware colour engine, ten curated palettes,
per-site rules, schedules, reading mode, 606 unit tests and a working CI job. This pass did **not**
rewrite it. It audited the actual code, found genuine defects and gaps, fixed them with small,
independently testable changes, and documented what remains unproven.

What changed, concretely:

1. **The engine is more reliable on modern pages.** It now reacts to theme-related `data-*`
   attributes (not just `class`/`style`), shares a single ref-counted history patch per window
   instead of chaining wrappers, follows the Navigation API, strips attributes before discarding a
   detached shadow-root context, and no longer leaves a `data-nl-ready` marker behind when disabled
   before first paint.
2. **The engine is faster and more predictable.** `update()` is a fingerprint-compared no-op when
   the effective configuration did not change; `getBoundingClientRect()` is no longer forced for
   ordinary elements; native-dark detection is cached per URL instead of re-running (and detaching
   styles) on every settings write; the gradient/shadow cache and the schedule ticker are bounded
   and conditional.
3. **The extension survives real-world failure modes.** An extension update/reload no longer leaves
   the old content script throwing `Extension context invalidated` with a permanently themed page: it
   detects the stale context, restores the page and detaches. Settings can no longer be corrupted
   into unbounded or dangling state, and the service worker answers only this extension's messages,
   with sanitised data.
4. **Users get the things the product description promised but the UI did not offer:** five purpose
   presets, a real live preview with measured contrast, and an editor for per-site overrides (the
   storage and decision layers already supported overrides; only creation was missing).
5. **Accessibility improved measurably in the code:** skip link, arrow-key sidebar navigation, a
   polite announcement of the active section, no more four always-empty `role="alert"` regions. An
   automated suite now asserts accessible names and unique ids for every settings tab.
6. **Privacy is machine-checked.** `docs/PRIVACY.md` describes exactly what is stored, and
   `tests/unit/privacy.test.ts` fails the build if network APIs, tracking dependencies, extra
   permissions, HTML injection or non-local storage appear.
7. **CI is hardened.** Two jobs pinned to immutable action SHAs, Playwright browser caching, a
   minimal-permission manifest assertion on the *built* bundle, and artifact upload only on failure.

**Test count: 606 → 704 (+98), 9 → 15 files, 0 deleted.** Typecheck and build pass, and all 42 browser
tests pass in CI. They cannot run in the development sandbox (Chromium download is blocked), which is
stated everywhere rather than glossed over.

---

## B. The twenty contributions

Each entry: original problem → solution → files → tests → actual verification.

### 01 — Advanced dynamic website detection

- **Problem.** The tree observer listened only to `class` and `style`. A large class of sites
  (Tailwind/shadcn-style apps, WordPress themes, component libraries) toggles
  `data-theme`/`data-color-mode` on a container, and those elements were never re-themed.
- **Solution.** Observe `class`, `style`, `role` and the six common theme attributes on every
  element (`THEME_ATTRIBUTES`), keep the existing "style churn that cannot affect colour is
  ignored" filter, keep insertion traversal complete (capping it would leave a large append's tail
  unstyled), and deduplicate through the existing `Set` queue.
- **Files.** `src/engine/engine.ts`.
- **Tests.** `tests/unit/engine-hardening.test.ts`: attribute change triggers re-read; a 1,200-element
  single insertion is fully themed; an unchanged document is not reprocessed.
- **Verification.** Pass (typecheck, unit, build). The pre-existing quiescence test (no mutation
  feedback loop) still passes.

### 02 — Intelligent CSS colour mapping

- **Problem.** `parseColor` handled hex/rgb/hsl/oklab/lab/`color(display-p3)` but not `hwb()`, and
  recognised only six named colours — so named colours in gradient/shadow strings and in non-browser
  DOMs were silently dropped.
- **Solution.** Added `hwbToRgb` (including the neutral `w+b ≥ 1` case) and the full CSS named-colour
  table, generated from one compact table. Unknown values still return `null`, so the engine leaves
  the element alone rather than guessing; `currentcolor`/`inherit`/malformed functions are explicit
  non-cases.
- **Files.** `src/engine/color.ts`.
- **Tests.** `tests/unit/color.test.ts` +4: hwb incl. alpha and grey, six named-colour round-trips
  against their hex values, nine invalid inputs returning `null`, determinism.
- **Verification.** Pass. All 35 pre-existing colour tests unchanged and passing.

### 03 — Intelligent website theme detection

- **Problem.** Detection considered only a painted backdrop and the CSS `color-scheme` property. It
  ignored `<meta name="color-scheme">` and the `--background`/`--bg` convention used by themed apps
  with a transparent body — and it re-ran on every settings write, detaching NightLens styles to do
  so.
- **Solution.** Three ordered signals (painted background → declared scheme, meta or CSS → opaque
  design-system variable), a documented reason per signal, plus a per-URL cache invalidated on
  navigation and on root class/style changes (so a site flipping its own theme is still noticed).
- **Files.** `src/engine/detect.ts`, `src/engine/engine.ts`.
- **Tests.** `tests/unit/detect.test.ts` (9), `engine-hardening.test.ts` (dark meta on a transparent
  page is left alone; a page declaring only `light` is themed).
- **Verification.** Pass. The existing "site switches its own theme at runtime" test still passes,
  which is the regression that a naive cache would have broken.

### 04 — Single-page application compatibility

- **Problem.** History patching was per-engine: engine B wrapped engine A's wrapper and saved it as
  "original". Stopping A restored the native method while B still pointed at a stale chain, leaving
  the page patched forever — a real leak whenever two engines coexisted (content script + tests).
  Newer SPAs that use the Navigation API without touching history were not observed at all.
- **Solution.** Module-level, ref-counted history patching keyed by `Window`, with a callback set so
  every live engine is notified and the original methods are restored only when the last engine
  stops; plus `navigatesuccess`/`currententrychange` listeners where the API exists, removed on stop.
- **Files.** `src/engine/engine.ts`.
- **Tests.** `engine-hardening.test.ts`: one engine stopping keeps navigation working for the other,
  and after both stop neither re-themes; a `pushState` route change themes the new subtree.
- **Verification.** Pass. (jsdom returns a fresh bound function per property access, so the test
  asserts behaviour rather than function identity — noted in a comment.)

### 05 — Shadow DOM and iframe compatibility

- **Problem.** Detached shadow-root contexts were discarded without stripping, so a re-attached root
  kept `data-nl-*` attributes whose generated rules no longer existed. Iframe behaviour existed but
  its limits were not documented precisely.
- **Solution.** `stripWithin(root)` runs before a disconnected host's context is dropped, and also
  centralises teardown; limits documented (closed roots unreachable; `attachShadow()` on an
  already-processed element without a mutation is picked up on the next rescan; no
  `attachShadow` monkey-patching, deliberately).
- **Files.** `src/engine/engine.ts`, `docs/LIMITATIONS.md`, `docs/ARCHITECTURE.md`.
- **Tests.** `engine-hardening.test.ts`: content added inside an already-themed root is themed; a
  removed host loses its managed attributes, and after re-attachment the attribute is backed by a
  generated rule again.
- **Verification.** Pass at unit level. The cross-origin/same-origin iframe fixture test remains in
  the Playwright suite, unrun here (see §C).

### 06 — Advanced theme presets

- **Problem.** Ten palettes existed, but the five *purposes* from the product brief were not
  switchable choices; choosing "dim reading" meant manually matching a palette with brightness,
  contrast and warmth.
- **Solution.** `src/shared/presets.ts` defines `PURPOSE_PRESETS` (Balanced dark, Deep dark, Dim
  reading, High contrast, Soft night) with a palette plus calibration, `applyPurposePreset()` writing
  only existing `Settings` fields (so persistence needs no schema change), and `matchPurposePreset()`
  for the pressed state. Rendered in the Themes tab with descriptions wired via `aria-describedby`.
- **Files.** `src/shared/presets.ts` (new), `src/options/tabs/ThemesTab.tsx`,
  `src/ui/styles/components.css`.
- **Tests.** `tests/unit/presets.test.ts` (14: ids/labels, atomic application, unrelated settings
  untouched, persistence through `sanitizeSettings`, null when customised, contrast floors per
  preset) and a UI test.
- **Verification.** Pass.

### 07 — Live theme preview

- **Problem.** Only 3-token swatches on theme cards. No way to see how the current calibration
  affects a raised card, muted text, a button, an input or a border — or whether the result is
  readable.
- **Solution.** `ThemePreview` renders the surface set from `buildTokens()` — the same function the
  content script uses — with measured text/muted/link/border ratios and an explicit "preview only"
  caption. It is non-interactive by construction (no inputs/buttons), so it adds no tab stops.
- **Files.** `src/ui/ThemePreview.tsx` (new), `AppearanceTab.tsx`, `ThemesTab.tsx`,
  `src/ui/styles/components.css`.
- **Tests.** `tests/unit/ui-accessibility.test.tsx`: inline background equals the token, ratios are
  rendered, zero interactive descendants, updates when settings change, custom-theme colours appear.
- **Verification.** Pass.

### 08 — Per-website theme customisation

- **Problem.** `siteOverrides` was fully supported by storage and by `getEffectiveSettings`, and the
  README advertised "per-site visual overrides" — but the Websites tab could only list and delete
  them. Users could not create one.
- **Solution.** `SiteOverrideEditor`: validated hostname input, "inherit global theme" or an explicit
  theme, and brightness/contrast/warmth sliders that start at global values. Only values differing
  from globals are stored, so later global changes to unrelated sliders are not shadowed. Includes a
  reset-to-globals action, a "change at least one value" guard, and a capacity guard
  (`MAX_SITE_OVERRIDES`).
- **Files.** `src/options/tabs/SiteOverrideEditor.tsx` (new), `src/options/tabs/WebsitesTab.tsx`,
  `src/shared/defaults.ts`.
- **Tests.** `ui-accessibility.test.tsx` (6), plus existing decision tests for nearest-host matching
  and override precedence.
- **Verification.** Pass at unit level; one new browser test exercises the full path (unrun here).

### 09 — Better popup and settings UI

- **Problem.** The UI was already cohesive but had three concrete inconsistencies: `ThemeGrid`
  duplicated the premium id list (a new palette could be silently missing from the grid),
  `AppearanceControls` carried a dead `compact` prop, and empty states were hand-rolled four times.
- **Solution.** `ThemeGrid` derives from `PREMIUM_THEME_IDS`; the dead prop is gone; a shared
  `EmptyState` (with real text, `role="status"`) replaces the duplicated markup; error containers in
  the Websites/Overview tabs render only when they have content.
- **Files.** `src/ui/components.tsx`, `WebsitesTab.tsx`, `OverviewTab.tsx`.
- **Tests.** `ui-accessibility.test.tsx` (empty-state text, error announcements), existing
  `popup.test.tsx`.
- **Verification.** Pass.

### 10 — Keyboard and accessibility improvements

- **Problem.** OS reduced-motion support was already implemented in `ui.css` (an early draft of the
  audit wrongly said otherwise; it was corrected before any code was written). Real gaps: the
  settings sidebar switched sections without moving focus or announcing the change, there was no
  skip link past the header/nav, and four empty `role="alert"` regions sat in the accessibility tree.
- **Solution.** `onSidebarKeyDown` implements Arrow/Home/End with focus following selection,
  `aria-controls="options-main"` on each section button, a `role="status" aria-live="polite"`
  announcement of the active section, a visible-on-focus skip link to `#options-main` (which is
  focusable via `tabIndex={-1}`), and conditional error rendering.
- **Files.** `src/options/Options.tsx`, `WebsitesTab.tsx`, `OverviewTab.tsx`,
  `src/ui/styles/components.css`.
- **Tests.** `ui-accessibility.test.tsx` (7 a11y tests: names on every tab of popup + options, unique
  ids, skip link, arrow keys, announcement, live status region) + existing contrast suite.
- **Verification.** Pass.

### 11 — Theme engine performance optimisation

- **Problem.** Three avoidable costs on every settings change: (a) `update()` always rebuilt base CSS,
  re-detected native dark and re-scanned the whole document, even when the effective config was
  identical (e.g. editing an unrelated site rule); (b) `getBoundingClientRect()` was called for every
  element although geometry is only used for canvas/SVG plates — a forced layout read per node;
  (c) native-dark detection detached/reattached styles on every evaluate.
- **Solution.** `configSignature()` (tokens + accessibility + reading mode + compatibility + batch/
  debounce/cache) short-circuits identical updates; geometry reads are gated on `kind !== 'element'`;
  detection is cached per URL with explicit invalidation.
- **Files.** `src/engine/engine.ts`.
- **Tests.** `engine-hardening.test.ts`: identical `update()` performs **0** `getComputedStyle` calls
  (spy) while a changed theme still re-themes; a page with no canvas/SVG performs **0**
  `getBoundingClientRect` calls while a canvas page still measures and keeps its plate.
- **Verification.** Pass. Evidence is call counts, not wall-clock time — deliberately, because timing
  in a shared sandbox is not a reliable benchmark.

### 12 — Mutation observer optimisation

- **Problem.** Coverage gaps (see 01) and an unmerged pair of debounce paths that could schedule a
  re-evaluate and a rescan separately.
- **Solution.** One debounced re-evaluate path with explicit `forceDetect` semantics (root changes must
  re-detect, settings changes must not), style-attribute relevance filtering retained, shadow-root
  observation uses the same observer, and `stop()` disconnects everything.
- **Files.** `src/engine/engine.ts`.
- **Tests.** Existing quiescence test (0 mutations after settling) plus `engine-hardening.test.ts`
  "does not reprocess an unchanged document in a loop".
- **Verification.** Pass.

### 13 — Memory and resource management

- **Problem.** The gradient/shadow payload map (`cssValues`) grew without bound; the content script
  kept a 60-second interval alive even when no schedule was configured.
- **Solution.** `MAX_CSS_VALUES` (4,000) with wholesale clear, cache cleared on `stop()`;
  `syncScheduleTimer()` creates the ticker only while `schedule.enabled` and clears it on dispose.
- **Files.** `src/engine/engine.ts`, `src/content/content.ts`.
- **Tests.** `engine-hardening.test.ts` (after `stop()`, new nodes are not processed and no styles
  remain), `security.test.ts` (bounds), existing lifecycle tests.
- **Verification.** Pass.

### 14 — Reliable theme restoration

- **Problem.** Restoration was attribute-based and generally correct, but not covered for: repeated
  full cycles, stopping before the first flush, and shadow content across removal/re-attachment.
- **Solution.** Always clear `data-nl-ready` from the document element in teardown, strip detached
  shadow contexts, keep teardown idempotent, and make `stop()` also clear caches and the URL cache.
- **Files.** `src/engine/engine.ts`.
- **Tests.** `engine-hardening.test.ts`: four enable/disable cycles produce byte-identical
  `documentElement.outerHTML` with 0 managed attributes and no ready marker; stopping immediately after
  `start()` leaves nothing behind; `stop()` stops scheduling.
- **Verification.** Pass.

### 15 — Error recovery and settings validation

- **Problem.** After an extension update, an orphaned content script throws
  `Extension context invalidated` from every storage and message call, leaving the page themed with no
  recovery path. Settings sanitisation also allowed unbounded per-site maps, duplicate custom-theme
  ids, and a dangling `theme: 'custom'` pointer that silently produced a generic palette.
- **Solution.** `isExtensionContextValid()` gates every storage/message call; `loadSettings` degrades
  to defaults with a single informational log; `updateSettings`/`resetSettings` reject with
  `STALE_CONTEXT_ERROR`; `subscribeToSettings` never lets one subscriber break the others and returns a
  no-op when the context is gone. Sanitisers now cap every map, de-duplicate ids, bound id length, and
  normalise the custom-theme selection. The dead `backupVersion` field was removed.
- **Files.** `src/shared/storage.ts`, `src/shared/defaults.ts`, `src/shared/types.ts`,
  `src/content/content.ts`.
- **Tests.** `security.test.ts` (stale context, missing `chrome`, throwing subscriber, caps, dangling
  pointer, unusable entries).
- **Verification.** Pass.

### 16 — Security hardening

- **Problem.** The service worker accepted any message object and returned **raw** stored data for
  `nightlens/get-storage`; the content script's debug reply broadcast the entire settings object —
  including the list of per-site rules — to any extension-page listener.
- **Solution.** Validators for every message type; `sender.id === chrome.runtime.id` check in the
  worker; sanitised settings in replies; diagnostics limited to counters + preset name + hostname;
  unknown request types ignored (no work started). The `any` casts in the debug consumer and the
  storage sanitiser were replaced with typed guards.
- **Files.** `src/shared/messages.ts`, `src/background/handlers.ts`, `src/background/index.ts`,
  `src/content/content.ts`, `src/ui/hooks.ts`, `src/shared/storage.ts`.
- **Tests.** `security.test.ts` (22), including a test that the broadcast payload contains no
  `settings` key and does not contain a hostname that exists only inside `siteRules`.
- **Verification.** Pass.

### 17 — Privacy-first architecture

- **Problem.** Privacy claims lived in prose; nothing failed if a future change added a network call
  or a permission.
- **Solution.** `docs/PRIVACY.md` (stored data, in-memory processing, permissions and their purpose,
  message flows, custom CSS/import boundaries, deletion paths) plus `tests/unit/privacy.test.ts`,
  which reads every source file and the manifest and asserts: no network APIs, no `eval`/`Function`,
  no HTML injection, no `localStorage`/IndexedDB, no history/cookie/webRequest/scripting APIs, no
  tracking dependency, `permissions === ["storage"]`, empty `host_permissions`, no
  `externally_connectable`/`web_accessible_resources`, `chrome.storage.local` only, and a documented
  data flow matching the code.
- **Files.** `docs/PRIVACY.md` (new), `tests/unit/privacy.test.ts` (new), `README.md`.
- **Verification.** Pass (11 assertions).

### 18 — Comprehensive automated testing

- **Problem.** New behaviour without tests is a liability; several audit findings had no regression
  test (stale context, message rejection, history chaining, bounds, a11y names, privacy).
- **Solution.** Four new test files plus additive cases in `color.test.ts`, and one browser test.
- **Files.** `tests/unit/engine-hardening.test.ts`, `detect.test.ts`, `security.test.ts`,
  `privacy.test.ts`, `presets.test.ts`, `ui-accessibility.test.tsx`, `tests/unit/color.test.ts`,
  `tests/e2e/extension.spec.ts`.
- **Tests added.** +95 (606 → 701) across 15 files.
- **Verification.** `npm test`: 701/701 pass. No test was deleted, skipped or weakened.

### 19 — GitHub Actions CI/CD

- **Problem.** Actions were pinned to floating major tags, everything ran in one job (so a Playwright
  download failure hid the unit result), there was no browser cache, no manual trigger, and nothing
  checked the *built* manifest.
- **Solution.** Two jobs on `ubuntu-24.04`: `verify` (typecheck → unit → build → assertion that the
  built manifest still requests only `storage` with no host permissions → artifact upload → job
  summary) and `e2e` (needs `verify`, caches `~/.cache/ms-playwright` keyed on the lockfile, installs
  Chromium with deps, runs `npm run test:e2e`, publishes failures as check annotations and a PR
  comment, uploads traces/screenshots/HTML report on failure). Workflow-level
  `permissions: contents: read`, `concurrency` with cancel-in-progress, `workflow_dispatch`, and all
  four third-party actions pinned to commit SHAs of the Node 24 majors.
- **Files.** `.github/workflows/ci.yml`, `playwright.config.ts`.
- **Verification.** [Run 42561937603](https://github.com/ujjwalmaurya890-ops/night-lens/actions/runs/42561937603):
  **both jobs `success`**, zero annotations. `verify` 28 s, `e2e` 1 m 42 s, **42/42 browser tests
  passing** in real Chromium with the unpacked extension. Before the pipeline could run, its `run:`
  steps were replayed locally in workflow order, and all four action SHAs were confirmed through the
  API to be real commits equal to each action's tag.
- **What execution bought.** Getting the suite to run found three test defects and one product bug;
  see [TEST_REPORT.md](TEST_REPORT.md#browser-e2e-executed-in-ci). The product bug — the install seed
  discarding concurrently written settings — could not have been found any other way.
### 20 — Professional open-source documentation

- **Problem.** No `CHANGELOG.md`, no `SECURITY.md`, no `docs/PRIVACY.md`, no `docs/DEVELOPMENT.md`, no
  audit or report trail; README described features that were only partially exposed in the UI.
- **Solution.** Added `CHANGELOG.md`, `SECURITY.md` (reporting, supported versions, scope, threat
  model, verifiable guarantees), `docs/PRIVACY.md`, `docs/DEVELOPMENT.md` (setup, commands, source map,
  how to add a theme/message, testing rules, debugging, release checklist), `docs/ENGINEERING_AUDIT.md`,
  `docs/CONTRIBUTION_TRACKER.md` and this report. Updated README (purpose presets, preview, override
  editor, verification table with real numbers, documentation index), `CONTRIBUTING.md` (no-overclaim
  rule, a11y/security/bounds requirements, new suites), `docs/ARCHITECTURE.md` (detection, observer
  coverage, fingerprint, ref-counted history, reliability and privacy invariants),
  `docs/LIMITATIONS.md` (shadow reach, iframes, stale tabs, deliberately unimplemented items) and
  `docs/TEST_REPORT.md` (measured results, honest E2E status).
- **Tests.** `privacy.test.ts` asserts `docs/PRIVACY.md` documents the storage key, `chrome.storage.local`,
  no-network, uninstall behaviour and permissions — documents cannot silently drift from the code.
- **Verification.** Reviewed against the implementation; links checked by inspection.

---

## C. Quality report

| Category | Before | After | Evidence |
|---|---|---|---|
| **Reliability** — extension update in an old tab | Throws `Extension context invalidated` on every call; page stays themed | Detects the stale context, restores the page, detaches listeners; writes fail with an actionable message | `security.test.ts` «restores the page and detaches listeners when the extension goes away», «does not throw when chrome itself is missing» |
| **Reliability** — repeated toggle | Untested for cycles/shadow content | 4-cycle byte-identical restoration; shadow host removal strips attributes | `engine-hardening.test.ts` restoration + shadow tests |
| **Reliability** — SPA history patching | Chained wrappers possible; original restored wrongly | One ref-counted patch per window | `engine-hardening.test.ts` (2) |
| **Reliability** — corrupt settings | Per-field fallback, but unbounded maps and dangling custom theme | Caps on all maps, id de-duplication, normalised custom pointer | `security.test.ts` (4 bounds tests) |
| **Performance** — settings update | Full document re-read on every storage write | 0 computed-style reads when the config is unchanged; full pass on real change | `engine-hardening.test.ts` spy assertions |
| **Performance** — layout reads | `getBoundingClientRect()` per element | 0 for plain pages; only canvas/SVG | `engine-hardening.test.ts` spy assertions |
| **Performance** — native-dark detection | Detach/reattach + style recalc per evaluate | Cached per URL, invalidated on navigation/theme flip | `engine-hardening.test.ts`, `detect.test.ts` |
| **Accessibility** — controls | Named and keyboard-operable | Same, now asserted automatically for every tab | `ui-accessibility.test.tsx` (7) |
| **Accessibility** — page structure | No skip link; silent section change; empty alerts | Skip link, arrow-key nav, polite announcement, no empty alerts | `ui-accessibility.test.tsx` (4 relevant) |
| **Accessibility** — contrast | Token tests for the extension UI | Unchanged and still passing (no regressions) | `ui-contrast.test.ts` (40) |
| **Security** — worker messages | Any `{type}`, raw storage reply | Type + sender validation, sanitised replies | `security.test.ts` (5) |
| **Security** — diagnostics | Full settings broadcast | Counters + preset only | `security.test.ts` |
| **Security** — permissions | `storage` only | `storage` only, now asserted on the built bundle in CI | `privacy.test.ts`, CI step |
| **Privacy** — invariants | Prose only | 11 automated invariants | `privacy.test.ts` |
| **Testing** | 606 tests / 9 files | **704 tests / 15 files** | `npm test` |
| **Testing** — browser | 41 Playwright tests, never executed | **42**, all passing in CI | [run 42561937603](https://github.com/ujjwalmaurya890-ops/night-lens/actions/runs/42561937603) |
| **DX** | Single CI job, floating tags | Two jobs, SHA-pinned Node 24 actions, caching, manifest check, readable failures, summaries | `.github/workflows/ci.yml` |
| **Docs** | 9 docs | 15 docs + root `SECURITY.md`/`CHANGELOG.md` | repository tree |

**No numerical improvement is claimed that was not measured.** Where only a structural improvement
was possible (workflow execution, browser behaviour), the report says so.

---

## D. Git summary

- **Branch:** `arena/bfb506ae-night-lens`, pushed to `origin`; pull request
  [#5](https://github.com/ujjwalmaurya890-ops/night-lens/pull/5) opened against `main` after explicit
  permission. Nothing was pushed to `main` and nothing was merged.
- **Commits (oldest first):** milestone commits `40029ac`, `d55d9a7`, `f2d3851`, then the CI/docs
  commits, the browser-suite fixes, the `ensureSettings` product fix, and the final documentation
  pass — see `git log 47fd171..HEAD`.
- **Size:** 54 files, +3,793 / −299 at the time of writing — source, tests, workflow and docs, plus the
  rebuilt `dist/` assets this repository tracks. The documentation commit itself shifts these numbers
  slightly, which is why they are quoted as a snapshot rather than an invariant.
- **History integrity:** no commit dates were changed, no existing commit was rewritten, and every
  commit corresponds to a step that was typechecked and unit-tested before it was made. The CI
  iterations are real failing runs kept in history rather than squashed away.
- **Verification trail:** six GitHub Actions runs. The first five are red and each one is the reason
  for a fix; [run 42561937603](https://github.com/ujjwalmaurya890-ops/night-lens/actions/runs/42561937603)
  is green on both jobs with zero annotations.

## E. Remaining limitations

1. **The browser suite is CI-only.** Chromium cannot be downloaded in the development sandbox, so the
   42 Playwright tests run on GitHub Actions rather than locally. They pass there; nobody has run them
   on macOS, Windows or a real user's Chrome profile.
2. **Closed shadow roots are unreachable.** Documented; not worked around, because the only workaround
   (patching `Element.prototype.attachShadow`) affects every page.
3. **Late `attachShadow()` without a surrounding mutation** is themed on the next rescan rather than
   immediately. Documented.
4. **Pseudo-state colours** (`:hover`/`:focus` author backgrounds) are still suppressed on recoloured
   elements by the `!important` attribute rules. This is the longest-standing engine limitation and
   remains unfixed — solving it requires rewriting author stylesheets or reading cross-origin sheets.
5. **Elevation inversion** on pages where cards are lighter than the page background is unchanged
   (documented limitation). Changing the mapping would alter every themed page, and the visual
   verification needed to do that safely is not available in this environment.
6. **No ESLint.** The project has no lint configuration; introducing one mid-audit would either be a
   non-blocking signal or block a green build on pre-existing style findings.
7. **`dist/` and `nightlens.zip` are tracked in Git.** This predates the pass. The rebuild changed
   hashed asset names; the zip is stale. Untracking them is a repository-hygiene decision for the
   maintainer (roadmap item 8).
8. **CI is unverified locally.** The workflow is syntactically valid and pinned, but its first real
   run happens on GitHub.
9. **Screen readers, OS high-contrast, RTL, print and zoom/DPI** were reasoned about from markup/CSS,
   not tested with assistive technology.
10. **Battery/GPU/memory behaviour and first-paint flash timing** are not measured.

---

## F. Future roadmap

Ten valuable next steps that do not duplicate the work above:

1. **Pseudo-state colour preservation.** Investigate rewriting author colour declarations through
   `CSSStyleSheet`/the CSSOM while respecting CSP, with a fixture-based safety net before shipping.
2. **Visual regression baseline.** Deterministic screenshots per fixture (pixel diffing in CI) so
   mapping changes like elevation inversion can be evaluated safely. This is the prerequisite for
   fixing limitation 5.
3. **Automated accessibility-tree checks** (e.g. axe-core in Vitest and Playwright) to extend the
   name/label assertions into full rule coverage, plus one manual screen-reader pass recorded in docs.
4. **First-paint and long-task measurement.** A Playwright trace-based budget per fixture
   (e.g. no long task > 50 ms during the first theming pass), replacing the current call-count proxies.
5. **Content-Security-Policy hardening.** Evaluate declaring an explicit `content_security_policy.
   extension_pages` and measure whether it survives the Vite builds; document either outcome.
6. **Additional browser verification.** Run the suite against Edge and, if feasible, one Chromium
   derivative; record results instead of claiming "Chromium-based" support.
7. **ESLint + import-boundary rules.** Enforce the layering (`engine` must not import from `ui`,
   `content` must not import React) and catch unused/deprecated patterns automatically.
8. **Repository hygiene.** Stop tracking `dist/` and `nightlens.zip`; publish builds as release
   artifacts generated in CI, with a provenance note.
9. **Per-site compatibility telemetry-free reporting.** Give users a local, copyable diagnostics panel
   (already partially served by the minimal debug payload) so bug reports can include engine counters
   without sharing browsing data.
10. **Importable preset packs for custom themes.** Extend the existing theme import/export into a
    documented, versioned preset-pack format with schema validation and a round-trip test.
