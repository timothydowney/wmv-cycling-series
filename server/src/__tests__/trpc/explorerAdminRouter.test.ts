import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { appRouter } from '../../routers';
import { createContext } from '../../trpc/context';
import { explorerCampaign, explorerDestination, participant } from '../../db/schema';
import { ExplorerAdminService } from '../../services/ExplorerAdminService';
import { SegmentService } from '../../services/SegmentService';
import {
  clearAllData,
  createExplorerCampaign,
  createParticipant,
  createSegment,
  setupTestDb,
  teardownTestDb,
} from '../testDataHelpers';

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
    const caller = getCaller(false);

    await expect(
      caller.explorerAdmin.createCampaign({ startAt: 1748736000, endAt: 1751327999 })
    ).rejects.toThrow('UNAUTHORIZED');
  });

  it('requires admin auth to read campaigns', async () => {
    const caller = getCaller(false);

    await expect(caller.explorerAdmin.getCampaigns()).rejects.toThrow('UNAUTHORIZED');
  });

  it('returns an empty list when no campaigns exist', async () => {
    const caller = getCaller(true);

    await expect(caller.explorerAdmin.getCampaigns()).resolves.toEqual([]);
  });

  it('creates a campaign when called by an admin', async () => {
    const caller = getCaller(true);

    const result = await caller.explorerAdmin.createCampaign({
      startAt: 1748736000,
      endAt: 1751327999,
      displayName: 'Explorer 2026',
      rulesBlurb: 'Ride every destination once.',
    });

    expect(result.start_at).toBe(1748736000);
    expect(result.end_at).toBe(1751327999);
    expect(result.display_name).toBe('Explorer 2026');

    const stored = drizzleDb
      .select()
      .from(explorerCampaign)
      .where(eq(explorerCampaign.id, result.id))
      .get();
    expect(stored?.rules_blurb).toBe('Ride every destination once.');
  });

  it('updates a campaign when called by an admin', async () => {
    const caller = getCaller(true);
    const campaign = createExplorerCampaign(drizzleDb, {
      startAt: 1748736000,
      endAt: 1751327999,
      displayName: 'Explorer 2026',
    });

    const result = await caller.explorerAdmin.updateCampaign({
      explorerCampaignId: campaign.id,
      startAt: 1748822400,
      endAt: 1751241599,
      displayName: 'Updated Explorer 2026',
      rulesBlurb: 'Updated rules.',
    });

    expect(result.display_name).toBe('Updated Explorer 2026');
    expect(result.start_at).toBe(1748822400);
    expect(result.end_at).toBe(1751241599);
  });

  it('rejects overlapping campaigns', async () => {
    const caller = getCaller(true);
    await caller.explorerAdmin.createCampaign({ startAt: 1748736000, endAt: 1751327999 });

    await expect(
      caller.explorerAdmin.createCampaign({ startAt: 1750464000, endAt: 1753055999 })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Explorer campaigns cannot overlap in v1',
    });
  });

  it('rejects invalid campaign windows', async () => {
    const caller = getCaller(true);

    await expect(
      caller.explorerAdmin.createCampaign({ startAt: 1751327999, endAt: 1748736000 })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Campaign end date must be on or after the start date',
    });
  });

  it('requires admin auth to add a destination', async () => {
    const campaign = createExplorerCampaign(drizzleDb, { startAt: 1748736000, endAt: 1751327999 });
    const caller = getCaller(false);

    await expect(
      caller.explorerAdmin.addDestination({
        explorerCampaignId: campaign.id,
        sourceUrl: 'https://www.strava.com/segments/12744502',
      })
    ).rejects.toThrow('UNAUTHORIZED');
  });

  it('adds a destination and persists source URL plus cached metadata', async () => {
    const campaign = createExplorerCampaign(drizzleDb, { startAt: 1748736000, endAt: 1751327999 });
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

  it('returns campaigns with destinations in admin view order', async () => {
    const firstCampaign = createExplorerCampaign(drizzleDb, {
      startAt: 1748736000,
      endAt: 1751327999,
      displayName: 'Spring Explorer',
      rulesBlurb: 'Ride every destination once.',
    });
    createExplorerCampaign(drizzleDb, {
      startAt: 1751414400,
      endAt: 1754006399,
      displayName: 'Summer Explorer',
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
      explorerCampaignId: firstCampaign.id,
      sourceUrl: 'https://www.strava.com/segments/12744502',
      displayLabel: 'Hilltown opener',
    });

    const result = await caller.explorerAdmin.getCampaigns();

    expect(result).toHaveLength(2);
    expect(result[1]?.name).toBe('Spring Explorer');
    expect(result[1]?.rulesBlurb).toBe('Ride every destination once.');
    expect(result[1]?.destinations).toHaveLength(1);
    expect(result[1]?.destinations[0]).toMatchObject({
      displayLabel: 'Hilltown opener',
      segmentName: 'Mocked Segment',
      distance: 3210,
      averageGrade: 4.2,
      city: 'Northampton',
      state: 'MA',
      country: 'USA',
    });
  });

  it('allows destination creation when metadata enrichment falls back to placeholder data', async () => {
    const campaign = createExplorerCampaign(drizzleDb, { startAt: 1748736000, endAt: 1751327999 });
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
    const campaign = createExplorerCampaign(drizzleDb, { startAt: 1748736000, endAt: 1751327999 });
    const caller = getCaller(true);

    await expect(
      caller.explorerAdmin.addDestination({
        explorerCampaignId: campaign.id,
        sourceUrl: 'https://www.strava.com/routes/12744502',
      })
    ).rejects.toThrow('Please provide a valid Strava segment URL');
  });

  it('maps sqlite unique constraint errors to CONFLICT', async () => {
    const caller = getCaller(true);

    jest.spyOn(ExplorerAdminService.prototype, 'createCampaign').mockImplementation(() => {
      const error = new Error('UNIQUE constraint failed: explorer_destination_campaign_segment') as Error & { code: string };
      error.code = 'SQLITE_CONSTRAINT_UNIQUE';
      throw error;
    });

    await expect(
      caller.explorerAdmin.createCampaign({ startAt: 1748736000, endAt: 1751327999 })
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      message: 'UNIQUE constraint failed: explorer_destination_campaign_segment',
    });
  });

  it('does not leak raw internal errors to clients', async () => {
    const caller = getCaller(true);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    jest.spyOn(ExplorerAdminService.prototype, 'createCampaign').mockImplementation(() => {
      throw new Error('SQL query failed near idx_explorer_campaign_window');
    });

    await expect(
      caller.explorerAdmin.createCampaign({ startAt: 1748736000, endAt: 1751327999 })
    ).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Explorer admin operation failed',
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
