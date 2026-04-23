import { test, expect } from '@playwright/test';

test.describe('Logged Out User Experience', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies to ensure logged-out state
    await page.context().clearCookies();
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Signed Out Home', () => {
    test('displays the signed-out landing shell for logged-out users', async ({ page }) => {
      await expect(page.getByTestId('signed-out-home')).toBeVisible();
    });

    test('shows the signed-out heading', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Join Western Mass Velo with Strava' })).toBeVisible();
    });

    test('shows the signed-out description', async ({ page }) => {
      await expect(page.getByText('Use Connect with Strava to sign in or reconnect your account and get back into the WMV riding app.')).toBeVisible();
    });

    test('displays Connect with Strava button', async ({ page }) => {
      const connectButton = page.getByTestId('signed-out-connect-button');
      await expect(connectButton).toBeVisible();
      
      // Should have Strava image
      const stravaImage = connectButton.locator('img[alt="Connect with Strava"]');
      await expect(stravaImage).toBeVisible();
    });

    test('displays WMV website link', async ({ page }) => {
      await expect(page.getByRole('link', { name: 'Visit the WMV website' })).toBeVisible();
    });

    test('shows member sign-in chip', async ({ page }) => {
      await expect(page.getByText('Members sign-in')).toBeVisible();
    });

    test('direct leaderboard routes still land on the signed-out shell', async ({ page }) => {
      await page.goto('/leaderboard/1/weekly/1');
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('signed-out-home')).toBeVisible();

      await page.goto('/leaderboard/1/season');
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('signed-out-home')).toBeVisible();

      await page.goto('/leaderboard/1/schedule');
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('signed-out-home')).toBeVisible();
    });
  });

  test.describe('Public Navigation', () => {
    test('shows signed-out status and connect action in the menu without login', async ({ page }) => {
      await page.getByRole('button', { name: 'Menu' }).click();
      await expect(page.getByText('Not connected to Strava')).toBeVisible();
      await expect(page.getByRole('navigation').getByRole('button', { name: 'Connect with Strava' })).toBeVisible();
    });

    test('redirects anonymous about navigation back to the signed-out shell', async ({ page }) => {
      await page.goto('/about');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/about/);
      await expect(page.getByTestId('signed-out-home')).toBeVisible();
    });
  });
});
