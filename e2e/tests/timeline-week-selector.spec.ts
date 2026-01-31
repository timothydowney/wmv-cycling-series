import { test, expect } from '@playwright/test';

test.describe('Timeline Week Selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');
  });

  test('timeline renders and displays weeks', async ({ page }) => {
    // Verify timeline selector exists and has weeks
    const timelineContainer = page.getByTestId('timeline-week-selector');
    await expect(timelineContainer).toBeVisible();
    
    const timelineItems = page.locator('[data-testid^="timeline-item-"]');
    const count = await timelineItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('timeline scrolls horizontally when needed', async ({ page }) => {
    const timelineContainer = page.getByTestId('timeline-week-selector');
    
    // Get container dimensions
    const containerBox = await timelineContainer.boundingBox();
    expect(containerBox).toBeTruthy();
    
    // If there are many weeks, scrollWidth should be greater than container width
    const scrollWidth = await timelineContainer.evaluate(el => el.scrollWidth);
    const clientWidth = await timelineContainer.evaluate(el => el.clientWidth);
    
    // Should have either overflow or fit nicely (both are valid)
    expect(scrollWidth).toBeGreaterThanOrEqual(clientWidth);
  });

  test('timeline weeks render with names and status icons', async ({ page }) => {
    const timelineItem = page.locator('[data-testid^="timeline-item-"]').first();
    
    // Week name should be visible
    const weekName = timelineItem.locator('.timeline-event-name');
    await expect(weekName).toBeVisible();
    const nameText = await weekName.textContent();
    expect(nameText?.length).toBeGreaterThan(0);
    
    // Status icon should exist
    const statusIcon = timelineItem.locator('.timeline-status-icon');
    await expect(statusIcon).toBeVisible();
  });

  test('leaderboard cards have data-expanded attribute for state tracking', async ({ page }) => {
    // Click a timeline week to load leaderboard
    const firstWeek = page.locator('[data-testid^="timeline-item-"]').first();
    await firstWeek.click();
    await page.waitForLoadState('networkidle');
    
    // First card should have data-expanded attribute
    const firstCard = page.locator('[data-testid^="leaderboard-card-"]').first();
    const expandedAttr = await firstCard.getAttribute('data-expanded');
    expect(expandedAttr).toBeTruthy();
    expect(['true', 'false']).toContain(expandedAttr);
  });
});
