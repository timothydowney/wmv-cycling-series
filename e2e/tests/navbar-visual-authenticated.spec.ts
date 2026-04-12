/**
 * Visual Test: Navbar Menu Visibility
 * 
 * Captures screenshots to verify the dropdown menu doesn't get cut off
 * and that all items are visible with scrolling.
 */

import { test, expect } from '@playwright/test';
import { loginAsE2EUser } from '../fixtures/test-helpers';

test.describe('Navbar Menu Visual Testing', () => {
  test('should not cut off menu items - visual verification', async ({ page }) => {
    // Small viewport to trigger scrolling
    await page.setViewportSize({ width: 1024, height: 600 });
    
    await loginAsE2EUser(page);
    await page.goto('/leaderboard');
    
    // Open menu
    await page.getByRole('button', { name: 'Menu' }).click();
    
    const dropdownMenu = page.locator('.dropdown-menu');
    await expect(dropdownMenu).toBeVisible();
    
    // Take screenshot of full menu
    await page.screenshot({ path: 'test-results/navbar-menu-1-initial.png' });
    
    // Get menu bounds
    const bounds = await dropdownMenu.boundingBox();
    console.log('Menu initial bounds:', bounds);
    
    // Get viewport size
    const viewportSize = page.viewportSize();
    console.log('Viewport:', viewportSize);
    
    expect(bounds).not.toBeNull();
    expect(viewportSize).not.toBeNull();
    if (bounds && viewportSize) {
      const menuBottom = bounds.y + bounds.height;
      const viewportBottom = viewportSize.height;
      console.log(`Menu bottom: ${menuBottom}, Viewport bottom: ${viewportBottom}`);
      expect(menuBottom).toBeLessThanOrEqual(viewportBottom);
    }
    
    // Scroll the menu to bottom
    await dropdownMenu.evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });
    
    await page.screenshot({ path: 'test-results/navbar-menu-2-scrolled.png' });
    
    // Get the last menu item
    const lastMenuItem = page.locator('.menu-item').last();
    const lastItemBounds = await lastMenuItem.boundingBox();
    console.log('Last menu item bounds:', lastItemBounds);
    
    expect(lastItemBounds).not.toBeNull();
    await expect(lastMenuItem).toBeVisible();
  });

  test('menu should scroll independently and access all items', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 500 });
    
    await loginAsE2EUser(page);
    await page.goto('/leaderboard');
    
    await page.getByRole('button', { name: 'Menu' }).click();
    
    const dropdownMenu = page.locator('.dropdown-menu');
    
    const scrollHeight = await dropdownMenu.evaluate(el => el.scrollHeight);
    const clientHeight = await dropdownMenu.evaluate(el => el.clientHeight);
    
    console.log(`\nMenu scroll analysis:`);
    console.log(`  Total content height: ${scrollHeight}px`);
    console.log(`  Visible area: ${clientHeight}px`);
    
    expect(scrollHeight).toBeGreaterThan(clientHeight);
    
    // Final screenshot at bottom
    await dropdownMenu.evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });
    
    await page.screenshot({ path: 'test-results/navbar-menu-3-bottom.png' });
    
    // Verify all navigation links are accessible
    const leaderboardLink = dropdownMenu.getByRole('link', { name: 'Leaderboard' });
    const profileLink = dropdownMenu.getByRole('link', { name: 'My Profile' });
    const aboutLink = dropdownMenu.getByRole('link', { name: 'About' });
    
    // These should exist in the DOM even if not currently visible in viewport
    await expect(leaderboardLink).toHaveCount(1);
    await expect(profileLink).toHaveCount(1);
    await expect(aboutLink).toHaveCount(1);
    
    console.log('✓ All menu items accessible via scrolling');
  });
});
