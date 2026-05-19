-- Add first-completer tracking columns to explorer_destination_match
ALTER TABLE "explorer_destination_match" ADD COLUMN "first_completer_athlete_id" text;--> statement-breakpoint
ALTER TABLE "explorer_destination_match" ADD COLUMN "first_completer_at" bigint;--> statement-breakpoint

-- Backfill first completer: for each (campaign, destination), mark the earliest match by matched_at as first completer
-- Use strava_athlete_id as tiebreaker for determinism
WITH earliest_per_destination AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY explorer_campaign_id, explorer_destination_id ORDER BY matched_at ASC, strava_athlete_id ASC) AS rn
  FROM "explorer_destination_match"
)
UPDATE "explorer_destination_match"
SET 
  first_completer_athlete_id = strava_athlete_id,
  first_completer_at = matched_at
WHERE id IN (SELECT id FROM earliest_per_destination WHERE rn = 1);--> statement-breakpoint

-- Add partial unique index to enforce one first completer per (campaign, destination)
CREATE UNIQUE INDEX "idx_explorer_first_completer_unique"
  ON "explorer_destination_match" (explorer_campaign_id, explorer_destination_id)
  WHERE first_completer_at IS NOT NULL;--> statement-breakpoint