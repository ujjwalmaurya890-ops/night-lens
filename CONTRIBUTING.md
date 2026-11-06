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

## Before opening a pull request

1. Run `npm run typecheck`, `npm test`, and `npm run build`.
2. Run `npm run test:e2e` when Chromium is available. If not, say so in the PR.
3. Add regression tests for bug fixes and behavior tests for features.
4. Update documentation when behavior, permissions, shortcuts, or storage changes.
5. Check `git diff` for generated files, credentials, personal data, and unrelated edits.

## Design constraints

- Preserve the Manifest V3, TypeScript, React, and Vite architecture unless a change has a clear reason.
- Do not add analytics, remote configuration, browsing-history collection, or page-content transmission.
- Request a new extension permission only with a documented, user-facing justification.
- Keep the content engine dependency-free and avoid unbounded observers, maps, timers, or generated CSS.
- Do not blindly invert pages, photographs, videos, canvases, or SVG illustrations.
- Maintain accessible names, keyboard operation, visible focus, readable contrast, and reduced-motion behavior.
- Sanitize imported settings and custom CSS at both input and injection boundaries.

## Tests

Unit tests live in `tests/unit/` and use Vitest/jsdom. Browser tests and local fixtures live in `tests/e2e/` and use Playwright with the real extension loaded. jsdom does not prove real-browser layout or paint behavior; document those limits rather than overstating results.

See [Architecture](docs/ARCHITECTURE.md), [Browser test checklist](docs/BROWSER_TEST_CHECKLIST.md), and [Security & Privacy](docs/SECURITY_AND_PRIVACY.md).

## Reporting issues

Use the bug report or feature request template. Include reproduction steps and omit private page content, credentials, and browsing history. Do not disclose unpatched security vulnerabilities in a public issue; use the repository's private security reporting channel when available.

By contributing, you agree that your contribution is licensed under the repository's [MIT License](LICENSE).
