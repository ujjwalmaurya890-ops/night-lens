# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for an unpatched vulnerability.

- Preferred: use GitHub's private reporting flow on this repository
  (**Security → Report a vulnerability**), which opens a private advisory.
- If private reporting is unavailable, open a minimal issue that says a security report is
  available and asks a maintainer to enable a private channel. Do not include exploit details,
  a proof of concept, or reproduction steps in that public issue.

Please include: affected version or commit, browser and version, a description of the impact, and
the smallest reproduction you can share. Never attach real browsing data, credentials, cookies, or
page content you do not own.

## Supported versions

NightLens is developed and shipped from `main`; the built extension is produced from this
repository. Only the latest `main` build is supported. There are no maintained release branches at
this time, so fixes land on `main` and are released from there.

## Scope

In scope:

- The extension bundle produced by `npm run build` (`dist/`).
- Content-script, service-worker, popup and options source in `src/`.
- Custom-CSS and settings-import validation.
- The manifest: permissions, content-script matches, CSP-relevant entries.

Out of scope:

- Websites NightLens restyles (a page's own XSS is not NightLens's vulnerability), unless NightLens
  turns it into privilege escalation.
- The colour-mapping heuristics producing a low-contrast page. Report those as a bug with a
  reproduction; they are correctness issues, not vulnerabilities.
- Denial of service by a page that regenerates DOM faster than any observer can follow.
- Untrusted settings files you import from an untrusted source (they are sanitised, but custom CSS
  can still change a page's layout — this is documented in [docs/PRIVACY.md](docs/PRIVACY.md)).

## Design guarantees reviewers can check

| Guarantee | Where it is enforced |
|---|---|
| No network access from the extension | `tests/unit/privacy.test.ts` scans every source file for `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, remote fonts/scripts. |
| Only `storage` permission, no host permissions, no `externally_connectable` | `src/manifest.json` plus the CI manifest check. |
| No `eval`, `new Function`, `innerHTML`, `document.write` | Same privacy suite. |
| Settings are sanitised on read, write, import | `sanitizeSettings` in `src/shared/storage.ts`, covered by `tests/unit/security.test.ts`. |
| Collections are bounded to prevent storage-exhaustion via imports | `MAX_SITE_RULES`, `MAX_SITE_THEMES`, `MAX_SITE_OVERRIDES`, `MAX_COMPATIBILITY_ENTRIES`, `MAX_CUSTOM_CSS_SITES`, `MAX_CUSTOM_THEMES`. |
| Runtime messages are validated, and the worker answers only its own surfaces | `src/shared/messages.ts`, `src/background/handlers.ts`. |
| Custom CSS cannot fetch remote resources | `sanitizeCustomCss` in `src/shared/css.ts`. |
| Prototype pollution via imported JSON is rejected | `normalizeHostname` rejects `__proto__`/`constructor` as hostnames; lookups use `hasOwnProperty`. |

## Threat model

NightLens runs with the privileges a Manifest V3 extension can obtain without host permissions,
and injects a content script into ordinary web pages. The most relevant risks are therefore:

1. **A malicious page trying to influence the extension.** The content script reads computed
   styles only, never page-supplied HTML or script, and never forwards page text anywhere. Values
   it does forward (hostname, status) are validated before use, and the popup checks the sender tab
   and frame.
2. **A malicious extension or page trying to talk to NightLens.** There is no
   `externally_connectable`, and the service worker verifies `sender.id`.
3. **Malicious configuration.** Imported settings and custom CSS pass the same sanitiser as manual
   edits; CSS `url()` may only reference fragments or inline base64 raster images.
4. **Privilege creep over time.** The privacy invariant suite and the CI manifest check fail the
   build if a permission is added without updating the documentation and the checks.

## Disclosure

Fixes are developed privately, released on `main`, and described in `CHANGELOG.md`. Credit is
given in the release notes unless the reporter prefers to remain anonymous.
