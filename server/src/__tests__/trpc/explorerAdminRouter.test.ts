import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { appRouter } from '../../routers';
import { createContext } from '../../trpc/context';
import { explorerCampaign, explorerDestination, participant } from '../../db/schema';
import { ExplorerAdminService } from '../../services/ExplorerAdminService';
import { SegmentService } from '../../services/SegmentService';
import { clearAllData, createExplorerCampaign, createParticipant, createSeason, createSegment, setupTestDb, teardownTestDb } from '../testDataHelpers';

describe('explorerAdminRouter', () => {
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
    jest.restoreAllMocks();
  });

  const getCaller = (isAdmin: boolean, athleteId = '999001') => {
    if (isAdmin) {
      const existingParticipant = drizzleDb
        .select({ stravaAthleteId: participant.strava_athlete_id })
        .from(participant)
        .where(eq(participant.strava_athlete_id, athleteId))
        .get();

      if (!existingParticipant) {
        createParticipant(drizzleDb, athleteId, 'Test Admin', false, true);
      }
    }

    return appRouter.createCaller(createContext({
      req: {
        session: {
          stravaAthleteId: isAdmin ? athleteId : undefined,
        },
      } as any,
      res: {} as any,
      dbOverride: db,
      drizzleDbOverride: drizzleDb,
    }));
  };

  it('requires admin auth to create a campaign', async () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    const caller = getCaller(false);

    await expect(
      caller.explorerAdmin.createCampaign({ seasonId: seasonRecord.id })
    ).rejects.toThrow('UNAUTHORIZED');
  });

  it('requires admin auth to read a season campaign', async () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    const caller = getCaller(false);

    await expect(
      caller.explorerAdmin.getCampaignForSeason({ seasonId: seasonRecord.id })
    ).rejects.toThrow('UNAUTHORIZED');
  });

  it('returns null when a season has no explorer campaign', async () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    const caller = getCaller(true);

    await expect(
      caller.explorerAdmin.getCampaignForSeason({ seasonId: seasonRecord.id })
    ).resolves.toBeNull();
  });

  it('creates a campaign when called by an admin', async () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    const caller = getCaller(true);

    const result = await caller.explorerAdmin.createCampaign({
      seasonId: seasonRecord.id,
      displayName: 'Explorer 2026',
      rulesBlurb: 'Ride every destination once.',
    });

    expect(result.season_id).toBe(seasonRecord.id);
    expect(result.display_name).toBe('Explorer 2026');

    const stored = drizzleDb
      .select()
      .from(explorerCampaign)
      .where(eq(explorerCampaign.id, result.id))
      .get();
    expect(stored?.rules_blurb).toBe('Ride every destination once.');
  });

  it('rejects duplicate campaigns for the same season', async () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    const caller = getCaller(true);

    await caller.explorerAdmin.createCampaign({ seasonId: seasonRecord.id });

    await expect(
      caller.explorerAdmin.createCampaign({ seasonId: seasonRecord.id })
    ).rejects.toThrow('Explorer campaign already exists for this season');
  });

  it('returns NOT_FOUND when the season does not exist', async () => {
    const caller = getCaller(true);

    await expect(
      caller.explorerAdmin.createCampaign({ seasonId: 999999 })
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Season not found',
    });
  });

  it('requires admin auth to add a destination', async () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    const campaign = createExplorerCampaign(drizzleDb, { seasonId: seasonRecord.id });
    const caller = getCaller(false);

    await expect(
      caller.explorerAdmin.addDestination({
        explorerCampaignId: campaign.id,
        sourceUrl: 'https://www.strava.com/segments/12744502',
      })
    ).rejects.toThrow('UNAUTHORIZED');
  });

  it('adds a destination and persists source URL plus cached metadata', async () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    const campaign = createExplorerCampaign(drizzleDb, { seasonId: seasonRecord.id });
    const caller = getCaller(true);
    jest.spyOn(SegmentService.prototype, 'fetchAndStoreSegmentMetadata').mockResolvedValue({
      strava_segment_id: '12744502',
      name: 'Mocked Segment',
      distance: 3210,
      average_grade: 4.2,
      city: 'Northampton',
      state: 'MA',
      country: 'USA',
    } as any);

    const result = await caller.explorerAdmin.addDestination({
      explorerCampaignId: campaign.id,
      sourceUrl: 'https://www.strava.com/segments/12744502?filter=overall',
    });

    expect(result.strava_segment_id).toBe('12744502');
    expect(result.cached_name).toBe('Mocked Segment');
    expect(result.source_url).toBe('https://www.strava.com/segments/12744502?filter=overall');

    const stored = drizzleDb
      .select()
      .from(explorerDestination)
      .where(eq(explorerDestination.id, result.id))
      .get();
    expect(stored?.display_order).toBe(0);
  });

  it('returns an admin campaign view with destinations for the selected season', async () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    const campaign = createExplorerCampaign(drizzleDb, {
      seasonId: seasonRecord.id,
      displayName: 'Explorer 2026',
      rulesBlurb: 'Ride every destination once.',
    });
    const caller = getCaller(true);
    createSegment(drizzleDb, '12744502', 'Mocked Segment', {
      distance: 3210,
      averageGrade: 4.2,
      city: 'Northampton',
      state: 'MA',
      country: 'USA',
    });
    jest.spyOn(SegmentService.prototype, 'fetchAndStoreSegmentMetadata').mockResolvedValue({
      strava_segment_id: '12744502',
      name: 'Mocked Segment',
    } as any);

    await caller.explorerAdmin.addDestination({
      explorerCampaignId: campaign.id,
      sourceUrl: 'https://www.strava.com/segments/12744502',
      displayLabel: 'Hilltown opener',
    });

    const result = await caller.explorerAdmin.getCampaignForSeason({ seasonId: seasonRecord.id });

    expect(result).not.toBeNull();
    expect(result?.name).toBe('Explorer 2026');
    expect(result?.rulesBlurb).toBe('Ride every destination once.');
    expect(result?.destinations).toHaveLength(1);
    expect(result?.destinations[0]?.displayLabel).toBe('Hilltown opener');
    expect(result?.destinations[0]?.segmentName).toBe('Mocked Segment');
    expect(result?.destinations[0]?.distance).toBe(3210);
    expect(result?.destinations[0]?.averageGrade).toBe(4.2);
    expect(result?.destinations[0]?.city).toBe('Northampton');
    expect(result?.destinations[0]?.state).toBe('MA');
    expect(result?.destinations[0]?.country).toBe('USA');
  });

  it('allows destination creation when metadata enrichment falls back to placeholder data', async () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    const campaign = createExplorerCampaign(drizzleDb, { seasonId: seasonRecord.id });
    const caller = getCaller(true);
    jest.spyOn(SegmentService.prototype, 'fetchAndStoreSegmentMetadata').mockResolvedValue({
      strava_segment_id: '12744502',
      name: 'Segment 12744502',
    } as any);

    const result = await caller.explorerAdmin.addDestination({
      explorerCampaignId: campaign.id,
      sourceUrl: 'https://www.strava.com/segments/12744502',
    });

    expect(result.cached_name).toBe('Segment 12744502');
  });

  it('rejects invalid segment URLs', async () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    const campaign = createExplorerCampaign(drizzleDb, { seasonId: seasonRecord.id });
    const caller = getCaller(true);

    await expect(
      caller.explorerAdmin.addDestination({
        explorerCampaignId: campaign.id,
        sourceUrl: 'https://www.strava.com/routes/12744502',
      })
    ).rejects.toThrow('Please provide a valid Strava segment URL');
  });

  it('maps sqlite unique constraint errors to CONFLICT', async () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    const caller = getCaller(true);

    jest.spyOn(ExplorerAdminService.prototype, 'createCampaign').mockImplementation(() => {
      const error = new Error('UNIQUE constraint failed: explorer_campaign.season_id') as Error & { code: string };
      error.code = 'SQLITE_CONSTRAINT_UNIQUE';
      throw error;
    });

    await expect(
      caller.explorerAdmin.createCampaign({ seasonId: seasonRecord.id })
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'UNIQUE constraint failed: explorer_campaign.season_id',
    });
  });

  it('does not leak raw internal errors to clients', async () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    const caller = getCaller(true);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    jest.spyOn(ExplorerAdminService.prototype, 'createCampaign').mockImplementation(() => {
      throw new Error('SQL query failed near idx_explorer_campaign_season');
    });

    await expect(
      caller.explorerAdmin.createCampaign({ seasonId: seasonRecord.id })
    ).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Explorer admin operation failed',
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});