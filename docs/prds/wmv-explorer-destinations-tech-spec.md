# WMV Explorer Destinations Technical Specification

## 1. Purpose

This specification translates the Explorer Destinations PRD into an implementation-oriented design for the current WMV Cycling Series codebase. It preserves the key planning decisions:

- Explorer is a separate product area from the current race leaderboard.
- Explorer uses separate week and result storage rather than reusing the current competition week model.
- Weekly UX is progress bar plus checklist plus completers summary.
- Strava segments are the canonical destination type, regardless of whether they represent outdoor or virtual riding.
- Webhook ingestion remains in-process but is refactored into delegated handlers so Explorer can be added without further overloading the current webhook processor.

## 2. Scope

### In Scope

- Separate Explorer week model
- Admin-defined Explorer destinations from Strava segment URLs or IDs
- Explorer matching from ingested Strava activities
- One completion per destination per athlete per Explorer week
- Weekly athlete progress queries
- Weekly completers summary queries with all completer names
- Stored Explorer history across weeks
- Reusable refresh or backfill path
- Explorer week activation rule requiring at least one destination

### Out of Scope

- Explorer rank-order leaderboard
- Bonus scoring beyond one point per destination
- Season-wide Explorer UI
- Shared-segment mini-races
- Badge systems
- Queue-backed or out-of-process worker model

## 3. Current-Codebase Constraints

### Existing reusable assets

- Strava auth and participant identity already exist.
- Webhook ingestion already fetches and normalizes activity data in [server/src/webhooks/processor.ts](../../server/src/webhooks/processor.ts).
- Batch or explicit activity processing already exists in [server/src/services/BatchFetchService.ts](../../server/src/services/BatchFetchService.ts).
- The existing shared `segment` table already persists Strava segment metadata such as name, distance, grade, elevation, and location, and Competition already joins against it for read paths.
- The current admin segment-validation flow already centralizes Strava segment fetch and persistence in [server/src/services/SegmentService.ts](../../server/src/services/SegmentService.ts).
- App routing and top-level navigation patterns already exist in [src/App.tsx](../../src/App.tsx) and [src/components/NavBar.tsx](../../src/components/NavBar.tsx).
- The regular admin panel already has a Strava URL input pattern worth mirroring for Explorer destination setup rather than exposing raw segment IDs only.

### Existing constraints to respect

- Do not modify the canonical race scoring model in [docs/SCORING.md](../SCORING.md).
- Do not overload current competition week records with Explorer semantics.
- Keep Explorer additive so existing leaderboard, season, and admin flows remain intact.

## 4. Recommended Architecture

### 4.1 Ingestion model

Refactor webhook processing into a thin orchestrator that performs the following steps:

1. Receive Strava webhook event.
2. Fetch or normalize the relevant activity data once.
3. Build a shared activity-ingestion context.
4. Pass that context to registered in-process handlers.
5. Let each handler decide whether and how to persist feature-specific records.

Recommended initial handlers:

- Chain wax tracker
- Competition week matcher
- Explorer destination matcher

Phase 1 should land this seam with the existing competition and chain wax handlers first. The Explorer destination handler belongs to Phase 2, after the data model and matching rules are finalized.

This keeps feature fan-out inside the app boundary while avoiding a new worker or CLI-per-event process model.

Phase 1 implementation detail:

- The current delegated activity pipeline uses a shared activity-ingestion context plus sequential in-process handlers.
- Chain wax runs before competition so tracked VirtualRide events are recorded even when no competition-ready segment efforts ever arrive.
- Activity delete and athlete deauthorization remain adjacent to the processor in Phase 1 rather than being forced into the same activity-handler abstraction.

### 4.2 Refresh or backfill model

Explorer also needs an explicit refresh path for late joins, recovery, and admin operations. That path should reuse the same underlying Explorer matching service used by the webhook handler rather than re-implementing the logic in a separate batch-only flow.

Recommended direction:

- Extract Explorer matching into a reusable service.
- Call that service from the Explorer ingestion handler.
- Call that same service from an admin or participant-triggered refresh action.

### 4.3 Shared segment-based matching seam

The repository already has partially reusable building blocks for segment-based activity handling:

- activity-window and lap-window selection in [server/src/activityProcessor.ts](../../server/src/activityProcessor.ts)
- activity and effort persistence in [server/src/activityStorage.ts](../../server/src/activityStorage.ts)
- webhook competition handling in [server/src/webhooks/handlers/competitionActivityHandler.ts](../../server/src/webhooks/handlers/competitionActivityHandler.ts)
- batch refresh handling in [server/src/services/BatchFetchService.ts](../../server/src/services/BatchFetchService.ts)
- late metric hydration in [server/src/services/HydrationService.ts](../../server/src/services/HydrationService.ts)

Explorer should not introduce a second copy of this segment-based matching flow. The first Phase 2 implementation slice should extract a narrow shared seam around segment-based qualifying activity selection and persistence where that reduces duplication between Competition and Explorer. That extraction should stay bounded:

- preserve current Competition behavior and results
- avoid reworking unrelated read/query services
- avoid broad refactors of activity deletion or hydration unless directly needed by the shared seam
- treat this as a structural sub-slice inside Phase 2 rather than a new standalone phase

## 5. Proposed Data Model

### 5.1 New entities

Recommended Explorer tables or equivalent schema concepts:

- ExplorerWeek
  - id
  - name
  - startAt
  - endAt
  - status or active flag
  - createdAt
  - updatedAt

Activation rule: an ExplorerWeek cannot move to an active state unless it has at least one ExplorerDestination.

- ExplorerDestination
  - id
  - explorerWeekId
  - stravaSegmentId
  - sourceUrl nullable
  - cachedSegmentName
  - displayLabel nullable
  - displayOrder
  - surfaceType nullable such as virtual or outdoor
  - category nullable such as scenic, event, climb
  - createdAt
  - updatedAt

- ExplorerDestinationMatch
  - id
  - explorerWeekId
  - explorerDestinationId
  - stravaAthleteId
  - stravaActivityId
  - matchedAt or activityStartAt
  - createdAt

- ExplorerAthleteWeekSummary
  - optional derived or cached summary table if needed later
  - explorerWeekId
  - stravaAthleteId
  - matchedDestinationCount
  - completedAll boolean
  - lastMatchedAt

For v1, ExplorerAthleteWeekSummary is computed on read. `ExplorerDestinationMatch` is the durable source of truth. Cached summary storage is deferred unless measured query cost justifies it in a later phase.

### 5.2 Key integrity rules

- One athlete can match a given destination at most once per Explorer week.
- Multiple rides over the same destination in the same Explorer week do not increase progress.
- Matches are constrained to the Explorer week date range.
- Explorer records must survive after the week ends so future season views can aggregate them.

### 5.3 Segment source model

Explorer uses a hybrid destination metadata strategy for v1. Admin setup should continue to accept Strava segment URLs, extract the segment ID, and store the parsed segment ID plus the original source URL when available. If the segment already exists in the app's shared `segment` table, Explorer should reuse that canonical data first rather than requiring an immediate Strava refetch. Explorer should also store Explorer-local cached display metadata needed for stable admin setup and week rendering, including cases where the segment is not already present in the shared segment table.

Segment metadata should be treated as comparatively durable. For Explorer v1, the preferred policy is database-first reuse of the shared `segment` table, optional refresh on explicit admin validation or metadata-refresh actions, and optional short-lived in-memory caching inside a running server process to avoid repeated fetches during the same setup workflow. This policy should not be applied blindly to activity details or segment efforts, because activity visibility, photos, and effort availability can change shortly after upload.

### 5.4 V1 decision lock

- Summary model: computed on read
- Destination metadata strategy: hybrid shared-segment reuse plus Explorer-local cached display metadata
- These decisions close the planning blockers for narrow Phase 2 Slice A

## 6. Core Services

### 6.1 Explorer matching service

Responsibilities:

- Receive normalized activity data plus athlete context.
- Determine which Explorer weeks are active for the activity timestamp.
- For each relevant Explorer week, compare activity segment efforts to configured Explorer destination segment IDs.
- Create missing ExplorerDestinationMatch records idempotently.
- Return summary information about newly matched destinations.

This service is the core reusable unit for both webhook-driven ingestion and explicit refresh.

### 6.2 Explorer query service

Responsibilities:

- Get active Explorer week for UI.
- Get destination list for a given Explorer week.
- Get current athlete progress for that week.
- Get completers summary for that week, including all completer names.
- Leave athlete profile aggregation out of the first implementation slice.

### 6.3 Explorer admin service

Responsibilities:

- Create and update Explorer weeks.
- Add, edit, remove, and reorder Explorer destinations.
- Validate or enrich destination metadata from Strava where possible.
- Trigger refresh or backfill actions.

## 7. API Surface

Recommended new tRPC surface areas:

- explorer.getActiveWeek
- explorer.getWeekProgress
- explorer.getWeekCompleters
- explorerAdmin.createWeek
- explorerAdmin.updateWeek
- explorerAdmin.addDestination
- explorerAdmin.updateDestination
- explorerAdmin.removeDestination
- explorerAdmin.reorderDestinations
- explorerAdmin.refreshWeek
- explorerAdmin.refreshAthlete

These names are illustrative. Final naming should fit existing router conventions.

## 8. UI Surface

### 8.1 User-facing hub

Recommended user-facing sections:

- Challenges hub route
- Active Explorer week header
- Progress bar
- Destination checklist
- Completers summary

### 8.2 Admin surface

Recommended initial admin capabilities:

- Create Explorer week with date range
- Add one destination at a time by pasting a Strava segment URL and parsing the segment ID
- Edit destination display label and ordering
- Prevent activation until at least one destination exists
- Run refresh for a week or athlete

## 9. Matching Rules

### V1 rules

- A destination is a Strava segment configured on an Explorer week.
- A destination counts when the athlete has a qualifying activity containing that segment during the Explorer week.
- Each destination is worth one point internally.
- The athlete's visible progress is completed destinations divided by total destinations.
- Repeated visits do not add progress beyond the first match.
- Virtual and outdoor segments are treated equally if configured.

### Open implementation decisions for later phases, not blockers for v1

- Whether to display segment source labels like virtual or outdoor in the checklist
- Whether a deleted activity should remove an Explorer match if it was the only source of completion
- Whether to compute historical rollups on read or cache them incrementally

## 10. Testing Strategy

### Backend

Add tests for:

- Explorer week boundary handling
- Destination match idempotency
- Duplicate segment visits in one week
- Multiple destinations in one activity
- Virtual and outdoor segment parity
- Strava URL parsing and validation
- Refresh and webhook parity using the same matching service
- Regression protection for current competition webhook behavior
- Regression protection for current chain wax create and delete webhook behavior

### Frontend

Add tests for:

- Challenges hub navigation
- Active Explorer week rendering
- Progress bar state
- Checklist completion state
- Completers summary rendering
- Empty states for no active week or no progress yet

### End-to-end

Recommended E2E journeys:

- Admin creates Explorer week and destinations
- Explorer week cannot activate until at least one destination exists
- Athlete views active Explorer week
- Athlete completes one destination and sees progress update
- Athlete completes full weekly set and sees completion state
- Completers summary reflects at least one full completer

Explorer E2E journeys should provision Explorer week and destination data intentionally during test setup or controlled fixtures, and must not rely on accidental shared state.

## 11. Migration and Rollout Sequence

1. Refactor webhook processor toward delegated handlers without changing current competition behavior.
2. Add Explorer schema and backend services.
3. Implement Explorer matching handler and shared refresh path.
4. Add Explorer tRPC routes.
5. Add admin Explorer setup UI.
6. Add Challenges hub UI with progress bar, checklist, and completers summary.
7. Run regression checks on race and admin flows.
8. If the slice is user-facing and ready to commit, update `VERSION` and `CHANGELOG.md` in the final pre-commit pass with a high-level summary.

## 12. Risks and Mitigations

- Risk: Explorer ingestion logic diverges between webhook and refresh paths.
  Mitigation: route both through the same matching service.

- Risk: Strava URL parsing becomes brittle.
  Mitigation: mirror the existing admin-panel parsing approach and test it directly.

- Risk: Explorer burns unnecessary Strava API calls by refetching stable segment metadata too aggressively.
  Mitigation: use shared-segment-table reuse as the default read path, refresh only when explicitly validating or rehydrating metadata, and keep any short-lived cache policy limited to segment metadata rather than activity payloads.

- Risk: Explorer begins to inherit competition UX by accident.
  Mitigation: avoid ranked lists in the primary weekly surface.

- Risk: Webhook processor becomes more complex during transition.
  Mitigation: refactor to delegated handlers before layering in Explorer logic.

## 13. Suggested Handoff Notes

If this moves to implementation, the first engineering slice should be a narrow Phase 2 Slice A: Explorer schema, a shared segment-based matching and persistence seam, Explorer matching service, refresh-path parity, the first Explorer read routes, and backend tests. That is the smallest slice that validates the model without spilling into admin or athlete UI.

The next slice should be the smallest end-to-end Explorer loop:

- one Explorer week
- one or more destinations
- one athlete progress query
- one completers summary query
- one admin refresh action

That would validate the model before building more UI.