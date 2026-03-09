// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration for savitara-web.
 * Tests run against the local Vite dev server on port 3000.
 * Backend is expected on port 8000 (mock service worker or real).
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 1 : 0,
  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    /* Base URL for all tests */
    baseURL: process.env.E2E_BASE_URL || (process.env.CI ? 'http://localhost:4173' : 'http://localhost:3000'),
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    /* Default timeout per action */
    actionTimeout: 10_000,
  },
  /* Configure projects for major browsers — CI only uses chromium */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    ...(process.env.CI
      ? []
      : [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
        ]),
  ],
  /* Start the Vite dev server before running tests in local mode */
  webServer: process.env.CI
    ? {
        // In CI, run against the built app via `vite preview` on port 4173
        command: 'npm run preview',
        url: 'http://localhost:4173',
        reuseExistingServer: false,
        timeout: 60_000,
      }
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
