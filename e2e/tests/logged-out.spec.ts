import { test, expect } from '@playwright/test';

test.describe('Logged Out User Experience', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies to ensure logged-out state
    await page.context().clearCookies();
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Strava Connect Banner', () => {
    test('displays connect banner for logged-out users', async ({ page }) => {
      // Wait for the banner to appear
      const banner = page.getByTestId('strava-connect-banner');
      await expect(banner).toBeVisible();
    });

    test('shows correct heading text', async ({ page }) => {
      const heading = page.getByTestId('banner-heading');
      await expect(heading).toBeVisible();
      await expect(heading).toContainText('Want to see your results?');
      await expect(heading).toContainText('Logged out?');
    });

    test('shows description text about signing in', async ({ page }) => {
      const description = page.getByTestId('banner-description');
      await expect(description).toBeVisible();
      await expect(description).toContainText('Sign in with your Strava account');
      await expect(description).toContainText('view your results on the leaderboard');
    });

    test('displays Connect with Strava button', async ({ page }) => {
      const connectButton = page.getByTestId('connect-with-strava-button');
      await expect(connectButton).toBeVisible();
      
      // Should have Strava image
      const stravaImage = connectButton.locator('img[alt="Connect with Strava"]');
      await expect(stravaImage).toBeVisible();
    });

    test('displays dismiss button', async ({ page }) => {
      const dismissButton = page.getByTestId('dismiss-banner-button');
      await expect(dismissButton).toBeVisible();
      await expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss');
    });

    test('banner can be dismissed', async ({ page }) => {
      const banner = page.getByTestId('strava-connect-banner');
      await expect(banner).toBeVisible();
      
      // Click dismiss button
      const dismissButton = page.getByTestId('dismiss-banner-button');
      await dismissButton.click();
      
      // Banner should disappear
      await expect(banner).not.toBeVisible();
    });

    test('banner appears on all leaderboard views when logged out', async ({ page }) => {
      // Navigate to Fall 2025
      await page.getByRole('combobox', { name: 'Season:' }).selectOption('Fall 2025 Zwift Hill Climb/Time Trial');
      await page.waitForLoadState('networkidle');
      
      // Check Weekly view
      await page.getByRole('link', { name: 'Weekly' }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('strava-connect-banner')).toBeVisible();
      
      // Check Season view
      await page.getByRole('link', { name: 'Season' }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('strava-connect-banner')).toBeVisible();
      
      // Check Schedule view
      await page.getByRole('link', { name: 'Schedule' }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('strava-connect-banner')).toBeVisible();
    });
  });
});
