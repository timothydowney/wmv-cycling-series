import { sqliteTable, text, numeric, integer, index, real } from 'drizzle-orm/sqlite-core';
// import { relations } from "drizzle-orm"

export const sessions = sqliteTable('sessions', {
  sid: text().primaryKey().notNull(),
  sess: numeric().notNull(),
  expire: text().notNull(),
});

export const participant = sqliteTable('participant', {
  strava_athlete_id: text('strava_athlete_id').primaryKey(),
  name: text().notNull(),
  created_at: text('created_at').default('sql`(CURRENT_TIMESTAMP)`'),
  active: integer('active', { mode: 'boolean' }).default(true).notNull(),
});

export const season = sqliteTable('season', {
  id: integer().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  start_at: integer('start_at').notNull(),
  end_at: integer('end_at').notNull(),
  // TODO: Remove is_active column in future - active status is now determined by date range (start_at <= now <= end_at)
  // This column is kept for backward compatibility but is no longer used
  is_active: integer('is_active'),
  created_at: text('created_at').default('sql`(CURRENT_TIMESTAMP)`'),
});

export const week = sqliteTable('week', {
  id: integer().primaryKey({ autoIncrement: true }),
  season_id: integer('season_id').notNull().references(() => season.id),
  week_name: text('week_name').notNull(),
  strava_segment_id: text('strava_segment_id').notNull().references(() => segment.strava_segment_id),
  required_laps: integer('required_laps').default(1).notNull(),
  start_at: integer('start_at').notNull(),
  end_at: integer('end_at').notNull(),
  multiplier: integer('multiplier').default(1).notNull(), // NEW: Scoring multiplier for week (default 1 = no change)
  created_at: text('created_at').default('sql`(CURRENT_TIMESTAMP)`'),
  notes: text().default(''),
},
(t) => [
  index('idx_week_season').on(t.season_id),
]);

export const activity = sqliteTable('activity', {
  id: integer().primaryKey({ autoIncrement: true }),
  week_id: integer('week_id').notNull().references(() => week.id),
  strava_athlete_id: text('strava_athlete_id').notNull().references(() => participant.strava_athlete_id),
  strava_activity_id: text('strava_activity_id').notNull(),
  start_at: integer('start_at').notNull(),
  device_name: text('device_name'),
  validation_status: text('validation_status').default('valid'),
  validation_message: text('validation_message'),
  validated_at: text('validated_at').default('sql`(CURRENT_TIMESTAMP)`'),
  created_at: text('created_at').default('sql`(CURRENT_TIMESTAMP)`'),
},
(t) => [
  index('idx_activity_status').on(t.validation_status),
  index('idx_activity_week_participant').on(t.week_id, t.strava_athlete_id),
]);

export const segmentEffort = sqliteTable('segment_effort', {
  id: integer().primaryKey({ autoIncrement: true }),
  activity_id: integer('activity_id').notNull().references(() => activity.id),
  strava_segment_id: text('strava_segment_id').notNull().references(() => segment.strava_segment_id),
  strava_effort_id: text('strava_effort_id'),
  effort_index: integer('effort_index').notNull(),
  elapsed_seconds: integer('elapsed_seconds').notNull(),
  start_at: integer('start_at').notNull(),
  pr_achieved: integer('pr_achieved'),
},
(t) => [
  index('idx_segment_effort_activity').on(t.activity_id),
]);

export const result = sqliteTable('result', {
  id: integer().primaryKey({ autoIncrement: true }),
  week_id: integer('week_id').notNull().references(() => week.id),
  strava_athlete_id: text('strava_athlete_id').notNull().references(() => participant.strava_athlete_id),
  activity_id: integer('activity_id').references(() => activity.id),
  total_time_seconds: integer('total_time_seconds').notNull(),
  created_at: text('created_at').default('sql`(CURRENT_TIMESTAMP)`'),
  updated_at: text('updated_at').default('sql`(CURRENT_TIMESTAMP)`'),
},
(t) => [
  index('idx_result_participant').on(t.strava_athlete_id),
  index('idx_result_week').on(t.week_id),
  index('idx_result_week_athlete').on(t.week_id, t.strava_athlete_id), // Composite index for GROUP BY performance
]);

export const participantToken = sqliteTable('participant_token', {
  strava_athlete_id: text('strava_athlete_id').primaryKey().references(() => participant.strava_athlete_id, { onDelete: 'cascade' } ),
  access_token: text('access_token').notNull(),
  refresh_token: text('refresh_token').notNull(),
  expires_at: integer('expires_at').notNull(),
  scope: text(),
  created_at: text('created_at').default('sql`(CURRENT_TIMESTAMP)`'),
  updated_at: text('updated_at').default('sql`(CURRENT_TIMESTAMP)`'),
},
(t) => [
  index('idx_participant_token_participant').on(t.strava_athlete_id),
]);

export const deletionRequest = sqliteTable('deletion_request', {
  id: integer().primaryKey({ autoIncrement: true }),
  strava_athlete_id: text('strava_athlete_id').notNull(),
  requested_at: text('requested_at').notNull(),
  status: text().default('pending'),
  completed_at: text('completed_at'),
});

export const schemaMigrations = sqliteTable('schema_migrations', {
  version: text().primaryKey(),
  name: text().notNull(),
  executed_at: text('executed_at').default('sql`(CURRENT_TIMESTAMP)`'),
});

export const segment = sqliteTable('segment', {
  strava_segment_id: text('strava_segment_id').primaryKey(),
  name: text().notNull(),
  distance: real(),
  average_grade: real('average_grade'),
  city: text(),
  state: text(),
  country: text(),
  created_at: text('created_at').default('sql`(CURRENT_TIMESTAMP)`'),
  total_elevation_gain: real('total_elevation_gain'),
  climb_category: integer('climb_category'),
});

export const webhookEvent = sqliteTable('webhook_event', {
  id: integer().primaryKey({ autoIncrement: true }),
  payload: text().notNull(),
  processed: integer(),
  error_message: text('error_message'),
  created_at: text('created_at').default('sql`(CURRENT_TIMESTAMP)`'),
},
(t) => [
  index('idx_webhook_event_created').on(t.created_at),
]);

export const webhookSubscription = sqliteTable('webhook_subscription', {
  id: integer().primaryKey({ autoIncrement: true }),
  verify_token: text('verify_token').notNull(),
  subscription_payload: text('subscription_payload'),
  subscription_id: integer('subscription_id'),
  last_refreshed_at: text('last_refreshed_at'),
});

// Type exports
export type Season = typeof season.$inferSelect;
export type NewSeason = typeof season.$inferInsert;

export type Week = typeof week.$inferSelect;
export type NewWeek = typeof week.$inferInsert;

export type Segment = typeof segment.$inferSelect;
export type NewSegment = typeof segment.$inferInsert;

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
