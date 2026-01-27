import { test, expect } from '@playwright/test';

test.describe('Schedule Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');
    
    // Navigate to Fall 2025 season
    await page.getByRole('combobox', { name: 'Season:' }).selectOption('Fall 2025 Zwift Hill Climb/Time Trial');
    await page.waitForLoadState('networkidle');
    
    // Navigate to Schedule tab
    await page.getByRole('link', { name: 'Schedule' }).click();
    await page.waitForLoadState('networkidle');
  });

  test.describe('VeloViewer Segment Profile Embed', () => {
    test('displays VeloViewer embed when week is expanded', async ({ page }) => {
      // Click the first week to expand it
      const firstWeek = page.locator('.schedule-card-wrapper').first();
      await firstWeek.click();
      
      // Check if the VeloViewer embed is present
      const veloviewerEmbed = page.getByTestId('veloviewer-embed');
      await expect(veloviewerEmbed).toBeVisible();
      
      // Verify it's an iframe with VeloViewer source
      const iframeSrc = await veloviewerEmbed.getAttribute('src');
      expect(iframeSrc).toContain('veloviewer.com/segments');
    });

    test('VeloViewer embed can be toggled via Segment Profile button', async ({ page }) => {
      // Click the first week to expand it
      const firstWeek = page.locator('.schedule-card-wrapper').first();
      await firstWeek.click();
      
      // Find the segment profile toggle button
      const toggleButton = page.getByTestId('segment-profile-toggle').first();
      await expect(toggleButton).toBeVisible();
      
      // Embed should be visible initially (defaultExpanded=true in schedule)
      const veloviewerEmbed = page.getByTestId('veloviewer-embed').first();
      await expect(veloviewerEmbed).toBeVisible();
      
      // Click to collapse
      await toggleButton.click();
      await expect(veloviewerEmbed).not.toBeVisible();
      
      // Click again to expand
      await toggleButton.click();
      await expect(veloviewerEmbed).toBeVisible();
    });

    test('VeloViewer embed respects unit preferences', async ({ page }) => {
      // Click the first week to expand it
      const firstWeek = page.locator('.schedule-card-wrapper').first();
      await firstWeek.click();
      
      // Get the embed iframe
      const veloviewerEmbed = page.getByTestId('veloviewer-embed').first();
      await expect(veloviewerEmbed).toBeVisible();
      
      // Check default units (imperial)
      let iframeSrc = await veloviewerEmbed.getAttribute('src');
      expect(iframeSrc).toContain('units=i'); // imperial
      
      // Toggle to metric
      await page.getByRole('button', { name: 'Menu' }).click();
      await page.getByTestId('unit-toggle').click();
      
      // Close menu and wait for iframe to reload
      await page.keyboard.press('Escape');
      await page.waitForLoadState('networkidle');
      
      // Check units changed to metric
      iframeSrc = await veloviewerEmbed.getAttribute('src');
      expect(iframeSrc).toContain('units=m'); // metric
    });
  });
});
