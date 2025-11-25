export interface Subscription {
  id: number;
  clientId: number;
  callbackUrl: string;
  verifyToken: string;
  createdAt: Date;
  isActive: boolean;
}

export interface SubscriptionRequest {
  client_id: number;
  client_secret: string;
  callback_url: string;
  verify_token: string;
}

export interface WebhookEvent {
  object_type: 'activity' | 'athlete';
  aspect_type: 'create' | 'update' | 'delete';
  object_id: number;
  owner_id: number;
  subscription_id: number;
  event_time: number;
  updates?: Record<string, unknown>;
}

export interface ValidationRequest {
  'hub.mode': string;
  'hub.challenge': string;
  'hub.verify_token': string;
}

export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}
