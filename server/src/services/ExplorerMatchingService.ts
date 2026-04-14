import { and, eq, gte, lte } from 'drizzle-orm';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
  explorerCampaign,
  explorerDestination,
  explorerDestinationMatch,
  season,
} from '../db/schema';
import {
  getActivity,
  listAthleteActivities,
  type Activity as StravaActivity,
} from '../stravaClient';
import { isoToUnix } from '../dateUtils';

interface MatchActivityResult {
  processedCampaigns: number;
  matchedDestinations: number;
  newMatches: number;
}

interface RefreshAthleteCampaignResult {
  activitiesProcessed: number;
  activitiesMatched: number;
  newMatches: number;
}

interface CampaignWindowRecord {
  id: number;
  season_id: number;
  display_name: string | null;
  rules_blurb: string | null;
  season_start_at: number;
  season_end_at: number;
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
        processedCampaigns: 0,
        matchedDestinations: 0,
        newMatches: 0,
      };
    }

    const activeCampaigns = this.db
      .select({
        id: explorerCampaign.id,
        season_id: explorerCampaign.season_id,
        display_name: explorerCampaign.display_name,
        rules_blurb: explorerCampaign.rules_blurb,
        season_start_at: season.start_at,
        season_end_at: season.end_at,
      })
      .from(explorerCampaign)
      .innerJoin(season, eq(explorerCampaign.season_id, season.id))
      .where(
        and(
          lte(season.start_at, activityTimestamp),
          gte(season.end_at, activityTimestamp)
        )
      )
      .all();

    return this.matchActivityAgainstCampaigns(activityData, athleteId, activeCampaigns);
  }

  async refreshAthleteCampaign(
    explorerCampaignId: number,
    athleteId: string,
    accessToken: string
  ): Promise<RefreshAthleteCampaignResult> {
    const campaignRecord = this.db
      .select({
        id: explorerCampaign.id,
        season_id: explorerCampaign.season_id,
        display_name: explorerCampaign.display_name,
        rules_blurb: explorerCampaign.rules_blurb,
        season_start_at: season.start_at,
        season_end_at: season.end_at,
      })
      .from(explorerCampaign)
      .innerJoin(season, eq(explorerCampaign.season_id, season.id))
      .where(eq(explorerCampaign.id, explorerCampaignId))
      .get();

    if (!campaignRecord) {
      return {
        activitiesProcessed: 0,
        activitiesMatched: 0,
        newMatches: 0,
      };
    }

    const activities = await listAthleteActivities(
      accessToken,
      campaignRecord.season_start_at,
      campaignRecord.season_end_at,
      {
        includeAllEfforts: true,
      }
    );

    let activitiesMatched = 0;
    let newMatches = 0;

    for (const activity of activities) {
      const hydratedActivity = await ensureSegmentEfforts(activity, accessToken);
      const result = await this.matchActivityAgainstCampaigns(hydratedActivity, athleteId, [campaignRecord]);

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

  private async matchActivityAgainstCampaigns(
    activityData: StravaActivity,
    athleteId: string,
    campaigns: CampaignWindowRecord[]
  ): Promise<MatchActivityResult> {
    if (campaigns.length === 0) {
      return {
        processedCampaigns: 0,
        matchedDestinations: 0,
        newMatches: 0,
      };
    }

    const activityTimestamp = getActivityTimestamp(activityData);
    if (activityTimestamp === null) {
      return {
        processedCampaigns: campaigns.length,
        matchedDestinations: 0,
        newMatches: 0,
      };
    }

    const segmentIds = getSegmentIdsFromActivity(activityData);
    if (segmentIds.size === 0) {
      return {
        processedCampaigns: campaigns.length,
        matchedDestinations: 0,
        newMatches: 0,
      };
    }

    let matchedDestinations = 0;
    let newMatches = 0;

    for (const campaignRecord of campaigns) {
      const destinations = this.db
        .select()
        .from(explorerDestination)
        .where(eq(explorerDestination.explorer_campaign_id, campaignRecord.id))
        .all();

      for (const destination of destinations) {
        if (!segmentIds.has(destination.strava_segment_id)) {
          continue;
        }

        matchedDestinations += 1;

        const inserted = this.db
          .insert(explorerDestinationMatch)
          .values({
            explorer_campaign_id: campaignRecord.id,
            explorer_destination_id: destination.id,
            strava_athlete_id: athleteId,
            strava_activity_id: String(activityData.id),
            matched_at: activityTimestamp,
          })
          .onConflictDoNothing({
            target: [
              explorerDestinationMatch.explorer_campaign_id,
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
      processedCampaigns: campaigns.length,
      matchedDestinations,
      newMatches,
    };
  }
}

export type { MatchActivityResult, RefreshAthleteCampaignResult };