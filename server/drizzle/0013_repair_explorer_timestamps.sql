UPDATE `explorer_campaign`
SET
  `created_at` = CASE
    WHEN `updated_at` IS NOT NULL AND `updated_at` != 'sql`(CURRENT_TIMESTAMP)`' THEN `updated_at`
    ELSE CURRENT_TIMESTAMP
  END
WHERE `created_at` = 'sql`(CURRENT_TIMESTAMP)`';
--> statement-breakpoint
UPDATE `explorer_campaign`
SET `updated_at` = CURRENT_TIMESTAMP
WHERE `updated_at` = 'sql`(CURRENT_TIMESTAMP)`';
--> statement-breakpoint
UPDATE `explorer_destination`
SET
  `created_at` = CASE
    WHEN `updated_at` IS NOT NULL AND `updated_at` != 'sql`(CURRENT_TIMESTAMP)`' THEN `updated_at`
    ELSE CURRENT_TIMESTAMP
  END
WHERE `created_at` = 'sql`(CURRENT_TIMESTAMP)`';
--> statement-breakpoint
UPDATE `explorer_destination`
SET `updated_at` = CURRENT_TIMESTAMP
WHERE `updated_at` = 'sql`(CURRENT_TIMESTAMP)`';
--> statement-breakpoint
UPDATE `explorer_destination_match`
SET `created_at` = CURRENT_TIMESTAMP
WHERE `created_at` = 'sql`(CURRENT_TIMESTAMP)`';