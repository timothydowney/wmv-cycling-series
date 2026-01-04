import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { week, result, activity } from '../db/schema';
import { eq, and, lt, desc } from 'drizzle-orm';

export interface GhostData {
  previous_time_seconds: number;
  previous_week_name: string;
  strava_activity_id?: string;
}

export class GhostService {
  constructor(private db: BetterSQLite3Database) {}

  /**
   * Finds the most recent previous week with the same segment and required laps,
   * and returns a map of participant_id -> GhostData (their time in that previous week).
   */
  async getGhostData(
    currentWeekId: number,
    stravaSegmentId: string,
    requiredLaps: number
  ): Promise<Map<string, GhostData>> {
    // 1. Find the most recent previous week with same segment and laps
    // We use start_at to ensure chronological order, finding the latest one that started before the current week
    // We also filter by ID < currentWeekId as a secondary check to avoid self-reference if dates are same
    
    // First get current week start time to compare
    const currentWeek = await this.db
      .select({ start_at: week.start_at })
      .from(week)
      .where(eq(week.id, currentWeekId))
      .get();
        
    if (!currentWeek) {
      return new Map();
    }

    const previousWeek = await this.db
      .select({
        id: week.id,
        week_name: week.week_name,
        start_at: week.start_at,
      })
      .from(week)
      .where(
        and(
          eq(week.strava_segment_id, stravaSegmentId),
          eq(week.required_laps, requiredLaps),
          lt(week.start_at, currentWeek.start_at)
        )
      )
      .orderBy(desc(week.start_at)) // Order by start_at desc to get most recent
      .limit(1)
      .get();

    if (!previousWeek) {
      return new Map();
    }

    // 2. Fetch results for that previous week
    const previousResults = await this.db
      .select({
        participant_id: result.strava_athlete_id,
        total_time_seconds: result.total_time_seconds,
        strava_activity_id: activity.strava_activity_id,
      })
      .from(result)
      .leftJoin(activity, eq(result.activity_id, activity.id))
      .where(eq(result.week_id, previousWeek.id))
      .all();

    // 3. Build the map
    const ghostMap = new Map<string, GhostData>();
    for (const res of previousResults) {
      ghostMap.set(res.participant_id, {
        previous_time_seconds: res.total_time_seconds,
        previous_week_name: previousWeek.week_name,
        strava_activity_id: res.strava_activity_id || undefined,
      });
    }

    return ghostMap;
  }
}
