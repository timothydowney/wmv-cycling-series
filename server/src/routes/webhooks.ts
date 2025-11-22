/**
 * Webhook Routes
 *
 * Endpoints for:
 * - GET /webhooks/strava - Strava subscription validation
 * - POST /webhooks/strava - Receive webhook events from Strava
 *
 * All endpoints guarded by WEBHOOK_ENABLED feature flag.
 * Processing is async - returns 200 immediately, processes in background.
 */

import { Router, Request, Response } from 'express';
import { Database } from 'better-sqlite3';
import { WebhookEvent } from '../webhooks/types';
import { WebhookLogger } from '../webhooks/logger';
import { createWebhookProcessor } from '../webhooks/processor';

export function createWebhookRouter(logger: WebhookLogger, db: Database): Router {
  const router = Router();
  const processWebhookEvent = createWebhookProcessor(db);

  /**
   * GET /webhooks/strava
   *
   * Strava subscription validation endpoint.
   *
   * Strava sends:
   *   ?hub.mode=subscribe
   *   &hub.challenge=<challenge-string>
   *   &hub.verify_token=<your-verify-token>
   *
   * We must respond with:
   *   { "hub.challenge": "<challenge-string>" }
   *
   * within 2 seconds to complete subscription.
   */
  router.get('/strava', (req: Request, res: Response): void => {
    // Feature flag check
    if (process.env.WEBHOOK_ENABLED !== 'true') {
      console.log('[Webhook] GET validation - webhooks disabled');
      res.status(503).json({ error: 'Webhooks disabled' });
      return;
    }

    const mode = req.query['hub.mode'] as string;
    const challenge = req.query['hub.challenge'] as string;
    const token = req.query['hub.verify_token'] as string;

    console.log('[Webhook] GET validation request received', {
      mode,
      token: token ? token.slice(0, 8) + '...' : 'missing'
    });

    // Verify token
    if (token !== process.env.WEBHOOK_VERIFY_TOKEN) {
      console.warn('[Webhook] Invalid verify token');
      res.status(403).json({ error: 'Invalid token' });
      return;
    }

    // Verify mode
    if (mode !== 'subscribe') {
      console.warn('[Webhook] Invalid mode:', mode);
      res.status(400).json({ error: 'Invalid mode' });
      return;
    }

    // Success: echo back challenge
    console.log('[Webhook] ✓ Validation successful');
    res.status(200).json({ 'hub.challenge': challenge });
  });

  /**
   * POST /webhooks/strava
   *
   * Receive webhook events from Strava.
   *
   * CRITICAL: Must respond with 200 OK within 2 seconds.
   * All heavy processing happens async in the background.
   *
   * Event payload:
   *   {
   *     "aspect_type": "create|update|delete",
   *     "event_time": 1549560669,
   *     "object_id": 1234567890,
   *     "object_type": "activity|athlete",
   *     "owner_id": 12345,
   *     "subscription_id": 1,
   *     "updates": { ... }  // optional, for updates
   *   }
   */
  router.post('/strava', (req: Request, res: Response): void => {
    // Feature flag check
    if (process.env.WEBHOOK_ENABLED !== 'true') {
      console.log('[Webhook] POST event - webhooks disabled');
      res.status(503).json({ error: 'Webhooks disabled' });
      return;
    }

    const event = req.body as WebhookEvent;

    console.log('[Webhook] Event received', {
      type: event.object_type,
      aspect: event.aspect_type,
      objectId: event.object_id,
      ownerId: event.owner_id
    });

    // MUST respond immediately with 200 (Strava requirement: 2 seconds)
    res.status(200).json({ received: true });

    // Log event (if enabled)
    if (process.env.WEBHOOK_LOG_EVENTS === 'true') {
      logger.logEvent({
        subscriptionId: event.subscription_id,
        aspectType: event.aspect_type,
        objectType: event.object_type,
        objectId: event.object_id,
        ownerId: event.owner_id,
        processed: false,
        processedAt: null,
        errorMessage: null
      });
    }

    // Process async (don't await - processing happens in background)
    // This ensures we return 200 quickly to Strava
    processWebhookEvent(event, logger).catch((err: any) => {
      console.error('[Webhook] Processing error', {
        objectId: event.object_id,
        objectType: event.object_type,
        error: err instanceof Error ? err.message : String(err)
      });

      // Mark as failed in log if tracking enabled
      if (process.env.WEBHOOK_LOG_EVENTS === 'true') {
        logger.markFailed(
          event.object_id,
          err instanceof Error ? err.message : String(err)
        );
      }
    });
  });

  return router;
}
