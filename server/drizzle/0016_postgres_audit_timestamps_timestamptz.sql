ALTER TABLE "participant"
	ALTER COLUMN "created_at" TYPE timestamptz USING CASE
		WHEN btrim("created_at") = '' THEN NULL
		WHEN btrim("created_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("created_at")::timestamptz
		ELSE NULL
	END,
	ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "season"
	ALTER COLUMN "created_at" TYPE timestamptz USING CASE
		WHEN btrim("created_at") = '' THEN NULL
		WHEN btrim("created_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("created_at")::timestamptz
		ELSE NULL
	END,
	ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "segment"
	ALTER COLUMN "created_at" TYPE timestamptz USING CASE
		WHEN btrim("created_at") = '' THEN NULL
		WHEN btrim("created_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("created_at")::timestamptz
		ELSE NULL
	END,
	ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "week"
	ALTER COLUMN "created_at" TYPE timestamptz USING CASE
		WHEN btrim("created_at") = '' THEN NULL
		WHEN btrim("created_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("created_at")::timestamptz
		ELSE NULL
	END,
	ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "activity"
	ALTER COLUMN "created_at" TYPE timestamptz USING CASE
		WHEN btrim("created_at") = '' THEN NULL
		WHEN btrim("created_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("created_at")::timestamptz
		ELSE NULL
	END,
	ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "result"
	ALTER COLUMN "created_at" TYPE timestamptz USING CASE
		WHEN btrim("created_at") = '' THEN NULL
		WHEN btrim("created_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("created_at")::timestamptz
		ELSE NULL
	END,
	ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
	ALTER COLUMN "updated_at" TYPE timestamptz USING CASE
		WHEN btrim("updated_at") = '' THEN NULL
		WHEN btrim("updated_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("updated_at")::timestamptz
		ELSE NULL
	END,
	ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "participant_token"
	ALTER COLUMN "created_at" TYPE timestamptz USING CASE
		WHEN btrim("created_at") = '' THEN NULL
		WHEN btrim("created_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("created_at")::timestamptz
		ELSE NULL
	END,
	ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
	ALTER COLUMN "updated_at" TYPE timestamptz USING CASE
		WHEN btrim("updated_at") = '' THEN NULL
		WHEN btrim("updated_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("updated_at")::timestamptz
		ELSE NULL
	END,
	ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "webhook_event"
	ALTER COLUMN "created_at" TYPE timestamptz USING CASE
		WHEN btrim("created_at") = '' THEN NULL
		WHEN btrim("created_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("created_at")::timestamptz
		ELSE NULL
	END,
	ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

DROP INDEX IF EXISTS "idx_webhook_event_created";
CREATE INDEX "idx_webhook_event_created" ON "webhook_event" ("created_at");

ALTER TABLE "explorer_campaign"
	ALTER COLUMN "created_at" TYPE timestamptz USING CASE
		WHEN btrim("created_at") = '' THEN NULL
		WHEN btrim("created_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("created_at")::timestamptz
		ELSE NULL
	END,
	ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
	ALTER COLUMN "updated_at" TYPE timestamptz USING CASE
		WHEN btrim("updated_at") = '' THEN NULL
		WHEN btrim("updated_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("updated_at")::timestamptz
		ELSE NULL
	END,
	ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "explorer_destination"
	ALTER COLUMN "created_at" TYPE timestamptz USING CASE
		WHEN btrim("created_at") = '' THEN NULL
		WHEN btrim("created_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("created_at")::timestamptz
		ELSE NULL
	END,
	ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP,
	ALTER COLUMN "updated_at" TYPE timestamptz USING CASE
		WHEN btrim("updated_at") = '' THEN NULL
		WHEN btrim("updated_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("updated_at")::timestamptz
		ELSE NULL
	END,
	ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "explorer_destination_match"
	ALTER COLUMN "created_at" TYPE timestamptz USING CASE
		WHEN btrim("created_at") = '' THEN NULL
		WHEN btrim("created_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("created_at")::timestamptz
		ELSE NULL
	END,
	ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "explorer_destination_pin"
	ALTER COLUMN "created_at" TYPE timestamptz USING CASE
		WHEN btrim("created_at") = '' THEN NULL
		WHEN btrim("created_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("created_at")::timestamptz
		ELSE NULL
	END,
	ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
