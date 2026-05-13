PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_season` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
INSERT INTO `__new_season` (`id`, `name`, `start_at`, `end_at`, `created_at`)
SELECT `id`, `name`, `start_at`, `end_at`, `created_at`
FROM `season`;
--> statement-breakpoint
DROP TABLE `season`;
--> statement-breakpoint
ALTER TABLE `__new_season` RENAME TO `season`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
