/**
 * Example Authenticated Test
 * 
 * This test runs with a logged-in user session.
 * 
 * Prerequisites:
 * 1. Run `npm run test:e2e:auth` to authenticate and save session
 * 2. Session state will be loaded from e2e/.auth/user.json
 * 
 * Tests in this file should verify features only available to logged-in users.
 */

import { test, expect } from '@playwright/test';

test.describe('Authenticated User Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/leaderboard');
    await page.getByRole('button', { name: 'Menu' }).click();
  });

  test('menu shows user name and connected status', async ({ page }) => {
    // Should show "Connected to Strava"
    const connectedText = page.getByText('Connected to Strava');
    await expect(connectedText).toBeVisible();
    
    // Should NOT see "Not connected to Strava"
    const notConnectedText = page.getByText('Not connected to Strava');
    await expect(notConnectedText).not.toBeVisible();
  });

  test('menu shows all navigation links for logged-in user', async ({ page }) => {
    // Core navigation - use .last() to get the menu links specifically
    await expect(page.getByRole('link', { name: 'Leaderboard' }).last()).toBeVisible();
    await expect(page.getByRole('link', { name: 'My Profile' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'About' })).toBeVisible();
  });

  test('menu shows admin links for authorized users', async ({ page }) => {
    // Admin navigation (may or may not be visible depending on user permissions)
    const manageCompetition = page.getByRole('link', { name: 'Manage Competition' });
    const manageSeasons = page.getByRole('link', { name: 'Manage Seasons' });
    const participantStatus = page.getByRole('link', { name: 'Participant Status' });
    const manageWebhooks = page.getByRole('link', { name: 'Manage Webhooks' });
    
    // Just verify they exist in the DOM (visibility depends on permissions)
    const adminLinksCount = await Promise.all([
      manageCompetition.count(),
      manageSeasons.count(),
      participantStatus.count(),
      manageWebhooks.count(),
    ]);
    
    // All admin links should exist (count > 0 means they're in the menu)
    expect(adminLinksCount.every(count => count > 0)).toBeTruthy();
  });

  test('menu shows disconnect from Strava button', async ({ page }) => {
    const disconnectButton = page.getByRole('button', { name: 'Disconnect from Strava' });
    await expect(disconnectButton).toBeVisible();
  });

  test('menu shows unit toggle', async ({ page }) => {
    const unitToggle = page.getByTestId('unit-toggle');
    await expect(unitToggle).toBeVisible();
  });

  test('does not show Strava connect banner when logged in', async ({ page }) => {
    // Menu is already open from beforeEach, close it by clicking outside or pressing Escape
    await page.keyboard.press('Escape');
    
    // Banner should not appear for logged-in users
    const banner = page.getByTestId('strava-connect-banner');
    await expect(banner).not.toBeVisible();
  });

  test('navigation links work correctly', async ({ page }) => {
    // Test My Profile link
    await page.getByRole('link', { name: 'My Profile' }).click();
    await expect(page).toHaveURL(/\/profile/);
    
    // Go back and test another link
    await page.goto('/leaderboard');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about/);
  });
});

test.describe('Authenticated User - Leaderboard Highlighting', () => {
  test('current user card is highlighted on season leaderboard', async ({ page }) => {
    // Navigate to Fall 2025 season leaderboard
    await page.goto('/leaderboard');
    await page.getByTestId('season-select').selectOption('1'); // Fall 2025
    await page.getByRole('link', { name: 'Season' }).click();
    
    // Find the current user's card (Tim Downey, athlete ID 366880)
    const currentUserCard = page.getByTestId('season-card-366880');
    await expect(currentUserCard).toBeVisible();
    
    // Verify it has the current-user class (which applies orange highlighting)
    await expect(currentUserCard).toHaveClass(/current-user/);
  });

  test('current user card is highlighted on weekly leaderboard', async ({ page }) => {
    // Navigate to Fall 2025 Week 1 (Box Hill)
    await page.goto('/leaderboard');
    await page.getByTestId('season-select').selectOption('1'); // Fall 2025
    
    // Wait for week selector to be visible
    await page.waitForSelector('[data-testid="timeline-week-selector"]');
    await page.waitForLoadState('networkidle');
    
    // Select Week 1 (first item in timeline)
    await page.locator('[data-testid^="timeline-item-"]').first().click();
    
    // Find the current user's card
    const currentUserCard = page.locator('.leaderboard-card.current-user').first();
    await expect(currentUserCard).toBeVisible();
    
    // Verify it has the current-user class (which applies orange highlighting)
    await expect(currentUserCard).toHaveClass(/current-user/);
    
    // Verify the name is visible
    await expect(currentUserCard.getByText('Tim Downey')).toBeVisible();
  });
});
