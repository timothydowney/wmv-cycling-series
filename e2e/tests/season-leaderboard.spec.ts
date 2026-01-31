import { test, expect } from '@playwright/test';

test.describe('Season Leaderboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');
    
    // Navigate to Fall 2025 season
    await page.getByTestId('season-select').selectOption('1');
    await page.waitForLoadState('networkidle');
    
    // Navigate to Season tab
    await page.getByRole('link', { name: 'Season' }).click();
    await page.waitForLoadState('networkidle');
  });

  test.describe('Jersey Awards', () => {
    test('first place rider has yellow jersey', async ({ page }) => {
      // Wait for season cards to load
      await page.waitForSelector('[data-testid^="season-card-"]');
      
      // Find the rank 1 card
      const firstPlaceCard = page.locator('[data-testid^="season-card-"]').first();
      
      // Verify it's rank 1
      await expect(firstPlaceCard.getByTestId('rank')).toHaveText('1');
      
      // Should have yellow jersey
      const yellowJersey = firstPlaceCard.getByTestId('jersey-yellow');
      await expect(yellowJersey).toBeVisible();
    });

    test('polkadot jersey goes to KOM leader (Carson Poe, rank 3)', async ({ page }) => {
      await page.waitForSelector('[data-testid^="season-card-"]');
      
      // Carson Poe is rank 3 and has polkadot jersey in Fall 2025
      const carsonCard = page.locator('[data-testid^="season-card-"]').filter({
        has: page.locator('text=Carson Poe')
      }).first();
      
      // Should have polkadot jersey
      const polkadotJersey = carsonCard.getByTestId('jersey-polkadot');
      await expect(polkadotJersey).toBeVisible();
      
      // Verify rank is 3
      await expect(carsonCard.getByTestId('rank')).toHaveText('3');
    });

    test('last place rider has lanterne rouge jersey', async ({ page }) => {
      await page.waitForSelector('[data-testid^="season-card-"]');
      
      // Get all cards and find the last one
      const allCards = page.locator('[data-testid^="season-card-"]');
      const lastCard = allCards.last();
      
      // Should have lanterne rouge jersey (jersey type is 'lantern')
      const lanterneRouge = lastCard.getByTestId('jersey-lantern');
      await expect(lanterneRouge).toBeVisible();
    });
  });

  test.describe('Rider Details', () => {
    test('each rider shows weeks completed badge', async ({ page }) => {
      await page.waitForSelector('[data-testid^="season-card-"]');
      
      const firstCard = page.locator('[data-testid^="season-card-"]').first();
      
      // Weeks badge should be visible
      const weeksBadge = firstCard.getByTestId('weeks-completed');
      await expect(weeksBadge).toBeVisible();
      
      // Should show number and "wks" text
      const badgeText = await weeksBadge.textContent();
      expect(badgeText).toMatch(/\d+ wks/);
    });

    test('each rider shows total points', async ({ page }) => {
      await page.waitForSelector('[data-testid^="season-card-"]');
      
      const firstCard = page.locator('[data-testid^="season-card-"]').first();
      
      // Total points should be visible
      const totalPoints = firstCard.getByTestId('total-points');
      await expect(totalPoints).toBeVisible();
      
      // Should show number and "pts" text
      const pointsText = await totalPoints.textContent();
      expect(pointsText).toMatch(/\d+\s*pts/);
    });

    test('rank 1 rider has correct details (Jonathan O\'Keeffe: 65 pts, 8 wks)', async ({ page }) => {
      await page.waitForSelector('[data-testid^="season-card-"]');
      
      const firstCard = page.locator('[data-testid^="season-card-"]').first();
      
      // Verify name
      await expect(firstCard.locator('text=Jonathan O\'Keeffe')).toBeVisible();
      
      // Verify points (65 pts)
      const pointsText = await firstCard.getByTestId('total-points').textContent();
      expect(pointsText).toContain('65');
      
      // Verify weeks (8 wks)
      const weeksText = await firstCard.getByTestId('weeks-completed').textContent();
      expect(weeksText).toContain('8 wks');
    });

    test('rank 3 rider has correct details (Carson Poe: 46 pts, 4 wks, polkadot)', async ({ page }) => {
      await page.waitForSelector('[data-testid^="season-card-"]');
      
      const carsonCard = page.locator('[data-testid^="season-card-"]').filter({
        has: page.locator('text=Carson Poe')
      }).first();
      
      // Verify name
      await expect(carsonCard.locator('text=Carson Poe')).toBeVisible();
      
      // Verify points (46 pts)
      const pointsText = await carsonCard.getByTestId('total-points').textContent();
      expect(pointsText).toContain('46');
      
      // Verify weeks (4 wks)
      const weeksText = await carsonCard.getByTestId('weeks-completed').textContent();
      expect(weeksText).toContain('4 wks');
      
      // Verify polkadot jersey
      await expect(carsonCard.getByTestId('jersey-polkadot')).toBeVisible();
    });
  });

  test.describe('Leaderboard Structure', () => {
    test('displays all riders in rank order', async ({ page }) => {
      await page.waitForSelector('[data-testid^="season-card-"]');
      
      const allCards = page.locator('[data-testid^="season-card-"]');
      const cardCount = await allCards.count();
      
      // Should have multiple riders (at least 10 in Fall 2025)
      expect(cardCount).toBeGreaterThan(9);
      
      // First card should be rank 1
      await expect(allCards.first().getByTestId('rank')).toHaveText('1');
    });

    test('each card displays athlete profile picture', async ({ page }) => {
      await page.waitForSelector('[data-testid^="season-card-"]');
      
      const firstCard = page.locator('[data-testid^="season-card-"]').first();
      
      // Should have profile image (via StravaAthleteBadge component)
      const profileImage = firstCard.locator('img').first();
      await expect(profileImage).toBeVisible();
    });
  });
});
