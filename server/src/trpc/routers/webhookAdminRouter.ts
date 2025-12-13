import { z } from 'zod';
import { adminProcedure, router } from '../init';
import { WebhookSubscriptionService } from '../../services/WebhookSubscriptionService';
import { StorageMonitor } from '../../webhooks/storageMonitor';
import { config } from '../../config'; // For databasePath
import * as stravaClientModule from '../../stravaClient'; // Import entire module as namespace
import { getValidAccessToken } from '../../tokenManager';
import { TRPCError } from '@trpc/server';

export const webhookAdminRouter = router({
  getStatus: adminProcedure
    .query(async ({ ctx }) => {
      // Use ctx.db for raw sqlite access, as WebhookSubscriptionService expects it
      const { db } = ctx;
      const subscriptionService = new WebhookSubscriptionService(db);
      
      const subscriptionStatus = subscriptionService.getStatus();

      // Get event metrics
      const totalEvents = db
        .prepare('SELECT COUNT(*) as count FROM webhook_event')
        .get() as { count: number };

      const successfulEvents = db
        .prepare('SELECT COUNT(*) as count FROM webhook_event WHERE processed = 1')
        .get() as { count: number };

      const failedEvents = db
        .prepare('SELECT COUNT(*) as count FROM webhook_event WHERE processed = 0 AND error_message IS NOT NULL')
        .get() as { count: number };

      // NOTE: Original code had pending_retries query identical to failedEvents. Keeping for now.
      const pendingRetries = db
        .prepare(
          'SELECT COUNT(*) as count FROM webhook_event WHERE processed = 0 AND error_message IS NOT NULL'
        )
        .get() as { count: number };

      const eventsLast24h = db
        .prepare(
          "SELECT COUNT(*) as count FROM webhook_event WHERE created_at > datetime('now', '-1 day')"
        )
        .get() as { count: number };

      const successRate =
        totalEvents.count > 0 ? ((successfulEvents.count / totalEvents.count) * 100).toFixed(1) : '0.0';

      const responsePayload = {
        enabled: subscriptionStatus.id !== null,
        subscription_id: subscriptionStatus.subscription_id,
        created_at: subscriptionStatus.created_at,
        expires_at: subscriptionStatus.expires_at,
        last_refreshed_at: subscriptionStatus.last_refreshed_at,
        metrics: {
          total_events: totalEvents.count,
          successful_events: successfulEvents.count,
          failed_events: failedEvents.count,
          pending_retries: pendingRetries.count,
          events_last24h: eventsLast24h.count,
          success_rate: parseFloat(successRate as string)
        }
      };

      return responsePayload;
    }),

  getStorageStatus: adminProcedure
    .query(async ({ ctx }) => {
      const { db } = ctx;
      const dbPath = config.databasePath;
      const monitor = new StorageMonitor(db, dbPath);
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
      const { db } = ctx;
      const { limit: rawLimit, offset: rawOffset, since, status } = input;

      // Validate and constrain limit and offset
      const limit = Math.min(Math.max(rawLimit, 1), 500);
      const offset = Math.max(rawOffset, 0);

      // Build query based on status filter
      let whereClause = "WHERE created_at > datetime(?, 'unixepoch')";
      const params: any[] = [since];

      if (status === 'success') {
        whereClause += ' AND processed = 1';
      } else if (status === 'failed') {
        whereClause += ' AND processed = 0';
      }

      // Get total count
      const countResult = db
        .prepare(`SELECT COUNT(*) as count FROM webhook_event ${whereClause}`)
        .get(...params) as { count: number };

      // Get paginated events
      const events = db
        .prepare(
          `
          SELECT id, payload, processed, error_message, created_at
          FROM webhook_event
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `
        )
        .all(...params, limit, offset) as any[];

      // Parse payload JSON for each event
      const parsedEvents = events.map((event: any) => ({
        ...event,
        payload: event.payload ? JSON.parse(event.payload) : null
      }));

      return {
        events: parsedEvents,
        total: countResult.count,
        limit,
        offset
      };
    }),

  enable: adminProcedure
    .mutation(async ({ ctx }) => {
      const { db } = ctx;
      const subscriptionService = new WebhookSubscriptionService(db);
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
      const { db } = ctx;
      const subscriptionService = new WebhookSubscriptionService(db);
      const result = await subscriptionService.disable();

      return {
        enabled: result.id !== null, // Should be false when disabled
        message: 'Webhooks disabled successfully'
      };
    }),

  renew: adminProcedure
    .mutation(async ({ ctx }) => {
      const { db } = ctx;
      const subscriptionService = new WebhookSubscriptionService(db);
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
      const { db } = ctx;
      const { id: eventId } = input;

      // Get the event
      const event = db
        .prepare('SELECT * FROM webhook_event WHERE id = ?')
        .get(eventId) as any;

      if (!event) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Event ${eventId} not found`,
        });
      }

      // Reset error to allow retry
      db.prepare(
        `UPDATE webhook_event
         SET processed = 0, error_message = NULL
         WHERE id = ?`
      ).run(eventId);

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
      const { db } = ctx;
      const { id: eventId } = input;

      // Get the raw event
      const event = db
        .prepare('SELECT id, payload, processed, error_message, created_at FROM webhook_event WHERE id = ?')
        .get(eventId) as any;

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
        const athleteId = payload.owner_id;
        const activityId = payload.object_id;

        // Get participant from our database
        const participant = db
          .prepare('SELECT strava_athlete_id, name FROM participant WHERE strava_athlete_id = ?')
          .get(athleteId) as { strava_athlete_id: number; name: string } | undefined;

        // Initialize enrichment object
        const enrichment: any = {
          athlete: {
            athlete_id: athleteId,
            name: participant?.name || `Unknown (${athleteId})`
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
          if (participant) {
            console.log(`[Admin:Webhooks] Fetching Strava activity details for activity ${activityId}`);
            const token = await getValidAccessToken(db, stravaClientModule, participant.strava_athlete_id); // Pass stravaClientModule
            const activity = await stravaClientModule.getActivity(activityId, token); // Use stravaClientModule.getActivity
            enrichment.strava_data = {
              activity_id: activity.id,
              name: activity.name,
              type: activity.type,
              distance_m: activity.distance,
              moving_time_sec: activity.moving_time,
              elevation_gain_m: activity.elevation_gain,
              start_date_iso: activity.start_date,
              device_name: activity.device_name || null,
              segment_effort_count: activity.segment_efforts?.length || 0,
              visibility: activity.visibility || null
            };
            console.log(`[Admin:Webhooks] ✓ Activity details loaded: '${activity.name}'`);
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
        const storedActivities = db
          .prepare(
            `SELECT a.id, a.strava_activity_id, a.week_id,
                    w.week_name, w.season_id,
                    s.name as season_name,
                    COUNT(se.id) as segment_effort_count,
                    COALESCE(SUM(se.elapsed_seconds), 0) as total_time_seconds
             FROM activity a
             JOIN week w ON a.week_id = w.id
             JOIN season s ON w.season_id = s.id
             LEFT JOIN segment_effort se ON a.id = se.activity_id
             WHERE a.strava_activity_id = ?
             GROUP BY w.id, s.id
             ORDER BY s.id, w.id`
          )
          .all(activityId) as Array<any>;

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
            total_time_seconds: activity.result_time || activity.total_time_seconds,
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
      const { db } = ctx;

      const result = db.prepare('DELETE FROM webhook_event').run() as { changes: number };

      console.log(`[Admin:Webhooks] Cleared ${result.changes} webhook events`);

      return {
        deleted: result.changes,
        message: `Deleted ${result.changes} webhook event(s)`
      };
    }),
});
