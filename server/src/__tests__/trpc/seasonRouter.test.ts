import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { appRouter } from '../../routers';
import { createContext } from '../../trpc/context';
import { setupTestDb, teardownTestDb, clearAllData, createSeason } from '../testDataHelpers';
import { season } from '../../db/schema';
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
});