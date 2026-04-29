ALTER TABLE `participant` ADD `active` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_result_week_athlete` ON `result` (`week_id`,`strava_athlete_id`);