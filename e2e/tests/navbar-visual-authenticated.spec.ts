/**
 * Navbar Menu Viewport Coverage
 *
 * Verifies the dropdown stays within the viewport and that the full menu
 * remains reachable when internal scrolling is needed.
 */

import { test, expect } from '@playwright/test';
import {
  getDropdownMenuMetrics,
  openAuthenticatedNavbarMenu,
  scrollDropdownMenuToBottom,
} from '../fixtures/test-helpers';

test.describe('Navbar Menu Viewport Coverage', () => {
  test('keeps the dropdown menu inside the viewport', async ({ page }) => {
    const dropdownMenu = await openAuthenticatedNavbarMenu(page, {
      width: 1024,
      height: 600,
    });

    await expect(dropdownMenu).toBeVisible();

    const { menuBottom, viewportSize } = await getDropdownMenuMetrics(page, dropdownMenu);
    expect(menuBottom).toBeLessThanOrEqual(viewportSize.height);

    await scrollDropdownMenuToBottom(dropdownMenu);

    const lastMenuItem = page.locator('.menu-item').last();
    await expect(lastMenuItem).toBeVisible();
  });

  test('keeps navigation items reachable after scrolling', async ({ page }) => {
    const dropdownMenu = await openAuthenticatedNavbarMenu(page, {
      width: 1024,
      height: 500,
    });

    const scrollHeight = await dropdownMenu.evaluate((element) => element.scrollHeight);
    const clientHeight = await dropdownMenu.evaluate((element) => element.clientHeight);
    expect(scrollHeight).toBeGreaterThan(clientHeight);

    await scrollDropdownMenuToBottom(dropdownMenu);

    const dropdownLeaderboardLink = dropdownMenu.getByRole('link', { name: 'Leaderboard' });
    const dropdownProfileLink = dropdownMenu.getByRole('link', { name: 'My Profile' });
    const dropdownAboutLink = dropdownMenu.getByRole('link', { name: 'About' });

    await expect(dropdownLeaderboardLink).toHaveCount(1);
    await expect(dropdownProfileLink).toHaveCount(1);
    await expect(dropdownAboutLink).toHaveCount(1);

    await expect(page.locator('.menu-item').last()).toBeVisible();
  });
});
