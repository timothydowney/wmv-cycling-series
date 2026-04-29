-- chain_wax_period.created_at was stored as Unix seconds (bigint).
-- Convert to timestamptz using to_timestamp(), then add a DB default so
-- future inserts no longer need to supply an explicit value.
ALTER TABLE "chain_wax_period"
	ALTER COLUMN "created_at" TYPE timestamptz USING to_timestamp("created_at"),
	ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- chain_wax_activity.created_at same conversion.
ALTER TABLE "chain_wax_activity"
	ALTER COLUMN "created_at" TYPE timestamptz USING to_timestamp("created_at"),
	ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- chain_wax_puck.created_at same conversion.
ALTER TABLE "chain_wax_puck"
	ALTER COLUMN "created_at" TYPE timestamptz USING to_timestamp("created_at"),
	ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
