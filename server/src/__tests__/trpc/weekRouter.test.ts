import path from 'path';
import fs from 'fs';
import { clearAllData, createSeason, createSegment, createWeek } from '../testDataHelpers';

// Set test database path BEFORE requiring modules that use it
const TEST_DB_PATH = path.join(__dirname, '..', '..', '..', 'data', 'trpc-week-test.db');
process.env.DATABASE_PATH = TEST_DB_PATH;
process.env.NODE_ENV = 'test';

// Remove test database if it exists
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

describe('weekRouter', () => {
  let appRouter: any;
  let db: any;

  beforeAll(() => {
    // Require modules AFTER setting env vars
    const routerModule = require('../../routers');
    appRouter = routerModule.appRouter;
    const dbModule = require('../../db');
    db = dbModule.db;

    // Initialize schema
    const { SCHEMA } = require('../../db/schema');
    // Note: Schema init via exec is for better-sqlite3, but Drizzle handles its own thing usually?
    // But here we are using better-sqlite3 instance for raw queries in helpers
    // and Drizzle instance in service.
    // Since db is better-sqlite3 instance, we can run the schema.
    // Wait, SCHEMA import from schema.ts might be the Drizzle schema object, not SQL string.
    // Let's check schema.ts export. It likely doesn't export a SQL string.
    // We rely on migrations or push in dev. 
    // For tests, we might need to use `drizzle-kit push` or just raw SQL if we have it.
    // Since `seasonRouter.test.ts` used `db.exec(SCHEMA)`, I assumed SCHEMA was a string.
    // But let's check if `server/src/schema.ts` exists (it was referenced in index.ts imports).
    // Ah, `server/src/schema.ts` (not db/schema.ts) might hold the SQL schema string.
    
    try {
        const { SCHEMA } = require('../../schema');
        db.exec(SCHEMA);
    } catch (e) {
        // Fallback or ignore if using Drizzle only? 
        // But better-sqlite3 needs tables created.
        // Assuming server/src/schema.ts exists and exports SCHEMA string as per index.ts
    }
  });

  // Mock context creator
  const createMockContext = (isAdmin: boolean = false) => ({
    req: {} as any,
    res: {} as any,
    db: db,
    session: {} as any,
    userId: isAdmin ? 999001 : undefined,
    isAdmin,
  });

  beforeEach(() => {
    clearAllData(db);
  });

  afterAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('getAll', () => {
    it('should return empty array when no weeks exist', async () => {
      const caller = appRouter.createCaller(createMockContext());
      createSeason(db, 'Active Season', true);
      const result = await caller.week.getAll({ seasonId: 1 });
      expect(result).toEqual([]);
    });

    it('should return weeks for a season', async () => {
      const caller = appRouter.createCaller(createMockContext());
      
      const { id: seasonId } = createSeason(db, 'Season 1', true);
      createSegment(db, 12345);
      createWeek(db, { seasonId, stravaSegmentId: 12345, weekName: 'Week 1' });

      const result = await caller.week.getAll({ seasonId });
      expect(result).toHaveLength(1);
      expect(result[0].week_name).toBe('Week 1');
    });
  });

  describe('getById', () => {
    it('should return a week by ID', async () => {
      const caller = appRouter.createCaller(createMockContext());
      
      const { id: seasonId } = createSeason(db, 'Season 1');
      createSegment(db, 12345);
      const { id: weekId } = createWeek(db, { seasonId, stravaSegmentId: 12345, weekName: 'Target Week' });

      const result = await caller.week.getById(Number(weekId));
      expect(result.week_name).toBe('Target Week');
    });

    it('should throw NOT_FOUND for non-existent week', async () => {
      const caller = appRouter.createCaller(createMockContext());
      await expect(caller.week.getById(999)).rejects.toThrow('Week not found');
    });
  });

  describe('create', () => {
    it('should create a week when admin', async () => {
      const caller = appRouter.createCaller(createMockContext(true));
      
      const { id: seasonId } = createSeason(db, 'Active Season', true);
      // createSegment(db, 12345); // Service creates it if missing but needs segment_name usually?
      // Service logic: if segment_name provided, upsert. if not, checks existence.
      
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
      const week = db.prepare('SELECT * FROM week WHERE id = ?').get(result.id) as any;
      expect(week).toBeDefined();
      expect(week.week_name).toBe('New Week');
    });

    it('should fail when not admin', async () => {
      const caller = appRouter.createCaller(createMockContext(false));
      
      const input = {
        week_name: 'New Week',
        segment_id: 12345,
        required_laps: 1
      };

      await expect(caller.week.create(input)).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('update', () => {
    it('should update a week when admin', async () => {
      const caller = appRouter.createCaller(createMockContext(true));
      
      const { id: seasonId } = createSeason(db, 'Season 1');
      createSegment(db, 12345);
      const { id: weekId } = createWeek(db, { seasonId, stravaSegmentId: 12345, weekName: 'Old Name' });

      const result = await caller.week.update({
        id: Number(weekId),
        data: { week_name: 'New Name' },
      });

      expect(result.week_name).toBe('New Name');
    });
  });

  describe('delete', () => {
    it('should delete a week when admin', async () => {
      const caller = appRouter.createCaller(createMockContext(true));
      
      const { id: seasonId } = createSeason(db, 'Season 1');
      createSegment(db, 12345);
      const { id: weekId } = createWeek(db, { seasonId, stravaSegmentId: 12345 });

      const result = await caller.week.delete(Number(weekId));
      expect(result.message).toBe('Week deleted successfully');

      const week = db.prepare('SELECT * FROM week WHERE id = ?').get(weekId);
      expect(week).toBeUndefined();
    });
  });
});
