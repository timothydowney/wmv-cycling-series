CREATE TABLE explorer_destination_pin (
	id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	explorer_campaign_id integer NOT NULL,
	explorer_destination_id integer NOT NULL,
	strava_athlete_id text NOT NULL,
	created_at text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (explorer_campaign_id) REFERENCES explorer_campaign(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (explorer_destination_id) REFERENCES explorer_destination(id) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (strava_athlete_id) REFERENCES participant(strava_athlete_id) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX idx_explorer_pin_campaign_athlete ON explorer_destination_pin (explorer_campaign_id, strava_athlete_id);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_explorer_pin_unique ON explorer_destination_pin (explorer_campaign_id, explorer_destination_id, strava_athlete_id);