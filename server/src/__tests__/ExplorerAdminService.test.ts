import type { Pool } from 'pg';
import type { AppDatabase } from '../db/types';
import { eq } from 'drizzle-orm';
import { explorerCampaign, explorerDestination } from '../db/schema';
import { ExplorerAdminService, type ExplorerSegmentMetadataService } from '../services/ExplorerAdminService';
import { clearAllData, setupTestDb, teardownTestDb } from './testDataHelpers';

describe('ExplorerAdminService', () => {
  let pool: Pool;
  let orm: AppDatabase;
  let segmentMetadataService: jest.Mocked<ExplorerSegmentMetadataService>;
  let service: ExplorerAdminService;

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
    segmentMetadataService = {
      fetchAndStoreSegmentMetadata: jest.fn(),
    };
    service = new ExplorerAdminService(orm, segmentMetadataService);
  });

  it('creates one campaign with its own date window', async () => {
    const campaign = await service.createCampaign({
      startAt: 1748736000,
      endAt: 1751327999,
      displayName: 'Explorer 2026',
      rulesBlurb: 'Ride the set.',
    });

    expect(campaign.start_at).toBe(1748736000);
    expect(campaign.end_at).toBe(1751327999);
    expect(campaign.display_name).toBe('Explorer 2026');
    expect(campaign.rules_blurb).toBe('Ride the set.');
  });

  it('rejects overlapping campaign windows', async () => {
    await service.createCampaign({ startAt: 1748736000, endAt: 1751327999 });

    await expect(service.createCampaign({
      startAt: 1750464000,
      endAt: 1753055999,
    })).rejects.toThrow('Explorer campaigns cannot overlap in v1');
  });

  it('allows non-overlapping campaign windows', async () => {
    await service.createCampaign({ startAt: 1748736000, endAt: 1751327999 });
    const secondCampaign = await service.createCampaign({
      startAt: 1751414400,
      endAt: 1754006399,
    });

    expect(secondCampaign.start_at).toBe(1751414400);
    expect(await orm.select().from(explorerCampaign).execute()).toHaveLength(2);
  });

  it('rejects a campaign whose end is before its start', async () => {
    await expect(service.createCampaign({
      startAt: 1751327999,
      endAt: 1748736000,
    })).rejects.toThrow('Campaign end date must be on or after the start date');
  });

  it('updates an existing campaign and preserves non-overlap', async () => {
    const firstCampaign = await service.createCampaign({
      startAt: 1748736000,
      endAt: 1751327999,
      displayName: 'Spring Explorer',
    });
    await service.createCampaign({
      startAt: 1751414400,
      endAt: 1754006399,
      displayName: 'Summer Explorer',
    });

    const updatedCampaign = await service.updateCampaign({
      explorerCampaignId: firstCampaign.id,
      startAt: 1748822400,
      endAt: 1751241599,
      displayName: 'Updated Spring Explorer',
      rulesBlurb: 'Still no overlap.',
    });

    expect(updatedCampaign.display_name).toBe('Updated Spring Explorer');
    expect(updatedCampaign.rules_blurb).toBe('Still no overlap.');
    expect(updatedCampaign.start_at).toBe(1748822400);
  });

  it('rejects updates that would create overlap', async () => {
    const firstCampaign = await service.createCampaign({ startAt: 1748736000, endAt: 1751327999 });
    await service.createCampaign({ startAt: 1751414400, endAt: 1754006399 });

    await expect(service.updateCampaign({
      explorerCampaignId: firstCampaign.id,
      startAt: 1750464000,
      endAt: 1753055999,
    })).rejects.toThrow('Explorer campaigns cannot overlap in v1');
  });

  it('adds a destination from a valid Strava segment URL and assigns display order', async () => {
    const campaign = await service.createCampaign({ startAt: 1748736000, endAt: 1751327999 });
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

    const [storedDestination] = await orm
      .select()
      .from(explorerDestination)
      .where(eq(explorerDestination.id, destination.id))
      .limit(1)
      .execute();

    expect(storedDestination?.created_at).toBeTruthy();
    expect(storedDestination?.created_at).not.toBe('sql`(CURRENT_TIMESTAMP)`');
  });

  it('allows creation when metadata enrichment falls back to placeholder data', async () => {
    const campaign = await service.createCampaign({ startAt: 1748736000, endAt: 1751327999 });
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
    const campaign = await service.createCampaign({ startAt: 1748736000, endAt: 1751327999 });
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
    const campaign = await service.createCampaign({ startAt: 1748736000, endAt: 1751327999 });

    await expect(
      service.addDestination({
        explorerCampaignId: campaign.id,
        sourceUrl: 'https://www.strava.com/routes/12744502',
      })
    ).rejects.toThrow('Please provide a valid Strava segment URL');
  });

  it('accepts segment URLs with surrounding whitespace when called directly', async () => {
    const campaign = await service.createCampaign({ startAt: 1748736000, endAt: 1751327999 });
    segmentMetadataService.fetchAndStoreSegmentMetadata.mockResolvedValue({
      strava_segment_id: '12744502',
      name: 'Mocked Segment',
    } as any);

    const destination = await service.addDestination({
      explorerCampaignId: campaign.id,
      sourceUrl: '  https://www.strava.com/segments/12744502  ',
    });

    expect(destination.strava_segment_id).toBe('12744502');
    expect(destination.source_url).toBe('https://www.strava.com/segments/12744502');
  });

  it('increments display order for later destinations', async () => {
    const campaign = await service.createCampaign({ startAt: 1748736000, endAt: 1751327999 });

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
    const [stored] = await orm
      .select()
      .from(explorerDestination)
      .where(eq(explorerDestination.id, second.id))
      .limit(1)
      .execute();
    expect(stored?.display_order).toBe(1);
  });

  it('deletes an existing destination', async () => {
    const campaign = await service.createCampaign({ startAt: 1748736000, endAt: 1751327999 });
    segmentMetadataService.fetchAndStoreSegmentMetadata.mockResolvedValue({
      strava_segment_id: '12744502',
      name: 'Mocked Segment',
    } as any);

    const destination = await service.addDestination({
      explorerCampaignId: campaign.id,
      sourceUrl: 'https://www.strava.com/segments/12744502',
    });

    await expect(service.deleteDestination({ explorerDestinationId: destination.id })).resolves.toEqual({
      explorerDestinationId: destination.id,
    });

    const [stored] = await orm
      .select()
      .from(explorerDestination)
      .where(eq(explorerDestination.id, destination.id))
      .limit(1)
      .execute();
    expect(stored).toBeUndefined();
  });

  it('rejects deleting a missing destination', async () => {
    await expect(service.deleteDestination({ explorerDestinationId: 999999 })).rejects.toThrow(
      'Explorer destination not found'
    );
  });
});