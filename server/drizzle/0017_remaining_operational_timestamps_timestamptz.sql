ALTER TABLE "participant"
	ALTER COLUMN "weight_updated_at" TYPE timestamptz USING CASE
		WHEN "weight_updated_at" IS NULL THEN NULL
		WHEN btrim("weight_updated_at") = '' THEN NULL
		WHEN btrim("weight_updated_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("weight_updated_at")::timestamptz
		ELSE NULL
	END;

ALTER TABLE "activity"
	ALTER COLUMN "validated_at" TYPE timestamptz USING CASE
		WHEN "validated_at" IS NULL THEN NULL
		WHEN btrim("validated_at") = '' THEN NULL
		WHEN btrim("validated_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("validated_at")::timestamptz
		ELSE NULL
	END,
	ALTER COLUMN "validated_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "segment"
	ALTER COLUMN "metadata_updated_at" TYPE timestamptz USING CASE
		WHEN "metadata_updated_at" IS NULL THEN NULL
		WHEN btrim("metadata_updated_at") = '' THEN NULL
		WHEN btrim("metadata_updated_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("metadata_updated_at")::timestamptz
		ELSE NULL
	END;

ALTER TABLE "webhook_subscription"
	ALTER COLUMN "last_refreshed_at" TYPE timestamptz USING CASE
		WHEN "last_refreshed_at" IS NULL THEN NULL
		WHEN btrim("last_refreshed_at") = '' THEN NULL
		WHEN btrim("last_refreshed_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("last_refreshed_at")::timestamptz
		ELSE NULL
	END;

ALTER TABLE "deletion_request"
	ALTER COLUMN "requested_at" TYPE timestamptz USING COALESCE(
		CASE
			WHEN btrim("requested_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("requested_at")::timestamptz
			ELSE NULL
		END,
		CURRENT_TIMESTAMP
	),
	ALTER COLUMN "completed_at" TYPE timestamptz USING CASE
		WHEN "completed_at" IS NULL THEN NULL
		WHEN btrim("completed_at") = '' THEN NULL
		WHEN btrim("completed_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("completed_at")::timestamptz
		ELSE NULL
	END;

ALTER TABLE "schema_migrations"
	ALTER COLUMN "executed_at" TYPE timestamptz USING CASE
		WHEN "executed_at" IS NULL THEN NULL
		WHEN btrim("executed_at") = '' THEN NULL
		WHEN btrim("executed_at") ~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}(:?\d{2})?)?$' THEN btrim("executed_at")::timestamptz
		ELSE NULL
	END,
	ALTER COLUMN "executed_at" SET DEFAULT CURRENT_TIMESTAMP;
