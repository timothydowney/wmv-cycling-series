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
 * - Activity ingestion fetches once, then retries up to 3 more times for missing segment efforts
 * - Backoff between retries: 15s, 45s, 90s
 * - Failures stored in database with last_error_at timestamp
 * - Re-fetches activity from Strava on retry (not cached payload)
 */

import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { activity, result, segmentEffort, participantToken, participant } from '../db/schema';
import { WebhookEvent, ActivityWebhookEvent, AthleteWebhookEvent } from './types';
import { WebhookLogger } from './logger';
import { getWebhookConfig } from '../config';
import ActivityValidationService from '../services/ActivityValidationService';
import { ChainWaxService } from '../services/ChainWaxService';
import {
  ActivityWebhookHandler,
  createActivityIngestionContext,
  createDefaultActivityHandlers,
  runActivityHandlers
} from './activityHandlers';

/**
 * Service layer for webhook operations
 * Abstracts database operations to make processor testable via dependency injection
 */
export interface WebhookService {
  deleteActivity(stravaActivityId: string): { deleted: boolean; changes: number };
  deleteAthleteTokens(athleteId: string): { deleted: boolean; changes: number };
  findParticipantByAthleteId(athleteId: string): { name: string } | undefined;
}

export interface WebhookProcessorOptions {
  activityHandlers?: ActivityWebhookHandler[];
  validationService?: ActivityValidationService;
}

/**
 * Create default service implementation
 */
function createDefaultService(db: BetterSQLite3Database): WebhookService {
  return {
    deleteActivity(stravaActivityId: string) {
      const activityRecord = db
        .select({ id: activity.id, week_id: activity.week_id })
        .from(activity)
        .where(eq(activity.strava_activity_id, stravaActivityId))
        .get();

      if (!activityRecord) {
        return { deleted: false, changes: 0 };
      }

      // Delete in correct order to respect foreign keys (though SQLite handles CASCADE usually, explicit is safer):
      // 1. result (has FK to activity)
      // 2. segment_effort (has FK to activity)
      // 3. activity (depends on above)
      
      const deletedResults = db.delete(result).where(eq(result.activity_id, activityRecord.id)).run();
      const deletedEfforts = db.delete(segmentEffort).where(eq(segmentEffort.activity_id, activityRecord.id)).run();
      const deletedActivity = db.delete(activity).where(eq(activity.id, activityRecord.id)).run();

      const totalChanges =
        deletedResults.changes + deletedEfforts.changes + deletedActivity.changes;

      return { deleted: true, changes: totalChanges };
    },

    deleteAthleteTokens(athleteId: string) {
      const deleted = db
        .delete(participantToken)
        .where(eq(participantToken.strava_athlete_id, athleteId))
        .run();

      return { deleted: deleted.changes > 0, changes: deleted.changes };
    },

    findParticipantByAthleteId(athleteId: string) {
      return db
        .select({ name: participant.name })
        .from(participant)
        .where(eq(participant.strava_athlete_id, athleteId))
        .get();
    }
  };
}

/**
 * Create a webhook event processor with database access
 * Factory pattern: returns async processor function bound to specific db instance
 * Accepts optional service for testing/dependency injection
 */
export function createWebhookProcessor(
  db: BetterSQLite3Database | null,
  service?: WebhookService,
  options?: WebhookProcessorOptions
) {
  const svc = service || (db ? createDefaultService(db) : null);
  const validationService = options?.validationService || (db ? new ActivityValidationService(db) : null);
  const activityHandlers = options?.activityHandlers || createDefaultActivityHandlers();

  return async function processWebhookEvent(
    event: WebhookEvent,
    logger: WebhookLogger
  ): Promise<void> {
    const startTime = Date.now();

    try {
      if (event.object_type === 'activity') {
        const actEvent = event as ActivityWebhookEvent;
        if (actEvent.aspect_type === 'create' || actEvent.aspect_type === 'update') {
          if (!db || !validationService) {
            throw new Error('Database is required for activity webhook processing');
          }

          await processActivityEvent(actEvent, logger, db, validationService, activityHandlers);
        } else if (actEvent.aspect_type === 'delete') {
          if (!svc) {
            throw new Error('Webhook service is required for delete processing');
          }

          await processActivityDeletion(actEvent, logger, svc, db || undefined);
        }
      } else if (event.object_type === 'athlete') {
        const athEvent = event as AthleteWebhookEvent;
        if (athEvent.aspect_type === 'update' && athEvent.updates?.authorized === false) {
          if (!svc) {
            throw new Error('Webhook service is required for athlete disconnection processing');
          }

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

      const { persistEvents } = getWebhookConfig();
      if (persistEvents) {
        logger.markProcessed(event);
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

      const { persistEvents } = getWebhookConfig();
      if (persistEvents) {
        logger.markFailed(
          event,
          error instanceof Error ? error.message : String(error)
        );
      }

      throw error;
    }
  };
}

/**
 * Process activity create/update event
 *
 * Workflow:
 * 1. Get participant's valid token (auto-refreshes if needed)
 * 2. Fetch full activity details from Strava API
 * 3. Find all active seasons containing this activity's timestamp
 * 4. For each season (if open):
 *    a. Find all weeks in that season
 *    b. Check if activity qualifies for each week
 *    c. Store activity and segment efforts per-season-week
 *
 * Multiple Seasons Support:
 * - Single activity can match multiple overlapping seasons (e.g., Fall + Winter)
 * - Processed independently per season
 * - Skips closed seasons with warning, processes open ones
 * - Results stored per-season-week combination (no conflicts)
 *
 * Reuses exact same activity matching and storage logic as batch fetch,
 * so results are identical between manual and webhook-triggered processes.
 */
async function processActivityEvent(
  event: ActivityWebhookEvent,
  _logger: WebhookLogger,
  db: BetterSQLite3Database,
  validationService: ActivityValidationService,
  activityHandlers: ActivityWebhookHandler[]
): Promise<void> {
  const context = await createActivityIngestionContext(event, db, validationService);

  if (!context) {
    return;
  }

  await runActivityHandlers(context, activityHandlers);
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
  service: WebhookService,
  db?: BetterSQLite3Database
): Promise<void> {
  const activityId = String(event.object_id);
  const athleteId = String(event.owner_id);

  console.log('[Webhook:Processor] Activity deletion event', {
    activityId,
    athleteId
  });

  // Remove from chain wax tracking if applicable
  if (db && ChainWaxService.isTrackedAthlete(athleteId)) {
    try {
      const chainWaxService = new ChainWaxService(db);
      const removed = chainWaxService.removeActivity(activityId);
      if (removed) {
        console.log(`[Webhook:Processor] ✓ Chain wax: removed deleted activity ${activityId}`);
      }
    } catch (error) {
      console.error(`[Webhook:Processor] Chain wax removal error for activity ${activityId}:`, error);
    }
  }

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
  const athleteId = String(event.owner_id);

  console.log('[Webhook:Processor] Athlete deauthorization event', {
    athleteId
  });

  const participantRecord = service.findParticipantByAthleteId(athleteId);

  if (!participantRecord) {
    console.log(
      `[Webhook:Processor] Participant ${athleteId} not found, nothing to disconnect`
    );
    return;
  }

  const result = service.deleteAthleteTokens(athleteId);

  if (result.deleted) {
    console.log(
      `[Webhook:Processor] ✓ Disconnected ${participantRecord.name} (athlete ID: ${athleteId}), deleted ${result.changes} token record(s)`
    );
  } else {
    console.log(
      `[Webhook:Processor] No token record found for ${participantRecord.name} (athlete ID: ${athleteId})`
    );
  }

  console.log(
    '[Webhook:Processor] Note: Historical activities and results remain intact for competition integrity'
  );
}