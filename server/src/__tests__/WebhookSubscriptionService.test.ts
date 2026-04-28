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
});
