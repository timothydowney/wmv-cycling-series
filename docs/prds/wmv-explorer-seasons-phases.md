# WMV Explorer Seasons Implementation Phases

This document captures the recommended execution sequence for Explorer Seasons. It is intentionally narrower than the PRD and technical spec: it exists to turn the agreed direction into concrete follow-on work.

## Phase 0: Documentation Baseline

Goal: land the Explorer Seasons PRD, technical spec, phase outline, and design workshop checklist so implementation work has a stable source of truth.

Deliverables:

- Explorer Seasons PRD in `docs/prds`
- Explorer Seasons technical spec in `docs/prds`
- Explorer Seasons phase outline in `docs/prds`
- Design workshop checklist in `docs/prds`

## Phase 1: Schema And Preference Foundations

Goal: establish the Explorer data model, participation preferences, and map-ready destination primitives without shipping the full UX yet.

Scope:

- Add ExplorerSeason, ExplorerDestination, and ExplorerDestinationCompletion schema
- Make the destination core source-type aware so later place destinations fit without a schema reset
- Add participant preference support for Explorer opt-out
- Extend destination or segment storage with map-capable fields such as coordinates and polyline data
- Enforce one-active-season rules
- Preserve current competition schema and behavior
- Preserve enough endpoint and geometry data to support later confidence-based destination matching experiments

Out of scope:

- Athlete-facing Explorer UI
- Interactive map rendering
- Feed UI
- Auto-created place destinations from city, state, and country visits

## Phase 2: Matching, Reversal, And Refresh

Goal: make Explorer completion tracking trustworthy.

Scope:

- Explorer matching service
- Explorer webhook handler
- Delete and invalidation-aware completion reversal
- Admin refresh or backfill path using the same matching service
- Explorer opt-out enforcement during ingestion and refresh
- Exact segment-identity matching as the only MVP recognition rule

Out of scope:

- Rich frontend presentation
- Cached aggregate summary infrastructure

## Phase 3: Admin Authoring MVP

Goal: let admins define an Explorer season and curate destinations cleanly.

Scope:

- Explorer admin routes and service layer
- Explorer season create, edit, activate, archive flows
- Destination URL ingestion and metadata capture
- Display-label override
- Markdown commentary editing
- Destination ordering

Out of scope:

- Season replication or templating
- Rider-submitted destinations

## Phase 4: Athlete Data View MVP

Goal: ship the first athlete-facing Explorer experience with low complexity and solid data fidelity.

Scope:

- Explorer route or tab
- Active Explorer season header
- Personal completion progress
- Destination collection or checklist
- Concise aggregate day-one stats
- Archived season visibility
- Profile-based Explorer opt-out control

Out of scope:

- Interactive map view
- Personal Explorer activity feed
- Shared social feed

## Phase 5: Hardening And Observability

Goal: stabilize the Explorer system during real use.

Scope:

- Improve test coverage and regression protection
- Add instrumentation for matching and refresh behavior
- Measure whether runtime stat computation remains sufficient
- Validate destination commentary UX and archive usability
- Refine grouping concepts such as route family if they prove useful

## Phase 6: Follow-On UX Expansion

Goal: expand Explorer beyond the first data-first experience once the primitives are proven.

Candidate items:

- Interactive map view powered by stored destination geometry
- Address or place search with an external geocoder
- Destination search and map centering
- Auto-created place destinations from first city, state, and country visits
- Endpoint or coordinate-tolerance destination matching with a documented confidence policy
- Personal Explorer activity feed
- Shared social feed
- Season replication or templating
- Rider-submitted destination workflows
- Weekly or holiday Explorer challenges inside a season