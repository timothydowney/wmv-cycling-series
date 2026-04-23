import { getStravaApiMode } from '../config';
import { getActivity, type Activity as StravaActivity } from '../stravaClient';
import { MockStravaClient } from './MockStravaClient';

const fixtureClient = new MockStravaClient();

function usesDeterministicWebhookActivityProvider(): boolean {
  const mode = getStravaApiMode();
  return mode === 'fixture' || mode === 'mock-server';
}

function normalizeActivityId(activityId: string | number): number {
  const normalized = Number(activityId);

  if (!Number.isFinite(normalized)) {
    throw new Error(`Webhook activity fixtures require numeric activity IDs, received: ${activityId}`);
  }

  return normalized;
}

function tryNormalizeActivityId(activityId: string | number): number | null {
  const normalized = Number(activityId);

  return Number.isFinite(normalized) ? normalized : null;
}

function hasWebhookActivityFixture(activityId: string | number): boolean {
  const normalized = tryNormalizeActivityId(activityId);

  if (normalized === null) {
    return false;
  }

  return fixtureClient.getConfiguredActivityIds().includes(normalized);
}

async function fetchWebhookActivity(
  activityId: string,
  accessToken: string
): Promise<StravaActivity> {
  if (usesDeterministicWebhookActivityProvider() || hasWebhookActivityFixture(activityId)) {
    return fixtureClient.getActivity(accessToken || 'fixture-token', normalizeActivityId(activityId));
  }

  return getActivity(activityId, accessToken);
}

function seedWebhookActivityFixture(
  activityId: string | number,
  activity: Partial<StravaActivity>
): void {
  fixtureClient.setActivity(normalizeActivityId(activityId), activity);
}

function resetWebhookActivityFixtures(): void {
  fixtureClient.reset();
}

function removeWebhookActivityFixture(activityId: string | number): void {
  fixtureClient.removeActivity(normalizeActivityId(activityId));
}

function getWebhookActivityFixtureCallLog(): Array<{ method: string; args: any[] }> {
  return fixtureClient.getCallLog();
}

function getWebhookActivityFixtureIds(): number[] {
  return fixtureClient.getConfiguredActivityIds();
}

export {
  fetchWebhookActivity,
  getWebhookActivityFixtureCallLog,
  getWebhookActivityFixtureIds,
  hasWebhookActivityFixture,
  removeWebhookActivityFixture,
  resetWebhookActivityFixtures,
  seedWebhookActivityFixture,
  usesDeterministicWebhookActivityProvider,
};