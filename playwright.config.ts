import { defineConfig } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'tests/ui',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixels: 0,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  snapshotDir: 'ui_baseline/shots',
  snapshotPathTemplate: '{snapshotDir}/{projectName}/{testFilePath}/{arg}{ext}',
  outputDir: 'test-results/ui',
  reporter: [['list']],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 240_000,
    env: {
      VITE_HTTPS_KEY: '__none__',
      VITE_HTTPS_CERT: '__none__',
    },
  },
  use: {
    baseURL: BASE_URL,
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'dark',
    deviceScaleFactor: 1,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    ignoreHTTPSErrors: true,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    launchOptions: {
      args: ['--autoplay-policy=no-user-gesture-required'],
    },
  },
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1440, height: 900 },
        isMobile: false,
        hasTouch: false,
      },
    },
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      },
    },
    {
      name: 'mobile-android-low',
      use: {
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (Linux; Android 12; Pixel 4a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Mobile Safari/537.36',
      },
    },
  ],
});
