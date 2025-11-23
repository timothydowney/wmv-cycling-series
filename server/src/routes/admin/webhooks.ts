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
 * - POST /admin/webhooks/verify - Verify subscription with Strava
 * - POST /admin/webhooks/events/:id/retry - Retry failed event
 * - DELETE /admin/webhooks/events - Clear event history
 */

import { Router, Request, Response } from 'express';
import { Database } from 'better-sqlite3';
import { WebhookSubscriptionService } from '../../services/WebhookSubscriptionService';
import { StorageMonitor } from '../../webhooks/storageMonitor';

export function createWebhookAdminRoutes(db: Database): Router {
  const router = Router();
  const subscriptionService = new WebhookSubscriptionService(db);

  /**
   * GET /admin/webhooks/status
   *
   * Returns:
   * {
   *   enabled: boolean,
   *   status: 'active' | 'inactive' | 'error',
   *   status_message: string,
   *   subscription_id: number | null,
   *   last_verified_at: string | null,
   *   verify_token: string | null,
   *   failed_attempt_count: number,
   *   metrics: {
   *     total_events: number,
   *     successful_events: number,
   *     failed_events: number,
   *     pending_retries: number,
   *     events_last_24h: number,
   *     success_rate: number
   *   },
   *   environment: {
   *     webhook_enabled: boolean,
   *     node_env: string
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
        .prepare('SELECT COUNT(*) as count FROM webhook_event WHERE processed = 0 AND processed_at IS NOT NULL')
        .get() as { count: number };

      const pendingRetries = db
        .prepare(
          'SELECT COUNT(*) as count FROM webhook_event WHERE retry_count > 0 AND retry_count < 3'
        )
        .get() as { count: number };

      const eventsLast24h = db
        .prepare(
          "SELECT COUNT(*) as count FROM webhook_event WHERE created_at > datetime('now', '-1 day')"
        )
        .get() as { count: number };

      const successRate =
        totalEvents.count > 0 ? ((successfulEvents.count / totalEvents.count) * 100).toFixed(1) : '0.0';

      res.json({
        enabled: subscriptionStatus.enabled,
        status: subscriptionStatus.status || 'inactive',
        status_message: subscriptionStatus.status_message || 'Not configured',
        subscription_id: subscriptionStatus.strava_subscription_id || null,
        last_verified_at: subscriptionStatus.last_verified_at || null,
        failed_attempt_count: subscriptionStatus.failed_attempt_count || 0,
        metrics: {
          total_events: totalEvents.count,
          successful_events: successfulEvents.count,
          failed_events: failedEvents.count,
          pending_retries: pendingRetries.count,
          events_last_24h: eventsLast24h.count,
          success_rate: parseFloat(successRate as string)
        },
        environment: {
          webhook_enabled: process.env.WEBHOOK_ENABLED === 'true',
          node_env: process.env.NODE_ENV || 'development'
        }
      });
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
      const dbPath = process.env.DATABASE_PATH || '/data/wmv.db';
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
   *       object_type: string,
   *       aspect_type: string,
   *       object_id: number,
   *       owner_id: number,
   *       processed: boolean,
   *       processed_at: string | null,
   *       error_message: string | null,
   *       retry_count: number,
   *       last_error_at: string | null,
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
          SELECT id, object_type, aspect_type, object_id, owner_id, processed, processed_at, 
                 error_message, retry_count, last_error_at, created_at
          FROM webhook_event
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `
        )
        .all(...params, limit, offset) as any[];

      res.json({
        events,
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
   *   status: string,
   *   message: string
   * }
   */
  router.post('/enable', async (_req: Request, res: Response) => {
    try {
      const result = await subscriptionService.enable();

      res.json({
        enabled: result.enabled,
        subscription_id: result.strava_subscription_id || null,
        status: result.status,
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
        enabled: result.enabled,
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
   * POST /admin/webhooks/verify
   *
   * Verify subscription status with Strava and check if renewal needed.
   *
   * Returns:
   * {
   *   subscription_id: number | null,
   *   status: 'active' | 'inactive' | 'error',
   *   verified_at: string,
   *   needs_renewal: boolean,
   *   message: string
   * }
   */
  router.post('/verify', async (_req: Request, res: Response) => {
    try {
      const verifyResult = await subscriptionService.verify();
      const needsRenewal = subscriptionService.needsRenewal();

      res.json({
        subscription_id: verifyResult.strava_subscription_id || null,
        status: verifyResult.status,
        verified_at: new Date().toISOString(),
        needs_renewal: needsRenewal,
        message: 'Verification complete'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Admin:Webhooks] POST /verify failed:', message);
      res.status(500).json({
        error: 'Failed to verify webhooks',
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

      // Reset retry count to allow retry (will be picked up by queue/processor)
      db.prepare(
        `UPDATE webhook_event
         SET retry_count = 0, last_error_at = NULL, processed = 0, processed_at = NULL, error_message = NULL
         WHERE id = ?`
      ).run(eventId);

      console.log(
        `[Admin:Webhooks] Event ${eventId} (${event.object_type}/${event.aspect_type}) marked for retry`
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
