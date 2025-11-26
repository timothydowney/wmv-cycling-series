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
import { getStravaConfig, getWebhookConfig } from '../config';

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

/**
 * Helper to build Strava API credentials form
 */
function buildStravaFormData(clientId: string, clientSecret: string, ...pairs: [string, string][]): URLSearchParams {
  const form = new URLSearchParams();
  form.append('client_id', clientId);
  form.append('client_secret', clientSecret);
  
  for (const [key, value] of pairs) {
    form.append(key, value);
  }
  
  return form;
}

/**
 * Helper to update subscription in database
 * 
 * ALWAYS uses id = 1 to enforce "only one subscription per app" constraint
 * Stores both the full payload (for reference) and the subscription_id (for direct access)
 */
function updateSubscriptionInDb(
  db: Database.Database,
  payload: StravaSubscriptionPayload,
  stravaSubscriptionId: number
): void {
  const payloadJson = JSON.stringify(payload);
  console.log('[WebhookSubscriptionService] updateSubscriptionInDb - Updating subscription:', {
    subscription_id: stravaSubscriptionId,
    payload_size_bytes: payloadJson.length,
    payload_keys: Object.keys(payload),
    created_at: payload.created_at,
    updated_at: payload.updated_at,
    callback_url: payload.callback_url
  });
  
  const result = db.prepare(`
    UPDATE webhook_subscription
    SET subscription_payload = ?,
        subscription_id = ?,
        last_refreshed_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(payloadJson, stravaSubscriptionId);
  
  console.log('[WebhookSubscriptionService] updateSubscriptionInDb - Database operation complete:', {
    changes: (result as any).changes
  });
}

/**
 * Helper to insert subscription into database
 * 
 * ALWAYS uses id = 1 to enforce "only one subscription per app" constraint
 * Uses INSERT OR REPLACE to handle the case where a row already exists
 * Stores both the full payload (for reference) and the subscription_id (for direct access)
 */
function insertSubscriptionInDb(
  db: Database.Database,
  payload: StravaSubscriptionPayload,
  verifyToken: string,
  stravaSubscriptionId: number
): void {
  const payloadJson = JSON.stringify(payload);
  console.log('[WebhookSubscriptionService] insertSubscriptionInDb - Storing subscription:', {
    subscription_id: stravaSubscriptionId,
    payload_size_bytes: payloadJson.length,
    payload_keys: Object.keys(payload),
    created_at: payload.created_at,
    updated_at: payload.updated_at,
    callback_url: payload.callback_url
  });
  
  const result = db.prepare(`
    INSERT INTO webhook_subscription (id, verify_token, subscription_payload, subscription_id, last_refreshed_at)
    VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      verify_token = excluded.verify_token,
      subscription_payload = excluded.subscription_payload,
      subscription_id = excluded.subscription_id,
      last_refreshed_at = CURRENT_TIMESTAMP
  `).run(verifyToken, payloadJson, stravaSubscriptionId);
  
  console.log('[WebhookSubscriptionService] insertSubscriptionInDb - Database operation complete:', {
    changes: (result as any).changes,
    lastInsertRowid: (result as any).lastInsertRowid
  });
}

/**
 * Helper to delete subscription row from database
 * 
 * ALWAYS deletes id = 1 (the only subscription)
 */
function deleteSubscriptionFromDb(db: Database.Database): void {
  const result = db.prepare('DELETE FROM webhook_subscription WHERE id = 1').run();
  console.log('[WebhookSubscriptionService] Database delete result:', { 
    changes: (result as any).changes 
  });
}

export class WebhookSubscriptionService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Fetch existing subscription from Strava API
   * 
   * Per Strava docs (View a Subscription):
   * GET https://www.strava.com/api/v3/push_subscriptions?client_id=X&client_secret=Y
   * Returns: [{ "id": N, "created_at": "...", "updated_at": "...", "callback_url": "...", "application_id": N }]
   * Or: [] if no subscription exists
   */
  private async fetchExistingFromStrava(): Promise<StravaSubscriptionPayload | null> {
    const { clientId, clientSecret, apiBase } = getStravaConfig();
    const url = new URL(`${apiBase}/api/v3/push_subscriptions`);
    url.searchParams.append('client_id', clientId);
    url.searchParams.append('client_secret', clientSecret);

    console.log('[WebhookSubscriptionService] fetchExistingFromStrava - Querying Strava for existing subscription:', {
      url: url.toString().replace(clientSecret, '***')
    });

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        console.warn(`[WebhookSubscriptionService] fetchExistingFromStrava - Strava API error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      console.log('[WebhookSubscriptionService] fetchExistingFromStrava - Raw Strava API response:', data);

      // Strava returns an array of subscriptions (typically 0 or 1)
      let subscription: StravaSubscriptionPayload | null = null;
      
      // Handle array response (the standard format)
      if (Array.isArray(data)) {
        subscription = data[0] ?? null;
      } 
      // Handle direct object format (fallback, if Strava ever changes format)
      else if ((data as any).id) {
        subscription = data as StravaSubscriptionPayload;
      }

      console.log('[WebhookSubscriptionService] fetchExistingFromStrava - Parsed subscription:', {
        exists: !!subscription,
        subscription_id: (subscription as any)?.id,
        created_at: (subscription as any)?.created_at,
        callback_url: (subscription as any)?.callback_url
      });

      return subscription;
    } catch (error) {
      console.error('[WebhookSubscriptionService] fetchExistingFromStrava - Error:', error);
      return null;
    }
  }

  /**
   * Create a new subscription with Strava API
   */
  private async createSubscriptionWithStrava(): Promise<StravaSubscriptionPayload> {
    const { clientId, clientSecret, apiBase } = getStravaConfig();
    const { callbackUrl, verifyToken } = getWebhookConfig();

    if (!callbackUrl || !verifyToken) {
      throw new Error('Missing WEBHOOK_CALLBACK_URL or WEBHOOK_VERIFY_TOKEN environment variables');
    }

    console.log('[WebhookSubscriptionService] createSubscriptionWithStrava - Requesting subscription from Strava API:', {
      callback_url: callbackUrl,
      verify_token: verifyToken ? `[${verifyToken.length} chars]` : 'NOT SET'
    });

    const url = `${apiBase}/api/v3/push_subscriptions`;
    const form = buildStravaFormData(clientId, clientSecret, ['callback_url', callbackUrl], ['verify_token', verifyToken]);

    const response = await fetch(url, {
      method: 'POST',
      body: form,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[WebhookSubscriptionService] createSubscriptionWithStrava - Strava API error:', {
        status: response.status,
        error: errorText
      });

      // Special handling: If Strava says subscription already exists, fetch and return it
      // This can happen if a previous subscription is still active on Strava but missing from our DB
      if (response.status === 400 && errorText.includes('already exists')) {
        console.log('[WebhookSubscriptionService] createSubscriptionWithStrava - Strava says "already exists", attempting to recover existing subscription...');
        const existingSubscription = await this.fetchExistingFromStrava();
        if (existingSubscription) {
          console.log('[WebhookSubscriptionService] createSubscriptionWithStrava - ✓ Successfully recovered existing subscription:', {
            subscription_id: existingSubscription.id
          });
          return existingSubscription;
        }
        console.error('[WebhookSubscriptionService] createSubscriptionWithStrava - Strava said "already exists" but we cannot fetch it - this is likely an orphaned subscription');
      }

      throw new Error(`Strava API error creating subscription: ${response.status} ${errorText}`);
    }

    const subscription = (await response.json()) as StravaSubscriptionPayload;
    console.log('[WebhookSubscriptionService] createSubscriptionWithStrava - ✓ Raw Strava API response received:', {
      subscription_id: subscription.id,
      created_at: subscription.created_at,
      updated_at: subscription.updated_at,
      callback_url: subscription.callback_url,
      application_id: subscription.application_id,
      full_response: subscription
    });
    return subscription;
  }

  /**
   * Delete a subscription from Strava API
   */
  private async deleteSubscriptionWithStrava(subscriptionId: number): Promise<void> {
    const { clientId, clientSecret, apiBase } = getStravaConfig();
    const url = `${apiBase}/api/v3/push_subscriptions/${subscriptionId}`;
    const form = buildStravaFormData(clientId, clientSecret);

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        body: form,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[WebhookSubscriptionService] Failed to delete subscription ${subscriptionId} on Strava: ${response.status} ${errorText}`);
        // Don't throw - we still want to clean up locally
      } else {
        console.log('[WebhookSubscriptionService] ✓ Subscription deleted on Strava');
      }
    } catch (error) {
      console.warn('[WebhookSubscriptionService] Error deleting subscription on Strava:', error);
    }
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
        SELECT id, verify_token, subscription_payload, subscription_id, last_refreshed_at
        FROM webhook_subscription
        LIMIT 1
      `).get() as { id: number; verify_token: string; subscription_payload: string | null; subscription_id: number | null; last_refreshed_at: string | null } | undefined;

      console.log('[WebhookSubscriptionService] getStatus - Database query result:', {
        row_exists: !!row,
        subscription_id: row?.subscription_id,
        payload_exists: !!row?.subscription_payload,
        payload_size_bytes: row?.subscription_payload?.length || 0,
        last_refreshed_at: row?.last_refreshed_at
      });

      if (!row) {
        // No subscription exists = disabled state
        console.log('[WebhookSubscriptionService] getStatus - No subscription found, returning disabled state');
        return {
          id: null,
          subscription_id: null,
          created_at: null,
          expires_at: null,
          last_refreshed_at: null,
          callback_url: null
        };
      }

      // Parse subscription payload if it exists (for callback_url and created_at)
      let payload: StravaSubscriptionPayload | null = null;
      if (row.subscription_payload) {
        try {
          payload = JSON.parse(row.subscription_payload);
          console.log('[WebhookSubscriptionService] getStatus - Parsed subscription_payload:', {
            parsed_keys: Object.keys(payload || {}),
            created_at: payload?.created_at,
            updated_at: payload?.updated_at,
            callback_url: payload?.callback_url,
            id: payload?.id
          });
        } catch (e) {
          console.warn('[WebhookSubscriptionService] getStatus - Failed to parse subscription_payload', {
            error: e instanceof Error ? e.message : String(e),
            payload_first_100_chars: row.subscription_payload.substring(0, 100)
          });
        }
      } else {
        console.warn('[WebhookSubscriptionService] getStatus - subscription_payload is NULL in database despite row existing');
      }

      // Calculate expires_at (24 hours from created_at)
      let expires_at: string | null = null;
      if (payload?.created_at) {
        const created = new Date(payload.created_at);
        const expires = new Date(created.getTime() + 24 * 60 * 60 * 1000);
        expires_at = expires.toISOString();
      }

      // Use subscription_id from column (clean, reliable source)
      const subscription_id = row.subscription_id;

      const status = {
        id: row.id,
        subscription_id: subscription_id,
        created_at: payload?.created_at ?? null,
        expires_at,
        last_refreshed_at: row.last_refreshed_at,
        callback_url: payload?.callback_url ?? null
      };

      console.log('[WebhookSubscriptionService] getStatus - Returning status:', status);
      return status;
    } catch (error) {
      console.error('[WebhookSubscriptionService] getStatus - Failed to get status', error);
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
   * 1. Check if subscription already exists in database
   * 2. If not, check if one exists on Strava (recovery scenario)
   * 3. If not on Strava either, create a new one
   * 4. Return updated status
   */
  async enable(): Promise<SubscriptionStatus> {
    try {
      // Always re-fetch current status from database (don't rely on cached/stale in-memory status)
      const current = this.getStatus();
      console.log('[WebhookSubscriptionService] Enabling subscription', { has_db_record: !!current.id, has_strava_id: !!current.subscription_id });

      // If we have a database record with Strava subscription, we're already enabled
      // CRITICAL: Re-verify this by checking the database directly in case status is stale
      // (e.g., after a disable() call followed by enable() in the same renew() sequence)
      if (current.id && current.subscription_id) {
        // Double-check the DB actually has this record (not a stale in-memory state)
        const dbRecord = this.db.prepare('SELECT id FROM webhook_subscription WHERE id = 1').get();
        if (dbRecord) {
          console.log('[WebhookSubscriptionService] ✓ Already enabled');
          return current;
        }
        // If DB check fails, fall through to create new one (DB was cleared)
      }

      // Try to recover from Strava if DB is missing subscription (DB loss scenario)
      console.log('[WebhookSubscriptionService] enable() - trying fetchExistingFromStrava...');
      const existingOnStrava = await this.fetchExistingFromStrava();
      console.log('[WebhookSubscriptionService] enable() - fetchExistingFromStrava returned:', {
        found: !!existingOnStrava,
        id: existingOnStrava?.id
      });
      
      if (existingOnStrava) {
        console.log('[WebhookSubscriptionService] ✓ Found existing subscription on Strava, recovering...');
        
        if (current.id) {
          // Update existing DB record (always id = 1)
          console.log('[WebhookSubscriptionService] enable() - calling updateSubscriptionInDb with existing record');
          updateSubscriptionInDb(this.db, existingOnStrava, existingOnStrava.id);
        } else {
          // Create new DB record (always id = 1)
          console.log('[WebhookSubscriptionService] enable() - calling insertSubscriptionInDb with existing from Strava');
          const { verifyToken } = getWebhookConfig();
          insertSubscriptionInDb(this.db, existingOnStrava, verifyToken || 'recovered', existingOnStrava.id);
        }
        
        return this.getStatus();
      }

      // Not on Strava, create new subscription
      console.log('[WebhookSubscriptionService] Creating new subscription with Strava...');
      const subscription = await this.createSubscriptionWithStrava();
      console.log('[WebhookSubscriptionService] enable() - createSubscriptionWithStrava returned:', {
        subscription_id: subscription.id,
        subscription_id_type: typeof subscription.id,
        full_subscription: subscription
      });
      
      if (current.id) {
        // Update existing DB record (always id = 1)
        console.log('[WebhookSubscriptionService] enable() - calling updateSubscriptionInDb with newly created');
        updateSubscriptionInDb(this.db, subscription, subscription.id);
      } else {
        // Create new DB record (always id = 1)
        console.log('[WebhookSubscriptionService] enable() - calling insertSubscriptionInDb with newly created');
        const { verifyToken } = getWebhookConfig();
        if (!verifyToken) {
          throw new Error('WEBHOOK_VERIFY_TOKEN environment variable is required');
        }
        insertSubscriptionInDb(this.db, subscription, verifyToken, subscription.id);
      }

      console.log('[WebhookSubscriptionService] ✓ Subscription enabled', { subscription_id: subscription.id });
      return this.getStatus();
    } catch (error) {
      console.error('[WebhookSubscriptionService] Failed to enable subscription', error);
      throw error;
    }
  }

  /**
   * Disable webhook subscription
   * 
   * Deletes subscription on Strava and removes row from database
   */
  async disable(): Promise<SubscriptionStatus> {
    try {
      const current = this.getStatus();

      if (!current.id) {
        console.log('[WebhookSubscriptionService] No subscription to disable');
        return current;
      }

      // Delete from Strava if subscription exists
      if (current.subscription_id) {
        console.log(`[WebhookSubscriptionService] Deleting Strava subscription ID: ${current.subscription_id}`);
        await this.deleteSubscriptionWithStrava(current.subscription_id);
      }

      // Delete from database (always id = 1)
      deleteSubscriptionFromDb(this.db);
      console.log('[WebhookSubscriptionService] ✓ Subscription disabled');
      
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
      const { verifyToken } = getWebhookConfig();
      return verifyToken || null;
    }

    // For existing subscription, retrieve from database
    const row = this.db.prepare(`
      SELECT verify_token FROM webhook_subscription WHERE id = ?
    `).get(status.id) as { verify_token: string } | undefined;

    return row?.verify_token || null;
  }
}
