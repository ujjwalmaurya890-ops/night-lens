import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 45_000,
  workers: 1, // one persistent browser context with the extension loaded
  fullyParallel: false,
  reporter: [['list']],
  outputDir: 'test-results',
});
