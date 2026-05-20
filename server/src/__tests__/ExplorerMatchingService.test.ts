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
import { explorerDestinationMatch, explorerDestination } from '../db/schema';
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
    const setup = await setupTestDb();
    pool = setup.pool;
    orm = setup.orm;
  });

  afterAll(async () => {
    await teardownTestDb(pool);
  });

  afterEach(async () => {
    await clearAllData(orm);
  });

  it('marks the first athlete to complete a destination as the first completer', async () => {
    const firstAthlete = '3001';
    const secondAthlete = '3002';

    await createParticipant(orm, firstAthlete, 'First Rider');
    await createParticipant(orm, secondAthlete, 'Second Rider');

    const campaign = await createExplorerCampaign(orm, {
      startAt: 1748736000,
      endAt: 1751327999,
      displayName: 'Explorer Race',
    });

    const destination = await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-first',
      cachedName: 'First Peak',
    });

    const service = new ExplorerMatchingService(orm);

    // First athlete completes the destination
    await service.matchActivity(
      {
        id: 'activity-first',
        name: 'Climb 1',
        start_date: '2025-06-01T10:00:00Z',
        segment_efforts: [
          {
            id: 'e1',
            elapsed_time: 300,
            start_date: '2025-06-01T10:05:00Z',
            segment: { id: 'seg-first' },
          },
        ],
      },
      firstAthlete
    );

    // Second athlete completes the same destination
    await service.matchActivity(
      {
        id: 'activity-second',
        name: 'Climb 2',
        start_date: '2025-06-02T10:00:00Z',
        segment_efforts: [
          {
            id: 'e2',
            elapsed_time: 320,
            start_date: '2025-06-02T10:05:00Z',
            segment: { id: 'seg-first' },
          },
        ],
      },
      secondAthlete
    );

    // Verify first athlete is marked as first completer
    const matches = await orm
      .select()
      .from(explorerDestinationMatch)
      .where(eq(explorerDestinationMatch.explorer_destination_id, destination.id));

    expect(matches).toHaveLength(2);
    const firstMatch = matches.find((m) => m.strava_athlete_id === firstAthlete);
    const secondMatch = matches.find((m) => m.strava_athlete_id === secondAthlete);

    expect(firstMatch?.first_completer_athlete_id).toBe(firstAthlete);
    expect(firstMatch?.first_completer_at).toBeTruthy();
    expect(secondMatch?.first_completer_athlete_id).toBeNull();
    expect(secondMatch?.first_completer_at).toBeNull();
  });

  it('creates match row without persisting a completion counter', async () => {
    const athlete = '3001';

    await createParticipant(orm, athlete, 'Rider');

    const campaign = await createExplorerCampaign(orm, {
      startAt: 1748736000,
      endAt: 1751327999,
      displayName: 'Explorer Race',
    });

    const destination = await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'seg-test',
      cachedName: 'Test Climb',
    });

    const service = new ExplorerMatchingService(orm);

    // Athlete completes destination
    await service.matchActivity(
      {
        id: 'activity-1',
        name: 'Climb',
        start_date: '2025-06-01T10:00:00Z',
        segment_efforts: [
          {
            id: 'e1',
            elapsed_time: 300,
            start_date: '2025-06-01T10:05:00Z',
            segment: { id: 'seg-test' },
          },
        ],
      },
      athlete
    );

    // Verify the match row was created
    const matches = await orm
      .select()
      .from(explorerDestinationMatch)
      .where(eq(explorerDestinationMatch.explorer_destination_id, destination.id));
    expect(matches).toHaveLength(1);
    expect(matches[0].strava_athlete_id).toBe(athlete);

    // Verify the destination schema has no completion_count column —
    // popularity is computed dynamically via COUNT(*) GROUP BY at query time.
    const [updatedDestination] = await orm
      .select()
      .from(explorerDestination)
      .where(eq(explorerDestination.id, destination.id));

    expect(updatedDestination?.id).toBe(destination.id);
    expect('completion_count' in (updatedDestination ?? {})).toBe(false);
  });
});
