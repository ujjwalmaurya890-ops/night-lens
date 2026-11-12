# Privacy

NightLens is designed so that its privacy claims can be checked against its code. This document
states exactly what is stored, what is processed, and what is never done. The same invariants are
enforced by `tests/unit/privacy.test.ts`, which fails if the source starts using network APIs,
any storage area other than the local one (`chrome.storage.local` on Chromium,
`browser.storage.local` on Firefox and Safari), tracking dependencies, wider permissions, or a
manifest that asks for more than `storage`.

## Summary

| Question | Answer |
|---|---|
| Does NightLens send data anywhere? | **No.** There is no network code in the extension: no `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, or remote script loading. |
| Does it collect browsing history? | **No.** The active hostname is read from the page to apply per-site rules and is never recorded. |
| What is stored? | One settings object in extension local storage (`chrome.storage.local` / `browser.storage.local`) under the key `nightlens:settings`. |
| Where does it live? | In your browser profile, on your device. It is not synced by NightLens. |
| Is anything sent to a server? | **No.** There is no analytics, telemetry, crash reporting, remote configuration, or A/B testing. |
| Can it read my page content? | The content script reads computed colour values (background, text, border, gradient, shadow) to compute a dark equivalent. It does not read passwords, form values, or page text, and it does not transmit anything. |
| How do I delete everything? | Remove the extension, or use **Settings → Privacy → Reset all settings** to restore defaults. |

## What is stored

Local extension storage under `nightlens:settings` (`chrome.storage.local` on Chromium,
`browser.storage.local` on Firefox and Safari) contains a single JSON object:

- **Appearance:** theme id, brightness, contrast, warmth (legacy `sepia` alias), saturation, text
  size, accent hue, font preference.
- **Per-site rules:** hostnames you explicitly excluded or forced on, theme assignments, visual
  overrides, compatibility profiles, and any custom CSS you wrote for a domain.
- **Custom themes:** colour values and names you created.
- **Preferences:** schedule window, accessibility options, reading-mode settings, performance
  knobs, developer-mode flag, and the global on/off state.

Hostnames only appear here if **you** add a rule for them. NightLens never populates that list on
its own, so the stored data describes your configuration, not your browsing.

Nothing else is persisted. There is no cookie, `localStorage`, `sessionStorage`, IndexedDB, cache,
or history entry written by NightLens.

## What is processed in memory

While a page is open, the content script:

1. Reads the page's **computed colours** through `getComputedStyle`.
2. Computes dark equivalents using the current theme.
3. Applies them through generated stylesheet rules and `data-nl-*` attributes.

These values stay in the page's memory for as long as the page is open and are discarded when the
tab closes or NightLens is turned off. A small parsed-colour cache (bounded and cleared on disable)
avoids recomputing the same conversions. Nothing from this pipeline is written to storage.

The optional developer mode prints engine counters (elements processed, rules generated, elapsed
time) to the page console. It never prints page content, and it is off by default.

## Network activity

There is none. NightLens does not include:

- analytics or telemetry SDKs,
- crash reporting,
- remote configuration or feature flags,
- update checks beyond the browser's own extension mechanism,
- fonts, icons, or stylesheets loaded from a CDN (fonts and icons are bundled).

The `dist/` output loads only extension-local files, which is also why the Manifest V3 default
Content Security Policy applies unchanged.

## Permissions and why they exist

| Permission | Why | What it does **not** allow |
|---|---|---|
| `storage` | Persist your settings locally. | It does not sync, and it does not expose other extensions' data. |
| Content-script access to `http://*/*` and `https://*/*` (declared in `content_scripts`, not `host_permissions`) | NightLens has to see a page's colours to restyle it. It runs at `document_start` so theming can start before first paint. | No `tabs`, `history`, `cookies`, `webRequest`, `scripting`, `debugger`, or `activeTab` permission is requested. |

NightLens does **not** request host permissions, which means it cannot make cross-origin requests
even if a future change tried to. It has no `externally_connectable` entry, so other extensions and
web pages cannot send it messages.

## Messages between components

- Popup → top-frame content script: a status request.
- Content script → popup: hostname, status, and site mode, validated by the popup before use.
- Content script → extension pages (diagnostics): counters, preset name, hostname. Deliberately
  **not** settings or site rules.
- Popup/options → service worker: settings read/export requests, answered only for messages that
  carry this extension's own id, and only with sanitised settings.

No message leaves the extension.

## Custom CSS and imported themes

- Custom CSS you write is stored locally after validation. The validator rejects remote `url()`
  references, `@import`, `@font-face`, `expression(`, and obfuscated escapes, so your CSS cannot
  quietly fetch a remote resource.
- Theme files you import are validated field by field; unknown fields are dropped.
- Exported settings files are written by your browser's download mechanism to the location you
  choose. Treat them as configuration data: they contain your site rules.

## Data removal

| Action | Effect |
|---|---|
| Turn NightLens off | Removes generated styles from open pages; settings are kept. |
| **Reset all settings** | Overwrites the stored object with defaults. |
| Uninstall the extension | Chrome deletes `chrome.storage.local` for the extension. |

## Children and sensitive sites

NightLens has no accounts, no profiles, and no server-side component, so there is nothing to
aggregate about any user. Because per-site rules are stored locally, a device that is shared with
other people can reveal which domains you configured — that is the only configuration-derived
information NightLens keeps, and it only exists if you created those rules.

## Changes to this policy

Any change that adds a permission, a network call, or new stored data is a privacy change. It must
be reflected here and in `tests/unit/privacy.test.ts` in the same pull request, as described in
[CONTRIBUTING.md](../CONTRIBUTING.md).
