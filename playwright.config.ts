import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration.
 *
 * The mock SaaS server (the System Under Test) is started automatically via
 * the `webServer` hook, so `npx playwright test` is the only command needed.
 *
 * Reporters:
 *  - `list`  -> live test-by-test progress in the terminal
 *  - `html`  -> rich report, opened with `npx playwright show-report`
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'e2e-chromium',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'api',
      testDir: './tests/api',
    },
  ],
  webServer: {
    command: 'node mock-server/server.js',
    url: 'http://127.0.0.1:3100/login',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
