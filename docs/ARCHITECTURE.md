# Architecture

## Runtime model

```text
Popup / Options ── writes ──> chrome.storage.local ("nightlens:settings")
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
src/
  manifest.json            MV3 template; build injects package version
  shared/
    types.ts               Settings, theme IDs, site/status types
    defaults.ts            Defaults, limits, legacy migration
    hostname.ts            Normalization and nearest-host rule lookup
    storage.ts             Sanitization, queued writes, subscriptions, import/export
    decision.ts            Global/site/system/schedule decisions and effective settings
    css.ts                 Conservative custom-CSS validation
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
  options/                 React settings dashboard
  ui/                      Shared components, hooks, icons, and styles
scripts/build.mjs          Vite UI bundles + IIFE worker/content bundles
```

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

- One tree `MutationObserver` observes the document and open shadow roots for child-list/class/style changes.
- Added nodes enter a `Set`-deduplicated queue. Class changes traverse once with a 2,000-element cap; irrelevant style churn is ignored.
- Work is time-sliced with `requestAnimationFrame` (default 400 elements/frame, configurable 100–1,000). Each batch performs strip → reads → writes.
- Parsed colors use a bounded cache (approximately 2,000 entries), which can be disabled.
- Generated rules are deduplicated per document/shadow context, with a 5,000-rule reset safeguard.
- Root theme attribute changes are debounced (default 150ms) to re-run native-dark detection and reprocess.
- `pushState`, `replaceState`, `popstate`, and `hashchange` trigger debounced SPA reprocessing. History methods and listeners are restored on stop.
- Stylesheet/window load triggers rescanning. Removed shadow-host contexts are pruned.
- Queued animation frames, timers, observers, and listeners are cancelled/disconnected during teardown.

Performance settings are real engine inputs, not decorative controls. No claim is made that every large page has identical CPU or memory behavior; see [Limitations](LIMITATIONS.md).

## Build and tests

`npm run build` creates popup/options assets and single-file IIFE bundles for the content script and service worker, writes the versioned manifest, and creates icons. The extension uses no remote code.

Vitest/jsdom covers pure color/settings logic, engine behavior, and React interactions. Playwright loads `dist/` into real Chromium and uses local fixtures for browser-level checks. jsdom tests are not substitutes for paint, screen-reader, physical keyboard, or cross-browser verification.
