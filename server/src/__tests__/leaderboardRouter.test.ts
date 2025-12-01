import { Database } from 'better-sqlite3';
import { appRouter } from '../routers';
import { createContext } from '../trpc/context';
import { setupTestDb, teardownTestDb, SeedData } from './testDataHelpers';

describe('leaderboardRouter', () => {
  let db: Database;
  let seedData: SeedData;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    const testDb = setupTestDb();
    db = testDb.db;
    seedData = testDb.seedData;
    caller = appRouter.createCaller(createContext({ 
      db,
      req: {} as any,
      res: {} as any
    }));
  });

  afterAll(() => {
    teardownTestDb(db);
  });

  describe('getWeekLeaderboard', () => {
    it('should throw an error if week is not found', async () => {
      await expect(caller.leaderboard.getWeekLeaderboard({ weekId: 99999 })).rejects.toThrow('Week 99999 not found');
    });

    it('should return a leaderboard for a valid week with results', async () => {
      const weekId = seedData.weeks[0].id;
      const response = await caller.leaderboard.getWeekLeaderboard({ weekId });

      expect(response).toBeDefined();
      expect(response.week.id).toBe(weekId);
      expect(response.leaderboard).toHaveLength(2); // Based on seed data
      expect(response.leaderboard[0].rank).toBe(1);
      expect(response.leaderboard[1].rank).toBe(2);
    });

    it('should return an empty leaderboard for a valid week with no results', async () => {
      // Assuming seed data has only 2 weeks, one with results (index 1 in setupTestDb: 'Leaderboard Week') 
      // and one without (index 0: 'Test Week' created via full user)?
      // Actually createWeekWithResults creates results.
      // createFullUserWithActivity creates results.
      // I need to create a week WITHOUT results.
      const weekWithNoResults = db.prepare('SELECT id FROM week WHERE week_name = ?').get('Week with no results') as { id: number } | undefined;
      
      let targetWeekId;
      if (!weekWithNoResults) {
         // Create one
         const { id } = require('./testDataHelpers').createWeek(db, { seasonId: seedData.seasons[0].id, stravaSegmentId: 123, weekName: 'Empty Week' });
         targetWeekId = id;
      } else {
         targetWeekId = weekWithNoResults.id;
      }

      const response = await caller.leaderboard.getWeekLeaderboard({ weekId: targetWeekId });

      expect(response).toBeDefined();
      expect(response.week.id).toBe(targetWeekId);
      expect(response.leaderboard).toHaveLength(0);
    });
  });

  describe('getSeasonLeaderboard', () => {
    it('should return an empty array if season is not found or has no weeks', async () => {
      const leaderboard = await caller.leaderboard.getSeasonLeaderboard({ seasonId: 99999 });
      expect(leaderboard).toEqual([]);
    });

    it('should return a leaderboard for a valid season with results', async () => {
      const seasonId = seedData.seasons[0].id;
      const leaderboard = await caller.leaderboard.getSeasonLeaderboard({ seasonId });

      expect(leaderboard).toBeDefined();
      expect(leaderboard.length).toBeGreaterThan(0);

      // Verify basic structure and sorting
      expect(leaderboard[0]).toHaveProperty('rank');
      expect(leaderboard[0]).toHaveProperty('name');
      expect(leaderboard[0]).toHaveProperty('totalPoints');
      expect(leaderboard[0]).toHaveProperty('weeksCompleted');
      
      // Ensure sorting by totalPoints (descending)
      for (let i = 0; i < leaderboard.length - 1; i++) {
        expect(leaderboard[i].totalPoints).toBeGreaterThanOrEqual(leaderboard[i+1].totalPoints);
      }
    });
  });
});