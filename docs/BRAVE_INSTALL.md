# Brave installation

Brave is Chromium-based and uses the Chrome-style Manifest V3 build. `dist/brave` is produced from
the same shared bundles; only the manifest identity differs.

## Build and load (development)

```bash
npm install
npm run build:brave
```

1. Open `brave://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select `dist/brave`.
4. Pin NightLens from the extensions menu.
5. Open a light website and confirm the popup reports **Active**.

After a rebuild: **Reload** on the NightLens card and reload open tabs.

## Verify the Brave build

```bash
npm run verify:build -- --target brave
```

## Brave-specific behaviour

- **Shields** do not block extension content scripts, but aggressive fingerprinting protection can
  remove some page APIs. NightLens only reads computed styles, so it keeps working.
- **Brave's own dark mode** ("Force dark mode" in `brave://settings/appearance`) also recolours
  pages. Running both can produce muddy results; use one. NightLens detects already-dark pages and
  leaves them alone unless you force it on.
- The shortcut page is `brave://extensions/shortcuts`; the popup links to it automatically.
- Brave exposes `navigator.brave`, which NightLens' adapter uses only to name the browser in the
  settings page - no behaviour depends on it.

## Distribution

Brave does not run its own store: it uses the Chrome Web Store. Publish the **Chrome** package and
Brave users install it from there. The separate `dist/brave` build is for local testing and for
sideloading `dist/brave` unpacked.

```bash
npm run package:brave   # artifacts/nightlens-brave-<version>.zip for manual distribution
```

Brave installations from the Chrome Web Store are updated by the store; unpacked builds are not.
