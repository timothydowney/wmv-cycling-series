/**
 * WebhookAdminService.ts
 *
 * Provides central management and monitoring data for the Webhook Admin dashboard.
 * Orchestrates WebhookSubscriptionService and WebhookLogger.
 */

import type { AppDatabase } from '../db/types';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { activity, explorerDestination, explorerDestinationMatch, participant, season, week, webhookEvent } from '../db/schema';
import { WebhookSubscriptionService } from './WebhookSubscriptionService';
import ParticipantService from './ParticipantService';
import { ActivityService } from './ActivityService';
import { createWebhookProcessor } from '../webhooks/processor';
import { WebhookLogger } from '../webhooks/logger';
import { getWebhookActivityDetailsResult } from './stravaReadProvider';
import { getOne, getMany, exec } from '../db/asyncQuery';

export interface ParsedWebhookPayload {
  aspect_type: 'create' | 'update' | 'delete';
  event_time: number;
  object_id: number;
  object_type: 'activity' | 'athlete';
  owner_id: number;
  subscription_id: number;
  updates?: Record<string, unknown>;
}

export class WebhookAdminService {
  private subscriptionService: WebhookSubscriptionService;
  private participantService: ParticipantService;
  private activityService: ActivityService;
  private logger: WebhookLogger;

  constructor(private db: AppDatabase) {
    this.subscriptionService = new WebhookSubscriptionService(db);
    this.participantService = new ParticipantService(db);
    this.activityService = new ActivityService(db);
    this.logger = new WebhookLogger(db);
  }

  async getStatus() {
    const subscriptionStatus = await this.subscriptionService.getStatus();

    const countAll = async (cond?: any) => {
      const baseQuery = this.db.select({ count: sql<number>`count(*)`.as('count') }).from(webhookEvent);
      const row = await getOne<{ count: number }>(cond ? baseQuery.where(cond) : baseQuery);
      return row?.count ?? 0;
    };

    const totalEvents = await countAll();
    const successfulEvents = await countAll(eq(webhookEvent.processed, 1));
    const failedEvents = await countAll(and(eq(webhookEvent.processed, 0), sql`${webhookEvent.error_message} IS NOT NULL`));
    const pendingRetries = failedEvents;
    const eventsLast24h = await countAll(
      sql`${webhookEvent.created_at} > now() - interval '1 day'`
    );

    const successRate =
      totalEvents > 0 ? ((successfulEvents / totalEvents) * 100).toFixed(1) : '0.0';

    return {
      enabled: subscriptionStatus.id !== null,
      subscription_id: subscriptionStatus.subscription_id,
      created_at: subscriptionStatus.created_at,
      expires_at: subscriptionStatus.expires_at,
      last_refreshed_at: subscriptionStatus.last_refreshed_at,
      metrics: {
        total_events: totalEvents,
        successful_events: successfulEvents,
        failed_events: failedEvents,
        pending_retries: pendingRetries,
        events_last24h: eventsLast24h,
        success_rate: parseFloat(successRate)
      }
    };
  }

  private buildEmptyActivitySummary(outcome: 'pending' | 'failed', message: string) {
    return {
      outcome,
      competition_week_count: 0,
      competition_season_count: 0,
      explorer_destination_count: 0,
      explorer_campaign_count: 0,
      competition_week_names: [] as string[],
      explorer_destination_names: [] as string[],
      message,
    };
  }

  private buildMatchedActivitySummary(
    competitionMatches: Array<{ season_id: number; week_name: string | null }>,
    explorerMatches: Array<{ explorer_campaign_id: number; destination_name: string | null; destination_cached_name: string | null }>
  ) {
    const competitionWeekCount = competitionMatches.length;
    const competitionSeasonCount = new Set(competitionMatches.map(match => match.season_id)).size;
    const explorerDestinationCount = explorerMatches.length;
    const explorerCampaignCount = new Set(explorerMatches.map(match => match.explorer_campaign_id)).size;
    const competitionWeekNames = Array.from(
      new Set(
        competitionMatches
          .map(match => match.week_name)
          .filter((name): name is string => Boolean(name))
      )
    );
    const explorerDestinationNames = Array.from(
      new Set(
        explorerMatches
          .map(match => match.destination_name || match.destination_cached_name)
          .filter((name): name is string => Boolean(name))
      )
    );

    let outcome: 'competition' | 'explorer' | 'both' | 'none';
    let message: string;

    if (competitionWeekCount > 0 && explorerDestinationCount > 0) {
      outcome = 'both';
      message = `Matched ${competitionWeekCount} competition week(s) and ${explorerDestinationCount} Explorer destination(s)`;
    } else if (competitionWeekCount > 0) {
      outcome = 'competition';
      message = `Matched ${competitionWeekCount} competition week(s)`;
    } else if (explorerDestinationCount > 0) {
      outcome = 'explorer';
      message = `Matched ${explorerDestinationCount} Explorer destination(s)`;
    } else {
      outcome = 'none';
      message = 'Processed with no competition or Explorer matches';
    }

    return {
      outcome,
      competition_week_count: competitionWeekCount,
      competition_season_count: competitionSeasonCount,
      explorer_destination_count: explorerDestinationCount,
      explorer_campaign_count: explorerCampaignCount,
      competition_week_names: competitionWeekNames,
      explorer_destination_names: explorerDestinationNames,
      message,
    };
  }

  private async buildActivityEventSummaries(
    activityEvents: Array<{
      objectId: string;
      processed: number | null;
      errorMessage: string | null;
    }>
  ) {
    const summaries = new Map<string, ReturnType<WebhookAdminService['buildEmptyActivitySummary']> | ReturnType<WebhookAdminService['buildMatchedActivitySummary']>>();

    const matchedActivityIds = activityEvents
      .filter((event) => event.processed !== 0 && !event.errorMessage)
      .map((event) => event.objectId);

    if (matchedActivityIds.length > 0) {
      const competitionMatches = await getMany<{
        strava_activity_id: string;
        week_name: string | null;
        season_id: number;
      }>(
        this.db
          .select({
            strava_activity_id: activity.strava_activity_id,
            week_name: week.week_name,
            season_id: season.id,
          })
          .from(activity)
          .innerJoin(week, eq(activity.week_id, week.id))
          .innerJoin(season, eq(week.season_id, season.id))
          .where(inArray(activity.strava_activity_id, matchedActivityIds))
          .groupBy(activity.strava_activity_id, week.id, week.week_name, season.id)
      );

      const explorerMatches = await getMany<{
        strava_activity_id: string;
        explorer_campaign_id: number;
        destination_name: string | null;
        destination_cached_name: string | null;
      }>(
        this.db
          .select({
            strava_activity_id: explorerDestinationMatch.strava_activity_id,
            explorer_campaign_id: explorerDestinationMatch.explorer_campaign_id,
            destination_name: explorerDestination.display_label,
            destination_cached_name: explorerDestination.cached_name,
          })
          .from(explorerDestinationMatch)
          .leftJoin(
            explorerDestination,
            eq(explorerDestinationMatch.explorer_destination_id, explorerDestination.id)
          )
          .where(inArray(explorerDestinationMatch.strava_activity_id, matchedActivityIds))
          .groupBy(
            explorerDestinationMatch.strava_activity_id,
            explorerDestinationMatch.explorer_campaign_id,
            explorerDestination.display_label,
            explorerDestination.cached_name
          )
      );

      const competitionByActivityId = new Map<string, Array<{ season_id: number; week_name: string | null }>>();
      for (const match of competitionMatches) {
        const existing = competitionByActivityId.get(match.strava_activity_id) ?? [];
        existing.push({ season_id: match.season_id, week_name: match.week_name });
        competitionByActivityId.set(match.strava_activity_id, existing);
      }

      const explorerByActivityId = new Map<string, Array<{ explorer_campaign_id: number; destination_name: string | null; destination_cached_name: string | null }>>();
      for (const match of explorerMatches) {
        const existing = explorerByActivityId.get(match.strava_activity_id) ?? [];
        existing.push({
          explorer_campaign_id: match.explorer_campaign_id,
          destination_name: match.destination_name,
          destination_cached_name: match.destination_cached_name,
        });
        explorerByActivityId.set(match.strava_activity_id, existing);
      }

      for (const activityId of matchedActivityIds) {
        summaries.set(
          activityId,
          this.buildMatchedActivitySummary(
            competitionByActivityId.get(activityId) ?? [],
            explorerByActivityId.get(activityId) ?? []
          )
        );
      }
    }

    for (const event of activityEvents) {
      if (event.processed === 0 && !event.errorMessage) {
        summaries.set(event.objectId, this.buildEmptyActivitySummary('pending', 'Pending processing'));
        continue;
      }

      if (event.errorMessage) {
        summaries.set(event.objectId, this.buildEmptyActivitySummary('failed', event.errorMessage));
      }
    }

    return summaries;
  }

  async getEvents(limit: number, offset: number, since: number, status: 'all' | 'success' | 'failed') {
    const conditions: Array<any> = [];

    if (since > 0) {
      const sinceIso = new Date(since * 1000).toISOString();
      conditions.push(sql`${webhookEvent.created_at} > ${sinceIso}`);
    }

    if (status === 'success') {
      conditions.push(eq(webhookEvent.processed, 1));
    } else if (status === 'failed') {
      conditions.push(eq(webhookEvent.processed, 0));
    }

    const whereClause = conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

    const countRow = await getOne<{ count: number }>(
      whereClause
        ? this.db
          .select({ count: sql<number>`count(*)`.as('count') })
          .from(webhookEvent)
          .where(whereClause)
        : this.db
          .select({ count: sql<number>`count(*)`.as('count') })
          .from(webhookEvent)
    );

    const events = await getMany<{
      id: number;
      payload: string;
      processed: number | null;
      error_message: string | null;
      created_at: string | null;
    }>(
      (whereClause
        ? this.db
          .select({
            id: webhookEvent.id,
            payload: webhookEvent.payload,
            processed: webhookEvent.processed,
            error_message: webhookEvent.error_message,
            created_at: webhookEvent.created_at
          })
          .from(webhookEvent)
          .where(whereClause)
        : this.db
          .select({
            id: webhookEvent.id,
            payload: webhookEvent.payload,
            processed: webhookEvent.processed,
            error_message: webhookEvent.error_message,
            created_at: webhookEvent.created_at
          })
          .from(webhookEvent))
        .orderBy(desc(webhookEvent.created_at))
        .limit(limit)
        .offset(offset)
    );

    const parsedEvents = events.map((event): {
      id: number;
      payload: ParsedWebhookPayload;
      processed: boolean;
      error_message: string | null;
      created_at: string | null;
    } => {
      const payload = JSON.parse(event.payload) as ParsedWebhookPayload;
      return {
        ...event,
        payload,
        processed: event.processed === 1,
      };
    });

    const activityEvents = parsedEvents
      .filter((event) => event.payload.object_type === 'activity' && event.payload.object_id)
      .map((event) => ({
        objectId: String(event.payload.object_id),
        processed: events.find((rawEvent) => rawEvent.id === event.id)?.processed ?? null,
        errorMessage: event.error_message,
      }));

    const activitySummaries = await this.buildActivityEventSummaries(activityEvents);

    const ownerIds = Array.from(
      new Set(
        parsedEvents
          .map((event) => event.payload.owner_id)
          .filter((ownerId): ownerId is number => typeof ownerId === 'number')
          .map((ownerId) => String(ownerId))
      )
    );

    let participantRows: Array<{ strava_athlete_id: string | null; name: string | null }> = [];

    if (ownerIds.length > 0) {
      participantRows = await getMany<{ strava_athlete_id: string | null; name: string | null }>(
        this.db
          .select({
            strava_athlete_id: participant.strava_athlete_id,
            name: participant.name,
          })
          .from(participant)
          .where(inArray(participant.strava_athlete_id, ownerIds))
      );
    }

    const participantsById = new Map(
      participantRows.map((participantRecord) => [participantRecord.strava_athlete_id, participantRecord.name])
    );

    const summarizedEvents = parsedEvents.map((event) => {
      const activitySummary = (
        event.payload.object_type === 'activity' && event.payload.object_id
      )
        ? activitySummaries.get(String(event.payload.object_id))
        : undefined;

      return {
        id: event.id,
        created_at: event.created_at,
        payload: event.payload,
        processed: event.processed,
        error_message: event.error_message,
        athlete_name: participantsById.get(String(event.payload.owner_id)) ?? null,
        activity_summary: activitySummary,
      };
    });

    return {
      events: summarizedEvents,
      total: countRow?.count ?? 0,
      limit,
      offset
    };
  }

  async enable() {
    return await this.subscriptionService.enable();
  }

  async disable() {
    return await this.subscriptionService.disable();
  }

  async renew() {
    return await this.subscriptionService.renew();
  }

  async retryEvent(id: number) {
    const event = await getOne<typeof webhookEvent.$inferSelect>(
      this.db.select().from(webhookEvent).where(eq(webhookEvent.id, id))
    );
    if (!event) throw new Error('Event not found');

    const payload = JSON.parse(event.payload);
    const processor = createWebhookProcessor(this.db);

    // We clear the error before retrying
    await exec(
      this.db.update(webhookEvent)
        .set({ error_message: null, processed: 0 })
        .where(eq(webhookEvent.id, id))
    );

    await processor(payload, this.logger);
    return { success: true };
  }

  async replayEvent(id: number) {
    const event = await getOne<typeof webhookEvent.$inferSelect>(
      this.db.select().from(webhookEvent).where(eq(webhookEvent.id, id))
    );
    if (!event) throw new Error('Event not found');

    const payload = JSON.parse(event.payload);
    const processor = createWebhookProcessor(this.db);

    await processor(payload, this.logger);
    return { success: true };
  }

  async getEnrichedEventDetails(id: number) {
    const eventRow = await getOne<typeof webhookEvent.$inferSelect>(
      this.db.select().from(webhookEvent).where(eq(webhookEvent.id, id))
    );
    if (!eventRow) throw new Error('Event not found');

    const payload = JSON.parse(eventRow.payload);
    const response: any = {
      id: eventRow.id,
      created_at: eventRow.created_at,
      processed: eventRow.processed === 1,
      error_message: eventRow.error_message,
      payload: payload
    };

    const objectType = payload.object_type;
    const objectId = payload.object_id ? String(payload.object_id) : null;
    const ownerId = payload.owner_id ? String(payload.owner_id) : null;

    if (objectType === 'athlete') {
      const athleteId = ownerId || objectId;
      const participantRecord = await this.participantService.getParticipantByStravaAthleteId(athleteId!);

      response.enrichment = {
        athlete: {
          athlete_id: athleteId,
          name: participantRecord?.name || `Unknown (${athleteId})`
        }
      };
    } else if (objectType === 'activity') {
      const athleteId = ownerId;
      const activityId = objectId;

      // Get participant from our database
      const participantRecord = await this.participantService.getParticipantByStravaAthleteId(athleteId!);

      // Initialize enrichment object
      const enrichment: any = {
        athlete: {
          athlete_id: athleteId,
          name: participantRecord?.name || `Unknown (${athleteId})`
        },
        strava_data: null,
        activity_detail: {
          status: 'not_attempted',
          message: null,
          cached: false,
        },
        matching_seasons: [],
        summary: {
          status: 'not_processed',
          message: '',
          total_weeks_matched: 0,
          total_seasons: 0
        }
      };

      // If not processed, return early
      if (eventRow.processed === 0 && !eventRow.error_message) {
        enrichment.summary = {
          status: 'pending',
          message: 'Webhook is still being processed or has not been processed yet',
          total_weeks_matched: 0,
          total_seasons: 0
        };
        response.enrichment = enrichment;
        return response;
      }

      // Try to fetch activity details from Strava only when the event was processed successfully.
      if (participantRecord && activityId) {
        const activityDetails = await getWebhookActivityDetailsResult(
          this.db,
          participantRecord.strava_athlete_id,
          activityId
        );
        enrichment.strava_data = activityDetails.details;
        enrichment.activity_detail = {
          status: activityDetails.status,
          message: activityDetails.message,
          cached: activityDetails.cached,
        };
      } else if (activityId) {
        enrichment.activity_detail = {
          status: 'token_unavailable',
          message: 'Activity details could not be fetched because the athlete is not currently connected to WMV.',
          cached: false,
        };
      }

      // If failed with error
      if (eventRow.error_message) {
        enrichment.summary = {
          status: 'error',
          message: eventRow.error_message,
          total_weeks_matched: 0,
          total_seasons: 0
        };
        response.enrichment = enrichment;
        return response;
      }

      // Activity was processed successfully - query what was stored
      if (activityId) {
        const storedActivities = await this.activityService.getStoredActivityMatches(activityId);

        if (storedActivities.length === 0) {
          enrichment.summary = {
            status: 'no_match',
            message: 'Webhook was processed but activity does not match any active season/week combinations',
            total_weeks_matched: 0,
            total_seasons: 0
          };
        } else {
          // Group by season for display
          const seasonMap = new Map<number, any>();
          for (const sa of storedActivities) {
            const seasonId = sa.season_id;
            if (!seasonMap.has(seasonId)) {
              seasonMap.set(seasonId, {
                season_id: seasonId,
                season_name: sa.season_name,
                matched_weeks: []
              });
            }

            seasonMap.get(seasonId)!.matched_weeks.push({
              week_id: sa.week_id,
              week_name: sa.week_name,
              segment_effort_count: sa.segment_effort_count || 0,
              total_time_seconds: sa.total_time_seconds
            });
          }

          enrichment.matching_seasons = Array.from(seasonMap.values());
          enrichment.summary = {
            status: 'qualified',
            message: `Activity was processed and stored for ${storedActivities.length} week(s) across ${seasonMap.size} season(s)`,
            total_weeks_matched: storedActivities.length,
            total_seasons: seasonMap.size
          };
        }
      }

      response.enrichment = enrichment;
    }

    return response;
  }

  async clearEvents() {
    await exec(this.db.delete(webhookEvent));
    return { success: true };
  }
}
