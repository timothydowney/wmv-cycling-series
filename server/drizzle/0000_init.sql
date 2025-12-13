CREATE TABLE IF NOT EXISTS `activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_id` integer NOT NULL,
	`strava_athlete_id` integer NOT NULL,
	`strava_activity_id` integer NOT NULL,
	`start_at` integer NOT NULL,
	`device_name` text,
	`validation_status` text DEFAULT 'valid',
	`validation_message` text,
	`validated_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	FOREIGN KEY (`week_id`) REFERENCES `week`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`strava_athlete_id`) REFERENCES `participant`(`strava_athlete_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_activity_status` ON `activity` (`validation_status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_activity_week_participant` ON `activity` (`week_id`,`strava_athlete_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `deletion_request` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`strava_athlete_id` integer NOT NULL,
	`requested_at` text NOT NULL,
	`status` text DEFAULT 'pending',
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `participant` (
	`strava_athlete_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `participant_token` (
	`strava_athlete_id` integer PRIMARY KEY NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`scope` text,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	`updated_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	FOREIGN KEY (`strava_athlete_id`) REFERENCES `participant`(`strava_athlete_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_participant_token_participant` ON `participant_token` (`strava_athlete_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `result` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_id` integer NOT NULL,
	`strava_athlete_id` integer NOT NULL,
	`activity_id` integer,
	`total_time_seconds` integer NOT NULL,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	`updated_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	FOREIGN KEY (`week_id`) REFERENCES `week`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`strava_athlete_id`) REFERENCES `participant`(`strava_athlete_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`activity_id`) REFERENCES `activity`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_result_participant` ON `result` (`strava_athlete_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_result_week` ON `result` (`week_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `schema_migrations` (
	`version` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`executed_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `season` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`is_active` integer,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `segment` (
	`strava_segment_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`distance` real,
	`average_grade` real,
	`city` text,
	`state` text,
	`country` text,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	`total_elevation_gain` real,
	`climb_category` integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `segment_effort` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`activity_id` integer NOT NULL,
	`strava_segment_id` integer NOT NULL,
	`strava_effort_id` text,
	`effort_index` integer NOT NULL,
	`elapsed_seconds` integer NOT NULL,
	`start_at` integer NOT NULL,
	`pr_achieved` integer,
	FOREIGN KEY (`activity_id`) REFERENCES `activity`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`strava_segment_id`) REFERENCES `segment`(`strava_segment_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_segment_effort_activity` ON `segment_effort` (`activity_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sessions` (
	`sid` text PRIMARY KEY NOT NULL,
	`sess` numeric NOT NULL,
	`expire` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `webhook_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payload` text NOT NULL,
	`processed` integer,
	`error_message` text,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`'
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_webhook_event_created` ON `webhook_event` (`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `webhook_subscription` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`verify_token` text NOT NULL,
	`subscription_payload` text,
	`subscription_id` integer,
	`last_refreshed_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `week` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`season_id` integer NOT NULL,
	`week_name` text NOT NULL,
	`strava_segment_id` integer NOT NULL,
	`required_laps` integer DEFAULT 1 NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	`notes` text DEFAULT '',
	FOREIGN KEY (`season_id`) REFERENCES `season`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`strava_segment_id`) REFERENCES `segment`(`strava_segment_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_week_season` ON `week` (`season_id`);