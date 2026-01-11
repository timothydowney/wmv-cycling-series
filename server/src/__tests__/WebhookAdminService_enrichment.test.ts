import { Database } from 'better-sqlite3';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { 
  setupTestDb, 
  teardownTestDb, 
  createParticipant, 
  createSeason, 
  createWeek, 
  createSegment 
} from './testDataHelpers';
import { WebhookAdminService } from '../services/WebhookAdminService';
import { webhookEvent, activity } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('WebhookAdminService enrichment', () => {
  let db: Database;
  let drizzleDb: BetterSQLite3Database;
  let service: WebhookAdminService;

  beforeAll(() => {
    const testDb = setupTestDb();
    db = testDb.db;
    drizzleDb = testDb.drizzleDb;
    service = new WebhookAdminService(drizzleDb);
  });

  afterAll(() => {
    teardownTestDb(db);
  });

  it('should return a full summary object when an activity event is enriched', async () => {
    // 1. Setup sample data
    const alice = createParticipant(drizzleDb, '123456', 'Alice');
    const season = createSeason(drizzleDb, 'Season 2025');
    const segment = createSegment(drizzleDb, 'seg1', 'Test Segment');
    const week = createWeek(drizzleDb, {
      seasonId: season.id,
      stravaSegmentId: segment.strava_segment_id,
      weekName: 'Week 1'
    });

    // 2. Create a "processed" webhook event for a Strava activity
    const activityId = 999888777;
    const [event] = await drizzleDb.insert(webhookEvent).values({
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
    await drizzleDb.insert(activity).values({
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
    const [event] = await drizzleDb.insert(webhookEvent).values({
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
});
