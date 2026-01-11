/**
 * WebhookAdminService.ts
 *
 * Provides central management and monitoring data for the Webhook Admin dashboard.
 * Orchestrates WebhookSubscriptionService, WebhookLogger, and StorageMonitor.
 */

import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { activity, participant, webhookEvent } from '../db/schema';
import { WebhookSubscriptionService } from './WebhookSubscriptionService';
import { StorageMonitor } from '../webhooks/storageMonitor';
import { config } from '../config';
import { createWebhookProcessor } from '../webhooks/processor';
import { WebhookLogger } from '../webhooks/logger';

export class WebhookAdminService {
  private subscriptionService: WebhookSubscriptionService;
  private storageMonitor: StorageMonitor;
  private logger: WebhookLogger;

  constructor(private db: BetterSQLite3Database) {
    this.subscriptionService = new WebhookSubscriptionService(db);
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
    const enrichment: any = {
      object_type: payload.object_type,
      aspect_type: payload.aspect_type,
      object_id: payload.object_id,
      owner_id: payload.owner_id
    };

    if (payload.object_type === 'activity') {
      const activityData = this.db.select().from(activity).where(eq(activity.strava_activity_id, payload.object_id.toString())).get();
      if (activityData) {
        const p = this.db.select({ name: participant.name }).from(participant).where(eq(participant.strava_athlete_id, activityData.strava_athlete_id)).get();
        enrichment.activity = {
          ...activityData,
          participantName: p?.name
        };
      }
    } else if (payload.object_type === 'athlete') {
      const athleteData = this.db.select().from(participant).where(eq(participant.strava_athlete_id, payload.owner_id.toString())).get();
      if (athleteData) {
        enrichment.athlete = athleteData;
      }
    }

    return {
      id: eventRow.id,
      created_at: eventRow.created_at,
      processed: eventRow.processed === 1,
      error_message: eventRow.error_message,
      payload: payload,
      enrichment
    };
  }

  async clearEvents() {
    this.db.delete(webhookEvent).run();
    return { success: true };
  }
}
