import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
  explorerCampaign,
  explorerDestination,
  explorerDestinationMatch,
  season,
  segment,
} from '../db/schema';

interface ExplorerDestinationView {
  id: number;
  stravaSegmentId: string;
  displayLabel: string;
  sourceUrl: string | null;
  surfaceType: string | null;
  category: string | null;
  displayOrder: number;
}

interface ActiveExplorerCampaignView {
  id: number;
  seasonId: number;
  name: string;
  seasonName: string;
  startAt: number;
  endAt: number;
  rulesBlurb: string | null;
  destinations: ExplorerDestinationView[];
}

type ExplorerAdminCampaignView = ActiveExplorerCampaignView;

interface ExplorerProgressDestinationView extends ExplorerDestinationView {
  completed: boolean;
  matchedAt: number | null;
  stravaActivityId: string | null;
}

interface ExplorerCampaignProgressView {
  campaign: {
    id: number;
    seasonId: number;
    name: string;
    seasonName: string;
    startAt: number;
    endAt: number;
    rulesBlurb: string | null;
  };
  completedDestinations: number;
  totalDestinations: number;
  destinations: ExplorerProgressDestinationView[];
}

function resolveDestinationLabel(destination: {
  strava_segment_id: string;
  display_label: string | null;
  cached_name: string | null;
  segment_name: string | null;
}): string {
  return (
    destination.display_label ||
    destination.cached_name ||
    destination.segment_name ||
    `Segment ${destination.strava_segment_id}`
  );
}

function resolveCampaignName(displayName: string | null, seasonName: string): string {
  return displayName || seasonName;
}

export class ExplorerQueryService {
  constructor(private readonly db: BetterSQLite3Database) {}

  getCampaignForSeason(seasonId: number): ExplorerAdminCampaignView | null {
    const campaignRecord = this.db
      .select({
        id: explorerCampaign.id,
        season_id: explorerCampaign.season_id,
        display_name: explorerCampaign.display_name,
        rules_blurb: explorerCampaign.rules_blurb,
        season_name: season.name,
        season_start_at: season.start_at,
        season_end_at: season.end_at,
      })
      .from(explorerCampaign)
      .innerJoin(season, eq(explorerCampaign.season_id, season.id))
      .where(eq(explorerCampaign.season_id, seasonId))
      .get();

    if (!campaignRecord) {
      return null;
    }

    const destinations = this.db
      .select({
        id: explorerDestination.id,
        strava_segment_id: explorerDestination.strava_segment_id,
        display_label: explorerDestination.display_label,
        cached_name: explorerDestination.cached_name,
        source_url: explorerDestination.source_url,
        surface_type: explorerDestination.surface_type,
        category: explorerDestination.category,
        display_order: explorerDestination.display_order,
        segment_name: segment.name,
      })
      .from(explorerDestination)
      .leftJoin(segment, eq(explorerDestination.strava_segment_id, segment.strava_segment_id))
      .where(eq(explorerDestination.explorer_campaign_id, campaignRecord.id))
      .orderBy(asc(explorerDestination.display_order), asc(explorerDestination.id))
      .all();

    return {
      id: campaignRecord.id,
      seasonId: campaignRecord.season_id,
      name: resolveCampaignName(campaignRecord.display_name, campaignRecord.season_name),
      seasonName: campaignRecord.season_name,
      startAt: campaignRecord.season_start_at,
      endAt: campaignRecord.season_end_at,
      rulesBlurb: campaignRecord.rules_blurb,
      destinations: destinations.map((destination) => ({
        id: destination.id,
        stravaSegmentId: destination.strava_segment_id,
        displayLabel: resolveDestinationLabel(destination),
        sourceUrl: destination.source_url,
        surfaceType: destination.surface_type,
        category: destination.category,
        displayOrder: destination.display_order,
      })),
    };
  }

  async getActiveCampaign(
    nowTimestamp: number = Math.floor(Date.now() / 1000)
  ): Promise<ActiveExplorerCampaignView | null> {
    const campaignRecords = this.db
      .select({
        id: explorerCampaign.id,
        season_id: explorerCampaign.season_id,
        display_name: explorerCampaign.display_name,
        rules_blurb: explorerCampaign.rules_blurb,
        season_name: season.name,
        season_start_at: season.start_at,
        season_end_at: season.end_at,
      })
      .from(explorerCampaign)
      .innerJoin(season, eq(explorerCampaign.season_id, season.id))
      .where(
        and(
          lte(season.start_at, nowTimestamp),
          gte(season.end_at, nowTimestamp)
        )
      )
      .orderBy(desc(season.start_at))
      .all();

    for (const campaignRecord of campaignRecords) {
      const destinations = this.db
        .select({
          id: explorerDestination.id,
          strava_segment_id: explorerDestination.strava_segment_id,
          display_label: explorerDestination.display_label,
          cached_name: explorerDestination.cached_name,
          source_url: explorerDestination.source_url,
          surface_type: explorerDestination.surface_type,
          category: explorerDestination.category,
          display_order: explorerDestination.display_order,
          segment_name: segment.name,
        })
        .from(explorerDestination)
        .leftJoin(segment, eq(explorerDestination.strava_segment_id, segment.strava_segment_id))
        .where(eq(explorerDestination.explorer_campaign_id, campaignRecord.id))
        .orderBy(asc(explorerDestination.display_order), asc(explorerDestination.id))
        .all();

      if (destinations.length === 0) {
        continue;
      }

      return {
        id: campaignRecord.id,
        seasonId: campaignRecord.season_id,
        name: resolveCampaignName(campaignRecord.display_name, campaignRecord.season_name),
        seasonName: campaignRecord.season_name,
        startAt: campaignRecord.season_start_at,
        endAt: campaignRecord.season_end_at,
        rulesBlurb: campaignRecord.rules_blurb,
        destinations: destinations.map((destination) => ({
          id: destination.id,
          stravaSegmentId: destination.strava_segment_id,
          displayLabel: resolveDestinationLabel(destination),
          sourceUrl: destination.source_url,
          surfaceType: destination.surface_type,
          category: destination.category,
          displayOrder: destination.display_order,
        })),
      };
    }

    return null;
  }

  async getCampaignProgress(
    explorerCampaignId: number,
    athleteId: string
  ): Promise<ExplorerCampaignProgressView | null> {
    const campaignRecord = this.db
      .select({
        id: explorerCampaign.id,
        season_id: explorerCampaign.season_id,
        display_name: explorerCampaign.display_name,
        rules_blurb: explorerCampaign.rules_blurb,
        season_name: season.name,
        season_start_at: season.start_at,
        season_end_at: season.end_at,
      })
      .from(explorerCampaign)
      .innerJoin(season, eq(explorerCampaign.season_id, season.id))
      .where(eq(explorerCampaign.id, explorerCampaignId))
      .get();

    if (!campaignRecord) {
      return null;
    }

    const destinations = this.db
      .select({
        id: explorerDestination.id,
        strava_segment_id: explorerDestination.strava_segment_id,
        display_label: explorerDestination.display_label,
        cached_name: explorerDestination.cached_name,
        source_url: explorerDestination.source_url,
        surface_type: explorerDestination.surface_type,
        category: explorerDestination.category,
        display_order: explorerDestination.display_order,
        segment_name: segment.name,
      })
      .from(explorerDestination)
      .leftJoin(segment, eq(explorerDestination.strava_segment_id, segment.strava_segment_id))
      .where(eq(explorerDestination.explorer_campaign_id, explorerCampaignId))
      .orderBy(asc(explorerDestination.display_order), asc(explorerDestination.id))
      .all();

    const matches = this.db
      .select({
        explorer_destination_id: explorerDestinationMatch.explorer_destination_id,
        matched_at: explorerDestinationMatch.matched_at,
        strava_activity_id: explorerDestinationMatch.strava_activity_id,
      })
      .from(explorerDestinationMatch)
      .where(
        and(
          eq(explorerDestinationMatch.explorer_campaign_id, explorerCampaignId),
          eq(explorerDestinationMatch.strava_athlete_id, athleteId)
        )
      )
      .all();

    const matchesByDestinationId = new Map(matches.map((match) => [match.explorer_destination_id, match]));

    const progressDestinations = destinations.map((destination) => {
      const match = matchesByDestinationId.get(destination.id);

      return {
        id: destination.id,
        stravaSegmentId: destination.strava_segment_id,
        displayLabel: resolveDestinationLabel(destination),
        sourceUrl: destination.source_url,
        surfaceType: destination.surface_type,
        category: destination.category,
        displayOrder: destination.display_order,
        completed: Boolean(match),
        matchedAt: match?.matched_at || null,
        stravaActivityId: match?.strava_activity_id || null,
      };
    });

    return {
      campaign: {
        id: campaignRecord.id,
        seasonId: campaignRecord.season_id,
        name: resolveCampaignName(campaignRecord.display_name, campaignRecord.season_name),
        seasonName: campaignRecord.season_name,
        startAt: campaignRecord.season_start_at,
        endAt: campaignRecord.season_end_at,
        rulesBlurb: campaignRecord.rules_blurb,
      },
      completedDestinations: progressDestinations.filter((destination) => destination.completed).length,
      totalDestinations: progressDestinations.length,
      destinations: progressDestinations,
    };
  }
}

export type { ActiveExplorerCampaignView, ExplorerAdminCampaignView, ExplorerCampaignProgressView };