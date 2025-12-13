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
  payload: any;
  processed?: boolean;
  errorMessage?: string | null;
}

export class WebhookLogger {
  private db: any;

  constructor(db: BetterSQLite3Database | any) {
    this.db = db;
  }

  /**
   * Log a webhook event to database
   */
  logEvent(entry: WebhookEventLogEntry): void {
    try {
      if (typeof this.db?.insert === 'function') {
        // Drizzle path
        this.db
          .insert(webhookEvent)
          .values({
            payload: JSON.stringify(entry.payload),
            processed: entry.processed ? 1 : 0,
            error_message: entry.errorMessage || null,
            created_at: sql`CURRENT_TIMESTAMP`
          })
          .run();
      } else if (typeof this.db?.prepare === 'function') {
        // better-sqlite3 raw SQL path (tests)
        this.db
          .prepare(
            'INSERT INTO webhook_event (payload, processed, error_message, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)'
          )
          .run(JSON.stringify(entry.payload), entry.processed ? 1 : 0, entry.errorMessage || null);
      } else {
        throw new Error('Invalid database instance provided to WebhookLogger');
      }
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
  markProcessed(payload: any): void {
    try {
      // Find the most recent unprocessed event with this payload
      // SQLite/Drizzle update with LIMIT/ORDER BY is tricky directly in ORM sometimes,
      // but Drizzle supports it if the driver does. SQLite update supports LIMIT/ORDER BY.
      // Drizzle's update builder might not expose it easily.
      // Strategy: Find ID first, then update.
      
      const payloadStr = JSON.stringify(payload);
      if (typeof this.db?.select === 'function') {
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
            .run();
        }
      } else if (typeof this.db?.prepare === 'function') {
        const record = this.db
          .prepare(
            'SELECT id FROM webhook_event WHERE payload = ? AND processed = 0 ORDER BY created_at DESC LIMIT 1'
          )
          .get(payloadStr);
        if (record?.id) {
          this.db
            .prepare('UPDATE webhook_event SET processed = 1 WHERE id = ?')
            .run(record.id);
        }
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
  markFailed(payload: any, errorMessage: string): void {
    try {
      const payloadStr = JSON.stringify(payload);
      if (typeof this.db?.select === 'function') {
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
            .run();
        }
      } else if (typeof this.db?.prepare === 'function') {
        const record = this.db
          .prepare(
            'SELECT id FROM webhook_event WHERE payload = ? AND processed = 0 ORDER BY created_at DESC LIMIT 1'
          )
          .get(payloadStr);
        if (record?.id) {
          this.db
            .prepare('UPDATE webhook_event SET error_message = ? WHERE id = ?')
            .run(errorMessage, record.id);
        }
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
      let stats: { total?: number; successful?: number; failed?: number; last_event?: string } | undefined;
      if (typeof this.db?.select === 'function') {
        stats = this.db
          .select({
            total: sql<number>`COUNT(*)`,
            successful: sql<number>`SUM(CASE WHEN ${webhookEvent.processed} = 1 THEN 1 ELSE 0 END)`,
            failed: sql<number>`SUM(CASE WHEN ${webhookEvent.error_message} IS NOT NULL THEN 1 ELSE 0 END)`,
            last_event: sql<string>`MAX(${webhookEvent.created_at})`
          })
          .from(webhookEvent)
          .get();
      } else if (typeof this.db?.prepare === 'function') {
        stats = this.db
          .prepare(
            'SELECT COUNT(*) AS total, SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END) AS successful, SUM(CASE WHEN error_message IS NOT NULL THEN 1 ELSE 0 END) AS failed, MAX(created_at) AS last_event FROM webhook_event'
          )
          .get();
      }

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
