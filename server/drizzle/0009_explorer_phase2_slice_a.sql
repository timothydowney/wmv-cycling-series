CREATE TABLE `explorer_week` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE INDEX `idx_explorer_week_status` ON `explorer_week` (`status`);
--> statement-breakpoint
CREATE INDEX `idx_explorer_week_window` ON `explorer_week` (`start_at`,`end_at`);
--> statement-breakpoint
CREATE TABLE `explorer_destination` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`explorer_week_id` integer NOT NULL,
	`strava_segment_id` text NOT NULL,
	`source_url` text,
	`cached_segment_name` text,
	`display_label` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`surface_type` text,
	`category` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`explorer_week_id`) REFERENCES `explorer_week`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_explorer_destination_week` ON `explorer_destination` (`explorer_week_id`);
--> statement-breakpoint
CREATE INDEX `idx_explorer_destination_segment` ON `explorer_destination` (`strava_segment_id`);
--> statement-breakpoint
CREATE TABLE `explorer_destination_match` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`explorer_week_id` integer NOT NULL,
	`explorer_destination_id` integer NOT NULL,
	`strava_athlete_id` text NOT NULL,
	`strava_activity_id` text NOT NULL,
	`matched_at` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`explorer_week_id`) REFERENCES `explorer_week`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`explorer_destination_id`) REFERENCES `explorer_destination`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`strava_athlete_id`) REFERENCES `participant`(`strava_athlete_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_explorer_match_week_athlete` ON `explorer_destination_match` (`explorer_week_id`,`strava_athlete_id`);
--> statement-breakpoint
CREATE INDEX `idx_explorer_match_activity` ON `explorer_destination_match` (`strava_activity_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_explorer_match_unique` ON `explorer_destination_match` (`explorer_week_id`,`explorer_destination_id`,`strava_athlete_id`);