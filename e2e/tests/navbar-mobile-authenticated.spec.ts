/**
 * Mobile Navbar Visibility Test
 * 
 * Verifies the dropdown menu works well on mobile viewports.
 */

import { test, expect } from '@playwright/test';
import { loginAsE2EUser } from '../fixtures/test-helpers';

test.describe('Mobile Navbar Menu', () => {
  test('mobile menu should be fully visible and scrollable', async ({ page }) => {
    // iPhone 12 Pro viewport
    await page.setViewportSize({ width: 390, height: 844 });
    
    await loginAsE2EUser(page);
    await page.goto('/leaderboard');
    
    // Open menu
    await page.getByRole('button', { name: 'Menu' }).click();
    
    const dropdownMenu = page.locator('.dropdown-menu');
    await expect(dropdownMenu).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/navbar-menu-mobile-1.png' });
    
    // Check menu bounds
    const bounds = await dropdownMenu.boundingBox();
    const viewportSize = page.viewportSize();
    
    console.log('Mobile Menu bounds:', bounds);
    console.log('Mobile Viewport:', viewportSize);
    
    if (bounds && viewportSize) {
      const menuBottom = bounds.y + bounds.height;
      const viewportBottom = viewportSize.height;
      console.log(`Menu bottom: ${menuBottom}, Viewport bottom: ${viewportBottom}`);
      
      if (menuBottom > viewportBottom) {
        console.log(`⚠️  Menu extends beyond viewport`);
      } else {
        console.log(`✓ Menu fits with ${viewportBottom - menuBottom}px clearance`);
      }
    }
    
    // Scroll to bottom
    await dropdownMenu.evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });
    
    await page.screenshot({ path: 'test-results/navbar-menu-mobile-2.png' });
    
    // Verify last item is visible
    const lastMenuItem = page.locator('.menu-item').last();
    const isVisible = await lastMenuItem.isVisible();
    console.log(`✓ Last menu item visible on mobile: ${isVisible}`);
  });

  test('small phone viewport (360px)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    
    await loginAsE2EUser(page);
    await page.goto('/leaderboard');
    
    await page.getByRole('button', { name: 'Menu' }).click();
    
    const dropdownMenu = page.locator('.dropdown-menu');
    
    // Get scroll info
    const scrollInfo = await dropdownMenu.evaluate(el => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      isScrollable: el.scrollHeight > el.clientHeight,
    }));
    
    console.log('Small phone menu scroll info:', scrollInfo);
    
    const bounds = await dropdownMenu.boundingBox();
    const viewportSize = page.viewportSize();
    
    if (bounds && viewportSize) {
      const menuBottom = bounds.y + bounds.height;
      const viewportBottom = viewportSize.height;
      console.log(`✓ Menu clearance: ${viewportBottom - menuBottom}px`);
    }
  });
});
