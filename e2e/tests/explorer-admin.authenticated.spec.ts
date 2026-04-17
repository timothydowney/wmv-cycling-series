import { test, expect, type Page } from '@playwright/test';
import { loginAsE2EUser } from '../fixtures/test-helpers';

async function selectFirstSeason(page: Page) {
  const seasonSelect = page.getByTestId('season-select');
  await expect(seasonSelect).toBeVisible();

  const firstSeasonValue = await seasonSelect.locator('option').first().getAttribute('value');
  expect(firstSeasonValue).not.toBeNull();

  await seasonSelect.selectOption(firstSeasonValue!);
}

async function ensureCampaignExists(page: Page) {
  if (await page.getByTestId('explorer-create-campaign-form').isVisible()) {
    await page.getByTestId('explorer-create-campaign-button').click();
  }

  await expect(page.getByTestId('explorer-campaign-summary-card')).toBeVisible();
}

test.describe('Explorer Admin Setup', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsE2EUser(page);
  });

  test('admin can open Explorer admin from the navbar menu', async ({ page }) => {
    await page.goto('/leaderboard');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.locator('.dropdown-menu').getByRole('link', { name: 'Manage Explorer' }).click();

    await expect(page).toHaveURL(/\/explorer-admin/);
    await expect(page.getByTestId('explorer-admin-panel')).toBeVisible();
  });

  test('admin can create a campaign and add a destination', async ({ page }) => {
    await page.goto('/explorer-admin');

    await selectFirstSeason(page);

    await expect(page.getByTestId('explorer-create-campaign-form')).toBeVisible();

    await page.getByTestId('explorer-display-name-input').fill('Fall 2025 Explorer');
    await page.getByTestId('explorer-rules-blurb-input').fill('Ride each featured segment once.');
    await page.getByTestId('explorer-create-campaign-button').click();

    await expect(page.getByTestId('explorer-admin-message')).toContainText('Explorer campaign created');
    await expect(page.getByTestId('explorer-campaign-name')).toContainText('Fall 2025 Explorer');

    await page.getByTestId('explorer-source-url-input').fill('https://www.strava.com/segments/2234642');
    await page.getByTestId('explorer-display-label-input').fill('Box Hill opener');
    await page.getByTestId('explorer-add-destination-button').click();

    await expect(page.getByTestId('explorer-admin-message')).toContainText('Destination added');
    await expect(page.getByTestId('explorer-destination-list')).toContainText('Box Hill opener');
    await expect(page.getByTestId('explorer-destination-list')).toContainText('Segment 2234642');
  });

  test('admin sees invalid URL and duplicate destination states', async ({ page }) => {
    await page.goto('/explorer-admin');

    await selectFirstSeason(page);

    await ensureCampaignExists(page);

    await page.getByTestId('explorer-source-url-input').fill('https://www.strava.com/routes/2234642');
    await page.getByTestId('explorer-add-destination-button').click();
    await expect(page.getByTestId('explorer-admin-message')).toContainText('valid Strava segment URL');

    await page.getByTestId('explorer-source-url-input').fill('https://www.strava.com/segments/12345');
    await page.getByTestId('explorer-add-destination-button').click();
    await expect(page.getByTestId('explorer-admin-message')).toContainText('Destination added');

    await page.getByTestId('explorer-source-url-input').fill('https://www.strava.com/segments/12345');
    await page.getByTestId('explorer-add-destination-button').click();
    await expect(page.getByTestId('explorer-admin-message')).toContainText('already exists');
  });
});