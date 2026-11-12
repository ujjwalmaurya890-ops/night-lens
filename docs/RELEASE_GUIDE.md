# Release guide

NightLens is released per store from the same source. Nothing here has been performed by the
repository: this is the checklist, not a claim that a release happened.

## 1. Prepare

1. Decide the version. It lives in **one place**: `package.json`. Every manifest inherits it.
2. Update `CHANGELOG.md` (Keep a Changelog format).
3. Run the full verification:

   ```bash
   npm ci
   npm run verify          # typecheck + unit tests + all builds + build verification + Chromium E2E
   npm run package         # artifacts/*.zip + artifacts/checksums.json
   ```

4. Reload each build in its browser and walk through the manual matrix in
   [TESTING.md](TESTING.md). Do not tick a browser you did not run.
5. Confirm the privacy invariants still hold: `tests/unit/privacy.test.ts` fails if network access,
   extra storage areas, extra permissions or tracking dependencies appear.
6. Tag and push:

   ```bash
   git commit -am "release: v<version>"
   git tag v<version>
   git push origin main --tags
   ```

## 2. Chrome Web Store

| Item | Value |
|---|---|
| Package | `artifacts/nightlens-chrome-<version>.zip` |
| Manifest | MV3, `background.service_worker`, `permissions: ["storage"]`, no `host_permissions` |
| Load test | `dist/chrome` unpacked in Chrome |

Checklist:

1. <https://chrome.google.com/webstore/devconsole> → **New item** → upload the ZIP.
2. Store listing: name NightLens, short description ≤ 132 chars, detailed description, category
   (Accessibility or Productivity), language.
3. Graphics: 128×128 icon (shipped), at least one 1280×800 or 640×400 screenshot, small promo tile
   optional.
4. Privacy practices:
   - **Single purposeful use** - restyle web pages to a dark theme.
   - **Permission justification** - `storage` only; host access is required to read and rewrite page
     colours. Copy the table from [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md).
   - Data usage: check nothing is collected; NightLens makes no network requests.
   - Remote code: none.
5. Submit for review. Contact the reviewer with test instructions if asked: "Install, open any
   light site, use the toolbar popup."

Brave and other Chromium users install from the Chrome Web Store; there is no separate Brave store.

## 3. Microsoft Edge Add-ons

Package: `artifacts/nightlens-edge-<version>.zip`. Steps: see
[EDGE_INSTALL.md](EDGE_INSTALL.md#publishing-to-microsoft-edge-add-ons). Reuse the Chrome listing
copy and screenshots.

## 4. Opera Add-ons

Package: `artifacts/nightlens-opera-<version>.zip` (manifest includes `minimum_opera_version`).

1. Create a developer account at <https://addons.opera.com/developer/>.
2. Upload the ZIP, choose the Opera category, add screenshots and the privacy statement.
3. Opera reviews manually; expect a few days.

Opera GX uses the same package. Confirm the popup renders correctly in the GX sidebar before
submitting.

## 5. Firefox Add-ons (AMO)

Package: `artifacts/nightlens-firefox-<version>.zip`, and follow
[FIREFOX_INSTALL.md](FIREFOX_INSTALL.md#amo-submission-checklist). Key points:

- `browser_specific_settings.gecko.id` must never change.
- `data_collection_permissions.required = ["none"]` is mandatory for new submissions.
- Validate with `npx web-ext lint --source-dir dist/firefox` before uploading.
- Source upload: NightLens is not minified source-less (it is bundled), so the reviewer may ask for
  build instructions. Point at `docs/BUILD.md`; the build is reproducible with `npm ci && npm run
  build:firefox`.

## 6. Safari App Store

Needs macOS + Xcode + an Apple Developer account. See
[SAFARI_INSTALL.md](SAFARI_INSTALL.md#4-signing-and-distribution). There is no ZIP submission for
Safari: submit the Xcode archive.

## 7. After release

1. Verify the store listing installs on a clean profile and that settings persist after restart.
2. Check the update path: publish a patch version and confirm the store updates an installed copy
   without losing `nightlens:settings`.
3. Archive `artifacts/` with the tag so released bytes are reproducible.

## Versioning rules

- **Patch** - engine fixes, copy changes, bug fixes.
- **Minor** - new settings, themes, or a new browser target.
- **Major** - storage schema change requiring migration (bump `schemaVersion` and extend
  `migrateLegacySettings`).

## What must never ship

- a manifest with a permission beyond `storage`;
- `host_permissions` in a Chromium build;
- remotely hosted code, `eval`, or `new Function`;
- analytics or crash-reporting SDKs (the privacy test fails the build);
- a manifest whose `version` differs from `package.json` (the build refuses to write it).
