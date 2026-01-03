import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { appRouter } from '../../routers';
import { createContext } from '../../trpc/context';
import { setupTestDb, teardownTestDb, clearAllData, createSegment } from '../testDataHelpers';
import { segment } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('segmentRouter', () => {
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
        stravaAthleteId: isAdmin ? '999001' : undefined,
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
    it('should return empty array when no segments exist', async () => {
      const caller = getCaller(false);
      const result = await caller.segment.getAll();
      expect(result).toEqual([]);
    });

    it('should return all segments', async () => {
      const caller = getCaller(false);
      createSegment(drizzleDb, '1', 'Segment A');
      createSegment(drizzleDb, '2', 'Segment B');

      const result = await caller.segment.getAll();
      expect(result).toHaveLength(2);
      // Order is not guaranteed by default unless sorted, but service sorts by name?
      // SegmentService.getAllSegments() sorts by name.
      expect(result[0].name).toBe('Segment A');
      expect(result[1].name).toBe('Segment B');
    });
  });

  describe('create', () => {
    it('should create a segment when admin', async () => {
      const caller = getCaller(true);
      const input = {
        strava_segment_id: '123',
        name: 'Manual Segment',
        distance: 1000
      };

      const result = await caller.segment.create(input);
      expect(result.name).toBe('Manual Segment');
      expect(result.strava_segment_id).toBe('123');
      
      // Verify in DB
      const foundSegment = await drizzleDb.select().from(segment).where(eq(segment.strava_segment_id, '123')).get();
      expect(foundSegment).toBeDefined();
      expect(foundSegment?.name).toBe('Manual Segment');
    });

    it('should fail when not admin', async () => {
      const caller = getCaller(false);
      const input = {
        strava_segment_id: '123',
        name: 'Manual Segment'
      };

      // @ts-ignore
      await expect(caller.segment.create(input)).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('validate', () => {
    it('should fail when not admin', async () => {
      const caller = getCaller(false);
      await expect(caller.segment.validate('123')).rejects.toThrow('UNAUTHORIZED');
    });

    it('should validate (create placeholder if no token) when admin', async () => {
      const caller = getCaller(true);
      // This will likely log "No connected participants, creating placeholder segment"
      const result = await caller.segment.validate('999');
      expect(result).toBeDefined();
      expect(result!.strava_segment_id).toBe('999');
      expect(result!.name).toBe('Segment 999'); // Placeholder name logic
    });
  });
});
