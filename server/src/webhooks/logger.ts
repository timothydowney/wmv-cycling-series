/**
 * Webhook Event Logger
 *
 * Persists webhook events to database for monitoring and debugging.
 * Events are marked as processed (success) or failed (with error message).
 * Can be enabled/disabled via WEBHOOK_PERSIST_EVENTS env var.
 */

import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, and, desc, sql } from 'drizzle-orm';
import { webhookEvent } from '../db/schema';

export interface WebhookEventLogEntry {
  payload: unknown;
  processed?: boolean;
  errorMessage?: string | null;
}

export class WebhookLogger {
  constructor(private db: BetterSQLite3Database) {}

  /**
   * Log a webhook event to database
   */
  logEvent(entry: WebhookEventLogEntry): void {
    try {
      const processedValue = entry.processed ? 1 : 0;
      this.db.insert(webhookEvent).values({
        payload: JSON.stringify(entry.payload),
        processed: processedValue,
        error_message: entry.errorMessage || null,
        created_at: new Date().toISOString()
      }).execute();
    } catch (error) {
      console.error('[Webhook Logger] Failed to log event', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw - logging failure shouldn't break webhook processing
    }
  }

  /**
   * Mark event as processed by payload ID
   */
  markProcessed(payload: unknown): void {
    try {
      const payloadStr = JSON.stringify(payload);
      const record = this.db
        .select({ id: webhookEvent.id })
        .from(webhookEvent)
        .where(and(eq(webhookEvent.payload, payloadStr), eq(webhookEvent.processed, 0)))
        .orderBy(desc(webhookEvent.created_at))
        .limit(1)
        .get();

      if (record) {
        this.db
          .update(webhookEvent)
          .set({ processed: 1 })
          .where(eq(webhookEvent.id, record.id))
          .execute();
      }
    } catch (error) {
      console.error('[Webhook Logger] Failed to mark processed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Mark event as failed
   */
  markFailed(payload: unknown, errorMessage: string): void {
    try {
      const payloadStr = JSON.stringify(payload);
      const record = this.db
        .select({ id: webhookEvent.id })
        .from(webhookEvent)
        .where(and(eq(webhookEvent.payload, payloadStr), eq(webhookEvent.processed, 0)))
        .orderBy(desc(webhookEvent.created_at))
        .limit(1)
        .get();

      if (record) {
        this.db
          .update(webhookEvent)
          .set({ error_message: errorMessage })
          .where(eq(webhookEvent.id, record.id))
          .execute();
      }
    } catch (error) {
      console.error('[Webhook Logger] Failed to mark error', {
        error: error instanceof Error ? error.message : String(error)
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
      const stats = this.db
        .select({
          total: sql<number>`COUNT(*)`,
          successful: sql<number>`SUM(CASE WHEN ${webhookEvent.processed} = 1 THEN 1 ELSE 0 END)`,
          failed: sql<number>`SUM(CASE WHEN ${webhookEvent.error_message} IS NOT NULL THEN 1 ELSE 0 END)`,
          last_event: sql<string>`MAX(${webhookEvent.created_at})`
        })
        .from(webhookEvent)
        .get();

      return {
        totalEvents: stats?.total || 0,
        processedCount: stats?.successful || 0,
        failedCount: stats?.failed || 0,
        lastEventTime: stats?.last_event || null
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
