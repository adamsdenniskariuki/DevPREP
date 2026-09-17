import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PWA_TEST_PORT ?? 4383)
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PWA_TEST_PORT must be an integer between 1 and 65535')
}
const origin = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  testMatch: 'pwa.spec.ts',
  globalSetup: './tests/pwa-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: 'test-results/pwa',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/pwa', open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: origin,
    serviceWorkers: 'allow',
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'production-pwa', use: { browserName: 'chromium' } }],
  webServer: {
    command: `node tests/pwa-server.mjs ${port}`,
    url: `${origin}/__pwa_test__/health`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
