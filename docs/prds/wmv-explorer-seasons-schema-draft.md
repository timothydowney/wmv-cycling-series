# WMV Explorer Seasons Schema Draft

This document turns the Explorer Seasons technical direction into a concrete draft schema shape for discussion. It is intentionally conservative: v1 still launches with admin-curated destinations recognized through Strava segments, but the schema leaves room for later place-based destinations without forcing a destructive migration.

## 1. Modeling Goals

- Keep Explorer separate from competition seasons and weeks.
- Preserve one active Explorer season at a time.
- Make destination presentation fields reusable across destination types.
- Keep recognition-source-specific data in separate detail tables.
- Support idempotent completion creation and safe reversal on delete or invalidation.
- Bias toward simple reads and writes suitable for the current small WMV userbase.
- Preserve enough segment endpoint and geometry data to support later confidence-based destination matching without weakening the exact-match v1 rule.

## 2. Core Tables

### explorer_season

Purpose: top-level campaign container.

Suggested fields:

- id
- name
- start_at
- end_at
- status
- created_at
- updated_at

Suggested constraints:

- status limited to draft, active, archived
- activation blocked unless at least one active destination exists
- application-level enforcement that only one season may be active at a time

### explorer_destination

Purpose: shared destination record used by UI, stats, and completion logic.

Suggested fields:

- id
- explorer_season_id
- destination_type
- creation_mode
- status
- recognition_mode
- source_url
- cached_name
- display_label
- commentary_markdown
- display_order
- route_family
- surface_type
- city
- state
- country
- latitude
- longitude
- bounding_box_json
- created_at
- updated_at

Suggested enums:

- destination_type: segment, place
- creation_mode: admin_curated, auto_generated
- status: draft, active, archived

Notes:

- `cached_name` stores a stable source-derived label even if the admin never overrides it.
- `display_label` is the admin-facing storytelling name shown in the UI when present.
- `latitude` and `longitude` represent a map-friendly centroid or representative point.
- `city`, `state`, and `country` belong on the shared table because both segment and place destinations can expose them to the UI.
- `recognition_mode` describes how WMV currently knows a destination was completed. Suggested values are `strava_segment`, `activity_place`, and `geocoded_place`.
- In v1, `recognition_mode` should always be `strava_segment` for newly created destinations.

### explorer_destination_completion

Purpose: source of truth for athlete progress.

Suggested fields:

- id
- explorer_season_id
- explorer_destination_id
- strava_athlete_id
- qualifying_activity_id
- activity_start_at
- completion_source_snapshot_json
- created_at
- updated_at

Suggested constraints:

- unique on explorer_destination_id plus strava_athlete_id
- foreign keys to season and destination

Notes:

- `completion_source_snapshot_json` can remain lightweight in v1 and expand later if place matching needs extra provenance.
- Keeping `explorer_season_id` on the completion table simplifies direct season queries and defensive integrity checks.

### participant_preference or participant extension

Purpose: stores feature participation controls.

Suggested fields:

- participant_id
- explorer_opt_out
- competition_opt_out
- updated_at

Notes:

- Explorer should default to opt-in, which means `explorer_opt_out` defaults to false.

## 3. Source Detail Tables

### explorer_destination_segment_source

Purpose: segment-specific recognition data used for matching and map display.

Suggested fields:

- explorer_destination_id
- strava_segment_id
- cached_segment_name
- start_latitude
- start_longitude
- end_latitude
- end_longitude
- polyline
- summary_polyline
- last_segment_sync_at

Suggested constraints:

- unique on strava_segment_id within a season, if duplicate segments in the same season are not allowed
- one-to-one with explorer_destination

Notes:

- This table is the only one needed for v1 destination creation.
- If a reusable shared segment cache appears later, this table can point at that cache instead of storing every field directly.
- If the source segment later disappears or becomes inaccessible, the destination should remain durable through cached fields on ExplorerDestination and this source row, even if new matches are disabled.

### explorer_destination_place_source

Purpose: future place-based recognition details.

Suggested fields:

- explorer_destination_id
- place_key
- city
- state
- country
- match_strategy
- canonical_latitude
- canonical_longitude
- geocoder_provider
- geocoder_confidence
- source_activity_id

Suggested enums:

- match_strategy: activity_location, reverse_geocode, admin_entered

Suggested constraints:

- unique on place_key within explorer_season_id via join or denormalized enforcement
- one-to-one with explorer_destination

Notes:

- `place_key` should be a normalized, deterministic representation of the location, for example a lowercased city plus state plus country tuple.
- This table should not be used in v1 writes, but the shape should exist now so future place destinations fit the same ExplorerDestination and ExplorerDestinationCompletion model.
- Raw Strava activity location strings alone are probably too weak for final matching, so the later implementation should allow optional geocoder enrichment or admin correction.

## 3.1 Future endpoint-confidence note

If WMV later experiments with destination matching beyond exact segment identity, the first likely extension is endpoint-confidence matching. That would compare a destination centroid or endpoint coordinate to a segment endpoint using a configured tolerance radius.

This should remain a later recognition mode rather than a modification of the `strava_segment` rule, so v1 data and rider expectations stay deterministic.

## 4. Relationship Summary

- One explorer_season has many explorer_destination rows.
- One explorer_destination has zero or one explorer_destination_segment_source row.
- One explorer_destination has zero or one explorer_destination_place_source row.
- One explorer_destination has many explorer_destination_completion rows.
- One participant has one preference record or one preference extension row.

Invariant:

- Each destination must have exactly one source detail row matching its destination_type.
- Each destination should also have a recognition_mode consistent with its active source detail row.

## 5. Integrity Rules

Recommended database or service-level rules:

- A rider can complete a destination only once per season.
- A completion must reference a destination in the same season.
- Opted-out riders must not receive new completion rows.
- Only active destinations should count toward athlete-facing progress.
- Activity delete or invalidation events must be able to remove completions by qualifying_activity_id.
- Auto-generated place destinations, if introduced later, should not bypass season or status rules.
- Confidence-based coordinate matching, if introduced later, should be reviewable or at least audit-visible until it proves trustworthy.

## 6. Query Shape Guidance

This schema is intended to support compute-on-read queries in v1.

Common reads:

- active season plus ordered destinations
- logged-in athlete completion state for a season
- per-destination completion counts for aggregate stats
- archived seasons list

Common writes:

- create or update season
- add curated destination using segment recognition in v1
- create or delete completion rows during matching or reversal
- toggle explorer participation preference

## 7. Why This Shape Fits WMV

- It keeps the v1 implementation simple because only the segment recognition path is active at launch.
- It avoids null-heavy single-table designs where segment and place-specific fields pile into one record.
- It leaves map and geocoder providers swappable because the schema stores normalized destination geometry rather than binding to one provider contract.
- It makes future auto-generated city, state, and country destinations a product decision rather than a schema rewrite.
- It leaves room for later endpoint-confidence matching without weakening the deterministic exact-match rule used at launch.
