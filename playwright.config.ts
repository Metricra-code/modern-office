import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 40000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3100',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        launchOptions: {
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
        },
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'bun run dev',
        url: 'http://localhost:3100',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});
