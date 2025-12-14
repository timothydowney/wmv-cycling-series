/**
 * Webhook Renewal Service
 * 
 * Manages automatic renewal of webhook subscriptions.
 * Strava subscriptions expire after 24 hours and must be renewed to keep working.
 * 
 * This service runs a background scheduler that checks every 6 hours if the
 * subscription needs renewal (older than 22 hours) and renews if needed.
 */

import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { WebhookSubscriptionService } from './WebhookSubscriptionService';

export class WebhookRenewalService {
  private subscriptionService: WebhookSubscriptionService;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly RENEWAL_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

  constructor(db: BetterSQLite3Database) {
    this.subscriptionService = new WebhookSubscriptionService(db);
  }

  /**
   * Start the background renewal scheduler
   * Checks every 6 hours if subscription needs renewal
   */
  start(): void {
    if (this.intervalId) {
      console.log('[WebhookRenewalService] ⚠️  Scheduler already running');
      return;
    }

    console.log('[WebhookRenewalService] Starting renewal scheduler (every 6 hours)');

    // Run immediately on start to check current status
    this.checkAndRenewIfNeeded();

    // Then schedule periodic checks
    this.intervalId = setInterval(
      () => this.checkAndRenewIfNeeded(),
      this.RENEWAL_CHECK_INTERVAL_MS
    );

    // Don't block process exit on this interval
    if (this.intervalId.unref) {
      this.intervalId.unref();
    }
  }

  /**
   * Stop the background renewal scheduler
   */
  stop(): void {
    if (!this.intervalId) {
      console.log('[WebhookRenewalService] Scheduler not running');
      return;
    }

    console.log('[WebhookRenewalService] Stopping renewal scheduler');
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  /**
   * Check if subscription needs renewal and renew if needed
   */
  private async checkAndRenewIfNeeded(): Promise<void> {
    try {
      const needsRenewal = this.subscriptionService.needsRenewal();

      if (!needsRenewal) {
        const status = this.subscriptionService.getStatus();
        if (status.last_refreshed_at) {
          const ageHours = (Date.now() - new Date(status.last_refreshed_at).getTime()) / (1000 * 60 * 60);
          console.log(`[WebhookRenewalService] Subscription is ${ageHours.toFixed(1)} hours old, no renewal needed`);
        } else {
          console.log('[WebhookRenewalService] No active subscription');
        }
        return;
      }

      console.log('[WebhookRenewalService] ✓ Subscription needs renewal, renewing now...');
      await this.subscriptionService.renew();
      console.log('[WebhookRenewalService] ✓ Subscription renewed successfully');
    } catch (error) {
      console.error('[WebhookRenewalService] ✗ Renewal failed:', error instanceof Error ? error.message : String(error));
      // Don't throw - we want the scheduler to keep running even if one renewal fails
    }
  }

  /**
   * Get the subscription service (for direct access if needed)
   */
  getSubscriptionService(): WebhookSubscriptionService {
    return this.subscriptionService;
  }
}
