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

**Status:** Phase 1 Complete; Campaign-First Explorer Correction Landed; Phase 4A Admin Backend Complete; Phase 4B-1 E2E Harness Hardening Merged; Phase 4B-2 Minimal Admin UI Merged; Phase 4B-3 Campaign Decoupling And Unified Admin Shell Merged; Ready For Phase 4B-4 Admin Workflow Hierarchy And Destination Management

Explorer has completed the narrow Phase 1 webhook-orchestration slice that preserves current competition behavior while introducing delegated in-process handlers. The planning set corrected Explorer to a campaign-first model with campaign-owned date boundaries, returned `Season` to competition-only semantics, deferred overlapping or nested campaign structures, and locked a no-overlap Explorer rule for v1. That structural correction is now implemented on `main`, so the next recommended work is a bounded 4B-4 admin workflow hierarchy slice that makes the current-or-next campaign the main working surface and moves destination management ahead of lower-priority planning controls.

The current 4B-4 boundary is explicit: treat the current active campaign, or the next upcoming campaign when none is active, as primary; keep campaign creation prominent only when no such campaign exists; make destination authoring and review the dominant workflow; keep metadata editing collapsed by default; allow simple confirmed destination removal; and avoid broadening into real search, reorder, reporting, or map work in the same slice.

## Current Status Summary

| Area | Status | Notes |
| --- | --- | --- |
| Product framing | Ready | The PRD is now aligned to a campaign-first Explorer model with campaign-owned dates and competition-only `Season` semantics. |
| Execution phasing | Ready For Phase 4B-4 | The phases doc now records 4B-3 as merged and names 4B-4 as the admin workflow hierarchy and destination-management slice. |
| Architecture closure | Ready For Bounded Admin Refinement | The campaign-first correction is merged, so follow-on work can focus on workflow hierarchy instead of reopening the structural model. |
| Open questions handling | Ready | The worklog now records the superseded season-attached decision and the locked no-overlap rule. |
| Blocking research closure | Ready For Phase 4B-4 | The product-model correction is closed and the next work is a bounded admin workflow refinement slice. |
| Test planning | Ready For Phase 4B-4 | The next test-planning work is attached to workflow hierarchy, destination deletion, and admin-surface behavior rather than model correction. |
| Documentation impact plan | Ready For Phase 4B-4 | The next documentation impact is slice-local planning-state maintenance plus any admin-flow notes created by 4B-4. |

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
| Next action | Carry the locked storage responsibilities and DB-first segment reuse policy into 4B-3, and treat any future coordinate or geometry storage for maps as a later non-blocking expansion rather than as part of this UI slice. |

### 4. Centralized Open Questions

| Field | Value |
| --- | --- |
| Status | Ready |
| Gate | Must Resolve |
| Why it matters | Scattered uncertainty forces implementation chats to rediscover unresolved design choices. |
| Evidence | The worklog open-questions table now reflects the corrected campaign model and remaining non-blocking questions. |
| Acceptance criteria | One section in the worklog or readiness checklist lists all unresolved questions, their current status, and whether they block implementation. |
| Next action | Seed the worklog with a dedicated open-questions section and keep it current. |

### 5. Phase 1 To Phase 4A Boundary

| Field | Value |
| --- | --- |
| Status | Ready |
| Gate | Must Resolve |
| Why it matters | The team needs a shared rule for what can proceed now that the campaign-first correction has landed and the admin surface is entering a narrower workflow-refinement phase. |
| Evidence | The implemented webhook seam remains valid, 4A, 4B-1, 4B-2, and 4B-3 are merged, and the next slice is now re-approved as Phase 4B-4 admin workflow hierarchy plus confirmed destination management. |
| Acceptance criteria | The readiness artifacts clearly state that Explorer is ready for one bounded admin-refinement slice next and identify what remains out of scope. |
| Next action | Keep the current go decision updated as additional corrected Explorer slices are approved or deferred, and close slice-local planning state in the implementation PR when the slice changes readiness or phase status. |

## Should Resolve Before 4A And 4B Expand

### 1. Backend Test Organization

| Field | Value |
| --- | --- |
| Status | Completed For 4A |
| Gate | Should Resolve |
| Why it matters | The repo already has a strong backend test pattern. Explorer should fit it rather than improvise. |
| Evidence | The landed 4A backend slice added service and router tests under `server/src/__tests__` using the existing in-memory [setupTestDb](../../server/src/__tests__/setupTestDb.ts) pattern and helper utilities. |
| Acceptance criteria | The admin backend slice uses the established in-memory SQLite backend test pattern for service and router coverage. |
| Next action | Reuse the same backend fixtures and admin-auth patterns when 4B UI work needs supporting service coverage. |

### 2. E2E Data Strategy

| Field | Value |
| --- | --- |
| Status | Completed For 4B-1 |
| Gate | Should Resolve |
| Why it matters | Explorer admin UI flows and the existing Playwright suite need repeatable end-to-end coverage, and the current code path reaches outbound Strava services from the backend during destination authoring and some read flows. |
| Evidence | The backend now has an explicit E2E mode in [server/src/config.ts](../../server/src/config.ts), the E2E database resets from the committed sanitized fixture [server/data/wmv_e2e_fixture.db](../../server/data/wmv_e2e_fixture.db), and deterministic read-side Strava behavior now flows through explicit providers in [server/src/services/segmentMetadataProvider.ts](../../server/src/services/segmentMetadataProvider.ts) and [server/src/services/stravaReadProvider.ts](../../server/src/services/stravaReadProvider.ts) rather than through scattered service-level `isE2EMode()` branches. Full validation is green, including `npm test`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`, and `npm run build`. |
| Acceptance criteria | Explorer and existing E2E scenarios run against an explicit backend E2E mode, deterministic campaign and leaderboard data are provisioned without copying a contributor's local development database, and outbound Strava-dependent behavior is selected through explicit providers rather than scattered feature-level short-circuits. |
| Next action | Preserve the centralized E2E-mode and explicit-provider discipline as 4B-4 refines the admin workflow on top of the merged campaign-first baseline. |

### 3. Documentation Impact Plan

| Field | Value |
| --- | --- |
| Status | Ready For Phase 4B-4 |
| Gate | Should Resolve |
| Why it matters | Explorer touches admin, athlete, API, database, and release-note surfaces. That work should be visible before coding. |
| Evidence | The 4A slice updated `docs/API.md`, `docs/DATABASE_DESIGN.md`, and the slice-local planning docs, while 4B-3 carried the structural correction. The 4B-4 slice is expected to update slice-local planning docs and any admin guidance touched by the workflow shift. |
| Acceptance criteria | The worklog or implementation slice names the docs expected to change when the slice lands, including any slice-local planning docs needed to close the state transition. |
| Next action | Keep the documentation-impact checklist current and treat 4B-4 planning-state maintenance plus any admin-flow notes as the next expected update set. |

### 4. Smallest End-To-End Slice

| Field | Value |
| --- | --- |
| Status | Completed |
| Gate | Should Resolve |
| Why it matters | Explorer should not start with a multi-surface implementation burst. |
| Evidence | The worklog now records the completed Phase 1 webhook-orchestrator slice, including validation expectations and explicit out-of-scope items. |
| Acceptance criteria | One narrow slice was named, bounded, tied to Phase 1, and validated through the focused webhook regression tests. |
| Next action | Keep later slices equally narrow and tie the next PR to 4B admin-gated UI instead of reopening landed backend work. |

## Safe To Defer If Recorded Explicitly

| Item | Status | Gate | Notes |
| --- | --- | --- | --- |
| Virtual versus outdoor labels in the checklist | Deferred | Safe To Defer | Not required for v1 matching correctness. |
| Match retraction when a source activity is deleted | Partial | Safe To Defer | Can remain an explicit unresolved rule if v1 behavior is documented. |
| Cross-campaign rollup caching strategy | Deferred | Safe To Defer | Campaign history durability matters first. |
| Post-MVP ideas from the ideas backlog | Deferred | Safe To Defer | Keep them isolated in the ideas file. |

## Execution Preconditions For The Next Slice

Before any Explorer implementation slice starts, it should explicitly reference:

1. One approved phase from [wmv-explorer-destinations-phases.md](./wmv-explorer-destinations-phases.md).
2. One or more exact sections of [wmv-explorer-destinations-tech-spec.md](./wmv-explorer-destinations-tech-spec.md) that govern the slice.
3. The status of any blocking checklist items from this document.
4. The expected validation path, such as backend tests, E2E checks, linting, typechecking, build verification, or documentation updates.
5. The documentation surfaces expected to change for that slice.

If a slice is expected to change the approved next step, readiness wording, or phase completion state, its implementation brief should also say whether the dev-agent is expected to update those planning docs before the PR is complete.

## Sign-Off

| Decision | Current State |
| --- | --- |
| Phase 1 Complete | Yes |
| Campaign-First Explorer Correction Landed | Yes |
| Phase 4B-3 Campaign Decoupling And Unified Admin Shell Merged | Yes |
| Phase 4A Admin Backend Complete | Yes |
| Phase 4B-1 E2E Harness Hardening Merged | Yes |
| Phase 4B-2 Minimal Admin UI Merged | Yes |
| Ready For Phase 4B-4 Admin Workflow Hierarchy And Destination Management | Yes |
| Ready For Broad Feature Implementation | No |

If this file says anything stronger than **Phase 1 Complete; Campaign-First Explorer Correction Landed; Phase 4A Admin Backend Complete; Phase 4B-1 E2E Harness Hardening Merged; Phase 4B-2 Minimal Admin UI Merged; Phase 4B-3 Campaign Decoupling And Unified Admin Shell Merged; Ready For Phase 4B-4 Admin Workflow Hierarchy And Destination Management**, the linked worklog should show exactly what changed to justify that shift.