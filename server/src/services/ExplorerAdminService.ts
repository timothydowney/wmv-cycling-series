import { and, eq, max } from 'drizzle-orm';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { explorerCampaign, explorerDestination, season, type Segment } from '../db/schema';
import { SegmentService } from './SegmentService';

interface ExplorerSegmentMetadataService {
  fetchAndStoreSegmentMetadata(
    segmentId: string,
    context: string,
    logCallback?: (level: string, message: string) => void,
    preferredAthleteId?: string
  ): Promise<Segment | null>;
}

interface CreateCampaignInput {
  seasonId: number;
  displayName?: string | null;
  rulesBlurb?: string | null;
}

interface AddDestinationInput {
  explorerCampaignId: number;
  sourceUrl: string;
  displayLabel?: string | null;
  preferredAthleteId?: string;
}

function normalizeNullableText(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseStravaSegmentUrl(sourceUrl: string): string {
  const trimmedSourceUrl = sourceUrl.trim();
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(trimmedSourceUrl);
  } catch {
    throw new Error('Please provide a valid Strava segment URL');
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (hostname !== 'www.strava.com' && hostname !== 'strava.com') {
    throw new Error('Please provide a valid Strava segment URL');
  }

  const segmentMatch = parsedUrl.pathname.match(/^\/segments\/(\d+)(?:\/)?$/);
  if (!segmentMatch) {
    throw new Error('Please provide a valid Strava segment URL');
  }

  return segmentMatch[1];
}

export class ExplorerAdminService {
  constructor(
    private readonly db: BetterSQLite3Database,
    private readonly segmentService: ExplorerSegmentMetadataService = new SegmentService(db)
  ) {}

  createCampaign(input: CreateCampaignInput) {
    const seasonRecord = this.db
      .select({ id: season.id })
      .from(season)
      .where(eq(season.id, input.seasonId))
      .get();

    if (!seasonRecord) {
      throw new Error('Season not found');
    }

    const existingCampaign = this.db
      .select({ id: explorerCampaign.id })
      .from(explorerCampaign)
      .where(eq(explorerCampaign.season_id, input.seasonId))
      .get();

    if (existingCampaign) {
      throw new Error('Explorer campaign already exists for this season');
    }

    return this.db
      .insert(explorerCampaign)
      .values({
        season_id: input.seasonId,
        display_name: normalizeNullableText(input.displayName),
        rules_blurb: normalizeNullableText(input.rulesBlurb),
      })
      .returning()
      .get();
  }

  async addDestination(input: AddDestinationInput) {
    const campaignRecord = this.db
      .select({
        id: explorerCampaign.id,
      })
      .from(explorerCampaign)
      .where(eq(explorerCampaign.id, input.explorerCampaignId))
      .get();

    if (!campaignRecord) {
      throw new Error('Explorer campaign not found');
    }

    const trimmedSourceUrl = input.sourceUrl.trim();
    const segmentId = parseStravaSegmentUrl(trimmedSourceUrl);

    const existingDestination = this.db
      .select({ id: explorerDestination.id })
      .from(explorerDestination)
      .where(
        and(
          eq(explorerDestination.explorer_campaign_id, input.explorerCampaignId),
          eq(explorerDestination.strava_segment_id, segmentId)
        )
      )
      .get();

    if (existingDestination) {
      throw new Error('Explorer destination already exists for this campaign');
    }

    const metadata = await this.segmentService.fetchAndStoreSegmentMetadata(
      segmentId,
      'explorer-admin-add-destination',
      undefined,
      input.preferredAthleteId
    );

    const orderRecord = this.db
      .select({ maxDisplayOrder: max(explorerDestination.display_order) })
      .from(explorerDestination)
      .where(eq(explorerDestination.explorer_campaign_id, input.explorerCampaignId))
      .get();

    const nextDisplayOrder = (orderRecord?.maxDisplayOrder ?? -1) + 1;

    return this.db
      .insert(explorerDestination)
      .values({
        explorer_campaign_id: input.explorerCampaignId,
        strava_segment_id: segmentId,
        source_url: trimmedSourceUrl,
        cached_name: metadata?.name || `Segment ${segmentId}`,
        display_label: normalizeNullableText(input.displayLabel),
        display_order: nextDisplayOrder,
      })
      .returning()
      .get();
  }
}

export type { CreateCampaignInput, AddDestinationInput, ExplorerSegmentMetadataService };