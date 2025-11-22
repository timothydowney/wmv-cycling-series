/**
 * Webhook Subscription Manager
 *
 * Manages the lifecycle of Strava webhook subscriptions:
 * - Create subscription with Strava API
 * - Check if subscription already exists
 * - Delete subscription
 * - Auto-setup on app startup (if enabled and configured)
 *
 * Strava subscriptions expire after 24 hours if not renewed,
 * but our setup checks before subscribing and logs the subscription ID.
 * In production, you can manually manage subscription through Strava dashboard.
 *
 * Written using service layer pattern for testability:
 * - SubscriptionService interface abstracts HTTP calls to Strava API
 * - createDefaultService() provides production implementation
 * - setupWebhookSubscription() factory accepts optional service for testing
 */

const STRAVA_SUBSCRIPTION_URL = 'https://www.strava.com/api/v3/push_subscriptions';

/**
 * Response from Strava when querying/creating subscription
 */
interface SubscriptionResponse {
  id: number;
  created_at: string;
  updated_at: string;
  callback_url: string;
  resource_state: number;
}

/**
 * Service layer interface for Strava subscription operations
 * Abstracts HTTP communication to Strava API for testability
 */
export interface SubscriptionService {
  /**
   * Create a new webhook subscription with Strava
   * @throws Error if subscription creation fails
   */
  createSubscription(
    callbackUrl: string,
    verifyToken: string,
    clientId: string,
    clientSecret: string
  ): Promise<SubscriptionResponse>;

  /**
   * Get existing subscription from Strava
   * @returns Subscription if exists, null if doesn't exist or error
   */
  getExistingSubscription(clientId: string, clientSecret: string): Promise<SubscriptionResponse | null>;

  /**
   * Delete a webhook subscription with Strava
   * @throws Error if deletion fails
   */
  deleteSubscription(
    subscriptionId: number,
    clientId: string,
    clientSecret: string
  ): Promise<void>;
}

/**
 * Create default service implementation that calls Strava API
 */
function createDefaultService(): SubscriptionService {
  return {
    async createSubscription(callbackUrl, verifyToken, clientId, clientSecret) {
      console.log('[Webhook:SubscriptionManager] Creating subscription...');
      console.log(`  Callback URL: ${callbackUrl}`);

      // Use FormData to send form-encoded body (required by Strava API)
      const formData = new URLSearchParams();
      formData.append('client_id', clientId);
      formData.append('client_secret', clientSecret);
      formData.append('callback_url', callbackUrl);
      formData.append('verify_token', verifyToken);

      const response = await fetch(STRAVA_SUBSCRIPTION_URL, {
        method: 'POST',
        body: formData,
        headers: {
          // FormData will set Content-Type automatically
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        const message = `Failed to create subscription: ${response.status} ${errorText}`;
        console.error(`[Webhook:SubscriptionManager] ✗ ${message}`);
        throw new Error(message);
      }

      const subscription = (await response.json()) as SubscriptionResponse;
      console.log('[Webhook:SubscriptionManager] ✓ Subscription created', {
        id: subscription.id,
        callbackUrl: subscription.callback_url
      });

      return subscription;
    },

    async getExistingSubscription(clientId, clientSecret) {
      try {
        const url = new URL(STRAVA_SUBSCRIPTION_URL);
        url.searchParams.append('client_id', clientId);
        url.searchParams.append('client_secret', clientSecret);

        const response = await fetch(url.toString());

        if (response.status === 404) {
          console.log('[Webhook:SubscriptionManager] No existing subscription found');
          return null;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(
            `[Webhook:SubscriptionManager] Check failed: ${response.status} ${errorText}`
          );
          return null;
        }

        const subscription = (await response.json()) as SubscriptionResponse;
        console.log('[Webhook:SubscriptionManager] Found existing subscription', {
          id: subscription.id,
          callbackUrl: subscription.callback_url,
          createdAt: subscription.created_at
        });

        return subscription;
      } catch (error) {
        console.warn('[Webhook:SubscriptionManager] Could not check subscription', {
          error: error instanceof Error ? error.message : String(error)
        });
        return null;
      }
    },

    async deleteSubscription(subscriptionId, clientId, clientSecret) {
      console.log(`[Webhook:SubscriptionManager] Deleting subscription ${subscriptionId}...`);

      const url = new URL(`${STRAVA_SUBSCRIPTION_URL}/${subscriptionId}`);
      url.searchParams.append('client_id', clientId);
      url.searchParams.append('client_secret', clientSecret);

      const response = await fetch(url.toString(), {
        method: 'DELETE'
      });

      if (response.status !== 204) {
        const errorText = await response.text();
        throw new Error(
          `Failed to delete subscription: ${response.status} ${errorText}`
        );
      }

      console.log(`[Webhook:SubscriptionManager] ✓ Subscription ${subscriptionId} deleted`);
    }
  };
}

/**
 * Setup webhook subscription
 *
 * Called during app startup to ensure subscription exists if webhooks are enabled.
 * This is the main entry point for subscription management.
 *
 * Safe flow:
 * 1. Check if webhooks enabled (WEBHOOK_ENABLED=true)
 * 2. Check if required config present
 * 3. Check for existing subscription
 * 4. If doesn't exist, create one
 * 5. Log result for admin to see
 *
 * Never crashes the app - webhooks are optional enhancement.
 * If setup fails, app continues with webhooks disabled.
 *
 * Accepts optional service for testing/dependency injection.
 */
export async function setupWebhookSubscription(service?: SubscriptionService): Promise<void> {
  const svc = service || createDefaultService();

  // Early exit: feature not enabled
  if (process.env.WEBHOOK_ENABLED !== 'true') {
    console.log('[Webhook:SubscriptionManager] Webhooks disabled, skipping subscription setup');
    return;
  }

  // Early exit: required config missing
  const callbackUrl = process.env.WEBHOOK_CALLBACK_URL;
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!callbackUrl || !verifyToken) {
    console.warn(
      '[Webhook:SubscriptionManager] Webhooks enabled but missing configuration:'
    );
    if (!callbackUrl) {
      console.warn('  - WEBHOOK_CALLBACK_URL is not set');
    }
    if (!verifyToken) {
      console.warn('  - WEBHOOK_VERIFY_TOKEN is not set');
    }
    console.warn(
      'Set these environment variables to enable webhook subscriptions.'
    );
    return;
  }

  if (!clientId || !clientSecret) {
    console.warn(
      '[Webhook:SubscriptionManager] Webhooks enabled but missing Strava credentials'
    );
    console.warn('  - STRAVA_CLIENT_ID is not set');
    console.warn('  - STRAVA_CLIENT_SECRET is not set');
    return;
  }

  console.log('[Webhook:SubscriptionManager] Webhook subscriptions enabled and configured');

  try {
    // Check if already subscribed
    console.log('[Webhook:SubscriptionManager] Checking for existing subscription...');
    const existing = await svc.getExistingSubscription(clientId, clientSecret);

    if (existing) {
      console.log('[Webhook:SubscriptionManager] ✓ Already subscribed, using existing', {
        subscriptionId: existing.id
      });
      return;
    }

    // Not subscribed yet - create subscription
    console.log('[Webhook:SubscriptionManager] No subscription found, creating...');
    const subscription = await svc.createSubscription(
      callbackUrl,
      verifyToken,
      clientId,
      clientSecret
    );

    console.log('[Webhook:SubscriptionManager] ✓ Subscription ready', {
      subscriptionId: subscription.id,
      callbackUrl: subscription.callback_url,
      createdAt: subscription.created_at
    });

    console.log('[Webhook:SubscriptionManager] Admin note: Strava will send webhook events to:');
    console.log(`  ${callbackUrl}`);
    console.log('[Webhook:SubscriptionManager] Monitor webhook events with:');
    console.log('  SELECT * FROM webhook_event ORDER BY created_at DESC LIMIT 20;');
  } catch (error) {
    console.error('[Webhook:SubscriptionManager] Setup failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    console.warn(
      '[Webhook:SubscriptionManager] Webhooks will not work until subscription is created.'
    );
    console.warn('[Webhook:SubscriptionManager] You can:');
    console.warn('  1. Check your environment variables (WEBHOOK_CALLBACK_URL, etc.)');
    console.warn('  2. Try subscribing manually via Strava API:');
    console.warn('     https://developers.strava.com/docs/webhooks/');
    console.warn('  3. Disable webhooks (set WEBHOOK_ENABLED=false) and use manual fetch');
    // Don't crash app - webhooks are optional
  }
}

export { createDefaultService };
