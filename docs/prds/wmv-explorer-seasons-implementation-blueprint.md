# WMV Explorer Seasons Implementation Blueprint

This document sits between the product-facing PRD and the architecture-facing technical spec. Its purpose is to make the eventual implementation mostly mechanical by spelling out the intended work packages, service boundaries, lifecycle rules, and rollout order before code begins.

## 1. Purpose

This blueprint should answer the question: "If implementation started next, what exactly would be built first, what would each layer do, and what decisions are already locked in?"

It is intentionally still pre-implementation. It does not commit the codebase to a migration or endpoint shape yet, but it should reduce ambiguity enough that the eventual backend and frontend work can be executed in smaller, safer slices.

## 2. Locked Decisions

The following should be treated as settled unless new product evidence forces a revisit:

- Explorer is a separate product area from competition.
- Explorer is season-first.
- Only one Explorer season may be active at a time.
- V1 admin authoring uses curated Strava segment URLs.
- V1 completion matching uses exact segment identity only.
- Rider-facing destination presentation uses a hybrid model:
  - primary: admin-authored label when present, otherwise cached segment name
  - secondary: endpoint or place context such as city, state, or country
- Live seasons may be edited directly.
- If a source segment later becomes unavailable, the destination remains visible and historical completions remain intact, but new matches should be disabled until the source is repaired or replaced.
- Compute-on-read is the default for v1 aggregates.
- Google Maps Platform is the preferred managed map stack for later work, with OSM-based services kept as a fallback.

## 3. Delivery Strategy

The safest implementation order is:

1. Schema and persistence groundwork.
2. Matching and reversal service logic.
3. Admin authoring endpoints and UI.
4. Athlete Explorer read path.
5. Observability and hardening.
6. Deferred map and confidence-based matching work.

This order matters because Explorer trust depends on completion correctness more than on UI polish.

## 4. Work Packages

### 4.1 Work Package A: Schema and persistence groundwork

Goal:

- introduce Explorer tables and constraints without disturbing competition flows

Expected outputs:

- explorer season table
- explorer destination table
- explorer destination source detail table for segment-backed recognition
- explorer completion table
- participant preference storage for Explorer opt-out
- migration plan and rollback notes

Implementation notes:

- keep the first schema slice focused on `strava_segment` recognition mode only, even if the logical model leaves room for more later
- use status and source-availability flags from the beginning so the admin workflow does not need a later schema retrofit
- preserve cached source metadata needed for durable display and support diagnostics

### 4.2 Work Package B: Matching and reversal core

Goal:

- create one reusable Explorer matching service that both webhooks and refresh can call

Expected outputs:

- ExplorerMatchingService
- exact segment-effort matching against configured Explorer destinations
- idempotent completion creation
- completion reversal on activity delete or invalidation
- parity between live webhook processing and manual backfill

Implementation notes:

- exact segment identity is the only matching rule in v1
- do not add endpoint-distance or place-string inference in this package
- structure the service so a later recognition mode can plug in without changing the v1 path

### 4.3 Work Package C: Admin authoring backend

Goal:

- provide the minimum backend surface needed for live-season authoring

Expected outputs:

- explorer admin router
- ExplorerAdminService
- season CRUD for Explorer seasons
- add destination from Strava URL
- edit label, commentary, route family, and ordering
- mark source unavailable
- refresh or backfill request entrypoint

Implementation notes:

- validation should parse the segment ID from the pasted URL and fetch metadata only when the admin creates or explicitly refreshes the destination
- the service layer should enforce one-active-season behavior and activation constraints
- refresh should be designed to support future scope narrowing:
  - season-wide
  - rider-specific
  - destination-specific

### 4.4 Work Package D: Athlete read model

Goal:

- ship the first useful Explorer read experience without map complexity

Expected outputs:

- active Explorer season query
- archived seasons query
- destination list query
- current rider progress query
- aggregate destination stats query

Implementation notes:

- the read layer should return the hybrid presentation shape directly, not require the frontend to reconstruct it from raw source fields
- response payloads should include enough location primitives for future map rendering, even if the first UI does not use them yet

### 4.5 Work Package E: Admin UI

Goal:

- give admins a narrow but reliable season-authoring workflow

Expected outputs:

- Explorer season create/edit screen
- destination list editor
- segment URL input with validation
- commentary editing using existing markdown patterns
- destination ordering controls
- refresh action
- source-unavailable state in admin UI

Implementation notes:

- reuse the current segment URL parsing and metadata patterns
- do not mix Explorer authoring into the competition week manager
- prefer obvious form controls over highly interactive UI until the workflow is validated

### 4.6 Work Package F: Hardening and observability

Goal:

- ensure Explorer is trustworthy under routine use and correction flows

Expected outputs:

- logs around destination creation, matching, reversal, and refresh
- regression tests for webhook parity
- tests for one-active-season enforcement
- tests for source-unavailable behavior
- tests for opt-out enforcement

## 5. Data Flow Blueprint

### 5.1 Destination creation flow

1. Admin creates or edits an Explorer season.
2. Admin pastes a Strava segment URL.
3. System extracts the segment ID.
4. System fetches or reuses cached segment metadata.
5. System creates an Explorer destination record.
6. System stores segment source detail fields.
7. Admin optionally overrides the display label and commentary.

Key rule:

- after creation, the destination should be displayable even if Strava later becomes unavailable for that segment

### 5.2 Activity create or update flow

1. Webhook arrives.
2. Shared activity context is built.
3. Existing handlers run in current order.
4. Explorer handler checks whether an active Explorer season exists.
5. Explorer handler checks whether the athlete is opted in.
6. ExplorerMatchingService compares segment efforts to configured destination sources.
7. Missing completion rows are inserted idempotently.

### 5.3 Activity delete or invalidation flow

1. Delete or invalidation signal arrives.
2. Explorer handler identifies completions tied to the activity.
3. Matching service removes or recomputes the affected completions.
4. Aggregates naturally reflect the change on the next read.

### 5.4 Refresh flow

1. Admin triggers refresh.
2. System records requested scope.
3. Matching service re-evaluates activities in that scope.
4. Completion rows are inserted, preserved, or removed deterministically.

## 6. Hybrid Presentation Contract

The frontend should not need to invent destination naming rules.

Recommended response shape for a destination-facing query:

- `displayLabelPrimary`
- `displayLabelSecondary`
- `commentaryMarkdown`
- `completionState`
- `sourceAvailable`
- `locationSummary`
- `latitude`
- `longitude`
- `polyline` or summary polyline when relevant

Recommended label rules:

- primary label: admin override if present, otherwise cached segment name
- secondary label: endpoint or place context such as city, state, country

This keeps the rider experience destination-oriented without weakening the exact segment-recognition rule.

## 7. Source Unavailability Rules

If a Strava segment later disappears, becomes inaccessible, or no longer supports metadata refresh:

- keep the destination row
- keep cached metadata
- keep historical completions
- mark `sourceAvailable = false`
- attach an admin-visible reason if known
- exclude the destination from new exact-match completion creation until repaired

This rule should be implemented before map or confidence-based work, because it affects trust and admin operations.

## 8. Migration and Rollout Notes

Recommended migration stance:

- add Explorer tables in one migration slice
- do not backfill any competition data into Explorer tables
- do not expose public Explorer endpoints until matching and admin creation flows are in place
- start with one internal or admin-created Explorer season for real-world validation

Recommended rollout order:

1. Ship schema and hidden backend support.
2. Ship admin-only authoring.
3. Validate matching against real rides.
4. Ship athlete read experience.
5. Revisit map or confidence-based ideas only after completion trust is stable.

## 9. Testing Blueprint

### Backend tests

- Explorer season create, update, activate, archive rules
- one-active-season enforcement
- destination creation from segment URL
- destination ordering behavior
- exact segment matching
- duplicate activity safety
- completion reversal on delete
- source-unavailable behavior
- refresh parity with webhook matching
- opt-out exclusion

### Frontend tests

- Explorer admin season create/edit
- segment URL validation and error states
- destination commentary editing
- hybrid label presentation
- athlete progress rendering
- archived season browsing

## 10. Deferred Implementation Areas

These should remain explicitly out of the first implementation slice:

- place-based auto-generated destinations
- endpoint or coordinate-tolerance completion matching
- rider-submitted destination proposals
- shared social feed
- map-first athlete experience
- rich destination search or autocomplete-heavy UX

## 11. Open Implementation Questions

These are not blockers to schema planning, but they should be answered before code begins in earnest:

1. Should refresh requests be executed synchronously in v1, or should they be queued and reported as jobs?
2. Should live destination edits affect only future matching automatically, with backfill always explicit?
3. Should source-unavailable destinations remain visible in athlete views as unavailable, or simply as normal destinations that stop accruing new completions?
4. How much source snapshot detail should be preserved on completion rows to make support and debugging easier later?
5. Should route family remain free text initially, or should it be constrained from the first admin UI release?

## 12. Definition Of Ready For Implementation

Explorer implementation should not begin until the following are true:

- the PRD is stable on destination intent and hybrid presentation
- the technical spec is stable on exact segment-recognition in v1
- the schema draft is accepted as the working starting point
- admin refresh scope and source-unavailable behavior are agreed
- the rollout order is accepted as schema first, matching second, admin third, athlete read fourth
