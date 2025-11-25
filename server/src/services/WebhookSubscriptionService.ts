/**
 * Webhook Subscription Service
 *
 * Manages webhook subscriptions with Strava and tracks subscription state in database.
 * 
 * Schema (simple, lean):
 * - id: Primary key
 * - verify_token: Token used by Strava to verify webhook endpoint
 * - subscription_payload: Full JSON response from Strava (contains id, created_at, updated_at, callback_url, application_id)
 * - last_refreshed_at: When we last verified the subscription with Strava
 *
 * Design:
 * - Row presence = enabled. No row = disabled.
 * - Subscription data is the raw Strava API response (avoids field duplication)
 * - Subscriptions expire after 24 hours, need renewal
 */

import Database from 'better-sqlite3';

interface StravaSubscriptionPayload {
  id: number;
  created_at: string;
  updated_at: string;
  callback_url: string;
  application_id: number;
}

export interface SubscriptionStatus {
  id: number | null;
  subscription_id: number | null;
  created_at: string | null;
  expires_at: string | null; // Calculated as created_at + 24 hours
  last_refreshed_at: string | null;
  callback_url: string | null;
}

export class WebhookSubscriptionService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Get current subscription status from database
   * 
   * Returns null if no subscription (disabled state)
   * Returns parsed subscription data if exists (enabled state)
   */
  getStatus(): SubscriptionStatus {
    try {
      const row = this.db.prepare(`
        SELECT 
          id, verify_token, subscription_payload, last_refreshed_at
        FROM webhook_subscription
        LIMIT 1
      `).get() as { id: number; verify_token: string; subscription_payload: string | null; last_refreshed_at: string | null } | undefined;

      if (!row) {
        // No subscription exists = disabled state
        return {
          id: null,
          subscription_id: null,
          created_at: null,
          expires_at: null,
          last_refreshed_at: null,
          callback_url: null
        };
      }

      // Parse subscription payload if it exists
      let payload: StravaSubscriptionPayload | null = null;
      if (row.subscription_payload) {
        try {
          payload = JSON.parse(row.subscription_payload);
        } catch (e) {
          console.warn('[WebhookSubscriptionService] Failed to parse subscription_payload', e);
        }
      }

      // Calculate expires_at (24 hours from created_at)
      let expires_at: string | null = null;
      if (payload?.created_at) {
        const created = new Date(payload.created_at);
        const expires = new Date(created.getTime() + 24 * 60 * 60 * 1000);
        expires_at = expires.toISOString();
      }

      return {
        id: row.id,
        subscription_id: payload?.id ?? null,
        created_at: payload?.created_at ?? null,
        expires_at,
        last_refreshed_at: row.last_refreshed_at,
        callback_url: payload?.callback_url ?? null
      };
    } catch (error) {
      console.error('[WebhookSubscriptionService] Failed to get status', error);
      throw error;
    }
  }

  /**
   * Renew the webhook subscription with Strava
   * Deletes old subscription and creates a new one
   */
  async renew(): Promise<SubscriptionStatus> {
    try {
      const current = this.getStatus();

      console.log('[WebhookSubscriptionService] Renewing subscription');

      // First disable the old one
      if (current.id) {
        await this.disable();
      }

      // Then enable a new one
      return await this.enable();
    } catch (error) {
      console.error('[WebhookSubscriptionService] Renewal failed', error);
      throw error;
    }
  }

  /**
   * Enable webhook subscription
   * 
   * Creates or updates subscription with Strava API and stores the response JSON
   * Row presence in database = subscription is enabled
   */
  async enable(): Promise<SubscriptionStatus> {
    try {
      const current = this.getStatus();
      console.log('[WebhookSubscriptionService] enable() called, current status:', {
        id: current.id,
        subscription_id: current.subscription_id
      });

      // If no subscription record exists, create one with Strava
      if (!current.id) {
        console.log('[WebhookSubscriptionService] No subscription record exists, creating new one with Strava');
        
        // Get required environment variables
        const callbackUrl = process.env.WEBHOOK_CALLBACK_URL;
        const clientId = process.env.STRAVA_CLIENT_ID;
        const clientSecret = process.env.STRAVA_CLIENT_SECRET;
        const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;
        const apiBase = process.env.STRAVA_API_BASE_URL || 'https://www.strava.com';
        
        console.log('[WebhookSubscriptionService] Config:', {
          callbackUrl,
          clientId,
          clientSecret: clientSecret ? '***' : 'missing',
          apiBase
        });
        
        if (!callbackUrl || !clientId || !clientSecret || !verifyToken) {
          throw new Error('Missing required environment variables: WEBHOOK_CALLBACK_URL, STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, WEBHOOK_VERIFY_TOKEN');
        }
        
        // Call Strava API to create subscription
        console.log('[WebhookSubscriptionService] Calling Strava API to create subscription...');
        const subscriptionUrl = `${apiBase}/api/v3/push_subscriptions`;
        console.log('[WebhookSubscriptionService] POST to:', subscriptionUrl);
        
        const formData = new URLSearchParams();
        formData.append('client_id', clientId);
        formData.append('client_secret', clientSecret);
        formData.append('callback_url', callbackUrl);
        formData.append('verify_token', verifyToken);
        
        const response = await fetch(subscriptionUrl, {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        console.log('[WebhookSubscriptionService] Strava API response:', {
          status: response.status,
          statusText: response.statusText
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Strava API error: ${response.status} ${errorText}`);
        }
        
        const stravaSubscription = (await response.json()) as StravaSubscriptionPayload;
        
        console.log('[WebhookSubscriptionService] ✓ Strava subscription created', {
          subscription_id: stravaSubscription.id,
          callback_url: stravaSubscription.callback_url
        });
        
        // Store in database (row presence = enabled)
        const result = this.db.prepare(`
          INSERT INTO webhook_subscription (
            verify_token, subscription_payload, last_refreshed_at
          )
          VALUES (?, ?, CURRENT_TIMESTAMP)
          RETURNING id, verify_token, subscription_payload, last_refreshed_at
        `).get(verifyToken, JSON.stringify(stravaSubscription)) as { id: number; verify_token: string; subscription_payload: string; last_refreshed_at: string };

        console.log('[WebhookSubscriptionService] ✓ Subscription record created', {
          id: result.id,
          subscription_id: stravaSubscription.id
        });

        return this.getStatus();
      }

      // If subscription record exists but no payload, create with Strava
      if (!current.subscription_id) {
        console.log('[WebhookSubscriptionService] Subscription record exists but no Strava subscription yet - creating with Strava');
        
        const callbackUrl = process.env.WEBHOOK_CALLBACK_URL;
        const clientId = process.env.STRAVA_CLIENT_ID;
        const clientSecret = process.env.STRAVA_CLIENT_SECRET;
        const apiBase = process.env.STRAVA_API_BASE_URL || 'https://www.strava.com';
        
        if (!callbackUrl || !clientId || !clientSecret) {
          throw new Error('Missing required environment variables: WEBHOOK_CALLBACK_URL, STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET');
        }
        
        // Call Strava API to create subscription
        console.log('[WebhookSubscriptionService] Calling Strava API to create subscription...');
        const subscriptionUrl = `${apiBase}/api/v3/push_subscriptions`;
        console.log('[WebhookSubscriptionService] POST to:', subscriptionUrl);
        
        const formData = new URLSearchParams();
        formData.append('client_id', clientId);
        formData.append('client_secret', clientSecret);
        formData.append('callback_url', callbackUrl);
        formData.append('verify_token', process.env.WEBHOOK_VERIFY_TOKEN || '');
        
        const response = await fetch(subscriptionUrl, {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        console.log('[WebhookSubscriptionService] Strava API response:', {
          status: response.status,
          statusText: response.statusText
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Strava API error: ${response.status} ${errorText}`);
        }
        
        const stravaSubscription = (await response.json()) as StravaSubscriptionPayload;
        
        console.log('[WebhookSubscriptionService] ✓ Strava subscription created', {
          subscription_id: stravaSubscription.id,
          callback_url: stravaSubscription.callback_url
        });
        
        // Update database with subscription payload
        this.db.prepare(`
          UPDATE webhook_subscription
          SET 
            subscription_payload = ?,
            last_refreshed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(JSON.stringify(stravaSubscription), current.id);

        console.log('[WebhookSubscriptionService] ✓ Subscription updated with Strava payload');
        return this.getStatus();
      }

      // Already enabled
      console.log('[WebhookSubscriptionService] Subscription already enabled');
      return current;
    } catch (error) {
      console.error('[WebhookSubscriptionService] Failed to enable subscription', error);
      throw error;
    }
  }

  /**
   * Disable webhook subscription
   * 
   * Simply deletes the row from database (row absence = disabled state)
   */
  async disable(): Promise<SubscriptionStatus> {
    try {
      const current = this.getStatus();

      if (!current.id) {
        console.log('[WebhookSubscriptionService] No subscription to disable');
        return current;
      }

      // Call Strava API to delete the subscription
      if (current.subscription_id) {
        const clientId = process.env.STRAVA_CLIENT_ID;
        const clientSecret = process.env.STRAVA_CLIENT_SECRET;
        const apiBase = process.env.STRAVA_API_BASE_URL || 'https://www.strava.com';

        if (!clientId || !clientSecret) {
          throw new Error('Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET');
        }

        const deleteUrl = `${apiBase}/api/v3/push_subscriptions/${current.subscription_id}`;
        console.log('[WebhookSubscriptionService] Deleting subscription on Strava:', deleteUrl);

        const formData = new URLSearchParams();
        formData.append('client_id', clientId);
        formData.append('client_secret', clientSecret);

        const response = await fetch(deleteUrl, {
          method: 'DELETE',
          body: formData,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn('[WebhookSubscriptionService] Strava delete failed (continuing anyway):', response.status, errorText);
          // Continue anyway - we still want to delete from our DB
        } else {
          console.log('[WebhookSubscriptionService] ✓ Subscription deleted on Strava');
        }
      }

      // Delete from database
      this.db.prepare(`
        DELETE FROM webhook_subscription WHERE id = ?
      `).run(current.id);

      console.log('[WebhookSubscriptionService] ✓ Subscription disabled (row deleted)');
      
      // Return empty status (no subscription)
      return {
        id: null,
        subscription_id: null,
        created_at: null,
        expires_at: null,
        last_refreshed_at: null,
        callback_url: null
      };
    } catch (error) {
      console.error('[WebhookSubscriptionService] Failed to disable subscription', error);
      throw error;
    }
  }

  /**
   * Check if subscription is expired and needs renewal
   * Strava subscriptions are valid for 24 hours
   */
  needsRenewal(): boolean {
    const status = this.getStatus();

    if (!status.id || !status.last_refreshed_at) {
      return false;
    }

    // Convert last_refreshed_at to timestamp and check if > 22 hours old
    const lastRefreshed = new Date(status.last_refreshed_at).getTime();
    const now = Date.now();
    const ageHours = (now - lastRefreshed) / (1000 * 60 * 60);

    return ageHours > 22; // Renew if older than 22 hours
  }



  /**
   * Get verify token for API setup
   */
  getVerifyToken(): string | null {
    const status = this.getStatus();
    if (!status.id) {
      return process.env.WEBHOOK_VERIFY_TOKEN || null;
    }

    // For existing subscription, retrieve from database
    const row = this.db.prepare(`
      SELECT verify_token FROM webhook_subscription WHERE id = ?
    `).get(status.id) as { verify_token: string } | undefined;

    return row?.verify_token || null;
  }
}
