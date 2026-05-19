import { expect, test, type Page } from '@playwright/test';
import { loginAsE2EUser } from '../fixtures/test-helpers';

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function buildActiveCampaignDraft(): { name: string; startDate: string; endDate: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 2));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30));
  const uniqueSuffix = Date.now().toString().slice(-6);

  return {
    name: `Explorer Club E2E ${toIsoDate(start)} #${uniqueSuffix}`,
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

async function ensureActiveCampaignWithDestination(page: Page): Promise<void> {
  await page.goto('/explorer-admin');
  const createCampaignForm = page.locator('[data-testid="explorer-create-campaign-form"]:visible').first();
  await expect(createCampaignForm).toBeVisible();

  const draft = buildActiveCampaignDraft();

  await createCampaignForm.getByTestId('explorer-display-name-input').fill(draft.name);
  await createCampaignForm.getByTestId('explorer-start-date-input').fill(draft.startDate);
  await createCampaignForm.getByTestId('explorer-end-date-input').fill(draft.endDate);
  await createCampaignForm.getByTestId('explorer-create-campaign-button').click();

  const adminMessage = page.getByTestId('explorer-admin-message');
  await expect(adminMessage).toBeVisible();
  const campaignMessage = (await adminMessage.textContent()) || '';

  if (!campaignMessage.includes('Explorer campaign created') && !campaignMessage.includes('cannot overlap')) {
    throw new Error(`Unexpected campaign create response: ${campaignMessage}`);
  }

  const addDestinationCard = page.locator('[data-testid="explorer-add-destination-card"]:visible').first();
  await expect(addDestinationCard).toBeVisible();

  await addDestinationCard.getByTestId('explorer-source-url-input').fill('https://www.strava.com/segments/2234642');
  await addDestinationCard.getByTestId('explorer-source-url-input').blur();

  await expect(addDestinationCard.getByTestId('explorer-destination-preview-card')).toBeVisible();
  await addDestinationCard.getByTestId('explorer-accept-preview-button').click();

  await expect(adminMessage).toContainText(/Destination added|already exists/);
  const destinationMessage = (await adminMessage.textContent()) || '';

  if (!destinationMessage.includes('Destination added') && !destinationMessage.includes('already exists')) {
    throw new Error(`Unexpected destination add response: ${destinationMessage}`);
  }
}

async function openExplorerClubTab(page: Page): Promise<void> {
  await page.goto('/explorer');
  await expect(page.getByTestId('explorer-hub-page')).toBeVisible();
  await expect(page.getByTestId('explorer-hub-hero')).toBeVisible();

  await page.getByTestId('explorer-tab-club').click();
  await expect(page.getByTestId('explorer-club-view')).toBeVisible();
}

test.describe('Explorer Club Tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsE2EUser(page);
    await ensureActiveCampaignWithDestination(page);
  });

  test('supports navigation between Hub, Club, and Destinations tabs', async ({ page }) => {
    await openExplorerClubTab(page);

    await expect(page.getByTestId('explorer-club-popular-section')).toBeVisible();
    await expect(page.getByTestId('explorer-club-recent-firsts-section')).toBeVisible();
    await expect(page.getByTestId('explorer-club-least-popular-section')).toBeVisible();

    await page.getByTestId('explorer-tab-destinations').click();
    await expect(page.getByTestId('explorer-destinations-view')).toBeVisible();

    await page.getByTestId('explorer-tab-hub').click();
    await expect(page.getByTestId('explorer-progress-card')).toBeVisible();
  });

  test('renders club popularity and first-completion sections with loaded data states', async ({ page }) => {
    await openExplorerClubTab(page);

    await expect(page.getByTestId('explorer-club-popular-section')).toContainText('Top 5 popular destinations');
    await expect(page.getByTestId('explorer-club-recent-firsts-section')).toContainText('Most recent first completions');
    await expect(page.getByTestId('explorer-club-least-popular-section')).toContainText('Bottom 5 least-popular destinations');

    const popularCards = page.locator('[data-testid^="explorer-club-popular-card-"]');
    const leastCards = page.locator('[data-testid^="explorer-club-least-card-"]');
    const recentFirstCards = page.locator('[data-testid^="explorer-club-recent-first-card-"]');

    if ((await popularCards.count()) > 0) {
      await expect(popularCards.first()).toBeVisible();
    } else {
      await expect(page.getByTestId('explorer-club-popular-empty')).toBeVisible();
    }

    if ((await leastCards.count()) > 0) {
      await expect(leastCards.first()).toBeVisible();
    } else {
      await expect(page.getByTestId('explorer-club-least-empty')).toBeVisible();
    }

    if ((await recentFirstCards.count()) > 0) {
      await expect(recentFirstCards.first()).toBeVisible();
    } else {
      await expect(page.getByTestId('explorer-club-recent-firsts-empty')).toBeVisible();
    }
  });
});
