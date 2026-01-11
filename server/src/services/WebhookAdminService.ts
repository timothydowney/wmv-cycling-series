/**
 * WebhookAdminService.ts
 *
 * Provides central management and monitoring data for the Webhook Admin dashboard.
 * Orchestrates WebhookSubscriptionService, WebhookLogger, and StorageMonitor.
 */

import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { webhookEvent } from '../db/schema';
import { WebhookSubscriptionService } from './WebhookSubscriptionService';
import ParticipantService from './ParticipantService';
import { ActivityService } from './ActivityService';
import { StorageMonitor } from '../webhooks/storageMonitor';
import { config } from '../config';
import { createWebhookProcessor } from '../webhooks/processor';
import { WebhookLogger } from '../webhooks/logger';
import * as stravaClient from '../stravaClient';
import { getValidAccessToken } from '../tokenManager';

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

    return {
      events: events.map(e => ({
        ...e,
        payload: JSON.parse(e.payload),
        processed: e.processed === 1
      })),
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
        matching_seasons: [],
        summary: {
          status: 'not_processed',
          message: '',
          total_weeks_matched: 0,
          total_seasons: 0
        }
      };

      // Try to fetch activity details from Strava
      try {
        if (participantRecord && activityId) {
          console.log(`[WebhookAdmin] Fetching Strava activity details for activity ${activityId}`);
          const token = await getValidAccessToken(this.db, stravaClient, participantRecord.strava_athlete_id);
          const activityData = await stravaClient.getActivity(activityId, token);
          
          enrichment.strava_data = {
            activity_id: String(activityData.id),
            name: activityData.name,
            type: activityData.type,
            distance_m: activityData.distance,
            moving_time_sec: activityData.moving_time,
            elevation_gain_m: activityData.elevation_gain,
            start_date_iso: activityData.start_date,
            device_name: activityData.device_name || null,
            segment_effort_count: activityData.segment_efforts?.length || 0,
            visibility: activityData.visibility || null
          };
        }
      } catch (error) {
        console.warn(`[WebhookAdmin] Activity fetch from Strava failed: ${error instanceof Error ? error.message : String(error)}`);
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
