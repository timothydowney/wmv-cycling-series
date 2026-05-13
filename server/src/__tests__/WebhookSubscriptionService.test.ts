import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Pool } from 'pg';
import type { AppDatabase } from '../db/types';
import { exec } from '../db/asyncQuery';
import * as asyncQuery from '../db/asyncQuery';
import { webhookSubscription } from '../db/schema';
import { WebhookSubscriptionService } from '../services/WebhookSubscriptionService';
import { setupTestDb, teardownTestDb } from './setupTestDb';

describe('asyncQuery.exec', () => {
  it('returns the query execute result and supports explicit typing', async () => {
    const query = {
      execute: jest.fn<() => Promise<{ changes?: number; rowCount: number }>>().mockResolvedValue({
        rowCount: 1,
      }),
    };

    const result = await exec<{ changes?: number; rowCount: number }>(query);

    expect(query.execute).toHaveBeenCalledTimes(1);
    expect(result.rowCount).toBe(1);
    expect(result.changes).toBeUndefined();
  });
});

describe('WebhookSubscriptionService DB compatibility', () => {
  let pool: Pool;
  let orm: AppDatabase;
  let service: WebhookSubscriptionService;
  let logSpy: ReturnType<typeof jest.spyOn>;
  const calculateExpiresAt = (value: string): string =>
    new Date(new Date(value).getTime() + 24 * 60 * 60 * 1000).toISOString();
  const getStoredRefreshTimestamp = async (testName: string): Promise<string> => {
    const [stored] = await orm
      .select({ last_refreshed_at: webhookSubscription.last_refreshed_at })
      .from(webhookSubscription)
      .limit(1);
    if (!stored?.last_refreshed_at) {
      throw new Error(`Expected stored last_refreshed_at for ${testName}`);
    }
    return stored.last_refreshed_at;
  };
  // Service renews around 22h age so subscriptions are refreshed before 24h expiry.
  const RENEWAL_THRESHOLD_MS = 22 * 60 * 60 * 1000;

  beforeEach(() => {
    const testDb = setupTestDb({ seed: false });
    pool = testDb.pool;
    orm = testDb.orm;
    service = new WebhookSubscriptionService(orm);
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    logSpy.mockRestore();
    jest.restoreAllMocks();
    await teardownTestDb(pool);
  });

  it('enable() recovers existing Strava subscription when DB row exists but changes count is unknown', async () => {
    await orm.insert(webhookSubscription).values({
      id: 1,
      verify_token: 'local-token',
      subscription_payload: JSON.stringify({
        id: 1,
        created_at: '2026-04-01T00:00:00.000Z',
        updated_at: '2026-04-01T00:00:00.000Z',
        callback_url: 'https://example.com/webhook',
        application_id: 123,
      }),
      subscription_id: null,
      last_refreshed_at: new Date().toISOString(),
    });

    jest.spyOn(asyncQuery, 'exec').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'fetchExistingFromStrava').mockResolvedValue({
      id: 42,
      created_at: '2026-04-02T00:00:00.000Z',
      updated_at: '2026-04-02T00:00:00.000Z',
      callback_url: 'https://example.com/webhook',
      application_id: 123,
    });

    await expect(service.enable()).resolves.toBeDefined();

    const updateLog = logSpy.mock.calls.find((call: unknown[]) =>
      typeof call[0] === 'string' && call[0].includes('updateSubscriptionInDb - Database operation complete:')
    );

    expect(updateLog?.[1]).toMatchObject({ changes: undefined, changesKnown: false });
  });

  it('enable() inserts recovered subscription when no DB row exists and handles unknown changes count', async () => {
    jest.spyOn(asyncQuery, 'exec').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'fetchExistingFromStrava').mockResolvedValue({
      id: 99,
      created_at: '2026-04-03T00:00:00.000Z',
      updated_at: '2026-04-03T00:00:00.000Z',
      callback_url: 'https://example.com/webhook',
      application_id: 123,
    });

    await expect(service.enable()).resolves.toBeDefined();

    const insertLog = logSpy.mock.calls.find((call: unknown[]) =>
      typeof call[0] === 'string' && call[0].includes('insertSubscriptionInDb - Database operation complete:')
    );

    expect(insertLog?.[1]).toMatchObject({ changes: undefined, changesKnown: false });
  });

  it('disable() removes local subscription even when delete changes count is unknown', async () => {
    await orm.insert(webhookSubscription).values({
      id: 1,
      verify_token: 'local-token',
      subscription_payload: JSON.stringify({
        id: 777,
        created_at: '2026-04-01T00:00:00.000Z',
        updated_at: '2026-04-01T00:00:00.000Z',
        callback_url: 'https://example.com/webhook',
        application_id: 123,
      }),
      subscription_id: null,
      last_refreshed_at: new Date().toISOString(),
    });

    jest.spyOn(asyncQuery, 'exec').mockResolvedValue(undefined);

    const status = await service.disable();

    expect(status.id).toBeNull();

    const deleteLog = logSpy.mock.calls.find((call: unknown[]) =>
      typeof call[0] === 'string' && call[0].includes('Database delete result:')
    );

    expect(deleteLog?.[1]).toMatchObject({ changes: undefined, changesKnown: false });
  });

  it('uses last_refreshed_at as renewal baseline for fresh subscriptions', async () => {
    const fixedNow = new Date('2026-05-13T12:00:00.000Z').getTime();
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    try {
      const refreshedAtIso = '2026-05-13T11:00:00.000Z';
      await orm.insert(webhookSubscription).values({
        id: 1,
        verify_token: 'local-token',
        subscription_payload: JSON.stringify({
          id: 101,
          created_at: '2026-05-10T00:00:00.000Z',
          updated_at: '2026-05-10T00:00:00.000Z',
          callback_url: 'https://example.com/webhook',
          application_id: 123,
        }),
        subscription_id: 101,
        last_refreshed_at: refreshedAtIso,
      });
      const storedRefreshedAt = await getStoredRefreshTimestamp('fresh renewal baseline');

      const status = await service.getStatus();
      expect(status.expires_at).toBe(calculateExpiresAt(storedRefreshedAt));
      const expectedNeedsRenewal =
        fixedNow - new Date(storedRefreshedAt).getTime() >= RENEWAL_THRESHOLD_MS;
      await expect(service.needsRenewal()).resolves.toBe(expectedNeedsRenewal);
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('surfaces near-renewal status from last_refreshed_at age', async () => {
    const fixedNow = new Date('2026-05-13T12:00:00.000Z').getTime();
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    try {
      const refreshedAtIso = '2026-05-12T14:30:00.000Z'; // 21.5 hours ago
      await orm.insert(webhookSubscription).values({
        id: 1,
        verify_token: 'local-token',
        subscription_payload: JSON.stringify({
          id: 202,
          created_at: '2026-05-12T15:00:00.000Z',
          updated_at: '2026-05-12T15:00:00.000Z',
          callback_url: 'https://example.com/webhook',
          application_id: 123,
        }),
        subscription_id: 202,
        last_refreshed_at: refreshedAtIso,
      });
      const storedRefreshedAt = await getStoredRefreshTimestamp('near-renewal window');

      const status = await service.getStatus();
      expect(status.expires_at).toBe(calculateExpiresAt(storedRefreshedAt));
      await expect(service.needsRenewal()).resolves.toBe(false);
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it('treats stale last_refreshed_at as expired even if created_at is newer', async () => {
    const fixedNow = new Date('2026-05-13T12:00:00.000Z').getTime();
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    try {
      const refreshedAtIso = '2026-05-11T10:00:00.000Z'; // intentionally well beyond threshold
      await orm.insert(webhookSubscription).values({
        id: 1,
        verify_token: 'local-token',
        subscription_payload: JSON.stringify({
          id: 303,
          created_at: '2026-05-13T11:55:00.000Z',
          updated_at: '2026-05-13T11:55:00.000Z',
          callback_url: 'https://example.com/webhook',
          application_id: 123,
        }),
        subscription_id: 303,
        last_refreshed_at: refreshedAtIso,
      });
      const storedRefreshedAt = await getStoredRefreshTimestamp('expired renewal baseline');

      const status = await service.getStatus();
      expect(status.expires_at).toBe(calculateExpiresAt(storedRefreshedAt));
      await expect(service.needsRenewal()).resolves.toBe(true);
    } finally {
      dateNowSpy.mockRestore();
    }
  });
});
