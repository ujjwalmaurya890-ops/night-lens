# Contributing to NightLens

Thank you for improving NightLens. Keep changes focused, privacy-preserving, and covered by tests.

## Development setup

Requirements: Node.js 22.12 or newer and a Chromium-based browser for manual extension testing.

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Load `dist/` through `chrome://extensions` → **Developer mode** → **Load unpacked**. Reload both the extension and test tabs after changes.

For browser automation, install Chromium once with `npx playwright install chromium`, then run `npm run test:e2e`. Set `NIGHTLENS_CHROMIUM` if you need a specific browser executable.

The full command reference, source map, debugging notes, and the rules for adding a theme or a
message are in the [development guide](docs/DEVELOPMENT.md).

## Before opening a pull request

1. Run `npm run typecheck`, `npm test`, and `npm run build`.
2. Run `npm run test:e2e` when Chromium is available. If not, say so in the PR — do not imply a
   browser pass you did not run.
3. Add regression tests for bug fixes and behavior tests for features. A bug fix should include a
   test that fails without the fix.
4. Update documentation when behavior, permissions, shortcuts, storage, or limitations change, and
   add a `CHANGELOG.md` entry under **Unreleased**.
5. Check `git diff` for generated files (`dist/`, `nightlens.zip`, `test-results/`), credentials,
   personal data, and unrelated edits.

## Design constraints

- Preserve the Manifest V3, TypeScript, React, and Vite architecture unless a change has a clear reason.
- Do not add analytics, remote configuration, browsing-history collection, or page-content transmission.
- Request a new extension permission only with a documented, user-facing justification.
- Keep the content engine dependency-free and avoid unbounded observers, maps, timers, or generated CSS.
- Do not blindly invert pages, photographs, videos, canvases, or SVG illustrations.
- Maintain accessible names, keyboard operation, visible focus, readable contrast, and reduced-motion behavior. `tests/unit/ui-accessibility.test.tsx` asserts accessible names and unique element ids for every settings tab — extend it when you add controls.
- Sanitize imported settings and custom CSS at both input and injection boundaries.
- Never put page text, form values, or browsing history into storage, a message, or a log line.
- Keep every engine-side collection bounded (generated rules, colour cache, gradient/shadow cache,
  queued elements). A cache without a bound is a leak.
- Engine changes must keep `stop()` able to restore the page exactly; the regression suite compares
  `documentElement.outerHTML` before and after repeated enable/disable cycles.

## Tests

Unit tests live in `tests/unit/` and use Vitest/jsdom. Browser tests and local fixtures live in
`tests/e2e/` and use Playwright with the real extension loaded. jsdom does not prove real-browser
layout or paint behavior; document those limits rather than overstating results.

Additional suites worth knowing about:

- `tests/unit/privacy.test.ts` — static invariants: no network APIs, no tracking dependencies, only
  `chrome.storage.local`, only the `storage` permission. It fails the build, so a permission or
  network change cannot slip in unnoticed.
- `tests/unit/security.test.ts` — message validators, service-worker sender checks, sanitisation
  bounds, and stale-extension-context recovery.
- `tests/unit/ui-accessibility.test.tsx` — accessible names, unique ids, skip link, sidebar keyboard
  navigation, live regions, and the live theme preview.

See [Architecture](docs/ARCHITECTURE.md), [Development guide](docs/DEVELOPMENT.md),
[Privacy](docs/PRIVACY.md), [Security policy](SECURITY.md), and
[Browser test checklist](docs/BROWSER_TEST_CHECKLIST.md).

## Reporting issues

Use the bug report or feature request template. Include reproduction steps and omit private page
content, credentials, and browsing history. Do not disclose unpatched security vulnerabilities in a
public issue; follow [SECURITY.md](SECURITY.md) instead.

By contributing, you agree that your contribution is licensed under the repository's [MIT License](LICENSE).
