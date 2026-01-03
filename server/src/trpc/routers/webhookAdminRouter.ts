import { z } from 'zod';
import { adminProcedure, router } from '../init';
import { WebhookSubscriptionService } from '../../services/WebhookSubscriptionService';
import { StorageMonitor } from '../../webhooks/storageMonitor';
import { config } from '../../config'; // For databasePath
import * as stravaClientModule from '../../stravaClient'; // Import entire module as namespace
import { getValidAccessToken } from '../../tokenManager';
import { TRPCError } from '@trpc/server';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { webhookEvent, participant, activity, week, season, segmentEffort } from '../../db/schema';

export const webhookAdminRouter = router({
  getStatus: adminProcedure
    .query(async ({ ctx }) => {
      const { orm } = ctx;
      const subscriptionService = new WebhookSubscriptionService(orm);
      
      const subscriptionStatus = subscriptionService.getStatus();

      const countAll = (cond?: ReturnType<typeof and> | ReturnType<typeof eq> | ReturnType<typeof gt>) => {
        const baseQuery = orm.select({ count: sql<number>`count(*)` }).from(webhookEvent);
        const row = cond ? baseQuery.where(cond).get() : baseQuery.get();
        return row?.count ?? 0;
      };

      const totalEvents = countAll();
      const successfulEvents = countAll(eq(webhookEvent.processed, 1));
      const failedEvents = countAll(and(eq(webhookEvent.processed, 0), sql`${webhookEvent.error_message} IS NOT NULL`));
      const pendingRetries = failedEvents; // same filter as failedEvents
      const eventsLast24h = countAll(gt(webhookEvent.created_at, sql`datetime('now', '-1 day')`));

      const successRate =
        totalEvents > 0 ? ((successfulEvents / totalEvents) * 100).toFixed(1) : '0.0';

      const responsePayload = {
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

      return responsePayload;
    }),

  getStorageStatus: adminProcedure
    .query(async ({ ctx }) => {
      const { orm } = ctx;
      const dbPath = config.databasePath;
      const monitor = new StorageMonitor(orm, dbPath);
      const status = monitor.getStatus();

      return status;
    }),

  getEvents: adminProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(500).default(50),
      offset: z.number().int().min(0).default(0),
      since: z.number().int().default(Math.floor(Date.now() / 1000) - 604800), // 7 days ago
      status: z.enum(['all', 'success', 'failed']).default('all'),
      confirm: z.string().optional() // For the DELETE all events
    }))
    .query(async ({ ctx, input }) => {
      const { orm } = ctx;
      const { limit: rawLimit, offset: rawOffset, since, status } = input;

      // Validate and constrain limit and offset
      const limit = Math.min(Math.max(rawLimit, 1), 500);
      const offset = Math.max(rawOffset, 0);

      const sinceExpr = sql`datetime(${since}, 'unixepoch')`;
      const conditions: Array<ReturnType<typeof gt> | ReturnType<typeof eq>> = [gt(webhookEvent.created_at, sinceExpr)];

      if (status === 'success') {
        conditions.push(eq(webhookEvent.processed, 1));
      } else if (status === 'failed') {
        conditions.push(eq(webhookEvent.processed, 0));
      }

      const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

      const countRow = orm
        .select({ count: sql<number>`count(*)` })
        .from(webhookEvent)
        .where(whereClause)
        .get();

      const events = orm
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

      // Parse payload JSON for each event
      const parsedEvents = events.map((event) => ({
        ...event,
        payload: event.payload ? JSON.parse(event.payload) : null
      }));

      return {
        events: parsedEvents,
        total: countRow?.count ?? 0,
        limit,
        offset
      };
    }),

  enable: adminProcedure
    .mutation(async ({ ctx }) => {
      const { orm } = ctx;
      const subscriptionService = new WebhookSubscriptionService(orm);
      const result = await subscriptionService.enable();

      return {
        enabled: result.id !== null,
        subscription_id: result.subscription_id,
        created_at: result.created_at,
        message: 'Webhooks enabled successfully'
      };
    }),

  disable: adminProcedure
    .mutation(async ({ ctx }) => {
      const { orm } = ctx;
      const subscriptionService = new WebhookSubscriptionService(orm);
      const result = await subscriptionService.disable();

      return {
        enabled: result.id !== null, // Should be false when disabled
        message: 'Webhooks disabled successfully'
      };
    }),

  renew: adminProcedure
    .mutation(async ({ ctx }) => {
      const { orm } = ctx;
      const subscriptionService = new WebhookSubscriptionService(orm);
      const result = await subscriptionService.renew();

      return {
        enabled: result.id !== null,
        subscription_id: result.subscription_id,
        created_at: result.created_at,
        expires_at: result.expires_at,
        message: 'Webhooks renewed successfully'
      };
    }),

  retryEvent: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { orm } = ctx;
      const { id: eventId } = input;

      // Get the event
      const event = orm
        .select()
        .from(webhookEvent)
        .where(eq(webhookEvent.id, eventId))
        .get();

      if (!event) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Event ${eventId} not found`,
        });
      }

      // Reset error to allow retry
      await orm
        .update(webhookEvent)
        .set({ processed: 0, error_message: null })
        .where(eq(webhookEvent.id, eventId))
        .run();

      console.log(
        `[Admin:Webhooks] Event ${eventId} marked for retry`
      );

      return {
        event_id: eventId,
        queued: true,
        message: 'Event marked for retry. Processor will pick it up on next cycle.'
      };
    }),

  getEnrichedEventDetails: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { orm } = ctx;
      const { id: eventId } = input;

      // Get the raw event
      const event = orm
        .select({
          id: webhookEvent.id,
          payload: webhookEvent.payload,
          processed: webhookEvent.processed,
          error_message: webhookEvent.error_message,
          created_at: webhookEvent.created_at
        })
        .from(webhookEvent)
        .where(eq(webhookEvent.id, eventId))
        .get();

      if (!event) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Event ${eventId} not found`,
        });
      }

      const payload = event.payload ? JSON.parse(event.payload) : null;
      const response: any = {
        event: {
          id: event.id,
          created_at: event.created_at,
          processed: event.processed === 1,
          error_message: event.error_message,
          payload
        }
      };

      // Only enrich if it's an activity event
      if (payload?.object_type === 'activity') {
        const athleteId = String(payload.owner_id);
        const activityId = String(payload.object_id);

        // Get participant from our database
        const participantRecord = orm
          .select({ strava_athlete_id: participant.strava_athlete_id, name: participant.name })
          .from(participant)
          .where(eq(participant.strava_athlete_id, athleteId))
          .get();

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
          if (participantRecord) {
            console.log(`[Admin:Webhooks] Fetching Strava activity details for activity ${activityId}`);
            const token = await getValidAccessToken(ctx.orm, stravaClientModule, participantRecord.strava_athlete_id); // Pass drizzleDb via ctx.orm
            const activityData = await stravaClientModule.getActivity(activityId, token); // Use stravaClientModule.getActivity
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
            console.log(`[Admin:Webhooks] ✓ Activity details loaded: '${activityData.name}'`);
          } else {
            console.log(`[Admin:Webhooks] No participant found for athlete ${athleteId}, skipping Strava API call`);
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.log(`[Admin:Webhooks] Activity fetch from Strava: ${msg}`);
          // Don't fail enrichment if we can't fetch from Strava - continue with stored data
        }

        // If not processed, return early
        if (!event.processed) {
          enrichment.summary = {
            status: 'pending',
            message: 'Webhook is still being processed or has not been processed yet',
            total_weeks_matched: 0,
            total_seasons: 0
          };
          response.enrichment = enrichment;
          return response;
        }

        // If processed but has error, show the error
        if (event.error_message) {
          enrichment.summary = {
            status: 'error',
            message: event.error_message,
            total_weeks_matched: 0,
            total_seasons: 0
          };
          response.enrichment = enrichment;
          return response;
        }

        // Activity was processed successfully - query what was stored
        // Get all activities and results stored for this activity from the webhook
        const storedActivities = orm
          .select({
            activity_id: activity.id,
            strava_activity_id: activity.strava_activity_id,
            week_id: week.id,
            week_name: week.week_name,
            season_id: season.id,
            season_name: season.name,
            segment_effort_count: sql<number>`COUNT(${segmentEffort.id})`,
            total_time_seconds: sql<number>`COALESCE(SUM(${segmentEffort.elapsed_seconds}), 0)`,
            rank: sql<number | null>`NULL`,
            points: sql<number | null>`NULL`
          })
          .from(activity)
          .innerJoin(week, eq(activity.week_id, week.id))
          .innerJoin(season, eq(week.season_id, season.id))
          .leftJoin(segmentEffort, eq(activity.id, segmentEffort.activity_id))
          .where(eq(activity.strava_activity_id, String(activityId)))
          .groupBy(week.id, season.id)
          .orderBy(season.id, week.id)
          .all();

        if (storedActivities.length === 0) {
          // Webhook was processed but didn't result in any stored activities
          enrichment.summary = {
            status: 'no_match',
            message: 'Webhook was processed but activity does not match any active season/week combinations',
            total_weeks_matched: 0,
            total_seasons: 0
          };
          response.enrichment = enrichment;
          return response;
        }

        // Group by season for display
        const seasonMap = new Map<number, any>();
        for (const activity of storedActivities) {
          const seasonId = activity.season_id;
          if (!seasonMap.has(seasonId)) {
            seasonMap.set(seasonId, {
              season_id: seasonId,
              season_name: activity.season_name,
              matched_weeks: []
            });
          }

          seasonMap.get(seasonId)!.matched_weeks.push({
            week_id: activity.week_id,
            week_name: activity.week_name,
            segment_effort_count: activity.segment_effort_count || 0,
            total_time_seconds: activity.total_time_seconds,
            rank: activity.rank,
            points: activity.points
          });
        }

        enrichment.matching_seasons = Array.from(seasonMap.values());
        enrichment.summary = {
          status: 'qualified',
          message: `Activity was processed and stored for ${storedActivities.length} week(s) across ${seasonMap.size} season(s)`,
          total_weeks_matched: storedActivities.length,
          total_seasons: seasonMap.size
        };

        response.enrichment = enrichment;
      }

      return response;
    }),

  clearEvents: adminProcedure
    .input(z.object({ confirm: z.literal('yes') })) // Require explicit confirmation
    .mutation(async ({ ctx }) => {
      const { orm } = ctx;

      const result = await orm.delete(webhookEvent).run();
      const deleted = (result as unknown as { changes?: number }).changes ?? 0;

      console.log(`[Admin:Webhooks] Cleared ${deleted} webhook events`);

      return {
        deleted,
        message: `Deleted ${deleted} webhook event(s)`
      };
    }),
});
