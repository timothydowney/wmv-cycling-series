/**
 * Webhook Event Logger
 *
 * Logs webhook events to database for debugging and monitoring.
 * Optional - can be enabled/disabled via WEBHOOK_LOG_EVENTS env var.
 */

import Database from 'better-sqlite3';

export interface WebhookEventLogEntry {
  subscriptionId: number | null;
  aspectType: string;
  objectType: string;
  objectId: number;
  ownerId: number;
  processed: boolean;
  processedAt: string | null;
  errorMessage: string | null;
}

export class WebhookLogger {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Log a webhook event to database
   */
  logEvent(entry: WebhookEventLogEntry): void {
    if (process.env.WEBHOOK_LOG_EVENTS !== 'true') {
      return;
    }

    try {
      this.db.prepare(`
        INSERT INTO webhook_event (
          subscription_id, aspect_type, object_type, object_id, owner_id,
          processed, processed_at, error_message, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(
        entry.subscriptionId,
        entry.aspectType,
        entry.objectType,
        entry.objectId,
        entry.ownerId,
        entry.processed ? 1 : 0,
        entry.processedAt || null,
        entry.errorMessage || null
      );
    } catch (error) {
      console.error('[Webhook Logger] Failed to log event', {
        error: error instanceof Error ? error.message : String(error),
        objectId: entry.objectId
      });
      // Don't throw - logging failure shouldn't break webhook processing
    }
  }

  /**
   * Mark event as processed
   */
  markProcessed(objectId: number, processedAt: string): void {
    if (process.env.WEBHOOK_LOG_EVENTS !== 'true') {
      return;
    }

    try {
      this.db.prepare(`
        UPDATE webhook_event
        SET processed = 1, processed_at = ?
        WHERE object_id = ? AND processed = 0
        ORDER BY created_at DESC
        LIMIT 1
      `).run(processedAt, objectId);
    } catch (error) {
      console.error('[Webhook Logger] Failed to mark processed', {
        error: error instanceof Error ? error.message : String(error),
        objectId
      });
    }
  }

  /**
   * Mark event as failed
   */
  markFailed(objectId: number, errorMessage: string): void {
    if (process.env.WEBHOOK_LOG_EVENTS !== 'true') {
      return;
    }

    try {
      this.db.prepare(`
        UPDATE webhook_event
        SET error_message = ?, processed_at = CURRENT_TIMESTAMP
        WHERE object_id = ? AND processed = 0
        ORDER BY created_at DESC
        LIMIT 1
      `).run(errorMessage, objectId);
    } catch (error) {
      console.error('[Webhook Logger] Failed to mark error', {
        error: error instanceof Error ? error.message : String(error),
        objectId
      });
    }
  }

  /**
   * Get webhook health status (for admin dashboard)
   */
  getStatus(): {
    totalEvents: number;
    processedCount: number;
    failedCount: number;
    lastEventTime: string | null;
    } {
    try {
      const stats = this.db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) as failed,
          MAX(created_at) as last_event
        FROM webhook_event
      `).get() as any;

      return {
        totalEvents: stats.total || 0,
        processedCount: stats.successful || 0,
        failedCount: stats.failed || 0,
        lastEventTime: stats.last_event || null
      };
    } catch (error) {
      console.error('[Webhook Logger] Failed to get status', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        totalEvents: 0,
        processedCount: 0,
        failedCount: 0,
        lastEventTime: null
      };
    }
  }
}
