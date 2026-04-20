-- Repairs bad literal timestamp defaults left behind in long-lived SQLite databases
-- that were created before the Drizzle schema declarations were fixed.
-- Runtime insert risk: participant, season, week, activity, result, participant_token,
-- segment, and webhook_event. Audited for completeness: schema_migrations.
-- For paired timestamp columns, keep the valid sibling timestamp when only one side
-- contains the broken literal string; otherwise fall back to CURRENT_TIMESTAMP.

PRAGMA foreign_keys=OFF;
--> statement-breakpoint

CREATE TABLE `__new_participant` (
	`strava_athlete_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`active` integer DEFAULT true NOT NULL,
	`is_admin` integer DEFAULT 0 NOT NULL,
	`weight` real,
	`weight_updated_at` text
);
--> statement-breakpoint
INSERT INTO `__new_participant`(
	`strava_athlete_id`,
	`name`,
	`created_at`,
	`active`,
	`is_admin`,
	`weight`,
	`weight_updated_at`
)
SELECT
	`strava_athlete_id`,
	`name`,
	CASE
		WHEN `created_at` = 'sql`(CURRENT_TIMESTAMP)`' THEN CURRENT_TIMESTAMP
		ELSE `created_at`
	END,
	`active`,
	`is_admin`,
	`weight`,
	`weight_updated_at`
FROM `participant`;
--> statement-breakpoint
DROP TABLE `participant`;
--> statement-breakpoint
ALTER TABLE `__new_participant` RENAME TO `participant`;
--> statement-breakpoint

CREATE TABLE `__new_season` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
INSERT INTO `__new_season`(
	`id`,
	`name`,
	`start_at`,
	`end_at`,
	`created_at`
)
SELECT
	`id`,
	`name`,
	`start_at`,
	`end_at`,
	CASE
		WHEN `created_at` = 'sql`(CURRENT_TIMESTAMP)`' THEN CURRENT_TIMESTAMP
		ELSE `created_at`
	END
FROM `season`;
--> statement-breakpoint
DROP TABLE `season`;
--> statement-breakpoint
ALTER TABLE `__new_season` RENAME TO `season`;
--> statement-breakpoint

CREATE TABLE `__new_segment` (
	`strava_segment_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`distance` real,
	`average_grade` real,
	`start_latitude` real,
	`start_longitude` real,
	`end_latitude` real,
	`end_longitude` real,
	`city` text,
	`state` text,
	`country` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`metadata_updated_at` text,
	`total_elevation_gain` real,
	`climb_category` integer
);
--> statement-breakpoint
INSERT INTO `__new_segment`(
	`strava_segment_id`,
	`name`,
	`distance`,
	`average_grade`,
	`start_latitude`,
	`start_longitude`,
	`end_latitude`,
	`end_longitude`,
	`city`,
	`state`,
	`country`,
	`created_at`,
	`metadata_updated_at`,
	`total_elevation_gain`,
	`climb_category`
)
SELECT
	`strava_segment_id`,
	`name`,
	`distance`,
	`average_grade`,
	`start_latitude`,
	`start_longitude`,
	`end_latitude`,
	`end_longitude`,
	`city`,
	`state`,
	`country`,
	CASE
		WHEN `created_at` = 'sql`(CURRENT_TIMESTAMP)`' THEN CURRENT_TIMESTAMP
		ELSE `created_at`
	END,
	`metadata_updated_at`,
	`total_elevation_gain`,
	`climb_category`
FROM `segment`;
--> statement-breakpoint
DROP TABLE `segment`;
--> statement-breakpoint
ALTER TABLE `__new_segment` RENAME TO `segment`;
--> statement-breakpoint

CREATE TABLE `__new_week` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`season_id` integer NOT NULL,
	`week_name` text NOT NULL,
	`strava_segment_id` text NOT NULL,
	`required_laps` integer DEFAULT 1 NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`multiplier` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`notes` text DEFAULT '',
	FOREIGN KEY (`season_id`) REFERENCES `season`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`strava_segment_id`) REFERENCES `segment`(`strava_segment_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_week`(
	`id`,
	`season_id`,
	`week_name`,
	`strava_segment_id`,
	`required_laps`,
	`start_at`,
	`end_at`,
	`multiplier`,
	`created_at`,
	`notes`
)
SELECT
	`id`,
	`season_id`,
	`week_name`,
	`strava_segment_id`,
	`required_laps`,
	`start_at`,
	`end_at`,
	`multiplier`,
	CASE
		WHEN `created_at` = 'sql`(CURRENT_TIMESTAMP)`' THEN CURRENT_TIMESTAMP
		ELSE `created_at`
	END,
	`notes`
FROM `week`;
--> statement-breakpoint
DROP TABLE `week`;
--> statement-breakpoint
ALTER TABLE `__new_week` RENAME TO `week`;
--> statement-breakpoint
CREATE INDEX `idx_week_season` ON `week` (`season_id`);
--> statement-breakpoint

CREATE TABLE `__new_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_id` integer NOT NULL,
	`strava_athlete_id` text NOT NULL,
	`strava_activity_id` text NOT NULL,
	`start_at` integer NOT NULL,
	`device_name` text,
	`validation_status` text DEFAULT 'valid',
	`validation_message` text,
	`validated_at` text DEFAULT (CURRENT_TIMESTAMP),
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`athlete_weight` real,
	FOREIGN KEY (`week_id`) REFERENCES `week`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`strava_athlete_id`) REFERENCES `participant`(`strava_athlete_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_activity`(
	`id`,
	`week_id`,
	`strava_athlete_id`,
	`strava_activity_id`,
	`start_at`,
	`device_name`,
	`validation_status`,
	`validation_message`,
	`validated_at`,
	`created_at`,
	`athlete_weight`
)
SELECT
	`id`,
	`week_id`,
	`strava_athlete_id`,
	`strava_activity_id`,
	`start_at`,
	`device_name`,
	`validation_status`,
	`validation_message`,
	CASE
		WHEN `validated_at` = 'sql`(CURRENT_TIMESTAMP)`' THEN COALESCE(NULLIF(`created_at`, 'sql`(CURRENT_TIMESTAMP)`'), CURRENT_TIMESTAMP)
		ELSE `validated_at`
	END,
	CASE
		WHEN `created_at` = 'sql`(CURRENT_TIMESTAMP)`' THEN COALESCE(NULLIF(`validated_at`, 'sql`(CURRENT_TIMESTAMP)`'), CURRENT_TIMESTAMP)
		ELSE `created_at`
	END,
	`athlete_weight`
FROM `activity`;
--> statement-breakpoint
DROP TABLE `activity`;
--> statement-breakpoint
ALTER TABLE `__new_activity` RENAME TO `activity`;
--> statement-breakpoint
CREATE INDEX `idx_activity_status` ON `activity` (`validation_status`);
--> statement-breakpoint
CREATE INDEX `idx_activity_week_participant` ON `activity` (`week_id`,`strava_athlete_id`);
--> statement-breakpoint

CREATE TABLE `__new_result` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_id` integer NOT NULL,
	`strava_athlete_id` text NOT NULL,
	`activity_id` integer,
	`total_time_seconds` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`week_id`) REFERENCES `week`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`strava_athlete_id`) REFERENCES `participant`(`strava_athlete_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`activity_id`) REFERENCES `activity`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_result`(
	`id`,
	`week_id`,
	`strava_athlete_id`,
	`activity_id`,
	`total_time_seconds`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`week_id`,
	`strava_athlete_id`,
	`activity_id`,
	`total_time_seconds`,
	CASE
		WHEN `created_at` = 'sql`(CURRENT_TIMESTAMP)`' THEN COALESCE(NULLIF(`updated_at`, 'sql`(CURRENT_TIMESTAMP)`'), CURRENT_TIMESTAMP)
		ELSE `created_at`
	END,
	CASE
		WHEN `updated_at` = 'sql`(CURRENT_TIMESTAMP)`' THEN COALESCE(NULLIF(`created_at`, 'sql`(CURRENT_TIMESTAMP)`'), CURRENT_TIMESTAMP)
		ELSE `updated_at`
	END
FROM `result`;
--> statement-breakpoint
DROP TABLE `result`;
--> statement-breakpoint
ALTER TABLE `__new_result` RENAME TO `result`;
--> statement-breakpoint
CREATE INDEX `idx_result_participant` ON `result` (`strava_athlete_id`);
--> statement-breakpoint
CREATE INDEX `idx_result_week` ON `result` (`week_id`);
--> statement-breakpoint
CREATE INDEX `idx_result_week_athlete` ON `result` (`week_id`,`strava_athlete_id`);
--> statement-breakpoint

CREATE TABLE `__new_participant_token` (
	`strava_athlete_id` text PRIMARY KEY NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`scope` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`strava_athlete_id`) REFERENCES `participant`(`strava_athlete_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_participant_token`(
	`strava_athlete_id`,
	`access_token`,
	`refresh_token`,
	`expires_at`,
	`scope`,
	`created_at`,
	`updated_at`
)
SELECT
	`strava_athlete_id`,
	`access_token`,
	`refresh_token`,
	`expires_at`,
	`scope`,
	CASE
		WHEN `created_at` = 'sql`(CURRENT_TIMESTAMP)`' THEN COALESCE(NULLIF(`updated_at`, 'sql`(CURRENT_TIMESTAMP)`'), CURRENT_TIMESTAMP)
		ELSE `created_at`
	END,
	CASE
		WHEN `updated_at` = 'sql`(CURRENT_TIMESTAMP)`' THEN COALESCE(NULLIF(`created_at`, 'sql`(CURRENT_TIMESTAMP)`'), CURRENT_TIMESTAMP)
		ELSE `updated_at`
	END
FROM `participant_token`;
--> statement-breakpoint
DROP TABLE `participant_token`;
--> statement-breakpoint
ALTER TABLE `__new_participant_token` RENAME TO `participant_token`;
--> statement-breakpoint
CREATE INDEX `idx_participant_token_participant` ON `participant_token` (`strava_athlete_id`);
--> statement-breakpoint

CREATE TABLE `__new_schema_migrations` (
	`version` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`executed_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
INSERT INTO `__new_schema_migrations`(
	`version`,
	`name`,
	`executed_at`
)
SELECT
	`version`,
	`name`,
	CASE
		WHEN `executed_at` = 'sql`(CURRENT_TIMESTAMP)`' THEN CURRENT_TIMESTAMP
		ELSE `executed_at`
	END
FROM `schema_migrations`;
--> statement-breakpoint
DROP TABLE `schema_migrations`;
--> statement-breakpoint
ALTER TABLE `__new_schema_migrations` RENAME TO `schema_migrations`;
--> statement-breakpoint

CREATE TABLE `__new_webhook_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payload` text NOT NULL,
	`processed` integer,
	`error_message` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
INSERT INTO `__new_webhook_event`(
	`id`,
	`payload`,
	`processed`,
	`error_message`,
	`created_at`
)
SELECT
	`id`,
	`payload`,
	`processed`,
	`error_message`,
	CASE
		WHEN `created_at` = 'sql`(CURRENT_TIMESTAMP)`' THEN CURRENT_TIMESTAMP
		ELSE `created_at`
	END
FROM `webhook_event`;
--> statement-breakpoint
DROP TABLE `webhook_event`;
--> statement-breakpoint
ALTER TABLE `__new_webhook_event` RENAME TO `webhook_event`;
--> statement-breakpoint
CREATE INDEX `idx_webhook_event_created` ON `webhook_event` (`created_at`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
