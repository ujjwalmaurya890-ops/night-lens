# Development guide

Everything needed to build, test, and change NightLens without guessing.

## Requirements

- **Node.js 22.12+** (CI uses Node 22 on `ubuntu-24.04`)
- **npm** with the committed `package-lock.json` (do not install with `yarn`/`pnpm`; the lockfile is
  the source of truth)
- **Chromium** for manual extension testing and for the Playwright suite

## First run

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Load `dist/` via `chrome://extensions` → **Developer mode** → **Load unpacked**. After a rebuild,
press the extension's reload button and reload the tab you are testing: a content script that is
already running keeps using the old code.

## Commands

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` with `strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`. |
| `npm test` | Vitest in jsdom: engine, colour, storage, UI, accessibility, security, privacy invariants. |
| `npm run build` | `scripts/build.mjs`: Vite builds the popup/options pages, then IIFE bundles for `content.js` and `background.js`, then injects the version into `dist/manifest.json` and generates icons. |
| `npm run preview:ui` | Renders the popup/options markup with mock data in a plain browser page (useful for CSS work without loading the extension). |
| `npm run test:e2e` | Builds, then runs Playwright with the real extension loaded into Chromium. |
| `npm run verify` | Typecheck + unit tests + E2E. |

There is intentionally **no lint script** yet; see the roadmap in
[docs/FINAL_ENGINEERING_REPORT.md](FINAL_ENGINEERING_REPORT.md). Code style is enforced by the
TypeScript compiler, the existing conventions, and review.

## Source layout

```text
src/
  shared/      types, defaults/limits, hostname matching, storage + sanitisation,
               decision (should the engine run?), message contracts and validators,
               custom-CSS sanitiser, purpose presets
  engine/      color (parsing/contrast), palette (tokens), mapper (colour decisions),
               detect (native-dark), styles (static CSS), engine (DOM traversal + lifecycle)
  content/     orchestration: settings subscription, decision, engine start/update/stop
  background/  service worker: command toggle, badge, install/startup, message handlers
  popup/       React toolbar UI
  options/     React settings dashboard + tabs
  ui/          shared React components, hooks, icons, CSS design tokens
```

The data flow is documented in [ARCHITECTURE.md](ARCHITECTURE.md).

## How a theming pass works

1. `content.ts` loads settings, applies per-site overrides (`getEffectiveSettings`), and asks
   `decide()` whether NightLens should run here at all.
2. `ThemeEngine.start(config)` attaches two `<style data-nl-owned>` elements (static base CSS and
   generated per-element rules) and starts a `MutationObserver`.
3. Elements are collected, then processed in batches inside one animation frame: **all reads**
   (`getComputedStyle`) happen before **all writes** (attributes + rules) to avoid layout thrash.
4. Each element gets `data-nl-*` attributes; the generated stylesheet contains one attribute
   selector per distinct colour. That is why removing the two style elements restores the page.
5. `stop()` disconnects observers, clears timers/caches, strips attributes and removes the styles.

When changing this path, keep these invariants:

- Never write to `style` or `class` attributes the site owns.
- Never process the same element twice in one frame; the queue is a `Set`.
- Reads before writes.
- `stop()` must be idempotent and must not leave a `data-nl-ready` marker behind.
- Everything the engine allocates must be bounded: rules, colour cache, gradient/shadow payloads.

## Adding a theme

1. Add the id to `THEME_IDS` (and `PREMIUM_THEME_IDS` if it is a curated palette) in
   `src/shared/types.ts`.
2. Add a `PresetSpec` to `PRESETS` in `src/engine/palette.ts` and, for curated palettes, a
   `PREMIUM_THEME_META` entry (label/description/preview) so the UI can render it.
3. Run `npm test` — `tests/unit/theme.test.ts` sweeps every theme id across brightness/contrast/
   warmth extremes and asserts contrast floors.
4. If the theme exists for a specific reading purpose, consider adding it to `PURPOSE_PRESETS`
   (`src/shared/presets.ts`) with its calibration.

## Adding a message

1. Declare the constant, payload interface, and a validator in `src/shared/messages.ts`. Validators
   must be total functions: they accept `unknown` and never throw.
2. Validate at **both** ends: the sender's payload before sending, and the receiver's message before
   acting. Check `sender.id` in the service worker and in content-script handlers.
3. Never put the full settings object (or the site-rule list) in a broadcast message.
4. Add cases to `tests/unit/security.test.ts`.

## Testing strategy

| Layer | Tool | What it can prove | What it cannot |
|---|---|---|---|
| Unit | Vitest + jsdom | Colour maths, sanitisation, decision logic, message validation, engine traversal/attribute behaviour, React UI behaviour and accessible names | Real layout, paint, or browser CSS cascade |
| Browser | Playwright + real Chromium with the extension loaded | Theming, contrast audits over rendered pages, dynamic content, SPA/iframe fixtures, popup/options behaviour | Physical keyboard shortcuts, screen readers, every live website |
| Static | Vitest reading source files | Privacy invariants, minimal permissions, UI contrast tokens, reduced-motion rules | Runtime behaviour |

Rules of thumb:

- A bug fix needs a test that fails before the fix. Do not delete a test to make CI pass; if a test
  is wrong, fix the test and explain why in the PR.
- Prefer asserting observable output (attributes, computed colours, stored settings) over internal
  counters — except for the performance claims, where counters are the evidence.
- Tests must be deterministic: no wall-clock dependent assertions, no fixed sleeps where a poll
  would do (`vi.waitFor`, `page.waitForFunction`).

### Browser tests in restricted environments

`npm run test:e2e` needs a Chromium build. If `npx playwright install chromium` cannot download one
(offline sandboxes, corporate proxies), set `NIGHTLENS_CHROMIUM` to an existing Chromium/Chrome
binary. If no browser is available at all, say so in the PR instead of claiming a pass — the CI job
runs the suite on a network-enabled runner.

## Debugging

- Set **Developer mode** in Settings → Performance to log engine counters to the page console.
- The engine annotates elements with `data-nl-dev="orig:r,g,b|mapped:r,g,b"` in developer mode;
  inspect them in DevTools.
- `chrome://extensions` → the extension's **service worker** link opens the worker console.
- To confirm restoration, snapshot `document.documentElement.outerHTML` before enabling and compare
  after disabling (the unit tests do exactly this).

## Release checklist

1. `npm run verify` (or `npm run typecheck && npm test && npm run build` plus the browser suite).
2. Update `CHANGELOG.md` with the release section and bump `package.json` version (the build injects
   it into the manifest).
3. Confirm the manifest still requests only `storage` and no host permissions; the CI job enforces
   this on the built bundle.
4. Load `dist/` and smoke-test: popup opens, theme switch, per-site exclude, toggle off restores the
   page, options page renders every tab.
5. Zip `dist/` for distribution if needed; `nightlens.zip` in the repository is a build artifact and
   is not required to reproduce a build.
