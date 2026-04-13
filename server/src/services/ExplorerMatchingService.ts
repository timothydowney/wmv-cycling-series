import { and, eq, gte, lte } from 'drizzle-orm';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
  explorerDestination,
  explorerDestinationMatch,
  explorerWeek,
  type ExplorerWeek,
} from '../db/schema';
import {
  getActivity,
  listAthleteActivities,
  type Activity as StravaActivity,
} from '../stravaClient';
import { isoToUnix } from '../dateUtils';

interface MatchActivityResult {
  processedWeeks: number;
  matchedDestinations: number;
  newMatches: number;
}

interface RefreshAthleteWeekResult {
  activitiesProcessed: number;
  activitiesMatched: number;
  newMatches: number;
}

function getActivityTimestamp(activityData: StravaActivity): number | null {
  return isoToUnix(activityData.start_date);
}

function getSegmentIdsFromActivity(activityData: StravaActivity): Set<string> {
  const segmentIds = new Set<string>();

  for (const effort of activityData.segment_efforts || []) {
    if (effort.segment?.id !== undefined && effort.segment?.id !== null) {
      segmentIds.add(String(effort.segment.id));
    }
  }

  return segmentIds;
}

async function ensureSegmentEfforts(
  activityData: StravaActivity,
  accessToken: string
): Promise<StravaActivity> {
  if (Array.isArray(activityData.segment_efforts) && activityData.segment_efforts.length > 0) {
    return activityData;
  }

  return await getActivity(String(activityData.id), accessToken);
}

export class ExplorerMatchingService {
  constructor(private readonly db: BetterSQLite3Database) {}

  async matchActivity(
    activityData: StravaActivity,
    athleteId: string
  ): Promise<MatchActivityResult> {
    const activityTimestamp = getActivityTimestamp(activityData);
    if (activityTimestamp === null) {
      return {
        processedWeeks: 0,
        matchedDestinations: 0,
        newMatches: 0,
      };
    }

    const activeWeeks = this.db
      .select()
      .from(explorerWeek)
      .where(
        and(
          eq(explorerWeek.status, 'active'),
          lte(explorerWeek.start_at, activityTimestamp),
          gte(explorerWeek.end_at, activityTimestamp)
        )
      )
      .all();

    return this.matchActivityAgainstWeeks(activityData, athleteId, activeWeeks);
  }

  async refreshAthleteWeek(
    explorerWeekId: number,
    athleteId: string,
    accessToken: string
  ): Promise<RefreshAthleteWeekResult> {
    const weekRecord = this.db
      .select()
      .from(explorerWeek)
      .where(eq(explorerWeek.id, explorerWeekId))
      .get();

    if (!weekRecord) {
      return {
        activitiesProcessed: 0,
        activitiesMatched: 0,
        newMatches: 0,
      };
    }

    const activities = await listAthleteActivities(accessToken, weekRecord.start_at, weekRecord.end_at, {
      includeAllEfforts: true,
    });

    let activitiesMatched = 0;
    let newMatches = 0;

    for (const activity of activities) {
      const hydratedActivity = await ensureSegmentEfforts(activity, accessToken);
      const result = await this.matchActivityAgainstWeeks(hydratedActivity, athleteId, [weekRecord]);

      if (result.matchedDestinations > 0) {
        activitiesMatched += 1;
      }

      newMatches += result.newMatches;
    }

    return {
      activitiesProcessed: activities.length,
      activitiesMatched,
      newMatches,
    };
  }

  private async matchActivityAgainstWeeks(
    activityData: StravaActivity,
    athleteId: string,
    weeks: ExplorerWeek[]
  ): Promise<MatchActivityResult> {
    if (weeks.length === 0) {
      return {
        processedWeeks: 0,
        matchedDestinations: 0,
        newMatches: 0,
      };
    }

    const activityTimestamp = getActivityTimestamp(activityData);
    if (activityTimestamp === null) {
      return {
        processedWeeks: weeks.length,
        matchedDestinations: 0,
        newMatches: 0,
      };
    }

    const segmentIds = getSegmentIdsFromActivity(activityData);
    if (segmentIds.size === 0) {
      return {
        processedWeeks: weeks.length,
        matchedDestinations: 0,
        newMatches: 0,
      };
    }

    let matchedDestinations = 0;
    let newMatches = 0;

    for (const weekRecord of weeks) {
      const destinations = this.db
        .select()
        .from(explorerDestination)
        .where(eq(explorerDestination.explorer_week_id, weekRecord.id))
        .all();

      for (const destination of destinations) {
        if (!segmentIds.has(destination.strava_segment_id)) {
          continue;
        }

        matchedDestinations += 1;

        const inserted = this.db
          .insert(explorerDestinationMatch)
          .values({
            explorer_week_id: weekRecord.id,
            explorer_destination_id: destination.id,
            strava_athlete_id: athleteId,
            strava_activity_id: String(activityData.id),
            matched_at: activityTimestamp,
          })
          .onConflictDoNothing({
            target: [
              explorerDestinationMatch.explorer_week_id,
              explorerDestinationMatch.explorer_destination_id,
              explorerDestinationMatch.strava_athlete_id,
            ],
          })
          .run();

        if (inserted.changes > 0) {
          newMatches += 1;
        }
      }
    }

    return {
      processedWeeks: weeks.length,
      matchedDestinations,
      newMatches,
    };
  }
}

export type { MatchActivityResult, RefreshAthleteWeekResult };