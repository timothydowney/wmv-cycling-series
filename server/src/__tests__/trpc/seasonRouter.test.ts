import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { appRouter } from '../../routers';
import { createContext } from '../../trpc/context';
import { setupTestDb, teardownTestDb, clearAllData, createSeason, createSegment } from '../testDataHelpers';
import { season, week } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('seasonRouter', () => {
  let db: Database;
  let drizzleDb: BetterSQLite3Database;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    const testDb = setupTestDb();
    db = testDb.db;
    drizzleDb = testDb.drizzleDb;
  });

  afterAll(() => {
    teardownTestDb(db);
  });

  // Helper to create caller with specific auth state
  const getCaller = (isAdmin: boolean) => {
    const req = {
      session: {
        stravaAthleteId: isAdmin ? 999001 : undefined,
        isAdmin
      }
    } as any;
    
    return appRouter.createCaller(createContext({
      req,
      res: {} as any,
      dbOverride: db,
      drizzleDbOverride: drizzleDb
    }));
  };

  beforeEach(() => {
    clearAllData(drizzleDb);
  });

  describe('getAll', () => {
    it('should return empty array when no seasons exist', async () => {
      const caller = getCaller(false);
      const result = await caller.season.getAll();
      expect(result).toEqual([]);
    });

    it('should return seasons ordered by start_at desc', async () => {
      const caller = getCaller(false);
      
      createSeason(drizzleDb, 'Season 1', true, { startAt: 1000, endAt: 2000 });
      createSeason(drizzleDb, 'Season 2', false, { startAt: 3000, endAt: 4000 });

      const result = await caller.season.getAll();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Season 2'); // Newer start date first
      expect(result[1].name).toBe('Season 1');
    });
  });

  describe('getById', () => {
    it('should return a season by ID', async () => {
      const caller = getCaller(false);
      
      const { id: seasonId } = createSeason(drizzleDb, 'Target Season');

      const result = await caller.season.getById(Number(seasonId));
      expect(result.name).toBe('Target Season');
    });

    it('should throw NOT_FOUND for non-existent season', async () => {
      const caller = getCaller(false);
      await expect(caller.season.getById(999)).rejects.toThrow('Season not found');
    });
  });

  describe('create', () => {
    it('should create a season when admin', async () => {
      const caller = getCaller(true);
      
      const input = {
        name: 'New Season',
        start_at: 1000,
        end_at: 2000,
      };

      const result = await caller.season.create(input);
      expect(result.name).toBe('New Season');

      // Verify in DB
      const foundSeason = await drizzleDb.select().from(season).where(eq(season.id, result.id)).get();
      expect(foundSeason).toBeDefined();
      expect(foundSeason?.name).toBe('New Season');
    });

    it('should fail when not admin', async () => {
      const caller = getCaller(false);
      
      const input = {
        name: 'New Season',
        start_at: 1000,
        end_at: 2000,
      };

      // @ts-ignore
      await expect(caller.season.create(input)).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('update', () => {
    it('should update a season when admin', async () => {
      const caller = getCaller(true);
      
      const { id: seasonId } = createSeason(drizzleDb, 'Old Name');

      const result = await caller.season.update({
        id: Number(seasonId),
        data: { name: 'New Name' },
      });

      expect(result.name).toBe('New Name');
    });

    it('should fail when not admin', async () => {
      const caller = getCaller(false);
      
      const { id: seasonId } = createSeason(drizzleDb, 'Old Name');

      // @ts-ignore
      await expect(caller.season.update({
        id: Number(seasonId),
        data: { name: 'New Name' },
      })).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('delete', () => {
    it('should delete a season when admin', async () => {
      const caller = getCaller(true);
      
      const { id: seasonId } = createSeason(drizzleDb, 'To Delete');

      const result = await caller.season.delete(Number(seasonId));
      expect(result.message).toBe('Season deleted successfully');

      const foundSeason = await drizzleDb.select().from(season).where(eq(season.id, seasonId)).get();
      expect(foundSeason).toBeUndefined();
    });

    it('should fail when not admin', async () => {
      const caller = getCaller(false);
      
      const { id: seasonId } = createSeason(drizzleDb, 'To Delete');

      // @ts-ignore
      await expect(caller.season.delete(Number(seasonId))).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('clone', () => {
    it('should clone a season and its weeks', async () => {
      const caller = getCaller(true);
      
      // Create segment for FK
      createSegment(drizzleDb, 123, 'Test Segment');

      // 1. Create source season
      // Start season at 9000, but first week starts at 10000
      // This tests that the clone aligns the first week to the new start date, ignoring the season padding
      const sourceSeason = createSeason(drizzleDb, 'Source Season', true, { startAt: 9000, endAt: 20000 });
      
      // 2. Create source weeks directly
      drizzleDb.insert(week).values({
        season_id: sourceSeason.id,
        week_name: 'Week 1',
        strava_segment_id: 123,
        required_laps: 1,
        start_at: 10000,
        end_at: 11000
      }).run();

      // Week 2 is exactly 7 days later (7 * 86400 = 604800 seconds)
      // Start: 10000 + 604800 = 614800
      // End: 11000 + 604800 = 615800
      drizzleDb.insert(week).values({
        season_id: sourceSeason.id,
        week_name: 'Week 2',
        strava_segment_id: 123,
        required_laps: 1,
        start_at: 614800,
        end_at: 615800
      }).run();

      // 3. Clone
      const newStartDate = 30000;
      const result = await caller.season.clone({
        sourceSeasonId: sourceSeason.id,
        newStartDate: newStartDate,
        newName: 'Cloned Season'
      });

      expect(result.name).toBe('Cloned Season');
      expect(result.start_at).toBe(newStartDate);
      
      // 4. Verify weeks
      const newWeeks = await drizzleDb.select().from(week).where(eq(week.season_id, result.id)).orderBy(week.start_at).all();
      expect(newWeeks).toHaveLength(2);

      // Week 1: offset 0 (relative to first week). New start = 30000. Duration 1000. End = 31000.
      expect(newWeeks[0].week_name).toBe('Week 1');
      expect(newWeeks[0].start_at).toBe(30000);
      expect(newWeeks[0].end_at).toBe(31000);

      // Week 2: offset 7 days (604800 seconds). New start = 30000 + 604800 = 634800.
      expect(newWeeks[1].week_name).toBe('Week 2');
      expect(newWeeks[1].start_at).toBe(30000 + 604800);
      expect(newWeeks[1].end_at).toBe(31000 + 604800);
    });
  });
});