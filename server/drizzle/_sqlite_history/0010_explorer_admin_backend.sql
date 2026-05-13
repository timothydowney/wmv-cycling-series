DROP INDEX IF EXISTS `idx_explorer_campaign_season`;
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_explorer_campaign_season` ON `explorer_campaign` (`season_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_explorer_destination_campaign_segment`
  ON `explorer_destination` (`explorer_campaign_id`, `strava_segment_id`);