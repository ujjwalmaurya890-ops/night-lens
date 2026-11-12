# Microsoft Edge installation

Edge runs on Chromium and uses the same Manifest V3 shape as Chrome: service-worker background,
`chrome.*` namespace, host access implied by `content_scripts.matches`. The Edge build exists
because store metadata and the minimum-version gate are per product, not because the JavaScript
differs - `dist/chrome` and `dist/edge` contain identical bundles.

## Build and load (development)

```bash
npm install
npm run build:edge
```

1. Open `edge://extensions`.
2. Turn on **Developer mode** (left sidebar).
3. Click **Load unpacked** and select `dist/edge`.
4. Pin NightLens from the extensions toolbar.
5. Open a light website and confirm the popup shows **Active**.

After a rebuild: **Reload** on the NightLens card, then reload open tabs.

## Verify the Edge build

```bash
npm run verify:build -- --target edge
```

Checks the manifest (`background.service_worker`, `permissions: ["storage"]`, no
`host_permissions`), every referenced file, and that no bundle contains `eval`, remote HTML
references or source maps.

## Publishing to Microsoft Edge Add-ons

1. `npm run package:edge` → `artifacts/nightlens-edge-<version>.zip`.
2. Sign in to <https://partner.microsoft.com/dashboard/microsoftedge>.
3. Create a new extension, upload the ZIP (manifest at the archive root, as produced).
4. Fill the listing:
   - **Permissions justification** - see [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md). The
     only API permission is `storage`; page access is required to restyle pages.
   - **Privacy policy** - NightLens collects nothing; a short statement is enough.
   - **Screenshots** - popup, settings, one themed page.
5. Submit for certification. Edge reviews are usually days, not hours.

Keep the same package version across stores; Edge users get updates from the store, not from a
local build.

## Notes

- Edge accepts `minimum_chrome_version` (present in `manifests/edge.json`, set to 102).
- Edge's shortcut page is `edge://extensions/shortcuts`; the popup links there automatically
  because `src/ui/copy.ts` maps the detected product to its own URL.
- Edge's "Site access" UI ("On click" / "On specific sites") can restrict access. If a user restricts
  it, pages stay light until access is allowed - this is browser behaviour, not a NightLens bug.
