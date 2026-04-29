CREATE TABLE `chain_wax_period` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`total_distance_meters` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chain_wax_activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`period_id` integer NOT NULL REFERENCES `chain_wax_period`(`id`),
	`strava_activity_id` text NOT NULL UNIQUE,
	`strava_athlete_id` text NOT NULL,
	`distance_meters` real NOT NULL,
	`activity_start_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_chain_wax_activity_period` ON `chain_wax_activity` (`period_id`);
--> statement-breakpoint
CREATE INDEX `idx_chain_wax_activity_strava_id` ON `chain_wax_activity` (`strava_activity_id`);
--> statement-breakpoint
CREATE TABLE `chain_wax_puck` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` integer NOT NULL,
	`wax_count` integer DEFAULT 0 NOT NULL,
	`is_current` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `chain_wax_period` (`started_at`, `ended_at`, `total_distance_meters`, `created_at`) VALUES (1773583200, NULL, 0, 1773583200);
--> statement-breakpoint
INSERT INTO `chain_wax_puck` (`started_at`, `wax_count`, `is_current`, `created_at`) VALUES (1773583200, 4, 1, 1773583200);
