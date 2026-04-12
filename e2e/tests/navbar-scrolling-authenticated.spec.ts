/**
 * Navbar Scrolling Test
 * 
 * Verifies that the dropdown menu is scrollable when many items are present.
 */

import { test, expect } from '@playwright/test';
import { loginAsE2EUser } from '../fixtures/test-helpers';

test.describe('Navbar Dropdown Scrolling', () => {
  test('dropdown menu should be scrollable on large screens', async ({ page }) => {
    // Set a tall viewport to simulate a smaller display where menu might overflow
    await page.setViewportSize({ width: 1280, height: 600 });
    
    // Login and navigate
    await loginAsE2EUser(page);
    await page.goto('/leaderboard');
    
    // Open the menu
    await page.getByRole('button', { name: 'Menu' }).click();
    
    // Get the dropdown menu
    const dropdownMenu = page.locator('.dropdown-menu');
    
    // Verify it exists and is visible
    await expect(dropdownMenu).toBeVisible();
    
    // Check that it has the scrolling styles applied
    const maxHeight = await dropdownMenu.evaluate(el => 
      window.getComputedStyle(el).maxHeight
    );
    const overflowY = await dropdownMenu.evaluate(el => 
      window.getComputedStyle(el).overflowY
    );
    
    // Verify max-height is set (should be calc(100vh - 80px) = something like "600px" or similar)
    expect(maxHeight).not.toBe('none');
    console.log(`Max-height: ${maxHeight}`);
    
    // Verify overflow-y is auto for scrolling
    expect(overflowY).toBe('auto');
    console.log(`Overflow-Y: ${overflowY}`);
  });

  test('dropdown menu should have scroll capability if content overflows', async ({ page }) => {
    // Use a smaller viewport to increase likelihood of overflow
    await page.setViewportSize({ width: 1024, height: 500 });
    
    // Login as admin to see all menu items
    await loginAsE2EUser(page);
    await page.goto('/leaderboard');
    
    // Open the menu
    await page.getByRole('button', { name: 'Menu' }).click();
    
    // Get the dropdown menu
    const dropdownMenu = page.locator('.dropdown-menu');
    
    // Get scroll info
    const scrollInfo = await dropdownMenu.evaluate(el => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      isScrollable: el.scrollHeight > el.clientHeight,
    }));
    
    console.log(`Menu scroll info: ${JSON.stringify(scrollInfo)}`);
    
    // For admin users with many menu items, verify scrollability
    if (scrollInfo.isScrollable) {
      console.log('✓ Menu is scrollable (overflow detected)');
      
      // Try to scroll and verify it works
      await dropdownMenu.evaluate(el => {
        el.scrollTop = 50;
      });
      
      const scrollTop = await dropdownMenu.evaluate(el => el.scrollTop);
      expect(scrollTop).toBe(50);
      console.log('✓ Menu scroll worked');
    } else {
      console.log('✓ Menu fits in viewport (no scroll needed)');
    }
  });

  test('dropdown menu should remain scrollable on mobile viewports', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    
    await loginAsE2EUser(page);
    await page.goto('/leaderboard');
    
    // Open the menu
    await page.getByRole('button', { name: 'Menu' }).click();
    
    // Get the dropdown menu
    const dropdownMenu = page.locator('.dropdown-menu');
    
    // Verify scrolling is enabled
    const overflowY = await dropdownMenu.evaluate(el => 
      window.getComputedStyle(el).overflowY
    );
    
    expect(overflowY).toBe('auto');
    console.log('✓ Mobile menu has overflow-y: auto');
  });
});
