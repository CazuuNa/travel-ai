import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './apps/web/e2e',
  use: {
    baseURL: process.env.E2E_URL ?? 'http://localhost:8080',
    channel: process.env.PLAYWRIGHT_CHANNEL,
    screenshot: 'only-on-failure',
  },
  reporter: 'list',
});
