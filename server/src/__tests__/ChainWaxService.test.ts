import Database from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { setupTestDb, teardownTestDb } from './setupTestDb';
import { ChainWaxService } from '../services/ChainWaxService';
import { chainWaxPeriod, chainWaxActivity, chainWaxPuck } from '../db/schema';
import { eq, isNull } from 'drizzle-orm';

describe('ChainWaxService', () => {
  let db: Database.Database;
  let drizzleDb: BetterSQLite3Database;

  beforeAll(() => {
    const result = setupTestDb({ seed: false });
    db = result.db;
    drizzleDb = result.drizzleDb;
  });

  afterAll(() => {
    teardownTestDb(db);
  });

  beforeEach(() => {
    // Clear chain wax tables between tests
    drizzleDb.delete(chainWaxActivity).run();
    drizzleDb.delete(chainWaxPeriod).run();
    drizzleDb.delete(chainWaxPuck).run();

    // Seed a fresh period and puck for each test
    const now = Math.floor(Date.now() / 1000);
    drizzleDb.insert(chainWaxPeriod).values({
      started_at: now - 86400, // 1 day ago
      total_distance_meters: 0,
      created_at: now,
    }).run();

    drizzleDb.insert(chainWaxPuck).values({
      started_at: now,
      wax_count: 0,
      is_current: true,
      created_at: now,
    }).run();
  });

  describe('getCurrentStatus', () => {
    it('returns current period status with zero distance', () => {
      const service = new ChainWaxService(drizzleDb);
      const status = service.getCurrentStatus();

      expect(status.currentPeriod).toBeDefined();
      expect(status.currentPeriod.totalDistanceMeters).toBe(0);
      expect(status.currentPeriod.thresholdMeters).toBe(800_000);
      expect(status.currentPeriod.percentage).toBe(0);
      expect(status.currentPeriod.colorZone).toBe('green');
      expect(status.activityCount).toBe(0);
    });

    it('returns puck status', () => {
      const service = new ChainWaxService(drizzleDb);
      const status = service.getCurrentStatus();

      expect(status.puck).toBeDefined();
      expect(status.puck!.waxCount).toBe(0);
      expect(status.puck!.maxUses).toBe(8);
      expect(status.puck!.isExpired).toBe(false);
    });

    it('calculates green zone correctly (< 75%)', () => {
      const service = new ChainWaxService(drizzleDb);
      // Record 500km (62.5% of 800km)
      service.recordActivity('act1', '366880', 500_000, Math.floor(Date.now() / 1000));
      const status = service.getCurrentStatus();

      expect(status.currentPeriod.colorZone).toBe('green');
    });

    it('calculates yellow zone correctly (75-90%)', () => {
      const service = new ChainWaxService(drizzleDb);
      // Record 650km (81.25% of 800km)
      service.recordActivity('act1', '366880', 650_000, Math.floor(Date.now() / 1000));
      const status = service.getCurrentStatus();

      expect(status.currentPeriod.colorZone).toBe('yellow');
    });

    it('calculates red zone correctly (>= 90%)', () => {
      const service = new ChainWaxService(drizzleDb);
      // Record 750km (93.75% of 800km)
      service.recordActivity('act1', '366880', 750_000, Math.floor(Date.now() / 1000));
      const status = service.getCurrentStatus();

      expect(status.currentPeriod.colorZone).toBe('red');
    });
  });

  describe('recordActivity', () => {
    it('records a new activity and updates total distance', () => {
      const service = new ChainWaxService(drizzleDb);
      const now = Math.floor(Date.now() / 1000);

      const recorded = service.recordActivity('act1', '366880', 25_000, now);
      expect(recorded).toBe(true);

      const status = service.getCurrentStatus();
      expect(status.currentPeriod.totalDistanceMeters).toBe(25_000);
      expect(status.activityCount).toBe(1);
    });

    it('deduplicates activities by strava_activity_id', () => {
      const service = new ChainWaxService(drizzleDb);
      const now = Math.floor(Date.now() / 1000);

      const first = service.recordActivity('act1', '366880', 25_000, now);
      const second = service.recordActivity('act1', '366880', 25_000, now);

      expect(first).toBe(true);
      expect(second).toBe(false);

      const status = service.getCurrentStatus();
      expect(status.currentPeriod.totalDistanceMeters).toBe(25_000);
      expect(status.activityCount).toBe(1);
    });

    it('combines distances from both athletes', () => {
      const service = new ChainWaxService(drizzleDb);
      const now = Math.floor(Date.now() / 1000);

      service.recordActivity('act1', '366880', 20_000, now);
      service.recordActivity('act2', '34221810', 30_000, now);

      const status = service.getCurrentStatus();
      expect(status.currentPeriod.totalDistanceMeters).toBe(50_000);
      expect(status.activityCount).toBe(2);
    });

    it('ignores activities before current period started', () => {
      const service = new ChainWaxService(drizzleDb);
      const periodStart = drizzleDb
        .select()
        .from(chainWaxPeriod)
        .where(isNull(chainWaxPeriod.ended_at))
        .get()!.started_at;

      const recorded = service.recordActivity('old-act', '366880', 50_000, periodStart - 3600);
      expect(recorded).toBe(false);

      const status = service.getCurrentStatus();
      expect(status.currentPeriod.totalDistanceMeters).toBe(0);
    });
  });

  describe('removeActivity', () => {
    it('removes a tracked activity and recalculates total', () => {
      const service = new ChainWaxService(drizzleDb);
      const now = Math.floor(Date.now() / 1000);

      service.recordActivity('act1', '366880', 20_000, now);
      service.recordActivity('act2', '366880', 30_000, now);

      expect(service.getCurrentStatus().currentPeriod.totalDistanceMeters).toBe(50_000);

      const removed = service.removeActivity('act1');
      expect(removed).toBe(true);
      expect(service.getCurrentStatus().currentPeriod.totalDistanceMeters).toBe(30_000);
    });

    it('returns false for non-existent activity', () => {
      const service = new ChainWaxService(drizzleDb);
      const removed = service.removeActivity('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('waxChain', () => {
    it('closes current period and creates new one', () => {
      const service = new ChainWaxService(drizzleDb);
      const now = Math.floor(Date.now() / 1000);

      // Record some distance first
      service.recordActivity('act1', '366880', 100_000, now);

      const waxTime = now + 60;
      service.waxChain(waxTime);

      // Should have a new period with zero distance
      const status = service.getCurrentStatus();
      expect(status.currentPeriod.totalDistanceMeters).toBe(0);
      expect(status.currentPeriod.startedAt).toBe(waxTime);

      // Old period should be closed
      const periods = drizzleDb.select().from(chainWaxPeriod).all();
      expect(periods).toHaveLength(2); // original (closed) + new (open)
      const closedPeriod = periods.find(p => p.ended_at === waxTime);
      expect(closedPeriod).toBeDefined();
      expect(closedPeriod!.total_distance_meters).toBe(100_000);
    });

    it('increments puck wax count', () => {
      const service = new ChainWaxService(drizzleDb);
      const now = Math.floor(Date.now() / 1000);

      service.waxChain(now);

      const status = service.getCurrentStatus();
      expect(status.puck!.waxCount).toBe(1);
    });

    it('marks puck as expired after 8 uses', () => {
      const service = new ChainWaxService(drizzleDb);
      const now = Math.floor(Date.now() / 1000);

      // Wax 8 times
      for (let i = 0; i < 8; i++) {
        service.waxChain(now + i + 1);
      }

      const status = service.getCurrentStatus();
      expect(status.puck!.waxCount).toBe(8);
      expect(status.puck!.isExpired).toBe(true);
    });
  });

  describe('newPuck', () => {
    it('retires current puck and creates fresh one', () => {
      const service = new ChainWaxService(drizzleDb);
      const now = Math.floor(Date.now() / 1000);

      // Use current puck a few times
      service.waxChain(now + 1);
      service.waxChain(now + 2);
      expect(service.getCurrentStatus().puck!.waxCount).toBe(2);

      // Replace with a new puck
      service.newPuck();

      const status = service.getCurrentStatus();
      expect(status.puck!.waxCount).toBe(0);
      expect(status.puck!.isExpired).toBe(false);

      // Old puck should no longer be current
      const allPucks = drizzleDb.select().from(chainWaxPuck).all();
      const currentPucks = allPucks.filter(p => p.is_current);
      expect(currentPucks).toHaveLength(1);
      expect(currentPucks[0].wax_count).toBe(0);
    });
  });

  describe('getHistory', () => {
    it('returns empty history when no closed periods', () => {
      const service = new ChainWaxService(drizzleDb);
      // Seed data includes the initial seeded period from migration which has ended_at=NULL,
      // plus the one created in beforeEach (also NULL). No closed periods.
      const history = service.getHistory();
      expect(history).toHaveLength(0);
    });

    it('returns closed periods with activity count', () => {
      const service = new ChainWaxService(drizzleDb);
      const now = Math.floor(Date.now() / 1000);

      service.recordActivity('act1', '366880', 50_000, now);
      service.recordActivity('act2', '34221810', 30_000, now);

      service.waxChain(now + 3600);

      const history = service.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);

      const latestClosed = history[0];
      expect(latestClosed.totalDistanceMeters).toBe(80_000);
      expect(latestClosed.activityCount).toBe(2);
    });
  });

  describe('isTrackedAthlete', () => {
    it('returns true for Tim', () => {
      expect(ChainWaxService.isTrackedAthlete('366880')).toBe(true);
    });

    it('returns true for Will', () => {
      expect(ChainWaxService.isTrackedAthlete('34221810')).toBe(true);
    });

    it('returns false for other athletes', () => {
      expect(ChainWaxService.isTrackedAthlete('999999')).toBe(false);
    });
  });
});
