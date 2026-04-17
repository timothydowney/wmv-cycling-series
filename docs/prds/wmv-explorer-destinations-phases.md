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

Historical note: this planning correction was necessary because an earlier planning set and implementation branch had been built around the wrong weekly-first model.

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

Status: complete on the admin-backend slice. The backend now supports admin-authenticated campaign creation, Strava segment URL validation, destination creation with metadata fallback, and the one-campaign-per-season plus no-duplicate-segment-within-a-campaign guards defined for 4A.

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

### Slice 4B-1: E2E Harness Hardening

Goal: make Explorer and existing Playwright coverage run against a portable, explicit, repeatable E2E harness before adding more admin UI surface.

Status: complete in the current local implementation work. The remaining operational step is to stage or PR the harness-only file set separately from the 4B-2 admin UI follow-on files.

Scope:

- Keep one explicit backend E2E mode for test-only auth, startup validation, and safe boot wiring
- Replace accidental reliance on a contributor's local `wmv.db` with a deterministic E2E data source
- Prefer checked-in sanitized E2E fixture data or a committed generator over copying development data with live token rows
- Move outbound Strava differences behind explicit provider selection rather than scattering `isE2EMode()` short-circuits through general feature logic
- Keep existing Playwright coverage green while removing hard-coded localhost and seed-ID assumptions that prevent portability
- Update E2E docs and planning state so current reality matches the implemented harness

Out of scope:

- New athlete-facing Explorer UI
- Broad new admin UI beyond what is needed to prove the harness supports the landed backend contract
- Public navigation changes

Implementation notes:

- Prefer fixture-backed providers for segment metadata, profile imagery, club checks, or webhook enrichment where deterministic behavior is required in E2E.
- Do not treat backend E2E mode as a catch-all behavior switch. It should select explicit providers and enforce fail-fast boot rules, not silently bypass arbitrary application logic.

### Slice 4B-2: Admin UI (Admin-Gated)

Goal: expose the approved admin backend capabilities through an admin-only WMV surface once the E2E harness is portable enough to support repeatable regression coverage.

Status: complete in the current local implementation work as a minimal admin-gated setup surface. The next step should return to planning for a follow-on admin UX refinement slice rather than continue broadening this implementation branch opportunistically.

Scope:

- Admin-only route or section for Explorer campaign setup
- Create-campaign and add-destination flows using the approved 4A backend contract
- Targeted browser coverage for admin setup flows on top of the hardened E2E harness
- Keep all Explorer entry points hidden from non-admin users until there is an explicit release decision for the athlete-facing hub
- Campaign setup attached to a season
- Add-destination workflow that works before or during the season

Follow-on planning note:

- Treat richer admin guidance, stronger client-side segment validation, and broader card or component-system refinement as the next planning surface, not as open-ended scope creep inside 4B-2.

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