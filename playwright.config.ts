import { defineConfig } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [['html', { open: 'never' }], ['list'], ['./tests/reporters/outcome.reporter.ts']],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://demoqa.com',
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'api',
      testMatch: /.*\.spec\.ts/,
      grepInvert: /@known-issue/,
    },
    {
      name: 'known-issues',
      testMatch: /.*\.spec\.ts/,
      grep: /@known-issue/,
    },
  ],
});
