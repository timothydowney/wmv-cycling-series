import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  bigint,
  index,
  doublePrecision,
  uniqueIndex,
  boolean,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';
// import { relations } from "drizzle-orm"

export const sessions = pgTable(
  'sessions',
  {
    sid: text('sid').primaryKey().notNull(),
    sess: jsonb('sess').notNull(),
    expire: timestamp('expire', { mode: 'date' }).notNull(),
  },
  (t) => [index('idx_sessions_expire').on(t.expire)]
);

export const participant = pgTable('participant', {
  strava_athlete_id: text('strava_athlete_id').primaryKey(),
  name: text('name').notNull(),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  active: boolean('active').default(true).notNull(),
  is_admin: boolean('is_admin').default(false).notNull(),
  weight: doublePrecision('weight'),  // Most recent weight in kg (Strava API format)
  weight_updated_at: text('weight_updated_at'),  // When weight was last captured
});

export const season = pgTable('season', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  name: text('name').notNull(),
  start_at: bigint('start_at', { mode: 'number' }).notNull(),
  end_at: bigint('end_at', { mode: 'number' }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const week = pgTable('week', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  season_id: bigint('season_id', { mode: 'number' }).notNull().references(() => season.id),
  week_name: text('week_name').notNull(),
  strava_segment_id: text('strava_segment_id').notNull().references(() => segment.strava_segment_id),
  required_laps: bigint('required_laps', { mode: 'number' }).default(1).notNull(),
  start_at: bigint('start_at', { mode: 'number' }).notNull(),
  end_at: bigint('end_at', { mode: 'number' }).notNull(),
  multiplier: bigint('multiplier', { mode: 'number' }).default(1).notNull(), // NEW: Scoring multiplier for week (default 1 = no change)
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  notes: text('notes').default(''),
},
(t) => [
  index('idx_week_season').on(t.season_id),
]);

export const activity = pgTable('activity', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  week_id: bigint('week_id', { mode: 'number' }).notNull().references(() => week.id),
  strava_athlete_id: text('strava_athlete_id').notNull().references(() => participant.strava_athlete_id),
  strava_activity_id: text('strava_activity_id').notNull(),
  start_at: bigint('start_at', { mode: 'number' }).notNull(),
  device_name: text('device_name'),
  validation_status: text('validation_status').default('valid'),
  validation_message: text('validation_message'),
  validated_at: text('validated_at').default(sql`(CURRENT_TIMESTAMP)`),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  athlete_weight: doublePrecision('athlete_weight'),  // Weight in kg at activity time (Strava API format, for w/kg calculation)
},
(t) => [
  index('idx_activity_status').on(t.validation_status),
  index('idx_activity_week_participant').on(t.week_id, t.strava_athlete_id),
]);

export const segmentEffort = pgTable('segment_effort', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  activity_id: bigint('activity_id', { mode: 'number' }).notNull().references(() => activity.id),
  strava_segment_id: text('strava_segment_id').notNull().references(() => segment.strava_segment_id),
  strava_effort_id: text('strava_effort_id'),
  effort_index: bigint('effort_index', { mode: 'number' }).notNull(),
  elapsed_seconds: bigint('elapsed_seconds', { mode: 'number' }).notNull(),
  start_at: bigint('start_at', { mode: 'number' }).notNull(),
  pr_achieved: bigint('pr_achieved', { mode: 'number' }),
  average_watts: doublePrecision('average_watts'),
  average_heartrate: doublePrecision('average_heartrate'),
  max_heartrate: doublePrecision('max_heartrate'),
  average_cadence: doublePrecision('average_cadence'),
  device_watts: boolean('device_watts'),
},
(t) => [
  index('idx_segment_effort_activity').on(t.activity_id),
]);

export const result = pgTable('result', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  week_id: bigint('week_id', { mode: 'number' }).notNull().references(() => week.id),
  strava_athlete_id: text('strava_athlete_id').notNull().references(() => participant.strava_athlete_id),
  activity_id: bigint('activity_id', { mode: 'number' }).references(() => activity.id),
  total_time_seconds: bigint('total_time_seconds', { mode: 'number' }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
},
(t) => [
  index('idx_result_participant').on(t.strava_athlete_id),
  index('idx_result_week').on(t.week_id),
  index('idx_result_week_athlete').on(t.week_id, t.strava_athlete_id), // Composite index for GROUP BY performance
]);

export const participantToken = pgTable('participant_token', {
  strava_athlete_id: text('strava_athlete_id').primaryKey().references(() => participant.strava_athlete_id, { onDelete: 'cascade' } ),
  access_token: text('access_token').notNull(),
  refresh_token: text('refresh_token').notNull(),
  expires_at: bigint('expires_at', { mode: 'number' }).notNull(),
  scope: text(),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
},
(t) => [
  index('idx_participant_token_participant').on(t.strava_athlete_id),
]);

export const deletionRequest = pgTable('deletion_request', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  strava_athlete_id: text('strava_athlete_id').notNull(),
  requested_at: text('requested_at').notNull(),
  status: text('status').default('pending'),
  completed_at: text('completed_at'),
});

export const schemaMigrations = pgTable('schema_migrations', {
  version: text().primaryKey(),
  name: text().notNull(),
  executed_at: text('executed_at').default(sql`(CURRENT_TIMESTAMP)`),
});

export const segment = pgTable('segment', {
  strava_segment_id: text('strava_segment_id').primaryKey(),
  name: text('name').notNull(),
  distance: doublePrecision('distance'),
  average_grade: doublePrecision('average_grade'),
  start_latitude: doublePrecision('start_latitude'),
  start_longitude: doublePrecision('start_longitude'),
  end_latitude: doublePrecision('end_latitude'),
  end_longitude: doublePrecision('end_longitude'),
  city: text('city'),
  state: text('state'),
  country: text('country'),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  metadata_updated_at: text('metadata_updated_at'),
  total_elevation_gain: doublePrecision('total_elevation_gain'),
  climb_category: bigint('climb_category', { mode: 'number' }),
});

export const webhookEvent = pgTable('webhook_event', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  payload: text().notNull(),
  processed: bigint('processed', { mode: 'number' }),
  error_message: text('error_message'),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
},
(t) => [
  index('idx_webhook_event_created').on(t.created_at),
]);

export const webhookSubscription = pgTable('webhook_subscription', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  verify_token: text('verify_token').notNull(),
  subscription_payload: text('subscription_payload'),
  subscription_id: bigint('subscription_id', { mode: 'number' }),
  last_refreshed_at: text('last_refreshed_at'),
});

export const explorerCampaign = pgTable('explorer_campaign', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  start_at: bigint('start_at', { mode: 'number' }).notNull(),
  end_at: bigint('end_at', { mode: 'number' }).notNull(),
  display_name: text('display_name'),
  rules_blurb: text('rules_blurb'),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
},
(t) => [
  index('idx_explorer_campaign_window').on(t.start_at, t.end_at),
]);

export const explorerDestination = pgTable('explorer_destination', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  explorer_campaign_id: bigint('explorer_campaign_id', { mode: 'number' }).notNull().references(() => explorerCampaign.id, { onDelete: 'cascade' }),
  strava_segment_id: text('strava_segment_id').notNull(),
  source_url: text('source_url'),
  cached_name: text('cached_name'),
  display_label: text('display_label'),
  display_order: bigint('display_order', { mode: 'number' }).default(0).notNull(),
  surface_type: text('surface_type'),
  category: text('category'),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow(),
},
(t) => [
  index('idx_explorer_destination_campaign').on(t.explorer_campaign_id),
  index('idx_explorer_destination_segment').on(t.strava_segment_id),
  uniqueIndex('idx_explorer_destination_campaign_segment').on(t.explorer_campaign_id, t.strava_segment_id),
]);

export const explorerDestinationMatch = pgTable('explorer_destination_match', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  explorer_campaign_id: bigint('explorer_campaign_id', { mode: 'number' }).notNull().references(() => explorerCampaign.id, { onDelete: 'cascade' }),
  explorer_destination_id: bigint('explorer_destination_id', { mode: 'number' }).notNull().references(() => explorerDestination.id, { onDelete: 'cascade' }),
  strava_athlete_id: text('strava_athlete_id').notNull().references(() => participant.strava_athlete_id, { onDelete: 'cascade' }),
  strava_activity_id: text('strava_activity_id').notNull(),
  matched_at: bigint('matched_at', { mode: 'number' }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
},
(t) => [
  index('idx_explorer_match_campaign_athlete').on(t.explorer_campaign_id, t.strava_athlete_id),
  index('idx_explorer_match_activity').on(t.strava_activity_id),
  uniqueIndex('idx_explorer_match_unique').on(t.explorer_campaign_id, t.explorer_destination_id, t.strava_athlete_id),
]);

export const explorerDestinationPin = pgTable('explorer_destination_pin', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  explorer_campaign_id: bigint('explorer_campaign_id', { mode: 'number' }).notNull().references(() => explorerCampaign.id, { onDelete: 'cascade' }),
  explorer_destination_id: bigint('explorer_destination_id', { mode: 'number' }).notNull().references(() => explorerDestination.id, { onDelete: 'cascade' }),
  strava_athlete_id: text('strava_athlete_id').notNull().references(() => participant.strava_athlete_id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow(),
},
(t) => [
  index('idx_explorer_pin_campaign_athlete').on(t.explorer_campaign_id, t.strava_athlete_id),
  uniqueIndex('idx_explorer_pin_unique').on(t.explorer_campaign_id, t.explorer_destination_id, t.strava_athlete_id),
]);

// Chain Wax Tracking tables
export const chainWaxPeriod = pgTable('chain_wax_period', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  started_at: bigint('started_at', { mode: 'number' }).notNull(), // Unix seconds - when chain was waxed
  ended_at: bigint('ended_at', { mode: 'number' }), // Unix seconds - when next wax happened (NULL = current active period)
  total_distance_meters: doublePrecision('total_distance_meters').default(0).notNull(), // Cached sum
  created_at: bigint('created_at', { mode: 'number' }).notNull(),
});

export const chainWaxActivity = pgTable('chain_wax_activity', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  period_id: bigint('period_id', { mode: 'number' }).notNull().references(() => chainWaxPeriod.id),
  strava_activity_id: text('strava_activity_id').notNull().unique(), // Dedup key
  strava_athlete_id: text('strava_athlete_id').notNull(),
  distance_meters: doublePrecision('distance_meters').notNull(),
  activity_start_at: bigint('activity_start_at', { mode: 'number' }).notNull(), // Unix seconds
  created_at: bigint('created_at', { mode: 'number' }).notNull(),
},
(t) => [
  index('idx_chain_wax_activity_period').on(t.period_id),
  index('idx_chain_wax_activity_strava_id').on(t.strava_activity_id),
]);

export const chainWaxPuck = pgTable('chain_wax_puck', {
  id: bigint('id', { mode: 'number' }).generatedByDefaultAsIdentity().primaryKey(),
  started_at: bigint('started_at', { mode: 'number' }).notNull(), // Unix seconds
  wax_count: bigint('wax_count', { mode: 'number' }).default(0).notNull(),
  is_current: boolean('is_current').default(true).notNull(),
  created_at: bigint('created_at', { mode: 'number' }).notNull(),
});

// Type exports
export type ChainWaxPeriod = typeof chainWaxPeriod.$inferSelect;
export type NewChainWaxPeriod = typeof chainWaxPeriod.$inferInsert;

export type ChainWaxActivity = typeof chainWaxActivity.$inferSelect;
export type NewChainWaxActivity = typeof chainWaxActivity.$inferInsert;

export type ChainWaxPuck = typeof chainWaxPuck.$inferSelect;
export type NewChainWaxPuck = typeof chainWaxPuck.$inferInsert;

export type Season = typeof season.$inferSelect;
export type NewSeason = typeof season.$inferInsert;

export type Week = typeof week.$inferSelect;
export type NewWeek = typeof week.$inferInsert;

export type Segment = typeof segment.$inferSelect;
export type NewSegment = typeof segment.$inferInsert;

export type ExplorerCampaign = typeof explorerCampaign.$inferSelect;
export type NewExplorerCampaign = typeof explorerCampaign.$inferInsert;
export type ExplorerDestinationPin = typeof explorerDestinationPin.$inferSelect;
export type NewExplorerDestinationPin = typeof explorerDestinationPin.$inferInsert;

export type ExplorerDestination = typeof explorerDestination.$inferSelect;
export type NewExplorerDestination = typeof explorerDestination.$inferInsert;

export type ExplorerDestinationMatch = typeof explorerDestinationMatch.$inferSelect;
export type NewExplorerDestinationMatch = typeof explorerDestinationMatch.$inferInsert;

export type Participant = typeof participant.$inferSelect;
export type NewParticipant = typeof participant.$inferInsert;

export type Activity = typeof activity.$inferSelect;
export type NewActivity = typeof activity.$inferInsert;

export type Result = typeof result.$inferSelect;
export type NewResult = typeof result.$inferInsert;

export type SegmentEffort = typeof segmentEffort.$inferSelect;
export type NewSegmentEffort = typeof segmentEffort.$inferInsert;

export type ParticipantToken = typeof participantToken.$inferSelect;
export type NewParticipantToken = typeof participantToken.$inferInsert;

export type WebhookEvent = typeof webhookEvent.$inferSelect;
export type NewWebhookEvent = typeof webhookEvent.$inferInsert;
