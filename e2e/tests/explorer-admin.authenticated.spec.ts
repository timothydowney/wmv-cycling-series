import { test, expect, type Page } from '@playwright/test';
import { loginAsE2EUser } from '../fixtures/test-helpers';

async function ensureCampaignExists(page: Page) {
  if (await page.getByTestId('explorer-campaign-stack').count() === 0) {
    await page.getByTestId('explorer-display-name-input').fill('Fall 2025 Explorer');
    await page.getByTestId('explorer-start-date-input').fill('2025-10-01');
    await page.getByTestId('explorer-end-date-input').fill('2025-10-31');
    await page.getByTestId('explorer-create-campaign-button').click();
  }

  await expect(page.getByTestId('explorer-campaign-stack')).toBeVisible();
}

async function ensureDestinationExists(page: Page, sourceUrl: string) {
  if (await page.getByTestId('explorer-destination-list').count() > 0) {
    return;
  }

  await page.getByTestId('explorer-source-url-input').fill(sourceUrl);
  await page.getByTestId('explorer-source-url-input').blur();
  await expect(page.getByTestId('explorer-destination-preview-card')).toBeVisible();
  await page.getByTestId('explorer-accept-preview-button').click();
  await expect(page.getByTestId('explorer-admin-message')).toContainText('Destination added');
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

    await expect(page.getByTestId('explorer-create-campaign-form')).toBeVisible();

    await page.getByTestId('explorer-display-name-input').fill('Fall 2025 Explorer');
    await page.getByTestId('explorer-start-date-input').fill('2025-10-01');
    await page.getByTestId('explorer-end-date-input').fill('2025-10-31');
    await page.getByTestId('explorer-rules-blurb-input').fill('Ride each featured segment once.');
    await page.getByTestId('explorer-create-campaign-button').click();

    await expect(page.getByTestId('explorer-admin-message')).toContainText('Explorer campaign created');
    await expect(page.getByTestId('explorer-campaign-stack').getByText('Fall 2025 Explorer').first()).toBeVisible();

    await page.getByTestId('explorer-source-url-input').fill('https://www.strava.com/segments/2234642');
    await page.getByTestId('explorer-source-url-input').blur();

    await expect(page.getByTestId('explorer-destination-preview-card')).toContainText('Box Hill KOM');
    await page.getByTestId('explorer-accept-preview-button').click();

    await expect(page.getByTestId('explorer-admin-message')).toContainText('Destination added');
    await expect(page.getByTestId('explorer-destination-list')).toContainText('Box Hill KOM');
    await expect(page.getByTestId('explorer-destination-list')).toContainText('Dorking, Surrey, United Kingdom');
    await expect(page.getByRole('link', { name: 'Box Hill KOM' }).first()).toBeVisible();
  });

  test('admin sees invalid URL and duplicate destination states', async ({ page }) => {
    await page.goto('/explorer-admin');

    await ensureCampaignExists(page);

    await page.getByTestId('explorer-source-url-input').fill('https://www.strava.com/routes/2234642');
    await page.getByTestId('explorer-source-url-input').blur();
    await expect(page.getByTestId('explorer-preview-error')).toContainText('valid Strava segment URL');

    await page.getByTestId('explorer-source-url-input').fill('https://www.strava.com/segments/12345');
    await page.getByTestId('explorer-source-url-input').blur();
    await page.getByTestId('explorer-accept-preview-button').click();
    await expect(page.getByTestId('explorer-admin-message')).toContainText('Destination added');

    await page.getByTestId('explorer-source-url-input').fill('https://www.strava.com/segments/12345');
    await page.getByTestId('explorer-source-url-input').blur();
    await page.getByTestId('explorer-accept-preview-button').click();
    await expect(page.getByTestId('explorer-admin-message')).toContainText('already exists');
  });

  test('admin can delete a destination with confirmation', async ({ page }) => {
    await page.goto('/explorer-admin');

    await ensureCampaignExists(page);
    await ensureDestinationExists(page, 'https://www.strava.com/segments/2234642');

    const deleteButton = page.locator('[data-testid^="explorer-delete-destination-button-"]').first();
    const deleteLabel = await deleteButton.getAttribute('aria-label');
    const destinationLabel = deleteLabel?.replace(/^Delete\s+/, '') ?? 'destination';

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain(`Remove ${destinationLabel} from this Explorer campaign?`);
      await dialog.accept();
    });

    await deleteButton.click();
    await expect(page.getByTestId('explorer-admin-message')).toContainText('Destination removed');
  });
});