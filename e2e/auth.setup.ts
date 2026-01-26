/**
 * Authentication Setup for E2E Tests
 * 
 * Run this manually to authenticate with Strava and save the session state.
 * The saved session will be reused by all authenticated tests.
 * 
 * Usage:
 *   npm run e2e:auth
 * 
 * You'll need to:
 * 1. Log in to Strava when prompted
 * 2. Authorize the application
 * 3. Wait for redirect back to the app
 * 
 * Session state is saved to e2e/.auth/user.json (gitignored)
 */

import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

setup('authenticate with Strava', async ({ page }) => {
  // Set a longer timeout for manual authentication (5 minutes)
  setup.setTimeout(300000);
  
  console.log('\n🔐 Starting Strava authentication...\n');
  
  // Navigate to the app
  await page.goto('/leaderboard');
  
  // Open the menu
  await page.getByRole('button', { name: 'Menu' }).click();
  
  // Click "Connect with Strava" in the menu (not the banner)
  console.log('📱 Clicking "Connect with Strava" button...');
  await page.locator('.menu-item.strava-connect-menu-item').click();
  
  // Wait for Strava OAuth page to load
  console.log('⏳ Waiting for Strava login page...');
  await page.waitForURL(/strava\.com/, { timeout: 10000 });
  
  console.log('\n✋ MANUAL STEP REQUIRED:');
  console.log('   1. Log in to Strava in the browser window');
  console.log('   2. Complete MFA if required');
  console.log('   3. Click "Authorize" to grant access');
  console.log('   4. Wait for redirect back to the app');
  console.log('   (You have 5 minutes to complete this)\n');
  
  // Wait for redirect back to our app (5 minute timeout for manual login + MFA)
  // Use a more flexible URL pattern and handle network changes during OAuth
  try {
    await page.waitForURL(/localhost:5173/, { timeout: 300000 });
  } catch (error) {
    // If we get a network error, check if we're actually back on the app
    const currentUrl = page.url();
    if (!currentUrl.includes('localhost:5173')) {
      throw error;
    }
    console.log('⚠️  Network change detected during redirect, but we are back on the app');
  }
  
  console.log('✅ Redirected back to app');
  
  // Wait for authentication to complete and page to stabilize
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
    console.log('⚠️  Network idle timeout, proceeding anyway');
  });
  
  // Verify we're logged in by checking menu shows connected state
  await page.getByRole('button', { name: 'Menu' }).click();
  const menuContent = await page.locator('[data-testid="unit-toggle"]').isVisible();
  
  if (!menuContent) {
    throw new Error('Authentication may have failed - menu not showing expected content');
  }
  
  console.log('💾 Saving authentication state...');
  
  // Save the authenticated state
  await page.context().storageState({ path: authFile });
  
  console.log(`✅ Authentication complete! Session saved to ${authFile}\n`);
  console.log('   You can now run authenticated tests with: npm run test:e2e\n');
});
