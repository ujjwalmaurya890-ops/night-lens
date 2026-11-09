# Engineering audit — NightLens

**Audit date:** 2026-11-09
**Branch audited:** `arena/bfb506ae-night-lens` (base commit `47fd171`)
**Auditor role:** maintainer-level review of engine, UI, security, testing, and documentation

This audit was produced by reading every source file, test, script, manifest, workflow and
document in the repository, then running the checks that exist. Findings below cite the code
they refer to. Nothing here is inferred from the project description alone.

## 1. Baseline verification (measured, not assumed)

Commands discovered in `package.json`: `build`, `preview:ui`, `typecheck`, `test`,
`test:e2e`, `verify`. There is **no lint script and no ESLint configuration**.

| Check | Command | Result |
|---|---|---|
| Install | `npm ci` | Pass (lockfile respected) |
| Type check | `npm run typecheck` | Pass, 0 errors |
| Unit/integration | `npm test` | **606 / 606 passing**, 9 files, ~36 s |
| Production build | `npm run build` | Pass; `dist/` Manifest V3 bundle generated |
| E2E | `npm run test:e2e` | **Not executable in this sandbox**: `npx playwright install chromium` cannot download Chrome for Testing (blocked network), and no system Chromium exists. CI runs it on a network-enabled runner. No E2E result is claimed here. |
| Lint | — | Not configured |

The repository is therefore in a *green but partially verified* state: unit level is proven,
browser level is only proven in CI.

## 2. Current architecture (verified against code)

```text
popup / options (React)
   │ updateSettings()  ── serialized writes ──► chrome.storage.local["nightlens:settings"]
   │                                                    │ onChanged
   │                                                    ▼
   │                                       content script (every frame)
   │                                         decide() → getEffectiveSettings()
   │                                         ThemeEngine.start()/update()/stop()
   │                                                    │
   │                                          read computed styles → map colours
   │                                          write data-nl-* attributes + rule text
   ▼
usePageStatus() ── GET_STATUS ──► top frame ── STATUS_CHANGED ──► popup
MV3 service worker: command toggle, badge, install/startup, get-storage / export-settings
```

Detection: `detectNativeDark` (`src/engine/detect.ts`) uses an opaque `body`/`html`
background luminance (< 0.2) or the `color-scheme` property, re-run with NightLens' own
styles detached. Colour mapping: `src/engine/mapper.ts` + `src/engine/palette.ts`; per-element
rules are generated as attribute selectors with `!important` (`src/engine/engine.ts`
`RULE_FOR`), so removing the two injected `<style>` elements restores the page.

## 3. Findings

Legend: **Existing** = already implemented and working; **Gap** = a real defect or missing
capability found during this audit.

| Area | Existing condition | Problem found | Proposed solution |
|---|---|---|---|
| Theme engine — dynamic content | `MutationObserver` on document + open shadow roots, `class`/`style` filtered, batched queue, `SUBTREE_REPROCESS_LIMIT` (engine.ts:141-144, 434-470) | Only `class`/`style` attribute changes on inner elements are observed; sites that flip `data-theme` / `data-color-mode` on a non-root container are never re-themed. Added subtrees are enqueued without the subtree cap. | Observe theme-relevant `data-*` attributes and `role` on every element, keep the style-attribute relevance filter, and keep the existing cap only on class-change subtree reprocessing (insertions stay uncapped so no tail is left unstyled). |
| Colour parsing | hex/hex8, rgb/rgba, hsl/hsla, oklab/oklch, lab/lch, `color(srgb\|srgb-linear\|display-p3)`, 6 named colours (color.ts:37-40, 159-185) | `hwb()` is unsupported, and any named colour other than the six returns `null` (fine in Chrome, wrong in non-browser DOMs and in gradients/shadow strings that still carry names). | Add `hwb()`, extend the named-colour table, keep unknown values returning `null` so the element is left alone. |
| Gradient/shadow mapping | `mapGradient`/`mapBoxShadow` remap literal stops and reject `url()`/`;{}` (mapper.ts:85-95); prefixed gradients are matched because `-webkit-linear-gradient(` contains `linear-gradient(` | No defect found; verified with new tests. Colour parsing itself is the weak point (`hwb()`, named colours), which is fixed above. | Keep the guards, add regression tests for prefixed and multi-layer values. |
| Native-dark detection | luminance + `color-scheme` (detect.ts:12-28) | Ignores `<meta name="color-scheme">` and the de-facto `--background`/`--bg` CSS-variable convention; the whole check (which detaches and re-attaches styles) runs on **every** settings update. | Add meta + CSS-variable heuristics and cache the result per URL, invalidating on navigation and on page theme flips. |
| SPA support | `popstate`, `hashchange`, wrapped `pushState`/`replaceState` (engine.ts:199-243) | The history patch is per-engine: engine A patches, engine B saves A's patched function as "original"; stopping A leaves the page patched by B (and vice versa) — a real leak when the content script and a test/other engine overlap. No support for the Navigation API used by newer SPAs. | Module-level ref-counted history patching restored when the last engine stops, plus `navigatesuccess`/`currententrychange` listeners. |
| Shadow DOM / iframes | open roots get their own style context; `all_frames: true`; frame identity from `ancestorOrigins` | Closed roots unreachable (documented). When a shadow host is removed while active, its context is detached **without stripping** the managed attributes inside it, so a re-attached root keeps stale `data-nl-*` attributes with no matching rules. | Strip before detaching; document closed-root and late-`attachShadow` limits explicitly. |
| Perf — element reads | reads are batched before writes (engine.ts:494-520) | `getBoundingClientRect()` is called for **every** element although geometry is only used for canvas/SVG plates — a forced layout query per element. | Measure geometry only for canvas/SVG. |
| Perf — settings updates | `content.apply()` → `engine.update()` on every storage change | `update()` unconditionally rebuilds base CSS, re-evaluates native dark, and `rescanAll()`s the whole document even when the effective config is byte-identical (e.g. editing an unrelated site rule). | Config fingerprint; skip the pass when nothing that affects rendering changed. |
| Memory/resources | `seenColors` capped at 2000, `MAX_RULES` 5000, observer/timer cleanup in `stop()` (engine.ts:185-203) | `cssValues` (gradient/shadow payloads) is never bounded; the 60 s schedule interval in the content script runs even when no schedule is configured. | Bound and clear the map, only run the interval while a schedule exists. |
| Restoration | attributes are never stored/overwritten; `teardownApplied` strips managed attributes (engine.ts:296-316) | Detached shadow-root contexts (above) and a `stop()` that happens while `applied === false` after a partial start are not verified; there is no repeated-cycle regression test that also covers shadow content. | Strip detached contexts, always clear `data-nl-ready`, add cycle tests. |
| Settings validation | `sanitizeSettings` per field, prototype-pollution safe (storage.ts:144-210) | `siteThemes`, `siteOverrides` and `customCSS` are unbounded in entry count (rules are capped at 2000); duplicate custom-theme ids are accepted; `theme: 'custom'` with a dangling `activeCustomThemeId` silently falls back to a palette named "custom"; `backupVersion` is declared but never written or read (dead field). | Cap all maps, de-duplicate ids, normalise the custom-theme pointer, remove the dead field, keep `any` out of the sanitiser. |
| Error recovery | `loadSettings` falls back to defaults; `updateSettings` rejects so the UI can show an error (storage.ts:216-241) | After an extension update/reload, old tabs keep a content script whose `chrome.runtime` no longer has an `id`; every `sendMessage`/`storage` call throws `Extension context invalidated` and the page stays themed with no way to recover. | `isExtensionContextValid()` guard, safe message helpers, self-dispose on invalidation, tests with an invalidated mock. |
| Security — messages | content script checks `sender.id` before acting; message validators exist (messages.ts) | The service worker handler accepts any `{type}` and returns **raw** stored data for `nightlens/get-storage`; the content script's debug reply broadcasts the entire settings object (including every site rule) to extension-page listeners. | Validate message shapes, verify `sender.id` in the worker, return sanitised settings, and send a minimal debug payload; type the debug consumer instead of `any`. |
| Accessibility | focus-visible outlines, switch roles, slider labels, live status region, OS reduced-motion tokens (ui.css:145), contrast tests (ui-contrast.test.ts) | OS reduced motion is implemented (the first draft of this audit wrongly claimed otherwise — checked against the CSS). Real gaps: the options sidebar changes sections without announcing it and has no arrow-key navigation, there is no skip link to the main region, and no automated test asserts accessible names or duplicate ids. | Arrow-key/roving focus for the sidebar, a polite section announcement, a skip link, and an a11y assertion suite. |
| UX — theme preview | theme cards show 3-token swatches; custom theme form has a small preview | No preview of a *complete* surface set (raised card, muted text, button, input, border, link) for the live settings, and no measured contrast readout. | Add a `ThemePreview` component driven by `buildTokens()` with displayed contrast ratios, marked as preview-only. |
| UX — per-site overrides | `siteOverrides` supports theme/brightness/contrast/warmth/saturation (types.ts:56-62, decision.ts:51-66) | The Websites tab can only **list and delete** overrides; users cannot create one, although README advertises "per-site visual overrides". | Add a validated per-site override editor with reset. |
| UX — presets | ten palettes + legacy + system + custom | The five documented *purposes* (balanced dark, deep dark, dim reading, high contrast, soft night) are not exposed as switchable, persistable choices. | Add `PURPOSE_PRESETS` (theme + brightness/contrast/warmth) applied atomically. |
| UI consistency | shared `SectionCard`/`Switch`/`Slider`/`StatusLine`, tokens in `ui.css` | `ThemeGrid` hardcodes the premium id list instead of `PREMIUM_THEME_IDS`; `AppearanceControls` keeps an unused `compact` prop; empty states are hand-rolled in three places. | Use the exported id list, delete the dead prop, add a shared `EmptyState`. |
| Testing | 606 tests across 9 files | No tests for: malformed/oversized maps, extension-context invalidation, message-shape rejection, history-patch ref counting, config-fingerprint skipping, rect-query elision, preset contrast floors, privacy invariants, a11y names/ids. | Add focused suites; never delete an existing test. |
| CI | `.github/workflows/ci.yml`: checkout/setup-node/`npm ci`/typecheck/test/build/Playwright | Third-party actions pinned to floating major tags (`@v4`) rather than immutable SHAs; single job so a Playwright download failure hides unit results; no `workflow_dispatch`, no browser cache, no job summary. | Pin to commit SHAs, split `verify` and `e2e` jobs, cache Playwright browsers, add a summary and manual dispatch. |
| Docs | README, ARCHITECTURE, INSTALL, LIMITATIONS, SECURITY_AND_PRIVACY, TEST_REPORT, CONTRIBUTING, issue templates | No `CHANGELOG.md`, `SECURITY.md`, `docs/PRIVACY.md`, `docs/DEVELOPMENT.md`; README claims reduced-motion OS support that the CSS did not implement; no audit/tracker/report history. | Add the missing documents, correct the claim, and record verified evidence only. |

## 4. Contribution mapping (what is new work vs. verification)

Several objectives in the brief are already implemented. They are **verified, not duplicated**:

| # | Objective | Status before this work |
|---|---|---|
| 01 | Dynamic detection | Partially — attribute coverage and subtree cap missing |
| 02 | Colour mapping | Mostly — `hwb()`, named colours, prefixed gradients missing |
| 03 | Native-dark detection | Partially — meta/variable heuristics, caching missing |
| 04 | SPA compatibility | Partially — history patch not ref-counted, no Navigation API |
| 05 | Shadow DOM / iframes | Mostly — detached-context strip and documentation missing |
| 06 | Theme presets | Partially — palettes exist, purpose presets do not |
| 07 | Live preview | Missing (only 3-token swatches) |
| 08 | Per-site customisation | Partially — storage/decision exist, creation UI missing |
| 09 | Popup/settings UI | Mostly — inconsistency, dead prop, duplicated empty state |
| 10 | Accessibility | Partially — OS reduced motion exists; sidebar keyboard/announcement, skip link and a11y assertions missing |
| 11 | Performance | Missing — rect elision, fingerprint skip, detection cache |
| 12 | Observer optimisation | Partially — attribute coverage, added-subtree cap |
| 13 | Resource management | Partially — `cssValues` unbounded, unconditional interval |
| 14 | Restoration | Mostly — detached shadow context, cycle tests |
| 15 | Error recovery | Missing — extension-context invalidation |
| 16 | Security hardening | Partially — worker sender check, sanitised replies, minimal payload |
| 17 | Privacy | Partially — `docs/PRIVACY.md`, automated invariant test |
| 18 | Automated testing | Partially — new behaviour untested |
| 19 | CI/CD | Partially — SHA pinning, job split, caching, summary |
| 20 | Documentation | Partially — four major documents missing |

## 5. Implementation plan and risk

Four milestones, each independently testable and committed separately.

| Milestone | Contents | Risk | Mitigation |
|---|---|---|---|
| 1 — Core engine | 01, 02, 03, 04, 05, 11, 12, 13, 14 | Medium: the engine is the product | Only additive heuristics + guarded caches; every change lands with a jsdom regression test; no replacement of the attribute-rule architecture |
| 2 — UX | 06, 07, 08, 09, 10 | Low: additive React components | Reuse `buildTokens()` as the single source of truth; no change to storage schema (new fields optional) |
| 3 — Reliability & security | 15, 16, 17 | Medium: message/worker paths | Validators kept pure and unit-tested; worker still accepts the two existing message types |
| 4 — DX & docs | 18, 19, 20 | Low | Workflow pinned to resolved SHAs; docs record only executed commands |

**Explicitly rejected (too risky for the value):** monkey-patching `Element.prototype.attachShadow`
to catch shadow roots created after the first pass. It runs on every page in the user's browser and
would be a new source of site breakage. The limitation is documented instead.

**Deliberately not added:** ESLint. Introducing a new toolchain mid-audit would either be
non-blocking (misleading signal) or block a green build on hundreds of pre-existing style
findings. It is listed in the future roadmap for a dedicated change.
