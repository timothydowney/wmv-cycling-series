# WMV Explorer Destinations Worklog

This worklog is the active operating log for Explorer. The readiness checklist is the gate. This file is where decisions, blockers, next slices, and issue candidates move over time.

## Current Focus

- Keep Phase 1 closure stable and documented.
- Lock the Phase 2 preparation decisions in the planning set.
- Launch one narrow Phase 2 implementation PR after this planning slice lands.

## Current Go State

- **Readiness:** Phase 1 Complete; Phase 2 Preparation Complete; Ready For Narrow Phase 2 Implementation Slice
- **Immediate scope:** one bounded Phase 2 Slice A covering Explorer schema, matching service, refresh-path parity, initial query routes, and backend tests
- **Not yet in scope:** broad Phase 2 implementation across schema, admin UI, athlete UI, and expanded API surface in one PR

## Decisions Made

- Explorer is the first pilot for a broader PRD-first workflow in this repository.
- The current source of truth remains the Destinations planning set, not the older Seasons naming.
- VS Code is the primary environment for planning and implementation work.
- The existing `dev-agent` remains the default implementation agent for coding work.
- Skills should carry the reusable workflow knowledge because they are portable across VS Code, Copilot CLI, and cloud agents.
- GitHub issues remain secondary for now; local planning docs stay primary until slices are stable enough to externalize cleanly.
- Phase 1 is approved only as a structural webhook slice: preserve current behavior first, add Explorer matching later.
- Phase 1 is complete on this branch: the shared activity-ingestion context, sequential delegated handlers, explicit handler order, and preservation tests are in place.
- V1 athlete week summary is computed on read, with `ExplorerDestinationMatch` as the durable source of truth.
- V1 destination metadata uses a hybrid strategy: reuse shared segment data when present, while storing Explorer-local cached display metadata and source URL values for stable setup and rendering.
- Explorer should treat segment metadata as relatively durable and reuse the existing shared `segment` table by default, while avoiding the same cache assumptions for activity details and segment-effort availability.
- Explorer should avoid duplicating the current Competition segment-based matching flow; the first Phase 2 slice should extract only the shared seam needed for Explorer while preserving current Competition behavior.
- Phase 2 Slice A will follow the existing backend in-memory test pattern and will treat Explorer E2E data as intentionally provisioned test state rather than accidental shared data.

## Open Questions

| Question | Status | Blocks Implementation | Notes |
| --- | --- | --- | --- |
| Should athlete week summaries be computed on read or stored in a cached summary table for v1? | Closed For v1 | No | V1 uses computed-on-read summaries with `ExplorerDestinationMatch` as the durable source of truth. |
| Should Explorer reuse the existing segment table, store Explorer-local cached metadata, or do both? | Closed For v1 | No | V1 uses a hybrid strategy: shared segment reuse when present plus Explorer-local cached display metadata. |
| How should webhook regression protection be documented for the delegated-handler refactor? | Closed For Phase 1 | No | The preservation target now lives in this worklog and the handler seam is covered by focused webhook tests. |
| What is the exact E2E data strategy for Explorer flows? | Closed For Phase 2 start | No | Explorer test data should be provisioned intentionally during setup or controlled fixtures, not inherited from accidental shared state. |
| Should deleted source activities retract Explorer completions in v1? | Open | No | Safe to defer if behavior is documented. |

## Blockers

### Must Resolve Before Broad Implementation

1. No additional architecture blockers remain for entry into narrow Phase 2 Slice A.
2. Broad Phase 2 still requires incremental readiness checks per slice rather than one multi-surface implementation push.

### Should Resolve Before Phase 2

1. Resolved for Slice A: Explorer backend tests should live under `server/src/__tests__` and use the existing in-memory SQLite pattern.
2. Resolved for Slice A: Explorer E2E scenarios should provision their own challenge data intentionally.
3. Resolved for Slice A: Planning and implementation docs touched by the slice should be listed explicitly before coding starts.

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

### Phase 2 Preparation Decisions Closed

- Summary model: v1 summaries are computed on read, with cached-summary storage deferred until measured query cost justifies it.
- Destination metadata strategy: v1 uses hybrid shared-segment reuse plus Explorer-local cached display metadata.
- Segment fetch policy: default to DB-first reuse of shared segment metadata, use explicit refresh when needed, and treat any in-memory cache as segment-only rather than activity-level.
- Shared seam policy: treat segment-based activity matching and persistence extraction as the first structural step inside Phase 2 Slice A, not as a separate top-level phase.
- Backend test organization: Slice A should use the existing `server/src/__tests__` in-memory SQLite pattern.
- E2E data strategy: Explorer test data should be created intentionally during setup or controlled fixtures.

### Recommended Next PR

- Start a dedicated implementation branch from updated `main` after this planning branch lands.
- Keep the next PR scoped to Phase 2 Slice A only:
	- Explorer schema tables
	- Shared segment-based match-and-persist seam extracted from current Competition paths only where needed for Explorer reuse
	- Explorer matching service
	- Shared refresh-path parity
	- Shared segment-metadata reuse policy in Explorer services
	- `explorer.getActiveWeek` and `explorer.getWeekProgress`
	- Backend tests for boundaries, idempotency, and parity
- Keep out of scope for that PR:
	- Explorer admin UI
	- Explorer hub UI
	- Expanded Explorer API surface beyond the first read paths
	- Broad rewrites of hydration, deletion, or unrelated leaderboard query services

## Issue Candidates

- Implement Explorer Phase 2 Slice A schema and matching service
- Add initial Explorer query routes for active week and athlete progress
- Add Explorer backend regression and parity coverage for the shared matching service

## Documentation Impact Checklist

When a real implementation slice lands, review whether it changes:

- `ADMIN_GUIDE.md`
- `docs/API.md`
- `docs/DATABASE_DESIGN.md`
- `docs/STRAVA_INTEGRATION.md`
- `docs-site/admin/*`
- `docs-site/athlete/*`

Only in the final pre-commit pass for a user-facing implementation commit, also update:

- `CHANGELOG.md`
- `VERSION`

## Workflow Notes

- Use the readiness checklist as the gate.
- Use the execution briefing as the operational guide for VS Code, Copilot CLI, and cloud agents.
- Promote items from this worklog into GitHub issues only when they are stable, bounded, and ready to be worked independently.