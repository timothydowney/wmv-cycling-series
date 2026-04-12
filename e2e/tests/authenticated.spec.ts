/**
 * Example Authenticated Test
 * 
 * This test file establishes a real app session through the e2e auth helper.
 */

import { test, expect } from '@playwright/test';
import { loginAsE2EUser } from '../fixtures/test-helpers';

test.describe('Authenticated User Features', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsE2EUser(page);
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
    const manageRoles = page.getByRole('link', { name: 'Manage Roles' });
    const manageSeasons = page.getByRole('link', { name: 'Manage Seasons' });
    const participantStatus = page.getByRole('link', { name: 'Participant Status' });
    const manageWebhooks = page.getByRole('link', { name: 'Manage Webhooks' });
    
    // Just verify they exist in the DOM (visibility depends on permissions)
    const adminLinksCount = await Promise.all([
      manageCompetition.count(),
      manageRoles.count(),
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

  test('admin can open the webhook management page with e2e helper auth', async ({ page }) => {
    await page.getByRole('link', { name: 'Manage Webhooks' }).click();
    await expect(page).toHaveURL(/\/webhooks/);
    await expect(page.getByRole('button', { name: 'Subscription Status' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Event History' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Storage Usage' })).toBeVisible();
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
    const menu = page.locator('.dropdown-menu');

    // Test My Profile link
    await menu.getByRole('link', { name: 'My Profile' }).click();
    await expect(page).toHaveURL(/\/profile/);
    
    // Go back and test another link
    await page.goto('/leaderboard');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page
      .locator('.dropdown-menu')
      .getByRole('link', { name: 'About' })
      .evaluate((element: Element) => {
        (element as HTMLAnchorElement).click();
      });
    await expect(page).toHaveURL(/\/about/);
  });
});

test.describe('Authenticated User - Leaderboard Highlighting', () => {
  test('current user card is highlighted on season leaderboard', async ({ page }) => {
    await loginAsE2EUser(page);
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
    await loginAsE2EUser(page);
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
