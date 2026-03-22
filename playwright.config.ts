import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  testIgnore: '**/auth.setup.ts', // Don't run setup in normal test runs
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: 'list',
  
  use: {
    baseURL: 'http://localhost:5173',
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
