# WMV Explorer Seasons Technical Specification

## 1. Purpose

This specification translates the Explorer Seasons PRD into an implementation-oriented design for the current WMV Cycling Series codebase. It preserves the key planning decisions:

- Explorer is a separate product area from the current race leaderboard.
- Explorer uses a season-first model rather than the current competition week model.
- Only one Explorer season may be active at a time.
- Explorer v1 is data-first and progress-first, with map and feed primitives stored now for later UX expansion.
- Explorer v1 launches with admin-curated destinations recognized through Strava segments, because segment identity is the only source WMV can later match back to athlete rides with deterministic confidence. The schema should still tolerate later destination-recognition modes such as place-based destinations created from city, state, and country visits.
- Webhook ingestion remains in-process and delegated through feature handlers so Explorer can coexist safely with competition and chain-wax processing.

## 2. Scope

### In Scope

- Separate Explorer season model
- Admin-defined Explorer destinations using the only v1 recognition input that guarantees later deterministic matching, which is Strava segment URLs or IDs
- Destination display-label override and markdown commentary
- Automatic completion tracking from ingested Strava activities
- Deletion or invalidation aware completion reversal
- Explorer participation opt-out, enabled by default
- Personal progress queries for the logged-in athlete
- Concise aggregate destination stats for the athlete-facing season view
- Archived Explorer season visibility
- Reusable refresh or backfill path
- Storage of map-capable location primitives for later use
- Lightweight future-facing grouping support such as route family
- A source-type-aware destination model so later place-based destinations do not require a schema reset

### Out of Scope For v1

- Interactive map UI as a launch requirement
- Place geocoding or address search implementation
- Auto-creating place destinations from activity geography
- Shared social feed across riders
- Weekly or holiday Explorer challenges inside a season
- Rank-ordered athlete leaderboard
- Bonus scoring, badges, or streak systems
- Multi-sport expansion beyond the existing cycling-first model

## 3. Current Codebase Constraints And Reusable Patterns

### Existing reusable assets

- Strava auth and participant identity already exist.
- Webhook ingestion already fetches and normalizes activity data in [server/src/webhooks/processor.ts](../../server/src/webhooks/processor.ts).
- Delegated activity handlers already exist in [server/src/webhooks/activityHandlers.ts](../../server/src/webhooks/activityHandlers.ts) and [server/src/webhooks/activityHandlerRunner.ts](../../server/src/webhooks/activityHandlerRunner.ts).
- Batch or explicit activity processing already exists in [server/src/services/BatchFetchService.ts](../../server/src/services/BatchFetchService.ts).
- The app already has markdown editing and display patterns in [src/components/NotesEditor.tsx](../../src/components/NotesEditor.tsx), [src/components/NotesDisplay.tsx](../../src/components/NotesDisplay.tsx), and [src/hooks/useMarkdownEditor.ts](../../src/hooks/useMarkdownEditor.ts).
- Admin segment URL input patterns already exist in [src/components/WeekManager.tsx](../../src/components/WeekManager.tsx) and related segment-management components.

### Constraints to respect

- Do not modify the canonical race scoring model in [docs/SCORING.md](../SCORING.md).
- Do not overload competition `season` and `week` records with Explorer semantics.
- Keep Explorer additive so existing leaderboard, season, and admin flows remain intact.
- The current userbase is small enough that v1 can prefer correctness and simplicity over aggressive caching.
- Do not treat raw Strava activity `location_city`, `location_state`, and `location_country` as a sufficiently trustworthy long-term place model by themselves.
- Keep the domain language destination-first even when the first recognition logic is segment-based.

## 4. Architecture Overview

### 4.1 Core approach

Explorer Seasons should use a dedicated Explorer data model and a shared matching service that can be called from both webhook-driven ingestion and explicit refresh flows. The domain object is a destination. Segments, activity geography, and any later geocoder enrichment are evidence sources used to decide whether a destination has been completed. In v1, the segment source is not just a convenient proxy; it is the recognition contract that makes later completion matching trustworthy.

The system should:

1. Receive a Strava activity create, update, or delete signal.
2. Build or load normalized activity context once.
3. Route that context through delegated in-process handlers.
4. Let the Explorer handler evaluate active Explorer season eligibility and destination matches.
5. Persist or reverse completion records idempotently.
6. Compute athlete-facing Explorer stats on read in v1.

### 4.2 Why compute on read first

The small userbase lowers the need for precomputed aggregates. For v1, runtime aggregation is the preferred default because it reduces schema and sync complexity.

Recommended v1 stance:

- Store the durable source of truth at the destination completion level.
- Compute athlete progress and destination popularity at query time.
- Add summary caches later only if real query cost or UX latency becomes visible.

## 5. Proposed Data Model

### 5.1 New entities

Recommended Explorer tables or equivalent schema concepts:

- ExplorerSeason
  - id
  - name
  - startAt
  - endAt
  - status such as draft, active, archived
  - createdAt
  - updatedAt

Activation rule: only one ExplorerSeason may be active at a time, and a season cannot move to active unless it has at least one destination.

- ExplorerDestination
  - id
  - explorerSeasonId
  - destinationType such as segment or place
  - creationMode such as admin_curated or auto_generated
  - status such as draft, active, archived
  - recognitionMode such as strava_segment, activity_place, or geocoded_place
  - sourceUrl nullable
  - cachedName
  - displayLabel nullable
  - commentaryMarkdown nullable
  - displayOrder
  - routeFamily nullable
  - surfaceType nullable such as virtual or outdoor
  - city nullable
  - state nullable
  - country nullable
  - latitude nullable
  - longitude nullable
  - boundingBox nullable
  - createdAt
  - updatedAt

- ExplorerDestinationSegmentSource
  - explorerDestinationId
  - stravaSegmentId
  - cachedSegmentName
  - startLatitude nullable
  - startLongitude nullable
  - endLatitude nullable
  - endLongitude nullable
  - polyline nullable
  - summaryPolyline nullable
  - lastSegmentSyncAt nullable

- ExplorerDestinationPlaceSource
  - explorerDestinationId
  - placeKey
  - city nullable
  - state nullable
  - country
  - matchStrategy such as activity_location, reverse_geocode, or admin_entered
  - canonicalLatitude nullable
  - canonicalLongitude nullable
  - geocoderProvider nullable
  - geocoderConfidence nullable
  - sourceActivityId nullable

- ExplorerDestinationCompletion
  - id
  - explorerSeasonId
  - explorerDestinationId
  - stravaAthleteId
  - qualifyingActivityId
  - activityStartAt
  - completionSourceSnapshot nullable
  - createdAt
  - updatedAt

- ParticipantPreference
  - existing participant model may be extended or a new preferences table may be introduced
  - explorerOptOut boolean default false
  - competitionOptOut boolean default false
  - updatedAt

### 5.2 Modeling stance for v1 versus later phases

Recommended stance:

- In v1, only create destinations whose recognition mode is `strava_segment` through the admin workflow.
- Keep shared destination presentation fields on ExplorerDestination.
- Keep source-specific fields in separate detail tables so future place destinations do not force null-heavy segment records.
- Treat `place` destinations as a later-phase expansion that may require admin review, geocoding, or both.
- Treat exact segment identity as the only v1 completion rule, even if destination presentation later emphasizes endpoint geography or place labels.

### 5.3 Recognition contract

Recommended contract:

- The admin chooses a destination the club should visit.
- In v1, the admin proves that destination through a Strava segment URL.
- WMV later recognizes completion only when that exact segment appears in activity segment-effort data.
- Rider-facing destination labels may emphasize a place or endpoint, but the stored recognition proof remains the segment source.

### 5.4 Completion provenance model

Explorer completion must be reversible when source activity data is deleted or invalidated.

Minimum required provenance:

- The completion row must identify the qualifying activity.
- The system must know which destination was satisfied by which activity.
- Reprocessing should be able to remove stale completions and restore valid ones deterministically.
- Source snapshots should be sufficient to explain later why a completion was created, especially once place-based matching exists.

This is enough to support later personal feed work without building the feed UI in v1.

### 5.5 Key integrity rules

- One athlete can complete a given destination at most once per Explorer season.
- Multiple rides over the same destination in the same season do not increase progress.
- Completion rows are constrained to the Explorer season date range.
- Opted-out riders must not receive new Explorer completion rows and must be excluded from Explorer stats.
- Closed or archived seasons remain queryable.
- A destination must have exactly one active source-detail record matching its destinationType.

## 6. Strava Data And Mapping Feasibility

### 6.1 What Strava gives us reliably for v1 destination recognition

Research indicates that mapping is feasible enough to preserve in the plan.

Relevant Strava segment data includes:

- `start_latlng`
- `end_latlng`
- `city`, `state`, `country`
- `map.polyline`
- `map.summary_polyline`
- segment streams with `latlng` data when needed

This is sufficient to:

- recognize curated destinations using segment efforts in activities
- place segment destinations on a map later
- draw destination paths later
- compute bounds later
- support text search by destination name or display label later

### 6.2 What Strava gives us less reliably for future destination recognition

Relevant Strava activity data may include:

- `location_city`
- `location_state`
- `location_country`

These fields are useful hints, but they should not become the sole canonical basis for auto-generated place destinations because they are less consistent than segment geography and may be null.

### 6.3 Known caveats

- Strava does not provide place geocoding. Address or place search requires an external geocoder.
- Virtual segments may have valid coordinates but still feel strange on a real-world map.
- Private segments may require broader scopes or different handling.
- Segment-based recognition is an imperfect proxy for “visited this destination,” but it is acceptable for v1.
- Future place destinations should likely use a normalized place key and optional geocoder enrichment rather than only raw activity strings.

### 6.4 Recognition confidence ladder for later phases

This is planning guidance only and should not change v1 behavior.

Recommended later recognition ladder:

- Highest confidence: exact segment ID match from activity segment efforts
- Medium confidence: matched segment endpoint or destination centroid within configured spatial tolerance
- Lower confidence: activity-derived place strings or geocoder-normalized place hits

V1 should only implement the highest-confidence tier.

### 6.5 Minimum fields to store now

Store the following in v1:

- destination city, state, and country when available
- destination centroid or representative latitude and longitude when available
- segment start latitude and longitude
- segment end latitude and longitude
- segment polyline or summary polyline

These fields support both v1 map readiness and a later endpoint-confidence matching experiment without requiring a schema rewrite.

This preserves map feasibility even if the first UI slice is not map-based.

## 7. Map Stack Recommendation

### 7.1 Recommended frontend stack

For this repo and its expected scale, the recommended managed option is Google Maps Platform.

Suggested default stack:

- Google Maps JavaScript API
- Google Geocoding API when place lookup is needed
- Google Places API only if destination or place search expands beyond simple geocoding

Why this is the current default recommendation:

- WMV already has Google billing enabled for Gemini, so the operational setup cost is lower than starting a separate provider relationship.
- At WMV's expected scale, Google should fit comfortably inside the free monthly thresholds for the core services most likely to matter.
- Google gives one coherent stack for map rendering, geocoding, quotas, billing, monitoring, and support.
- Google has fewer fair-use ambiguities than public OSM tile and Nominatim services.
- It is likely to be easier to ship and maintain than mixing community tile and geocoder services with stricter policy limits.

Relevant free thresholds from the current public pricing model:

- Dynamic Maps: 10,000 free monthly map loads
- Geocoding: 10,000 free monthly requests
- Autocomplete Requests: 10,000 free monthly requests
- 2D Map Tiles API: 100,000 free monthly billable events

For a club with fewer than 100 users, this is likely enough headroom unless the map becomes a heavily used landing page or autocomplete is called aggressively on every keystroke without controls.

### 7.2 Open fallback option

If WMV later prefers to avoid Google dependency or billing risk entirely, the fallback recommendation remains:

- Leaflet
- React-Leaflet
- OpenStreetMap-compatible tiles
- Nominatim or Photon for light geocoding needs

This remains viable for modest hobbyist traffic, but it carries stricter policy expectations around attribution, caching, request patterns, and provider swap readiness.

### 7.3 Recommended geocoding direction

Do not add geocoding in v1.

If map search by address or place is pursued later, the recommended default is:

- Google Geocoding API first if WMV wants the easiest managed path
- Google Places Autocomplete only if the UX genuinely benefits from search suggestions rather than a simpler submit-to-search flow
- Nominatim or Photon only if WMV decides to stay on an open-data stack and can comfortably live within policy limits

### 7.4 Provider strategy

Google Maps Platform is the default recommendation for now because it is likely to remain free at WMV scale while being easier to reason about operationally.

Public OSM tiles and Nominatim-style services remain attractive as a low-cost fallback, but they come with fair-use limits and no SLA. WMV can likely operate inside those limits if map usage remains modest, user-triggered, and well-cached. The implementation should still keep map-tile and geocoder providers configurable so WMV can swap providers without a front-end rewrite.

If Google is chosen, quotas and budget alerts should be configured early so accidental autocomplete or geocoding misuse cannot create surprise charges.

### 7.5 Backend implications

No dedicated backend map service is needed for v1. Backend responsibilities are limited to:

- extracting and storing Strava location primitives
- exposing destination geometry and labels through tRPC
- optionally proxying geocoding later if the app should avoid direct client geocoder calls
- leaving room for a later place-normalization service if auto-generated place destinations are introduced
- avoiding provider-specific database fields beyond storing normalized geometry, labels, and source metadata

## 8. Core Services

### 8.1 Explorer matching service

Responsibilities:

- Receive normalized activity data plus athlete context.
- Determine whether the athlete is opted into Explorer.
- Determine whether the activity timestamp falls inside the active Explorer season.
- Compare activity segment efforts to configured Explorer destinations whose recognition mode is `strava_segment`.
- Create missing completion rows idempotently.
- Reverse completion rows when activity delete or invalidation events require it.
- Return summary information about new or removed completions.

V1 rule: do not attempt endpoint-distance, place-string, or other fuzzy inference during matching.

This service is the core reusable unit for both webhook-driven ingestion and explicit refresh.

### 8.2 Explorer query service

Responsibilities:

- Get active Explorer season for UI.
- Get archived Explorer seasons.
- Get destination list for a given Explorer season.
- Get current athlete progress for that season.
- Compute the day-one aggregate stats set on read.
- Support hybrid destination presentation where the admin-authored display label is primary and segment endpoint or place context is secondary.
- Leave map rendering concerns to the frontend while exposing the needed primitives.

### 8.3 Explorer admin service

Responsibilities:

- Create and update Explorer seasons.
- Enforce one-active-season rules.
- Add, edit, remove, and reorder destinations.
- Validate destination URLs and fetch source metadata from Strava for v1 segment-based destination recognition.
- Store destination commentary markdown.
- Trigger refresh or backfill actions.
- Prepare later cloning and replication logic without implementing it in v1.
- Leave room for a later admin review path for auto-generated place destinations.
- Preserve cached destination metadata even if a source segment later becomes unavailable.
- Mark destinations unavailable for new matches when the source segment can no longer support v1 recognition.

### 8.4 Future place normalization service

This service is not required for v1, but the design should reserve space for it.

Likely responsibilities later:

- Normalize city, state, and country combinations into a stable place key.
- Enrich candidate places with optional geocoder coordinates.
- Prevent duplicate auto-generated place destinations inside a season.
- Route new place candidates into automatic creation, draft creation, or admin approval depending on product choice.

## 9. Ingestion And Lifecycle Model

### 9.1 Activity create or update

Recommended flow:

1. Receive webhook event.
2. Build shared activity-ingestion context.
3. Run chain-wax handler.
4. Run competition handler.
5. Run Explorer handler.
6. Explorer handler loads active Explorer season if one exists.
7. Explorer handler skips opted-out athletes.
8. Explorer matching service finds qualifying destinations using the active recognition modes.
9. Completion rows are inserted or updated idempotently.

For v1, step 8 means exact segment identity matching only.

### 9.2 Activity delete or invalidation

Explorer must not ignore delete semantics.

Recommended flow:

1. Receive delete or invalidation signal.
2. Identify completion rows tied to the activity.
3. Remove or recompute affected completions.
4. Leave final aggregate values to runtime queries.

### 9.3 Refresh or backfill

Recommended direction:

- Extract Explorer matching into a reusable service.
- Call that service from the Explorer webhook handler.
- Call that same service from an admin-triggered refresh action.

## 10. API Surface

Recommended new tRPC surface areas:

- explorer.getActiveSeason
- explorer.getArchivedSeasons
- explorer.getSeasonView
- explorer.getSeasonDestinations
- explorer.getMySeasonProgress
- explorerAdmin.createSeason
- explorerAdmin.updateSeason
- explorerAdmin.activateSeason
- explorerAdmin.archiveSeason
- explorerAdmin.addSegmentDestination
- explorerAdmin.updateDestination
- explorerAdmin.removeDestination
- explorerAdmin.reorderDestinations
- explorerAdmin.refreshSeason
- preferences.updateExplorerParticipation

These names are illustrative and should align with existing router conventions.

## 11. UI Surface

### 11.1 User-facing Explorer v1

Recommended initial athlete-facing sections:

- Explorer route or tab
- Active Explorer season header
- Personal progress summary
- Destination collection or checklist
- Concise aggregate stats strip or card section
- Archived seasons list or index

Hybrid presentation guidance:

- primary text should be the admin-authored display label when present, otherwise the cached segment name
- secondary text or map context can use endpoint-oriented place details such as city, state, country, or other stored location cues
- this presentation choice must not change the underlying exact segment-recognition rule used for completion

### 11.2 Deferred user-facing sections

- Interactive map view
- Map search box
- Personal Explorer activity feed
- Shared social feed

### 11.3 Admin surface

Recommended initial admin capabilities:

- Create Explorer season with date range
- Add one destination at a time by pasting a Strava URL
- Edit display label and route-family grouping
- Edit destination commentary in markdown
- Reorder destinations
- Prevent activation until at least one destination exists
- Preserve a clean path to later review or approve auto-generated place destinations
- Support the same hybrid presentation model in admin previews that riders will later see

## 12. Testing Strategy

Recommended coverage areas:

- Schema constraints around one-active-season and one-completion-per-destination-per-athlete-per-season
- Matching correctness for activity create, update, delete, and refresh flows
- Opt-out enforcement for webhook and refresh paths
- Admin destination ingestion and metadata persistence
- Query-layer aggregation for day-one stats
- Regression protection for coexistence with competition and chain-wax handlers
- Future schema tests ensuring destinationType, recognitionMode, and source-detail tables remain consistent

## 13. Recommended Delivery Sequence

1. Land the dedicated Explorer schema with a source-type-aware destination core.
2. Implement v1 destination ingestion and matching using only the `strava_segment` recognition mode.
3. Ship admin authoring and athlete progress views.
4. Measure whether compute-on-read remains sufficient.
5. Add map UI and later place-destination or endpoint-confidence flows only after the exact-match v1 model proves stable.
- Run refresh for a season

## 12. Runtime Versus Cached Computation

### 12.1 Recommended v1 choice

Compute on read by default.

Rationale:

- the userbase is small
- the stat set is modest
- it reduces invalidation complexity
- delete-aware completion logic is easier when summaries are not cached

### 12.2 What can be cached later if needed

- season-wide popularity rankings
- per-athlete completion summaries
- archive cards or comparison summaries
- feed-ready activity summary expansions

## 13. Testing Strategy

### Backend

Add tests for:

- one-active-season enforcement
- Explorer season boundary handling
- destination completion idempotency
- duplicate segment visits in one season
- multiple destinations in one activity
- virtual and outdoor segment parity
- Strava URL parsing and validation
- activity delete or invalidation completion reversal
- Explorer opt-out behavior
- refresh and webhook parity using the same matching service
- map primitive extraction from Strava segment responses
- regression protection for current competition webhook behavior
- regression protection for current chain-wax create and delete webhook behavior

### Frontend

Add tests for:

- Explorer route navigation
- active Explorer season rendering
- personal progress summary state
- concise stats rendering
- archived season access
- profile opt-out controls
- admin destination commentary editing

## 14. Recommended Sequence

The implementation should follow this order:

1. Schema and preference groundwork.
2. Explorer matching and reversal logic.
3. Admin season and destination management.
4. Athlete-facing data-first season view.
5. Deferred map and feed UX once the season primitives prove out.