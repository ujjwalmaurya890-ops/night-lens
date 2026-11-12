# Firefox installation

NightLens for Firefox is a **Manifest V3** add-on. Firefox implements MV3 differently from
Chromium, and `manifests/firefox.json` reflects that:

```jsonc
"background": { "scripts": ["background.js"] },   // event page, NOT a service worker
"host_permissions": ["http://*/*", "https://*/*"], // explicit, revocable grant
"browser_specific_settings": {
  "gecko": {
    "id": "nightlens@nightlens.app",
    "strict_min_version": "140.0",
    "data_collection_permissions": { "required": ["none"] } // required by AMO since Nov 2025
  }
}
```

## Requirements

- Firefox 140 or newer (Developer Edition and Nightly are fine and newer).
- Node.js 22.12+ to build.

## Build

```bash
npm install
npm run build:firefox
```

Output: `dist/firefox/` with `manifest.json` at its root.

## Temporary install (developer, no signing)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `dist/firefox/manifest.json` (Windows: `dist\firefox\manifest.json`).
4. Open a light website. NightLens appears in the toolbar (pin it from the puzzle-piece menu).

Temporary add-ons are removed when Firefox closes. Reload after every rebuild.

## Check site access - the Firefox-specific step

Firefox MV3 treats host permissions as a **user-controlled grant**:

- Firefox 127+ grants the declared hosts during installation.
- Temporary add-ons loaded from `about:debugging` have their own grant state.
- A user can revoke access per site at any time in `about:addons` → NightLens → **Permissions**.

If the grant is missing, the content script never runs and pages stay light. NightLens detects this
and the popup shows:

> **Firefox has not granted NightLens access to websites, so pages are not being darkened.**
> [Grant access]

Granting requires a click (Firefox forbids programmatic permission prompts), and already-open tabs
must be reloaded afterwards. You can also enable **Access your data for all websites** in
`about:addons` → NightLens → Permissions.

## Permanent install (signed XPI)

Firefox only installs *signed* add-ons outside of `about:debugging`. For local use or beta testers:

```bash
npm install --no-save web-ext
npm run package:firefox
npx web-ext sign \
  --source-dir dist/firefox \
  --api-key "$AMO_JWT_ISSUER" --api-secret "$AMO_JWT_SECRET" \
  --channel unlisted
```

- `--channel unlisted` produces a self-distributed signed XPI (not listed publicly).
- `--channel listed` submits for AMO review; the add-on becomes publicly installable.
- Unlisted XPI signatures expire (currently up to 1 year), so plan a re-sign before expiry.

Install the resulting `.xpi` via `about:addons` → gear → **Install Add-on From File…**, or serve it
with the correct MIME type for automatic installation.

## AMO submission checklist

1. `npm run build:firefox && npm run verify:build -- --target firefox`.
2. `npm run package:firefox` → `artifacts/nightlens-firefox-<version>.zip`.
3. Validate: `npx web-ext lint --source-dir dist/firefox` (should report 0 errors).
4. Upload the ZIP at <https://addons.mozilla.org/developers/>.
5. Fill in the privacy questionnaire consistently with
   [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md): no data collection, no remote code.
6. Provide screenshots (popup, settings, a themed page) and a source-code note if the reviewer asks.
7. Keep `browser_specific_settings.gecko.id` stable forever: it is the add-on's update identity.

## Known limitations on Firefox

- No `background.service_worker` support in MV3; NightLens uses an event page instead. Nothing in
  the extension depends on the difference.
- Safari-style per-site access prompts do not exist; access is all-or-nothing per site in
  `about:addons`.
- `location.ancestorOrigins` is not implemented by Gecko, so inside cross-origin iframes the frame's
  own hostname (not the top-level page) decides whether NightLens applies. Use a per-site rule on
  the embedded host if you need it excluded.
- Firefox for Android is not claimed: the popup is responsive, but no Android testing was performed.
