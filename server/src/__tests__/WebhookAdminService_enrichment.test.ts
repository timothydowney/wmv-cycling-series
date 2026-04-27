import type { Pool } from 'pg';
import type { AppDatabase } from '../db/types';
import { 
  setupTestDb, 
  teardownTestDb, 
  createExplorerCampaign,
  createExplorerDestination,
  createExplorerMatch,
  createParticipant, 
  createSeason, 
  createWeek, 
  createSegment 
} from './testDataHelpers';
import { WebhookAdminService } from '../services/WebhookAdminService';
import { webhookEvent, activity } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('WebhookAdminService enrichment', () => {
  let pool: Pool;
  let orm: AppDatabase;
  let service: WebhookAdminService;

  beforeAll(async () => {
    const testDb = setupTestDb({ seed: false });
    pool = testDb.pool;
    orm = testDb.orm;
    service = new WebhookAdminService(orm);
  });
  afterAll(async () => {
    await teardownTestDb(pool);
  });

  it('should return a full summary object when an activity event is enriched', async () => {
    // 1. Setup sample data
    const alice = await createParticipant(orm, '123456', 'Alice');
    const season = await createSeason(orm, 'Season 2025');
    const segment = await createSegment(orm, 'seg1', 'Test Segment');
    const week = await createWeek(orm, {
      seasonId: season.id,
      stravaSegmentId: segment.strava_segment_id,
      weekName: 'Week 1'
    });

    // 2. Create a "processed" webhook event for a Strava activity
    const activityId = 999888777;
    const [event] = await orm.insert(webhookEvent).values({
      payload: JSON.stringify({
        object_type: 'activity',
        aspect_type: 'create',
        object_id: activityId,
        owner_id: parseInt(alice.strava_athlete_id),
        event_time: Math.floor(Date.now() / 1000)
      }),
      processed: 1
    }).returning();

    // 3. Create a stored activity that links this event to a week
    await orm.insert(activity).values({
      strava_activity_id: activityId.toString(),
      strava_athlete_id: alice.strava_athlete_id,
      week_id: week.id,
      start_at: Math.floor(Date.now() / 1000),
      validation_status: 'valid'
    });

    // 4. Test enrichment
    const details = await service.getEnrichedEventDetails(event.id);

    // 5. Assertions - this is what was missing!
    expect(details).toBeDefined();
    expect(details.enrichment).toBeDefined();
    expect(details.enrichment.summary).toBeDefined();
    expect(details.enrichment.summary.status).toBe('qualified');
    expect(details.enrichment.summary.total_weeks_matched).toBe(1);
    expect(details.enrichment.matching_seasons).toBeDefined();
    expect(details.enrichment.matching_seasons.length).toBe(1);
    expect(details.enrichment.matching_seasons[0].season_name).toBe('Season 2025');
  });

  it('should return a "not_found" summary for events with no linked activity', async () => {
    const [event] = await orm.insert(webhookEvent).values({
      payload: JSON.stringify({
        object_type: 'activity',
        aspect_type: 'create',
        object_id: 111222333,
        owner_id: 99999
      }),
      processed: 1
    }).returning();

    const details = await service.getEnrichedEventDetails(event.id);
    expect(details.enrichment.summary.status).toBe('no_match');
  });

  it('should return collapsed activity summaries for competition, explorer, both, and none', async () => {
    const alice = await createParticipant(orm, '777', 'Alice');
    const season = await createSeason(orm, 'Observability Season');
    const segment = await createSegment(orm, 'obs-seg', 'Observability Segment');
    const week = await createWeek(orm, {
      seasonId: season.id,
      stravaSegmentId: segment.strava_segment_id,
      weekName: 'Observability Week',
    });
    const campaign = await createExplorerCampaign(orm, {
      displayName: 'Explorer Observability Campaign',
    });
    const explorerOnlyDestination = await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'explorer-observability-segment',
      cachedName: 'Explorer Only Destination',
    });
    const bothDestination = await createExplorerDestination(orm, {
      explorerCampaignId: campaign.id,
      stravaSegmentId: 'explorer-observability-segment-2',
      cachedName: 'Both Destination',
    });

    const activityIds = {
      competitionOnly: 200001,
      explorerOnly: 200002,
      both: 200003,
      none: 200004,
    };

    const insertedEvents = await orm.insert(webhookEvent).values([
      {
        payload: JSON.stringify({ object_type: 'activity', aspect_type: 'create', object_id: activityIds.competitionOnly, owner_id: parseInt(alice.strava_athlete_id), event_time: Math.floor(Date.now() / 1000) }),
        processed: 1,
      },
      {
        payload: JSON.stringify({ object_type: 'activity', aspect_type: 'create', object_id: activityIds.explorerOnly, owner_id: parseInt(alice.strava_athlete_id), event_time: Math.floor(Date.now() / 1000) }),
        processed: 1,
      },
      {
        payload: JSON.stringify({ object_type: 'activity', aspect_type: 'create', object_id: activityIds.both, owner_id: parseInt(alice.strava_athlete_id), event_time: Math.floor(Date.now() / 1000) }),
        processed: 1,
      },
      {
        payload: JSON.stringify({ object_type: 'activity', aspect_type: 'create', object_id: activityIds.none, owner_id: parseInt(alice.strava_athlete_id), event_time: Math.floor(Date.now() / 1000) }),
        processed: 1,
      },
    ]).returning();

    await orm.insert(activity).values({
      strava_activity_id: activityIds.competitionOnly.toString(),
      strava_athlete_id: alice.strava_athlete_id,
      week_id: week.id,
      start_at: Math.floor(Date.now() / 1000),
      validation_status: 'valid',
    });

    await createExplorerMatch(orm, {
      explorerCampaignId: campaign.id,
      explorerDestinationId: explorerOnlyDestination.id,
      stravaAthleteId: alice.strava_athlete_id,
      stravaActivityId: activityIds.explorerOnly.toString(),
    });

    await orm.insert(activity).values({
      strava_activity_id: activityIds.both.toString(),
      strava_athlete_id: alice.strava_athlete_id,
      week_id: week.id,
      start_at: Math.floor(Date.now() / 1000),
      validation_status: 'valid',
    });

    await createExplorerMatch(orm, {
      explorerCampaignId: campaign.id,
      explorerDestinationId: bothDestination.id,
      stravaAthleteId: alice.strava_athlete_id,
      stravaActivityId: activityIds.both.toString(),
    });

    const result = await service.getEvents(10, 0, 0, 'all');
    const summaryByActivityId = new Map(
      result.events.map(event => [
        event.payload.object_id,
        (event as any).activity_summary,
      ])
    );

    expect(summaryByActivityId.get(activityIds.competitionOnly)).toMatchObject({
      outcome: 'competition',
      competition_week_count: 1,
      explorer_destination_count: 0,
      competition_week_names: ['Observability Week'],
      explorer_destination_names: [],
    });
    expect(summaryByActivityId.get(activityIds.explorerOnly)).toMatchObject({
      outcome: 'explorer',
      competition_week_count: 0,
      explorer_destination_count: 1,
      competition_week_names: [],
      explorer_destination_names: ['Explorer Only Destination'],
    });
    expect(summaryByActivityId.get(activityIds.both)).toMatchObject({
      outcome: 'both',
      competition_week_count: 1,
      explorer_destination_count: 1,
      competition_week_names: ['Observability Week'],
      explorer_destination_names: ['Both Destination'],
    });
    expect(summaryByActivityId.get(activityIds.none)).toMatchObject({
      outcome: 'none',
      competition_week_count: 0,
      explorer_destination_count: 0,
      competition_week_names: [],
      explorer_destination_names: [],
    });
    expect(insertedEvents).toHaveLength(4);
  });
});
