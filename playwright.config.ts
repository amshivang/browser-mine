import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    viewport: { width: 960, height: 600 },
    headless: true,
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: process.env.CHROME_PATH ?? '/home/shivang/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
      args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
    },
  },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5174', reuseExistingServer: true, timeout: 60000 },
});
