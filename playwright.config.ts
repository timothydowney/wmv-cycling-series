import { defineConfig, devices } from '@playwright/test';

const e2eFrontendUrl = process.env.E2E_FRONTEND_URL || 'http://localhost:5174';
const e2eBackendUrl = process.env.E2E_BACKEND_URL || 'http://localhost:3002';

export default defineConfig({
  testDir: './e2e/tests',
  testIgnore: '**/auth.setup.ts', // Don't run setup in normal test runs
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: 'list',

  webServer: [
    {
      command: 'npm run dev:server:e2e',
      url: `${e2eBackendUrl}/auth/status`,
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'npm run dev:frontend:e2e',
      url: e2eFrontendUrl,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
  
  use: {
    baseURL: e2eFrontendUrl,
    trace: 'on-first-retry',
  },

  projects: [
    // Setup project - run authentication manually when needed
    {
      name: 'setup',
      testMatch: /.*auth\.setup\.ts/,
      testDir: './e2e',
    },
    
    // Logged-out tests (default - no storage state)
    {
      name: 'logged-out',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /.*authenticated.*\.spec\.ts/,
    },
    
    // Logged-in tests establish a session via the e2e auth helper.
    {
      name: 'logged-in',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*authenticated.*\.spec\.ts/,
    },
  ],
});
