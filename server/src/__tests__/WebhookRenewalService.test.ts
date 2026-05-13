import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Pool } from 'pg';
import type { AppDatabase } from '../db/types';
import { WebhookRenewalService } from '../services/WebhookRenewalService';
import { setupTestDb, teardownTestDb } from './setupTestDb';

describe('WebhookRenewalService', () => {
  let pool: Pool;
  let orm: AppDatabase;
  let service: WebhookRenewalService;

  beforeEach(() => {
    const testDb = setupTestDb({ seed: false });
    pool = testDb.pool;
    orm = testDb.orm;
    service = new WebhookRenewalService(orm);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    service.stop();
    await teardownTestDb(pool);
  });

  it('starts scheduler and runs an immediate renewal check', () => {
    const unref = jest.fn();
    const intervalHandle = { unref } as unknown as NodeJS.Timeout;
    const setIntervalSpy = jest.spyOn(global, 'setInterval').mockReturnValue(intervalHandle);
    const checkSpy = jest
      .spyOn(service as unknown as { checkAndRenewIfNeeded: () => Promise<void> }, 'checkAndRenewIfNeeded')
      .mockResolvedValue(undefined);

    service.start();

    expect(checkSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 6 * 60 * 60 * 1000);
    expect(unref).toHaveBeenCalledTimes(1);
  });

  it('renews when subscription service reports renewal is needed', async () => {
    const renew = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
    (service as unknown as {
      subscriptionService: { needsRenewal: () => Promise<boolean>; renew: () => Promise<void>; getStatus: () => Promise<unknown> };
    }).subscriptionService = {
      needsRenewal: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
      renew,
      getStatus: jest.fn<() => Promise<unknown>>().mockResolvedValue({ last_refreshed_at: '2026-05-13T10:00:00.000Z' }),
    };

    await (service as unknown as { checkAndRenewIfNeeded: () => Promise<void> }).checkAndRenewIfNeeded();

    expect(renew).toHaveBeenCalledTimes(1);
  });
});
