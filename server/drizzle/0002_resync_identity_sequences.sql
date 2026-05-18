-- Ensure identity/serial-backed id sequences match imported data.
-- This is safe to run multiple times and fixes drift after data imports that insert explicit ids.

DO $$
DECLARE
	target record;
	sequence_name text;
	max_id bigint;
BEGIN
	FOR target IN
		SELECT c.table_name
		FROM information_schema.columns c
		WHERE c.table_schema = 'public'
			AND c.column_name = 'id'
			AND (c.is_identity = 'YES' OR c.column_default LIKE 'nextval(%')
	LOOP
		SELECT pg_get_serial_sequence(format('%I.%I', 'public', target.table_name), 'id')
			INTO sequence_name;

		IF sequence_name IS NULL THEN
			CONTINUE;
		END IF;

		EXECUTE format('SELECT MAX(id)::bigint FROM %I.%I', 'public', target.table_name)
			INTO max_id;

		IF max_id IS NULL THEN
			PERFORM setval(sequence_name, 1, false);
		ELSE
			PERFORM setval(sequence_name, max_id, true);
		END IF;
	END LOOP;
END
$$;
