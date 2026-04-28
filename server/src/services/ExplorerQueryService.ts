import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import type { AppDatabase } from '../db/types';
import { getOne, getMany } from '../db/asyncQuery';
import {
  explorerCampaign,
  explorerDestination,
  explorerDestinationMatch,
  explorerDestinationPin,
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
  totalElevationGain: number | null;
  climbCategory: number | null;
  startLatitude: number | null;
  startLongitude: number | null;
  endLatitude: number | null;
  endLongitude: number | null;
  metadataUpdatedAt: string | null;
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
  displayNameRaw: string | null;
  destinations: ExplorerDestinationView[];
}

interface ExplorerProgressDestinationView extends ExplorerDestinationView {
  completed: boolean;
  pinned: boolean;
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
  constructor(private readonly db: AppDatabase) {}

  private mapDestination(destination: {
    id: number;
    strava_segment_id: string;
    display_label: string | null;
    cached_name: string | null;
    source_url: string | null;
    created_at: string | null;
    surface_type: string | null;
    category: string | null;
    display_order: number;
    segment_name: string | null;
    distance: number | null;
    average_grade: number | null;
    total_elevation_gain: number | null;
    climb_category: number | null;
    start_latitude: number | null;
    start_longitude: number | null;
    end_latitude: number | null;
    end_longitude: number | null;
    metadata_updated_at: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
  }): ExplorerDestinationView {
    return {
      id: destination.id,
      stravaSegmentId: destination.strava_segment_id,
      displayLabel: resolveDestinationLabel(destination),
      customLabel: destination.display_label,
      segmentName: resolveSegmentName(destination),
      sourceUrl: destination.source_url,
      createdAt: destination.created_at,
      distance: destination.distance,
      averageGrade: destination.average_grade,
      totalElevationGain: destination.total_elevation_gain,
      climbCategory: destination.climb_category,
      startLatitude: destination.start_latitude,
      startLongitude: destination.start_longitude,
      endLatitude: destination.end_latitude,
      endLongitude: destination.end_longitude,
      metadataUpdatedAt: destination.metadata_updated_at,
      city: destination.city,
      state: destination.state,
      country: destination.country,
      surfaceType: destination.surface_type,
      category: destination.category,
      displayOrder: destination.display_order,
    };
  }

  private async listDestinationsByCampaignIds(explorerCampaignIds: number[]): Promise<Map<number, ExplorerDestinationView[]>> {
    const destinationsByCampaignId = new Map<number, ExplorerDestinationView[]>();

    for (const explorerCampaignId of explorerCampaignIds) {
      destinationsByCampaignId.set(explorerCampaignId, []);
    }

    if (explorerCampaignIds.length === 0) {
      return destinationsByCampaignId;
    }

    const destinations = await getMany<any>(
      this.db
        .select({
          explorer_campaign_id: explorerDestination.explorer_campaign_id,
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
          total_elevation_gain: segment.total_elevation_gain,
          climb_category: segment.climb_category,
          start_latitude: segment.start_latitude,
          start_longitude: segment.start_longitude,
          end_latitude: segment.end_latitude,
          end_longitude: segment.end_longitude,
          metadata_updated_at: segment.metadata_updated_at,
          city: segment.city,
          state: segment.state,
          country: segment.country,
        })
        .from(explorerDestination)
        .leftJoin(segment, eq(explorerDestination.strava_segment_id, segment.strava_segment_id))
        .where(inArray(explorerDestination.explorer_campaign_id, explorerCampaignIds))
        .orderBy(
          asc(explorerDestination.explorer_campaign_id),
          asc(explorerDestination.display_order),
          asc(explorerDestination.id)
        )
    );

    for (const destination of destinations) {
      const campaignDestinations = destinationsByCampaignId.get(destination.explorer_campaign_id);

      if (!campaignDestinations) {
        continue;
      }

      campaignDestinations.push(this.mapDestination(destination));
    }

    return destinationsByCampaignId;
  }

  private async listDestinations(explorerCampaignId: number): Promise<ExplorerDestinationView[]> {
    const map = await this.listDestinationsByCampaignIds([explorerCampaignId]);
    return map.get(explorerCampaignId) ?? [];
  }

  async getAdminCampaigns(): Promise<ExplorerAdminCampaignView[]> {
    const campaigns = await getMany<{
      id: number;
      start_at: number;
      end_at: number;
      display_name: string | null;
      rules_blurb: string | null;
    }>(
      this.db
        .select({
          id: explorerCampaign.id,
          start_at: explorerCampaign.start_at,
          end_at: explorerCampaign.end_at,
          display_name: explorerCampaign.display_name,
          rules_blurb: explorerCampaign.rules_blurb,
        })
        .from(explorerCampaign)
        .orderBy(desc(explorerCampaign.start_at), desc(explorerCampaign.id))
    );

    const destinationsByCampaignId = await this.listDestinationsByCampaignIds(
      campaigns.map((campaign) => campaign.id)
    );

    return campaigns.map((campaign) => ({
      id: campaign.id,
      name: resolveCampaignName(campaign.display_name),
      displayNameRaw: campaign.display_name,
      startAt: campaign.start_at,
      endAt: campaign.end_at,
      rulesBlurb: campaign.rules_blurb,
      destinations: destinationsByCampaignId.get(campaign.id) ?? [],
    }));
  }

  async getActiveCampaign(
    nowTimestamp: number = Math.floor(Date.now() / 1000)
  ): Promise<ActiveExplorerCampaignView | null> {
    const campaignRecords = await getMany<{
      id: number;
      start_at: number;
      end_at: number;
      display_name: string | null;
      rules_blurb: string | null;
    }>(
      this.db
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
    );

    for (const campaignRecord of campaignRecords) {
      const destinations = await this.listDestinations(campaignRecord.id);

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
    const campaignRecord = await getOne<{
      id: number;
      start_at: number;
      end_at: number;
      display_name: string | null;
      rules_blurb: string | null;
    }>(
      this.db
        .select({
          id: explorerCampaign.id,
          start_at: explorerCampaign.start_at,
          end_at: explorerCampaign.end_at,
          display_name: explorerCampaign.display_name,
          rules_blurb: explorerCampaign.rules_blurb,
        })
        .from(explorerCampaign)
        .where(eq(explorerCampaign.id, explorerCampaignId))
    );

    if (!campaignRecord) {
      return null;
    }

    const destinations = await this.listDestinations(explorerCampaignId);
    const matches = await getMany<{
      explorer_destination_id: number;
      matched_at: number;
      strava_activity_id: string;
    }>(
      this.db
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
    );
    const pins = await getMany<{
      explorer_destination_id: number;
    }>(
      this.db
        .select({
          explorer_destination_id: explorerDestinationPin.explorer_destination_id,
        })
        .from(explorerDestinationPin)
        .where(
          and(
            eq(explorerDestinationPin.explorer_campaign_id, explorerCampaignId),
            eq(explorerDestinationPin.strava_athlete_id, athleteId)
          )
        )
    );

    const matchesByDestinationId = new Map(matches.map((match) => [match.explorer_destination_id, match]));
    const pinnedDestinationIds = new Set(pins.map((pin) => pin.explorer_destination_id));
    const progressDestinations = destinations.map((destination) => {
      const match = matchesByDestinationId.get(destination.id);

      return {
        ...destination,
        completed: Boolean(match),
        pinned: pinnedDestinationIds.has(destination.id),
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