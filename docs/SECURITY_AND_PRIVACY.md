# Security, permissions, and privacy

## Manifest review

NightLens uses Manifest V3 on every browser, with the default extension content-security policy
(no remote scripts, no `unsafe-eval`).

| Manifest entry | Chromium | Firefox | Safari | Why |
|---|---|---|---|---|
| `permissions: ["storage"]` | ✅ | ✅ | ✅ | Persist preferences in the extension's local storage area. No other API permission is requested. |
| `content_scripts.matches: http/https` | ✅ | ✅ | ✅ | Restyle ordinary web pages. This necessarily grants access to page DOM and styles on those sites. |
| `host_permissions: http/https` | — | ✅ | ✅ | Firefox MV3 and Safari treat host access as a revocable user grant that must be declared explicitly. Chromium derives the same access from `content_scripts`, so it declares none. |
| `commands.toggle-nightlens` | ✅ | ✅ | ✅ | The configurable `Alt+Shift+D` global toggle (Safari does not expose rebinding). |
| `background.service_worker` | ✅ | — | — | Chromium MV3 has no event pages. |
| `background.scripts` | — | ✅ | ✅ | Firefox MV3 has no service worker; Safari's is only available from 16.4 with a different lifecycle. |
| `browser_specific_settings.gecko` | — | ✅ | — | Required by AMO: add-on id, minimum version, and `data_collection_permissions.required = ["none"]`. |

Never requested on any browser: `tabs`, `activeTab`, `scripting`, `alarms`, `webRequest`, `history`,
`cookies`, `downloads`, `identity`, `management`, `notifications`. There are no remote scripts,
`unsafe-eval`, `web_accessible_resources`, or `externally_connectable` entries, and
`scripts/build/manifest.mjs` rejects a manifest that adds them.

The popup learns the active page hostname by messaging the top-frame content script, not through the
Tabs API. Schedules are evaluated by visible content scripts; no background alarm wakes the worker
each minute.

### Why each permission is unavoidable

- **`storage`** - the entire product is a saved preference set. Without it nothing persists.
- **Page access (http/https)** - NightLens reads computed colours and rewrites page colours. There is
  no narrower scope that still covers "the user opens a website"; a per-site opt-in would mean the
  extension does nothing until configured, which is not the product.
- **No `tabs` or `history`** - NightLens never enumerates tabs or reads URLs. The active tab is
  queried through `tabs.query({active:true,currentWindow:true})`, which needs no permission, and the
  hostname comes from the content script.

### Firefox-specific permission behaviour

Firefox MV3 host permissions are user-controlled: granted at install from Firefox 127, revocable per
site in `about:addons`. When revoked, the content script does not run; the popup explains it and
offers a gesture-bound **Grant access** request. NightLens never asks for access it does not use.

## Data handling

- Settings are stored locally under `nightlens:settings` in the extension's local storage area
  (`chrome.storage.local` / `browser.storage.local`); the synced area is never used, so settings do
  not leave the device.
- Hostnames are stored only when the user creates site-specific settings.
- Computed colors and engine statistics are processed in memory. Developer diagnostics remain in the browser console/message channel.
- NightLens does not collect or transmit browsing history, page text, form data, cookies, or webpage content.
- There is no analytics, telemetry, remote configuration, or third-party runtime service.
- Uninstalling the extension removes its local extension storage according to browser behavior.

## Input and message boundaries

- Storage reads sanitize every field, clamp numeric values, validate hostnames/theme IDs, and limit collection sizes.
- Same-surface writes are serialized to prevent rapid controls from overwriting each other's independent changes. Chrome storage does not provide cross-context transactions; simultaneous writes from different extension surfaces remain last-write-wins.
- Settings imports must be JSON objects (maximum 1 MB) and pass the same sanitizer. Unknown fields are discarded.
- Theme imports require valid IDs/names and six-digit hex colors.
- Runtime status messages validate type, hostname, site status/mode, sender extension ID, tab ID, and frame as applicable.
- React renders UI text without `innerHTML`.

## Custom CSS

Custom CSS is optional and domain-specific. It is sanitized when stored and again before injection.

The conservative validator:

- enforces the 20,000-character limit;
- rejects `javascript:`, `expression()`, `@import`, `@font-face`, behavior bindings, control characters, comments, and CSS escapes (the latter two prevent common token-obfuscation bypasses);
- rejects every `url()` except an in-document `#fragment` or a base64 PNG/GIF/JPEG/WebP data image;
- rejects malformed or unrecognized `url()` constructs.

This is a privacy guard, **not a CSS sandbox**. Custom CSS can hide content or damage layout. Only import settings/CSS from sources you trust.

## Generated page styles

Per-element rules contain engine-generated hex colors or validated computed gradient/shadow declarations. Generated gradient/shadow values reject declaration delimiters and `url()`, and are checked with `CSS.supports` where available. Non-gradient image URLs are never copied into NightLens rules.

Disabling NightLens disconnects its observers and removes owned styles and managed attributes. Content-script unload cleanup removes subscriptions, media-query listeners, timers, message listeners, and engine resources.

## Residual risks and review limits

- Any extension that themes every website has substantial DOM access. Keep dependencies updated and review release artifacts.
- Sites can detect NightLens through `data-nl-*` attributes and owned style elements.
- Computed-style theming cannot guarantee readability over photographs, unknown color syntax, every gradient stop, or all third-party widgets.
- Dependency audit results are environment- and date-specific. Run `npm audit` during development rather than treating a historical zero-vulnerability result as a guarantee.
- The adapter layer is the only code that talks to `chrome.*`/`browser.*`; `tests/unit/architecture.test.ts` enforces that boundary so a future feature cannot quietly widen it.
- Public issue reports and screenshots must not contain credentials, private page content, or unrelated browsing history.

See [Limitations](LIMITATIONS.md) for compatibility boundaries and unverified browser/accessibility checks.
