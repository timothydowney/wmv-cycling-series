ALTER TABLE "explorer_destination" ADD COLUMN "completion_count" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "explorer_destination_match" ADD COLUMN "is_first_completer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "explorer_destination_match" ADD COLUMN "first_completer_athlete_id" text;--> statement-breakpoint
ALTER TABLE "explorer_destination_match" ADD COLUMN "first_completer_athlete_name" text;--> statement-breakpoint
ALTER TABLE "explorer_destination_match" ADD COLUMN "first_completer_at" bigint;