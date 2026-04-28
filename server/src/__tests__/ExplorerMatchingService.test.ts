import type { Pool } from 'pg';
import type { AppDatabase } from '../db/types';
import { eq } from 'drizzle-orm';
import {
  clearAllData,
  createExplorerCampaign,
  createExplorerDestination,
  createParticipant,
  setupTestDb,
  teardownTestDb,
} from './testDataHelpers';
import { explorerDestinationMatch } from '../db/schema';
import { ExplorerMatchingService } from '../services/ExplorerMatchingService';
import * as stravaClient from '../stravaClient';

jest.mock('../stravaClient', () => ({
  listAthleteActivities: jest.fn(),
  getActivity: jest.fn(),
}));

describe('ExplorerMatchingService', () => {
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
    jest.clearAllMocks();
  });

  it('records one match per destination even when a ride repeats the same segment', async () => {
    await createParticipant(orm, '2001', 'Explorer Rider');
    const campaign = await createExplorerCampaign(orm, {
      startAt: 1748736000,
      endAt: 1751327999,
      displayName: 'Summer Explorer',
    });

    const destination = await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-100',
      cachedName: 'Summit Road',
    });

    const service = new ExplorerMatchingService(orm);
    const result = await service.matchActivity(
      {
        id: 'activity-1',
        name: 'Big Climb',
        start_date: '2025-06-03T10:00:00Z',
        segment_efforts: [
          {
            id: 'effort-1',
            elapsed_time: 300,
            start_date: '2025-06-03T10:05:00Z',
            segment: { id: 'seg-100' },
          },
          {
            id: 'effort-2',
            elapsed_time: 320,
            start_date: '2025-06-03T10:12:00Z',
            segment: { id: 'seg-100' },
          },
        ],
      },
      '2001'
    );

    expect(result.processedCampaigns).toBe(1);
    expect(result.matchedDestinations).toBe(1);
    expect(result.newMatches).toBe(1);

    const matches = await orm
      .select()
      .from(explorerDestinationMatch)
      .where(eq(explorerDestinationMatch.explorer_destination_id, destination.id))
      .execute();

    expect(matches).toHaveLength(1);
    expect(matches[0]?.strava_activity_id).toBe('activity-1');
  });

  it('is idempotent when the same activity is processed more than once', async () => {
    await createParticipant(orm, '2002', 'Repeat Rider');
    const campaign = await createExplorerCampaign(orm, {
      startAt: 1748736000,
      endAt: 1751327999,
    });

    await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-200',
    });

    const service = new ExplorerMatchingService(orm);
    const activity = {
      id: 'activity-2',
      name: 'Evening Ride',
      start_date: '2025-06-04T18:30:00Z',
      segment_efforts: [
        {
          id: 'effort-3',
          elapsed_time: 220,
          start_date: '2025-06-04T18:35:00Z',
          segment: { id: 'seg-200' },
        },
      ],
    };

    const firstPass = await service.matchActivity(activity, '2002');
    const secondPass = await service.matchActivity(activity, '2002');

    expect(firstPass.newMatches).toBe(1);
    expect(secondPass.newMatches).toBe(0);

    const matches = await orm.select().from(explorerDestinationMatch).execute();
    expect(matches).toHaveLength(1);
  });

  it('hydrates missing segment efforts during campaign refresh and matches newly added destinations', async () => {
    await createParticipant(orm, '2003', 'Refresh Rider');
    const campaign = await createExplorerCampaign(orm, {
      startAt: 1749513600,
      endAt: 1750118399,
    });

    await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-300',
    });

    const service = new ExplorerMatchingService(orm);
    await service.matchActivity(
      {
        id: 'activity-3',
        name: 'Existing Match',
        start_date: '2025-06-12T07:00:00Z',
        segment_efforts: [
          {
            id: 'effort-4',
            elapsed_time: 260,
            start_date: '2025-06-12T07:05:00Z',
            segment: { id: 'seg-300' },
          },
        ],
      },
      '2003'
    );

    await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-301',
    });

    const listAthleteActivitiesMock = jest.mocked(stravaClient.listAthleteActivities);
    const getActivityMock = jest.mocked(stravaClient.getActivity);

    listAthleteActivitiesMock.mockResolvedValue([
      {
        id: 'activity-3',
        name: 'Summary Activity',
        start_date: '2025-06-12T07:00:00Z',
        segment_efforts: [],
      },
    ]);

    getActivityMock.mockResolvedValue({
      id: 'activity-3',
      name: 'Detailed Activity',
      start_date: '2025-06-12T07:00:00Z',
      segment_efforts: [
        {
          id: 'effort-4',
          elapsed_time: 260,
          start_date: '2025-06-12T07:05:00Z',
          segment: { id: 'seg-300' },
        },
        {
          id: 'effort-5',
          elapsed_time: 295,
          start_date: '2025-06-12T07:15:00Z',
          segment: { id: 'seg-301' },
        },
      ],
    });

    const result = await service.refreshAthleteCampaign(campaign.id, '2003', 'test-token');

    expect(result.activitiesProcessed).toBe(1);
    expect(result.activitiesMatched).toBe(1);
    expect(result.newMatches).toBe(1);
    expect(getActivityMock).toHaveBeenCalledWith('activity-3', 'test-token');
  });
});