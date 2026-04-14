import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { appRouter } from '../../routers';
import { createContext } from '../../trpc/context';
import { participant } from '../../db/schema';
import {
  clearAllData,
  createExplorerCampaign,
  createExplorerDestination,
  createExplorerMatch,
  createParticipant,
  createSeason,
  createSegment,
  setupTestDb,
  teardownTestDb,
} from '../testDataHelpers';

describe('explorerRouter', () => {
  let db: Database;
  let drizzleDb: BetterSQLite3Database;

  beforeAll(() => {
    const testDb = setupTestDb();
    db = testDb.db;
    drizzleDb = testDb.drizzleDb;
  });

  afterAll(() => {
    teardownTestDb(db);
  });

  beforeEach(() => {
    clearAllData(drizzleDb);
  });

  const getCaller = (athleteId?: string) => {
    const existingParticipant = athleteId
      ? drizzleDb
        .select({ stravaAthleteId: participant.strava_athlete_id })
        .from(participant)
        .where(eq(participant.strava_athlete_id, athleteId))
        .get()
      : null;

    if (athleteId && !existingParticipant) {
      createParticipant(drizzleDb, athleteId, 'Explorer Athlete');
    }

    return appRouter.createCaller(createContext({
      req: {
        session: {
          stravaAthleteId: athleteId,
        },
      } as any,
      res: {} as any,
      dbOverride: db,
      drizzleDbOverride: drizzleDb,
    }));
  };

  it('returns null when there is no active Explorer campaign', async () => {
    const caller = getCaller();
    await expect(caller.explorer.getActiveCampaign()).resolves.toBeNull();
  });

  it('returns the active campaign with ordered destinations and resolved labels', async () => {
    createSegment(drizzleDb, 'seg-401', 'Segment Name From DB');
    const seasonRecord = createSeason(drizzleDb, '2025 Explorer Season', true, {
      startAt: 1748736000,
      endAt: 4102444799,
    });
    const campaign = createExplorerCampaign(drizzleDb, {
      seasonId: seasonRecord.id,
      displayName: 'Explorer Launch',
    });

    createExplorerDestination(drizzleDb, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-402',
      cachedSegmentName: 'Cached Name',
      displayOrder: 2,
    });
    createExplorerDestination(drizzleDb, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-401',
      displayLabel: 'Custom Label',
      displayOrder: 1,
    });

    const caller = getCaller();
    const result = await caller.explorer.getActiveCampaign();

    expect(result?.name).toBe('Explorer Launch');
    expect(result?.seasonName).toBe('2025 Explorer Season');
    expect(result?.destinations).toHaveLength(2);
    expect(result?.destinations[0]).toMatchObject({
      stravaSegmentId: 'seg-401',
      displayLabel: 'Custom Label',
      displayOrder: 1,
    });
    expect(result?.destinations[1]).toMatchObject({
      stravaSegmentId: 'seg-402',
      displayLabel: 'Cached Name',
      displayOrder: 2,
    });
  });

  it('requires auth for getCampaignProgress', async () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    const campaign = createExplorerCampaign(drizzleDb, { seasonId: seasonRecord.id });
    const caller = getCaller();
    await expect(caller.explorer.getCampaignProgress({ campaignId: campaign.id })).rejects.toThrow('UNAUTHORIZED');
  });

  it('returns athlete progress for a campaign', async () => {
    createParticipant(drizzleDb, '3001', 'Progress Rider');
    createSegment(drizzleDb, 'seg-501', 'Forest Road');
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season', true, {
      startAt: 1751328000,
      endAt: 1751932799,
    });
    const campaign = createExplorerCampaign(drizzleDb, {
      seasonId: seasonRecord.id,
      displayName: 'Weekless Explorer',
    });

    const completedDestination = createExplorerDestination(drizzleDb, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-501',
      cachedSegmentName: 'Forest Road',
      displayOrder: 1,
    });
    createExplorerDestination(drizzleDb, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-502',
      cachedSegmentName: 'River Road',
      displayOrder: 2,
    });

    createExplorerMatch(drizzleDb, {
      explorerCampaignId: campaign.id,
      explorerDestinationId: completedDestination.id,
      stravaAthleteId: '3001',
      stravaActivityId: 'activity-501',
    });

    const caller = getCaller('3001');
    const result = await caller.explorer.getCampaignProgress({ campaignId: campaign.id });

    expect(result?.completedDestinations).toBe(1);
    expect(result?.totalDestinations).toBe(2);
    expect(result?.destinations[0]).toMatchObject({
      stravaSegmentId: 'seg-501',
      completed: true,
      stravaActivityId: 'activity-501',
      displayLabel: 'Forest Road',
    });
    expect(result?.destinations[1]).toMatchObject({
      stravaSegmentId: 'seg-502',
      completed: false,
      displayLabel: 'River Road',
    });
  });
});