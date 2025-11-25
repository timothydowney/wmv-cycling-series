import type { IncomingMessage, ServerResponse } from 'http';
import { URLSearchParams } from 'url';
import type { Logger } from './types.js';
import type { SubscriptionStore } from './subscriptionStore.js';
import type { ValidationRequest } from './types.js';

export class RequestHandlers {
  private logger: Logger;
  private store: SubscriptionStore;

  constructor(logger: Logger, store: SubscriptionStore) {
    this.logger = logger;
    this.store = store;
  }

  async handleCreateSubscription(
    req: IncomingMessage,
    res: ServerResponse,
    body: string
  ): Promise<void> {
    try {
      // Parse form data
      const params = new URLSearchParams(body);
      const clientId = parseInt(params.get('client_id') || '0', 10);
      const clientSecret = params.get('client_secret');
      const callbackUrl = params.get('callback_url');
      const verifyToken = params.get('verify_token');

      if (!clientId || !clientSecret || !callbackUrl || !verifyToken) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required parameters' }));
        return;
      }

      // Validate callback URL
      this.logger.debug('Validating callback URL', { callbackUrl, verifyToken });
      const validated = await this.validateCallbackUrl(callbackUrl, verifyToken);

      if (!validated) {
        this.logger.warn('Callback URL validation failed', { callbackUrl });
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Callback URL validation failed' }));
        return;
      }

      // Create subscription
      const subscription = this.store.create({
        client_id: clientId,
        client_secret: clientSecret,
        callback_url: callbackUrl,
        verify_token: verifyToken,
      });

      // Return same format as GET /push_subscriptions
      const responseBody = {
        id: subscription.id,
        created_at: subscription.createdAt.toISOString(),
        callback_url: subscription.callbackUrl,
      };

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responseBody));
    } catch (error) {
      this.logger.error('Error creating subscription', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  async handleListSubscriptions(
    _req: IncomingMessage,
    res: ServerResponse,
    _query: Record<string, string>
  ): Promise<void> {
    try {
      const subscriptions = this.store.getAll();
      const response = subscriptions.map((sub) => ({
        id: sub.id,
        created_at: sub.createdAt.toISOString(),
        callback_url: sub.callbackUrl,
      }));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (error) {
      this.logger.error('Error listing subscriptions', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  async handleDeleteSubscription(
    _req: IncomingMessage,
    res: ServerResponse,
    subscriptionId: number
  ): Promise<void> {
    try {
      this.logger.info('DELETE request received for subscription', { subscriptionId });
      const deleted = this.store.delete(subscriptionId);

      if (!deleted) {
        this.logger.warn('Subscription not found for deletion', { subscriptionId });
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Subscription not found' }));
        return;
      }

      this.logger.info('✓ Successfully deleted subscription', { subscriptionId });
      res.writeHead(204);
      res.end();
    } catch (error) {
      this.logger.error('Error deleting subscription', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  handleHealth(_req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  }

  private async validateCallbackUrl(
    callbackUrl: string,
    verifyToken: string
  ): Promise<boolean> {
    try {
      const challenge = this.store.generateChallenge();
      const validationUrl = new URL(callbackUrl);
      validationUrl.searchParams.set('hub.mode', 'subscribe');
      validationUrl.searchParams.set('hub.challenge', challenge);
      validationUrl.searchParams.set('hub.verify_token', verifyToken);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      try {
        const response = await fetch(validationUrl.toString(), {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status !== 200) {
          this.logger.warn('Callback URL returned non-200 status', {
            callbackUrl,
            status: response.status,
          });
          return false;
        }

        const data = (await response.json()) as { hub?: { challenge?: string } };
        const echoedChallenge = data?.hub?.challenge || (data as unknown as Record<string, unknown>)['hub.challenge'];

        if (echoedChallenge === challenge) {
          this.logger.info('Callback URL validation successful', { callbackUrl });
          return true;
        }

        this.logger.warn('Challenge mismatch', {
          expected: challenge,
          received: echoedChallenge,
        });
        return false;
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          this.logger.warn('Callback URL validation timeout', { callbackUrl });
        } else {
          this.logger.warn('Callback URL validation error', { callbackUrl, error: fetchError });
        }
        return false;
      }
    } catch (error) {
      this.logger.error('Error validating callback URL', error);
      return false;
    }
  }
}
