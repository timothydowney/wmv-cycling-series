/**
 * Webhook Storage Monitoring
 *
 * Tracks disk usage for webhook event database and auto-disables webhooks
 * if storage exceeds 95% threshold to prevent Railway running out of space.
 *
 * Stores:
 * - Current disk usage as percentage
 * - Last calculated timestamp
 * - Database size in bytes
 * - Estimated weeks at current event rate
 * - Auto-disable threshold (95%)
 */

import { Database } from 'better-sqlite3';
import fs from 'fs';

export interface StorageStatus {
  database_size_bytes: number;
  database_size_mb: number;
  available_space_mb: number;
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
  private db: Database;
  private dbPath: string;
  private autoDisableThreshold = 95; // Disable webhooks at 95% full

  constructor(db: Database, dbPath: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  /**
   * Get current storage status
   */
  getStatus(): StorageStatus {
    try {
      const dbStats = fs.statSync(this.dbPath);
      const dbSizeBytes = dbStats.size;
      const dbSizeMb = dbSizeBytes / (1024 * 1024);

      // Get disk space info (simplified - in production use statfs)
      // For now, estimate based on Railway's typical volume size (5GB)
      const allocatedMb = 5120; // 5GB
      const usagePercent = (dbSizeMb / allocatedMb) * 100;
      const availableMb = allocatedMb - dbSizeMb;

      // Get event metrics
      const eventsCount = this.db
        .prepare('SELECT COUNT(*) as count FROM webhook_event')
        .get() as { count: number };

      // Events per day (last 7 days)
      const eventsLast7Days = this.db
        .prepare(
          "SELECT COUNT(*) as count FROM webhook_event WHERE created_at > datetime('now', '-7 days')"
        )
        .get() as { count: number };

      const eventsPerDay = eventsLast7Days.count > 0 ? Math.ceil(eventsLast7Days.count / 7) : 0;

      // Estimate weeks remaining at current rate
      let estimatedWeeksRemaining = 0;
      if (eventsPerDay > 0) {
        // Assume each event ~1KB on average
        const bytesPerEvent = 1000;
        const bytesAvailable = allocatedMb * 1024 * 1024 - dbSizeBytes;
        const daysRemaining = bytesAvailable / (eventsPerDay * bytesPerEvent);
        estimatedWeeksRemaining = Math.floor(daysRemaining / 7);
      }

      // Determine if should auto-disable
      const shouldAutoDisable = usagePercent >= this.autoDisableThreshold;
      let warningMessage: string | null = null;

      if (usagePercent >= 90) {
        warningMessage = `Storage usage at ${usagePercent.toFixed(1)}%. Webhooks will auto-disable at ${this.autoDisableThreshold}%.`;
      }

      return {
        database_size_bytes: dbSizeBytes,
        database_size_mb: parseFloat(dbSizeMb.toFixed(2)),
        available_space_mb: parseFloat(availableMb.toFixed(2)),
        usage_percentage: parseFloat(usagePercent.toFixed(1)),
        auto_disable_threshold: this.autoDisableThreshold,
        should_auto_disable: shouldAutoDisable,
        events_count: eventsCount.count,
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

        // Disable webhooks
        this.db.prepare(
          `UPDATE webhook_subscription 
           SET enabled = 0, 
               status = 'inactive',
               status_message = 'Auto-disabled: Storage threshold exceeded',
               updated_at = CURRENT_TIMESTAMP`
        ).run();

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
      const result = this.db
        .prepare(
          `DELETE FROM webhook_event 
           WHERE created_at < datetime('now', ? || ' days')`
        )
        .run(`-${minDaysOld}`) as { changes: number };

      console.log(
        `[StorageMonitor] Cleared ${result.changes} events older than ${minDaysOld} days`
      );
      return result.changes;
    } catch (error) {
      console.error('[StorageMonitor] Failed to clear old events:', error);
      throw error;
    }
  }

  /**
   * Get estimated storage growth rate (bytes per day)
   */
  getGrowthRate(): number {
    const lastWeekSize = this.db
      .prepare("SELECT COUNT(*) as count FROM webhook_event WHERE created_at > datetime('now', '-7 days')")
      .get() as { count: number };

    // Estimate ~1KB per event
    return (lastWeekSize.count / 7) * 1000;
  }
}
