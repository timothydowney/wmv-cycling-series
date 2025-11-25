import { randomBytes } from 'crypto';
import type { Subscription, SubscriptionRequest } from './types.js';
import type { Logger } from './types.js';

export class SubscriptionStore {
  private subscriptions: Map<number, Subscription> = new Map();
  private nextId: number = 1;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  create(request: SubscriptionRequest): Subscription {
    const id = this.nextId++;
    const subscription: Subscription = {
      id,
      clientId: request.client_id,
      callbackUrl: request.callback_url,
      verifyToken: request.verify_token,
      createdAt: new Date(),
      isActive: true,
    };

    this.subscriptions.set(id, subscription);
    this.logger.info(`Subscription created`, { id, clientId: request.client_id });
    return subscription;
  }

  get(id: number): Subscription | undefined {
    return this.subscriptions.get(id);
  }

  getAll(clientId?: number): Subscription[] {
    const subs = Array.from(this.subscriptions.values());
    if (clientId) {
      return subs.filter((s) => s.clientId === clientId);
    }
    return subs;
  }

  delete(id: number): boolean {
    const existed = this.subscriptions.has(id);
    this.subscriptions.delete(id);
    if (existed) {
      this.logger.info(`Subscription deleted`, { id });
    }
    return existed;
  }

  clear(): void {
    this.subscriptions.clear();
    this.nextId = 1;
    this.logger.info('All subscriptions cleared');
  }

  generateChallenge(): string {
    return randomBytes(16).toString('hex');
  }
}
