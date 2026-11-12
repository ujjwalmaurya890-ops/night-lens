# Architecture

## Runtime model

```text
Popup / Options ── writes ──> extension local storage ("nightlens:settings")
                                   │ onChanged
                                   ▼
HTTP/HTTPS content script ──> decide() + effective per-site settings
        │                              │
        │                              ▼
        │                       ThemeEngine (one per frame)
        │                              │
        │                              ├─ palette + color mapper
        │                              ├─ computed-style reads
        │                              ├─ generated attribute rules
        │                              └─ mutations + SPA + shadow roots
        ▼
Validated status messages ──> Popup

MV3 service worker: command, install/startup badge, settings export messages
```

Storage is the synchronization bus. The popup/options write settings; every content script subscribes to changes and reconfigures its engine. The popup asks the top-frame content script for hostname/status, so no `tabs` permission is needed. Messages use validators in `src/shared/messages.ts` and check extension/tab/frame identity.

The service worker has no periodic alarm. Schedules and system/reduced-motion media queries are evaluated in active content scripts. Page unload cleanup releases listeners, timers, observers, styles, and subscriptions; BFCache navigations remain intact.

## Source layout

```text
manifests/
  base.mv3.json            shared manifest keys
  {chrome,edge,brave,opera,firefox,safari}.json   per-engine overrides
src/
  adapters/
    browser/
      index.ts             detection, namespace choice, cached facade (getBrowserApi)
      types.ts             the API surface the application is allowed to use
      errors.ts            typed errors with actionable messages
      call.ts              promise/callback invocation, listener helpers, safe calls
      compose.ts           assembles the per-API adapters into one facade
      chrome.adapter.ts    Chromium (callback-or-promise namespace)
      firefox.adapter.ts   Gecko (promise-only `browser` namespace)
      safari.adapter.ts    WebKit (both namespaces)
      runtime.adapter.ts   messaging, install/startup events, manifest, options page
      storage.adapter.ts   local storage + change events
      tabs.adapter.ts      active tab, message to a specific tab/frame
      commands.adapter.ts  keyboard shortcuts
      action.adapter.ts    toolbar badge/title + options page
      permissions.adapter.ts  host grants (Firefox) and grant-change events
      capabilities.ts      what this engine actually exposes
  shared/
    types.ts               Settings, theme IDs, site/status types
    defaults.ts            Defaults, limits, legacy migration
    hostname.ts            Normalization and nearest-host rule lookup
    storage.ts             Sanitization, queued writes, subscriptions, import/export
    decision.ts            Global/site/system/schedule decisions and effective settings
    css.ts                 Conservative custom-CSS validation
    presets.ts             Purpose presets (palette + calibration applied atomically)
    messages.ts            Message types and validators
  engine/
    color.ts               Color parsing, alpha blending, luminance, contrast
    palette.ts             Presets/custom themes and visual adjustments
    mapper.ts              Background/text/link/border/gradient/shadow mapping
    detect.ts              Native-dark heuristic
    styles.ts              Static theme/accessibility/reading-mode CSS
    engine.ts              DOM traversal, batching, dynamic rules, lifecycle
  content/                 Settings orchestration, status, cleanup
  background/              Command, badge, installation, and message handlers
  popup/                   React toolbar UI
  options/                 React settings dashboard (tabs/, SiteOverrideEditor)
  ui/                      Shared components, hooks, browser-specific copy, icons, styles
scripts/
  build.mjs                one Vite build → six manifests
  build/manifest.mjs       merge + validation
  build/targets.mjs        target table
  verify-build.mjs         built-output verification
  package.mjs, build/zip.mjs   store archives without dependencies
  safari-project.mjs       Apple converter wrapper (macOS only)
```

## Browser adapter layer

No application module calls `chrome.*` or `browser.*` directly. `src/adapters/browser/` owns that,
and `tests/unit/architecture.test.ts` fails the build if the rule is broken.

```text
popup / options / content / background
                │
                ▼
        getBrowserApi()  ── detected once per namespace object
                │
      ┌─────────┼──────────┬─────────────┐
      ▼         ▼          ▼             ▼
   runtime   storage     tabs      commands / action / permissions
      │         │          │             │
      └─────────┴──────────┴─────────────┘
                │
      chrome.* (hybrid)  |  browser.* (promise)
```

Design rules:

1. **Capabilities, not brand names.** `capabilities.*` is derived from the APIs that exist in the
   namespace, so an unusual fork or a stripped-down engine degrades instead of crashing.
2. **One call style per namespace.** `chrome.*` accepts a trailing callback *or* a promise (older
   Chromium forks vs current builds), so the Chromium adapter detects and supports both.
   `browser.*` on Gecko validates arity, so the Firefox adapter never appends a callback.
3. **Never throw for cosmetic work.** Badge text, title and background colour failures are
   swallowed; storage and messaging failures propagate as `BrowserApiError` with the API name so the
   UI can say what actually failed.
4. **No hardcoded browser assumptions in features.** Browser-specific *wording* (shortcut pages,
   store names, storage namespace) lives only in `src/ui/copy.ts`; browser-specific *behaviour* lives
   only in the adapters.
5. **Same engine everywhere.** `content.js` is byte-identical in all six builds. The build shares one
   bundling pass, so a Firefox user and a Chrome user cannot drift apart.

Firefox MV3 host access is the one platform difference with a UI consequence: the content script
does not run until the user allows the site, so the popup shows a **Grant access** notice backed by
`permissions.request` from a click.

## Build pipeline

`npm run build` performs one Vite build (popup/options pages + `content.js` + `background.js` IIFE
bundles + icons) into a staging directory, then emits each target by copying that directory and
writing its generated manifest. Every manifest is validated for engine rules *and* NightLens'
privacy invariants before it is written; every referenced path must exist. `npm run verify:build`
re-checks the built output, including that the HTML pages load no remote resources and that no
bundle contains `eval`/`new Function`/`XMLHttpRequest`.

See [BUILD.md](BUILD.md) for commands and [BROWSER_COMPATIBILITY.md](BROWSER_COMPATIBILITY.md) for
the per-engine differences.

## Per-site resolution

Hostnames are lower-cased and one trailing dot is removed. Rules for a multi-label DNS hostname walk from the exact host toward parent domains. The nearest entry wins:

```text
example.com: off
docs.example.com: on
v1.docs.example.com → on (nearest entry is docs.example.com)
www.example.com → off
notexample.com → no match
```

IPv4/IPv6 and single-label rules are exact-only. Theme assignments, `siteOverrides`, compatibility profiles, and custom CSS use the same lookup. A `siteOverrides.theme` takes priority over the older `siteThemes` entry. Global off always wins; site force-on bypasses native-dark detection and schedule/system waiting where documented.

## Native-dark detection

`detectNativeDark()` runs while NightLens's own styles are detached, so it sees the site's real
appearance. Signals are checked in order:

1. An opaque `body`/`html` background whose luminance (after compositing with white) is below
   `NATIVE_DARK_LUMINANCE` (0.2).
2. A declared colour scheme — the CSS `color-scheme` property or `<meta name="color-scheme">`.
   `dark light` is resolved against `prefers-color-scheme`.
3. A design-system backdrop variable (`--background`, `--bg`, `--surface`, …) that parses as an
   opaque colour — common in Tailwind/shadcn-style apps that paint a transparent body.

The result is cached per URL and invalidated on navigation and on root-level class/style changes,
so a settings write does not re-run the check (and its forced style recalculation) for nothing.
Per-site **force on** skips detection entirely; **exclude** wins before it is attempted.

## Theming pass

1. **Traverse** in document order, skipping non-rendered/media/replaced elements and extension-owned styles. Open shadow roots get their own style context.
2. **Strip** old managed attributes for elements being reprocessed.
3. **Read** computed background/foreground/border/gradient/shadow values in one batch. Effective background information is retained in weak maps.
4. **Map** colors through theme tokens. Light backgrounds become dark while hues and important distinctions are retained where practical.
5. **Write** `data-nl-*` attributes and deduplicated generated rules. Text and control borders are adjusted toward configured contrast targets against the nearest known effective background.

Disabling removes generated styles and managed attributes; the original author styles remain in place.

### Gradients, shadows, and images

Literal linear/radial/conic gradient color stops are remapped without changing direction, geometry, or positions. Shadow colors are darkened/softened while dimensions and inset behavior are retained. Generated declarations reject `url()` and CSS delimiters and use `CSS.supports` validation where available.

Non-gradient background images are different: the element and descendants are left author-controlled to avoid destroying intentional text overlays. Contrast cannot be guaranteed over arbitrary images or every point of a gradient.

### Media and SVG

- `img`, `video`, `audio`, `picture`, sources, tracks, frames, objects, and embeds are not traversed or inverted.
- Normal themes do not filter photographs/videos. Media-only mode applies an explicit 0.88 brightness filter to images/videos and skips color processing.
- Small SVG icons (up to 64px, bounded shape count) may have fill/stroke adjusted to at least the graphic contrast target.
- Large SVG illustrations are preserved. Large canvases and text-bearing SVG charts can receive the original light backdrop as a plate; pixels are not edited.
- Closed shadow roots are inaccessible; open roots are supported.

## Dynamic content and performance

- One tree `MutationObserver` observes the document and open shadow roots for child-list changes and
  for `class`, `style`, `role` and theme-related `data-*` attributes (`data-theme`, `data-color-mode`,
  `data-color-scheme`, `data-bs-theme`, `data-mode`, `data-theme-mode`). Sites that flip their own
  theme on an inner container are therefore re-themed, not only ones that change `<html>`/`<body>`.
- Added nodes enter a `Set`-deduplicated queue. Insertions are queued in full so the tail of a large
  append is never left unstyled; class changes traverse once with a 2,000-element cap; style churn
  that cannot affect colour is ignored.
- Work is time-sliced with `requestAnimationFrame` (default 400 elements/frame, configurable
  100–1,000). Each batch performs strip → reads → writes, and geometry
  (`getBoundingClientRect`) is only queried for canvas/SVG, never for ordinary elements.
- Parsed colours use a bounded cache (approximately 2,000 entries), which can be disabled. Gradient
  and shadow payloads use a separate bounded map (4,000 entries) that is cleared on stop.
- Generated rules are deduplicated per document/shadow context, with a 5,000-rule reset safeguard.
- `ThemeEngine.update()` compares a configuration fingerprint (tokens, accessibility, reading mode,
  compatibility, batch/debounce) and returns immediately when nothing that affects rendering
  changed — an unrelated settings write no longer re-reads the whole document.
- Root theme attribute changes are debounced (default 150ms) to re-run native-dark detection and
  reprocess.
- `popstate`, `hashchange`, the Navigation API (`navigatesuccess`, `currententrychange`) and wrapped
  `pushState`/`replaceState` trigger debounced SPA reprocessing. The history patch is **ref-counted
  per window**: concurrent engines share one wrapper, and the original methods are restored only when
  the last engine stops, so wrappers can never chain.
- Stylesheet/window load triggers rescanning. Removed shadow-host contexts are stripped and pruned, so
  a re-attached root never keeps orphaned `data-nl-*` attributes.
- Queued animation frames, timers, observers, listeners and caches are released during teardown;
  `stop()` also clears the `data-nl-ready` marker.

## Reliability boundaries

- `isExtensionContextValid()` guards every storage and message call. After an extension update or
  reload, an orphaned content script detects the dead runtime, restores the page and detaches instead
  of throwing on every interaction.
- Writes are serialised per extension surface and fail loudly (the UI shows an error) when storage
  is unavailable.
- Settings are sanitised on read, on write, on import, and before being returned by the service
  worker. Every collection is bounded, custom-theme ids are de-duplicated, and a dangling
  custom-theme pointer is normalised to a real selection.
- The service worker answers only messages carrying this extension's id, and only the two request
  types the extension uses. Content-script diagnostics broadcast counters and the active preset —
  never settings or the per-site rule list.

## Privacy invariants

`tests/unit/privacy.test.ts` reads every source file and the manifest and fails if the project starts
using network APIs, `eval`/`Function`, HTML injection, non-`chrome.storage.local` persistence,
history/cookie/webRequest APIs, tracking dependencies, extra permissions or host permissions. The
documented data flows are in [PRIVACY.md](PRIVACY.md).

Performance settings are real engine inputs, not decorative controls. No claim is made that every large page has identical CPU or memory behavior; see [Limitations](LIMITATIONS.md).

## Build and tests

`npm run build` creates popup/options assets and single-file IIFE bundles for the content script and service worker, writes the versioned manifest, and creates icons. The extension uses no remote code.

Vitest/jsdom covers pure colour/settings logic, engine behaviour, React interactions, accessibility
assertions, message/sanitisation security and static privacy invariants. Playwright loads `dist/`
into real Chromium and uses local fixtures for browser-level checks. jsdom tests are not substitutes
for paint, screen-reader, physical keyboard, or cross-browser verification.

CI runs two jobs pinned to immutable action SHAs: `verify` (typecheck, unit tests, build, minimal
manifest check) and `e2e` (Chromium + extension). See `.github/workflows/ci.yml`.
