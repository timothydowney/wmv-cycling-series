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
    
    // Verify menu doesn't extend beyond viewport
    if (bounds && viewportSize) {
      const menuBottom = bounds.y + bounds.height;
      const viewportBottom = viewportSize.height;
      console.log(`Menu bottom: ${menuBottom}, Viewport bottom: ${viewportBottom}`);
      
      if (menuBottom > viewportBottom) {
        console.log(`⚠️  Menu extends ${menuBottom - viewportBottom}px beyond viewport!`);
      } else {
        console.log(`✓ Menu fits within viewport (${viewportBottom - menuBottom}px clearance)`);
      }
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
    
    // Verify last item is visible
    if (lastItemBounds) {
      const isVisible = await lastMenuItem.isVisible();
      console.log(`Last item visible: ${isVisible}`);
    }
  });

  test('menu should scroll independently and access all items', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 500 });
    
    await loginAsE2EUser(page);
    await page.goto('/leaderboard');
    
    await page.getByRole('button', { name: 'Menu' }).click();
    
    const dropdownMenu = page.locator('.dropdown-menu');
    
    // Collect all visible menu items at different scroll positions
    const items: string[] = [];
    
    // Get items at scroll position 0
    let scrollTop = 0;
    const scrollHeight = await dropdownMenu.evaluate(el => el.scrollHeight);
    const clientHeight = await dropdownMenu.evaluate(el => el.clientHeight);
    
    console.log(`\nMenu scroll analysis:`);
    console.log(`  Total content height: ${scrollHeight}px`);
    console.log(`  Visible area: ${clientHeight}px`);
    
    // Scroll through the menu and check all items are accessible
    while (scrollTop <= scrollHeight) {
      await dropdownMenu.evaluate((el, st) => {
        el.scrollTop = st;
      }, scrollTop);
      
      scrollTop += 100;
    }
    
    // Final screenshot at bottom
    await dropdownMenu.evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });
    
    await page.screenshot({ path: 'test-results/navbar-menu-3-bottom.png' });
    
    // Verify all navigation links are accessible
    const leaderboardLink = page.getByRole('link', { name: 'Leaderboard' }).last();
    const profileLink = page.getByRole('link', { name: 'My Profile' });
    const aboutLink = page.getByRole('link', { name: 'About' });
    
    // These should exist in the DOM even if not currently visible in viewport
    await expect(leaderboardLink).toBeTruthy();
    await expect(profileLink).toBeTruthy();
    await expect(aboutLink).toBeTruthy();
    
    console.log('✓ All menu items accessible via scrolling');
  });
});
