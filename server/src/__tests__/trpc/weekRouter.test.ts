import type { Pool } from 'pg';
import type { AppDatabase } from '../../db/types';
import { eq } from 'drizzle-orm';
import { week } from '../../db/schema';
import { appRouter } from '../../routers';
import { createContext } from '../../trpc/context';
import { clearAllData, createParticipant, createSeason, createSegment, createWeek, setupTestDb, teardownTestDb } from '../testDataHelpers';

describe('weekRouter', () => {
  let pool: Pool;
  let orm: AppDatabase;

  beforeAll(async () => {
    const testDb = setupTestDb({ seed: false });
    pool = testDb.pool;
    orm = testDb.orm;
  });
  afterAll(async () => {
    await teardownTestDb(pool);
  });

  const getCaller = async (isAdmin: boolean) => {
    if (isAdmin) {
      await createParticipant(orm, '999001', 'Test Admin', false, true);
    }

    const req = {
      session: {
        stravaAthleteId: isAdmin ? '999001' : undefined,
      },
    } as any;

    return appRouter.createCaller(() =>
      createContext({
        req,
        res: {} as any,
        dbOverride: pool,
        ormOverride: orm,
      }),
    );
  };

  beforeEach(async () => {
    await clearAllData(orm);
  });

  describe('getAll', () => {
    it('should return empty array when no weeks exist', async () => {
      const caller = await getCaller(false);
      await createSeason(orm, 'Active Season', true);
      const result = await caller.week.getAll({ seasonId: 1 });
      expect(result).toEqual([]);
    });

    it('should return weeks for a season', async () => {
      const caller = await getCaller(false);

      const { id: seasonId } = await createSeason(orm, 'Season 1', true);
      await createSegment(orm, '12345');
      await createWeek(orm, { seasonId, stravaSegmentId: '12345', weekName: 'Week 1' });

      const result = await caller.week.getAll({ seasonId });
      expect(result).toHaveLength(1);
      expect(result[0].week_name).toBe('Week 1');
    });
  });

  describe('getById', () => {
    it('should return a week by ID', async () => {
      const caller = await getCaller(false);

      const { id: seasonId } = await createSeason(orm, 'Season 1');
      await createSegment(orm, '12345');
      const { id: weekId } = await createWeek(orm, { seasonId, stravaSegmentId: '12345', weekName: 'Target Week' });

      const result = await caller.week.getById(Number(weekId));
      expect(result.week_name).toBe('Target Week');
    });

    it('should throw NOT_FOUND for non-existent week', async () => {
      const caller = await getCaller(false);
      await expect(caller.week.getById(999)).rejects.toThrow('Week not found');
    });
  });

  describe('create', () => {
    it('should create a week when admin', async () => {
      const caller = await getCaller(true);

      const { id: seasonId } = await createSeason(orm, 'Active Season', true);

      const input = {
        season_id: Number(seasonId),
        week_name: 'New Week',
        segment_id: '12345',
        segment_name: 'New Segment',
        required_laps: 1,
        start_at: 1000,
        end_at: 2000,
      };

      const result = await caller.week.create(input);
      expect(result.week_name).toBe('New Week');
      expect(result.strava_segment_id).toBe('12345');

      const [foundWeek] = await orm.select().from(week).where(eq(week.id, result.id));
      expect(foundWeek).toBeDefined();
      expect(foundWeek?.week_name).toBe('New Week');
    });

    it('should fail when not admin', async () => {
      const caller = await getCaller(false);

      const input = {
        week_name: 'New Week',
        segment_id: '12345',
        required_laps: 1,
      } as any;

      await expect(caller.week.create(input)).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('update', () => {
    it('should update a week when admin', async () => {
      const caller = await getCaller(true);

      const { id: seasonId } = await createSeason(orm, 'Season 1');
      await createSegment(orm, '12345');
      const { id: weekId } = await createWeek(orm, { seasonId, stravaSegmentId: '12345', weekName: 'Old Name' });

      const result = await caller.week.update({
        id: Number(weekId),
        data: { week_name: 'New Name' },
      });

      expect(result.week_name).toBe('New Name');
    });
  });

  describe('delete', () => {
    it('should delete a week when admin', async () => {
      const caller = await getCaller(true);

      const { id: seasonId } = await createSeason(orm, 'Season 1');
      await createSegment(orm, '12345');
      const { id: weekId } = await createWeek(orm, { seasonId, stravaSegmentId: '12345' });

      const result = await caller.week.delete(Number(weekId));
      expect(result.message).toBe('Week deleted successfully');

      const [foundWeek] = await orm.select().from(week).where(eq(week.id, weekId));
      expect(foundWeek).toBeUndefined();
    });
  });
});
