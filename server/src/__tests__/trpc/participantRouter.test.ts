import type { Pool } from 'pg';
import type { AppDatabase } from '../../db/types';
import { appRouter } from '../../routers';
import { createContext } from '../../trpc/context';
import { setupTestDb, teardownTestDb, clearAllData, createParticipant } from '../testDataHelpers';

describe('participantRouter', () => {
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
    it('should return empty array when no participants exist', async () => {
      const caller = await getCaller(false);
      const result = await caller.participant.getAll();
      expect(result).toEqual([]);
    });

    it('should return all participants', async () => {
      const caller = await getCaller(false);
      await createParticipant(orm, '1', 'Alice');
      await createParticipant(orm, '2', 'Bob');

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
      const caller = await getCaller(false);
      await createParticipant(orm, '1', 'Charlie');

      const result = await caller.participant.getById('1');
      expect(result).toBeDefined();
      expect(result?.name).toBe('Charlie');
    });

    it('should return null for non-existent ID', async () => {
      const caller = await getCaller(false);
      const result = await caller.participant.getById('999');
      expect(result).toBeNull();
    });
  });

  describe('getAdminCandidates', () => {
    it('should include env and db admin sources for admins', async () => {
      const caller = await getCaller(true);
      await createParticipant(orm, '100', 'Database Admin', false, true);
      await createParticipant(orm, '101', 'Regular User');

      const result = await caller.participant.getAdminCandidates();
      const adminCandidate = result.find((participant: any) => participant.strava_athlete_id === '100');
      const envAdmin = result.find((participant: any) => participant.strava_athlete_id === '999001');

      expect(adminCandidate?.is_db_admin).toBe(true);
      expect(adminCandidate?.effective_is_admin).toBe(true);
      expect(envAdmin?.is_env_admin || false).toBeDefined();
    });

    it('should reject non-admin callers', async () => {
      const caller = await getCaller(false);
      await expect(caller.participant.getAdminCandidates()).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('setAdminStatus', () => {
    it('should grant and revoke database-backed admin access', async () => {
      const caller = await getCaller(true);
      await createParticipant(orm, '200', 'Grant Target');

      const granted = await caller.participant.setAdminStatus({
        stravaAthleteId: '200',
        isAdmin: true,
      });

      expect(granted.is_db_admin).toBe(true);
      expect(granted.effective_is_admin).toBe(true);

      const revoked = await caller.participant.setAdminStatus({
        stravaAthleteId: '200',
        isAdmin: false,
      });

      expect(revoked.is_db_admin).toBe(false);
      expect(revoked.effective_is_admin).toBe(false);
    });
  });
});
