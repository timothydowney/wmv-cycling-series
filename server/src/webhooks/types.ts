import { type Activity as StravaActivity, type SegmentEffort } from '../stravaClient';

/**
 * Webhook Type Definitions
 *
 * Type-safe interfaces for webhook events from Strava
 */

export interface WebhookEvent {
  aspect_type: 'create' | 'update' | 'delete';
  event_time: number;
  object_id: number;
  object_type: 'activity' | 'athlete';
  owner_id: number;
  subscription_id: number;
  updates?: Record<string, unknown>;
}

export interface ActivityWebhookEvent extends WebhookEvent {
  object_type: 'activity';
}

export interface AthleteWebhookEvent extends WebhookEvent {
  object_type: 'athlete';
  updates?: {
    authorized?: boolean;
    [key: string]: unknown;
  };
}

export { type StravaActivity, type SegmentEffort };

/**
 * Result of webhook processing
 */
export interface WebhookProcessResult {
  success: boolean;
  message: string;
  objectId: number;
  error?: Error;
}
