# Architecture

## Components

```
            chrome.storage.local  ("nightlens:settings")
                 ▲        │ onChanged
   writes        │        ▼
 ┌──────────┐    │   ┌──────────────────────────────┐   status push / get-status
 │ Popup /  │────┘   │ Content script (every frame) │──────────────────────────────► Popup
 │ Options  │        │  decide() → ThemeEngine      │◄──── tabs.sendMessage(frameId:0)
 └──────────┘        └──────────────────────────────┘
 ┌──────────────────────┐
 │ Service worker       │  Alt+Shift+D toggles enabled; badge OFF; schedule alarm (alarms)
 └──────────────────────┘
```

- **Storage is the bus.** Popup, options, worker only *write* settings. Every content script listens to `chrome.storage.onChanged` and re-applies. No push sync issues.
- **Messages:** popup → top frame `get-status`; top frame → popup `status-changed` + `debug-info`. Validated (`src/shared/messages.ts`), sender.id checked; popup validates tab.id & frameId===0.
- **Popup needs no `tabs` permission** — it asks the content script for hostname.

## Source Layout

```
src/
  manifest.json            MV3 template (version from package.json)
  shared/
    types.ts               ThemeId (15 incl. 10 premium + custom/system), Settings v2, CustomTheme, Schedule, Accessibility, ReadingMode
    defaults.ts            LIMITS, cloneDefaults(), migrateLegacySettings() (v1→v2)
    hostname.ts            normalizeHostname (exact, no subdomain inheritance), hostnameFromUserInput, getSiteMode
    storage.ts             sanitizeSettings (strict), load/update/reset/subscribe, export/import, theme import
    css.ts                 sanitizeCustomCss — shared custom-CSS hardening (no remote url()/@import/@font-face/javascript:), used on write and at injection
    messages.ts            GET_STATUS / STATUS_CHANGED validation
    decision.ts            decide() (enabled, siteRules, system, schedule), getEffectiveTheme/Settings, isWithinSchedule
  engine/
    color.ts               parse (rgb/hex/hsl/oklab/oklch/lab/lch/color()), WCAG luminance/contrast, ensureContrast, toHex/colorKey
    palette.ts             PRESETS (15 themes: 3 legacy + 10 premium + system/custom), PREMIUM_THEME_META, buildTokens (brightness/contrast/warmth/saturation/accentHue, custom theme support), themePreviewColors
    mapper.ts              mapBackground/Foreground/Link/Border, isColoredLink, mapShadow, isLightColor
    styles.ts              buildBaseCss (variables, selection, placeholder, focus, early-paint guard, readingMode, accessibility, customCSS)
    detect.ts              detectNativeDark (luminance <0.2 or color-scheme)
    engine.ts              ThemeEngine: traversal, batching, observers, attribute+rule generation, restore, SPA nav, performance stats, developerMode
  content/
    content.ts             getSiteHostname (top frame aware), startContentScript: load settings → decide → tokens → engine.start/update, schedule interval, visibilitychange
    index.ts               bootstrap
  background/
    handlers.ts            updateBadge, handleCommand (toggle), handleInstalled/Startup, handleAlarm (schedule), handleMessage
    index.ts               registers listeners synchronously (MV3 requirement)
  popup/  options/  ui/    React 19 UI, shared hooks/components, premium design tokens (ui.css)
    ui/ ui.css             Premium tokens (Linear/Raycast/Arc inspired), components (Switch, Slider, ThemeCard, ThemeGrid, PresetChips)
    ui/ hooks.ts           useSettings (with auto-clear notice), usePageStatus, useSiteStats
    ui/ components.tsx     Logo, ThemeSelect/Slider/HueSlider, ThemeCard/Grid, AppearanceControls, StatusLine, PresetChips
scripts/                   build.mjs (Vite JS API, IIFE for content/background), make-icons.mjs
tests/unit/                Vitest jsdom: color, theme, shared, engine, background, ui-contrast, popup
tests/e2e/                 Playwright + local fixtures (news/docs/edu/shop/search/spa/webapp/modern/codehost/dark)
```

## How Theming Works

1. **Read** computed `backgroundColor`, `color`, per-side border colors, `backgroundImage`, disabled, link, control, code/table/modal flags, dimensions.
2. **Map** via `mapper.ts` through `ThemeTokens` (derived from preset + sliders + per-site overrides + custom themes), then `ensureContrast` against effective background (nearest mapped ancestor, alpha-blended).
3. **Write** only `data-nl-*` attributes (color keys) + generated rules `[data-nl-bg="..."]{background-color:#... !important}`.

- **Exact restoration:** Removing attributes + `<style data-nl-owned>` restores `outerHTML` identically (unit-tested).
- **Cross-origin stylesheets:** Computed-style based, no `styleSheets` parsing.
- **CSP:** Extension styles not subject to page CSP (e2e verified `style-src 'self'`).
- **No feedback loop:** Only writes `data-nl-*`, which observer ignores (quiescence test).

### Passes & Batching

`strip → read → write` per batch ≤400 (tunable, 100–1000), RAF-scheduled; reads share one recalc, then writes. Queue is `Set` (dedup), `WeakSet` for processed. Performance stats logged when `developerMode` on.

### Dynamic Content

One `MutationObserver` (childList + class/style, subtree) per root (document + open shadow roots):

- Added nodes → subtree enqueue (SPA, infinite scroll).
- class change → re-read element + subtree if ≤2000 descendants.
- style change → only if mentions color/background/border/fill/stroke/shadow.
- html/body class/data-theme/style → debounce native-dark re-eval + rescan.
- `<link> load` + `window.load` → rescan (late CSS).
- **SPA navigation:** `history.pushState/replaceState` patched + `popstate`/`hashchange` → debounce rescan / re-eval.

### Special Content

| Content | Handling |
|---|---|
| img/picture/video/audio/iframe/object/embed | Never touched/walked. Dim theme `brightness(0.88)` on img/video/picture only. |
| background-image/gradient or unparsable color | Locked: author colors kept, descendants’ text also left alone. |
| canvas ≥100×60 on light backdrop; svg charts ≥100×60 with <text> | Plate on original backdrop, pixels untouched. |
| Small SVG icons ≤64px | Shape fill/stroke recoloured ≥3:1 contrast. Large illustrations untouched. |
| Open shadow roots | Own style pair + observer. Closed not reachable. |
| code/pre/kbd/samp | Preserved hue but ensured contrast (syntax highlighting). |
| table/th/td | Ensured header distinct, border handling. |
| input/select/textarea/button (control) | Per-control border contrast, cursor visibility, `color-scheme: dark`. |
| modal/dialog/notification (role=dialog/alertdialog or .modal) | Tracked as modal for future emphasis (currently standard mapping). |
| Native select/scrollbars | `color-scheme: dark` on :root. |
| Native dark sites | Detached-style luminance or `color-scheme: dark` → left alone; force-on overrides. |
| text-size | `html{font-size: X% !important}` in base CSS when textSize ≠100. |
| reading mode | Body max-width, line-height, font-family, hide nav/aside/.ad. |
| custom CSS | Validated (no javascript:/expression/@import), appended to base. |
| developer mode | `data-nl-dev="orig:...|mapped:..."` + stats to console/onStats. |

### Compatibility Profiles

- **auto** (default): Standard mapping.
- **gentle:** Never force on native-dark.
- **aggressive:** 1.5× batch size, more eager.
- **mediaOnly:** Only dim media, skip text recoloring.

### Performance Optimizations

- Color parse cache (Map, clear after 2000 entries, hit counter) — toggleable via `performance.enableCache`.
- Batch size and mutation debounce come from `settings.performance` (`maxElementsPerFrame`, `debounceMs`) and are passed into `EngineConfig` (`batchSize`, `debounceMs`) by the content script — the Performance settings page controls the real engine, not a dead UI.
- One recalc per batch, RAF + dedup.
- Filtered style attribute changes (regex).
- History patching avoids polling.
- Alarms for schedule (1 min), not aggressive polling.
- Max 5000 rules then clear (prevent bloat).
