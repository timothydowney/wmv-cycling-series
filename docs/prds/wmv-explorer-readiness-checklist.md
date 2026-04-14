# WMV Explorer Destinations Readiness Checklist

This checklist is the implementation gate for WMV Explorer Destinations. It exists to answer one question clearly: is Explorer ready for the next implementation slice, or does the planning set still have unresolved gaps that would force engineering to guess?

Explorer is the first pilot for a lightweight PRD-first workflow in this repository. The goal is not to create heavy process. The goal is to make sure substantial features have enough closure before coding starts.

## Source Of Truth

- [PRD](./wmv-explorer-destinations-prd.md)
- [Technical Spec](./wmv-explorer-destinations-tech-spec.md)
- [Implementation Phases](./wmv-explorer-destinations-phases.md)
- [Ideas Backlog](./wmv-explorer-destinations-ideas.md)
- [Explorer Worklog](./wmv-explorer-worklog.md)
- [Explorer Execution Briefing](./wmv-explorer-execution-briefing.md)

The ideas backlog is intentionally excluded from v1 implementation scope. It exists to capture future work without expanding the current slice.

## Current Go Decision

**Status:** Phase 1 Complete; Season-Campaign Correction Landed; Ready For Narrow Corrected Implementation Slice

Explorer has completed the narrow Phase 1 webhook-orchestration slice that preserves current competition behavior while introducing delegated in-process handlers. The planning set on this branch now corrects the MVP to a season-campaign-first model attached to an existing WMV season, with optional mini-campaigns and explicit publish-status workflows deferred. Explorer is ready for one bounded implementation PR that corrects the backend model from the earlier weekly-first shape.

## Current Status Summary

| Area | Status | Notes |
| --- | --- | --- |
| Product framing | Ready | The PRD is clear on goals, users, must-haves, non-goals, and success criteria. |
| Execution phasing | Ready For Narrow Corrected Slice | The phases doc now treats season campaigns as the MVP model and defers mini-campaigns. |
| Architecture closure | Ready For Narrow Corrected Slice | The technical spec now models a season-attached campaign and removes explicit status complexity from MVP. |
| Open questions handling | Ready | The worklog now records the corrected model plus the remaining non-blocking questions. |
| Blocking research closure | Ready For Narrow Corrected Slice | The product-intent correction is closed for this branch. |
| Test planning | Ready For Narrow Corrected Slice | Test planning is now framed against campaign boundaries rather than week boundaries. |
| Documentation impact plan | Partial | The likely doc surfaces are known, but the planning correction needs to land first. |

## Must Resolve Before Broad Implementation

### 1. Current Webhook Behavior And Regression Obligations

| Field | Value |
| --- | --- |
| Status | Ready For Phase 1 |
| Gate | Must Resolve |
| Why it matters | Phase 1 is explicitly about refactoring webhook processing without breaking current competition behavior. |
| Evidence | The preserved flow is documented in [wmv-explorer-worklog.md](./wmv-explorer-worklog.md), implemented in [server/src/webhooks/processor.ts](../../server/src/webhooks/processor.ts) plus [server/src/webhooks/activityHandlers.ts](../../server/src/webhooks/activityHandlers.ts), and covered by focused webhook tests under `server/src/__tests__`. |
| Acceptance criteria | The worklog explicitly documents the current processor responsibilities, the handler seam keeps the webhook entrypoint stable, and the focused webhook regression tests stay green. |
| Next action | Keep the preservation summary current if new webhook handlers or side effects are added later. |

### 2. Explorer Athlete Summary Model

| Field | Value |
| --- | --- |
| Status | Ready |
| Gate | Must Resolve |
| Why it matters | Engineering should not start building around two competing summary models. |
| Evidence | The corrected technical spec now explicitly chooses computed on read for `ExplorerAthleteCampaignSummary`, with `ExplorerDestinationMatch` as the durable source of truth. |
| Acceptance criteria | The tech spec explicitly chooses one v1 approach: computed on read or cached summary. It also states the reason for that choice and what is deferred. |
| Next action | Carry the locked decision into the corrected implementation brief and tests. |

### 3. Explorer Destination Metadata Strategy

| Field | Value |
| --- | --- |
| Status | Ready |
| Gate | Must Resolve |
| Why it matters | Explorer destination setup depends on how segment data is validated, stored, and displayed over time. |
| Evidence | The current UI already has real segment URL parsing and validation patterns in [src/components/SegmentInput.tsx](../../src/components/SegmentInput.tsx) and [src/components/ManageSegments.tsx](../../src/components/ManageSegments.tsx), but the Explorer spec still leaves room for multiple storage strategies. |
| Acceptance criteria | The tech spec explicitly states whether Explorer reuses the existing segment table, stores Explorer-local cached metadata, or uses both with clear responsibilities for each. |
| Next action | Carry the locked storage responsibilities and DB-first segment reuse policy into the corrected implementation slice. |

### 4. Centralized Open Questions

| Field | Value |
| --- | --- |
| Status | Ready |
| Gate | Must Resolve |
| Why it matters | Scattered uncertainty forces implementation chats to rediscover unresolved design choices. |
| Evidence | The worklog open-questions table now reflects the corrected campaign model and remaining non-blocking questions. |
| Acceptance criteria | One section in the worklog or readiness checklist lists all unresolved questions, their current status, and whether they block implementation. |
| Next action | Seed the worklog with a dedicated open-questions section and keep it current. |

### 5. Phase 1 And Phase 2 Boundary

| Field | Value |
| --- | --- |
| Status | Ready |
| Gate | Must Resolve |
| Why it matters | The team needs a shared rule for what can proceed now versus what must wait for the season-model correction. |
| Evidence | The implemented webhook seam remains valid, and the next slice is now re-approved against the corrected season campaign model. |
| Acceptance criteria | The readiness artifacts clearly state that Explorer is ready for one narrow corrected implementation slice and identify what remains out of scope. |
| Next action | Keep the current go decision updated as additional corrected Explorer slices are approved or deferred. |

## Should Resolve Before Phase 2 Starts

### 1. Backend Test Organization

| Field | Value |
| --- | --- |
| Status | Ready For Narrow Corrected Slice |
| Gate | Should Resolve |
| Why it matters | The repo already has a strong backend test pattern. Explorer should fit it rather than improvise. |
| Evidence | Existing tests under `server/src/__tests__` use the in-memory [setupTestDb](../../server/src/__tests__/setupTestDb.ts) pattern and helper utilities. |
| Acceptance criteria | The implementation plan names where Explorer service, router, and integration tests will live and states that they will use the existing in-memory SQLite setup against campaign boundaries unless a stronger reason appears. |
| Next action | Use the existing in-memory backend test pattern for corrected campaign service and router coverage. |

### 2. E2E Data Strategy

| Field | Value |
| --- | --- |
| Status | Partial |
| Gate | Should Resolve |
| Why it matters | Explorer UI and admin flows will need end-to-end coverage, and the repository already enforces a separate E2E database model. |
| Evidence | [AGENTS.md](../../AGENTS.md) defines `wmv_e2e.db` as the dedicated E2E environment and warns against mixing databases. |
| Acceptance criteria | The implementation plan explains how Explorer E2E scenarios will be created and validated without relying on accidental shared state. |
| Next action | Provision Explorer campaign E2E data intentionally during setup or controlled fixtures. |

### 3. Documentation Impact Plan

| Field | Value |
| --- | --- |
| Status | Ready For Narrow Corrected Slice |
| Gate | Should Resolve |
| Why it matters | Explorer touches admin, athlete, API, database, and release-note surfaces. That work should be visible before coding. |
| Evidence | Likely doc surfaces already exist in `ADMIN_GUIDE.md`, `docs/API.md`, `docs/DATABASE_DESIGN.md`, `docs-site/`, `CHANGELOG.md`, and `VERSION`, but the release-note files should wait for the final pre-commit pass of a user-facing slice. |
| Acceptance criteria | The worklog or implementation slice names the docs expected to change when the slice lands. |
| Next action | Add a documentation-impact checklist to the worklog. |

### 4. Smallest End-To-End Slice

| Field | Value |
| --- | --- |
| Status | Completed |
| Gate | Should Resolve |
| Why it matters | Explorer should not start with a multi-surface implementation burst. |
| Evidence | The worklog now records the completed Phase 1 webhook-orchestrator slice, including validation expectations and explicit out-of-scope items. |
| Acceptance criteria | One narrow slice was named, bounded, tied to Phase 1, and validated through the focused webhook regression tests. |
| Next action | Keep later slices equally narrow and tie the next PR to the corrected campaign model instead of proceeding with the weekly-first plan. |

## Safe To Defer If Recorded Explicitly

| Item | Status | Gate | Notes |
| --- | --- | --- | --- |
| Virtual versus outdoor labels in the checklist | Deferred | Safe To Defer | Not required for v1 matching correctness. |
| Match retraction when a source activity is deleted | Partial | Safe To Defer | Can remain an explicit unresolved rule if v1 behavior is documented. |
| Season-wide rollup caching strategy | Deferred | Safe To Defer | Campaign history durability matters first. |
| Post-MVP ideas from the ideas backlog | Deferred | Safe To Defer | Keep them isolated in the ideas file. |

## Execution Preconditions For The Next Slice

Before any Explorer implementation slice starts, it should explicitly reference:

1. One approved phase from [wmv-explorer-destinations-phases.md](./wmv-explorer-destinations-phases.md).
2. One or more exact sections of [wmv-explorer-destinations-tech-spec.md](./wmv-explorer-destinations-tech-spec.md) that govern the slice.
3. The status of any blocking checklist items from this document.
4. The expected validation path, such as backend tests, E2E checks, linting, typechecking, build verification, or documentation updates.
5. The documentation surfaces expected to change for that slice.

## Sign-Off

| Decision | Current State |
| --- | --- |
| Phase 1 Complete | Yes |
| Season-Campaign Correction Landed | Yes |
| Ready For Narrow Corrected Implementation Slice | Yes |
| Ready For Broad Feature Implementation | No |

If this file says anything stronger than **Phase 1 Complete; Season-Campaign Correction Landed; Ready For Narrow Corrected Implementation Slice**, the linked worklog should show exactly what changed to justify that shift.