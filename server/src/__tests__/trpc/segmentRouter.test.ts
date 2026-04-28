import type { Pool } from 'pg';
import type { AppDatabase } from '../../db/types';
import { appRouter } from '../../routers';
import { createContext } from '../../trpc/context';
import { setupTestDb, teardownTestDb, clearAllData, createParticipant, createSegment } from '../testDataHelpers';
import { segment } from '../../db/schema';
import { eq } from 'drizzle-orm';

describe('segmentRouter', () => {
  let pool: Pool;
  let orm: AppDatabase;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(async () => {
    const testDb = setupTestDb({ seed: false });
    pool = testDb.pool;
    orm = testDb.orm;
  });
  afterAll(async () => {
    await teardownTestDb(pool);
  });

  // Helper to create caller with specific auth state
  const getCaller = async (isAdmin: boolean) => {
    if (isAdmin) {
      await createParticipant(orm, '999001', 'Test Admin', false, true);
    }

    const req = {
      session: {
        stravaAthleteId: isAdmin ? '999001' : undefined,
      }
    } as any;
    
    return appRouter.createCaller(() => createContext({
      req,
      res: {} as any,
      dbOverride: pool,
      ormOverride: orm
    }));
  };

  beforeEach(async () => {
    await clearAllData(orm);
  });

  describe('getAll', () => {
    it('should return empty array when no segments exist', async () => {
      const caller = await getCaller(false);
      const result = await caller.segment.getAll();
      expect(result).toEqual([]);
    });

    it('should return all segments', async () => {
      const caller = await getCaller(false);
      await createSegment(orm, '1', 'Segment A');
      await createSegment(orm, '2', 'Segment B');

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
      const caller = await getCaller(true);
      const input = {
        strava_segment_id: '123',
        name: 'Manual Segment',
        distance: 1000
      };

      const result = await caller.segment.create(input);
      expect(result.name).toBe('Manual Segment');
      expect(result.strava_segment_id).toBe('123');
      
      // Verify in DB
      const [foundSegment] = await orm.select().from(segment).where(eq(segment.strava_segment_id, '123'));
      expect(foundSegment).toBeDefined();
      expect(foundSegment?.name).toBe('Manual Segment');
    });

    it('should fail when not admin', async () => {
      const caller = await getCaller(false);
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
      const caller = await getCaller(false);
      await expect(caller.segment.validate('123')).rejects.toThrow('UNAUTHORIZED');
    });

    it('should validate (create placeholder if no token) when admin', async () => {
      const caller = await getCaller(true);
      // This will likely log "No connected participants, creating placeholder segment"
      const result = await caller.segment.validate('999');
      expect(result).toBeDefined();
      expect(result!.strava_segment_id).toBe('999');
      expect(result!.name).toBe('Segment 999'); // Placeholder name logic
    });
  });
});
