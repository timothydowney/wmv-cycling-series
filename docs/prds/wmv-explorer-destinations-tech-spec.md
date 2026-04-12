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

- Competition week matcher
- Explorer destination matcher
- Chain wax tracker

This keeps feature fan-out inside the app boundary while avoiding a new worker or CLI-per-event process model.

### 4.2 Refresh or backfill model

Explorer also needs an explicit refresh path for late joins, recovery, and admin operations. That path should reuse the same underlying Explorer matching service used by the webhook handler rather than re-implementing the logic in a separate batch-only flow.

Recommended direction:

- Extract Explorer matching into a reusable service.
- Call that service from the Explorer ingestion handler.
- Call that same service from an admin or participant-triggered refresh action.

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

For v1, ExplorerAthleteWeekSummary can remain computed on read if query cost is modest. The durable source of truth should be ExplorerDestinationMatch.

### 5.2 Key integrity rules

- One athlete can match a given destination at most once per Explorer week.
- Multiple rides over the same destination in the same Explorer week do not increase progress.
- Matches are constrained to the Explorer week date range.
- Explorer records must survive after the week ends so future season views can aggregate them.

### 5.3 Segment source model

Admins should be able to configure destinations by pasting Strava segment URLs, following the same mental model as the regular admin panel. The system should extract the segment ID from the URL, validate it, and store the parsed segment ID plus the original source URL when available. If the segment is already known in the app's segment table, that data can be reused. If not, Explorer should still accept it and cache enough display metadata for a stable UI.

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

## 11. Migration and Rollout Sequence

1. Refactor webhook processor toward delegated handlers without changing current competition behavior.
2. Add Explorer schema and backend services.
3. Implement Explorer matching handler and shared refresh path.
4. Add Explorer tRPC routes.
5. Add admin Explorer setup UI.
6. Add Challenges hub UI with progress bar, checklist, and completers summary.
7. Run regression checks on race and admin flows.
8. Update VERSION and CHANGELOG.md when implementation begins.

## 12. Risks and Mitigations

- Risk: Explorer ingestion logic diverges between webhook and refresh paths.
  Mitigation: route both through the same matching service.

- Risk: Strava URL parsing becomes brittle.
  Mitigation: mirror the existing admin-panel parsing approach and test it directly.

- Risk: Explorer begins to inherit competition UX by accident.
  Mitigation: avoid ranked lists in the primary weekly surface.

- Risk: Webhook processor becomes more complex during transition.
  Mitigation: refactor to delegated handlers before layering in Explorer logic.

## 13. Suggested Handoff Notes

If this moves to implementation, the first engineering slice should be the delegated ingestion refactor plus Explorer schema design. That is the structural work that determines whether the rest of the feature can be added cleanly.

The next slice should be the smallest end-to-end Explorer loop:

- one Explorer week
- one or more destinations
- one athlete progress query
- one completers summary query
- one admin refresh action

That would validate the model before building more UI.