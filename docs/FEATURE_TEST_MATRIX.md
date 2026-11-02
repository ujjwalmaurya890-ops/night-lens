# Feature ↔ Implementation ↔ Test Matrix

| Feature | Implementation | Unit | Integration (jsdom) | E2E (Chromium) | Notes |
|---|---|---|---|---|---|
| **Color parsing** (hex/rgb/hsl/oklab/oklch/lab/lch/color(display-p3,srgb-linear)) | `engine/color.ts` `parseColor` | ✓ 35 tests incl. modern spaces, oklch reference values, alpha/none | — | Modern page fixture themed | |
| **WCAG contrast** (luminance, ratio, ensureContrast) | `engine/color.ts` | ✓ 6 tests incl. known #767676 | — | Audit per fixture (4.5/7 thresholds) | |
| **Palette tokens** (10 premium + 3 legacy + system/custom) × slider extremes | `engine/palette.ts` `buildTokens` | ✓ 416 combos (theme × brightness×contrast×warmth) + sepia warmer + media dim + charcoal-luminance check | — | Slider extremes still AA | |
| **Mapper** (bg/fg/link/border, preserve hue/alpha) | `engine/mapper.ts` | ✓ 7 tests (white→bg, light/dark handling, link, borders) | — | Light/dark backgrounds dark after mapping | |
| **Base CSS** (variables, selection, placeholder, focus, early-paint, readingMode, a11y, customCSS) | `engine/styles.ts` | ✓ via palette + snapshot | — | CSP `style-src 'self'` passes | |
| **Native-dark detection** (luminance <0.2 or color-scheme) | `engine/detect.ts` | Indirect via engine.test (4) | — | Dark fixture left alone; force-on works | |
| **Engine core** (traversal, batching, queue dedup, restore) | `engine/engine.ts` | ✓ 26 tests incl. large batch 7500 nodes, quiescence (no loop), style-load rescan | — | Enabled→restores exact outerHTML; snapshot vs disabled | |
| **Dynamic content** (MutationObserver childList/class/style, shadow roots, SPA nav, resource load) | `engine/engine.ts` | ✓ Dynamic content 5, theme switch | — | SPA navigation, lazy-load/infinite scroll (fixture) | |
| **Special content** (img/video not touched, canvas plate, SVG icons, shadow DOM) | `engine/engine.ts` | ✓ SVG chart/icon tests | — | Images/video filter none (balanced), canvas plate white, SVG recolor | |
| **Hostname rules** (exact, no subdomain, normalize, __proto__ safe, limit 2000) | `shared/hostname.ts` | ✓ 40 tests | — | Per-site exclude still themes other origins | |
| **Sanitization** (type/range, MAX_SITE_RULES, customThemes 50, customCSS 20k, schedule, a11y, reading, performance) | `shared/storage.ts` | ✓ 40 shared tests + sanitizeSettings | — | Persist across reloads | |
| **Decision** (enabled, siteMode off/on, system, schedule, forceNative) | `shared/decision.ts` | ✓ 6 decide tests (global off, exclude, force, system) + isWithinSchedule | — | System follow + schedule off verified | |
| **Messages** (validation, sender.id check) | `shared/messages.ts` | ✓ 1 test + chromeMock | — | Popup ignores other tabs/frames | |
| **Storage** (load/update/reset/subscribe, failure surfacing) | `shared/storage.ts` | ✓ 4 tests | — | Persist, reset, failure honest | |
| **Background** (badge, command toggle Alt+Shift+D, installed/startup, alarms) | `background/handlers.ts` | ✓ 4 tests + command registration e2e | — | Badge OFF when disabled; alarm created | |
| **Popup UI** (branding, site status, toggle, theme selector, sliders, reset, settings link, accessible) | `popup/App.tsx` + `ui/components` | ✓ 12 popup tests (branding, toggles, theme/sliders, unsupported, reset, storage failure, settings open, a11y, disable site switch) | ✓ | Status push from content | |
| **Options Dashboard** (overview, appearance, themes, sites, a11y, automation, performance, privacy, about) | `options/Options.tsx` | ✓ 4 options tests (add/list/remove, reject invalid, warmth slider+privacy text, exact-hostname doc) | ✓ | — | |
| **Themes** (10 premium, create/edit/delete/export/import, per-site themes, custom themes) | `palette.ts` + `storage.ts` + `Options` | ✓ via palette + theme.test | ✓ | Theme switching live, highContrast/dim contrast floors | |
| **Brightness/Contrast/Warmth/Saturation/TextSize/AccentHue** sliders | `ui/components` + `palette` | ✓ via palette extremes | ✓ Popup sliders write settings | Slider extremes still AA (e2e) | |
| **Preset chips** (Default/Soft/Vivid/Warm Night/Cool/Dim) | `ui/components` | — | — | Click applies | |
| **Site management** (add/remove, search, forced, compatibility profiles, custom CSS, overrides) | `Options` + `decision` + `content` | ✓ hostname + sanitize | ✓ | Add/remove live, CSS injected | |
| **Custom CSS** (validation, per-domain, length limit) | `storage` `sanitizeCustomCSS` + `styles` + `engine` | — | — | Save/remove, injection verified | |
| **Reading mode** (fontSize/lineHeight/maxWidth/family, hide nav/ads) | `styles` + `engine` + `Options` | — | — | Toggle on/off, CSS applied | |
| **Automation** (schedule 22:00–07:00, followSystem) | `defaults` + `storage` + `decision` + `content` + `background` | ✓ schedule sanitize + isWithinSchedule | — | Schedule off status, system follow | |
| **Accessibility** (highContrast 7:1, underlineLinks, reducedMotion, colorBlindMode) | `palette` + `styles` + `engine` | ✓ highContrast stricter, theme.test | — | HighContrast floor 7:1, focus rings | |
| **Performance** (cache, batch size 100–1000, debounce 50–500, stats) | `engine` + `defaults` | ✓ throughput | — | Large page ~0.6–0.8s (container) | |
| **Privacy** (local storage only, no network, sanitization) | `storage` + `manifest` | ✓ prototype pollution test | — | No fetch observed (code grep) | |
| **Developer mode** (data-nl-dev, console stats) | `engine` | — | — | Toggle, attribute present | |
| **Import/Export** (settings JSON, theme JSON, validation) | `storage` `exportSettings/validateImport` | — | — | Export download, import round-trip | |
| **Reset** (confirmed, restores defaults + clears rules) | `storage` + `ui` | ✓ popup reset test | — | — | |
| **UI contrast** (own UI WCAG AA, focus visible, reduced motion) | `ui/ui.css` | ✓ 22 tests (text/bg, control-border, focus, reduced-motion, outline) | — | — | |

**Coverage:** 573 unit tests pass; E2E suite covers core flows on 12 fixture pages.
