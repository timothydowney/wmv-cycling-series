/**
 * Webhook Event Processor
 *
 * Handles async processing of webhook events from Strava.
 * Decoupled from HTTP layer - processes in background with retry logic.
 * Reuses existing activity processing logic from the batch fetch workflow.
 * Processes events sequentially to avoid race conditions with scoring.
 *
 * Handles:
 * - Activity create/update events -> fetch, validate, store
 * - Activity delete events -> remove, recalculate leaderboard
 * - Athlete deauth events -> remove tokens
 *
 * Retry Strategy:
 * - Max 3 attempts per event
 * - 5-second backoff between retries
 * - Failures stored in database with last_error_at timestamp
 * - Re-fetches activity from Strava on retry (not cached payload)
 */

import { Database } from 'better-sqlite3';
import { WebhookEvent, ActivityWebhookEvent, AthleteWebhookEvent } from './types';
import { WebhookLogger } from './logger';
import { QueuedEvent } from './queue';
import * as stravaClient from '../stravaClient';
import { getValidAccessToken } from '../tokenManager';
import { findBestQualifyingActivity } from '../activityProcessor';
import { storeActivityAndEfforts } from '../activityStorage';
import { WeekRow } from '../types/database';

/**
 * Service layer for webhook operations
 * Abstracts database operations to make processor testable via dependency injection
 */
export interface WebhookService {
  deleteActivity(stravaActivityId: number): { deleted: boolean; changes: number };
  deleteAthleteTokens(athleteId: number): { deleted: boolean; changes: number };
  findParticipantByAthleteId(athleteId: number): { name: string } | undefined;
}

/**
 * Create default service implementation
 */
function createDefaultService(db: Database): WebhookService {
  return {
    deleteActivity(stravaActivityId: number) {
      const activity = db
        .prepare('SELECT id, week_id FROM activity WHERE strava_activity_id = ?')
        .get(stravaActivityId) as { id: number; week_id: number } | undefined;

      if (!activity) {
        return { deleted: false, changes: 0 };
      }

      // Delete in correct order to respect foreign keys:
      // 1. result (has FK to activity)
      // 2. segment_effort (has FK to activity)
      // 3. activity (depends on above)
      const deletedResults = db
        .prepare('DELETE FROM result WHERE activity_id = ?')
        .run(activity.id) as { changes: number };

      const deletedEfforts = db
        .prepare('DELETE FROM segment_effort WHERE activity_id = ?')
        .run(activity.id) as { changes: number };

      const deletedActivity = db
        .prepare('DELETE FROM activity WHERE id = ?')
        .run(activity.id) as { changes: number };

      const totalChanges =
        deletedResults.changes + deletedEfforts.changes + deletedActivity.changes;

      return { deleted: true, changes: totalChanges };
    },

    deleteAthleteTokens(athleteId: number) {
      const deleted = db
        .prepare('DELETE FROM participant_token WHERE strava_athlete_id = ?')
        .run(athleteId) as { changes: number };

      return { deleted: deleted.changes > 0, changes: deleted.changes };
    },

    findParticipantByAthleteId(athleteId: number) {
      return db
        .prepare('SELECT name FROM participant WHERE strava_athlete_id = ?')
        .get(athleteId) as { name: string } | undefined;
    }
  };
}

/**
 * Create a webhook event processor with database access
 * Factory pattern: returns async processor function bound to specific db instance
 * Accepts optional service for testing/dependency injection
 */
export function createWebhookProcessor(db: Database, service?: WebhookService) {
  const svc = service || createDefaultService(db);

  return async function processWebhookEvent(
    event: WebhookEvent,
    logger: WebhookLogger
  ): Promise<void> {
    const startTime = Date.now();

    try {
      if (event.object_type === 'activity') {
        const actEvent = event as ActivityWebhookEvent;
        if (actEvent.aspect_type === 'create' || actEvent.aspect_type === 'update') {
          await processActivityEvent(actEvent, logger, db);
        } else if (actEvent.aspect_type === 'delete') {
          await processActivityDeletion(actEvent, logger, svc);
        }
      } else if (event.object_type === 'athlete') {
        const athEvent = event as AthleteWebhookEvent;
        if (athEvent.aspect_type === 'update' && athEvent.updates?.authorized === false) {
          await processAthleteDisconnection(athEvent, logger, svc);
        }
      }

      const duration = Date.now() - startTime;
      console.log('[Webhook] ✓ Event processed', {
        type: event.object_type,
        aspect: event.aspect_type,
        objectId: event.object_id,
        duration: `${duration}ms`
      });

      if (process.env.WEBHOOK_LOG_EVENTS === 'true') {
        logger.markProcessed(event.object_id, new Date().toISOString());
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[Webhook] Processing failed', {
        type: event.object_type,
        aspect: event.aspect_type,
        objectId: event.object_id,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error)
      });

      if (process.env.WEBHOOK_LOG_EVENTS === 'true') {
        logger.markFailed(
          event.object_id,
          error instanceof Error ? error.message : String(error)
        );
      }

      throw error;
    }
  };
}

/**
 * Create a queue processor function for webhook events
 *
 * Handles retry logic:
 * - 3 total attempts (initial + 2 retries)
 * - 5 second delay between retries
 * - Stores original payload JSON for debugging/replay
 * - Updates last_error_at timestamp on failures
 * - Re-fetches activity from Strava on retry (not cached payload)
 *
 * Returns: async function suitable for WebhookEventQueue.processor
 */
export function createQueueProcessor(db: Database, service?: WebhookService) {
  const svc = service || createDefaultService(db);

  return async function processQueuedEvent(queuedEvent: QueuedEvent): Promise<void> {
    const maxRetries = queuedEvent.max_retries || 3;
    const retryDelay = 5000; // 5 seconds

    // Parse event data
    let event: WebhookEvent;
    try {
      event = queuedEvent.event_data as WebhookEvent;
    } catch {
      console.error(
        `[Webhook:Queue] Failed to parse event data for object ${queuedEvent.event_data?.object_id}`
      );
      throw new Error('Invalid event data format');
    }

    const logger = new WebhookLogger(db);
    const currentAttempt = queuedEvent.retry_count + 1;

    console.log(
      `[Webhook:Queue] Processing event (attempt ${currentAttempt}/${maxRetries}): ${event.object_type}/${event.aspect_type} ID=${event.object_id}`
    );

    try {
      // Invoke the original processor
      const processor = createWebhookProcessor(db, svc);
      await processor(event, logger);

      // Success - update retry count to 0
      db.prepare(
        `UPDATE webhook_event 
         SET retry_count = 0, last_error_at = NULL
         WHERE object_id = ?`
      ).run(event.object_id);

      console.log(
        `[Webhook:Queue] ✓ Event succeeded: ${event.object_type}/${event.aspect_type} ID=${event.object_id}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update event with error timestamp
      db.prepare(
        `UPDATE webhook_event
         SET retry_count = ?, last_error_at = CURRENT_TIMESTAMP
         WHERE object_id = ?`
      ).run(currentAttempt, event.object_id);

      // Check if we should retry
      if (currentAttempt < maxRetries) {
        console.log(
          `[Webhook:Queue] ⏳ Event failed, retrying in ${retryDelay / 1000}s (attempt ${currentAttempt}/${maxRetries}): ${event.object_type}/${event.aspect_type} ID=${event.object_id}`
        );
        console.error(`  Error: ${errorMessage}`);

        // Wait before returning - queue will pick up retry when event is enqueued again
        // For now, throw error and let caller decide on retry timing
        throw new Error(`Event processing failed (attempt ${currentAttempt}/${maxRetries}): ${errorMessage}`);
      } else {
        // Max retries exceeded
        console.error(
          `[Webhook:Queue] ❌ Event failed after ${maxRetries} attempts: ${event.object_type}/${event.aspect_type} ID=${event.object_id}`
        );
        console.error(`  Error: ${errorMessage}`);
        throw new Error(`Event failed after ${maxRetries} attempts: ${errorMessage}`);
      }
    }
  };
}

/**
 * Process activity create/update event
 *
 * Workflow:
 * 1. Get participant's valid token (auto-refreshes if needed)
 * 2. Fetch full activity details from Strava API
 * 3. Find all active weeks
 * 4. For each week, check if this activity qualifies and is best
 * 5. If best, store activity and segment efforts
 *
 * Reuses exact same activity matching and storage logic as batch fetch,
 * so results are identical between manual and webhook-triggered processes.
 */
async function processActivityEvent(
  event: ActivityWebhookEvent,
  _logger: WebhookLogger,
  db: Database
): Promise<void> {
  const { object_id: activityId, owner_id: athleteId } = event;

  console.log('[Webhook:Processor] Activity event', {
    activityId,
    athleteId,
    aspect: event.aspect_type
  });

  // 1. Find participant and get their token
  const participant = db
    .prepare('SELECT strava_athlete_id, name FROM participant WHERE strava_athlete_id = ?')
    .get(athleteId) as { strava_athlete_id: number; name: string } | undefined;

  if (!participant) {
    console.log(`[Webhook:Processor] Participant ${athleteId} not found, skipping`);
    return;
  }

  console.log(
    `[Webhook:Processor] Processing for ${participant.name} (athlete ID: ${athleteId})`
  );

  // Get valid token (auto-refreshes if needed)
  const accessToken = await getValidAccessToken(db, stravaClient, athleteId);

  // 2. Fetch full activity details
  console.log(
    `[Webhook:Processor] Fetching activity details for ID: ${activityId}`
  );
  const activity = await stravaClient.getActivity(activityId, accessToken);

  if (!activity.segment_efforts || activity.segment_efforts.length === 0) {
    console.log(
      `[Webhook:Processor] Activity ${activityId} has no segment efforts, skipping`
    );
    return;
  }

  // 3. Find all active weeks that could match this activity
  const weeks = db
    .prepare(
      `
      SELECT w.id, w.week_name, w.strava_segment_id, w.required_laps, w.start_at, w.end_at,
             s.name as segment_name
      FROM week w
      JOIN segment s ON w.strava_segment_id = s.strava_segment_id
      ORDER BY w.start_at DESC
    `
    )
    .all() as Array<any>;

  let processedWeeks = 0;
  let matchedWeeks = 0;

  // 4. For each active week, check if this activity is best
  for (const week of weeks) {
    // Convert week timestamps to Date for comparison with ISO string
    const weekStart = new Date(week.start_at * 1000);
    const weekEnd = new Date(week.end_at * 1000);
    const activityDate = new Date(activity.start_date as string);

    if (activityDate < weekStart || activityDate > weekEnd) {
      continue; // Activity not in this week's time window
    }

    processedWeeks++;
    console.log(
      `[Webhook:Processor] Checking week ${week.id} (${week.week_name}, segment: ${week.strava_segment_id})`
    );

    try {
      // Reuse findBestQualifyingActivity from batch fetch
      // Pass the activity and week context
      const bestActivity = await findBestQualifyingActivity(
        [activity] as any,
        week.strava_segment_id,
        week.required_laps,
        accessToken,
        { start_at: week.start_at, end_at: week.end_at } as Pick<WeekRow, 'start_at' | 'end_at'>
      );

      if (bestActivity) {
        matchedWeeks++;
        console.log(
          `[Webhook:Processor] Activity ${activityId} qualifies for week ${week.id}`
        );

        // 5. Store activity and efforts (reuses batch fetch logic)
        storeActivityAndEfforts(
          db,
          athleteId,
          week.id,
          {
            id: bestActivity.id,
            start_date: bestActivity.start_date,
            device_name: bestActivity.device_name || undefined,
            segmentEfforts: bestActivity.segmentEfforts as any,
            totalTime: bestActivity.totalTime
          },
          week.strava_segment_id
        );

        console.log(
          `[Webhook:Processor] ✓ Activity stored for week ${week.id}, time: ${Math.round(
            bestActivity.totalTime / 60
          )} min`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[Webhook:Processor] Failed to process week ${week.id}: ${message}`
      );
      // Continue to next week - don't fail entire event
    }
  }

  console.log(
    `[Webhook:Processor] ✓ Finished activity ${activityId}: checked ${processedWeeks} weeks, matched ${matchedWeeks}`
  );
}

/**
 * Process activity deletion event
 *
 * Workflow:
 * 1. Find all activities using this Strava activity ID
 * 2. Remove all segment efforts associated with activity
 * 3. Remove activity record
 * 4. Remove all results for this activity
 *
 * Uses database transactions to ensure atomicity.
 */
async function processActivityDeletion(
  event: ActivityWebhookEvent,
  _logger: WebhookLogger,
  service: WebhookService
): Promise<void> {
  const { object_id: activityId, owner_id: athleteId } = event;

  console.log('[Webhook:Processor] Activity deletion event', {
    activityId,
    athleteId
  });

  const result = service.deleteActivity(activityId);

  if (result.deleted) {
    console.log(
      `[Webhook:Processor] ✓ Deleted activity ${activityId}: ${result.changes} records removed`
    );
  } else {
    console.log(
      `[Webhook:Processor] Activity ${activityId} not found in database, nothing to delete`
    );
  }
}

/**
 * Process athlete deauthorization event
 *
 * Workflow:
 * 1. Find participant by Strava athlete ID
 * 2. Delete their OAuth tokens
 * 3. Leave their historical data intact (activities, results, etc.)
 *
 * Note: We keep historical data for competition integrity (leaderboards
 * should remain consistent across a season). If they reconnect with a new
 * token later, they'll have a fresh start.
 */
async function processAthleteDisconnection(
  event: AthleteWebhookEvent,
  _logger: WebhookLogger,
  service: WebhookService
): Promise<void> {
  const { owner_id: athleteId } = event;

  console.log('[Webhook:Processor] Athlete deauthorization event', {
    athleteId
  });

  const participant = service.findParticipantByAthleteId(athleteId);

  if (!participant) {
    console.log(
      `[Webhook:Processor] Participant ${athleteId} not found, nothing to disconnect`
    );
    return;
  }

  const result = service.deleteAthleteTokens(athleteId);

  if (result.deleted) {
    console.log(
      `[Webhook:Processor] ✓ Disconnected ${participant.name} (athlete ID: ${athleteId}), deleted ${result.changes} token record(s)`
    );
  } else {
    console.log(
      `[Webhook:Processor] No token record found for ${participant.name} (athlete ID: ${athleteId})`
    );
  }

  console.log(
    '[Webhook:Processor] Note: Historical activities and results remain intact for competition integrity'
  );
}
