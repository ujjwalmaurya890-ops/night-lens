import { defineConfig } from '@playwright/test';

// The suite has never executed in a real browser from the development sandbox (no downloadable
// Chromium there), so CI is its first home. The settings below exist to make that first failure
// diagnosable instead of a red X with no evidence.
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
