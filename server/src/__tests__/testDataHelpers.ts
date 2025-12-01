import { Database as BetterSqlite3Database } from 'better-sqlite3'; // Renamed to avoid conflict with Drizzle's Database type
import { isoToUnix } from '../dateUtils';
import { drizzleDb } from '../db';
import { season, activity, participant, participantToken, result, segment, segmentEffort, week, deletionRequest } from '../db/schema';
import { InferSelectModel } from 'drizzle-orm';

// Type definitions for Drizzle models
type SelectParticipant = InferSelectModel<typeof participant>;
type SelectSeason = InferSelectModel<typeof season>;
type SelectSegment = InferSelectModel<typeof segment>;
type SelectWeek = InferSelectModel<typeof week>;
type SelectActivity = InferSelectModel<typeof activity>;
type SelectResult = InferSelectModel<typeof result>;

// Type for the database instance passed to helper functions
type TestDb = BetterSqlite3Database;

interface TokenOptions {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

interface CreateSeasonOptions {
  seasonId?: number;
  startAt?: number;
  endAt?: number;
}

interface CreateSegmentOptions {
  distance?: number | null;
  averageGrade?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

interface CreateWeekOptions {
  seasonId: number;
  stravaSegmentId: number;
  weekName?: string;
  date?: string;
  requiredLaps?: number;
  startTime?: string;
  endTime?: string;
}

interface CreateActivityOptions {
  weekId: number;
  stravaAthleteId: number;
  stravaActivityId?: string;
  stravaSegmentId: number;
  elapsedSeconds?: number;
  prAchieved?: boolean;
  activityStartTime?: string;
  effortStartTime?: string;
}

interface CreateResultOptions {
  weekId: number;
  stravaAthleteId: number;
  activityId?: number | null;
  totalTimeSeconds?: number;
  rank?: number;
}

interface CreateFullUserOptions {
  stravaAthleteId: number;
  name?: string;
  seasonName?: string;
  weekName?: string;
  stravaSegmentId?: number;
  stravaActivityId?: string;
}

interface CreateWeekWithResultsOptions {
  seasonId: number;
  stravaSegmentId: number;
  weekName?: string;
  participantIds?: number[];
  times?: number[];
}

/**
 * Create a test participant with optional token
 */
export function createParticipant(_db: TestDb, stravaAthleteId: number, name: string | null = null, withToken: boolean | TokenOptions = false): SelectParticipant {
  const participantName = name || `Test User ${stravaAthleteId}`;
  
  const newParticipant = drizzleDb.insert(participant).values({
    strava_athlete_id: stravaAthleteId,
    name: participantName,
  } as any).returning().get();

  if (withToken) {
    let accessToken: string, refreshToken: string, expiresAt: number;
    
    if (typeof withToken === 'object') {
      accessToken = withToken.accessToken || `token_${stravaAthleteId}`;
      refreshToken = withToken.refreshToken || `refresh_${stravaAthleteId}`;
      expiresAt = withToken.expiresAt || (Math.floor(Date.now() / 1000) + 3600);
    } else {
      accessToken = `token_${stravaAthleteId}`;
      refreshToken = `refresh_${stravaAthleteId}`;
      expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    }
    
    drizzleDb.insert(participantToken).values({
      strava_athlete_id: stravaAthleteId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt
    } as any).run();
  }
  
  return newParticipant;
}

/**
 * Create a test season
 */
export function createSeason(_db: TestDb, name: string = 'Test Season', isActive: boolean = true, options: CreateSeasonOptions = {}): SelectSeason {
  const startAt = options.startAt || isoToUnix('2025-01-01T00:00:00Z');
  const endAt = options.endAt || isoToUnix('2025-12-31T23:59:59Z');
  
  let newSeason: SelectSeason;
  if (options.seasonId) {
    newSeason = drizzleDb.insert(season).values({
      id: options.seasonId,
      name: name,
      start_at: startAt,
      end_at: endAt,
      is_active: isActive ? 1 : 0
    } as any).returning().get();
  } else {
    newSeason = drizzleDb.insert(season).values({
      name: name,
      start_at: startAt,
      end_at: endAt,
      is_active: isActive ? 1 : 0
    } as any).returning().get();
  }
  return newSeason;
}

/**
 * Create a test segment
 */
export function createSegment(_db: TestDb, stravaSegmentId: number, name: string | null = null, options: CreateSegmentOptions = {}): SelectSegment {
  const segmentName = name || `Segment ${stravaSegmentId}`;
  
  const newSegment = drizzleDb.insert(segment).values({
    strava_segment_id: stravaSegmentId,
    name: segmentName,
    distance: options.distance,
    average_grade: options.averageGrade,
    city: options.city,
    state: options.state,
    country: options.country
  } as any).returning().get();
  
  return newSegment;
}

/**
 * Create a test week
 */
export function createWeek(_db: TestDb, options: CreateWeekOptions): SelectWeek {
  const {
    seasonId,
    stravaSegmentId,
    weekName = 'Test Week',
    requiredLaps = 1,
    startTime = '2025-06-01T00:00:00Z',
    endTime = '2025-06-01T22:00:00Z'
  } = options;
  
  // Convert ISO 8601 times to Unix timestamps (UTC seconds)
  const startAtUnix = isoToUnix(startTime);
  const endAtUnix = isoToUnix(endTime);
  
  const newWeek = drizzleDb.insert(week).values({
    season_id: seasonId,
    week_name: weekName,
    strava_segment_id: stravaSegmentId,
    required_laps: requiredLaps,
    start_at: startAtUnix,
    end_at: endAtUnix
  } as any).returning().get();
  
  return newWeek;
}

/**
 * Create a test activity with segment efforts
 */
export function createActivity(_db: TestDb, options: CreateActivityOptions): SelectActivity & { segmentEffortId: number; totalTime: number } {
  const {
    weekId,
    stravaAthleteId,
    stravaActivityId = `${stravaAthleteId}-activity-${Math.random().toString(36).substring(7)}`,
    stravaSegmentId,
    elapsedSeconds = 1000,
    prAchieved = false,
    activityStartTime = '2025-06-01T10:00:00Z',
    effortStartTime = '2025-06-01T10:05:00Z'
  } = options;
  
  // Convert ISO 8601 times to Unix timestamps
  const activityStartAtUnix = isoToUnix(activityStartTime);
  const effortStartAtUnix = isoToUnix(effortStartTime);
  
  // Create activity
  const newActivity = drizzleDb.insert(activity).values({
    week_id: weekId,
    strava_athlete_id: stravaAthleteId,
    strava_activity_id: stravaActivityId,
    start_at: activityStartAtUnix,
    validation_status: 'valid'
  } as any).returning().get();
  
  // Create segment effort
  const newSegmentEffort = drizzleDb.insert(segmentEffort).values({
    activity_id: newActivity.id,
    strava_segment_id: stravaSegmentId,
    effort_index: 0, // Assuming first effort by default
    elapsed_seconds: elapsedSeconds,
    start_at: effortStartAtUnix,
    pr_achieved: prAchieved ? 1 : 0,
    strava_effort_id: String(Math.floor(Math.random() * 1000000000000000000))
  } as any).returning().get();
  
  return {
    ...newActivity,
    segmentEffortId: newSegmentEffort.id,
    totalTime: elapsedSeconds
  };
}

/**
 * Create a test result record
 */
export function createResult(_db: TestDb, options: CreateResultOptions): SelectResult {
  const { weekId, stravaAthleteId, activityId = null, totalTimeSeconds = 1000, rank = 1 } = options;

  const newResult = drizzleDb.insert(result).values({
    week_id: weekId,
    strava_athlete_id: stravaAthleteId,
    activity_id: activityId,
    total_time_seconds: totalTimeSeconds,
    rank: rank,
    total_points: 0, // Default, can be updated later
    base_points: 0,
    pr_bonus_points: 0
  } as any).returning().get();

  return newResult;
}

interface FullUserWithActivityReturn {
  participant: SelectParticipant;
  season: SelectSeason;
  segment: SelectSegment;
  week: SelectWeek;
  activity: SelectActivity & { segmentEffortId: number; totalTime: number };
  result: SelectResult;
}

/**
 * Create a complete test user with all related data
 * Convenience function for common test scenario
 */
export function createFullUserWithActivity(db: TestDb, options: CreateFullUserOptions): FullUserWithActivityReturn {
  const {
    stravaAthleteId,
    name = `Test User ${stravaAthleteId}`,
    seasonName = 'Test Season',
    weekName = 'Test Week',
    stravaSegmentId = 99999,
    stravaActivityId
  } = options;
  
  const newParticipant = createParticipant(db, stravaAthleteId, name, true);
  const newSeason = createSeason(db, seasonName, true);
  const newSegment = createSegment(db, stravaSegmentId);
  const newWeek = createWeek(db, {
    seasonId: newSeason.id,
    stravaSegmentId: newSegment.strava_segment_id,
    weekName
  });
  
  const newActivity = createActivity(db, {
    weekId: newWeek.id,
    stravaAthleteId: newParticipant.strava_athlete_id,
    stravaActivityId: stravaActivityId || `${stravaAthleteId}-activity-1`,
    stravaSegmentId: newSegment.strava_segment_id
  });
  
  const newResult = createResult(db, {
    weekId: newWeek.id,
    stravaAthleteId: newParticipant.strava_athlete_id,
    activityId: newActivity.id,
    totalTimeSeconds: newActivity.totalTime,
    rank: 1
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
 * Clear all test data (truncate all tables)
 * Useful for test cleanup
 */
export function clearAllData(_db: TestDb) {
  // Use Drizzle to delete from tables
  drizzleDb.delete(deletionRequest).run();
  drizzleDb.delete(segmentEffort).run();
  drizzleDb.delete(result).run();
  drizzleDb.delete(activity).run();
  drizzleDb.delete(participantToken).run();
  drizzleDb.delete(participant).run();
  drizzleDb.delete(week).run();
  drizzleDb.delete(segment).run();
  drizzleDb.delete(season).run();
}

/**
 * Create multiple participants at once
 */
export function createMultipleParticipants(db: TestDb, count: number, withTokens: boolean = false): SelectParticipant[] {
  const participantsList: SelectParticipant[] = [];
  for (let i = 1; i <= count; i++) {
    const athleteId = 1000000 + i;
    const newParticipant = createParticipant(db, athleteId, `Test Participant ${i}`, withTokens);
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
export function createWeekWithResults(db: TestDb, options: CreateWeekWithResultsOptions): WeekWithResultsReturn {
  const {
    seasonId,
    stravaSegmentId,
    weekName = 'Test Week',
    participantIds = [],
    times = []
  } = options;
  
  const newWeek = createWeek(db, {
    seasonId,
    stravaSegmentId,
    weekName
  });
  
  const activities: (SelectActivity & { segmentEffortId: number; totalTime: number })[] = [];
  const results: SelectResult[] = [];
  
  participantIds.forEach((athleteId, index) => {
    const totalTime = times[index] || (1000 * (index + 1)); // Default: 1000, 2000, 3000...
    
    const newActivity = createActivity(db, {
      weekId: newWeek.id,
      stravaAthleteId: athleteId,
      stravaActivityId: `${athleteId}-week-${newWeek.id}-activity-${index + 1}`,
      stravaSegmentId,
      elapsedSeconds: totalTime,
      prAchieved: index === 0 // First person gets PR
    });
    
    // Determine rank for createResult
    const currentTimes = times.slice(0, index + 1);
    const sortedCurrentTimes = [...currentTimes].sort((a, b) => a - b);
    const rank = sortedCurrentTimes.indexOf(totalTime) + 1;

    const newResult = createResult(db, {
      weekId: newWeek.id,
      stravaAthleteId: athleteId,
      activityId: newActivity.id,
      totalTimeSeconds: totalTime,
      rank: rank
    });
    
    activities.push(newActivity);
    results.push(newResult);
  });
  
  return { week: newWeek, activities, results };
}

/**
 * Mock the checkAuthorization function for testing
 */

/**
 * Create a mock request object for testing authorization
 */
export function createMockAuthRequest(athleteId: number, isAdmin: boolean = false) {
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
  athleteId?: number;
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

// Re-export setupTestDb and teardownTestDb for convenience in test files
import { setupTestDb, teardownTestDb, SeedData } from './setupTestDb';
export { setupTestDb, teardownTestDb, SeedData };