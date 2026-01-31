import { test, expect } from '@playwright/test';

test.describe('LeaderboardCard Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');
    
    // Navigate to Fall 2025 season (each test will select its own week)
    await page.getByTestId('season-select').selectOption('1');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Expandable Details', () => {
    test('card expands and collapses with chevron click', async ({ page }) => {
      // Navigate to a specific week (Week 8: Alpe du Zwift)
      await page.locator('[data-testid^="timeline-item-"]').filter({ hasText: 'Alpe du Zwift' }).click();
      await page.waitForLoadState('networkidle');
      
      // Wait for leaderboard to load
      await page.waitForSelector('[data-testid^="leaderboard-card-"]');
      
      // Find first leaderboard card
      const firstCard = page.locator('[data-testid^="leaderboard-card-"]').first();
      const expandedDetails = firstCard.getByTestId('expanded-details');
      
      // Check initial state (might be expanded or collapsed)
      const initiallyVisible = await expandedDetails.isVisible().catch(() => false);
      
      // Click chevron to toggle
      await firstCard.getByTestId('expand-toggle').click();
      
      // State should have changed
      if (initiallyVisible) {
        await expect(expandedDetails).not.toBeVisible();
      } else {
        await expect(expandedDetails).toBeVisible();
      }
      
      // Click again to toggle back
      await firstCard.getByTestId('expand-toggle').click();
      
      // Should be back to initial state
      if (initiallyVisible) {
        await expect(expandedDetails).toBeVisible();
      } else {
        await expect(expandedDetails).not.toBeVisible();
      }
    });
  });

  test.describe('Time Display', () => {
    test('shows total time in single-lap week', async ({ page }) => {
      // Navigate to Week 8 (Alpe du Zwift - single lap)
      await page.locator('.timeline-item').filter({ hasText: 'Alpe du Zwift' }).click();
      await page.waitForLoadState('networkidle');
      
      await page.waitForSelector('[data-testid^="leaderboard-card-"]');
      
      const firstCard = page.locator('[data-testid^="leaderboard-card-"]').first();
      
      // Expand the card if not already expanded
      const expandedDetails = firstCard.getByTestId('expanded-details');
      const isExpanded = await expandedDetails.isVisible().catch(() => false);
      if (!isExpanded) {
        await firstCard.getByTestId('expand-toggle').click();
      }
      
      // Should show total time
      const totalTime = firstCard.getByTestId('total-time');
      await expect(totalTime).toBeVisible();
      
      // Should match time format HH:MM:SS or MM:SS
      const timeText = await totalTime.textContent();
      expect(timeText).toMatch(/^\d{1,2}:\d{2}(:\d{2})?$/);
    });

    test('shows per-lap times in multi-lap week', async ({ page }) => {
      // Navigate to Week 2 (Champs-Élysées - two laps)
      await page.locator('[data-testid^="timeline-item-"]').filter({ hasText: 'Champs-Élysées' }).click();
      await page.waitForLoadState('networkidle');
      
      await page.waitForSelector('[data-testid^="leaderboard-card-"]');
      
      const firstCard = page.locator('[data-testid^="leaderboard-card-"]').first();
      
      // Check if already expanded (first card should be expanded by default)
      const isExpanded = await firstCard.evaluate(el => el.getAttribute('data-expanded') === 'true');
      if (!isExpanded) {
        await firstCard.click();
      }
      
      // Wait for lap details to appear
      await expect(firstCard.getByTestId('lap-1-label')).toBeVisible({ timeout: 2000 });
      await expect(firstCard.getByTestId('lap-1-label')).toHaveText('Lap 1');
      
      const lap1Time = firstCard.getByTestId('lap-1-time');
      await expect(lap1Time).toBeVisible();
      
      // Should show lap 2 time
      const lap2Label = firstCard.getByTestId('lap-2-label');
      await expect(lap2Label).toBeVisible();
      await expect(lap2Label).toHaveText('Lap 2');
      
      const lap2Time = firstCard.getByTestId('lap-2-time');
      await expect(lap2Time).toBeVisible();
      
      // Should show total time
      const totalTime = firstCard.getByTestId('total-time');
      await expect(totalTime).toBeVisible();
    });
  });

  test.describe('Points Calculation', () => {
    test('shows base calculation: Beat X + 1 participation = Y points total', async ({ page }) => {
      // Week 7 has no multiplier, rank 1 has no PR
      await page.locator('[data-testid^="timeline-item-"]').filter({ hasText: 'Volcano Circuit' }).click();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid^="leaderboard-card-"]');
      
      const firstCard = page.locator('[data-testid^="leaderboard-card-"]').first();
      
      // Check if already expanded (first card should be expanded by default)
      const isExpanded = await firstCard.evaluate(el => el.getAttribute('data-expanded') === 'true');
      if (!isExpanded) {
        await firstCard.click();
      }
      
      // Wait for points calculation to appear
      const pointsCalc = firstCard.getByTestId('points-calculation');
      await expect(pointsCalc).toBeVisible({ timeout: 2000 });
      const calcText = await pointsCalc.textContent();
      
      // Should show base formula
      expect(calcText).toMatch(/Beat \d+ \+ 1 participation = \d+ points total/);
      expect(calcText).not.toContain('X'); // No multiplier
      expect(calcText).not.toContain('PR'); // No PR
    });

    test('shows multiplier: * 2X in calculation', async ({ page }) => {
      // Week 8 has 2X multiplier
      await page.locator('.timeline-item').filter({ hasText: 'Alpe du Zwift' }).click();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid^="leaderboard-card-"]');
      
      const firstCard = page.locator('[data-testid^="leaderboard-card-"]').first();
      const expandedDetails = firstCard.getByTestId('expanded-details');
      const isExpanded = await expandedDetails.isVisible().catch(() => false);
      if (!isExpanded) {
        await firstCard.getByTestId('expand-toggle').click();
      }
      
      const pointsCalc = firstCard.getByTestId('points-calculation');
      const calcText = await pointsCalc.textContent();
      expect(calcText).toContain('* 2X');
    });

    test('shows PR bonus: + 1 PR in calculation', async ({ page }) => {
      // Week 8 has PRs
      await page.locator('.timeline-item').filter({ hasText: 'Alpe du Zwift' }).click();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid^="leaderboard-card-"]');
      
      const cardWithPR = page.locator('[data-testid^="leaderboard-card-"]').filter({
        has: page.getByTestId('pr-trophy')
      }).first();
      
      const prCount = await cardWithPR.count();
      if (prCount > 0) {
        const expandedDetails = cardWithPR.getByTestId('expanded-details');
        const isExpanded = await expandedDetails.isVisible().catch(() => false);
        if (!isExpanded) {
          await cardWithPR.getByTestId('expand-toggle').click();
        }
        
        const pointsCalc = cardWithPR.getByTestId('points-calculation');
        const calcText = await pointsCalc.textContent();
        expect(calcText).toContain('+ 1 PR');
        expect(calcText).toContain('* 2X'); // Week 8 also has multiplier
      }
    });
  });

  test.describe('Performance Metrics', () => {
    test('shows performance metrics section', async ({ page }) => {
      await page.locator('.timeline-item').filter({ hasText: 'Alpe du Zwift' }).click();
      await page.waitForLoadState('networkidle');
      
      await page.waitForSelector('[data-testid^="leaderboard-card-"]');
      
      const firstCard = page.locator('[data-testid^="leaderboard-card-"]').first();
      
      // Expand the card if not already expanded
      const expandedDetails = firstCard.getByTestId('expanded-details');
      const isExpanded = await expandedDetails.isVisible().catch(() => false);
      if (!isExpanded) {
        await firstCard.getByTestId('expand-toggle').click();
      }
      
      // Performance section should be visible
      const perfSection = firstCard.getByTestId('performance-section');
      await expect(perfSection).toBeVisible();
    });

    test('shows average power when present in data', async ({ page }) => {
      await page.locator('.timeline-item').filter({ hasText: 'Alpe du Zwift' }).click();
      await page.waitForLoadState('networkidle');
      
      await page.waitForSelector('[data-testid^="leaderboard-card-"]');
      
      const firstCard = page.locator('[data-testid^="leaderboard-card-"]').first();
      
      // Expand if not already expanded
      const expandedDetails = firstCard.getByTestId('expanded-details');
      const isExpanded = await expandedDetails.isVisible().catch(() => false);
      if (!isExpanded) {
        await firstCard.getByTestId('expand-toggle').click();
      }
      
      // Power metric may or may not be present depending on device
      const avgPower = firstCard.getByTestId('avg-power');
      const powerCount = await avgPower.count();
      if (powerCount > 0) {
        await expect(avgPower).toContainText('W');
      }
    });

    test('shows average cadence when present in data', async ({ page }) => {
      await page.locator('.timeline-item').filter({ hasText: 'Alpe du Zwift' }).click();
      await page.waitForLoadState('networkidle');
      
      await page.waitForSelector('[data-testid^="leaderboard-card-"]');
      
      const firstCard = page.locator('[data-testid^="leaderboard-card-"]').first();
      await firstCard.getByTestId('expand-toggle').click();
      
      // Cadence metric may or may not be present
      const avgCadence = firstCard.getByTestId('avg-cadence');
      const cadenceCount = await avgCadence.count();
      if (cadenceCount > 0) {
        await expect(avgCadence).toContainText('rpm');
      }
    });

    test('shows average heart rate when present in data', async ({ page }) => {
      await page.locator('.timeline-item').filter({ hasText: 'Alpe du Zwift' }).click();
      await page.waitForLoadState('networkidle');
      
      await page.waitForSelector('[data-testid^="leaderboard-card-"]');
      
      const firstCard = page.locator('[data-testid^="leaderboard-card-"]').first();
      await firstCard.getByTestId('expand-toggle').click();
      
      // HR metric may or may not be present
      const avgHR = firstCard.getByTestId('avg-hr');
      const hrCount = await avgHR.count();
      if (hrCount > 0) {
        await expect(avgHR).toContainText('bpm');
      }
    });
  });

  test.describe('PR Trophy Icon', () => {
    test('shows PR trophy when personal record is achieved', async ({ page }) => {
      // Navigate to Week 8 (Alpe du Zwift - has PRs)
      await page.locator('.timeline-item').filter({ hasText: 'Alpe du Zwift' }).click();
      await page.waitForLoadState('networkidle');
      
      await page.waitForSelector('[data-testid^="leaderboard-card-"]');
      
      // Find a card with PR trophy
      const cardWithPR = page.locator('[data-testid^="leaderboard-card-"]').filter({
        has: page.getByTestId('pr-trophy')
      }).first();
      
      
      // PR trophy should be visible in collapsed state
      await expect(cardWithPR.getByTestId('pr-trophy')).toBeVisible();
      
      // Expand and check if PR is mentioned in points calculation
      await cardWithPR.getByTestId('expand-toggle').click();
      
      const pointsCalc = cardWithPR.getByTestId('points-calculation');
      await expect(pointsCalc).toContainText('PR');
    });

    test('multi-lap week shows lap times structure', async ({ page }) => {
      // Navigate to Week 2 (Champs-Élysées - multi-lap)
      await page.locator('[data-testid^="timeline-item-"]').filter({ hasText: 'Champs-Élysées' }).click();
      await page.waitForLoadState('networkidle');
      
      await page.waitForSelector('[data-testid^="leaderboard-card-"]');
      
      const firstCard = page.locator('[data-testid^="leaderboard-card-"]').first();
      
      // Check if already expanded (first card should be expanded by default)
      const isExpanded = await firstCard.evaluate(el => el.getAttribute('data-expanded') === 'true');
      if (!isExpanded) {
        await firstCard.click();
      }
      
      // Verify lap labels are rendered (structure test)
      await expect(firstCard.getByTestId('lap-1-label')).toBeVisible({ timeout: 2000 });
      await expect(firstCard.getByTestId('lap-2-label')).toBeVisible();
    });

    test('shows time difference indicator for repeat segment', async ({ page }) => {
      // Navigate to Winter 2026 season
      await page.goto('/leaderboard');
      await page.waitForLoadState('networkidle');
      
      // Wait for season selector to be visible and get current season info
      await page.waitForSelector('[data-testid="season-select"]');
      
      // Get all season options and find Winter 2026
      const seasonSelect = page.getByTestId('season-select');
      const options = await seasonSelect.locator('option').all();
      let winter2026Value = null;
      
      for (const option of options) {
        const text = await option.textContent();
        if (text?.includes('Winter 2026')) {
          winter2026Value = await option.getAttribute('value');
          break;
        }
      }
      
      if (!winter2026Value) {
        throw new Error('Winter 2026 season not found');
      }
      
      await seasonSelect.selectOption(winter2026Value);
      await page.waitForLoadState('networkidle');
      
      // Wait for timeline to update with new season's weeks
      await page.waitForSelector('[data-testid^="timeline-item-"]');
      
      // Navigate to Week 1 (same segment as Fall 2025 Week 1)
      await page.locator('[data-testid^="timeline-item-"]').nth(0).click();
      await page.waitForLoadState('networkidle');
      
      // Find Tim Downey's card
      const timCard = page.locator('[data-testid^="leaderboard-card-"]', { hasText: 'Tim Downey' }).first();
      await expect(timCard).toBeVisible();
      
      // Click expand toggle
      await timCard.getByTestId('expand-toggle').click();
      
      // Wait for expanded details to appear in DOM
      await page.waitForSelector('[data-testid="expanded-details"]');
      
      // Verify the ghost badge (time difference indicator) is present
      const ghostBadge = timCard.getByTestId('ghost-badge');
      await expect(ghostBadge).toBeVisible();
    });
  });
});
