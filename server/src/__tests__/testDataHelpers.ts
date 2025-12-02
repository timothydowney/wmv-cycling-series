import { BetterSQLite3Database as DrizzleBetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { isoToUnix } from '../dateUtils';
import { season, activity, participant, participantToken, result, segment, segmentEffort, week, deletionRequest } from '../db/schema';
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
export type InsertActivity = InferInsertModel<typeof activity>;   // Exported
export type SelectActivity = InferSelectModel<typeof activity>;
export type InsertResult = InferInsertModel<typeof result>;       // Exported
export type SelectResult = InferSelectModel<typeof result>;
export type InsertSegmentEffort = InferInsertModel<typeof segmentEffort>;
export type SelectSegmentEffort = InferSelectModel<typeof segmentEffort>;
export type InsertParticipantToken = InferInsertModel<typeof participantToken>;

// Type for the database instance passed to helper functions - using Drizzle instance now
type TestDb = DrizzleBetterSQLite3Database;

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
  stravaActivityId?: number; 
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
}

interface CreateFullUserOptions {
  stravaAthleteId: number;
  name?: string;
  seasonName?: string;
  weekName?: string;
  stravaSegmentId?: number;
  stravaActivityId?: number;
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
export function createParticipant(db: TestDb, stravaAthleteId: number, name: string | null = null, withToken: boolean | TokenOptions = false): SelectParticipant {
  const participantName = name || `Test User ${stravaAthleteId}`;
  
  const newParticipant: InsertParticipant = {
    strava_athlete_id: stravaAthleteId,
    name: participantName,
  };

  const insertedParticipant = db.insert(participant).values(newParticipant).returning().get();
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
      expiresAt = Math.floor(Date.now() / 1000) + 3600; // Default value
    }
    
    const newParticipantToken: InsertParticipantToken = {
      strava_athlete_id: stravaAthleteId,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt
    };
    db.insert(participantToken).values(newParticipantToken).run();
    console.log(`[TEST_HELPER] Created Token for Participant ${stravaAthleteId}`);
  }
  
  return insertedParticipant;
}

/**
 * Create a test season
 */
export function createSeason(db: TestDb, name: string = 'Test Season', isActive: boolean = true, options: CreateSeasonOptions = {}): SelectSeason {
  const startAt = options.startAt || isoToUnix('2025-01-01T00:00:00Z');
  const endAt = options.endAt || isoToUnix('2025-12-31T23:59:59Z');
  
  // Do not provide 'id' for autoIncrement primary key
  const newSeasonData: InsertSeason = {
    name: name,
    start_at: startAt || 0, // Ensure number
    end_at: endAt || 0,     // Ensure number
    is_active: isActive ? 1 : 0
  };
  
  const newSeason = db.insert(season).values(newSeasonData).returning().get();
  console.log(`[TEST_HELPER] Created Season: id=${newSeason.id}, name=${newSeason.name}`);
  return newSeason;
}

/**
 * Create a test segment
 */
export function createSegment(db: TestDb, stravaSegmentId: number, name: string | null = null, options: CreateSegmentOptions = {}): SelectSegment {
  const segmentName = name || `Segment ${stravaSegmentId}`;
  
  const newSegmentData: InsertSegment = {
    strava_segment_id: stravaSegmentId,
    name: segmentName,
    distance: options.distance,
    average_grade: options.averageGrade,
    city: options.city,
    state: options.state,
    country: options.country
  };
  const newSegment = db.insert(segment).values(newSegmentData).returning().get();
  console.log(`[TEST_HELPER] Created Segment: id=${newSegment.strava_segment_id}, name=${newSegment.name}`);
  return newSegment;
}

/**
 * Create a test week
 */
export function createWeek(db: TestDb, options: CreateWeekOptions): SelectWeek {
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
  
  const newWeekData: InsertWeek = {
    season_id: seasonId,
    week_name: weekName,
    strava_segment_id: stravaSegmentId,
    required_laps: requiredLaps,
    start_at: startAtUnix || 0, // Ensure number
    end_at: endAtUnix || 0
  };
  const newWeek = db.insert(week).values(newWeekData).returning().get();
  console.log(`[TEST_HELPER] Created Week: id=${newWeek.id}, name=${newWeek.week_name}, seasonId=${newWeek.season_id}, segmentId=${newWeek.strava_segment_id}`);
  return newWeek;
}

/**
 * Create a test activity with segment efforts
 */
export function createActivity(db: TestDb, options: CreateActivityOptions): SelectActivity & { segmentEffortId: number; totalTime: number } {
  const {
    weekId,
    stravaAthleteId,
    stravaActivityId = Math.floor(Math.random() * 1000000000), // Generate a random number
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
  const newActivityData: InsertActivity = {
    week_id: weekId,
    strava_athlete_id: stravaAthleteId,
    strava_activity_id: stravaActivityId,
    start_at: activityStartAtUnix || 0, // Ensure number
    validation_status: 'valid'
  };
  const newActivity = db.insert(activity).values(newActivityData).returning().get();
  console.log(`[TEST_HELPER] Created Activity: id=${newActivity.id}, weekId=${newActivity.week_id}, athleteId=${newActivity.strava_athlete_id}, stravaActivityId=${newActivity.strava_activity_id}`);
  
  // Create segment effort
  const newSegmentEffortData: InsertSegmentEffort = {
    activity_id: newActivity.id,
    strava_segment_id: stravaSegmentId,
    effort_index: 0, // Assuming first effort by default
    elapsed_seconds: elapsedSeconds,
    start_at: effortStartAtUnix || 0, // Ensure number
    pr_achieved: prAchieved ? 1 : 0,
    strava_effort_id: String(Math.floor(Math.random() * 1000000000000000000))
  };
  const newSegmentEffort = db.insert(segmentEffort).values(newSegmentEffortData).returning().get();
  console.log(`[TEST_HELPER] Created SegmentEffort: id=${newSegmentEffort.id}, activityId=${newSegmentEffort.activity_id}, segmentId=${newSegmentEffort.strava_segment_id}`);
  
  return {
    ...newActivity,
    segmentEffortId: newSegmentEffort.id,
    totalTime: elapsedSeconds
  };
}

/**
 * Create a test result record
 */
export function createResult(db: TestDb, options: CreateResultOptions): SelectResult {
  const { weekId, stravaAthleteId, activityId = null, totalTimeSeconds = 1000 } = options; // Removed rank, total_points, etc.

  const newResultData: InsertResult = {
    week_id: weekId,
    strava_athlete_id: stravaAthleteId,
    activity_id: activityId,
    total_time_seconds: totalTimeSeconds,
  };
  const newResult = db.insert(result).values(newResultData).returning().get();
  console.log(`[TEST_HELPER] Created Result: id=${newResult.id}, weekId=${newResult.week_id}, athleteId=${newResult.strava_athlete_id}`);
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
    stravaActivityId: stravaActivityId || Math.floor(Math.random() * 1000000000),
    stravaSegmentId: newSegment.strava_segment_id
  });
  
  const newResult = createResult(db, {
    weekId: newWeek.id,
    stravaAthleteId: newParticipant.strava_athlete_id,
    activityId: newActivity.id,
    totalTimeSeconds: newActivity.totalTime,
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
export function clearAllData(db: TestDb) {
  // Use Drizzle to delete from tables
  db.delete(deletionRequest).run();
  db.delete(segmentEffort).run();
  db.delete(result).run();
  db.delete(activity).run();
  db.delete(participantToken).run();
  db.delete(participant).run();
  db.delete(week).run();
  db.delete(segment).run();
  db.delete(season).run();
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
      stravaActivityId: Math.floor(Math.random() * 1000000000),
      stravaSegmentId,
      elapsedSeconds: totalTime,
      prAchieved: index === 0 // First person gets PR
    });
    
    // Determine rank for createResult - not passed to result.values, but needed for test
    // const currentTimes = times.slice(0, index + 1);
    // const sortedCurrentTimes = [...currentTimes].sort((a, b) => a - b);
    // const rank = sortedCurrentTimes.indexOf(totalTime) + 1; // Unused

    const newResult = createResult(db, {
      weekId: newWeek.id,
      stravaAthleteId: athleteId,
      activityId: newActivity.id,
      totalTimeSeconds: totalTime,
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
export { setupTestDb, teardownTestDb };
export type { SeedData };