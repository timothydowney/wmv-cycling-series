import type { AppDatabase } from '../db/types';
import { isoToUnix } from '../dateUtils';
import { season, activity, participant, participantToken, result, segment, segmentEffort, week, deletionRequest, explorerCampaign, explorerDestination, explorerDestinationMatch, explorerDestinationPin, webhookEvent, webhookSubscription, chainWaxActivity, chainWaxPeriod, chainWaxPuck, sessions } from '../db/schema';
import { eq } from 'drizzle-orm';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

// Type definitions for Drizzle models
export type InsertParticipant = InferInsertModel<typeof participant>;
export type SelectParticipant = InferSelectModel<typeof participant>;
export type InsertSeason = InferInsertModel<typeof season>;       // Exported
export type SelectSeason = InferSelectModel<typeof season>;
export type InsertSegment = InferInsertModel<typeof segment>;     // Exported
export type SelectSegment = InferSelectModel<typeof segment>;
export type InsertWeek = InferInsertModel<typeof week>;           // Exported
export type SelectWeek = InferSelectModel<typeof week>;
export type InsertExplorerCampaign = InferInsertModel<typeof explorerCampaign>;
export type SelectExplorerCampaign = InferSelectModel<typeof explorerCampaign>;
export type InsertExplorerDestination = InferInsertModel<typeof explorerDestination>;
export type SelectExplorerDestination = InferSelectModel<typeof explorerDestination>;
export type InsertExplorerDestinationMatch = InferInsertModel<typeof explorerDestinationMatch>;
export type SelectExplorerDestinationMatch = InferSelectModel<typeof explorerDestinationMatch>;
export type InsertExplorerDestinationPin = InferInsertModel<typeof explorerDestinationPin>;
export type SelectExplorerDestinationPin = InferSelectModel<typeof explorerDestinationPin>;
export type InsertActivity = InferInsertModel<typeof activity>;   // Exported
export type SelectActivity = InferSelectModel<typeof activity>;
export type InsertResult = InferInsertModel<typeof result>;       // Exported
export type SelectResult = InferSelectModel<typeof result>;
export type InsertSegmentEffort = InferInsertModel<typeof segmentEffort>;
export type SelectSegmentEffort = InferSelectModel<typeof segmentEffort>;
export type InsertParticipantToken = InferInsertModel<typeof participantToken>;

// Type for the database instance passed to helper functions
type TestDb = AppDatabase;

interface TokenOptions {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

interface CreateSeasonOptions {
  startAt?: number;
  endAt?: number;
}

interface CreateSegmentOptions {
  distance?: number | null;
  averageGrade?: number | null;
  totalElevationGain?: number | null;
  climbCategory?: number | null;
  startLatitude?: number | null;
  startLongitude?: number | null;
  endLatitude?: number | null;
  endLongitude?: number | null;
  metadataUpdatedAt?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

interface CreateWeekOptions {
  seasonId?: number;
  stravaSegmentId?: string;
  weekName?: string;
  date?: string;
  requiredLaps?: number;
  startTime?: string;
  endTime?: string;
}

interface CreateActivityOptions {
  weekId: number;
  stravaAthleteId: string;
  stravaActivityId?: string;
  stravaSegmentId?: string; // Optional - only create segment effort if provided
  elapsedSeconds?: number;
  prAchieved?: boolean;
  activityStartTime?: string;
  effortStartTime?: string;
}

interface CreateResultOptions {
  weekId: number;
  stravaAthleteId: string;
  activityId?: number | null;
  totalTimeSeconds?: number;
}

interface CreateFullUserOptions {
  stravaAthleteId: string;
  name?: string;
  seasonName?: string;
  weekName?: string;
  stravaSegmentId?: string;
  stravaActivityId?: string;
}

interface CreateWeekWithResultsOptions {
  seasonId: number;
  stravaSegmentId: string;
  weekName?: string;
  participantIds?: string[];
  times?: number[];
}

interface CreateExplorerCampaignOptions {
  startAt?: number;
  endAt?: number;
  displayName?: string | null;
  rulesBlurb?: string | null;
}

interface CreateExplorerDestinationOptions {
  explorerCampaignId: number;
  stravaSegmentId?: string;
  sourceUrl?: string | null;
  cachedName?: string | null;
  displayLabel?: string | null;
  displayOrder?: number;
  surfaceType?: string | null;
  category?: string | null;
}

interface CreateExplorerMatchOptions {
  explorerCampaignId: number;
  explorerDestinationId: number;
  stravaAthleteId: string;
  stravaActivityId?: string;
  matchedAt?: number;
}

interface CreateExplorerPinOptions {
  explorerCampaignId: number;
  explorerDestinationId: number;
  stravaAthleteId: string;
}

/**
 * Create a test participant with optional token
 */
export async function createParticipant(
  db: TestDb,
  stravaAthleteId: string,
  name: string | null = null,
  withToken: boolean | TokenOptions = false,
  isAdmin = false
): Promise<SelectParticipant> {
  const participantName = name || `Test User ${stravaAthleteId}`;

  const newParticipant: InsertParticipant = {
    strava_athlete_id: stravaAthleteId,
    name: participantName,
    is_admin: isAdmin,
  };

  const [insertedParticipant] = await db.insert(participant).values(newParticipant).returning();
  console.log(`[TEST_HELPER] Created Participant: id=${insertedParticipant.strava_athlete_id}, name=${insertedParticipant.name}`);

  if (withToken) {
    let accessToken: string;
    let refreshToken: string;
    let expiresAt: number;

    if (typeof withToken === 'object') {
      accessToken = withToken.accessToken || `token_${stravaAthleteId}`;
      refreshToken = withToken.refreshToken || `refresh_${stravaAthleteId}`;
      expiresAt = withToken.expiresAt || (Math.floor(Date.now() / 1000) + 3600);
    } else {
      accessToken = `token_${stravaAthleteId}`;
      refreshToken = `refresh_${stravaAthleteId}`;
      expiresAt = Math.floor(Date.now() / 1000) + 3600;
    }

    const newParticipantToken: InsertParticipantToken = {
      strava_athlete_id: stravaAthleteId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt
    };
    await db.insert(participantToken).values(newParticipantToken);
    console.log(`[TEST_HELPER] Created Token for Participant ${stravaAthleteId}`);
  }

  return insertedParticipant;
}

/**
 * Create a test season
 */
export async function createSeason(db: TestDb, name: string = 'Test Season', _isActive: boolean = true, options: CreateSeasonOptions = {}): Promise<SelectSeason> {
  const startAt = options.startAt || isoToUnix('2025-01-01T00:00:00Z');
  const endAt = options.endAt || isoToUnix('2025-12-31T23:59:59Z');

  const newSeasonData: InsertSeason = {
    name: name,
    start_at: startAt || 0,
    end_at: endAt || 0,
  };

  const [newSeason] = await db.insert(season).values(newSeasonData).returning();
  console.log(`[TEST_HELPER] Created Season: id=${newSeason.id}, name=${newSeason.name}`);
  return newSeason;
}

/**
 * Create a test segment
 */
export async function createSegment(db: TestDb, stravaSegmentId: string, name: string | null = null, options: CreateSegmentOptions = {}): Promise<SelectSegment> {
  const segmentName = name || `Segment ${stravaSegmentId}`;

  const newSegmentData: InsertSegment = {
    strava_segment_id: stravaSegmentId,
    name: segmentName,
    distance: options.distance,
    average_grade: options.averageGrade,
    total_elevation_gain: options.totalElevationGain,
    climb_category: options.climbCategory,
    start_latitude: options.startLatitude,
    start_longitude: options.startLongitude,
    end_latitude: options.endLatitude,
    end_longitude: options.endLongitude,
    metadata_updated_at: options.metadataUpdatedAt,
    city: options.city,
    state: options.state,
    country: options.country
  };
  const [newSegment] = await db.insert(segment).values(newSegmentData).returning();
  console.log(`[TEST_HELPER] Created Segment: id=${newSegment.strava_segment_id}, name=${newSegment.name}`);
  return newSegment;
}

/**
 * Create a test week
 */
export async function createWeek(db: TestDb, options: CreateWeekOptions = {}): Promise<SelectWeek> {
  const {
    seasonId,
    stravaSegmentId,
    weekName = 'Test Week',
    requiredLaps = 1,
    startTime = '2025-06-01T00:00:00Z',
    endTime = '2025-06-01T22:00:00Z'
  } = options;

  // Create default season and segment if not provided
  let finalSeasonId = seasonId;
  if (!finalSeasonId) {
    const defaultSeason = await createSeason(db, 'Default Test Season');
    finalSeasonId = defaultSeason.id;
  }

  let finalSegmentId = stravaSegmentId;
  if (!finalSegmentId) {
    // Try to reuse existing default segment to avoid UNIQUE constraint violations
    const [existingDefault] = await db
      .select()
      .from(segment)
      .where(eq(segment.strava_segment_id, '12345678'));

    if (existingDefault) {
      finalSegmentId = '12345678';
    } else {
      const defaultSegment = await createSegment(db, '12345678', 'Default Test Segment');
      finalSegmentId = defaultSegment.strava_segment_id;
    }
  }

  // Convert ISO 8601 times to Unix timestamps (UTC seconds)
  const startAtUnix = isoToUnix(startTime);
  const endAtUnix = isoToUnix(endTime);

  const newWeekData: InsertWeek = {
    season_id: finalSeasonId,
    week_name: weekName,
    strava_segment_id: finalSegmentId,
    required_laps: requiredLaps,
    start_at: startAtUnix || 0,
    end_at: endAtUnix || 0
  };
  const [newWeek] = await db.insert(week).values(newWeekData).returning();
  console.log(`[TEST_HELPER] Created Week: id=${newWeek.id}, name=${newWeek.week_name}, seasonId=${newWeek.season_id}, segmentId=${newWeek.strava_segment_id}`);
  return newWeek;
}

export async function createExplorerCampaign(
  db: TestDb,
  options: CreateExplorerCampaignOptions = {}
): Promise<SelectExplorerCampaign> {
  const {
    startAt = isoToUnix('2025-06-01T00:00:00Z') || 0,
    endAt = isoToUnix('2025-06-30T23:59:59Z') || 0,
    displayName = 'Explorer Campaign',
    rulesBlurb = null,
  } = options;

  const newCampaignData: InsertExplorerCampaign = {
    start_at: startAt,
    end_at: endAt,
    display_name: displayName,
    rules_blurb: rulesBlurb,
  };

  const [inserted] = await db.insert(explorerCampaign).values(newCampaignData).returning();
  return inserted;
}

export async function createExplorerDestination(
  db: TestDb,
  options: CreateExplorerDestinationOptions
): Promise<SelectExplorerDestination> {
  const {
    explorerCampaignId,
    stravaSegmentId = 'explorer-segment-1',
    sourceUrl = null,
    cachedName = null,
    displayLabel = null,
    displayOrder = 0,
    surfaceType = null,
    category = null,
  } = options;

  const [existingSegment] = await db
    .select()
    .from(segment)
    .where(eq(segment.strava_segment_id, stravaSegmentId));

  if (!existingSegment && cachedName) {
    await createSegment(db, stravaSegmentId, cachedName);
  }

  const newDestinationData: InsertExplorerDestination = {
    explorer_campaign_id: explorerCampaignId,
    strava_segment_id: stravaSegmentId,
    source_url: sourceUrl,
    cached_name: cachedName,
    display_label: displayLabel,
    display_order: displayOrder,
    surface_type: surfaceType,
    category,
  };

  const [inserted] = await db.insert(explorerDestination).values(newDestinationData).returning();
  return inserted;
}

export async function createExplorerMatch(
  db: TestDb,
  options: CreateExplorerMatchOptions
): Promise<SelectExplorerDestinationMatch> {
  const {
    explorerCampaignId,
    explorerDestinationId,
    stravaAthleteId,
    stravaActivityId = String(Math.floor(Math.random() * 1000000000)),
    matchedAt = isoToUnix('2025-06-01T12:00:00Z') || 0,
  } = options;

  const newMatchData: InsertExplorerDestinationMatch = {
    explorer_campaign_id: explorerCampaignId,
    explorer_destination_id: explorerDestinationId,
    strava_athlete_id: stravaAthleteId,
    strava_activity_id: stravaActivityId,
    matched_at: matchedAt,
  };

  const [inserted] = await db.insert(explorerDestinationMatch).values(newMatchData).returning();
  return inserted;
}

export async function createExplorerPin(
  db: TestDb,
  options: CreateExplorerPinOptions
): Promise<SelectExplorerDestinationPin> {
  const newPinData: InsertExplorerDestinationPin = {
    explorer_campaign_id: options.explorerCampaignId,
    explorer_destination_id: options.explorerDestinationId,
    strava_athlete_id: options.stravaAthleteId,
  };

  const [inserted] = await db.insert(explorerDestinationPin).values(newPinData).returning();
  return inserted;
}

/**
 * Create a test activity with optional segment efforts
 */
export async function createActivity(db: TestDb, options: CreateActivityOptions): Promise<SelectActivity & { segmentEffortId?: number; totalTime?: number }> {
  const {
    weekId,
    stravaAthleteId,
    stravaActivityId = String(Math.floor(Math.random() * 1000000000)),
    stravaSegmentId,
    elapsedSeconds = 1000,
    prAchieved = false,
    activityStartTime = '2025-06-01T10:00:00Z',
    effortStartTime = '2025-06-01T10:05:00Z'
  } = options;

  // Convert ISO 8601 times to Unix timestamps
  const activityStartAtUnix = isoToUnix(activityStartTime);
  const effortStartAtUnix = isoToUnix(effortStartTime);

  // Some legacy tests create activities directly without seeding participants first.
  // Ensure FK prerequisites exist to keep helper behavior robust across suites.
  const [existingParticipant] = await db
    .select({ strava_athlete_id: participant.strava_athlete_id })
    .from(participant)
    .where(eq(participant.strava_athlete_id, stravaAthleteId));

  if (!existingParticipant) {
    await db.insert(participant).values({
      strava_athlete_id: stravaAthleteId,
      name: `Test User ${stravaAthleteId}`,
      is_admin: false,
    });
  }

  // Create activity
  const newActivityData: InsertActivity = {
    week_id: weekId,
    strava_athlete_id: stravaAthleteId,
    strava_activity_id: stravaActivityId,
    start_at: activityStartAtUnix || 0,
    validation_status: 'valid'
  };
  const [newActivity] = await db.insert(activity).values(newActivityData).returning();
  console.log(`[TEST_HELPER] Created Activity: id=${newActivity.id}, weekId=${newActivity.week_id}, athleteId=${newActivity.strava_athlete_id}, stravaActivityId=${newActivity.strava_activity_id}`);

  // Create segment effort only if stravaSegmentId is provided
  if (stravaSegmentId) {
    const newSegmentEffortData: InsertSegmentEffort = {
      activity_id: newActivity.id,
      strava_segment_id: stravaSegmentId,
      effort_index: 0,
      elapsed_seconds: elapsedSeconds,
      start_at: effortStartAtUnix || 0,
      pr_achieved: prAchieved ? 1 : 0,
      strava_effort_id: String(Math.floor(Math.random() * 1000000000000000000))
    };
    const [newSegmentEffort] = await db.insert(segmentEffort).values(newSegmentEffortData).returning();
    console.log(`[TEST_HELPER] Created SegmentEffort: id=${newSegmentEffort.id}, activityId=${newSegmentEffort.activity_id}, segmentId=${newSegmentEffort.strava_segment_id}`);

    return {
      ...newActivity,
      segmentEffortId: newSegmentEffort.id,
      totalTime: elapsedSeconds
    };
  }

  return newActivity;
}

interface CreateSegmentEffortOptions {
  activityId: number;
  stravaSegmentId?: string;
  effortIndex?: number;
  elapsedSeconds?: number;
  startAt?: string;
  prAchieved?: number;
  stravaEffortId?: string;
}

/**
 * Create a standalone segment effort
 * Useful for tests that need to add efforts to existing activities
 */
export async function createSegmentEffort(db: TestDb, options: CreateSegmentEffortOptions): Promise<SelectSegmentEffort> {
  const {
    activityId,
    stravaSegmentId = '12345678',
    effortIndex = 0,
    elapsedSeconds = 600,
    startAt = '2025-06-01T10:05:00Z',
    prAchieved = 0,
    stravaEffortId = String(Math.floor(Math.random() * 1000000000000000000))
  } = options;

  const effortStartAtUnix = isoToUnix(startAt);

  const newSegmentEffortData: InsertSegmentEffort = {
    activity_id: activityId,
    strava_segment_id: stravaSegmentId,
    effort_index: effortIndex,
    elapsed_seconds: elapsedSeconds,
    start_at: effortStartAtUnix || 0,
    pr_achieved: prAchieved,
    strava_effort_id: stravaEffortId
  };

  const [newSegmentEffort] = await db.insert(segmentEffort).values(newSegmentEffortData).returning();
  console.log(`[TEST_HELPER] Created SegmentEffort: id=${newSegmentEffort.id}, activityId=${newSegmentEffort.activity_id}, segmentId=${newSegmentEffort.strava_segment_id}, elapsed=${newSegmentEffort.elapsed_seconds}s`);

  return newSegmentEffort;
}

/**
 * Create a test result record
 */
export async function createResult(db: TestDb, options: CreateResultOptions): Promise<SelectResult> {
  const { weekId, stravaAthleteId, activityId = null, totalTimeSeconds = 1000 } = options;

  const newResultData: InsertResult = {
    week_id: weekId,
    strava_athlete_id: stravaAthleteId,
    activity_id: activityId,
    total_time_seconds: totalTimeSeconds
  };
  const [newResult] = await db.insert(result).values(newResultData).returning();
  console.log(`[TEST_HELPER] Created Result: id=${newResult.id}, weekId=${newResult.week_id}, athleteId=${newResult.strava_athlete_id}`);
  return newResult;
}

interface FullUserWithActivityReturn {
  participant: SelectParticipant;
  season: SelectSeason;
  segment: SelectSegment;
  week: SelectWeek;
  activity: SelectActivity & { segmentEffortId?: number; totalTime?: number };
  result: SelectResult;
}

/**
 * Create a complete test user with all related data
 * Convenience function for common test scenario
 */
export async function createFullUserWithActivity(db: TestDb, options: CreateFullUserOptions): Promise<FullUserWithActivityReturn> {
  const {
    stravaAthleteId,
    name = `Test User ${stravaAthleteId}`,
    seasonName = 'Test Season',
    weekName = 'Test Week',
    stravaSegmentId = '99999',
    stravaActivityId
  } = options;

  const newParticipant = await createParticipant(db, stravaAthleteId, name, true);
  const newSeason = await createSeason(db, seasonName, true);
  const newSegment = await createSegment(db, stravaSegmentId);
  const newWeek = await createWeek(db, {
    seasonId: newSeason.id,
    stravaSegmentId: newSegment.strava_segment_id,
    weekName
  });

  const newActivity = await createActivity(db, {
    weekId: newWeek.id,
    stravaAthleteId: newParticipant.strava_athlete_id,
    stravaActivityId: stravaActivityId || String(Math.floor(Math.random() * 1000000000)),
    stravaSegmentId: newSegment.strava_segment_id
  });

  const newResult = await createResult(db, {
    weekId: newWeek.id,
    stravaAthleteId: newParticipant.strava_athlete_id,
    activityId: newActivity.id,
    totalTimeSeconds: newActivity.totalTime || 1000,
  });

  return {
    participant: newParticipant,
    season: newSeason,
    segment: newSegment,
    week: newWeek,
    activity: newActivity,
    result: newResult
  };
}

/**
 * Clear all test data (truncate all tables in reverse dependency order)
 */
export async function clearAllData(db: TestDb) {
  // Delete in dependency order (most-dependent tables first).
  await db.delete(explorerDestinationPin);
  await db.delete(explorerDestinationMatch);
  await db.delete(explorerDestination);
  await db.delete(explorerCampaign);
  await db.delete(chainWaxActivity);
  await db.delete(chainWaxPuck);
  await db.delete(chainWaxPeriod);
  await db.delete(segmentEffort);
  await db.delete(result);
  await db.delete(activity);
  await db.delete(participantToken);
  await db.delete(deletionRequest);
  await db.delete(webhookEvent);
  await db.delete(webhookSubscription);
  await db.delete(participant);
  await db.delete(week);
  await db.delete(segment);
  await db.delete(season);
  await db.delete(sessions);
}

/**
 * Create multiple participants at once
 */
export async function createMultipleParticipants(db: TestDb, count: number, withTokens: boolean = false): Promise<SelectParticipant[]> {
  const participantsList: SelectParticipant[] = [];
  for (let i = 1; i <= count; i++) {
    const athleteId = String(1000000 + i);
    const newParticipant = await createParticipant(db, athleteId, `Test Participant ${i}`, withTokens);
    participantsList.push(newParticipant);
  }
  return participantsList;
}

interface WeekWithResultsReturn {
  week: SelectWeek;
  activities: (SelectActivity & { segmentEffortId: number; totalTime: number })[];
  results: SelectResult[];
}

/**
 * Create a week with multiple activities and results
 * Convenience function for testing leaderboards
 */
export async function createWeekWithResults(db: TestDb, options: CreateWeekWithResultsOptions): Promise<WeekWithResultsReturn> {
  const {
    seasonId,
    stravaSegmentId,
    weekName = 'Test Week',
    participantIds = [],
    times = []
  } = options;

  const newWeek = await createWeek(db, {
    seasonId,
    stravaSegmentId,
    weekName
  });

  const activities: (SelectActivity & { segmentEffortId: number; totalTime: number })[] = [];
  const results: SelectResult[] = [];

  for (const [index, athleteId] of participantIds.entries()) {
    const totalTime = times[index] || (1000 * (index + 1));

    const newActivity = await createActivity(db, {
      weekId: newWeek.id,
      stravaAthleteId: athleteId,
      stravaActivityId: String(Math.floor(Math.random() * 1000000000)),
      stravaSegmentId,
      elapsedSeconds: totalTime,
      prAchieved: index === 0
    });

    const newResult = await createResult(db, {
      weekId: newWeek.id,
      stravaAthleteId: athleteId,
      activityId: newActivity.id,
      totalTimeSeconds: totalTime,
    });

    activities.push(newActivity as SelectActivity & { segmentEffortId: number; totalTime: number });
    results.push(newResult);
  }

  return { week: newWeek, activities, results };
}

/**
 * Mock the checkAuthorization function for testing
 */

/**
 * Create a mock request object for testing authorization
 */
export function createMockAuthRequest(athleteId: string, isAdmin: boolean = false) {
  return {
    _testAthleteId: athleteId,
    session: {
      stravaAthleteId: isAdmin ? athleteId : null
    },
    path: '/test'
  };
}

/**
 * Helper to make a request with a specific athlete ID in the session
 */
export async function makeRequestAsUser(requestModule: any, app: any, options: {
  method: string;
  path: string;
  athleteId?: string;
  data?: any;
}) {
  const { method = 'get', path, athleteId, data } = options;

  const req = requestModule(app)[method](path);

  // Override session if athleteId provided (simulates non-admin user)
  if (athleteId !== undefined) {
    req.set('X-Override-Athlete-Id', athleteId);
  }

  if (data) {
    req.send(data).set('Content-Type', 'application/json');
  }

  return req;
}

/**
 * Helper: Create activity WITH result entry
 * Automatically calculates and stores results for leaderboard queries
 */
export async function createActivityWithResult(
  db: TestDb,
  options: {
    weekId: number;
    stravaAthleteId: string;
    stravaActivityId: string;
    elapsedSeconds?: number;
    prAchieved?: boolean;
    stravaSegmentId?: string;
  }
): Promise<{ activity: SelectActivity; result: SelectResult }> {
  const { weekId, stravaAthleteId, stravaActivityId, elapsedSeconds = 600, prAchieved = false } = options;

  let stravaSegmentId = options.stravaSegmentId;
  if (!stravaSegmentId) {
    const [weekRecord] = await db
      .select({ stravaSegmentId: week.strava_segment_id })
      .from(week)
      .where(eq(week.id, weekId));
    stravaSegmentId = weekRecord?.stravaSegmentId;
  }

  const activityRecord = await createActivity(db, {
    weekId,
    stravaAthleteId,
    stravaActivityId,
  });

  const resultData = await createResult(db, {
    weekId,
    stravaAthleteId,
    activityId: activityRecord.id,
    totalTimeSeconds: elapsedSeconds,
  });

  // Create segment effort
  await createSegmentEffort(db, {
    activityId: activityRecord.id,
    stravaSegmentId,
    elapsedSeconds,
    prAchieved: prAchieved ? 1 : 0,
  });

  return { activity: activityRecord, result: resultData };
}

// Re-export setupTestDb and teardownTestDb for convenience in test files
import { setupTestDb, teardownTestDb, SeedData } from './setupTestDb';
export { setupTestDb, teardownTestDb };
export type { SeedData };
