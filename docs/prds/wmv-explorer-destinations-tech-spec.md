# WMV Explorer Destinations Technical Specification

## 1. Purpose

This specification translates the Explorer Destinations PRD into an implementation-oriented design for the current WMV Cycling Series codebase. It preserves the key planning decisions:

- Explorer is a separate product area from the current race leaderboard.
- Explorer uses a campaign-first model with campaign-owned date boundaries rather than overloading the current competition `Season` or week models.
- Season UX is progress bar plus checklist plus completers summary.
- Strava segments are the canonical destination type, regardless of whether they represent outdoor or virtual riding.
- Webhook ingestion remains in-process but is refactored into delegated handlers so Explorer can be added without further overloading the current webhook processor.

## 2. Scope

### In Scope

- Separate Explorer campaign model with its own date boundaries
- Admin-defined Explorer destinations from Strava segment URLs or IDs
- Explorer matching from ingested Strava activities
- One completion per destination per athlete per Explorer campaign
- Campaign athlete progress queries
- Campaign completers summary queries with all completer names
- Stored Explorer history across campaigns
- Reusable refresh or backfill path
- Allowing admins to add destinations during the campaign without resetting progress

### Out of Scope

- Explorer rank-order leaderboard
- Bonus scoring beyond one point per destination
- Optional mini-campaigns inside a season
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
- Keep Explorer and competition `Season` separate at the product-model level; the MVP does not require a shared abstraction between them.

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

### 4.4 Shared segment-based matching seam

The repository already has partially reusable building blocks for segment-based activity handling:

- activity-window and lap-window selection in [server/src/activityProcessor.ts](../../server/src/activityProcessor.ts)
- activity and effort persistence in [server/src/activityStorage.ts](../../server/src/activityStorage.ts)
- webhook competition handling in [server/src/webhooks/handlers/competitionActivityHandler.ts](../../server/src/webhooks/handlers/competitionActivityHandler.ts)
- batch refresh handling in [server/src/services/BatchFetchService.ts](../../server/src/services/BatchFetchService.ts)
- late metric hydration in [server/src/services/HydrationService.ts](../../server/src/services/HydrationService.ts)

Explorer should not introduce a second copy of this segment-based matching flow. The corrected implementation slice should extract only the shared seam needed for a campaign-first model while preserving current Competition behavior.

### 4.3 MVP simplification

For MVP, do not introduce a separate Explorer week lifecycle or explicit `draft` / `active` / `archived` workflow unless later implementation proves it is necessary.

Use these simpler rules instead:

- the Explorer campaign owns its own start and end dates
- the campaign is considered active when the current time falls inside its date window
- the athlete-facing Explorer surface should only render when the campaign has at least one destination
- admins may add destinations before or during the campaign
- v1 disallows overlapping Explorer campaigns so active-campaign lookup stays unambiguous
- optional sub-campaigns or templates are deferred until after the campaign-first model is stable

## 5. Proposed Data Model

### 5.1 New entities

Recommended Explorer tables or equivalent schema concepts:

- ExplorerCampaign
  - id
  - startAt
  - endAt
  - optional displayName or rules blurb if needed later
  - createdAt
  - updatedAt

MVP rule: an ExplorerCampaign is its own top-level Explorer container. The campaign becomes athlete-visible only when its own date window is active and it has at least one ExplorerDestination.

For v1 admin authoring, disallow overlapping Explorer campaigns. This keeps active-campaign lookup deterministic without inventing a heavier publish-status or priority model.

- ExplorerDestination
  - id
  - explorerCampaignId
  - stravaSegmentId
  - sourceUrl nullable
  - cachedName
  - displayLabel nullable
  - displayOrder
  - surfaceType nullable such as virtual or outdoor
  - category nullable such as scenic, event, climb
  - createdAt
  - updatedAt

- ExplorerDestinationMatch
  - id
  - explorerCampaignId
  - explorerDestinationId
  - stravaAthleteId
  - stravaActivityId
  - matchedAt or activityStartAt
  - createdAt

- ExplorerAthleteCampaignSummary
  - optional derived or cached summary table if needed later
  - explorerCampaignId
  - stravaAthleteId
  - matchedDestinationCount
  - completedAll boolean
  - lastMatchedAt

For v1, ExplorerAthleteCampaignSummary is computed on read. `ExplorerDestinationMatch` is the durable source of truth. Cached summary storage is deferred unless measured query cost justifies it later.

### 5.2 Key integrity rules

- One athlete can match a given destination at most once per Explorer campaign.
- Multiple rides over the same destination in the same campaign do not increase progress.
- Matches are constrained to the campaign date range.
- Explorer records must survive after the season ends so future rollups or optional mini-campaigns can aggregate them.

### 5.3 Segment source model

Admins should be able to configure destinations by pasting Strava segment URLs, following the same mental model as the regular admin panel. The system should extract the segment ID from the URL, validate it, and store the parsed segment ID plus the original source URL when available. If the segment is already known in the app's segment table, that data can be reused. If not, Explorer should still accept it and cache enough display metadata for a stable UI.

For 4A, the admin backend contract should accept validated Strava segment URLs rather than raw segment IDs. This keeps the initial write surface aligned with the intended paste-and-add authoring workflow and avoids expanding the first slice with a second authoring mode.

Explorer uses a hybrid destination metadata strategy for v1. The preferred policy is database-first reuse of the shared `segment` table, plus Explorer-local cached display metadata and source URL values for stable rendering and setup. Segment metadata should be treated as comparatively durable. Optional short-lived in-memory caching can be used for segment metadata during setup workflows, but that should not be generalized to activity details or segment efforts.

If URL parsing succeeds but live Strava metadata enrichment fails, 4A should still allow destination creation as long as the parsed segment ID and original source URL are preserved. Missing or stale metadata can be repaired in a later slice without blocking initial authoring.

### 5.4 V1 decision lock

- Primary product model: campaign-first Explorer model with campaign-owned dates
- Summary model: computed on read
- Destination metadata strategy: hybrid shared-segment reuse plus Explorer-local cached display metadata
- Campaign overlap rule in v1: no overlapping Explorer campaigns
- Admin destination authoring input for 4A: validated Strava segment URLs only
- Metadata enrichment failure policy: allow creation when parsing succeeds and preserve segment ID plus source URL
- Optional sub-campaigns or templates: deferred
- Explicit Explorer publish-status workflow: deferred unless later implementation proves it is needed
- Refresh or backfill admin mutations: deferred out of 4A

## 6. Core Services

### 6.1 Explorer matching service

Responsibilities:

- Receive normalized activity data plus athlete context.
- Determine which Explorer campaign is active for the activity timestamp by looking at campaign-owned date boundaries.
- Compare activity segment efforts to configured Explorer destination segment IDs for that campaign.
- Create missing ExplorerDestinationMatch records idempotently.
- Return summary information about newly matched destinations.

This service is the core reusable unit for both webhook-driven ingestion and explicit refresh.

### 6.2 Explorer query service

Responsibilities:

- Get active Explorer campaign for UI.
- Get destination list for a given campaign.
- Get current athlete progress for that campaign.
- Get completers summary for that campaign, including all completer names.
- Leave athlete profile aggregation out of the first implementation slice.

### 6.3 Explorer admin service

Responsibilities:

- Create and update Explorer campaigns with their own dates.
- Add, edit, remove, and reorder Explorer destinations.
- Validate or enrich destination metadata from Strava where possible.
- Trigger refresh or backfill actions.

4A boundary:

- Include campaign creation and add-destination authoring only.
- Defer refresh or backfill mutations until a later admin slice.

## 7. API Surface

Recommended tRPC surface areas for 4A:

- explorerAdmin.createCampaign
- explorerAdmin.addDestination

Recommended later tRPC surface areas after 4A:

- explorer.getActiveCampaign
- explorer.getCampaignProgress
- explorer.getCampaignCompleters
- explorerAdmin.updateCampaign
- explorerAdmin.updateDestination
- explorerAdmin.removeDestination
- explorerAdmin.reorderDestinations
- explorerAdmin.refreshCampaign
- explorerAdmin.refreshAthlete

These names are illustrative. Final naming should fit existing router conventions.

Pre-release exposure rule:

- `explorerAdmin.*` belongs behind admin authorization.
- If Explorer UI ships before the athlete-facing hub is approved for release, keep all Explorer UI entry points admin-only and do not add public navigation.
- Existing Explorer read APIs may exist before launch, but their presence alone should not drive early end-user exposure.

## 8. UI Surface

### 8.1 User-facing hub

This surface remains deferred until Explorer is approved for end-user release.

Recommended user-facing sections:

- Challenges hub route
- Active Explorer campaign header
- Progress bar
- Destination checklist
- Completers summary

### 8.2 Admin surface

During early admin slices, any Explorer UI should remain admin-gated and should not make the feature visible to non-admin users.

Recommended initial admin capabilities:

- Create or edit one Explorer campaign with start and end dates
- Add one destination at a time by pasting a Strava segment URL and parsing the segment ID
- Edit destination display label and ordering
- Allow adding destinations before or during the campaign
- Run refresh for a campaign or athlete

The next admin UI should optimize for an all-in-one campaign editor with leaderboard-style card hierarchy, including an expandable campaign card for dates and campaign metadata plus repeated paste-and-add authoring beneath it.

## 9. Matching Rules

### V1 rules

- A destination is a Strava segment configured on an Explorer campaign.
- A destination counts when the athlete has a qualifying activity containing that segment during the campaign date window.
- Each destination is worth one point internally.
- The athlete's visible progress is completed destinations divided by total destinations.
- Repeated visits do not add progress beyond the first match.
- Virtual and outdoor segments are treated equally if configured.

### Open implementation decisions for later phases, not blockers for v1

- Whether to display segment source labels like virtual or outdoor in the checklist
- Whether a deleted activity should remove an Explorer match if it was the only source of completion
- Whether to compute historical rollups on read or cache them incrementally
- Whether optional sub-campaigns or campaign templates should later exist on top of the campaign-first model

## 10. Testing Strategy

### Backend

Add tests for:

- Explorer campaign boundary handling using campaign-owned dates
- Destination match idempotency
- Duplicate segment visits in one campaign
- Multiple destinations in one activity
- Virtual and outdoor segment parity
- Strava URL parsing and validation
- Refresh and webhook parity using the same matching service
- Regression protection for current competition webhook behavior
- Regression protection for current chain wax create and delete webhook behavior

### Frontend

Add tests for:

- Challenges hub navigation
- Active Explorer campaign rendering
- Progress bar state
- Checklist completion state
- Completers summary rendering
- Empty states for no active campaign or no progress yet

### End-to-end

Recommended E2E journeys:

- Admin creates an Explorer campaign with dates and destinations
- Athlete views active Explorer campaign
- Athlete completes one destination and sees progress update
- Admin adds a new destination during the campaign and the checklist updates without resetting prior completions
- Athlete completes the full campaign set and sees completion state
- Completers summary reflects at least one full completer

## 11. Migration and Rollout Sequence

1. Refactor webhook processor toward delegated handlers without changing current competition behavior.
2. Correct the planning model to a campaign-first Explorer model with campaign-owned dates.
3. Add Explorer schema and backend services for the campaign model.
4. Implement Explorer matching handler and shared refresh path.
5. Add Explorer tRPC routes.
6. Add admin Explorer setup UI.
7. Add Challenges hub UI with progress bar, checklist, and completers summary.
8. Run regression checks on race and admin flows.
9. If the slice is user-facing and ready to commit, update `VERSION` and `CHANGELOG.md` in the final pre-commit pass with a high-level summary.

## 12. Risks and Mitigations

- Risk: Explorer ingestion logic diverges between webhook and refresh paths.
  Mitigation: route both through the same matching service.

- Risk: Strava URL parsing becomes brittle.
  Mitigation: mirror the existing admin-panel parsing approach and test it directly.

- Risk: Explorer begins to inherit competition UX by accident.
  Mitigation: avoid ranked lists in the primary campaign surface.

- Risk: the MVP is overcomplicated by overlapping campaigns, sub-campaigns, or explicit status workflows too early.
  Mitigation: keep the first model campaign-first, disallow overlap in v1, and defer sub-campaigns plus explicit publish states until they solve a real problem.

- Risk: Webhook processor becomes more complex during transition.
  Mitigation: refactor to delegated handlers before layering in Explorer logic.

## 13. Suggested Handoff Notes

If this moves to implementation after the planning correction, the first engineering slice should be Explorer campaign schema decoupling plus matching, query, and admin-flow corrections. That is the structural work that determines whether the rest of the feature can be added cleanly.

The next slice should be the smallest end-to-end Explorer loop:

- one Explorer campaign with its own dates
- one or more destinations
- one athlete progress query
- one completers summary query
- one campaign editor shell for dates and destination authoring

That would validate the model before building more UI.