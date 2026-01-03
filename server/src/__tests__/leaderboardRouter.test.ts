import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { appRouter } from '../routers';
import { createContext } from '../trpc/context';
import { setupTestDb, teardownTestDb, SeedData, createWeek, createSegment } from './testDataHelpers';

describe('leaderboardRouter', () => {
  let db: Database;
  let drizzleDb: BetterSQLite3Database;
  let seedData: SeedData;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    const { db: newDb, drizzleDb: newDrizzleDb, seedData: seededData } = setupTestDb({ seed: true }); // Explicitly seed data
    db = newDb; // Assign to local db
    drizzleDb = newDrizzleDb; // Assign to local drizzleDb
    seedData = seededData!; // Assert it's defined since seed is true
    caller = appRouter.createCaller(createContext({ 
      dbOverride: db, 
      drizzleDbOverride: drizzleDb,
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
      expect(response.leaderboard).toHaveLength(2); // 2 participants seeded in setupTestDb
      expect(response.leaderboard[0].rank).toBe(1);
      expect(response.leaderboard[1].rank).toBe(2);
    });

    it('should return an empty leaderboard for a valid week with no results', async () => {
      // Create a new segment and week specifically for this test case
      // to ensure it has no results.
      const segmentId = '123';
      createSegment(drizzleDb, segmentId, 'Empty Segment');
      
      const newWeek = createWeek(drizzleDb, { 
        seasonId: seedData.seasons[0].id, 
        stravaSegmentId: segmentId, 
        weekName: 'Empty Week' 
      });

      const response = await caller.leaderboard.getWeekLeaderboard({ weekId: newWeek.id });

      expect(response).toBeDefined();
      expect(response.week.id).toBe(newWeek.id);
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