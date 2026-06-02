import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load E2E env once here — all webServer child processes inherit this environment.
dotenv.config({ path: 'e2e/.env.e2e' });

const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5174';
const backendUrl  = process.env.BACKEND_URL  || 'http://127.0.0.1:3002';

const isCI = !!process.env.CI;
const probeHost = isCI ? '127.0.0.1' : '[::1]';

export default defineConfig({
  testDir: './e2e/tests',
  testIgnore: '**/auth.setup.ts',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : 1,
  reporter: 'list',

  webServer: [
    {
      command: 'npm --prefix server run dev',
      url: `http://${probeHost}:3002/auth/status`,
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: isCI ? 'vite --host 127.0.0.1' : 'vite --host ::',
      url: `http://${probeHost}:5174`,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],

  use: {
    baseURL: frontendUrl,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*auth\.setup\.ts/,
      testDir: './e2e',
    },
    {
      name: 'logged-out',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /.*authenticated.*\.spec\.ts/,
    },
    {
      name: 'logged-in',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*authenticated.*\.spec\.ts/,
    },
  ],
});

