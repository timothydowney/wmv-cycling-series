import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
  explorerCampaign,
  explorerDestination,
  explorerDestinationMatch,
  segment,
} from '../db/schema';

interface ExplorerDestinationView {
  id: number;
  stravaSegmentId: string;
  displayLabel: string;
  customLabel: string | null;
  segmentName: string;
  sourceUrl: string | null;
  createdAt: string | null;
  distance: number | null;
  averageGrade: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  surfaceType: string | null;
  category: string | null;
  displayOrder: number;
}

interface ExplorerCampaignBaseView {
  id: number;
  name: string;
  startAt: number;
  endAt: number;
  rulesBlurb: string | null;
}

interface ActiveExplorerCampaignView extends ExplorerCampaignBaseView {
  destinations: ExplorerDestinationView[];
}

interface ExplorerAdminCampaignView extends ExplorerCampaignBaseView {
  destinations: ExplorerDestinationView[];
}

interface ExplorerProgressDestinationView extends ExplorerDestinationView {
  completed: boolean;
  matchedAt: number | null;
  stravaActivityId: string | null;
}

interface ExplorerCampaignProgressView {
  campaign: ExplorerCampaignBaseView;
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

function resolveCampaignName(displayName: string | null): string {
  return displayName || 'Explorer Campaign';
}

function resolveSegmentName(destination: {
  strava_segment_id: string;
  cached_name: string | null;
  segment_name: string | null;
}): string {
  return destination.segment_name || destination.cached_name || `Segment ${destination.strava_segment_id}`;
}

export class ExplorerQueryService {
  constructor(private readonly db: BetterSQLite3Database) {}

  private listDestinations(explorerCampaignId: number): ExplorerDestinationView[] {
    const destinations = this.db
      .select({
        id: explorerDestination.id,
        strava_segment_id: explorerDestination.strava_segment_id,
        display_label: explorerDestination.display_label,
        cached_name: explorerDestination.cached_name,
        source_url: explorerDestination.source_url,
        created_at: explorerDestination.created_at,
        surface_type: explorerDestination.surface_type,
        category: explorerDestination.category,
        display_order: explorerDestination.display_order,
        segment_name: segment.name,
        distance: segment.distance,
        average_grade: segment.average_grade,
        city: segment.city,
        state: segment.state,
        country: segment.country,
      })
      .from(explorerDestination)
      .leftJoin(segment, eq(explorerDestination.strava_segment_id, segment.strava_segment_id))
      .where(eq(explorerDestination.explorer_campaign_id, explorerCampaignId))
      .orderBy(asc(explorerDestination.display_order), asc(explorerDestination.id))
      .all();

    return destinations.map((destination) => ({
      id: destination.id,
      stravaSegmentId: destination.strava_segment_id,
      displayLabel: resolveDestinationLabel(destination),
      customLabel: destination.display_label,
      segmentName: resolveSegmentName(destination),
      sourceUrl: destination.source_url,
      createdAt: destination.created_at,
      distance: destination.distance,
      averageGrade: destination.average_grade,
      city: destination.city,
      state: destination.state,
      country: destination.country,
      surfaceType: destination.surface_type,
      category: destination.category,
      displayOrder: destination.display_order,
    }));
  }

  getAdminCampaigns(): ExplorerAdminCampaignView[] {
    const campaigns = this.db
      .select({
        id: explorerCampaign.id,
        start_at: explorerCampaign.start_at,
        end_at: explorerCampaign.end_at,
        display_name: explorerCampaign.display_name,
        rules_blurb: explorerCampaign.rules_blurb,
      })
      .from(explorerCampaign)
      .orderBy(desc(explorerCampaign.start_at), desc(explorerCampaign.id))
      .all();

    return campaigns.map((campaign) => ({
      id: campaign.id,
      name: resolveCampaignName(campaign.display_name),
      startAt: campaign.start_at,
      endAt: campaign.end_at,
      rulesBlurb: campaign.rules_blurb,
      destinations: this.listDestinations(campaign.id),
    }));
  }

  async getActiveCampaign(
    nowTimestamp: number = Math.floor(Date.now() / 1000)
  ): Promise<ActiveExplorerCampaignView | null> {
    const campaignRecords = this.db
      .select({
        id: explorerCampaign.id,
        start_at: explorerCampaign.start_at,
        end_at: explorerCampaign.end_at,
        display_name: explorerCampaign.display_name,
        rules_blurb: explorerCampaign.rules_blurb,
      })
      .from(explorerCampaign)
      .where(
        and(
          lte(explorerCampaign.start_at, nowTimestamp),
          gte(explorerCampaign.end_at, nowTimestamp)
        )
      )
      .orderBy(desc(explorerCampaign.start_at), desc(explorerCampaign.id))
      .all();

    for (const campaignRecord of campaignRecords) {
      const destinations = this.listDestinations(campaignRecord.id);

      if (destinations.length === 0) {
        continue;
      }

      return {
        id: campaignRecord.id,
        name: resolveCampaignName(campaignRecord.display_name),
        startAt: campaignRecord.start_at,
        endAt: campaignRecord.end_at,
        rulesBlurb: campaignRecord.rules_blurb,
        destinations,
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
        start_at: explorerCampaign.start_at,
        end_at: explorerCampaign.end_at,
        display_name: explorerCampaign.display_name,
        rules_blurb: explorerCampaign.rules_blurb,
      })
      .from(explorerCampaign)
      .where(eq(explorerCampaign.id, explorerCampaignId))
      .get();

    if (!campaignRecord) {
      return null;
    }

    const destinations = this.listDestinations(explorerCampaignId);
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
        ...destination,
        completed: Boolean(match),
        matchedAt: match?.matched_at ?? null,
        stravaActivityId: match?.strava_activity_id ?? null,
      };
    });

    return {
      campaign: {
        id: campaignRecord.id,
        name: resolveCampaignName(campaignRecord.display_name),
        startAt: campaignRecord.start_at,
        endAt: campaignRecord.end_at,
        rulesBlurb: campaignRecord.rules_blurb,
      },
      completedDestinations: progressDestinations.filter((destination) => destination.completed).length,
      totalDestinations: progressDestinations.length,
      destinations: progressDestinations,
    };
  }
}

export type { ActiveExplorerCampaignView, ExplorerAdminCampaignView, ExplorerCampaignProgressView };