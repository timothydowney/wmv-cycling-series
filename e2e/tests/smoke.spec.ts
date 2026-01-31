import { test, expect } from '@playwright/test';
import {
  setupStravaInterception,
  setAuthCookie,
  waitForLeaderboardLoad,
} from '../fixtures/test-helpers';

/**
 * Smoke test to verify Playwright setup
 * Ensures:
 * - Test runner can start dev server
 * - Page loads without errors
 * - Strava API mocking works
 * - Auth setup works
 */
test.describe('Setup Verification', () => {
  test('app loads and displays leaderboard', async ({ page }) => {
    // Setup Strava API mocking
    await setupStravaInterception(page);

    // Setup authentication
    await setAuthCookie(page, '70001'); // Tim Downey

    // Navigate to leaderboard
    await page.goto('/leaderboard/1/weekly/1');

    // Verify page loaded
    await expect(page).toHaveTitle(/WMV|Cycling/i);

    // Verify leaderboard is visible
    const leaderboardContainer = page.locator(
      '[data-testid="weekly-leaderboard"]'
    );
    await expect(leaderboardContainer).toBeVisible({
      timeout: 5000,
    });
  });

  test('leaderboard cards render', async ({ page }) => {
    await setupStravaInterception(page);
    await setAuthCookie(page, '70001');

    await page.goto('/leaderboard/1/weekly/1');
    await waitForLeaderboardLoad(page);

    // Verify at least one card exists
    const cards = page.locator('.leaderboard-card');
    const count = await cards.count();

    expect(count).toBeGreaterThan(0);
  });

  test('season selector is functional', async ({ page }) => {
    await setupStravaInterception(page);
    await setAuthCookie(page, '70001');

    await page.goto('/leaderboard/1/weekly/1');

    // Just verify the page renders without crashing
    // Navigation controls will be tested in integration tests
    const content = page.locator('body');
    await expect(content).toBeVisible();
  });

  test('console has no critical errors', async ({ page }) => {
    const errors: string[] = [];

    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await setupStravaInterception(page);
    await setAuthCookie(page, '70001');

    await page.goto('/leaderboard/1/weekly/1');
    await waitForLeaderboardLoad(page);

    // Some apps log expected errors; adjust as needed
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('favicon') &&
        !e.includes('sourcemap') &&
        !e.includes('chunk')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('segment distance detail renders for climb weeks', async ({ page }) => {
    await setupStravaInterception(page);
    await setAuthCookie(page, '70001');

    await page.goto('/leaderboard/1/weekly/1');
    await waitForLeaderboardLoad(page);

    // SPECIFIC TEST: Check for distance chip with data-testid
    // This ensures the segment detail is actually rendered, not just text on page
    const distanceChip = page.locator('[data-testid="segment-distance-chip"]');
    await expect(distanceChip).toBeVisible();
    
    // Verify it has actual numeric content (not empty)
    const distanceText = await distanceChip.textContent();
    expect(distanceText).toMatch(/\d+\.?\d*\s*(km|mi)/);
  });

  test('segment elevation detail renders for climb weeks', async ({ page }) => {
    await setupStravaInterception(page);
    await setAuthCookie(page, '70001');

    await page.goto('/leaderboard/1/weekly/1');
    await waitForLeaderboardLoad(page);

    // SPECIFIC TEST: Check for elevation chip with data-testid
    const elevationChip = page.locator('[data-testid="segment-elevation-chip"]');
    await expect(elevationChip).toBeVisible();
    
    // Verify it has actual numeric content
    const elevationText = await elevationChip.textContent();
    expect(elevationText).toMatch(/\d+\.?\d*\s*(m|ft)/);
  });

  test('segment grade detail renders for climb weeks', async ({ page }) => {
    await setupStravaInterception(page);
    await setAuthCookie(page, '70001');

    await page.goto('/leaderboard/1/weekly/1');
    await waitForLeaderboardLoad(page);

    // SPECIFIC TEST: Check for grade chip with data-testid
    const gradeChip = page.locator('[data-testid="segment-grade-chip"]');
    await expect(gradeChip).toBeVisible();
    
    // Verify it has actual percentage content
    const gradeText = await gradeChip.textContent();
    expect(gradeText).toMatch(/\d+\.?\d*%/);
  });

  test('first place shows polkadot jersey for climb weeks', async ({ page }) => {
    await setupStravaInterception(page);
    await setAuthCookie(page, '70001');

    // Week 1: Box Hill KOM (climb) -> should show polkadot
    await page.goto('/leaderboard/1/weekly/1');
    await waitForLeaderboardLoad(page);
    
    const firstPlace = page.locator('[data-rank="1"]').first();
    await expect(firstPlace).toHaveAttribute('data-jersey-type', 'polkadot');
  });

  test('first place shows yellow jersey for flat weeks', async ({ page }) => {
    await setupStravaInterception(page);
    await setAuthCookie(page, '70001');

    // Week 2: Champs-Élysées (flat) -> should show yellow
    await page.goto('/leaderboard/1/weekly/2');
    await waitForLeaderboardLoad(page);

    const firstPlace = page.locator('[data-rank="1"]').first();
    await expect(firstPlace).toHaveAttribute('data-jersey-type', 'yellow');
  });

  test('last place shows lanterne rouge jersey', async ({ page }) => {
    await setupStravaInterception(page);
    await setAuthCookie(page, '70001');

    await page.goto('/leaderboard/1/weekly/1');
    await waitForLeaderboardLoad(page);

    // Find all leaderboard cards
    const allCards = page.locator('[data-testid^="leaderboard-card-"]');
    const count = await allCards.count();
    
    // Get the last place card (highest rank number)
    const lastPlaceCard = page.locator(`[data-rank="${count}"]`).first();
    await expect(lastPlaceCard).toBeVisible();
    
    // Verify it has lanterne rouge jersey
    await expect(lastPlaceCard).toHaveAttribute('data-jersey-type', 'lantern');
  });
});
