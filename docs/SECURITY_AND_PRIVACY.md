# Security, permissions, and privacy

## Manifest review

NightLens uses Manifest V3 with the default extension content-security policy.

| Manifest entry | Justification |
|---|---|
| `permissions: ["storage"]` | Persist preferences in `chrome.storage.local`. |
| `content_scripts.matches: ["http://*/*", "https://*/*"]` | Restyle ordinary web pages. This necessarily grants access to page DOM/styles on those sites. |
| `commands.toggle-nightlens` | Provide the configurable `Alt+Shift+D` global toggle. |

Not requested: `tabs`, `activeTab`, `scripting`, `alarms`, `webRequest`, `history`, `cookies`, or `host_permissions`. There are no remote scripts, `unsafe-eval`, `web_accessible_resources`, or `externally_connectable` entries.

The popup learns the active page hostname by messaging the top-frame content script, not through the Tabs API. Schedules are evaluated by visible content scripts; no background alarm wakes the worker each minute.

## Data handling

- Settings are stored locally under `nightlens:settings`; sync storage is not used.
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
- Public issue reports and screenshots must not contain credentials, private page content, or unrelated browsing history.

See [Limitations](LIMITATIONS.md) for compatibility boundaries and unverified browser/accessibility checks.
