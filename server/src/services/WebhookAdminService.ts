/**
 * WebhookAdminService.ts
 *
 * Provides central management and monitoring data for the Webhook Admin dashboard.
 * Orchestrates WebhookSubscriptionService, WebhookLogger, and StorageMonitor.
 */

import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { explorerCampaign, explorerDestination, explorerDestinationMatch, webhookEvent } from '../db/schema';
import { WebhookSubscriptionService } from './WebhookSubscriptionService';
import ParticipantService from './ParticipantService';
import { ActivityService } from './ActivityService';
import { StorageMonitor } from '../webhooks/storageMonitor';
import { config } from '../config';
import { createWebhookProcessor } from '../webhooks/processor';
import { WebhookLogger } from '../webhooks/logger';
import { getWebhookActivityDetailsResult } from './stravaReadProvider';

export class WebhookAdminService {
  private subscriptionService: WebhookSubscriptionService;
  private participantService: ParticipantService;
  private activityService: ActivityService;
  private storageMonitor: StorageMonitor;
  private logger: WebhookLogger;

  constructor(private db: BetterSQLite3Database) {
    this.subscriptionService = new WebhookSubscriptionService(db);
    this.participantService = new ParticipantService(db);
    this.activityService = new ActivityService(db);
    this.storageMonitor = new StorageMonitor(db, config.databasePath);
    this.logger = new WebhookLogger(db);
  }

  async getStatus() {
    const subscriptionStatus = this.subscriptionService.getStatus();

    const countAll = (cond?: any) => {
      const baseQuery = this.db.select({ count: sql<number>`count(*)` }).from(webhookEvent);
      const row = cond ? baseQuery.where(cond).get() : baseQuery.get();
      return row?.count ?? 0;
    };

    const totalEvents = countAll();
    const successfulEvents = countAll(eq(webhookEvent.processed, 1));
    const failedEvents = countAll(and(eq(webhookEvent.processed, 0), sql`${webhookEvent.error_message} IS NOT NULL`));
    const pendingRetries = failedEvents;
    const eventsLast24h = countAll(gt(webhookEvent.created_at, sql`datetime('now', '-1 day')`));

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

  getStorageStatus() {
    return this.storageMonitor.getStatus();
  }

  private async buildActivityEventSummary(
    stravaActivityId: string,
    processed: number | null,
    errorMessage: string | null
  ) {
    if (processed === 0 && !errorMessage) {
      return {
        outcome: 'pending' as const,
        competition_week_count: 0,
        competition_season_count: 0,
        explorer_destination_count: 0,
        explorer_campaign_count: 0,
        competition_week_names: [],
        explorer_destination_names: [],
        message: 'Pending processing',
      };
    }

    if (errorMessage) {
      return {
        outcome: 'failed' as const,
        competition_week_count: 0,
        competition_season_count: 0,
        explorer_destination_count: 0,
        explorer_campaign_count: 0,
        competition_week_names: [],
        explorer_destination_names: [],
        message: errorMessage,
      };
    }

    const competitionMatches = await this.activityService.getStoredActivityMatches(stravaActivityId);
    const explorerMatches = await this.db
      .select({
        explorer_destination_id: explorerDestinationMatch.explorer_destination_id,
        explorer_campaign_id: explorerDestinationMatch.explorer_campaign_id,
        campaign_name: explorerCampaign.display_name,
        destination_name: explorerDestination.display_label,
        destination_cached_name: explorerDestination.cached_name,
      })
      .from(explorerDestinationMatch)
      .leftJoin(
        explorerDestination,
        eq(explorerDestinationMatch.explorer_destination_id, explorerDestination.id)
      )
      .leftJoin(
        explorerCampaign,
        eq(explorerDestinationMatch.explorer_campaign_id, explorerCampaign.id)
      )
      .where(eq(explorerDestinationMatch.strava_activity_id, stravaActivityId))
      .all();

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

  async getEvents(limit: number, offset: number, since: number, status: 'all' | 'success' | 'failed') {
    const sinceExpr = sql`datetime(${since}, 'unixepoch')`;
    const conditions: Array<any> = [gt(webhookEvent.created_at, sinceExpr)];

    if (status === 'success') {
      conditions.push(eq(webhookEvent.processed, 1));
    } else if (status === 'failed') {
      conditions.push(eq(webhookEvent.processed, 0));
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const countRow = this.db
      .select({ count: sql<number>`count(*)` })
      .from(webhookEvent)
      .where(whereClause)
      .get();

    const events = this.db
      .select({
        id: webhookEvent.id,
        payload: webhookEvent.payload,
        processed: webhookEvent.processed,
        error_message: webhookEvent.error_message,
        created_at: webhookEvent.created_at
      })
      .from(webhookEvent)
      .where(whereClause)
      .orderBy(desc(webhookEvent.created_at))
      .limit(limit)
      .offset(offset)
      .all();

    const parsedEvents = await Promise.all(events.map(async (event) => {
      const payload = JSON.parse(event.payload);
      const parsedEvent = {
        ...event,
        payload,
        processed: event.processed === 1,
      };

      if (payload.object_type !== 'activity' || !payload.object_id) {
        return parsedEvent;
      }

      return {
        ...parsedEvent,
        activity_summary: await this.buildActivityEventSummary(
          String(payload.object_id),
          event.processed,
          event.error_message
        ),
      };
    }));

    return {
      events: parsedEvents,
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
    const event = this.db.select().from(webhookEvent).where(eq(webhookEvent.id, id)).get();
    if (!event) throw new Error('Event not found');

    const payload = JSON.parse(event.payload);
    const processor = createWebhookProcessor(this.db);

    // We clear the error before retrying
    this.db.update(webhookEvent)
      .set({ error_message: null, processed: 0 })
      .where(eq(webhookEvent.id, id))
      .run();

    await processor(payload, this.logger);
    return { success: true };
  }

  async replayEvent(id: number) {
    const event = this.db.select().from(webhookEvent).where(eq(webhookEvent.id, id)).get();
    if (!event) throw new Error('Event not found');

    const payload = JSON.parse(event.payload);
    const processor = createWebhookProcessor(this.db);

    await processor(payload, this.logger);
    return { success: true };
  }

  async getEnrichedEventDetails(id: number) {
    const eventRow = this.db.select().from(webhookEvent).where(eq(webhookEvent.id, id)).get();
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
      const participantRecord = this.participantService.getParticipantByStravaAthleteId(athleteId!);

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
      const participantRecord = this.participantService.getParticipantByStravaAthleteId(athleteId!);

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

      // Try to fetch activity details from Strava
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
    this.db.delete(webhookEvent).run();
    return { success: true };
  }
}
