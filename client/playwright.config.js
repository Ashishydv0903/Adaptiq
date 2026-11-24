import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    permissions: ['microphone', 'camera'],
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    }
  },
  webServer: [
    {
      command: 'node src/server.js',
      cwd: '../server',
      url: 'http://127.0.0.1:5000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      stdout: 'pipe',
      stderr: 'pipe'
    },
    {
      command: 'npx vite --host 127.0.0.1 --port 5173',
      cwd: '.',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 30000
    }
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
