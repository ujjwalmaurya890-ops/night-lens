import { defineConfig } from '@playwright/test';

// The suite drives a real Chromium browser with the built extension loaded. Environment overrides:
//   NIGHTLENS_TARGET=chrome|edge|brave|opera   which dist/<target> build to load (default chrome)
//   NIGHTLENS_CHROMIUM=/path/to/browser        use a different Chromium-family binary
//                                              (Brave, Vivaldi, Opera GX, Edge are all Chromium,
//                                              but Playwright only bundles Chromium itself)
// Firefox and Safari canvas loading of extensions is not supported by Playwright, so those targets
// are covered by the manual matrix in docs/TESTING.md rather than by this suite.
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 45_000,
  workers: 1, // one persistent browser context with the extension loaded
  fullyParallel: false,
  forbidOnly: CI, // a stray test.only must not silently shrink the suite in CI
  retries: CI ? 1 : 0, // one retry in CI only, so a slow runner does not fail a correct test
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
