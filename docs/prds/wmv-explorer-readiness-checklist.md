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

**Status:** Phase 1 Complete; Campaign-First Explorer Correction Landed; Phase 4A Admin Backend Complete; Phase 4B-1 E2E Harness Hardening Merged; Phase 4B-2 Minimal Admin UI Merged; Phase 4B-3 Campaign Decoupling And Unified Admin Shell Merged; Phase 4B-4 Admin Workflow Hierarchy And Destination Management Merged; Phase 4B-5 Segment Metadata Fidelity And Freshness Merged; Phase 5A Athlete Hub Read Surface Merged; Phase 5B Checklist And Browse Refinement Merged; Phase 5C Pinned Destinations And Hub Prioritization Merged

Explorer has completed the narrow Phase 1 webhook-orchestration slice that preserves current competition behavior while introducing delegated in-process handlers. The planning set corrected Explorer to a campaign-first model with campaign-owned date boundaries, returned `Season` to competition-only semantics, deferred overlapping or nested campaign structures, and locked a no-overlap Explorer rule for v1. The shared segment metadata-fidelity slice, the first admin-gated athlete hub read surface, the lightweight browse refinement, and athlete-specific pinned-destination prioritization are now merged on `main`. The broader auth-access tightening is also merged on `main`, so signed-out users now see one branded WMV sign-in or join shell instead of leaderboard or Explorer data by default.

The current post-auth boundary is explicit: keep the merged admin flow, shared segment metadata baseline, 5A through 5C athlete page, and tighter signed-out app posture intact; do not broaden into public release, map-provider decisions, geolocation, or social-feed behavior until a later Explorer slice is explicitly re-approved through planning.

## Current Status Summary

| Area | Status | Notes |
| --- | --- | --- |
| Product framing | Ready | The PRD is now aligned to a campaign-first Explorer model with campaign-owned dates and competition-only `Season` semantics. |
| Execution phasing | Phase 5C Merged | The phases doc now records 5C as merged and leaves later Explorer rollout slices in candidate status pending renewed approval. |
| Architecture closure | Personalization Baseline Landed | The campaign-first correction, current admin hierarchy, shared segment metadata baseline, and merged athlete browse plus pinning surface are in place, so future Explorer work can build from a stable personalization baseline rather than reopening the admin shell or browse foundations. |
| Open questions handling | Ready | The worklog now records the superseded season-attached decision and the locked no-overlap rule. |
| Blocking research closure | Deferred Pending Re-approval | Public-release, map-provider, and social-feed questions remain explicitly deferred and should be re-evaluated only when Explorer planning resumes. |
| Test planning | Auth Slice Merged | The merged auth-access slice covers locked signed-out entry behavior; the next test-planning work should wait for a newly approved Explorer slice. |
| Documentation impact plan | Auth Closeout Recorded | The current documentation impact is the recorded auth-slice outcome plus the return-to-planning boundary for later Explorer work. |

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
| Status | Completed Through 5C |
| Gate | Must Resolve |
| Why it matters | Engineering should not start building around two competing summary models. |
| Evidence | The corrected technical spec explicitly chooses computed on read for `ExplorerAthleteCampaignSummary`, with `ExplorerDestinationMatch` as the durable source of truth, and the merged 5A athlete hub already reads from that model. |
| Acceptance criteria | The merged 5C slice preserves the computed-on-read summary model and does not introduce a cached-summary table just to power athlete-specific pinned destinations or hub prioritization. |
| Next action | Reuse the locked summary decision if a later Explorer slice is approved. |

### 3. Explorer Destination Metadata Strategy

| Field | Value |
| --- | --- |
| Status | Completed Through 5C |
| Gate | Must Resolve |
| Why it matters | Explorer destination setup depends on how segment data is validated, stored, and displayed over time. |
| Evidence | Explorer continues to reuse shared segment rows for distance and location reads, 4B-5 landed the stored coordinate and metadata-freshness baseline, and 5A now consumes that data in the athlete-facing read surface without forcing map rendering into the first athlete slice. |
| Acceptance criteria | The merged 5C slice reuses the existing DB-first destination and progress model, keeps shared segment metadata as the source of destination detail, and does not introduce map-specific storage, geolocation prompts, or Explorer-only refresh logic. |
| Next action | Reuse the locked DB-first storage policy if a later Explorer slice is approved, while keeping map-provider, geometry, and discovery-map work deferred until then. |

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
| Status | Ready For Re-Planning |
| Gate | Must Resolve |
| Why it matters | The team needs a shared rule for what can proceed now that the campaign-first correction, admin workflow hierarchy, shared segment metadata baseline, and pinned personalization slice are all merged. |
| Evidence | The implemented webhook seam remains valid, 4A through 5C are now merged on `main`, the merged auth-access work locks signed-out users to a single WMV join shell, and no further Explorer rollout slice is currently re-approved. |
| Acceptance criteria | The readiness artifacts clearly state that 5C has landed, the auth-access outcome is recorded on `main`, and later Explorer rollout still needs renewed approval through planning. |
| Next action | Keep the current go decision updated as additional athlete-facing Explorer slices are approved or deferred, and return to planning before naming another implementation PR. |

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
| Status | Auth Closeout Recorded |
| Gate | Should Resolve |
| Why it matters | Explorer touches admin, athlete, API, database, and release-note surfaces. That work should be visible before coding. |
| Evidence | The 4A slice updated `docs/API.md`, `docs/DATABASE_DESIGN.md`, and the slice-local planning docs, while 4B-3 through 5C carried the structural correction, admin workflow refinement, shared segment metadata baseline, athlete read surface, browse refinement, and pinned-destination prioritization. The merged auth-access slice is now recorded alongside that Explorer baseline and restores the return-to-planning boundary. |
| Acceptance criteria | The worklog or planning set records 5C as merged, records the auth-access outcome on `main`, and leaves later Explorer rollout work unapproved until planning resumes. |
| Next action | Keep the documentation-impact checklist current if a later Explorer slice is approved. |

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
| Phase 5B Checklist And Browse Refinement Merged | Yes |
| Phase 5C Pinned Destinations And Hub Prioritization Merged | Yes |
| Ready For Broad Feature Implementation | No |

If this file says anything stronger than **Phase 1 Complete; Campaign-First Explorer Correction Landed; Phase 4A Admin Backend Complete; Phase 4B-1 E2E Harness Hardening Merged; Phase 4B-2 Minimal Admin UI Merged; Phase 4B-3 Campaign Decoupling And Unified Admin Shell Merged; Phase 4B-4 Admin Workflow Hierarchy And Destination Management Merged; Phase 4B-5 Segment Metadata Fidelity And Freshness Merged; Phase 5A Athlete Hub Read Surface Merged; Phase 5B Checklist And Browse Refinement Merged; Phase 5C Pinned Destinations And Hub Prioritization Merged**, the linked worklog should show exactly what changed to justify that shift.