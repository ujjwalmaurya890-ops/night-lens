# Browser compatibility

NightLens ships one shared dark-mode engine and six browser builds. This document separates what
has been **verified by an automated check**, what has been **prepared but not run on a real
browser**, and what is **not supported**.

## Status matrix

| Browser | Build | Automated verification | Installation tested |
|---|---|---|---|
| Google Chrome | `dist/chrome` | ✅ build + manifest + bundle verification, Chromium E2E suite (CI) | ❌ not on a desktop in the producing environment |
| Microsoft Edge | `dist/edge` | ✅ build + manifest + bundle verification | ❌ not installed/tested here (Chromium engine, same bundle as Chrome) |
| Brave | `dist/brave` | ✅ build + manifest + bundle verification | ❌ not installed/tested here (Chromium engine) |
| Opera | `dist/opera` | ✅ build + manifest + bundle verification | ❌ not installed/tested here (Chromium engine) |
| Opera GX | `dist/opera` | ✅ same build as Opera | ❌ not installed/tested here |
| Vivaldi | `dist/chrome` | ✅ same Chromium build | ❌ not installed/tested here |
| Mozilla Firefox (incl. Developer Edition, Nightly) | `dist/firefox` | ✅ build + manifest + bundle verification, adapter unit tests | ❌ not installed/tested here (no Firefox binary in the build environment) |
| Apple Safari | `dist/safari/browser-extension` | ✅ build + manifest + bundle verification | ❌ requires macOS + Xcode; not possible here |

The Chromium end-to-end suite is real browser automation, but it is executed by CI
(`.github/workflows/ci.yml`), not in this build environment: Playwright's browser download is not
reachable from the sandbox. Nothing in this repository claims a browser passed a test that was not
run - see [TESTING.md](TESTING.md).

## Supported engine versions

| Engine | Minimum | Why |
|---|---|---|
| Chromium (Chrome, Edge, Brave, Opera, Vivaldi) | 102 | First Chromium with the MV3 service worker, `action` and promise-based `chrome.*` APIs NightLens relies on. Older builds still work through the callback fallback in the adapter. |
| Firefox desktop | 140 | MV3 event pages, `data_collection_permissions` (required by AMO since Nov 2025) and host permissions granted at install. |
| Safari desktop | 16.4 | MV3 with `action`, `content_scripts` and event-page background. |

Firefox on Android is not claimed: the popup layout is responsive, but no Android testing has been
performed. Safari on iOS/iPadOS is likewise not claimed.

## What differs per engine, and how it is handled

| Concern | Chromium | Firefox | Safari | NightLens response |
|---|---|---|---|---|
| Background context | `background.service_worker` | `background.scripts` event page (MV3 has no service worker) | `background.scripts` event page (`service_worker` only from 16.4 with different lifecycle) | Same `background.js` bundle, written to the service-worker lowest common denominator: top-level listener registration, no DOM, no long-lived state. Manifest is generated per target. |
| API namespace | `chrome.*` (promises since 88, callbacks before) | `browser.*` (promises only, strict arity) | Both; `browser.*` preferred | `src/adapters/browser/*` picks the namespace and a call style (`hybrid` vs `promise`). Application code never branches on it. |
| Host access | Implied by `content_scripts.matches`; `host_permissions` stays empty | Explicit `host_permissions`; revocable per site in `about:addons` | Explicit `host_permissions`; per-site control in Safari Settings | Firefox build declares `http`/`https` hosts and the popup shows a **Grant access** notice when the grant is missing. Chromium declares none, preserving the minimal-permission story. |
| Toolbar badge | `action` | `action` | `action` | Cosmetic writes go through a never-throwing adapter call; a missing badge cannot break a settings change. |
| Keyboard shortcut | `commands` + `commands.getAll` | `commands` | `commands` only from 16.4 | The popup switch is the primary control; shortcut rebinding instructions are per browser (`src/ui/copy.ts`). |
| Options page | `options_ui` with `open_in_tab` | `options_ui` | `options_ui` (always opens in a tab) | Same page, opened through `runtime.openOptionsPage` with a fallback if unavailable. |
| `runtime.onStartup` | yes | yes | **no** | Adapter returns a no-op unsubscribe; the badge is repainted on install and on every settings change. |
| Extension store URL in copy | `chrome://extensions/shortcuts` | `about:addons` | Safari Settings | `src/ui/copy.ts` is the single source of browser-specific wording. |
| Site identity in iframes | `location.ancestorOrigins` available | not implemented by Gecko | available | Content script falls back to the frame's own hostname when `ancestorOrigins` is absent, so inside a Firefox iframe the frame's own host decides. Documented limitation, not a silently removed feature. |

## Firefox specifics

Firefox MV3 gives users control over host permissions. Consequences you can observe:

1. On a fresh install with Firefox ≥ 127 the hosts are granted at install time. On older versions,
   on temporary add-ons, or after a user revokes access in `about:addons`, **the content script does
   not run at all** on those sites.
2. NightLens detects that state (`permissions.contains`) and the popup offers a **Grant access**
   button. The request must come from a click, so it cannot be triggered on install.
3. Granting access does not retroactively inject the content script into already-open tabs; reload
   the tab (the popup says so).
4. `background.scripts` runs as an event page with DOM access. NightLens does not use the DOM there,
   so the same bundle is safe in both contexts.
5. AMO requires the add-on id and the data-collection declaration; both live in
   `manifests/firefox.json` and are asserted by `tests/unit/manifest.test.ts`.

## Safari specifics

Safari cannot load an unpacked directory. The build produces the *web extension* that Apple's
converter consumes:

```bash
npm run build:safari
# on macOS with Xcode:
npm run safari:project
```

`dist/safari/documentation/` explains the converter step, signing and App Store submission. The
Safari build itself differs only in the manifest (event page background, explicit host permissions,
no Gecko keys). Features that Safari does not offer:

- shortcut rebinding (`commands` exists, but Safari does not expose a rebinding UI);
- `runtime.onStartup`;
- programmatic host-permission requests (`permissions.request` is absent; access is granted in
  Safari Settings → Extensions);
- iOS/iPadOS support (responsive layout exists, testing does not).

## Browsers that are not supported

| Browser | Reason |
|---|---|
| Internet Explorer / legacy EdgeHTML | No WebExtensions, no MV3, no isolated worlds. Not possible. |
| Safari < 16.4 | MV3 support is incomplete; the extension would have to be downgraded to MV2, which would mean maintaining a second engine. |
| Firefox < 121 | MV3 event pages and `background.scripts` are unreliable there. |
| Chromium < 102 | MV3 service workers and `action` are missing or unstable. |
| Firefox for Android, Safari iOS | Not tested; not claimed. |
| Arc / SigmaOS and other Chromium forks | Should work (Chromium engine, `chrome.*` namespace) but has not been tested; report issues. |

## How compatibility is checked automatically

| Check | Where |
|---|---|
| Adapter call style, error mapping, fallbacks, Firefox grants, caching | `tests/unit/adapters.test.ts` |
| Manifest validity per engine + privacy invariants | `tests/unit/manifest.test.ts`, `scripts/build/manifest.mjs` |
| "No `chrome.*` outside adapters", no UA sniffing in the engine | `tests/unit/architecture.test.ts` |
| Built output: referenced files present, no remote resources, no `eval`, no source maps | `scripts/verify-build.mjs` (`npm run verify:build`) |
| Chromium end-to-end behaviour with the extension loaded | `tests/e2e/extension.spec.ts` (CI) |
