import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'npm run dev:server',
      url: 'http://localhost:3012/api/health',
      env: { PORT: '3012' },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'npm run dev -- --host localhost',
      url: 'http://localhost:5173',
      env: { API_PROXY_TARGET: 'http://localhost:3012' },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
})
