# WMV Explorer Destinations Worklog

This worklog is the active operating log for Explorer. The readiness checklist is the gate. This file is where decisions, blockers, next slices, and issue candidates move over time.

## Current Focus

- Close Phase 1 cleanly and keep the branch ready for a dedicated PR.
- Mark the webhook seam complete without quietly expanding into Phase 2 work.
- Prepare the next Explorer PR to focus on Phase 2 preparation decisions.

## Current Go State

- **Readiness:** Phase 1 Complete; Ready For New Phase 2 Preparation PR
- **Immediate scope:** close this branch as the Phase 1 PR and begin the next branch with Phase 2 preparation decisions only
- **Not yet in scope:** broad Phase 2 schema or UI implementation until the remaining design blockers are closed

## Decisions Made

- Explorer is the first pilot for a broader PRD-first workflow in this repository.
- The current source of truth remains the Destinations planning set, not the older Seasons naming.
- VS Code is the primary environment for planning and implementation work.
- The existing `dev-agent` remains the default implementation agent for coding work.
- Skills should carry the reusable workflow knowledge because they are portable across VS Code, Copilot CLI, and cloud agents.
- GitHub issues remain secondary for now; local planning docs stay primary until slices are stable enough to externalize cleanly.
- Phase 1 is approved only as a structural webhook slice: preserve current behavior first, add Explorer matching later.
- Phase 1 is complete on this branch: the shared activity-ingestion context, sequential delegated handlers, explicit handler order, and preservation tests are in place.

## Open Questions

| Question | Status | Blocks Implementation | Notes |
| --- | --- | --- | --- |
| Should athlete week summaries be computed on read or stored in a cached summary table for v1? | Open | Yes | Tech spec currently leaves this as conditional. |
| Should Explorer reuse the existing segment table, store Explorer-local cached metadata, or do both? | Open | Yes | Existing UI parsing is proven, but final storage rules are not. |
| How should webhook regression protection be documented for the delegated-handler refactor? | Closed For Phase 1 | No | The preservation target now lives in this worklog and the handler seam is covered by focused webhook tests. |
| What is the exact E2E data strategy for Explorer flows? | Open | No | Should be defined before Phase 2 starts. |
| Should deleted source activities retract Explorer completions in v1? | Open | No | Safe to defer if behavior is documented. |

## Blockers

### Must Resolve Before Broad Implementation

1. Decide the v1 summary model.
2. Decide the v1 destination metadata strategy.
3. Keep unresolved questions centralized rather than scattered across planning docs.

### Should Resolve Before Phase 2

1. Name Explorer backend test locations and test shape.
2. Define the E2E data approach.
3. List documentation surfaces expected to change when Explorer slices land.

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

### Slice Candidate B: Summary Model Decision

- Phase: Phase 2 preparation
- Goal: choose computed-on-read versus cached-summary for v1 and update the technical spec accordingly
- Why this matters: it stabilizes query-service design and schema decisions

### Slice Candidate C: Destination Metadata Strategy

- Phase: Phase 2 preparation
- Goal: define how Explorer destination setup reuses segment validation and metadata from the current admin flow
- Why this matters: it stabilizes admin-service and schema direction

### Recommended Next PR

- Start a fresh Phase 2 preparation branch from updated `main` after this Phase 1 branch lands.
- Keep the next PR focused on the athlete summary model, destination metadata strategy, test layout, and E2E data approach.
- Do not mix those decisions with schema or UI implementation unless the blockers are explicitly closed in the same PR.

## Issue Candidates

- Decide and document Explorer athlete week summary strategy
- Decide and document Explorer destination metadata strategy
- Define Explorer test layout and E2E data plan

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