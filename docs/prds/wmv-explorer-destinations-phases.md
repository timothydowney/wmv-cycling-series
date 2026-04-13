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

## Phase 2: Explorer Data Model And Matching

Goal: add Explorer week, destination, and match storage plus the shared matching service used by both webhooks and refresh actions.

Entry condition: start from a new PR after Phase 1 is merged, and use that PR to close the remaining summary-model and destination-metadata decisions before broad Phase 2 implementation expands.

Scope:

- Schema additions
- Explorer matching service
- Admin or service-level refresh path
- Idempotent storage rules

## Phase 3: Explorer Admin Setup

Goal: let admins create Explorer weeks, add destinations from Strava URLs one at a time, label them, order them, and manage activation.

Scope:

- Explorer admin routes and service layer
- Explorer admin UI
- Activation guard requiring at least one destination

## Phase 4: Explorer Hub MVP

Goal: ship the athlete-facing weekly Explorer view.

Scope:

- Challenges hub route
- Active week header
- Progress bar
- Destination checklist
- Completers summary with all names

## Phase 5: Hardening And Follow-on Expansion

Goal: stabilize the Explorer feature and prepare later work.

Candidate items:

- Season-wide Explorer aggregation
- Better admin search and validation tooling
- Explorer profile rollups
- Badges and themed campaigns
- Shared-segment mini-races