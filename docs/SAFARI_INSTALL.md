# Safari installation

Safari is the only target that cannot be installed from a directory. Apple requires every Safari
web extension to be packaged inside a **signed macOS (or iOS) app**, so NightLens produces the web
extension and Apple's converter wraps it in an Xcode project.

> **Not tested in this repository's build environment.** Producing and signing a Safari extension
> requires macOS with Xcode, which was not available. Everything below is the documented Apple
> workflow; the Safari build itself is statically verified (manifest, files, bundles) by
> `npm run verify:build`.

## Requirements

| Requirement | Notes |
|---|---|
| macOS 13 or newer | The converter ships with Xcode and does not run on Windows or Linux. |
| Xcode 15+ | Install from the App Store, then run `sudo xcodebuild -license accept`. |
| Command line tools | `xcode-select --install` |
| Safari 16.4+ | MV3 support with a stable background context. |
| Node.js 22.12+ | To build the web extension source. |
| Apple Developer Program membership | Only needed for distribution/signing to other machines. Development in your own Safari works with a free account. |

## 1. Build the web extension

```bash
npm install
npm run build:safari
```

Output:

```text
dist/safari/
  browser-extension/     # the MV3 web extension (manifest.json at the root)
  documentation/         # README.md, INSTALL.md, RESOURCES.md
```

`browser-extension/` is **not** installable on its own.

## 2. Convert into an Xcode project

On the Mac, from the repository root:

```bash
npm run safari:project
```

which runs:

```bash
xcrun safari-web-extension-converter dist/safari/browser-extension \
  --project-location dist/safari \
  --app-name "NightLens" \
  --bundle-identifier app.nightlens.safari \
  --macos-only --no-open --no-prompt
```

Use your own reverse-DNS bundle identifier (`app.nightlens.safari` is a placeholder). If you want an
iOS/iPadOS target as well, drop `--macos-only` - NightLens does not claim iOS support, so review the
popup layout and content-script behaviour on iOS before shipping it.

## 3. Run it in Safari

1. `open dist/safari/NightLens/NightLens.xcodeproj`
2. Select the **NightLens (macOS)** scheme and press ⌘R. The host app launches.
3. In Safari: **Settings → Advanced → Show features for web developers**.
4. **Settings → Extensions → NightLens → Allow** (and allow it on websites).
5. Open a light page and check the toolbar button.

## 4. Signing and distribution

| Path | What you need | Where users get it |
|---|---|---|
| Development | Free Apple ID, Xcode's automatic signing | Only on your Mac |
| Direct download | Developer ID Application certificate, hardened runtime, notarisation | A notarised `.app`/`.dmg` you host |
| Mac App Store | Distribution certificate + provisioning profile, App Store Connect app record | App Store |

Before submitting:

```bash
npm run verify:build -- --target safari
```

Signing checklist:

1. Xcode → target → **Signing & Capabilities** → team, bundle identifier.
2. For direct distribution: notarise with `xcrun notarytool submit` and staple the ticket.
3. App Store: upload with **Product → Archive → Distribute App**.
4. App Review will ask why the app needs website access; answer with the permission table in
   [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md).

## Safari limitations

- **No shortcut rebinding.** `commands` is declared, but Safari does not expose a UI to change it;
  the popup switch is the primary control.
- **No `runtime.onStartup`.** The badge is repainted on install and on every settings change.
- **No programmatic host-permission request.** Users allow or restrict sites in Safari Settings →
  Extensions; NightLens cannot prompt from the popup.
- **Event-page background.** Safari's MV3 service worker only exists from 16.4 and has a different
  lifecycle, so the Safari build declares `background.scripts` like Firefox.
- **iOS/iPadOS** is not claimed as supported.
