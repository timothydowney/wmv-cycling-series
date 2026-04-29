import type { Pool } from 'pg';
import type { AppDatabase } from '../db/types';
import { setupTestDb, teardownTestDb } from './setupTestDb';
import { ChainWaxService } from '../services/ChainWaxService';
import { chainWaxPeriod, chainWaxActivity, chainWaxPuck } from '../db/schema';
import { isNull } from 'drizzle-orm';

describe('ChainWaxService', () => {
  let pool: Pool;
  let orm: AppDatabase;

  beforeAll(() => {
    const result = setupTestDb({ seed: false });
    pool = result.pool;
    orm = result.orm;
  });

  afterAll(async () => {
    await teardownTestDb(pool);
  });

  beforeEach(async () => {
    // Clear chain wax tables between tests
    await orm.delete(chainWaxActivity).execute();
    await orm.delete(chainWaxPeriod).execute();
    await orm.delete(chainWaxPuck).execute();

    // Seed a fresh period and puck for each test
    const now = Math.floor(Date.now() / 1000);
    await orm.insert(chainWaxPeriod).values({
      started_at: now - 86400, // 1 day ago
      total_distance_meters: 0,
    }).execute();

    await orm.insert(chainWaxPuck).values({
      started_at: now,
      wax_count: 0,
      is_current: true,
    }).execute();
  });

  describe('getCurrentStatus', () => {
    it('returns current period status with zero distance', async () => {
      const service = new ChainWaxService(orm);
      const status = await service.getCurrentStatus();

      expect(status.currentPeriod).toBeDefined();
      expect(status.currentPeriod.totalDistanceMeters).toBe(0);
      expect(status.currentPeriod.thresholdMeters).toBe(800_000);
      expect(status.currentPeriod.percentage).toBe(0);
      expect(status.currentPeriod.colorZone).toBe('green');
      expect(status.activityCount).toBe(0);
    });

    it('returns puck status', async () => {
      const service = new ChainWaxService(orm);
      const status = await service.getCurrentStatus();

      expect(status.puck).toBeDefined();
      expect(status.puck!.waxCount).toBe(0);
      expect(status.puck!.maxUses).toBe(8);
      expect(status.puck!.isExpired).toBe(false);
    });

    it('calculates green zone correctly (< 75%)', async () => {
      const service = new ChainWaxService(orm);
      // Record 500km (62.5% of 800km)
      await service.recordActivity('act1', '366880', 500_000, Math.floor(Date.now() / 1000));
      const status = await service.getCurrentStatus();

      expect(status.currentPeriod.colorZone).toBe('green');
    });

    it('calculates yellow zone correctly (75-90%)', async () => {
      const service = new ChainWaxService(orm);
      // Record 650km (81.25% of 800km)
      await service.recordActivity('act1', '366880', 650_000, Math.floor(Date.now() / 1000));
      const status = await service.getCurrentStatus();

      expect(status.currentPeriod.colorZone).toBe('yellow');
    });

    it('calculates red zone correctly (>= 90%)', async () => {
      const service = new ChainWaxService(orm);
      // Record 750km (93.75% of 800km)
      await service.recordActivity('act1', '366880', 750_000, Math.floor(Date.now() / 1000));
      const status = await service.getCurrentStatus();

      expect(status.currentPeriod.colorZone).toBe('red');
    });
  });

  describe('recordActivity', () => {
    it('records a new activity and updates total distance', async () => {
      const service = new ChainWaxService(orm);
      const now = Math.floor(Date.now() / 1000);

      const recorded = await service.recordActivity('act1', '366880', 25_000, now);
      expect(recorded).toBe(true);

      const status = await service.getCurrentStatus();
      expect(status.currentPeriod.totalDistanceMeters).toBe(25_000);
      expect(status.activityCount).toBe(1);
    });

    it('deduplicates activities by strava_activity_id', async () => {
      const service = new ChainWaxService(orm);
      const now = Math.floor(Date.now() / 1000);

      const first = await service.recordActivity('act1', '366880', 25_000, now);
      const second = await service.recordActivity('act1', '366880', 25_000, now);

      expect(first).toBe(true);
      expect(second).toBe(false);

      const status = await service.getCurrentStatus();
      expect(status.currentPeriod.totalDistanceMeters).toBe(25_000);
      expect(status.activityCount).toBe(1);
    });

    it('combines distances from both athletes', async () => {
      const service = new ChainWaxService(orm);
      const now = Math.floor(Date.now() / 1000);

      await service.recordActivity('act1', '366880', 20_000, now);
      await service.recordActivity('act2', '34221810', 30_000, now);

      const status = await service.getCurrentStatus();
      expect(status.currentPeriod.totalDistanceMeters).toBe(50_000);
      expect(status.activityCount).toBe(2);
    });

    it('ignores activities before current period started', async () => {
      const service = new ChainWaxService(orm);
      const [currentPeriod] = await orm
        .select()
        .from(chainWaxPeriod)
        .where(isNull(chainWaxPeriod.ended_at))
        .limit(1)
        .execute();

      expect(currentPeriod).toBeDefined();
      const periodStart = currentPeriod!.started_at;

      const recorded = await service.recordActivity('old-act', '366880', 50_000, periodStart - 3600);
      expect(recorded).toBe(false);

      const status = await service.getCurrentStatus();
      expect(status.currentPeriod.totalDistanceMeters).toBe(0);
    });
  });

  describe('removeActivity', () => {
    it('removes a tracked activity and recalculates total', async () => {
      const service = new ChainWaxService(orm);
      const now = Math.floor(Date.now() / 1000);

      await service.recordActivity('act1', '366880', 20_000, now);
      await service.recordActivity('act2', '366880', 30_000, now);

      const before = await service.getCurrentStatus();
      expect(before.currentPeriod.totalDistanceMeters).toBe(50_000);

      const removed = await service.removeActivity('act1');
      expect(removed).toBe(true);
      const after = await service.getCurrentStatus();
      expect(after.currentPeriod.totalDistanceMeters).toBe(30_000);
    });

    it('returns false for non-existent activity', async () => {
      const service = new ChainWaxService(orm);
      const removed = await service.removeActivity('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('waxChain', () => {
    it('closes current period and creates new one', async () => {
      const service = new ChainWaxService(orm);
      const now = Math.floor(Date.now() / 1000);

      // Record some distance first
      await service.recordActivity('act1', '366880', 100_000, now);

      const waxTime = now + 60;
      await service.waxChain(waxTime);

      // Should have a new period with zero distance
      const status = await service.getCurrentStatus();
      expect(status.currentPeriod.totalDistanceMeters).toBe(0);
      expect(status.currentPeriod.startedAt).toBe(waxTime);

      // Old period should be closed
      const periods = await orm.select().from(chainWaxPeriod).execute();
      expect(periods).toHaveLength(2); // original (closed) + new (open)
      const closedPeriod = periods.find((p: any) => p.ended_at === waxTime);
      expect(closedPeriod).toBeDefined();
      expect(closedPeriod!.total_distance_meters).toBe(100_000);
    });

    it('increments puck wax count', async () => {
      const service = new ChainWaxService(orm);
      const now = Math.floor(Date.now() / 1000);

      await service.waxChain(now);

      const status = await service.getCurrentStatus();
      expect(status.puck!.waxCount).toBe(1);
    });

    it('marks puck as expired after 8 uses', async () => {
      const service = new ChainWaxService(orm);
      const now = Math.floor(Date.now() / 1000);

      // Wax 8 times
      for (let i = 0; i < 8; i++) {
        await service.waxChain(now + i + 1);
      }

      const status = await service.getCurrentStatus();
      expect(status.puck!.waxCount).toBe(8);
      expect(status.puck!.isExpired).toBe(true);
    });
  });

  describe('newPuck', () => {
    it('retires current puck and creates fresh one', async () => {
      const service = new ChainWaxService(orm);
      const now = Math.floor(Date.now() / 1000);

      // Use current puck a few times
      await service.waxChain(now + 1);
      await service.waxChain(now + 2);
      const before = await service.getCurrentStatus();
      expect(before.puck!.waxCount).toBe(2);

      // Replace with a new puck
      await service.newPuck();

      const status = await service.getCurrentStatus();
      expect(status.puck!.waxCount).toBe(0);
      expect(status.puck!.isExpired).toBe(false);

      // Old puck should no longer be current
      const allPucks = await orm.select().from(chainWaxPuck).execute();
      const currentPucks = allPucks.filter((p: any) => p.is_current);
      expect(currentPucks).toHaveLength(1);
      expect(currentPucks[0].wax_count).toBe(0);
    });
  });

  describe('getHistory', () => {
    it('returns empty history when no closed periods', async () => {
      const service = new ChainWaxService(orm);
      // Seed data includes the initial seeded period from migration which has ended_at=NULL,
      // plus the one created in beforeEach (also NULL). No closed periods.
      const history = await service.getHistory();
      expect(history).toHaveLength(0);
    });

    it('returns closed periods with activity count', async () => {
      const service = new ChainWaxService(orm);
      const now = Math.floor(Date.now() / 1000);

      await service.recordActivity('act1', '366880', 50_000, now);
      await service.recordActivity('act2', '34221810', 30_000, now);

      await service.waxChain(now + 3600);

      const history = await service.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);

      const latestClosed = history[0];
      expect(latestClosed.totalDistanceMeters).toBe(80_000);
      expect(latestClosed.activityCount).toBe(2);
    });
  });

  describe('isTrackedAthlete', () => {
    it('returns true for Tim', async () => {
      expect(ChainWaxService.isTrackedAthlete('366880')).toBe(true);
    });

    it('returns true for Will', async () => {
      expect(ChainWaxService.isTrackedAthlete('34221810')).toBe(true);
    });

    it('returns false for other athletes', async () => {
      expect(ChainWaxService.isTrackedAthlete('999999')).toBe(false);
    });
  });
});
