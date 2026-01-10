/**
 * Club Router Tests
 * Tests for the tRPC clubRouter checkMembership endpoint
 */

import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { appRouter } from '../routers';
import { createContext } from '../trpc/context';
import { setupTestDb, teardownTestDb } from './setupTestDb';
import { participant, participantToken } from '../db/schema';
import { encryptToken } from '../encryption';

describe('clubRouter - checkMembership', () => {
  let db: Database;
  let drizzleDb: BetterSQLite3Database;

  const testAthleteId = '366880';

  beforeAll(() => {
    const { db: newDb, drizzleDb: newDrizzleDb } = setupTestDb({ seed: false });
    db = newDb;
    drizzleDb = newDrizzleDb;
  });

  afterAll(() => {
    teardownTestDb(db);
  });

  beforeEach(() => {
    // Clear tables before each test
    drizzleDb.delete(participantToken).execute();
    drizzleDb.delete(participant).execute();
  });

  it('should have checkMembership procedure defined', async () => {
    // Create a context with authenticated session
    const mockReq = {
      session: {
        stravaAthleteId: testAthleteId
      }
    } as any;

    const caller = appRouter.createCaller(
      createContext({
        dbOverride: db,
        drizzleDbOverride: drizzleDb,
        req: mockReq,
        res: {} as any
      })
    );

    expect(caller.club).toBeDefined();
    expect(caller.club.checkMembership).toBeDefined();
  });

  it('should check membership using athlete clubs endpoint', async () => {
    drizzleDb.insert(participant).values({
      strava_athlete_id: testAthleteId,
      name: 'Test User'
    }).execute();

    drizzleDb.insert(participantToken).values({
      strava_athlete_id: testAthleteId,
      access_token: encryptToken('valid_token'),
      refresh_token: encryptToken('refresh_token'),
      expires_at: Math.floor(Date.now() / 1000) + 7200,
      scope: 'activity:read'
    }).execute();

    // Create a context with authenticated session
    const mockReq = {
      session: {
        stravaAthleteId: testAthleteId
      }
    } as any;

    const caller = appRouter.createCaller(
      createContext({
        dbOverride: db,
        drizzleDbOverride: drizzleDb,
        req: mockReq,
        res: {} as any
      })
    );

    // Should not throw with empty input (club ID is hardcoded)
    const result = await caller.club.checkMembership({});

    expect(result).toBeDefined();
    expect(typeof result.isMember).toBe('boolean');
  });

  it('should return a boolean isMember property', async () => {
    drizzleDb.insert(participant).values({
      strava_athlete_id: testAthleteId,
      name: 'Test User'
    }).execute();

    drizzleDb.insert(participantToken).values({
      strava_athlete_id: testAthleteId,
      access_token: encryptToken('valid_token'),
      refresh_token: encryptToken('refresh_token'),
      expires_at: Math.floor(Date.now() / 1000) + 7200,
      scope: 'activity:read'
    }).execute();

    // Create a context with authenticated session
    const mockReq = {
      session: {
        stravaAthleteId: testAthleteId
      }
    } as any;

    const caller = appRouter.createCaller(
      createContext({
        dbOverride: db,
        drizzleDbOverride: drizzleDb,
        req: mockReq,
        res: {} as any
      })
    );

    const result = await caller.club.checkMembership({});

    expect(result).toHaveProperty('isMember');
    expect(typeof result.isMember).toBe('boolean');
  });

  it('should return false when not authenticated', async () => {
    // Create a context WITHOUT authenticated session
    const mockReq = {
      session: {}
    } as any;

    const caller = appRouter.createCaller(
      createContext({
        dbOverride: db,
        drizzleDbOverride: drizzleDb,
        req: mockReq,
        res: {} as any
      })
    );

    const result = await caller.club.checkMembership({});

    // Should gracefully return false (error caught by router)
    expect(result).toBeDefined();
    expect(result.isMember).toBe(false);
  });
});

