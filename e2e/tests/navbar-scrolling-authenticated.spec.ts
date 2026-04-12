/**
 * Navbar Scrolling Test
 *
 * Verifies that the dropdown menu is scrollable when many items are present.
 */

import { test, expect } from '@playwright/test';
import {
  getDropdownScrollInfo,
  openAuthenticatedNavbarMenu,
} from '../fixtures/test-helpers';

test.describe('Navbar Dropdown Scrolling', () => {
  test('dropdown menu should be scrollable on large screens', async ({ page }) => {
    const dropdownMenu = await openAuthenticatedNavbarMenu(page, {
      width: 1280,
      height: 600,
    });

    await expect(dropdownMenu).toBeVisible();

    const maxHeight = await dropdownMenu.evaluate((element) =>
      window.getComputedStyle(element).maxHeight
    );
    const overflowY = await dropdownMenu.evaluate((element) =>
      window.getComputedStyle(element).overflowY
    );

    // Verify max-height is set so the dropdown remains constrained within the viewport.
    expect(maxHeight).not.toBe('none');
    expect(overflowY).toBe('auto');
  });

  test('dropdown menu should have scroll capability if content overflows', async ({ page }) => {
    const dropdownMenu = await openAuthenticatedNavbarMenu(page, {
      width: 1024,
      height: 500,
    });

    const scrollInfo = await getDropdownScrollInfo(dropdownMenu);
    expect(scrollInfo.isScrollable).toBe(true);

    await dropdownMenu.evaluate((element) => {
      element.scrollTop = 50;
    });

    const scrollTop = await dropdownMenu.evaluate((element) => element.scrollTop);
    expect(scrollTop).toBe(50);
  });

  test('dropdown menu should remain scrollable on mobile viewports', async ({ page }) => {
    const dropdownMenu = await openAuthenticatedNavbarMenu(page, {
      width: 375,
      height: 812,
    });

    const overflowY = await dropdownMenu.evaluate((element) =>
      window.getComputedStyle(element).overflowY
    );

    expect(overflowY).toBe('auto');
  });
});
