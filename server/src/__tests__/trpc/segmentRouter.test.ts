import path from 'path';
import fs from 'fs';
import { clearAllData, createSegment } from '../testDataHelpers';

// Set test database path BEFORE requiring modules that use it
const TEST_DB_PATH = path.join(__dirname, '..', '..', '..', 'data', 'trpc-segment-test.db');
process.env.DATABASE_PATH = TEST_DB_PATH;
process.env.NODE_ENV = 'test';

// Remove test database if it exists
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

describe('segmentRouter', () => {
  let appRouter: any;
  let db: any;

  beforeAll(() => {
    const routerModule = require('../../routers');
    appRouter = routerModule.appRouter;
    const dbModule = require('../../db');
    db = dbModule.db;

    try {
        const { SCHEMA } = require('../../schema');
        db.exec(SCHEMA);
    } catch (e) {
        // Ignore if schema already init
    }
  });

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
    it('should return empty array when no segments exist', async () => {
      const caller = appRouter.createCaller(createMockContext());
      const result = await caller.segment.getAll();
      expect(result).toEqual([]);
    });

    it('should return all segments', async () => {
      const caller = appRouter.createCaller(createMockContext());
      createSegment(db, 1, 'Segment A');
      createSegment(db, 2, 'Segment B');

      const result = await caller.segment.getAll();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Segment A');
      expect(result[1].name).toBe('Segment B');
    });
  });

  describe('create', () => {
    it('should create a segment when admin', async () => {
      const caller = appRouter.createCaller(createMockContext(true));
      const input = {
        strava_segment_id: 123,
        name: 'Manual Segment',
        distance: 1000
      };

      const result = await caller.segment.create(input);
      expect(result.name).toBe('Manual Segment');
      expect(result.strava_segment_id).toBe(123);
      
      // Verify in DB
      const inDb = await caller.segment.getAll();
      expect(inDb).toHaveLength(1);
    });

    it('should fail when not admin', async () => {
      const caller = appRouter.createCaller(createMockContext(false));
      const input = {
        strava_segment_id: 123,
        name: 'Manual Segment'
      };

      await expect(caller.segment.create(input)).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('validate', () => {
    it('should fail when not admin', async () => {
      const caller = appRouter.createCaller(createMockContext(false));
      await expect(caller.segment.validate(123)).rejects.toThrow('UNAUTHORIZED');
    });

    it('should validate (create placeholder if no token) when admin', async () => {
      const caller = appRouter.createCaller(createMockContext(true));
      // This will likely log "No connected participants, creating placeholder segment"
      const result = await caller.segment.validate(999);
      expect(result).toBeDefined();
      expect(result.strava_segment_id).toBe(999);
      expect(result.name).toBe('Segment 999'); // Placeholder name
    });
  });
});
