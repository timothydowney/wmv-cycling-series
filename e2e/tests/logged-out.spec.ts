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

    test('shows banner heading', async ({ page }) => {
      const heading = page.getByTestId('banner-heading');
      await expect(heading).toBeVisible();
    });

    test('shows banner description', async ({ page }) => {
      const description = page.getByTestId('banner-description');
      await expect(description).toBeVisible();
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
      await page.getByTestId('season-select').selectOption('1');
      await page.waitForLoadState('networkidle');
      
      // Check Weekly view - use exact: true to avoid matching navbar title
      await page.getByRole('link', { name: 'Weekly', exact: true }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('strava-connect-banner')).toBeVisible();
      
      // Check Season view - use exact: true to avoid navbar ambiguity
      await page.getByRole('link', { name: 'Season', exact: true }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('strava-connect-banner')).toBeVisible();
      
      // Check Schedule view - use exact: true to avoid navbar ambiguity
      await page.getByRole('link', { name: 'Schedule', exact: true }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('strava-connect-banner')).toBeVisible();
    });
  });

  test.describe('Public Navigation', () => {
    test('shows About in the menu without login', async ({ page }) => {
      await page.getByRole('button', { name: 'Menu' }).click();
      await expect(page.getByRole('link', { name: 'About' })).toBeVisible();
    });

    test('allows visiting About without login', async ({ page }) => {
      await page.getByRole('button', { name: 'Menu' }).click();
      await page.getByRole('link', { name: 'About' }).click();
      await expect(page).toHaveURL(/\/about/);
      await expect(page.getByRole('heading', { name: 'WMV Cycling Series' })).toBeVisible();
    });
  });
});
