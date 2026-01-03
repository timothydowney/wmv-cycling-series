CREATE TABLE `__new_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_id` integer NOT NULL,
	`strava_athlete_id` text NOT NULL,
	`strava_activity_id` text NOT NULL,
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
INSERT INTO `__new_activity`("id", "week_id", "strava_athlete_id", "strava_activity_id", "start_at", "device_name", "validation_status", "validation_message", "validated_at", "created_at") SELECT "id", "week_id", "strava_athlete_id", "strava_activity_id", "start_at", "device_name", "validation_status", "validation_message", "validated_at", "created_at" FROM `activity`;--> statement-breakpoint
DROP TABLE `activity`;--> statement-breakpoint
ALTER TABLE `__new_activity` RENAME TO `activity`;--> statement-breakpoint
CREATE INDEX `idx_activity_status` ON `activity` (`validation_status`);--> statement-breakpoint
CREATE INDEX `idx_activity_week_participant` ON `activity` (`week_id`,`strava_athlete_id`);--> statement-breakpoint
CREATE TABLE `__new_deletion_request` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`strava_athlete_id` text NOT NULL,
	`requested_at` text NOT NULL,
	`status` text DEFAULT 'pending',
	`completed_at` text
);
--> statement-breakpoint
INSERT INTO `__new_deletion_request`("id", "strava_athlete_id", "requested_at", "status", "completed_at") SELECT "id", "strava_athlete_id", "requested_at", "status", "completed_at" FROM `deletion_request`;--> statement-breakpoint
DROP TABLE `deletion_request`;--> statement-breakpoint
ALTER TABLE `__new_deletion_request` RENAME TO `deletion_request`;--> statement-breakpoint
CREATE TABLE `__new_participant` (
	`strava_athlete_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_participant`("strava_athlete_id", "name", "created_at", "active") SELECT "strava_athlete_id", "name", "created_at", "active" FROM `participant`;--> statement-breakpoint
DROP TABLE `participant`;--> statement-breakpoint
ALTER TABLE `__new_participant` RENAME TO `participant`;--> statement-breakpoint
CREATE TABLE `__new_participant_token` (
	`strava_athlete_id` text PRIMARY KEY NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`scope` text,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	`updated_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	FOREIGN KEY (`strava_athlete_id`) REFERENCES `participant`(`strava_athlete_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_participant_token`("strava_athlete_id", "access_token", "refresh_token", "expires_at", "scope", "created_at", "updated_at") SELECT "strava_athlete_id", "access_token", "refresh_token", "expires_at", "scope", "created_at", "updated_at" FROM `participant_token`;--> statement-breakpoint
DROP TABLE `participant_token`;--> statement-breakpoint
ALTER TABLE `__new_participant_token` RENAME TO `participant_token`;--> statement-breakpoint
CREATE INDEX `idx_participant_token_participant` ON `participant_token` (`strava_athlete_id`);--> statement-breakpoint
CREATE TABLE `__new_result` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_id` integer NOT NULL,
	`strava_athlete_id` text NOT NULL,
	`activity_id` integer,
	`total_time_seconds` integer NOT NULL,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	`updated_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	FOREIGN KEY (`week_id`) REFERENCES `week`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`strava_athlete_id`) REFERENCES `participant`(`strava_athlete_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`activity_id`) REFERENCES `activity`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_result`("id", "week_id", "strava_athlete_id", "activity_id", "total_time_seconds", "created_at", "updated_at") SELECT "id", "week_id", "strava_athlete_id", "activity_id", "total_time_seconds", "created_at", "updated_at" FROM `result`;--> statement-breakpoint
DROP TABLE `result`;--> statement-breakpoint
ALTER TABLE `__new_result` RENAME TO `result`;--> statement-breakpoint
CREATE INDEX `idx_result_participant` ON `result` (`strava_athlete_id`);--> statement-breakpoint
CREATE INDEX `idx_result_week` ON `result` (`week_id`);--> statement-breakpoint
CREATE INDEX `idx_result_week_athlete` ON `result` (`week_id`,`strava_athlete_id`);--> statement-breakpoint
CREATE TABLE `__new_segment` (
	`strava_segment_id` text PRIMARY KEY NOT NULL,
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
INSERT INTO `__new_segment`("strava_segment_id", "name", "distance", "average_grade", "city", "state", "country", "created_at", "total_elevation_gain", "climb_category") SELECT "strava_segment_id", "name", "distance", "average_grade", "city", "state", "country", "created_at", "total_elevation_gain", "climb_category" FROM `segment`;--> statement-breakpoint
DROP TABLE `segment`;--> statement-breakpoint
ALTER TABLE `__new_segment` RENAME TO `segment`;--> statement-breakpoint
CREATE TABLE `__new_segment_effort` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`activity_id` integer NOT NULL,
	`strava_segment_id` text NOT NULL,
	`strava_effort_id` text,
	`effort_index` integer NOT NULL,
	`elapsed_seconds` integer NOT NULL,
	`start_at` integer NOT NULL,
	`pr_achieved` integer,
	FOREIGN KEY (`activity_id`) REFERENCES `activity`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`strava_segment_id`) REFERENCES `segment`(`strava_segment_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_segment_effort`("id", "activity_id", "strava_segment_id", "strava_effort_id", "effort_index", "elapsed_seconds", "start_at", "pr_achieved") SELECT "id", "activity_id", "strava_segment_id", "strava_effort_id", "effort_index", "elapsed_seconds", "start_at", "pr_achieved" FROM `segment_effort`;--> statement-breakpoint
DROP TABLE `segment_effort`;--> statement-breakpoint
ALTER TABLE `__new_segment_effort` RENAME TO `segment_effort`;--> statement-breakpoint
CREATE INDEX `idx_segment_effort_activity` ON `segment_effort` (`activity_id`);--> statement-breakpoint
CREATE TABLE `__new_week` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`season_id` integer NOT NULL,
	`week_name` text NOT NULL,
	`strava_segment_id` text NOT NULL,
	`required_laps` integer DEFAULT 1 NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`multiplier` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`',
	`notes` text DEFAULT '',
	FOREIGN KEY (`season_id`) REFERENCES `season`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`strava_segment_id`) REFERENCES `segment`(`strava_segment_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_week`("id", "season_id", "week_name", "strava_segment_id", "required_laps", "start_at", "end_at", "multiplier", "created_at", "notes") SELECT "id", "season_id", "week_name", "strava_segment_id", "required_laps", "start_at", "end_at", "multiplier", "created_at", "notes" FROM `week`;--> statement-breakpoint
DROP TABLE `week`;--> statement-breakpoint
ALTER TABLE `__new_week` RENAME TO `week`;--> statement-breakpoint
CREATE INDEX `idx_week_season` ON `week` (`season_id`);