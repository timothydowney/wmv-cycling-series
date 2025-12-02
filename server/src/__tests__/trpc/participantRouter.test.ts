import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { appRouter } from '../../routers';
import { createContext } from '../../trpc/context';
import { setupTestDb, teardownTestDb, clearAllData, createParticipant } from '../testDataHelpers';

describe('participantRouter', () => {
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
    it('should return empty array when no participants exist', async () => {
      const caller = getCaller(false);
      const result = await caller.participant.getAll();
      expect(result).toEqual([]);
    });

    it('should return all participants', async () => {
      const caller = getCaller(false);
      createParticipant(drizzleDb, 1, 'Alice');
      createParticipant(drizzleDb, 2, 'Bob');

      const result = await caller.participant.getAll();
      expect(result).toHaveLength(2);
      // Order isn't guaranteed unless sorted, but service sorts by created_at or name?
      // ParticipantService.getAllParticipantsWithStatus doesn't explicitly sort, but let's assume insertion order or similar.
      // Let's check for containment instead of strict index.
      const names = result.map((p: any) => p.name);
      expect(names).toContain('Alice');
      expect(names).toContain('Bob');
    });
  });

  describe('getById', () => {
    it('should return a participant by ID', async () => {
      const caller = getCaller(false);
      createParticipant(drizzleDb, 1, 'Charlie');

      const result = await caller.participant.getById(1);
      expect(result).toBeDefined();
      expect(result!.name).toBe('Charlie');
    });

    it('should return null for non-existent participant', async () => {
      const caller = getCaller(false);
      const result = await caller.participant.getById(999);
      expect(result).toBeNull();
    });
  });
});
