import { test, expect, type Page } from '@playwright/test';
import { loginAsE2EUser } from '../fixtures/test-helpers';

interface CampaignDraft {
  name: string;
  startDate: string;
  endDate: string;
}

let campaignCounter = 0;

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function buildUniqueCampaignDraft(attempt: number): CampaignDraft {
  campaignCounter += 1;

  // Spread campaigns across years and retry windows to avoid overlap with persistent data.
  const year = 2040 + campaignCounter * 3 + attempt;
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 0, 31));

  return {
    name: `Explorer E2E ${toIsoDate(start)} #${campaignCounter}`,
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

async function createCampaign(page: Page, rulesBlurb?: string): Promise<CampaignDraft> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const draft = buildUniqueCampaignDraft(attempt);

    await page.getByTestId('explorer-display-name-input').fill(draft.name);
    await page.getByTestId('explorer-start-date-input').fill(draft.startDate);
    await page.getByTestId('explorer-end-date-input').fill(draft.endDate);
    if (rulesBlurb) {
      await page.getByTestId('explorer-rules-blurb-input').fill(rulesBlurb);
    }
    await page.getByTestId('explorer-create-campaign-button').click();

    const adminMessage = page.getByTestId('explorer-admin-message');
    await expect(adminMessage).toBeVisible();
    const message = (await adminMessage.textContent()) || '';

    if (message.includes('Explorer campaign created')) {
      return draft;
    }

    if (!message.includes('cannot overlap')) {
      throw new Error(`Unexpected explorer campaign create response: ${message}`);
    }
  }

  throw new Error('Unable to create a non-overlapping explorer campaign after 8 attempts.');
}

async function ensureCampaignExists(page: Page) {
  await createCampaign(page);

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

    await createCampaign(page, 'Ride each featured segment once.');

    await expect(page.getByTestId('explorer-campaign-stack')).toBeVisible();

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