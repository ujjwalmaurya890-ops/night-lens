# Changelog

All notable changes to NightLens are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Engineering pass focused on engine reliability, accessibility, security and documentation.
Every entry below is implemented and covered by the tests listed in
[docs/FINAL_ENGINEERING_REPORT.md](docs/FINAL_ENGINEERING_REPORT.md).

### Added

- **Purpose presets.** Balanced dark, Deep dark, Dim reading, High contrast and Soft night apply a
  palette *and* its luminance/contrast calibration in one step, and persist across restarts.
- **Live theme preview.** The settings page renders the exact surface set (page, raised card, body,
  muted text, link, button, input, border) that the content script will apply, with measured
  contrast ratios. It is preview-only and adds no tab stops.
- **Per-website override editor.** Create and clear per-domain theme, brightness, contrast and
  warmth overrides from the Websites tab; only values differing from your globals are stored.
- **Shared `EmptyState` component** with real text instead of icon-only placeholders.
- **Skip link** to the settings main region, arrow-key/Home/End navigation for the settings
  sidebar, `aria-controls` wiring and a polite live announcement of the active section.
- `docs/PRIVACY.md`, `SECURITY.md`, `CHANGELOG.md`, `docs/DEVELOPMENT.md`,
  `docs/ENGINEERING_AUDIT.md`, `docs/CONTRIBUTION_TRACKER.md` and this report history.
- Automated privacy invariants (`tests/unit/privacy.test.ts`) that fail if network access,
  extra storage areas, tracking dependencies, wider permissions, or HTML/eval injection appear.
- Continuous integration now runs two jobs (verify + browser tests) pinned to immutable action
  commit SHAs, with Playwright browser caching and a minimal-permission manifest check.

### Changed

- Native-dark detection also considers `<meta name="color-scheme">` and design-system backdrop
  variables (`--background`, `--bg`, …), and the result is cached per URL instead of being
  recomputed on every settings write.
- Colour parsing understands `hwb()` and the full CSS named-colour table; values it cannot
  interpret are still left untouched rather than guessed.
- The theme engine observes theme-related `data-*` attributes and `role` on every element, so
  sites that swap their own theme on an inner container are re-themed.
- SPA support uses one ref-counted history patch per window (no more chained wrappers when two
  engines touch the same page) and follows the Navigation API where available.
- `ThemeEngine.update()` is a no-op when the effective configuration is unchanged.
- Disabling NightLens before the first paint no longer leaves a `data-nl-ready` marker behind.
- Service-worker message handling validates the request type and answers with sanitised settings.

### Fixed

- **The install seed could discard settings written at the same moment.** `chrome.runtime.onInstalled`
  read storage, and if it was empty it wrote defaults unconditionally — a write that landed between
  the read and the write was lost. The new browser suite caught a page loading defaults while per-site
  rules were stored. Defaults are now seeded only when the key is still absent, inside the extension's
  write queue, so it is atomic with respect to every other writer.
- **The browser suite now actually runs.** Its first execution found three test defects as well: the
  harness seeded `schemaVersion: 1` (exercising the legacy migration in every test), `getByLabel('Theme')`
  became ambiguous once the preset row added `aria-label="Favorite themes"`, and the popup tab-order test
  hardcoded the pre-redesign control list.

- Forced layout reads (`getBoundingClientRect`) are no longer issued for ordinary elements;
  geometry is only measured for canvas/SVG plates.
- Removing a shadow-DOM host while NightLens is active strips the generated attributes inside its
  root, so a re-attached root no longer keeps orphaned `data-nl-*` values.
- An extension update/reload no longer leaves the old content script throwing
  “Extension context invalidated”; it detects the stale context, restores the page and detaches.
- Four always-present, empty `role="alert"` containers no longer clutter the accessibility tree.
- Stored collections are bounded (site themes, overrides, compatibility profiles, custom CSS),
  custom-theme ids are de-duplicated, and a dangling custom-theme pointer is normalised.
- The gradient/shadow payload cache is bounded and cleared on stop.

### Security

- The service worker ignores messages that do not carry this extension's id.
- Content-script diagnostics send counters and the active preset only — never settings or the
  list of per-site rules.
- Settings writes fail with an explicit, actionable error when the extension context is gone
  instead of throwing an opaque browser error.

### Documentation

- README, architecture, limitations, test report and contributing guide updated to match the code.
- Known, deliberately unsupported cases (closed shadow roots, shadow roots attached long after the
  first pass, pseudo-state colours, cross-origin iframe restrictions) are documented rather than
  silently approximated.

## [1.0.0]

Initial public state of this repository: contrast-aware dark engine, ten curated palettes, legacy
palettes, system-following mode, custom themes, per-site rules and themes, schedules, reading mode,
accessibility options, import/export, and a Vitest/Playwright test suite.
