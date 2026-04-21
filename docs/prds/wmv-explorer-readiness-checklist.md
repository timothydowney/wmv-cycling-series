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

**Status:** Phase 1 Complete; Campaign-First Explorer Correction Landed; Phase 4A Admin Backend Complete; Phase 4B-1 E2E Harness Hardening Merged; Phase 4B-2 Minimal Admin UI Merged; Phase 4B-3 Campaign Decoupling And Unified Admin Shell Merged; Phase 4B-4 Admin Workflow Hierarchy And Destination Management Merged; Phase 4B-5 Segment Metadata Fidelity And Freshness Merged; Phase 5A Athlete Hub Read Surface Merged; Ready For Phase 5B Checklist And Browse Refinement

Explorer has completed the narrow Phase 1 webhook-orchestration slice that preserves current competition behavior while introducing delegated in-process handlers. The planning set corrected Explorer to a campaign-first model with campaign-owned date boundaries, returned `Season` to competition-only semantics, deferred overlapping or nested campaign structures, and locked a no-overlap Explorer rule for v1. The shared segment metadata-fidelity slice and the first admin-gated athlete hub read surface are now merged on `main`, so the next recommended work is a deliberately small 5B refinement slice that improves checklist scanning for larger campaigns without opening public release, map, or social scope.

The current 5B boundary is explicit: keep the merged admin flow, shared segment metadata baseline, and 5A athlete page intact; refine how larger destination sets are scanned inside the existing Hub and Destinations structure; stay admin-gated until release approval; and avoid broadening into public release, map-provider decisions, geolocation, or social-feed behavior in the same slice.

## Current Status Summary

| Area | Status | Notes |
| --- | --- | --- |
| Product framing | Ready | The PRD is now aligned to a campaign-first Explorer model with campaign-owned dates and competition-only `Season` semantics. |
| Execution phasing | Ready For Phase 5B | The phases doc now records 5A as merged and names 5B as the next bounded checklist and browse refinement slice. |
| Architecture closure | Ready For Checklist Refinement | The campaign-first correction, current admin hierarchy, shared segment metadata baseline, and first athlete read surface are merged, so follow-on work can focus on list usability rather than reopening the admin shell or first-page foundations. |
| Open questions handling | Ready | The worklog now records the superseded season-attached decision and the locked no-overlap rule. |
| Blocking research closure | Ready For Phase 5B | The next slice remains list-first and admin-gated, so map-provider, public-release, and social-feed questions remain explicitly deferred rather than blocking browse refinement. |
| Test planning | Ready For Phase 5B | The next test-planning work is attached to larger-list presentation, lightweight browse aids, and protected-route behavior rather than new admin-shell work. |
| Documentation impact plan | Ready For Phase 5B | The next documentation impact is slice-local planning-state maintenance plus any athlete Explorer UX or API notes created by 5B. |

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
| Status | Ready For 5B |
| Gate | Must Resolve |
| Why it matters | Engineering should not start building around two competing summary models. |
| Evidence | The corrected technical spec explicitly chooses computed on read for `ExplorerAthleteCampaignSummary`, with `ExplorerDestinationMatch` as the durable source of truth, and the merged 5A athlete hub already reads from that model. |
| Acceptance criteria | The 5B slice preserves the computed-on-read summary model and does not introduce a cached-summary table just to power browse or checklist refinements. |
| Next action | Carry the locked summary decision into the 5B implementation brief and tests. |

### 3. Explorer Destination Metadata Strategy

| Field | Value |
| --- | --- |
| Status | Ready For 5B |
| Gate | Must Resolve |
| Why it matters | Explorer destination setup depends on how segment data is validated, stored, and displayed over time. |
| Evidence | Explorer continues to reuse shared segment rows for distance and location reads, 4B-5 landed the stored coordinate and metadata-freshness baseline, and 5A now consumes that data in the athlete-facing read surface without forcing map rendering into the first athlete slice. |
| Acceptance criteria | The 5B slice reuses the existing DB-first destination and progress model, keeps shared segment metadata as the source of destination detail, and does not introduce map-specific storage, geolocation prompts, or Explorer-only refresh logic. |
| Next action | Carry the locked DB-first storage policy and existing shared segment metadata into 5B while keeping map-provider, geometry, and discovery-map work deferred to later Phase 5 slices. |

### 4. Centralized Open Questions

| Field | Value |
| --- | --- |
| Status | Ready |
| Gate | Must Resolve |
| Why it matters | Scattered uncertainty forces implementation chats to rediscover unresolved design choices. |
| Evidence | The worklog open-questions table now reflects the corrected campaign model, the admin-gated athlete-page decision for 5A, and the remaining non-blocking map or social follow-on questions. |
| Acceptance criteria | One section in the worklog or readiness checklist lists all unresolved questions, their current status, and whether they block implementation. |
| Next action | Seed the worklog with a dedicated open-questions section and keep it current. |

### 5. Phase 1 To Phase 4A Boundary

| Field | Value |
| --- | --- |
| Status | Ready For 5B |
| Gate | Must Resolve |
| Why it matters | The team needs a shared rule for what can proceed now that the campaign-first correction, admin workflow hierarchy, shared segment metadata baseline, and first athlete hub read surface are all merged. |
| Evidence | The implemented webhook seam remains valid, 4A through 5A are merged, and the next slice is now approved as Phase 5B checklist and browse refinement. |
| Acceptance criteria | The readiness artifacts clearly state that Explorer is ready for one bounded checklist-refinement slice next and identify public release, map, and social follow-ons as out of scope. |
| Next action | Keep the current go decision updated as additional athlete-facing Explorer slices are approved or deferred, and close slice-local planning state in the implementation PR when the slice changes readiness or phase status. |

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
| Next action | Preserve the centralized E2E-mode and explicit-provider discipline as 4B-5 refines shared segment metadata on top of the merged campaign-first baseline. |

### 3. Documentation Impact Plan

| Field | Value |
| --- | --- |
| Status | Ready For Phase 5B |
| Gate | Should Resolve |
| Why it matters | Explorer touches admin, athlete, API, database, and release-note surfaces. That work should be visible before coding. |
| Evidence | The 4A slice updated `docs/API.md`, `docs/DATABASE_DESIGN.md`, and the slice-local planning docs, while 4B-3 through 5A carried the structural correction, admin workflow refinement, shared segment metadata baseline, and first athlete read surface. The 5B slice is expected to update slice-local planning docs and any athlete Explorer UX or API documentation that changes when browse refinement lands. |
| Acceptance criteria | The worklog or implementation slice names the docs expected to change when 5B lands, including any slice-local planning docs needed to close the state transition. |
| Next action | Keep the documentation-impact checklist current and treat 5B planning-state maintenance plus any athlete Explorer UX or API notes as the next expected update set. |

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
| Phase 4B-4 Admin Workflow Hierarchy And Destination Management Merged | Yes |
| Phase 4A Admin Backend Complete | Yes |
| Phase 4B-1 E2E Harness Hardening Merged | Yes |
| Phase 4B-2 Minimal Admin UI Merged | Yes |
| Phase 4B-5 Segment Metadata Fidelity And Freshness Merged | Yes |
| Phase 5A Athlete Hub Read Surface Merged | Yes |
| Ready For Phase 5B Checklist And Browse Refinement | Yes |
| Ready For Broad Feature Implementation | No |

If this file says anything stronger than **Phase 1 Complete; Campaign-First Explorer Correction Landed; Phase 4A Admin Backend Complete; Phase 4B-1 E2E Harness Hardening Merged; Phase 4B-2 Minimal Admin UI Merged; Phase 4B-3 Campaign Decoupling And Unified Admin Shell Merged; Phase 4B-4 Admin Workflow Hierarchy And Destination Management Merged; Phase 4B-5 Segment Metadata Fidelity And Freshness Merged; Phase 5A Athlete Hub Read Surface Merged; Ready For Phase 5B Checklist And Browse Refinement**, the linked worklog should show exactly what changed to justify that shift.