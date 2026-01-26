import { test, expect } from '@playwright/test';
import {
  setupStravaInterception,
  setAuthCookie,
} from '../fixtures/test-helpers';

/**
 * WeeklyHeader Component UI Tests
 * 
 * Tests the WeeklyHeader component that displays week information including:
 * - Week name with Strava link
 * - Score multiplier badges (when applicable)
 * - Lap count, participant count, distance, elevation, grade
 * 
 * Uses Fall 2025 season for consistent test data.
 */

test.describe('WeeklyHeader Component', () => {
  test.beforeEach(async ({ page }) => {
    await setupStravaInterception(page);
    await setAuthCookie(page, '70001');
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');
    
    // Use Fall 2025 season for consistent test data
    await page.getByRole('combobox', { name: 'Season:' }).selectOption('Fall 2025 Zwift Hill Climb/Time Trial');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Score Multiplier Badges', () => {
    test('displays 2X badge on weeks with multiplier', async ({ page }) => {
      // Alpe du Zwift has 2X multiplier
      const badge = page.getByTestId('multiplier-badge');
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText('2X Pts');
    });

    test('does NOT display badge on weeks without multiplier', async ({ page }) => {
      await page.getByRole('link', { name: 'Schedule' }).click();
      await page.waitForLoadState('networkidle');

      // Count all multiplier badges - should only be 1 (Alpe du Zwift)
      const badges = page.getByTestId('multiplier-badge');
      await expect(badges).toHaveCount(1);
    });

    test('badge has correct WMV orange styling', async ({ page }) => {
      const badge = page.getByTestId('multiplier-badge');
      await expect(badge).toBeVisible();
      await expect(badge).toHaveCSS('background-color', 'rgb(245, 96, 4)');
      await expect(badge).toHaveCSS('color', 'rgb(255, 255, 255)');
    });
  });

  test.describe('Segment Details', () => {
    test('displays lap count', async ({ page }) => {
      await page.getByRole('link', { name: 'Schedule' }).click();
      await page.waitForLoadState('networkidle');

      // Check that lap counts appear
      const lapCounts = page.getByTestId('lap-count');
      await expect(lapCounts.first()).toBeVisible();
      
      // Verify we have multiple weeks showing lap counts
      await expect(lapCounts).not.toHaveCount(0);
    });

    test('displays participant count', async ({ page }) => {
      await page.getByRole('link', { name: 'Schedule' }).click();
      await page.waitForLoadState('networkidle');

      const participantCount = page.getByTestId('participant-count').first();
      await expect(participantCount).toBeVisible();
    });

    test('displays distance with units', async ({ page }) => {
      await page.getByRole('link', { name: 'Schedule' }).click();
      await page.waitForLoadState('networkidle');

      const distance = page.getByTestId('segment-distance-chip').first();
      await expect(distance).toBeVisible();
      await expect(distance).toContainText(/mi|km/);
    });

    test('displays elevation gain', async ({ page }) => {
      await page.getByRole('link', { name: 'Schedule' }).click();
      await page.waitForLoadState('networkidle');

      const elevation = page.getByTestId('segment-elevation-chip').first();
      await expect(elevation).toBeVisible();
      await expect(elevation).toContainText(/ft|m/);
    });

    test('displays average grade percentage', async ({ page }) => {
      await page.getByRole('link', { name: 'Schedule' }).click();
      await page.waitForLoadState('networkidle');

      const grade = page.getByTestId('segment-grade-chip').first();
      await expect(grade).toBeVisible();
      await expect(grade).toContainText('%');
    });
  });

  test.describe('Strava Integration', () => {
    test('week name links to Strava segment', async ({ page }) => {
      await page.getByRole('link', { name: 'Schedule' }).click();
      await page.waitForLoadState('networkidle');

      const segmentLink = page.getByRole('link', { name: /Box Hill KOM/ }).first();
      await expect(segmentLink).toHaveAttribute('href', /strava\.com\/segments/);
      await expect(segmentLink).toHaveAttribute('target', '_blank');
    });
  });
});
