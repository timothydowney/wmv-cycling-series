import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { explorerCampaign, explorerDestination } from '../db/schema';
import { ExplorerAdminService, type ExplorerSegmentMetadataService } from '../services/ExplorerAdminService';
import { clearAllData, createSeason, setupTestDb, teardownTestDb } from './testDataHelpers';

describe('ExplorerAdminService', () => {
  let db: Database;
  let drizzleDb: BetterSQLite3Database;
  let segmentMetadataService: jest.Mocked<ExplorerSegmentMetadataService>;
  let service: ExplorerAdminService;

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
    segmentMetadataService = {
      fetchAndStoreSegmentMetadata: jest.fn(),
    };
    service = new ExplorerAdminService(drizzleDb, segmentMetadataService);
  });

  it('creates one campaign for a season', () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');

    const campaign = service.createCampaign({
      seasonId: seasonRecord.id,
      displayName: 'Explorer 2026',
      rulesBlurb: 'Ride the set.',
    });

    expect(campaign.season_id).toBe(seasonRecord.id);
    expect(campaign.display_name).toBe('Explorer 2026');
    expect(campaign.rules_blurb).toBe('Ride the set.');
  });

  it('rejects a second campaign for the same season', () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    service.createCampaign({ seasonId: seasonRecord.id });

    expect(() => service.createCampaign({ seasonId: seasonRecord.id })).toThrow(
      'Explorer campaign already exists for this season'
    );
  });

  it('allows different seasons to have their own campaigns', () => {
    const seasonOne = createSeason(drizzleDb, 'Season One');
    const seasonTwo = createSeason(drizzleDb, 'Season Two', true, {
      startAt: 1767225600,
      endAt: 1798761599,
    });

    service.createCampaign({ seasonId: seasonOne.id });
    const secondCampaign = service.createCampaign({ seasonId: seasonTwo.id });

    expect(secondCampaign.season_id).toBe(seasonTwo.id);
    expect(drizzleDb.select().from(explorerCampaign).all()).toHaveLength(2);
  });

  it('adds a destination from a valid Strava segment URL and assigns display order', async () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    const campaign = service.createCampaign({ seasonId: seasonRecord.id });
    segmentMetadataService.fetchAndStoreSegmentMetadata.mockResolvedValue({
      strava_segment_id: '12744502',
      name: 'Mocked Segment',
    } as any);

    const destination = await service.addDestination({
      explorerCampaignId: campaign.id,
      sourceUrl: 'https://www.strava.com/segments/12744502?filter=overall',
      preferredAthleteId: '999001',
    });

    expect(destination.strava_segment_id).toBe('12744502');
    expect(destination.source_url).toBe('https://www.strava.com/segments/12744502?filter=overall');
    expect(destination.cached_name).toBe('Mocked Segment');
    expect(destination.display_order).toBe(0);
    expect(segmentMetadataService.fetchAndStoreSegmentMetadata).toHaveBeenCalledWith(
      '12744502',
      'explorer-admin-add-destination',
      undefined,
      '999001'
    );
  });

  it('allows creation when metadata enrichment falls back to placeholder data', async () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    const campaign = service.createCampaign({ seasonId: seasonRecord.id });
    segmentMetadataService.fetchAndStoreSegmentMetadata.mockResolvedValue({
      strava_segment_id: '12744502',
      name: 'Segment 12744502',
    } as any);

    const destination = await service.addDestination({
      explorerCampaignId: campaign.id,
      sourceUrl: 'https://www.strava.com/segments/12744502',
    });

    expect(destination.cached_name).toBe('Segment 12744502');
  });

  it('rejects duplicate segment destinations in the same campaign', async () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    const campaign = service.createCampaign({ seasonId: seasonRecord.id });
    segmentMetadataService.fetchAndStoreSegmentMetadata.mockResolvedValue({
      strava_segment_id: '12744502',
      name: 'Mocked Segment',
    } as any);

    await service.addDestination({
      explorerCampaignId: campaign.id,
      sourceUrl: 'https://www.strava.com/segments/12744502',
    });

    await expect(
      service.addDestination({
        explorerCampaignId: campaign.id,
        sourceUrl: 'https://www.strava.com/segments/12744502?view=compare',
      })
    ).rejects.toThrow('Explorer destination already exists for this campaign');
  });

  it('rejects invalid non-segment URLs', async () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    const campaign = service.createCampaign({ seasonId: seasonRecord.id });

    await expect(
      service.addDestination({
        explorerCampaignId: campaign.id,
        sourceUrl: 'https://www.strava.com/routes/12744502',
      })
    ).rejects.toThrow('Please provide a valid Strava segment URL');
  });

  it('increments display order for later destinations', async () => {
    const seasonRecord = createSeason(drizzleDb, 'Explorer Season');
    const campaign = service.createCampaign({ seasonId: seasonRecord.id });

    segmentMetadataService.fetchAndStoreSegmentMetadata.mockResolvedValueOnce({
      strava_segment_id: '12744502',
      name: 'First Segment',
    } as any);
    segmentMetadataService.fetchAndStoreSegmentMetadata.mockResolvedValueOnce({
      strava_segment_id: '12744503',
      name: 'Second Segment',
    } as any);

    await service.addDestination({
      explorerCampaignId: campaign.id,
      sourceUrl: 'https://www.strava.com/segments/12744502',
    });
    const second = await service.addDestination({
      explorerCampaignId: campaign.id,
      sourceUrl: 'https://www.strava.com/segments/12744503',
    });

    expect(second.display_order).toBe(1);
    const stored = drizzleDb
      .select()
      .from(explorerDestination)
      .where(eq(explorerDestination.id, second.id))
      .get();
    expect(stored?.display_order).toBe(1);
  });
});