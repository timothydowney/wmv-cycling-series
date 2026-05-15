-- Normalize legacy date/time storage to timestamptz for all schema timestamp columns.
-- This handles prior bootstrap/import drift where values landed as bigint Unix seconds or text.

DO $$
DECLARE
	target record;
	current_type text;
BEGIN
	FOR target IN
		SELECT *
		FROM (
			VALUES
				('participant', 'created_at', true),
				('participant', 'weight_updated_at', false),
				('season', 'created_at', true),
				('week', 'created_at', true),
				('activity', 'validated_at', true),
				('activity', 'created_at', true),
				('result', 'created_at', true),
				('result', 'updated_at', true),
				('participant_token', 'created_at', true),
				('participant_token', 'updated_at', true),
				('deletion_request', 'requested_at', false),
				('deletion_request', 'completed_at', false),
				('schema_migrations', 'executed_at', true),
				('segment', 'created_at', true),
				('segment', 'metadata_updated_at', false),
				('webhook_event', 'created_at', true),
				('webhook_subscription', 'last_refreshed_at', false),
				('explorer_campaign', 'created_at', true),
				('explorer_campaign', 'updated_at', true),
				('explorer_destination', 'created_at', true),
				('explorer_destination', 'updated_at', true),
				('explorer_destination_match', 'created_at', true),
				('explorer_destination_pin', 'created_at', true),
				('chain_wax_period', 'created_at', true),
				('chain_wax_activity', 'created_at', true),
				('chain_wax_puck', 'created_at', true)
		) AS t(table_name, column_name, set_default_now)
	LOOP
		SELECT c.data_type
			INTO current_type
		FROM information_schema.columns c
		WHERE c.table_schema = 'public'
			AND c.table_name = target.table_name
			AND c.column_name = target.column_name;

		IF current_type IS NULL THEN
			CONTINUE;
		END IF;

		IF current_type IN ('bigint', 'integer') THEN
			EXECUTE format(
				'ALTER TABLE %I.%I ALTER COLUMN %I TYPE timestamptz USING to_timestamp(%I::double precision)',
				'public',
				target.table_name,
				target.column_name,
				target.column_name
			);
		ELSIF current_type = 'text' THEN
			EXECUTE format(
				'ALTER TABLE %I.%I ALTER COLUMN %I TYPE timestamptz USING CASE ' ||
				'WHEN NULLIF(%I, '''') IS NULL THEN NULL ' ||
				'WHEN NULLIF(%I, '''') ~ ''^[0-9]+(\.[0-9]*)?$'' THEN to_timestamp(NULLIF(%I, '''')::double precision) ' ||
				'WHEN NULLIF(%I, '''') ~ ''(Z|[+-][0-9]{2}(:?[0-9]{2})?)$'' THEN NULLIF(%I, '''')::timestamptz ' ||
				'ELSE (NULLIF(%I, '''')::timestamp AT TIME ZONE ''UTC'') END',
				'public',
				target.table_name,
				target.column_name,
				target.column_name,
				target.column_name,
				target.column_name,
				target.column_name,
				target.column_name,
				target.column_name
			);
		ELSIF current_type = 'timestamp without time zone' THEN
			EXECUTE format(
				'ALTER TABLE %I.%I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
				'public',
				target.table_name,
				target.column_name,
				target.column_name
			);
		END IF;

		IF target.set_default_now THEN
			EXECUTE format(
				'ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT now()',
				'public',
				target.table_name,
				target.column_name
			);
		END IF;
	END LOOP;
END
$$;
