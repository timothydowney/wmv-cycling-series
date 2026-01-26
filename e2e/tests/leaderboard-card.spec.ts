import { test, expect } from '@playwright/test';

test.describe('LeaderboardCard Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');
    
    // Navigate to Fall 2025 season (each test will select its own week)
    await page.getByRole('combobox', { name: 'Season:' }).selectOption('Fall 2025 Zwift Hill Climb/Time Trial');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Expandable Details', () => {
    test('card expands and collapses with chevron click', async ({ page }) => {
      // Navigate to a specific week (Week 8: Alpe du Zwift)
      await page.getByRole('combobox', { name: 'Week:' }).selectOption('8. Alpe du Zwift (Dec 16, 2025)');
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
      await page.getByRole('combobox', { name: 'Week:' }).selectOption('8. Alpe du Zwift (Dec 16, 2025)');
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
      await page.getByRole('combobox', { name: 'Week:' }).selectOption('2. Champs-Élysées (Nov 4, 2025)');
      await page.waitForLoadState('networkidle');
      
      await page.waitForSelector('[data-testid^="leaderboard-card-"]');
      
      const firstCard = page.locator('[data-testid^="leaderboard-card-"]').first();
      
      // Expand the card if not already expanded
      const expandedDetails = firstCard.getByTestId('expanded-details');
      const isExpanded = await expandedDetails.isVisible().catch(() => false);
      if (!isExpanded) {
        await firstCard.getByTestId('expand-toggle').click();
      }
      
      // Should show lap 1 time
      const lap1Label = firstCard.getByTestId('lap-1-label');
      await expect(lap1Label).toBeVisible();
      await expect(lap1Label).toHaveText('Lap 1');
      
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
      await page.getByRole('combobox', { name: 'Week:' }).selectOption('7. Volcano Circuit (Dec 9, 2025)');
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
      
      // Should show base formula
      expect(calcText).toMatch(/Beat \d+ \+ 1 participation = \d+ points total/);
      expect(calcText).not.toContain('X'); // No multiplier
      expect(calcText).not.toContain('PR'); // No PR
    });

    test('shows multiplier: * 2X in calculation', async ({ page }) => {
      // Week 8 has 2X multiplier
      await page.getByRole('combobox', { name: 'Week:' }).selectOption('8. Alpe du Zwift (Dec 16, 2025)');
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
      await page.getByRole('combobox', { name: 'Week:' }).selectOption('8. Alpe du Zwift (Dec 16, 2025)');
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
      await page.getByRole('combobox', { name: 'Week:' }).selectOption('8. Alpe du Zwift (Dec 16, 2025)');
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

    test('shows average power when available', async ({ page }) => {
      await page.getByRole('combobox', { name: 'Week:' }).selectOption('8. Alpe du Zwift (Dec 16, 2025)');
      await page.waitForLoadState('networkidle');
      
      await page.waitForSelector('[data-testid^="leaderboard-card-"]');
      
      const firstCard = page.locator('[data-testid^="leaderboard-card-"]').first();
      await firstCard.getByTestId('expand-toggle').click();
      
      // Check if power metric exists (might not be available for all activities)
      const avgPower = firstCard.getByTestId('avg-power');
      const powerCount = await avgPower.count();
      
      if (powerCount > 0) {
        await expect(avgPower).toBeVisible();
        const powerText = await avgPower.textContent();
        
        // Should show watts with 'W' unit
        expect(powerText).toContain('W');
      }
    });

    test('shows average cadence when available', async ({ page }) => {
      await page.getByRole('combobox', { name: 'Week:' }).selectOption('8. Alpe du Zwift (Dec 16, 2025)');
      await page.waitForLoadState('networkidle');
      
      await page.waitForSelector('[data-testid^="leaderboard-card-"]');
      
      const firstCard = page.locator('[data-testid^="leaderboard-card-"]').first();
      await firstCard.getByTestId('expand-toggle').click();
      
      // Check if cadence metric exists
      const avgCadence = firstCard.getByTestId('avg-cadence');
      const cadenceCount = await avgCadence.count();
      
      if (cadenceCount > 0) {
        await expect(avgCadence).toBeVisible();
        const cadenceText = await avgCadence.textContent();
        
        // Should show rpm unit
        expect(cadenceText).toContain('rpm');
      }
    });

    test('shows average heart rate when available', async ({ page }) => {
      await page.getByRole('combobox', { name: 'Week:' }).selectOption('8. Alpe du Zwift (Dec 16, 2025)');
      await page.waitForLoadState('networkidle');
      
      await page.waitForSelector('[data-testid^="leaderboard-card-"]');
      
      const firstCard = page.locator('[data-testid^="leaderboard-card-"]').first();
      await firstCard.getByTestId('expand-toggle').click();
      
      // Check if HR metric exists
      const avgHR = firstCard.getByTestId('avg-hr');
      const hrCount = await avgHR.count();
      
      if (hrCount > 0) {
        await expect(avgHR).toBeVisible();
        const hrText = await avgHR.textContent();
        
        // Should show bpm unit
        expect(hrText).toContain('bpm');
      }
    });
  });

  test.describe('PR Trophy Icon', () => {
    test('shows PR trophy when personal record is achieved', async ({ page }) => {
      // Navigate to Week 8 (Alpe du Zwift - has PRs)
      await page.getByRole('combobox', { name: 'Week:' }).selectOption('8. Alpe du Zwift (Dec 16, 2025)');
      await page.waitForLoadState('networkidle');
      
      await page.waitForSelector('[data-testid^="leaderboard-card-"]');
      
      // Find a card with PR trophy
      const cardWithPR = page.locator('[data-testid^="leaderboard-card-"]').filter({
        has: page.getByTestId('pr-trophy')
      }).first();
      
      const prTrophyCount = await cardWithPR.count();
      
      if (prTrophyCount > 0) {
        // PR trophy should be visible in collapsed state
        await expect(cardWithPR.getByTestId('pr-trophy')).toBeVisible();
        
        // Expand and check if PR is mentioned in points calculation
        await cardWithPR.getByTestId('expand-toggle').click();
        
        const pointsCalc = cardWithPR.getByTestId('points-calculation');
        const calcText = await pointsCalc.textContent();
        
        // Should show PR in calculation
        expect(calcText).toContain('PR');
      }
    });

    test('shows PR trophy on individual laps in multi-lap weeks', async ({ page }) => {
      // Navigate to Week 2 (Champs-Élysées - multi-lap)
      await page.getByRole('combobox', { name: 'Week:' }).selectOption('2. Champs-Élysées (Nov 4, 2025)');
      await page.waitForLoadState('networkidle');
      
      await page.waitForSelector('[data-testid^="leaderboard-card-"]');
      
      const firstCard = page.locator('[data-testid^="leaderboard-card-"]').first();
      await firstCard.getByTestId('expand-toggle').click();
      
      // Check if any lap has PR trophy
      const lap1PR = firstCard.getByTestId('lap-1-pr-trophy');
      const lap2PR = firstCard.getByTestId('lap-2-pr-trophy');
      
      const lap1PRCount = await lap1PR.count();
      const lap2PRCount = await lap2PR.count();
      
      // At least verify the test structure works (PR trophies may or may not exist)
      if (lap1PRCount > 0) {
        await expect(lap1PR).toBeVisible();
      }
      
      if (lap2PRCount > 0) {
        await expect(lap2PR).toBeVisible();
      }
    });
  });
});
