#!/usr/bin/env bash
set -euo pipefail

OUTPUT_PATH="${1:-server/data/wmv_e2e_seed.sql}"
POSTGRES_USER_VALUE="${POSTGRES_USER:-wmv}"
POSTGRES_DB_VALUE="${WMV_E2E_DB_NAME:-wmv_e2e}"

TABLE_ARGS=(
  --table=participant
  --table=segment
  --table=season
  --table=week
  --table=activity
  --table=segment_effort
  --table=result
  --table=webhook_event
  --table=explorer_campaign
  --table=explorer_destination
  --table=explorer_destination_match
  --table=explorer_destination_pin
  --table=chain_wax_period
  --table=chain_wax_activity
  --table=chain_wax_puck
)

echo "[seed-export] Ensuring local Postgres container is running"
docker compose up -d postgres >/dev/null

echo "[seed-export] Exporting ${POSTGRES_DB_VALUE} to ${OUTPUT_PATH}"
docker compose exec -T postgres pg_dump \
  -U "$POSTGRES_USER_VALUE" \
  -d "$POSTGRES_DB_VALUE" \
  --data-only \
  --inserts \
  --column-inserts \
  --no-owner \
  --no-privileges \
  "${TABLE_ARGS[@]}" > "$OUTPUT_PATH"

# Scrub PII: replace real weight values with NULL in participant INSERT rows.
# Also strip pg_dump 18 \restrict/\unrestrict meta commands for plain SQL replay via node pg.
# Pattern matches the weight and weight_updated_at values at end of each participant row.
# Before: ..., 85.8196, '2026-02-15 20:02:43.808+00');
# After:  ..., NULL, NULL);
python3 - "$OUTPUT_PATH" <<'PY'
import re, sys
path = sys.argv[1]
with open(path) as f:
    sql = f.read()

sql = re.sub(r'^\\(?:restrict|unrestrict)\s.*\n?', '', sql, flags=re.MULTILINE)

# Match participant INSERT lines and null out the last two columns (weight, weight_updated_at).
# Column order is: strava_athlete_id, name, created_at, active, is_admin, weight, weight_updated_at
def scrub_weight(m):
    # Replace the last two comma-separated values before the closing ');' with NULL, NULL
    line = m.group(0)
    # Strip trailing ); then split on last two , values
    inner = line.rstrip(');').rstrip()
    parts = inner.rsplit(',', 2)  # split off last 2 values
    return parts[0] + ', NULL, NULL);'

sql = re.sub(
    r"INSERT INTO public\.participant \([^)]+\) VALUES \([^)]+\);",
    scrub_weight,
    sql
)

with open(path, 'w') as f:
    f.write(sql)
PY

echo "[seed-export] Postgres seed export complete"
