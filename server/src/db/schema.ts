import { sqliteTable, check, text, numeric, integer, index, real } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

export const sessions = sqliteTable("sessions", {
	sid: text().primaryKey().notNull(),
	sess: numeric().notNull(),
	expire: text().notNull(),
},
() => [
	check("webhook_subscription_check_1", sql`id = 1`),
]);

export const participant = sqliteTable("participant", {
	strava_athlete_id: integer("strava_athlete_id").primaryKey(),
	name: text().notNull(),
	created_at: text("created_at").default("sql`(CURRENT_TIMESTAMP)`"),
},
() => [
	check("webhook_subscription_check_1", sql`id = 1`),
]);

export const season = sqliteTable("season", {
	id: integer().primaryKey({ autoIncrement: true }),
	name: text().notNull(),
	start_at: integer("start_at").notNull(),
	end_at: integer("end_at").notNull(),
	is_active: integer("is_active"),
	created_at: text("created_at").default("sql`(CURRENT_TIMESTAMP)`"),
},
() => [
	check("webhook_subscription_check_1", sql`id = 1`),
]);

export const week = sqliteTable("week", {
	id: integer().primaryKey({ autoIncrement: true }),
	season_id: integer("season_id").notNull().references(() => season.id),
	week_name: text("week_name").notNull(),
	strava_segment_id: integer("strava_segment_id").notNull().references(() => segment.strava_segment_id),
	required_laps: integer("required_laps").default(1).notNull(),
	start_at: integer("start_at").notNull(),
	end_at: integer("end_at").notNull(),
	created_at: text("created_at").default("sql`(CURRENT_TIMESTAMP)`"),
	notes: text().default(""),
},
(t) => [
	index("idx_week_season").on(t.season_id),
	check("webhook_subscription_check_1", sql`id = 1`),
]);

export const activity = sqliteTable("activity", {
	id: integer().primaryKey({ autoIncrement: true }),
	week_id: integer("week_id").notNull().references(() => week.id),
	strava_athlete_id: integer("strava_athlete_id").notNull().references(() => participant.strava_athlete_id),
	strava_activity_id: integer("strava_activity_id").notNull(),
	start_at: integer("start_at").notNull(),
	device_name: text("device_name"),
	validation_status: text("validation_status").default("valid"),
	validation_message: text("validation_message"),
	validated_at: text("validated_at").default("sql`(CURRENT_TIMESTAMP)`"),
	created_at: text("created_at").default("sql`(CURRENT_TIMESTAMP)`"),
},
(t) => [
	index("idx_activity_status").on(t.validation_status),
	index("idx_activity_week_participant").on(t.week_id, t.strava_athlete_id),
	check("webhook_subscription_check_1", sql`id = 1`),
]);

export const segmentEffort = sqliteTable("segment_effort", {
	id: integer().primaryKey({ autoIncrement: true }),
	activity_id: integer("activity_id").notNull().references(() => activity.id),
	strava_segment_id: integer("strava_segment_id").notNull().references(() => segment.strava_segment_id),
	strava_effort_id: text("strava_effort_id"),
	effort_index: integer("effort_index").notNull(),
	elapsed_seconds: integer("elapsed_seconds").notNull(),
	start_at: integer("start_at").notNull(),
	pr_achieved: integer("pr_achieved"),
},
(t) => [
	index("idx_segment_effort_activity").on(t.activity_id),
	check("webhook_subscription_check_1", sql`id = 1`),
]);

export const result = sqliteTable("result", {
	id: integer().primaryKey({ autoIncrement: true }),
	week_id: integer("week_id").notNull().references(() => week.id),
	strava_athlete_id: integer("strava_athlete_id").notNull().references(() => participant.strava_athlete_id),
	activity_id: integer("activity_id").references(() => activity.id),
	total_time_seconds: integer("total_time_seconds").notNull(),
	created_at: text("created_at").default("sql`(CURRENT_TIMESTAMP)`"),
	updated_at: text("updated_at").default("sql`(CURRENT_TIMESTAMP)`"),
},
(t) => [
	index("idx_result_participant").on(t.strava_athlete_id),
	index("idx_result_week").on(t.week_id),
	check("webhook_subscription_check_1", sql`id = 1`),
]);

export const participantToken = sqliteTable("participant_token", {
	strava_athlete_id: integer("strava_athlete_id").primaryKey().references(() => participant.strava_athlete_id, { onDelete: "cascade" } ),
	access_token: text("access_token").notNull(),
	refresh_token: text("refresh_token").notNull(),
	expires_at: integer("expires_at").notNull(),
	scope: text(),
	created_at: text("created_at").default("sql`(CURRENT_TIMESTAMP)`"),
	updated_at: text("updated_at").default("sql`(CURRENT_TIMESTAMP)`"),
},
(t) => [
	index("idx_participant_token_participant").on(t.strava_athlete_id),
	check("webhook_subscription_check_1", sql`id = 1`),
]);

export const deletionRequest = sqliteTable("deletion_request", {
	id: integer().primaryKey({ autoIncrement: true }),
	strava_athlete_id: integer("strava_athlete_id").notNull(),
	requested_at: text("requested_at").notNull(),
	status: text().default("pending"),
	completed_at: text("completed_at"),
},
() => [
	check("webhook_subscription_check_1", sql`id = 1`),
]);

export const schemaMigrations = sqliteTable("schema_migrations", {
	version: text().primaryKey(),
	name: text().notNull(),
	executed_at: text("executed_at").default("sql`(CURRENT_TIMESTAMP)`"),
},
() => [
	check("webhook_subscription_check_1", sql`id = 1`),
]);

export const segment = sqliteTable("segment", {
	strava_segment_id: integer("strava_segment_id").primaryKey(),
	name: text().notNull(),
	distance: real(),
	average_grade: real("average_grade"),
	city: text(),
	state: text(),
	country: text(),
	created_at: text("created_at").default("sql`(CURRENT_TIMESTAMP)`"),
	total_elevation_gain: real("total_elevation_gain"),
	climb_category: integer("climb_category"),
},
() => [
	check("webhook_subscription_check_1", sql`id = 1`),
]);

export const webhookEvent = sqliteTable("webhook_event", {
	id: integer().primaryKey({ autoIncrement: true }),
	payload: text().notNull(),
	processed: integer(),
	error_message: text("error_message"),
	created_at: text("created_at").default("sql`(CURRENT_TIMESTAMP)`"),
},
(t) => [
	index("idx_webhook_event_created").on(t.created_at),
	check("webhook_subscription_check_1", sql`id = 1`),
]);

export const webhookSubscription = sqliteTable("webhook_subscription", {
	id: integer().primaryKey({ autoIncrement: true }),
	verify_token: text("verify_token").notNull(),
	subscription_payload: text("subscription_payload"),
	subscription_id: integer("subscription_id"),
	last_refreshed_at: text("last_refreshed_at"),
},
() => [
	check("webhook_subscription_check_1", sql`id = 1`),
]);

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