import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { appRouter } from '../../routers';
import { createContext } from '../../trpc/context';
import { setupTestDb, teardownTestDb, clearAllData, createSeason, createSegment, createWeek } from '../testDataHelpers';
import { week } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('weekRouter', () => {
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

  // Mock context creator
  const createCaller = (isAdmin: boolean = false) => {
    return appRouter.createCaller(createContext({ 
      dbOverride: db, 
      drizzleDbOverride: drizzleDb,
      req: {} as any,
      res: {} as any,
      // We simulate session via middleware mock in router, but for unit test of router logic,
      // we might need to mock the session object if the router checks it directly.
      // However, tRPC context creation handles the session. 
      // Let's modify createContext to accept session overrides if needed?
      // Actually context.ts takes req.session.
    }));
  };
  
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
    it('should return empty array when no weeks exist', async () => {
      const caller = getCaller(false);
      createSeason(drizzleDb, 'Active Season', true);
      // Assuming season ID 1 is created
      const result = await caller.week.getAll({ seasonId: 1 });
      expect(result).toEqual([]);
    });

    it('should return weeks for a season', async () => {
      const caller = getCaller(false);
      
      const { id: seasonId } = createSeason(drizzleDb, 'Season 1', true);
      createSegment(drizzleDb, 12345);
      createWeek(drizzleDb, { seasonId, stravaSegmentId: 12345, weekName: 'Week 1' });

      const result = await caller.week.getAll({ seasonId });
      expect(result).toHaveLength(1);
      expect(result[0].week_name).toBe('Week 1');
    });
  });

  describe('getById', () => {
    it('should return a week by ID', async () => {
      const caller = getCaller(false);
      
      const { id: seasonId } = createSeason(drizzleDb, 'Season 1');
      createSegment(drizzleDb, 12345);
      const { id: weekId } = createWeek(drizzleDb, { seasonId, stravaSegmentId: 12345, weekName: 'Target Week' });

      const result = await caller.week.getById(Number(weekId));
      expect(result.week_name).toBe('Target Week');
    });

    it('should throw NOT_FOUND for non-existent week', async () => {
      const caller = getCaller(false);
      await expect(caller.week.getById(999)).rejects.toThrow('Week not found');
    });
  });

  describe('create', () => {
    it('should create a week when admin', async () => {
      const caller = getCaller(true);
      
      const { id: seasonId } = createSeason(drizzleDb, 'Active Season', true);
      // createSegment(drizzleDb, 12345); // Service creates if missing
      
      const input = {
        season_id: Number(seasonId),
        week_name: 'New Week',
        segment_id: 12345,
        segment_name: 'New Segment',
        required_laps: 1,
        start_at: 1000,
        end_at: 2000,
      };

      const result = await caller.week.create(input);
      expect(result.week_name).toBe('New Week');
      expect(result.strava_segment_id).toBe(12345);

      // Verify in DB
      const foundWeek = await drizzleDb.select().from(week).where(eq(week.id, result.id)).get();
      expect(foundWeek).toBeDefined();
      expect(foundWeek?.week_name).toBe('New Week');
    });

    it('should fail when not admin', async () => {
      const caller = getCaller(false);
      
      const input = {
        week_name: 'New Week',
        segment_id: 12345,
        required_laps: 1
      };

      // @ts-ignore
      await expect(caller.week.create(input)).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('update', () => {
    it('should update a week when admin', async () => {
      const caller = getCaller(true);
      
      const { id: seasonId } = createSeason(drizzleDb, 'Season 1');
      createSegment(drizzleDb, 12345);
      const { id: weekId } = createWeek(drizzleDb, { seasonId, stravaSegmentId: 12345, weekName: 'Old Name' });

      const result = await caller.week.update({
        id: Number(weekId),
        data: { week_name: 'New Name' },
      });

      expect(result.week_name).toBe('New Name');
    });
  });

  describe('delete', () => {
    it('should delete a week when admin', async () => {
      const caller = getCaller(true);
      
      const { id: seasonId } = createSeason(drizzleDb, 'Season 1');
      createSegment(drizzleDb, 12345);
      const { id: weekId } = createWeek(drizzleDb, { seasonId, stravaSegmentId: 12345 });

      const result = await caller.week.delete(Number(weekId));
      expect(result.message).toBe('Week deleted successfully');

      const foundWeek = await drizzleDb.select().from(week).where(eq(week.id, weekId)).get();
      expect(foundWeek).toBeUndefined();
    });
  });
});
