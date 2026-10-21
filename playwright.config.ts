import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './e2e',
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  use: {
    baseURL,
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'node scripts/start-for-e2e.mjs',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: !process.env.CI,
        // Allows cold-start runs where we may build before serving the app.
        timeout: 300000,
        // The e2e harness serves a production build whose middleware is
        // fail-closed without ACCESS_SESSION_SECRET; bypass the access
        // gate so the smoke specs exercise the app itself.
        env: {
          ACCESS_CONTROL_BYPASS: 'true',
        },
      },
});
