import { test, expect } from '@playwright/test';

test.describe('Unit Preference Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/leaderboard');
    await page.waitForSelector('[data-testid="segment-distance-chip"]');
  });

  test('displays imperial units (mi, ft) by default', async ({ page }) => {
    const distanceChip = page.getByTestId('segment-distance-chip');
    const elevationChip = page.getByTestId('segment-elevation-chip');
    
    await expect(distanceChip).toContainText('mi');
    await expect(elevationChip).toContainText('ft');
  });

  test('toggle shows mi by default', async ({ page }) => {
    await page.getByRole('button', { name: 'Menu' }).click();
    const toggleButton = page.getByTestId('unit-toggle-button');
    await expect(toggleButton).toHaveText('mi');
  });

  test('clicking toggle switches to km and updates distance/elevation', async ({ page }) => {
    await page.getByRole('button', { name: 'Menu' }).click();
    const toggle = page.getByTestId('unit-toggle');
    const toggleButton = page.getByTestId('unit-toggle-button');
    const distanceChip = page.getByTestId('segment-distance-chip');
    const elevationChip = page.getByTestId('segment-elevation-chip');
    
    await expect(toggleButton).toHaveText('mi');
    await toggle.click();
    await expect(toggleButton).toHaveText('km');
    await expect(distanceChip).toContainText('km');
    await expect(elevationChip).toContainText('m');
  });

  test('clicking toggle twice returns to mi', async ({ page }) => {
    await page.getByRole('button', { name: 'Menu' }).click();
    const toggle = page.getByTestId('unit-toggle');
    const toggleButton = page.getByTestId('unit-toggle-button');
    const distanceChip = page.getByTestId('segment-distance-chip');
    
    await toggle.click();
    await expect(toggleButton).toHaveText('km');
    await expect(distanceChip).toContainText('km');
    
    await toggle.click();
    await expect(toggleButton).toHaveText('mi');
    await expect(distanceChip).toContainText('mi');
  });

  test('units update while menu is still open', async ({ page }) => {
    await page.getByRole('button', { name: 'Menu' }).click();
    const toggle = page.getByTestId('unit-toggle');
    const elevationChip = page.getByTestId('segment-elevation-chip');
    
    await expect(elevationChip).toContainText('ft');
    await toggle.click();
    await expect(elevationChip).toContainText('m');
    await toggle.click();
    await expect(elevationChip).toContainText('ft');
  });
});
