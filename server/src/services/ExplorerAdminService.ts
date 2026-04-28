import { and, eq, gte, lte, max, ne } from 'drizzle-orm';
import type { AppDatabase } from '../db/types';
import { explorerCampaign, explorerDestination, type Segment } from '../db/schema';
import { SegmentService } from './SegmentService';
import { getOne, exec } from '../db/asyncQuery';

interface ExplorerSegmentMetadataService {
  fetchAndStoreSegmentMetadata(
    segmentId: string,
    context: string,
    logCallback?: (level: string, message: string) => void,
    preferredAthleteId?: string
  ): Promise<Segment | null>;
}

interface CreateCampaignInput {
  startAt: number;
  endAt: number;
  displayName?: string | null;
  rulesBlurb?: string | null;
}

interface UpdateCampaignInput {
  explorerCampaignId: number;
  startAt: number;
  endAt: number;
  displayName?: string | null;
  rulesBlurb?: string | null;
}

interface AddDestinationInput {
  explorerCampaignId: number;
  sourceUrl: string;
  displayLabel?: string | null;
  preferredAthleteId?: string;
}

interface AddDestinationResult {
  id: number;
  explorer_campaign_id: number;
  strava_segment_id: string;
  source_url: string | null;
  cached_name: string | null;
  display_label: string | null;
  display_order: number;
  usedPlaceholderMetadata: boolean;
}

interface DeleteDestinationInput {
  explorerDestinationId: number;
}

function normalizeNullableText(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function validateCampaignWindow(startAt: number, endAt: number): void {
  if (!Number.isInteger(startAt) || !Number.isInteger(endAt)) {
    throw new Error('Campaign dates must be valid timestamps');
  }

  if (endAt < startAt) {
    throw new Error('Campaign end date must be on or after the start date');
  }
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
    private readonly db: AppDatabase,
    private readonly segmentService: ExplorerSegmentMetadataService = new SegmentService(db)
  ) {}

  private async ensureNoOverlap(startAt: number, endAt: number, excludedCampaignId?: number): Promise<void> {
    const overlappingCampaign = await getOne<{ id: number }>(
      this.db
        .select({ id: explorerCampaign.id })
        .from(explorerCampaign)
        .where(
          and(
            lte(explorerCampaign.start_at, endAt),
            gte(explorerCampaign.end_at, startAt),
            excludedCampaignId === undefined ? undefined : ne(explorerCampaign.id, excludedCampaignId)
          )
        )
    );

    if (overlappingCampaign) {
      throw new Error('Explorer campaigns cannot overlap in v1');
    }
  }

  async createCampaign(input: CreateCampaignInput) {
    validateCampaignWindow(input.startAt, input.endAt);
    await this.ensureNoOverlap(input.startAt, input.endAt);

    return await getOne<any>(
      this.db
        .insert(explorerCampaign)
        .values({
          start_at: input.startAt,
          end_at: input.endAt,
          display_name: normalizeNullableText(input.displayName),
          rules_blurb: normalizeNullableText(input.rulesBlurb),
        })
        .returning()
    );
  }

  async updateCampaign(input: UpdateCampaignInput) {
    validateCampaignWindow(input.startAt, input.endAt);

    const existingCampaign = await getOne<{ id: number }>(
      this.db
        .select({ id: explorerCampaign.id })
        .from(explorerCampaign)
        .where(eq(explorerCampaign.id, input.explorerCampaignId))
    );

    if (!existingCampaign) {
      throw new Error('Explorer campaign not found');
    }

    await this.ensureNoOverlap(input.startAt, input.endAt, input.explorerCampaignId);

    return await getOne<any>(
      this.db
        .update(explorerCampaign)
        .set({
          start_at: input.startAt,
          end_at: input.endAt,
          display_name: normalizeNullableText(input.displayName),
          rules_blurb: normalizeNullableText(input.rulesBlurb),
          updated_at: new Date().toISOString(),
        })
        .where(eq(explorerCampaign.id, input.explorerCampaignId))
        .returning()
    );
  }

  async addDestination(input: AddDestinationInput): Promise<AddDestinationResult> {
    const campaignRecord = await getOne<{ id: number }>(
      this.db
        .select({
          id: explorerCampaign.id,
        })
        .from(explorerCampaign)
        .where(eq(explorerCampaign.id, input.explorerCampaignId))
    );

    if (!campaignRecord) {
      throw new Error('Explorer campaign not found');
    }

    const trimmedSourceUrl = input.sourceUrl.trim();
    const segmentId = parseStravaSegmentUrl(trimmedSourceUrl);

    const existingDestination = await getOne<{ id: number }>(
      this.db
        .select({ id: explorerDestination.id })
        .from(explorerDestination)
        .where(
          and(
            eq(explorerDestination.explorer_campaign_id, input.explorerCampaignId),
            eq(explorerDestination.strava_segment_id, segmentId)
          )
        )
    );

    if (existingDestination) {
      throw new Error('Explorer destination already exists for this campaign');
    }

    const metadata = await this.segmentService.fetchAndStoreSegmentMetadata(
      segmentId,
      'explorer-admin-add-destination',
      undefined,
      input.preferredAthleteId
    );

    const orderRecord = await getOne<{ maxDisplayOrder: number | null }>(
      this.db
        .select({ maxDisplayOrder: max(explorerDestination.display_order) })
        .from(explorerDestination)
        .where(eq(explorerDestination.explorer_campaign_id, input.explorerCampaignId))
    );

    const nextDisplayOrder = (orderRecord?.maxDisplayOrder ?? -1) + 1;

    const createdDestination = await getOne<AddDestinationResult>(
      this.db
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
    );

    if (!createdDestination) {
      throw new Error('Failed to create explorer destination');
    }

    return {
      ...createdDestination,
      usedPlaceholderMetadata: !metadata?.name,
    };
  }

  async deleteDestination(input: DeleteDestinationInput) {
    const existingDestination = await getOne<{ id: number }>(
      this.db
        .select({ id: explorerDestination.id })
        .from(explorerDestination)
        .where(eq(explorerDestination.id, input.explorerDestinationId))
    );

    if (!existingDestination) {
      throw new Error('Explorer destination not found');
    }

    await exec(
      this.db
        .delete(explorerDestination)
        .where(eq(explorerDestination.id, input.explorerDestinationId))
    );

    return { explorerDestinationId: input.explorerDestinationId };
  }
}

export type {
  CreateCampaignInput,
  UpdateCampaignInput,
  AddDestinationInput,
  AddDestinationResult,
  DeleteDestinationInput,
  ExplorerSegmentMetadataService,
};