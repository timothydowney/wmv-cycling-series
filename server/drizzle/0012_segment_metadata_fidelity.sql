ALTER TABLE `segment` ADD COLUMN `start_latitude` real;
--> statement-breakpoint
ALTER TABLE `segment` ADD COLUMN `start_longitude` real;
--> statement-breakpoint
ALTER TABLE `segment` ADD COLUMN `end_latitude` real;
--> statement-breakpoint
ALTER TABLE `segment` ADD COLUMN `end_longitude` real;
--> statement-breakpoint
ALTER TABLE `segment` ADD COLUMN `metadata_updated_at` text;