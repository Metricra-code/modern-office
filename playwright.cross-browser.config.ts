import { defineConfig, devices } from '@playwright/test';
import baseline from './playwright.config';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3103';

export default defineConfig({
  ...baseline,
  grep: /@browser-smoke/,
  metadata: { publicBuild: true },
  use: { ...baseline.use, baseURL },
  projects: [
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'bun run build:public && bun run dev:cloudflare',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});
