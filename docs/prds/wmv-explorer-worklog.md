# WMV Explorer Destinations Worklog

This worklog is the active operating log for Explorer. The readiness checklist is the gate. This file is where decisions, blockers, next slices, and issue candidates move over time.

## Current Focus

- Prepare Phase 4B as a narrow admin-gated UI slice on top of the landed 4A backend contract.
- Keep any pre-release Explorer UI admin-gated until there is an explicit end-user release decision.
- Keep the next handoff and implementation brief aligned with the landed backend authoring contract.

## Current Go State

- **Readiness:** Phase 1 Complete; Season-Campaign Correction Landed; Backend Campaign Slice Merged; Phase 4A Admin Backend Complete; Ready For Phase 4B Admin-Gated UI Slice
- **Immediate scope:** one bounded implementation PR for Explorer admin-gated setup UI against the existing season-attached campaign model and landed 4A backend contract
- **Not yet in scope:** public athlete-facing Explorer release, public navigation to Explorer, mini-campaigns, or explicit publish-status workflows

## Decisions Made

- Explorer is the first pilot for a broader PRD-first workflow in this repository.
- The current source of truth remains the Destinations planning set, not the older Seasons naming.
- VS Code is the primary environment for planning and implementation work.
- The existing `dev-agent` remains the default implementation agent for coding work.
- Skills should carry the reusable workflow knowledge because they are portable across VS Code, Copilot CLI, and cloud agents.
- GitHub issues remain secondary for now; local planning docs stay primary until slices are stable enough to externalize cleanly.
- Phase 1 is approved only as a structural webhook slice: preserve current behavior first, add Explorer matching later.
- Phase 1 is complete on this branch: the shared activity-ingestion context, sequential delegated handlers, explicit handler order, and preservation tests are in place.
- The previous Explorer planning set and PR #23 used the wrong primary model: weekly Explorer challenges first, with season-wide support deferred.
- MVP should instead be season-campaign-first, attached to an existing WMV season, with optional mini-campaigns deferred.
- MVP does not currently justify explicit Explorer `draft` / `active` / `archived` workflow complexity; season dates and destination presence should control visibility unless later implementation proves otherwise.
- V1 athlete campaign summary is computed on read, with `ExplorerDestinationMatch` as the durable source of truth.
- V1 destination metadata uses a hybrid strategy: reuse shared segment data when present, while storing Explorer-local cached display metadata and source URL values for stable setup and rendering.
- If Explorer UI is touched before public release, it stays admin-only and does not add public navigation.
- V1 permits exactly one Explorer campaign per season; this should be enforced in the admin backend without blocking future multi-season support.
- 4A destination authoring accepts validated Strava segment URLs, not raw segment IDs.
- If URL parsing succeeds but live Strava metadata enrichment fails, destination creation still succeeds with stored segment ID and source URL.
- Refresh and backfill admin mutations are deferred out of 4A.

## Open Questions

| Question | Status | Blocks Implementation | Notes |
| --- | --- | --- | --- |
| Should Explorer be season-campaign-first or weekly-first in MVP? | Closed | Yes | Closed in favor of season-campaign-first attached to the existing season model. |
| Should optional mini-campaigns within a season remain in MVP? | Closed | Yes | Closed in favor of removing them from MVP and deferring them to later planning. |
| Does MVP need an explicit Explorer status workflow such as `draft` or `archived`? | Closed For MVP | Yes | Closed in favor of no explicit status field unless later implementation proves it is needed. |
| Should athlete campaign summaries be computed on read or stored in a cached summary table for v1? | Closed For v1 | No | V1 uses computed-on-read summaries with `ExplorerDestinationMatch` as the durable source of truth. |
| Should Explorer reuse the existing segment table, store Explorer-local cached metadata, or do both? | Closed For v1 | No | V1 uses a hybrid strategy: shared segment reuse when present plus Explorer-local cached display metadata. |
| How should webhook regression protection be documented for the delegated-handler refactor? | Closed For Phase 1 | No | The preservation target now lives in this worklog and the handler seam is covered by focused webhook tests. |
| What is the exact E2E data strategy for Explorer flows? | Open | No | Should be defined before athlete-facing or admin UI E2E coverage starts. |
| Should deleted source activities retract Explorer completions in v1? | Open | No | Safe to defer if behavior is documented. |
| Should pre-release Explorer UI remain admin-gated until launch approval? | Closed | No | Yes. Do not expose Explorer UI to non-admin users before a viable release decision. |
| Should there be more than one Explorer campaign per season in v1? | Closed | No | No. Enforce one campaign per season in 4A while leaving room for future multi-season support. |
| Should 4A accept raw segment IDs as an admin authoring input? | Closed | No | No. Use validated Strava segment URLs only in the 4A backend contract. |
| What happens if URL parsing succeeds but live metadata enrichment fails? | Closed | No | Allow creation and preserve segment ID plus source URL for later repair. |
| Do refresh and backfill admin mutations belong in 4A? | Closed | No | No. Defer them to a later admin slice. |

## Blockers

### Must Resolve Before Broad Implementation

1. Correct the primary Explorer model to season-campaign-first across the planning set.
2. Re-scope MVP so optional mini-campaigns are explicitly deferred.
3. Re-approve the next implementation slice against the corrected model before more Explorer coding continues.

Resolution:

- These planning blockers are now closed on this branch.

### Should Resolve Before 4A And 4B Grow Broader

1. Resolved for the next slice: Explorer backend tests should live under `server/src/__tests__` and use the existing in-memory SQLite pattern.
2. Resolved for the next slice: Explorer E2E scenarios should provision their own campaign data intentionally.
3. Resolved for the next slice: Planning and implementation docs touched by the corrected slice should be listed explicitly before coding starts.

## Ready-Next Slices

### Completed Slice A: Webhook Orchestrator And Handler Seam

- Phase: Phase 1
- Goal: keep `createWebhookProcessor(...)` as the stable entrypoint while moving activity create or update processing behind a shared ingestion context and ordered handlers
- Scope:
	- build the activity-ingestion context once per event
	- fan out to registered in-process handlers
	- preserve existing competition week matching behavior
	- preserve existing chain wax tracking behavior
	- keep activity delete and athlete deauth flows intact
- Validation:
	- keep the existing webhook processor, replay, and segment-effort retry tests green
	- add focused tests for handler ordering and optional non-blocking handler failures
- Out of scope:
	- Explorer schema
	- Explorer destination matching
	- Explorer admin or athlete UI

Outcome:

- The activity path now runs through the delegated activity-ingestion pipeline.
- The handler order is explicit and regression-tested.
- Activity delete and athlete deauthorization remain adjacent to the processor by design for Phase 1.

### Current Webhook Behavior To Preserve

The approved Phase 1 slice preserves these rules from [server/src/webhooks/processor.ts](../../server/src/webhooks/processor.ts):

1. Activity create and update still resolve the participant, fetch one valid access token, capture athlete profile data, fetch activity details once, and then fan out through in-process handlers.
2. Chain wax still evaluates the first fetched activity payload before competition retry logic and remains non-blocking for competition processing.
3. Competition matching still retries missing segment efforts with the current four-attempt flow and `15s`, `45s`, `90s` backoff schedule, then matches all active overlapping seasons, evaluates week time windows, and continues past per-week failures.
4. Activity delete still removes chain wax state when relevant and then deletes stored activity-related records.
5. Athlete deauth still deletes tokens while preserving historical competition records.
6. Replay and idempotency behavior remains part of the protected webhook surface.

### Regression Coverage For Phase 1

The current preservation target is backed by:

1. [server/src/__tests__/webhookProcessor.test.ts](../../server/src/__tests__/webhookProcessor.test.ts)
2. [server/src/__tests__/webhookProcessor.activityHandlers.test.ts](../../server/src/__tests__/webhookProcessor.activityHandlers.test.ts)
3. [server/src/__tests__/webhookProcessor.segmentEffortsRetry.test.ts](../../server/src/__tests__/webhookProcessor.segmentEffortsRetry.test.ts)
4. [server/src/__tests__/webhookAdminRouter.replayEvent.test.ts](../../server/src/__tests__/webhookAdminRouter.replayEvent.test.ts)

### Completed Backend Campaign Slice

- Phase: Phase 3
- Goal: establish the season-attached Explorer campaign backend model, matching flow, and initial read surface as the base for later admin and hub work
- Why this matters: 4A should now build on the merged backend slice rather than reopening campaign-model work

### Completed Admin Backend Slice

- Phase: Slice 4A
- Goal: add the minimal Explorer admin service and tRPC surface needed to create a campaign for a season and add destinations safely
- Outcome:
	- `explorerAdmin.createCampaign` now creates the single Explorer campaign allowed per season in v1.
	- `explorerAdmin.addDestination` now accepts validated Strava segment URLs, persists source URL plus cached display metadata, and appends destinations in display order.
	- One-campaign-per-season and no-duplicate-segment-within-a-campaign rules are enforced in both service logic and the database.
	- Destination creation can proceed when URL parsing succeeds even if live metadata enrichment is temporarily unavailable.
	- Backend coverage now includes focused admin service and router tests for auth, validation, duplicate protection, metadata fallback, and in-season additions.

### Recommended Next PR

- Start from updated `main` on a dedicated implementation branch.
- Keep the next implementation PR scoped to the first pass of Phase 4B admin-gated UI:
	- admin-only route or section for Explorer campaign setup
	- create-campaign and add-destination flows using the landed 4A backend contract
	- explicit backend E2E mode wiring for repeatable admin-flow testing
	- deterministic server-side Strava segment metadata behavior for Explorer E2E coverage
	- fail-fast Explorer E2E setup so the suite does not silently fall back to shared dev state
	- keep all Explorer entry points hidden from non-admin users until there is an explicit release decision
	- admin UI states for duplicate-campaign, invalid-URL, and metadata-fallback outcomes
	- targeted UI and E2E coverage for the admin-gated flow
- Keep out of scope for that PR:
	- public athlete hub UI
	- public navigation to Explorer
	- mini-campaigns inside a season
	- explicit Explorer publish-status workflows
	- refresh and backfill mutations
	- destination reorder, edit, or remove flows unless one proves necessary to keep the UI coherent

### 4B E2E Recommendation

- Prefer a general backend E2E mode rather than a single Explorer-only env flag.
- Keep that mode narrow: it should enable test-only auth helpers, fail-fast environment validation, and dependency selection for outbound integrations.
- Do not use the general mode to hide ad hoc behavior changes deep in feature logic.
- For external calls, use explicit provider selection where needed. For example, Strava-dependent server behavior should choose live, fixture-backed, or mock-server-backed behavior intentionally rather than inferring it indirectly.
- For the first 4B pass, only one outbound Strava behavior needs to be deterministic: server-side segment metadata lookup used by `explorerAdmin.addDestination`.
- Real Strava OAuth should remain optional for exploratory manual runs only, not for regression E2E.

### 4B Implementation Handoff

- Slice: first pass of Phase 4B only.
- Branch start point: updated `main`, then a dedicated feature branch before coding.
- Governing scope: admin-only Explorer setup on top of the landed 4A backend contract, with no public Explorer exposure.
- Harness rule: keep E2E and test-mode checks centralized in config, app bootstrap, and scripts rather than scattering them through feature logic.
- Backend wiring recommendation:
	- one explicit backend E2E mode for test-only wiring
	- explicit provider selection for outbound integrations
	- fail-fast startup or test bootstrap when the expected E2E env is missing
- First outbound seam to implement: deterministic segment metadata lookup for `explorerAdmin.addDestination`.
- Existing Playwright impact:
	- keep current browser-side interception for UI-only Strava rendering tests
	- keep current e2e-login auth helper for logged-in browser coverage
	- add the new backend provider behavior only where server-side Strava calls are part of the tested flow

### 4B Branch-Ready Task List

1. Add a single backend E2E mode entrypoint in config or bootstrap and make Playwright fail fast if the intended env file is missing.
2. Add explicit provider selection for Strava-dependent backend behavior, starting with fixture-backed segment metadata for Explorer admin destination authoring.
3. Build the admin-only Explorer setup UI for create-campaign and add-destination flows.
4. Add targeted browser coverage for the admin-gated Explorer setup flow, including duplicate, invalid-URL, and metadata-fallback states.
5. Update shared docs that describe E2E behavior and the Explorer planning state so they match the implemented harness.

## 4A Planning Inputs Closed

These decisions are now closed for the 4A implementation handoff.

1. Enforce one campaign per season in 4A. Prefer database protection plus service-layer validation.
2. Accept validated Strava segment URLs only in 4A.
3. Allow creation when URL parsing succeeds even if live metadata enrichment fails.
4. Defer refresh and backfill mutations to a later admin slice.

## Issue Candidates

- Implement Explorer admin backend setup
- Add admin-gated Explorer setup UI
- Prepare the athlete-facing Explorer hub for a later release gate

## Documentation Impact Checklist

When a real implementation slice lands, review whether it changes:

- `ADMIN_GUIDE.md`
- `docs/API.md`
- `docs/DATABASE_DESIGN.md`
- `docs-site/admin/*`
- `docs-site/athlete/*`

Only in the final pre-commit pass for a user-facing implementation commit, also update:

- `CHANGELOG.md`
- `VERSION`

## Workflow Notes

- Use the readiness checklist as the gate.
- Use the execution briefing as the operational guide for VS Code, Copilot CLI, and cloud agents.
- Promote items from this worklog into GitHub issues only when they are stable, bounded, and ready to be worked independently.
- When an approved implementation slice changes the readiness state, phase status, or recommended next slice, the implementation PR should include the narrow planning-doc updates needed to close that slice. Hand back to `explorer-planner` only if closing the slice requires new product decisions, new slice boundaries, or broader planning reconciliation.