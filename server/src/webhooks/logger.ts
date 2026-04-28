/**
 * Webhook Event Logger
 *
 * Persists webhook events to database for monitoring and debugging.
 * Events are marked as processed (success) or failed (with error message).
 * Can be enabled/disabled via WEBHOOK_PERSIST_EVENTS env var.
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import type { AppDatabase } from '../db/types';
import { webhookEvent } from '../db/schema';
import { exec, getOne } from '../db/asyncQuery';

export interface WebhookEventLogEntry {
  payload: unknown;
  processed?: boolean;
  errorMessage?: string | null;
}

export class WebhookLogger {
  constructor(private db: AppDatabase) {}

  /**
   * Log a webhook event to database
   */
  async logEvent(entry: WebhookEventLogEntry): Promise<void> {
    try {
      const processedValue = entry.processed ? 1 : 0;
      await exec(
        this.db.insert(webhookEvent).values({
          payload: JSON.stringify(entry.payload),
          processed: processedValue,
          error_message: entry.errorMessage || null,
          created_at: new Date().toISOString()
        })
      );
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
  async markProcessed(payload: unknown): Promise<void> {
    try {
      const payloadStr = JSON.stringify(payload);
      const firstRecord = await getOne<{ id: number }>(
        this.db
          .select({ id: webhookEvent.id })
          .from(webhookEvent)
          .where(and(eq(webhookEvent.payload, payloadStr), eq(webhookEvent.processed, 0)))
          .orderBy(desc(webhookEvent.created_at))
          .limit(1)
      );

      if (firstRecord) {
        await exec(
          this.db
            .update(webhookEvent)
            .set({ processed: 1 })
            .where(eq(webhookEvent.id, firstRecord.id))
        );
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
  async markFailed(payload: unknown, errorMessage: string): Promise<void> {
    try {
      const payloadStr = JSON.stringify(payload);
      const firstRecord = await getOne<{ id: number }>(
        this.db
          .select({ id: webhookEvent.id })
          .from(webhookEvent)
          .where(and(eq(webhookEvent.payload, payloadStr), eq(webhookEvent.processed, 0)))
          .orderBy(desc(webhookEvent.created_at))
          .limit(1)
      );

      if (firstRecord) {
        await exec(
          this.db
            .update(webhookEvent)
            .set({ error_message: errorMessage })
            .where(eq(webhookEvent.id, firstRecord.id))
        );
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
  async getStatus(): Promise<{
    totalEvents: number;
    processedCount: number;
    failedCount: number;
    lastEventTime: string | null;
    }> {
    try {
      const firstStats = await getOne<{
        total: number;
        successful: number;
        failed: number;
        last_event: string | Date | null;
      }>(
        this.db
          .select({
            total: sql<number>`COUNT(*)`,
            successful: sql<number>`SUM(CASE WHEN ${webhookEvent.processed} = 1 THEN 1 ELSE 0 END)`,
            failed: sql<number>`SUM(CASE WHEN ${webhookEvent.error_message} IS NOT NULL THEN 1 ELSE 0 END)`,
            last_event: sql<string | Date>`MAX(${webhookEvent.created_at})`
          })
          .from(webhookEvent)
      );

      return {
        totalEvents: firstStats?.total || 0,
        processedCount: firstStats?.successful || 0,
        failedCount: firstStats?.failed || 0,
        lastEventTime:
          firstStats?.last_event instanceof Date
            ? firstStats.last_event.toISOString()
            : firstStats?.last_event || null
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
