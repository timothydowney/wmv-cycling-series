# WMV Explorer Destinations Worklog

This worklog is the active operating log for Explorer. The readiness checklist is the gate. This file is where decisions, blockers, next slices, and issue candidates move over time.

## Current Focus

- Correct the planning set from a weekly-first Explorer model to a season-campaign-first MVP.
- Remove optional mini-campaign and status-workflow complexity from MVP planning.
- Produce the smallest safe implementation slice against the corrected season campaign model.

## Current Go State

- **Readiness:** Phase 1 Complete; Season-Campaign Correction Landed; Ready For Narrow Corrected Implementation Slice
- **Immediate scope:** one bounded implementation PR correcting the Explorer data model and matching/query paths to a season-attached campaign
- **Not yet in scope:** mini-campaigns, explicit publish-status workflows, full admin UI, or full athlete hub UI

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

## Open Questions

| Question | Status | Blocks Implementation | Notes |
| --- | --- | --- | --- |
| Should Explorer be season-campaign-first or weekly-first in MVP? | Closed | Yes | Closed in favor of season-campaign-first attached to the existing season model. |
| Should optional mini-campaigns within a season remain in MVP? | Closed | Yes | Closed in favor of removing them from MVP and deferring them to later planning. |
| Does MVP need an explicit Explorer status workflow such as `draft` or `archived`? | Closed For MVP | Yes | Closed in favor of no explicit status field unless later implementation proves it is needed. |
| Should athlete campaign summaries be computed on read or stored in a cached summary table for v1? | Closed For v1 | No | V1 uses computed-on-read summaries with `ExplorerDestinationMatch` as the durable source of truth. |
| Should Explorer reuse the existing segment table, store Explorer-local cached metadata, or do both? | Closed For v1 | No | V1 uses a hybrid strategy: shared segment reuse when present plus Explorer-local cached display metadata. |
| How should webhook regression protection be documented for the delegated-handler refactor? | Closed For Phase 1 | No | The preservation target now lives in this worklog and the handler seam is covered by focused webhook tests. |
| What is the exact E2E data strategy for Explorer flows? | Open | No | Should be defined before Phase 2 starts. |
| Should deleted source activities retract Explorer completions in v1? | Open | No | Safe to defer if behavior is documented. |

## Blockers

### Must Resolve Before Broad Implementation

1. Correct the primary Explorer model to season-campaign-first across the planning set.
2. Re-scope MVP so optional mini-campaigns are explicitly deferred.
3. Re-approve the next implementation slice against the corrected model before more Explorer coding continues.

Resolution:

- These planning blockers are now closed on this branch.

### Should Resolve Before Phase 2

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

### Planning Correction: Season Campaign Model

- Phase: Phase 2
- Goal: change the source-of-truth planning set so Explorer is a season-attached campaign, not a weekly-first challenge model
- Why this matters: the current implementation branch and planning docs were shaped around the wrong primary concept

### Recommended Next PR

- Start from updated `main` on a dedicated implementation branch only after this planning correction lands.
- Keep the next implementation PR scoped to the corrected campaign model only:
	- campaign schema attached to `season`
	- destination and match schema keyed to the campaign
	- matching service correction from week windows to season windows
	- corrected query routes for active campaign and athlete progress
	- backend tests for campaign boundaries, idempotency, and add-destination behavior
- Keep out of scope for that PR:
	- mini-campaigns inside a season
	- explicit Explorer publish-status workflows
	- full admin UI
	- full athlete hub UI

## Issue Candidates

- Correct Explorer planning set to season-campaign-first MVP
- Implement corrected Explorer campaign schema and matching service
- Re-scope Explorer admin and hub work to the corrected campaign model

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