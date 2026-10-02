import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests', workers: 1, timeout: 180000,
  use: { baseURL: 'http://127.0.0.1:4188', channel: 'msedge', headless: true, trace: 'retain-on-failure' },
  webServer: { command: 'node scripts/local.mjs', url: 'http://127.0.0.1:4188', reuseExistingServer: !process.env.CI, env: { PORT: '4188' } }
})
