# Security, Permissions and Data

## Permissions (from built `dist/manifest.json`)

| Entry | Why | Not requested |
|---|---|---|
| `permissions: ["storage","alarms"]` | Save settings in `chrome.storage.local`; `alarms` for schedule (1 min check). | `tabs`, `activeTab`, `scripting`, `webRequest`, `history`, `cookies`, any `host_permissions` |
| `content_scripts.matches: http://*/*, https://*/*` | Theme must run on every site. Shown as "read and change data on all websites" — inherent to page-restyling. | `file://`, `about:blank`, `chrome://` (not matched) |
| `commands.toggle-nightlens` (Alt+Shift+D) | Keyboard toggle. | — |
| No `host_permissions` | Content scripts already cover http/https. | — |

Default MV3 CSP kept (no `unsafe-eval`, no remote scripts). No `web_accessible_resources`, no `externally_connectable`: pages cannot message extension.

## What the Code Does and Does Not Do

Verified by `grep` over `src/` (zero matches): `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `eval(`, `new Function`, `innerHTML`, `document.write`, `importScripts`, `localStorage`, `sessionStorage`, `indexedDB`. In built files: `content.js` contains one URL-shaped string (SVG XML namespace) and `background.js` none; neither contains `fetch(` etc. (grep-verified). Popup/options bundle contains `https://react.dev/errors/` React error strings + XML NS constants — not network requests. E2E never observed extension pages making requests (code-inspection evidence, not packet capture).

- **No page content leaves browser.** Computed colors used in-memory, never stored/sent.
- **No browsing history.** Only hostnames *you* add (exclude/force/custom CSS).
- **No analytics/telemetry/remote config.**
- **Message validation:** Content accepts only `get-status` from own extension (`sender.id`); popup validates well-formed `status-changed` from active tab top frame. Hostnames re-validated.
- **Sanitization on every read/write** (`sanitizeSettings`): types, ranges, theme IDs, hostnames (strict regex, `__proto__` rejected), max 2000 rules, max 50 custom themes, max 20k custom CSS. Corrupt storage → defaults, not throw.
- **Custom CSS validation** (`src/shared/css.ts` `sanitizeCustomCss`, applied on storage write *and* again at injection time): blocks `javascript:`, `expression(`, `@import`, `@font-face`, `behavior:`, `-moz-binding`, and **any `url(...)` that is not an inline `data:` URI or in-document `#fragment`** — so injected CSS can never trigger an external network request from the page. Max length enforced; empty discarded.
- **Injected styling inert:** Rules only contain `[0-9a-f]{6,8}` keys engine produced. No page text in CSS/HTML. React escapes; no `innerHTML`.
- **Per-site overrides** validated (theme, brightness etc. clamped).
- **Theme import** validated via `sanitizeCustomThemes`; malformed rejected.
- **Settings import** validated via `validateImport`; unknown keys dropped.

## Data Stored (`chrome.storage.local`, key `nightlens:settings`)

```json
{
  "schemaVersion": 2,
  "enabled": true,
  "theme": "midnight",
  "brightness": 100, "contrast": 100, "warmth": 0, "saturation": 50, "accentHue": 225, "textSize": 100,
  "siteRules": { "example.com": "off" },
  "siteThemes": { "docs.example.com": "nord" },
  "siteOverrides": { "example.com": { "brightness": 90 } },
  "customThemes": [{ "id": "custom-...", "name": "My Blue", "bg": "#0a0a0f", "text": "#e8e8f2", "accent": "#7ab7ff" }],
  "activeCustomThemeId": null,
  "customCSS": { "example.com": "body { letter-spacing: 0.02em; }" },
  "schedule": { "enabled": false, "start": "22:00", "end": "07:00", "followSystem": false },
  "accessibility": { "highContrast": false, "reducedMotion": false, "underlineLinks": false, "colorBlindMode": "none" },
  "readingMode": { "enabled": false, "fontSize": 100, "lineHeight": 160, "maxWidth": 720, "fontFamily": "system" },
  "compatibility": { "tricky.example.com": "gentle" }
}
```

Local to browser profile; not synced (`storage.sync` not used). Removed on uninstall. Settings page has confirmed reset.

## Residual Risks

- Extension runs on all sites; compromised build/dependency could read page content. Mitigations: tiny deps (React only in popup/options; content imports none), pinned versions, no remote code. Formal supply-chain audit/`npm audit` not performed (run `npm audit` yourself).
- Sites can detect NightLens via `data-nl-*` attributes and `<style data-nl-owned>`.
- Custom CSS, though validated, is powerful — malicious import could hide page content (phishing risk). Users should only import from trusted sources; docs warn clearly.
- `alarms` permission adds minimal background wakeups (1/min when schedule enabled; negligible when disabled).

## Permissions Justification (for Store Review)

- `storage`: Required to persist user preferences locally.
- `alarms`: Required for scheduled dark mode (check time window every minute; uses Chrome Alarms API, not polling workers).
- `content_scripts` on `http/https`: Core functionality — applying theme to every web page. No alternative without host permissions; explained in description.
