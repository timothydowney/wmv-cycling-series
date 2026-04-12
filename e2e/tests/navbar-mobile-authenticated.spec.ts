/**
 * Mobile Navbar Visibility Test
 *
 * Verifies the dropdown menu works well on mobile viewports.
 */

import { test, expect } from '@playwright/test';
import {
  getDropdownMenuMetrics,
  getDropdownScrollInfo,
  openAuthenticatedNavbarMenu,
  scrollDropdownMenuToBottom,
} from '../fixtures/test-helpers';

test.describe('Mobile Navbar Menu', () => {
  test('mobile menu should remain fully visible on taller phones', async ({ page }) => {
    const dropdownMenu = await openAuthenticatedNavbarMenu(page, {
      width: 390,
      height: 844,
    });

    await expect(dropdownMenu).toBeVisible();

    const { menuBottom, viewportSize } = await getDropdownMenuMetrics(page, dropdownMenu);
    expect(menuBottom).toBeLessThanOrEqual(viewportSize.height);

    await scrollDropdownMenuToBottom(dropdownMenu);

    const lastMenuItem = page.locator('.menu-item').last();
    await expect(lastMenuItem).toBeVisible();
  });

  test('small phone viewport (360px)', async ({ page }) => {
    const dropdownMenu = await openAuthenticatedNavbarMenu(page, {
      width: 360,
      height: 640,
    });

    const scrollInfo = await getDropdownScrollInfo(dropdownMenu);
    expect(scrollInfo.isScrollable).toBe(true);

    const { menuBottom, viewportSize } = await getDropdownMenuMetrics(page, dropdownMenu);
    expect(menuBottom).toBeLessThanOrEqual(viewportSize.height);

    await scrollDropdownMenuToBottom(dropdownMenu);
    await expect(page.locator('.menu-item').last()).toBeVisible();
  });
});
