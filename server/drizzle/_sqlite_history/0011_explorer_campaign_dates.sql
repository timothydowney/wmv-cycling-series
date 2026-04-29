PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_explorer_campaign` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`display_name` text,
	`rules_blurb` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
INSERT INTO `__new_explorer_campaign` (
	`id`,
	`start_at`,
	`end_at`,
	`display_name`,
	`rules_blurb`,
	`created_at`,
	`updated_at`
)
SELECT
	`explorer_campaign`.`id`,
	COALESCE(`season`.`start_at`, 0),
	COALESCE(`season`.`end_at`, 0),
	`explorer_campaign`.`display_name`,
	`explorer_campaign`.`rules_blurb`,
	`explorer_campaign`.`created_at`,
	`explorer_campaign`.`updated_at`
FROM `explorer_campaign`
LEFT JOIN `season` ON `season`.`id` = `explorer_campaign`.`season_id`;
--> statement-breakpoint
DROP TABLE `explorer_campaign`;
--> statement-breakpoint
ALTER TABLE `__new_explorer_campaign` RENAME TO `explorer_campaign`;
--> statement-breakpoint
DROP INDEX IF EXISTS `idx_explorer_campaign_season`;
--> statement-breakpoint
CREATE INDEX `idx_explorer_campaign_window` ON `explorer_campaign` (`start_at`, `end_at`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;