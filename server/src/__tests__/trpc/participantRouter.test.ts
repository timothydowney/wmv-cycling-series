import path from 'path';
import fs from 'fs';
import { clearAllData, createParticipant } from '../testDataHelpers';

// Set test database path BEFORE requiring modules that use it
const TEST_DB_PATH = path.join(__dirname, '..', '..', '..', 'data', 'trpc-participant-test.db');
process.env.DATABASE_PATH = TEST_DB_PATH;
process.env.NODE_ENV = 'test';

// Remove test database if it exists
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

describe('participantRouter', () => {
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
        // Ignore
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
    it('should return empty array when no participants exist', async () => {
      const caller = appRouter.createCaller(createMockContext());
      const result = await caller.participant.getAll();
      expect(result).toEqual([]);
    });

    it('should return all participants', async () => {
      const caller = appRouter.createCaller(createMockContext());
      createParticipant(db, 1, 'Alice');
      createParticipant(db, 2, 'Bob');

      const result = await caller.participant.getAll();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
    });
  });

  describe('getById', () => {
    it('should return a participant by ID', async () => {
      const caller = appRouter.createCaller(createMockContext());
      createParticipant(db, 1, 'Charlie');

      const result = await caller.participant.getById(1);
      expect(result).toBeDefined();
      expect(result.name).toBe('Charlie');
    });

    it('should return null for non-existent participant', async () => {
      const caller = appRouter.createCaller(createMockContext());
      const result = await caller.participant.getById(999);
      expect(result).toBeNull();
    });
  });
});
