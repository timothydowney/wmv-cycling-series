import type { Pool } from 'pg';
import type { AppDatabase } from '../../db/types';
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
  timestampStringToEpochMs,
} from '../testDataHelpers';

describe('explorerAdminRouter', () => {
  let pool: Pool;
  let orm: AppDatabase;

  beforeAll(async () => {
    const testDb = setupTestDb({ seed: false });
    pool = testDb.pool;
    orm = testDb.orm;
  });
  afterAll(async () => {
    await teardownTestDb(pool);
  });

  beforeEach(async () => {
    await clearAllData(orm);
    jest.restoreAllMocks();
  });

  const getCaller = async (isAdmin: boolean, athleteId = '999001') => {
    if (isAdmin) {
      const [existingParticipant] = await orm
        .select({ stravaAthleteId: participant.strava_athlete_id })
        .from(participant)
        .where(eq(participant.strava_athlete_id, athleteId));

      if (!existingParticipant) {
        await createParticipant(orm, athleteId, 'Test Admin', false, true);
      }
    }

    return appRouter.createCaller(() => createContext({
      req: {
        session: {
          stravaAthleteId: isAdmin ? athleteId : undefined,
        },
      } as any,
      res: {} as any,
      dbOverride: pool,
      ormOverride: orm,
    }));
  };

  it('requires admin auth to create a campaign', async () => {
    const caller = await getCaller(false);

    await expect(
      caller.explorerAdmin.createCampaign({ startAt: 1748736000, endAt: 1751327999 })
    ).rejects.toThrow('UNAUTHORIZED');
  });

  it('requires admin auth to read campaigns', async () => {
    const caller = await getCaller(false);

    await expect(caller.explorerAdmin.getCampaigns()).rejects.toThrow('UNAUTHORIZED');
  });

  it('returns an empty list when no campaigns exist', async () => {
    const caller = await getCaller(true);

    await expect(caller.explorerAdmin.getCampaigns()).resolves.toEqual([]);
  });

  it('creates a campaign when called by an admin', async () => {
    const caller = await getCaller(true);

    const result = await caller.explorerAdmin.createCampaign({
      startAt: 1748736000,
      endAt: 1751327999,
      displayName: 'Explorer 2026',
      rulesBlurb: 'Ride every destination once.',
    });

    expect(result.start_at).toBe(1748736000);
    expect(result.end_at).toBe(1751327999);
    expect(result.display_name).toBe('Explorer 2026');

    const [stored] = await orm
      .select()
      .from(explorerCampaign)
      .where(eq(explorerCampaign.id, result.id));
    expect(stored?.rules_blurb).toBe('Ride every destination once.');
  });

  it('updates a campaign when called by an admin', async () => {
    const caller = await getCaller(true);
    const campaign = await createExplorerCampaign(orm, {
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
    const caller = await getCaller(true);
    await caller.explorerAdmin.createCampaign({ startAt: 1748736000, endAt: 1751327999 });

    await expect(
      caller.explorerAdmin.createCampaign({ startAt: 1750464000, endAt: 1753055999 })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Explorer campaigns cannot overlap in v1',
    });
  });

  it('rejects invalid campaign windows', async () => {
    const caller = await getCaller(true);

    await expect(
      caller.explorerAdmin.createCampaign({ startAt: 1751327999, endAt: 1748736000 })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Campaign end date must be on or after the start date',
    });
  });

  it('requires admin auth to add a destination', async () => {
    const campaign = await createExplorerCampaign(orm, { startAt: 1748736000, endAt: 1751327999 });
    const caller = await getCaller(false);

    await expect(
      caller.explorerAdmin.addDestination({
        explorerCampaignId: campaign.id,
        sourceUrl: 'https://www.strava.com/segments/12744502',
      })
    ).rejects.toThrow('UNAUTHORIZED');
  });

  it('requires admin auth to delete a destination', async () => {
    const caller = await getCaller(false);

    await expect(
      caller.explorerAdmin.deleteDestination({ explorerDestinationId: 123 })
    ).rejects.toThrow('UNAUTHORIZED');
  });

  it('adds a destination and persists source URL plus cached metadata', async () => {
    const campaign = await createExplorerCampaign(orm, { startAt: 1748736000, endAt: 1751327999 });
    const caller = await getCaller(true);
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

    const [stored] = await orm
      .select()
      .from(explorerDestination)
      .where(eq(explorerDestination.id, result.id));
    expect(stored?.display_order).toBe(0);
  });

  it('returns campaigns with destinations in admin view order', async () => {
    const firstCampaign = await createExplorerCampaign(orm, {
      startAt: 1748736000,
      endAt: 1751327999,
      displayName: 'Spring Explorer',
      rulesBlurb: 'Ride every destination once.',
    });
    await createExplorerCampaign(orm, {
      startAt: 1751414400,
      endAt: 1754006399,
      displayName: 'Summer Explorer',
    });
    const caller = await getCaller(true);
    await createSegment(orm, '12744502', 'Mocked Segment', {
      distance: 3210,
      averageGrade: 4.2,
      totalElevationGain: 286,
      climbCategory: 3,
      startLatitude: 42.3172,
      startLongitude: -72.6425,
      endLatitude: 42.3251,
      endLongitude: -72.6184,
      metadataUpdatedAt: '2026-04-19T12:00:00Z',
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
    expect(result[1]?.displayNameRaw).toBe('Spring Explorer');
    expect(result[1]?.rulesBlurb).toBe('Ride every destination once.');
    expect(result[1]?.destinations).toHaveLength(1);
    expect(result[1]?.destinations[0]).toMatchObject({
      displayLabel: 'Hilltown opener',
      segmentName: 'Mocked Segment',
      distance: 3210,
      averageGrade: 4.2,
      totalElevationGain: 286,
      climbCategory: 3,
      startLatitude: 42.3172,
      startLongitude: -72.6425,
      endLatitude: 42.3251,
      endLongitude: -72.6184,
      city: 'Northampton',
      state: 'MA',
      country: 'USA',
    });
    // metadataUpdatedAt is now timestamptz — verify the point in time, not the string format
    expect(timestampStringToEpochMs(result[1]!.destinations[0]!.metadataUpdatedAt!)).toBe(new Date('2026-04-19T12:00:00Z').getTime());
  });

  it('preserves a null raw display name for unnamed campaigns', async () => {
    await createExplorerCampaign(orm, {
      startAt: 1748736000,
      endAt: 1751327999,
      displayName: null,
    });
    const caller = await getCaller(true);

    const result = await caller.explorerAdmin.getCampaigns();

    expect(result[0]?.name).toBe('Explorer Campaign');
    expect(result[0]?.displayNameRaw).toBeNull();
  });

  it('allows destination creation when metadata enrichment falls back to placeholder data', async () => {
    const campaign = await createExplorerCampaign(orm, { startAt: 1748736000, endAt: 1751327999 });
    const caller = await getCaller(true);
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
    const campaign = await createExplorerCampaign(orm, { startAt: 1748736000, endAt: 1751327999 });
    const caller = await getCaller(true);

    await expect(
      caller.explorerAdmin.addDestination({
        explorerCampaignId: campaign.id,
        sourceUrl: 'https://www.strava.com/routes/12744502',
      })
    ).rejects.toThrow('Please provide a valid Strava segment URL');
  });

  it('deletes a destination when called by an admin', async () => {
    const campaign = await createExplorerCampaign(orm, { startAt: 1748736000, endAt: 1751327999 });
    const caller = await getCaller(true);
    jest.spyOn(SegmentService.prototype, 'fetchAndStoreSegmentMetadata').mockResolvedValue({
      strava_segment_id: '12744502',
      name: 'Mocked Segment',
    } as any);

    const destination = await caller.explorerAdmin.addDestination({
      explorerCampaignId: campaign.id,
      sourceUrl: 'https://www.strava.com/segments/12744502',
    });

    await expect(
      caller.explorerAdmin.deleteDestination({ explorerDestinationId: destination.id })
    ).resolves.toEqual({ explorerDestinationId: destination.id });

    const [stored] = await orm
      .select()
      .from(explorerDestination)
      .where(eq(explorerDestination.id, destination.id));
    expect(stored).toBeUndefined();
  });

  it('maps sqlite unique constraint errors to CONFLICT', async () => {
    const caller = await getCaller(true);

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
    const caller = await getCaller(true);
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
