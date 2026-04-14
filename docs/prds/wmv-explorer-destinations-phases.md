# WMV Explorer Destinations Implementation Phases

This document captures the current execution sequence for Explorer Destinations. It is intentionally narrower than the PRD and technical spec: it exists to turn the agreed direction into concrete follow-on work.

## Phase 0: Documentation Baseline

Goal: land the PRD, technical spec, phase outline, and ideas backlog in the repository so future implementation work has a stable source of truth.

Deliverables:

- Explorer PRD in `docs/prds`
- Explorer technical spec in `docs/prds`
- Explorer ideas backlog in `docs/prds`
- Follow-on issue creation for the first engineering phase

## Phase 1: Webhook Ingestion Refactor

Goal: refactor webhook processing into a thin orchestrator with delegated in-process handlers so Explorer can be added without further overloading the current processor.

Status: complete on the Phase 1 closure branch. The next Explorer PR should start Phase 2 preparation work rather than reopen the webhook seam.

Scope:

- Introduce the handler or matcher abstraction for ingested activity contexts
- Build a shared activity-ingestion context once per activity create or update event
- Run delegated handlers sequentially in-process
- Keep initial handler order explicit: chain wax first, then competition
- Preserve existing competition processing behavior
- Preserve existing chain wax behavior
- Establish a reusable seam for Explorer matching and later refresh paths

Out of scope:

- Explorer schema
- Explorer UI
- Explorer admin setup
- Forcing activity delete or athlete deauthorization into the same handler abstraction before the activity path is stable

## Phase 2: Season Campaign Model Correction

Goal: correct Explorer from a weekly-first design to a season-attached campaign model, and remove optional mini-campaign complexity from MVP planning.

Status: complete in the current planning set. Future work should build on the corrected model rather than reopen the weekly-first design unless product intent changes again.

Entry condition: start from a new planning PR from updated `main` because the current planning set and implementation branch were built around the wrong weekly-first model.

Scope:

- Rewrite PRD, tech spec, worklog, and readiness checklist around a season-attached Explorer campaign
- Remove mini-campaigns from MVP scope and record them as future optional work
- Remove explicit `draft` / `active` / `archived` workflow from MVP unless later implementation proves it is necessary
- Define the smallest safe follow-on implementation slice against the corrected model

## Phase 3: Explorer Campaign Data Model And Matching

Goal: add Explorer campaign, destination, and match storage plus the shared matching service used by both webhooks and refresh actions.

Status: complete on the merged backend slice. Schema, matching, webhook integration, and the initial read routes now exist and should be treated as the base for later Explorer work.

Scope:

- Schema additions for a season-attached campaign model
- Explorer matching service
- Admin or service-level refresh path
- Idempotent storage rules

## Phase 4: Explorer Admin Setup

Goal: let admins create or manage the season campaign without exposing Explorer to end users before release.

### Slice 4A: Admin Backend

Goal: add the minimal Explorer admin service and tRPC surface needed to create a campaign for a season and add destinations safely.

Scope:

- Explorer admin service and router surface for campaign creation and add-destination flow
- Enforce one Explorer campaign per season without constraining future multi-season operation
- Strava segment URL parsing and validation for destination setup; do not expose raw segment-ID authoring in 4A
- Explorer-local source URL and cached metadata persistence needed for stable authoring and display
- Allow destination creation to proceed when URL parsing succeeds but live metadata enrichment is unavailable
- Add-destination behavior that works before or during the season without resetting prior progress
- Backend tests for auth, validation, campaign creation, destination creation, and in-season additions

Out of scope:

- Admin UI
- Public athlete-facing Explorer UI
- Public navigation to Explorer surfaces
- Reorder, remove, and edit flows unless one is required to keep the backend contract coherent
- Refresh or backfill mutations
- Release-note bookkeeping files

### Slice 4B: Admin UI (Admin-Gated)

Goal: expose the approved admin backend capabilities through an admin-only WMV surface.

Scope:

- Admin-only route or section for Explorer campaign setup
- Create-campaign and add-destination flows using the approved 4A backend contract
- Keep all Explorer entry points hidden from non-admin users until there is an explicit release decision for the athlete-facing hub
- Explorer admin UI
- Campaign setup attached to a season
- Add-destination workflow that works before or during the season

## Phase 5: Explorer Hub MVP

Goal: ship the athlete-facing season Explorer view only after the admin flow is stable and Explorer is approved for end-user release.

Scope:

- Challenges hub route
- Active campaign header
- Progress bar
- Destination checklist
- Completers summary with all names

## Phase 6: Hardening And Follow-on Expansion

Goal: stabilize the Explorer feature and prepare later work.

Candidate items:

- Optional mini-campaigns attached to a season
- Better admin search and validation tooling
- Explorer profile rollups
- Badges and themed campaigns
- Shared-segment mini-races