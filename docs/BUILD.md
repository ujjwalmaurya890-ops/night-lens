# Build system

## One engine, six manifests

All targets share a single TypeScript codebase and a single JavaScript build. Only the manifest and
the output directory differ, which is what guarantees that a Firefox user and a Chrome user get the
same dark-mode engine.

```text
manifests/
  base.mv3.json          shared keys (name, icons, action, options, permissions, content scripts, commands)
  chrome.json            background.service_worker + minimum_chrome_version
  edge.json              same shape as Chrome
  brave.json             same shape as Chrome
  opera.json             + minimum_opera_version
  firefox.json           background.scripts + host_permissions + gecko id / min version / data collection
  safari.json            background.scripts + host_permissions, no Gecko keys

scripts/
  build.mjs              Vite bundles once, then emits each target with its manifest
  build/manifest.mjs     deep merge + structural validation + referenced-file validation
  build/targets.mjs      target table (family, output directory, manifest file)
  build/safari-docs.mjs  documentation shipped inside the Safari output
  build/zip.mjs          dependency-free deterministic ZIP writer
  verify-build.mjs       verifies built bundles (not just the manifest)
  package.mjs            writes store archives into artifacts/
  safari-project.mjs     runs Apple's converter on macOS
```

Manifest merge rules: objects merge deeply, arrays replace, and a `null` value deletes a key. The
package version from `package.json` is injected last, so a manifest can never drift from the build.

## Commands

| Command | Output |
|---|---|
| `npm run build` | all six targets |
| `npm run build:chrome` | `dist/chrome/` |
| `npm run build:edge` | `dist/edge/` |
| `npm run build:brave` | `dist/brave/` |
| `npm run build:opera` | `dist/opera/` |
| `npm run build:firefox` | `dist/firefox/` |
| `npm run build:safari` | `dist/safari/browser-extension/` + `dist/safari/documentation/` |
| `npm run build:chromium` | all four Chromium targets |
| `npm run verify:build` | validates every built target (or `--target <id>`) |
| `npm run package` | `artifacts/nightlens-<target>-<version>.zip` + `artifacts/checksums.json` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit/integration suite |
| `npm run test:e2e` | builds Chrome, then Playwright Chromium E2E |
| `npm run verify` | typecheck → unit tests → all builds → build verification → E2E |
| `npm run safari:project` | macOS only: `safari-web-extension-converter` |

Each build starts by deleting `dist/`, so a target can never contain leftover files from another
target. `dist/build-report.json` records what was produced (version, file count, manifest hash).

## What the build validates before writing a manifest

`scripts/build/manifest.mjs` rejects a manifest that would break a store upload or a NightLens
invariant:

- `manifest_version` is 3, name ≤ 75 chars, description ≤ 132 chars, numeric version;
- `permissions` is exactly `["storage"]`;
- Chromium has **no** `host_permissions`; Firefox and Safari declare `http`/`https` only (never
  `<all_urls>`, `file:`, `ftp:`);
- Chromium has `background.service_worker` and no `scripts`; Firefox/Safari have
  `background.scripts` and no `service_worker`;
- Firefox has `browser_specific_settings.gecko` with an id, `strict_min_version` ≥ 140 and
  `data_collection_permissions.required = ["none"]`; no other target has Gecko keys;
- one content script entry, `http`/`https` only, `content.js`, `document_start`, all frames;
- `action.default_popup`, `options_ui.page`, icons 16/48/128, and the `toggle-nightlens` command;
- no `web_accessible_resources`, `externally_connectable`, `optional_permissions`,
  `optional_host_permissions`, `chrome_url_overrides`, `sandbox`, `devtools_page` or `key`.

Every path the manifest references must exist in the output directory.

## What verification checks in the built bundle

`npm run verify:build` additionally checks, per target:

- the manifest is valid JSON and its version equals `package.json`;
- `popup/index.html` and `options/index.html` only reference files inside the bundle (no remote
  URLs) and those files exist;
- no JavaScript file contains `eval(`, `new Function(`, `XMLHttpRequest`, `importScripts(`, or a
  source-map reference;
- no `.map` files leak into the bundle;
- the manifest passes the same validator the build uses (so a hand-edited `dist/` is caught).

## Adding a browser target

1. Add an entry to `scripts/build/targets.mjs` (id, family, output directory, manifest file).
2. Add `manifests/<id>.json` with the engine-specific keys.
3. If the engine has a new quirk, add a builder in `src/adapters/browser/` and select it in
   `createAdapterFor()`; do not add `if (browser === ...)` branches to application code.
4. Add the id to `DEFAULT_TARGETS`, a small test manifest case, and a `build:<id>` npm script.
5. Document how it was verified in `docs/BROWSER_COMPATIBILITY.md` - and say "not tested" if it was
   not tested on a real browser.

## Requirements

- Node.js ≥ 22.12 (Vite 8).
- No global tooling. The ZIP writer and icon generator are dependency-free, so `npm run package`
  works on Windows without `zip.exe`.
