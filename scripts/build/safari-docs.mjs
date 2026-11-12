import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The Safari output is only the *input* to Apple's toolchain: Safari has no "load unpacked
 * extension" path. `safari-web-extension-converter` wraps the web extension in a signed app, so
 * the documentation that ships next to it must say that plainly instead of implying that the
 * `browser-extension` directory is installable on its own.
 */
export function safariDocumentation({ root, manifest }) {
  const converterSource = 'dist/safari/browser-extension';
  const installGuidePath = resolve(root, 'docs/SAFARI_INSTALL.md');
  const installGuide = existsSync(installGuidePath)
    ? readFileSync(installGuidePath, 'utf8')
    : '# Safari installation\n\nSee docs/SAFARI_INSTALL.md in the source repository.\n';

  const readme = `# NightLens for Safari ${manifest.version}

This directory is **not** an installable Safari extension. Safari only runs web extensions that
are packaged inside a macOS/iOS app, so Apple's converter must wrap \`browser-extension/\` in an
Xcode project first.

## What is here

| Path | Contents |
| --- | --- |
| \`browser-extension/\` | The Manifest V3 web extension (shared bundles + \`manifest.json\`) |
| \`documentation/INSTALL.md\` | Step-by-step macOS + Xcode instructions |
| \`documentation/RESOURCES.md\` | Manifest differences and Safari limitations |

## Convert and run (macOS 13+, Xcode 15+)

\`\`\`bash
# From the repository root, after: npm run build:safari
xcrun safari-web-extension-converter ${converterSource} \\
  --project-location dist/safari \\
  --app-name "NightLens" \\
  --bundle-identifier app.nightlens.safari \\
  --macos-only \\
  --no-open --no-prompt

open dist/safari/NightLens/NightLens.xcodeproj
\`\`\`

Then in Xcode: select the app scheme → Run. In Safari: **Settings → Advanced → Show features for
web developers**, then **Settings → Extensions → NightLens → Allow**.

For a distributable build you need an Apple Developer account (Mac App Store or Developer ID).
Signing, notarisation and App Store review are described in the repository's
\`docs/RELEASE_GUIDE.md\`.

## Requirements

- Git, Node.js 22 and the repository source.
- macOS with Xcode and its command line tools (\`xcode-select --install\`).
- Safari 16.4 or newer.

## Honesty note

This build was **not** converted or run on macOS in the producing environment (no macOS host was
available), so Safari support is *prepared and statically verified*, not *installation-tested*.
`;

  const resources = `# Safari-specific manifest and API differences

The Safari build (\`manifests/safari.json\`) differs from the Chromium build on purpose:

| Area | Safari build | Why |
| --- | --- | --- |
| \`background\` | \`scripts: ["background.js"]\` | Safari 15.4+ runs MV3 extensions with a non-persistent event page; \`service_worker\` only works from Safari 16.4 and behaves differently. |
| \`host_permissions\` | \`http://*/*\`, \`https://*/*\` | Safari manages site access per site; declaring it keeps \`tabs.sendMessage\` working after the user allows a site. |
| \`browser_specific_settings\` | absent | Apple does not consume Gecko settings, and AMO-specific keys must not appear in an App Store submission. |
| Keyboard shortcut | command declared, not rebindable | Safari does not expose shortcut rebinding; the popup switch is the primary control. |
| Site access prompt | none | Safari has no \`permissions.request\`; access is granted in Safari Settings → Extensions. |
| \`runtime.onStartup\` | absent | Safari does not implement it; the toolbar badge is repainted on install and on settings changes. |

Everything else - the theme engine, storage schema, site rules, messaging - is byte-identical to
the Chromium and Firefox bundles, because all targets share one JavaScript build.

## Supporting iOS/iPadOS

\`safari-web-extension-converter\` can emit an iOS target as well. NightLens' UI is responsive and
the content script is frame-safe, but iOS has not been tested and is therefore not claimed as
supported.
`;

  return {
    'README.md': readme,
    'INSTALL.md': installGuide,
    'RESOURCES.md': resources,
  };
}
