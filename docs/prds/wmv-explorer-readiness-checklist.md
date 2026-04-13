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

**Status:** Phase 1 Complete; Ready For New Phase 2 Preparation PR

Explorer has completed the narrow Phase 1 webhook-orchestration slice that preserves current competition behavior while introducing delegated in-process handlers. It is ready for a new, separate PR to start Phase 2 preparation work, but it is not yet ready for broad Phase 2+ implementation. The remaining gaps are technical-closure gaps, not product-intent gaps.

## Current Status Summary

| Area | Status | Notes |
| --- | --- | --- |
| Product framing | Ready | The PRD is clear on goals, users, must-haves, non-goals, and success criteria. |
| Execution phasing | Ready | The phases doc already breaks work into a useful order. |
| Architecture closure | Partial | The overall direction is clear, but several design decisions still need to be finalized. |
| Open questions handling | Partial | Open questions exist, but they are not yet centralized in one review surface. |
| Blocking research closure | Partial | Some validation work is still needed before safe implementation. |
| Test planning | Partial | The spec outlines what to test, but the exact organization and execution strategy should be made explicit. |
| Documentation impact plan | Partial | The likely doc surfaces are known, but the required updates are not yet tracked in one place. |

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
| Status | Partial |
| Gate | Must Resolve |
| Why it matters | The tech spec leaves the `ExplorerAthleteWeekSummary` decision open for v1. Engineering should not start building around two competing models. |
| Evidence | The current spec says the summary can remain computed on read if query cost is modest, but no v1 decision is locked yet. |
| Acceptance criteria | The tech spec explicitly chooses one v1 approach: computed on read or cached summary. It also states the reason for that choice and what is deferred. |
| Next action | Add a design decision note to the technical spec and record the outcome in the worklog. |

### 3. Explorer Destination Metadata Strategy

| Field | Value |
| --- | --- |
| Status | Partial |
| Gate | Must Resolve |
| Why it matters | Explorer destination setup depends on how segment data is validated, stored, and displayed over time. |
| Evidence | The current UI already has real segment URL parsing and validation patterns in [src/components/SegmentInput.tsx](../../src/components/SegmentInput.tsx) and [src/components/ManageSegments.tsx](../../src/components/ManageSegments.tsx), but the Explorer spec still leaves room for multiple storage strategies. |
| Acceptance criteria | The tech spec explicitly states whether Explorer reuses the existing segment table, stores Explorer-local cached metadata, or uses both with clear responsibilities for each. |
| Next action | Finalize the storage and enrichment rules in the technical spec before Explorer schema work starts. |

### 4. Centralized Open Questions

| Field | Value |
| --- | --- |
| Status | Missing |
| Gate | Must Resolve |
| Why it matters | Scattered uncertainty forces implementation chats to rediscover unresolved design choices. |
| Evidence | Open items currently appear in narrative form across the technical spec rather than in one explicit decision list. |
| Acceptance criteria | One section in the worklog or readiness checklist lists all unresolved questions, their current status, and whether they block implementation. |
| Next action | Seed the worklog with a dedicated open-questions section and keep it current. |

### 5. Phase 1 And Phase 2 Boundary

| Field | Value |
| --- | --- |
| Status | Ready |
| Gate | Must Resolve |
| Why it matters | The team needs a shared rule for what can proceed now versus what must wait for additional closure. |
| Evidence | The phases doc, worklog, and implemented handler seam now all point to the same narrow boundary: structural webhook refactor only. |
| Acceptance criteria | The readiness artifacts clearly state that Explorer is ready for the approved Phase 1 slice only, and they identify which unresolved items still block Phase 2+. |
| Next action | Keep the current go decision updated as new slices are approved. |

## Should Resolve Before Phase 2 Starts

### 1. Backend Test Organization

| Field | Value |
| --- | --- |
| Status | Partial |
| Gate | Should Resolve |
| Why it matters | The repo already has a strong backend test pattern. Explorer should fit it rather than improvise. |
| Evidence | Existing tests under `server/src/__tests__` use the in-memory [setupTestDb](../../server/src/__tests__/setupTestDb.ts) pattern and helper utilities. |
| Acceptance criteria | The implementation plan names where Explorer service, router, and integration tests will live and states that they will use the existing in-memory SQLite setup unless a stronger reason appears. |
| Next action | Record the intended test layout in the worklog before Phase 2 begins. |

### 2. E2E Data Strategy

| Field | Value |
| --- | --- |
| Status | Partial |
| Gate | Should Resolve |
| Why it matters | Explorer UI and admin flows will need end-to-end coverage, and the repository already enforces a separate E2E database model. |
| Evidence | [AGENTS.md](../../AGENTS.md) defines `wmv_e2e.db` as the dedicated E2E environment and warns against mixing databases. |
| Acceptance criteria | The implementation plan explains how Explorer E2E scenarios will be created and validated without relying on accidental shared state. |
| Next action | Decide whether Explorer test data will be created during test setup or introduced through intentional E2E fixtures. |

### 3. Documentation Impact Plan

| Field | Value |
| --- | --- |
| Status | Partial |
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
| Next action | Keep later slices equally narrow and tie the next PR to Phase 2 preparation instead of reopening Phase 1. |

## Safe To Defer If Recorded Explicitly

| Item | Status | Gate | Notes |
| --- | --- | --- | --- |
| Virtual versus outdoor labels in the checklist | Deferred | Safe To Defer | Not required for v1 matching correctness. |
| Match retraction when a source activity is deleted | Partial | Safe To Defer | Can remain an explicit unresolved rule if v1 behavior is documented. |
| Season-wide rollup caching strategy | Deferred | Safe To Defer | Weekly history durability matters first. |
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
| Ready For New Phase 2 Preparation PR | Yes |
| Ready For Broad Feature Implementation | No |

If this file says anything stronger than **Phase 1 Complete; Ready For New Phase 2 Preparation PR**, the linked worklog should show exactly what changed to justify that shift.