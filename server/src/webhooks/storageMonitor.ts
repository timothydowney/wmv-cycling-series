/**
 * Webhook Storage Monitoring
 *
 * Tracks database size against a configured maximum and auto-disables webhooks
 * if storage exceeds 95% of the max threshold.
 *
 * Configuration:
 * - MAX_DATABASE_SIZE: Environment variable in MB (default: 256MB)
 * - Auto-disable threshold: 95% of max size
 *
 * Stores:
 * - Current database size in bytes/MB
 * - Percentage of max size used
 * - Database size limit (from ENV var)
 * - Estimated weeks at current event rate
 * - Auto-disable threshold (95%)
 */

import { Database } from 'better-sqlite3';
import fs from 'fs';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { gt, lt, sql } from 'drizzle-orm';
import { webhookEvent, webhookSubscription } from '../db/schema';
import { getMaxDatabaseSize } from '../config';

export interface StorageStatus {
  database_size_bytes: number;
  database_size_mb: number;
  max_size_mb: number;
  usage_percentage: number;
  auto_disable_threshold: number;
  should_auto_disable: boolean;
  events_count: number;
  events_per_day: number;
  estimated_weeks_remaining: number;
  last_calculated_at: string;
  warning_message: string | null;
}

export class StorageMonitor {
  private db: BetterSQLite3Database | Database;
  private dbPath: string;
  private maxSizeMb: number;
  private autoDisableThreshold = 95; // Disable webhooks at 95% of max

  constructor(db: BetterSQLite3Database | Database, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
    // Read MAX_DATABASE_SIZE from env, default to 256MB
    this.maxSizeMb = this.parseMaxSize();
  }

  /**
   * Parse MAX_DATABASE_SIZE from config
   * Format: number (MB), e.g., "256" for 256MB
   * Default: 256MB if not set or invalid
   */
  private parseMaxSize(): number {
    const maxSize = getMaxDatabaseSize();
    return maxSize;
  }

  private getDrizzle(): BetterSQLite3Database | null {
    return typeof (this.db as any)?.select === 'function' ? (this.db as BetterSQLite3Database) : null;
  }

  /**
   * Get current storage status against configured MAX_DATABASE_SIZE
   */
  getStatus(): StorageStatus {
    try {
      const dbStats = fs.statSync(this.dbPath);
      const dbSizeBytes = dbStats.size;
      const dbSizeMb = dbSizeBytes / (1024 * 1024);

      // Calculate usage percentage against configured max size
      const usagePercent = (dbSizeMb / this.maxSizeMb) * 100;

      // Get event metrics
      const drizzle = this.getDrizzle();
      let eventsCount: { count: number } | undefined;
      if (drizzle) {
        eventsCount = drizzle
          .select({ count: sql<number>`count(*)` })
          .from(webhookEvent)
          .get() as { count: number } | undefined;
      } else {
        eventsCount = (this.db as Database)
          .prepare('SELECT COUNT(*) as count FROM webhook_event')
          .get() as { count: number } | undefined;
      }

      // Events per day (last 7 days)
      let eventsLast7Days: { count: number } | undefined;
      if (drizzle) {
        eventsLast7Days = drizzle
          .select({ count: sql<number>`count(*)` })
          .from(webhookEvent)
          .where(gt(webhookEvent.created_at, sql`datetime('now', '-7 days')`))
          .get() as { count: number } | undefined;
      } else {
        eventsLast7Days = (this.db as Database)
          .prepare("SELECT COUNT(*) as count FROM webhook_event WHERE created_at > datetime('now', '-7 days')")
          .get() as { count: number } | undefined;
      }

      const eventsLast7DaysCount = eventsLast7Days?.count ?? 0;
      const eventsPerDay = eventsLast7DaysCount > 0 ? Math.ceil(eventsLast7DaysCount / 7) : 0;

      // Estimate weeks remaining at current rate
      let estimatedWeeksRemaining = 0;
      if (eventsPerDay > 0) {
        // Assume each event ~1KB on average
        const bytesPerEvent = 1000;
        const bytesAvailable = this.maxSizeMb * 1024 * 1024 - dbSizeBytes;
        const daysRemaining = bytesAvailable / (eventsPerDay * bytesPerEvent);
        estimatedWeeksRemaining = Math.floor(daysRemaining / 7);
      }

      // Determine if should auto-disable
      const shouldAutoDisable = usagePercent >= this.autoDisableThreshold;
      let warningMessage: string | null = null;

      if (usagePercent >= 90) {
        warningMessage = `Database usage at ${usagePercent.toFixed(1)}% of ${this.maxSizeMb}MB limit. Webhooks will auto-disable at ${this.autoDisableThreshold}%.`;
      }

      return {
        database_size_bytes: dbSizeBytes,
        database_size_mb: parseFloat(dbSizeMb.toFixed(2)),
        max_size_mb: this.maxSizeMb,
        usage_percentage: parseFloat(usagePercent.toFixed(1)),
        auto_disable_threshold: this.autoDisableThreshold,
        should_auto_disable: shouldAutoDisable,
        events_count: eventsCount?.count ?? 0,
        events_per_day: eventsPerDay,
        estimated_weeks_remaining: estimatedWeeksRemaining,
        last_calculated_at: new Date().toISOString(),
        warning_message: warningMessage
      };
    } catch (error) {
      console.error('[StorageMonitor] Failed to get status:', error);
      throw error;
    }
  }

  /**
   * Check storage and auto-disable webhooks if threshold exceeded
   * Should be called periodically (e.g., on startup and every 12 hours)
   */
  async checkAndAutoDisable(): Promise<boolean> {
    try {
      const status = this.getStatus();

      if (status.should_auto_disable) {
        console.warn(
          `[StorageMonitor] Storage at ${status.usage_percentage}% - AUTO-DISABLING WEBHOOKS`
        );

        const drizzle = this.getDrizzle();

        if (drizzle) {
          // Presence of a row == enabled; deleting disables
          drizzle.delete(webhookSubscription).run();
        } else {
          // Legacy raw path (tests)
          (this.db as Database)
            .prepare('DELETE FROM webhook_subscription')
            .run();
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error('[StorageMonitor] Auto-disable check failed:', error);
      throw error;
    }
  }

  /**
   * Clear old events to free up space
   * Keeps events younger than minDaysOld
   */
  clearOldEvents(minDaysOld: number = 30): number {
    try {
      const drizzle = this.getDrizzle();
      let changes = 0;

      if (drizzle) {
        const result = drizzle
          .delete(webhookEvent)
          .where(lt(webhookEvent.created_at, sql`datetime('now', ${`-${minDaysOld} days`})`))
          .run();
        changes = (result as any).changes ?? 0;
      } else {
        const result = (this.db as Database)
          .prepare(
            `DELETE FROM webhook_event 
             WHERE created_at < datetime('now', ? || ' days')`
          )
          .run(`-${minDaysOld}`) as { changes: number };
        changes = result.changes;
      }

      console.log(
        `[StorageMonitor] Cleared ${changes} events older than ${minDaysOld} days`
      );
      return changes;
    } catch (error) {
      console.error('[StorageMonitor] Failed to clear old events:', error);
      throw error;
    }
  }

  /**
   * Get estimated storage growth rate (bytes per day)
   */
  getGrowthRate(): number {
    const drizzle = this.getDrizzle();
    const lastWeekSize = drizzle
      ? (drizzle
        .select({ count: sql<number>`count(*)` })
        .from(webhookEvent)
        .where(gt(webhookEvent.created_at, sql`datetime('now', '-7 days')`))
        .get() as { count: number } | undefined)
      : ((this.db as Database)
        .prepare("SELECT COUNT(*) as count FROM webhook_event WHERE created_at > datetime('now', '-7 days')")
        .get() as { count: number });

    // Estimate ~1KB per event
    return ((lastWeekSize?.count ?? 0) / 7) * 1000;
  }
}
