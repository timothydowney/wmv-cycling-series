/**
 * Admin Webhook Management Routes
 *
 * Endpoints for managing webhook subscriptions and viewing event history.
 * All endpoints require admin authentication.
 *
 * Endpoints:
 * - GET /admin/webhooks/status - Get subscription status and metrics
 * - GET /admin/webhooks/events - Get event history with pagination
 * - POST /admin/webhooks/enable - Enable webhooks
 * - POST /admin/webhooks/disable - Disable webhooks
 * - POST /admin/webhooks/renew - Renew webhook subscription
 * - DELETE /admin/webhooks/events - Clear event history
 */

import { Router, Request, Response } from 'express';
import { Database } from 'better-sqlite3';
import { config } from '../../config';
import { WebhookSubscriptionService } from '../../services/WebhookSubscriptionService';
import { StorageMonitor } from '../../webhooks/storageMonitor';
import * as stravaClient from '../../stravaClient';
import { getValidAccessToken } from '../../tokenManager';

export function createWebhookAdminRoutes(db: Database): Router {
  const router = Router();
  const subscriptionService = new WebhookSubscriptionService(db);

  /**
   * GET /admin/webhooks/status
   *
   * Returns:
   * {
   *   enabled: boolean,
   *   subscription_id: number | null,
   *   created_at: string | null,
   *   expires_at: string | null,
   *   last_refreshed_at: string | null,
   *   metrics: {
   *     total_events: number,
   *     successful_events: number,
   *     failed_events: number,
   *     pending_retries: number,
   *     events_last_24h: number,
   *     success_rate: number
   *   }
   * }
   */
  router.get('/status', (_req: Request, res: Response) => {
    try {
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
          events_last_24h: eventsLast24h.count,
          success_rate: parseFloat(successRate as string)
        }
      };

      res.json(responsePayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Admin:Webhooks] GET /status failed:', message);
      res.status(500).json({
        error: 'Failed to get webhook status',
        message
      });
    }
  });

  /**
   * GET /admin/webhooks/storage-status
   *
   * Returns storage usage info and auto-disable thresholds.
   *
   * Returns:
   * {
   *   database_size_mb: number,
   *   available_space_mb: number,
   *   usage_percentage: number,
   *   auto_disable_threshold: number,
   *   should_auto_disable: boolean,
   *   events_count: number,
   *   events_per_day: number,
   *   estimated_weeks_remaining: number,
   *   last_calculated_at: string,
   *   warning_message: string | null
   * }
   */
  router.get('/storage-status', (_req: Request, res: Response) => {
    try {
      const dbPath = config.databasePath;
      const monitor = new StorageMonitor(db, dbPath);
      const status = monitor.getStatus();

      res.json(status);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Admin:Webhooks] GET /storage-status failed:', message);
      res.status(500).json({
        error: 'Failed to get storage status',
        message
      });
    }
  });

  /**
   * GET /admin/webhooks/events
   *
   * Query Parameters:
   * - limit: number (default 50, max 500)
   * - offset: number (default 0)
   * - since: number (unix seconds, default last 7 days)
   * - status: 'all' | 'success' | 'failed' (default 'all')
   *
   * Returns:
   * {
   *   events: [
   *     {
   *       id: number,
   *       payload: any,
   *       processed: boolean,
   *       error_message: string | null,
   *       created_at: string
   *     }
   *   ],
   *   total: number,
   *   limit: number,
   *   offset: number
   * }
   */
  router.get('/events', (req: Request, res: Response) => {
    try {
      let limit = parseInt(req.query.limit as string) || 50;
      let offset = parseInt(req.query.offset as string) || 0;
      const since = parseInt(req.query.since as string) || Math.floor(Date.now() / 1000) - 604800; // 7 days
      const status = (req.query.status as string) || 'all';

      // Validate and constrain limit
      limit = Math.min(Math.max(limit, 1), 500);
      offset = Math.max(offset, 0);

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

      res.json({
        events: parsedEvents,
        total: countResult.count,
        limit,
        offset
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Admin:Webhooks] GET /events failed:', message);
      res.status(500).json({
        error: 'Failed to get webhook events',
        message
      });
    }
  });

  /**
   * POST /admin/webhooks/enable
   *
   * Enable webhooks and create subscription if needed.
   *
   * Returns:
   * {
   *   enabled: true,
   *   subscription_id: number | null,
   *   created_at: string | null,
   *   message: string
   * }
   */
  router.post('/enable', async (_req: Request, res: Response) => {
    try {
      const result = await subscriptionService.enable();

      res.json({
        enabled: result.id !== null,
        subscription_id: result.subscription_id,
        created_at: result.created_at,
        message: 'Webhooks enabled successfully'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Admin:Webhooks] POST /enable failed:', message);
      res.status(500).json({
        error: 'Failed to enable webhooks',
        message
      });
    }
  });

  /**
   * POST /admin/webhooks/disable
   *
   * Disable webhooks. Note: Does NOT unsubscribe from Strava,
   * just stops processing new events.
   *
   * Returns:
   * {
   *   enabled: false,
   *   message: string
   * }
   */
  router.post('/disable', async (_req: Request, res: Response) => {
    try {
      const result = await subscriptionService.disable();

      res.json({
        enabled: result.id !== null,
        message: 'Webhooks disabled successfully'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Admin:Webhooks] POST /disable failed:', message);
      res.status(500).json({
        error: 'Failed to disable webhooks',
        message
      });
    }
  });

  /**
   * POST /admin/webhooks/renew
   *
   * Renew the webhook subscription by deleting the old one and creating a new one.
   * This is needed when subscription is expiring (every 24 hours).
   *
   * Returns:
   * {
   *   enabled: boolean,
   *   subscription_id: number | null,
   *   created_at: string | null,
   *   expires_at: string | null,
   *   message: string
   * }
   */
  router.post('/renew', async (_req: Request, res: Response) => {
    try {
      const result = await subscriptionService.renew();

      res.json({
        enabled: result.id !== null,
        subscription_id: result.subscription_id,
        created_at: result.created_at,
        expires_at: result.expires_at,
        message: 'Webhooks renewed successfully'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Admin:Webhooks] POST /renew failed:', message);
      res.status(500).json({
        error: 'Failed to renew webhooks',
        message
      });
    }
  });

  /**
   * POST /admin/webhooks/events/:id/retry
   *
   * Manually retry a failed event.
   *
   * Parameters:
   * - id: webhook_event.id
   *
   * Returns:
   * {
   *   event_id: number,
   *   queued: boolean,
   *   message: string
   * }
   */
  router.post('/events/:id/retry', (req: Request, res: Response): void => {
    try {
      const eventId = parseInt(req.params.id);

      if (!eventId) {
        res.status(400).json({
          error: 'Invalid event ID'
        });
        return;
      }

      // Get the event
      const event = db
        .prepare('SELECT * FROM webhook_event WHERE id = ?')
        .get(eventId) as any;

      if (!event) {
        res.status(404).json({
          error: 'Event not found',
          event_id: eventId
        });
        return;
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

      res.json({
        event_id: eventId,
        queued: true,
        message: 'Event marked for retry. Processor will pick it up on next cycle.'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Admin:Webhooks] POST /events/:id/retry failed:', message);
      res.status(500).json({
        error: 'Failed to retry event',
        message
      });
    }
  });

  /**
   * DELETE /admin/webhooks/events
   *
   * Clear all webhook events from the database.
   * WARNING: This deletes all history!
   *
   * Query Parameters:
   * - confirm: 'yes' (must be present to actually delete)
   *
   * Returns:
   * {
   *   deleted: number,
   *   message: string
   * }
   */
  /**
   * GET /admin/webhooks/events/enriched/:id
   *
   * Get enriched details for a single activity webhook event.
   * For activity events, includes:
   * - Participant name and info
   * - Activity details (name, type, distance, etc.)
   * - Matching seasons and weeks
   * - Segment matching details
   * - Processing status
   *
   * Returns:
   * {
   *   event: {
   *     id: number,
   *     created_at: string,
   *     processed: boolean,
   *     error_message: string | null,
   *     payload: WebhookPayload
   *   },
   *   enrichment?: {
   *     athlete: {
   *       name: string,
   *       athlete_id: number
   *     },
   *     activity?: {
   *       name: string,
   *       type: string,
   *       distance_m: number,
   *       moving_time_sec: number,
   *       elevation_gain_m: number,
   *       start_date_iso: string,
   *       segment_effort_count: number
   *     },
   *     matching_seasons: Array<{
   *       season_id: number,
   *       season_name: string,
   *       matched_weeks: Array<{
   *         week_id: number,
   *         week_name: string,
   *         segment_name: string,
   *         required_laps: number,
   *         matched: boolean,
   *         reason?: string
   *       }>
   *     }>,
   *     summary: {
   *       status: 'qualified' | 'no_matching_weeks' | 'no_segments' | 'insufficient_laps' | 'error',
   *       message: string,
   *       total_weeks_checked: number,
   *       total_weeks_matched: number,
   *       total_seasons: number
   *     }
   *   }
   * }
   */
  router.get('/events/enriched/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const eventId = parseInt(req.params.id);

      if (!eventId || isNaN(eventId)) {
        res.status(400).json({ error: 'Invalid event ID' });
        return;
      }

      // Get the raw event
      const event = db
        .prepare('SELECT id, payload, processed, error_message, created_at FROM webhook_event WHERE id = ?')
        .get(eventId) as any;

      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
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

        // Get participant from our database (for OAuth token)
        const participant = db
          .prepare('SELECT name FROM participant WHERE strava_athlete_id = ?')
          .get(athleteId) as { name: string } | undefined;

        // Initialize enrichment object
        const enrichment: any = {
          athlete: {
            athlete_id: athleteId,
            name: participant?.name || null // Will be filled from Strava
          },
          activity: null,
          strava_data: null,
          matching_seasons: [],
          summary: {
            status: 'error',
            message: '',
            total_weeks_checked: 0,
            total_weeks_matched: 0,
            total_seasons: 0
          }
        };

        try {
          // ALWAYS fetch from Strava API (source of truth)
          // Use participant's token if available
          let accessToken: string | null = null;
          if (participant) {
            try {
              accessToken = await getValidAccessToken(db, stravaClient, athleteId);
            } catch (err) {
              console.log(`[Admin:Webhooks] Could not get access token for athlete ${athleteId}`);
              // Continue anyway - we may still have limited data
            }
          }

          // Fetch activity from Strava
          let stravaActivity: any = null;
          if (accessToken) {
            try {
              stravaActivity = await stravaClient.getActivity(activityId, accessToken);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.log(
                `[Admin:Webhooks] Failed to fetch activity ${activityId} from Strava: ${msg}`
              );
            }
          }

          if (!stravaActivity) {
            // Can't get Strava data - return limited enrichment with helpful message
            enrichment.summary = {
              status: 'error',
              message: `Activity ${activityId} not found on Strava or not accessible. This could mean: (1) activity doesn't exist, (2) it was deleted, (3) athlete's token expired, or (4) activity is private and not shared.`,
              total_weeks_checked: 0,
              total_weeks_matched: 0,
              total_seasons: 0
            };
            response.enrichment = enrichment;
            res.json(response);
            return;
          }

          // Use Strava as source of truth for activity data
          enrichment.athlete.name = stravaActivity.athlete?.firstname || participant?.name || `Unknown (${athleteId})`;
          enrichment.strava_data = {
            activity_id: stravaActivity.id,
            name: stravaActivity.name,
            type: stravaActivity.type,
            distance_m: stravaActivity.distance,
            moving_time_sec: stravaActivity.moving_time,
            elevation_gain_m: stravaActivity.total_elevation_gain,
            start_date_iso: stravaActivity.start_date,
            device_name: stravaActivity.device_name,
            segment_effort_count: stravaActivity.segment_efforts?.length || 0,
            visibility: stravaActivity.visibility
          };

          // Only query our database for matching context if activity has segment efforts
          if (!stravaActivity.segment_efforts || stravaActivity.segment_efforts.length === 0) {
            enrichment.summary = {
              status: 'no_segments',
              message: 'Activity has no segment efforts',
              total_weeks_checked: 0,
              total_weeks_matched: 0,
              total_seasons: 0
            };
            response.enrichment = enrichment;
            res.json(response);
            return;
          }

          // Convert Strava timestamp to Unix for comparison with our season/week times
          const activityUnix = Math.floor(
            new Date(stravaActivity.start_date as string).getTime() / 1000
          );

          // Get matching weeks from our database
          const seasons = db
            .prepare('SELECT DISTINCT season_id FROM week ORDER BY season_id')
            .all() as Array<{ season_id: number }>;

          let totalWeeksChecked = 0;
          let totalWeeksMatched = 0;
          const matchingSeasons: any[] = [];

          for (const { season_id } of seasons) {
            const season = db
              .prepare('SELECT id, name, start_at, end_at FROM season WHERE id = ?')
              .get(season_id) as any;

            if (!season) continue;

            // Check if activity is within season's date range
            if (activityUnix < season.start_at || activityUnix > season.end_at) {
              continue;
            }

            // Get weeks in this season
            const weeks = db
              .prepare(
                `SELECT w.id, w.week_name, s.name as segment_name, w.strava_segment_id, 
                        w.required_laps, w.start_at, w.end_at
                 FROM week w
                 JOIN segment s ON w.strava_segment_id = s.strava_segment_id
                 WHERE w.season_id = ?
                 ORDER BY w.start_at`
              )
              .all(season_id) as Array<any>;

            let seasonMatchedWeeks = 0;
            const matchedWeeks: any[] = [];

            for (const week of weeks) {
              totalWeeksChecked++;

              // Check if activity is within week's time window
              if (activityUnix < week.start_at || activityUnix > week.end_at) {
                matchedWeeks.push({
                  week_id: week.id,
                  week_name: week.week_name,
                  segment_name: week.segment_name,
                  required_laps: week.required_laps,
                  matched: false,
                  reason: 'Outside time window'
                });
                continue;
              }

              // Count segment efforts for this segment from Strava data
              const segmentEffortsForWeek = stravaActivity.segment_efforts.filter(
                (effort: any) => effort.segment.id === week.strava_segment_id
              );

              const matched = segmentEffortsForWeek.length >= week.required_laps;

              if (matched) {
                totalWeeksMatched++;
                seasonMatchedWeeks++;
              }

              matchedWeeks.push({
                week_id: week.id,
                week_name: week.week_name,
                segment_name: week.segment_name,
                required_laps: week.required_laps,
                segment_efforts_found: segmentEffortsForWeek.length,
                matched,
                reason: matched ? undefined : `${segmentEffortsForWeek.length}/${week.required_laps} laps`
              });
            }

            if (weeks.length > 0) {
              matchingSeasons.push({
                season_id: season.id,
                season_name: season.name,
                matched_weeks_count: seasonMatchedWeeks,
                matched_weeks: matchedWeeks
              });
            }
          }

          enrichment.matching_seasons = matchingSeasons;
          enrichment.summary = {
            status:
              totalWeeksMatched > 0
                ? 'qualified'
                : totalWeeksChecked === 0
                  ? 'no_matching_weeks'
                  : 'no_qualifying_weeks',
            message:
              totalWeeksMatched > 0
                ? `Activity matches ${totalWeeksMatched} week(s) across ${matchingSeasons.length} season(s)`
                : totalWeeksChecked === 0
                  ? 'Activity timestamp not in any season date range'
                  : `Activity checked against ${totalWeeksChecked} week(s), but doesn't qualify for any`,
            total_weeks_checked: totalWeeksChecked,
            total_weeks_matched: totalWeeksMatched,
            total_seasons: matchingSeasons.length
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`[Admin:Webhooks] Error enriching activity: ${msg}`);
          enrichment.summary = {
            status: 'error',
            message: `Failed to enrich activity: ${msg}`,
            total_weeks_checked: 0,
            total_weeks_matched: 0,
            total_seasons: 0
          };
        }

        response.enrichment = enrichment;
      }

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Admin:Webhooks] GET /events/enriched/:id failed:', message);
      res.status(500).json({
        error: 'Failed to get enriched event details',
        message
      });
    }
  });

  router.delete('/events', (req: Request, res: Response): void => {
    try {
      // Require explicit confirmation
      if (req.query.confirm !== 'yes') {
        res.status(400).json({
          error: 'Confirmation required',
          message: 'Pass ?confirm=yes to clear all events'
        });
        return;
      }

      const result = db.prepare('DELETE FROM webhook_event').run() as { changes: number };

      console.log(`[Admin:Webhooks] Cleared ${result.changes} webhook events`);

      res.json({
        deleted: result.changes,
        message: `Deleted ${result.changes} webhook event(s)`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Admin:Webhooks] DELETE /events failed:', message);
      res.status(500).json({
        error: 'Failed to clear events',
        message
      });
    }
  });

  return router;
}
