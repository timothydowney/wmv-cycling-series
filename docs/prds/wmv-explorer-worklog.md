# WMV Explorer Destinations Worklog

This worklog is the active operating log for Explorer. The readiness checklist is the gate. This file is where decisions, blockers, next slices, and issue candidates move over time.

## Current Focus

- Preserve the checkpointed functional 4B-3 admin UX work while documenting the leaderboard design system before more Explorer UX polish continues.
- Keep the next slice focused on Weekly, Season, and Schedule UI audit and documentation so future Explorer surfaces start from the right public-facing primitives.
- Keep any pre-release Explorer UI admin-gated until there is an explicit end-user release decision.
- Keep the next handoff and implementation brief aligned with the landed backend authoring contract plus the existing `segment.validate` preview seam.

## Current Go State

- **Readiness:** Phase 1 Complete; Season-Campaign Correction Landed; Backend Campaign Slice Merged; Phase 4A Admin Backend Complete; Phase 4B-1 E2E Harness Hardening Merged; Phase 4B-2 Minimal Admin UI Merged; Ready For Phase 4B-3 Admin UX Refinement
- **Immediate scope:** document the canonical leaderboard design system and wire that guidance into future Explorer implementation before resuming UX-polish work on top of the checkpointed 4B-3 branch state
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
- 4B-3 should defer persisted inline editing for accepted destination cards and keep the slice focused on preview-add authoring plus richer read-only cards.
- Icon-first admin actions are the preferred interaction style going forward, provided they keep accessible labels.
- The first accepted-destination card metadata set for 4B-3 should surface distance, average grade, location text, and a clearly clickable source link back to Strava.

## Open Questions

| Question | Status | Blocks Implementation | Notes |
| --- | --- | --- | --- |
| Should Explorer be season-campaign-first or weekly-first in MVP? | Closed | Yes | Closed in favor of season-campaign-first attached to the existing season model. |
| Should optional mini-campaigns within a season remain in MVP? | Closed | Yes | Closed in favor of removing them from MVP and deferring them to later planning. |
| Does MVP need an explicit Explorer status workflow such as `draft` or `archived`? | Closed For MVP | Yes | Closed in favor of no explicit status field unless later implementation proves it is needed. |
| Should athlete campaign summaries be computed on read or stored in a cached summary table for v1? | Closed For v1 | No | V1 uses computed-on-read summaries with `ExplorerDestinationMatch` as the durable source of truth. |
| Should Explorer reuse the existing segment table, store Explorer-local cached metadata, or do both? | Closed For v1 | No | V1 uses a hybrid strategy: shared segment reuse when present plus Explorer-local cached display metadata. |
| How should webhook regression protection be documented for the delegated-handler refactor? | Closed For Phase 1 | No | The preservation target now lives in this worklog and the handler seam is covered by focused webhook tests. |
| What is the exact E2E data strategy for Explorer flows? | Closed For 4B-1 | No | The baseline data source is the committed sanitized fixture at `server/data/wmv_e2e_fixture.db`, with deterministic backend Strava reads selected through explicit providers. |
| Should deleted source activities retract Explorer completions in v1? | Open | No | Safe to defer if behavior is documented. |
| Should pre-release Explorer UI remain admin-gated until launch approval? | Closed | No | Yes. Do not expose Explorer UI to non-admin users before a viable release decision. |
| Should there be more than one Explorer campaign per season in v1? | Closed | No | No. Enforce one campaign per season in 4A while leaving room for future multi-season support. |
| Should 4A accept raw segment IDs as an admin authoring input? | Closed | No | No. Use validated Strava segment URLs only in the 4A backend contract. |
| What happens if URL parsing succeeds but live metadata enrichment fails? | Closed | No | Allow creation and preserve segment ID plus source URL for later repair. |
| Do refresh and backfill admin mutations belong in 4A? | Closed | No | No. Defer them to a later admin slice. |
| Should already-added Explorer destination cards support persisted inline editing in the first UX-refinement slice? | Closed For 4B-3 | No | No. Keep 4B-3 to preview-add flow plus richer read-only cards. |
| Does 4B-3 need true map-ready coordinate storage for accepted destination cards? | Open | No | No for 4B-3. Current location text plus source link are enough for this slice, but actual map rendering may require later schema or API expansion for coordinates or geometry. |

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
	- Progress: the shared E2E baseline now comes from a sanitized committed fixture rather than copied local development state.
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

- Start from the checkpointed 4B-3 branch state on a dedicated documentation or design-system branch.
- Keep the next implementation PR scoped to the leaderboard design-system audit and documentation slice:
	- document the canonical Weekly, Season, and Schedule design language in one durable reference
	- identify which shared primitives Explorer should reuse by default
	- record gaps where the public leaderboard does not yet define a stable form or admin-control pattern
	- wire the documented guidance into repo instructions or agent-facing surfaces so future Explorer work reads it first
	- avoid further piecemeal Explorer restyling until that guide exists
- Validation path for the next PR:
	- document review against the authoritative source files
	- verify agent-facing references point to the new guide
	- no product-code validation beyond any touched markdown or instruction surfaces unless the slice expands again
- Planning and documentation surfaces likely to change when 4B-3 lands:
	- `docs/LEADERBOARD_DESIGN_SYSTEM.md`
	- `docs/prds/wmv-explorer-destinations-phases.md`
	- `docs/prds/wmv-explorer-worklog.md`
	- `docs/prds/wmv-explorer-readiness-checklist.md`
	- repo instruction surfaces such as `AGENTS.md`, `AGENT_USAGE.md`, or `.github/copilot-instructions.md`

### 4B-3 Implementation Handoff

- Slice: Phase 4B-3 only.
- Branch start point: updated `main`, then a dedicated feature branch before coding.
- Governing scope: card-first destination authoring and richer accepted-destination cards on top of the already-merged 4B-1 harness and 4B-2 minimal UI baseline.
- UI rule: prefer reuse of the existing WMV leaderboard card language and component patterns where that reuse clarifies hierarchy, rather than layering more bespoke Explorer-only form styling.
- Authoring flow recommendation:
	- admin pastes a Strava segment URL
	- the UI parses and validates promptly through the existing `segment.validate` seam
	- a preview card appears with segment metadata before persistence
	- the admin explicitly accepts or rejects the preview
	- the optional Explorer display label is applied during that preview step
- Backend expectation:
	- keep the existing `explorerAdmin.addDestination` write contract
	- expand Explorer admin read-side destination fields only if needed for richer accepted-card rendering
	- do not add persisted edit, remove, reorder, refresh, or search mutations in this slice
- Existing Playwright impact:
	- preserve the admin-only route and navigation behavior
	- add or adjust browser coverage only for the interactive preview-add flow and accepted-card presentation
	- continue using the hardened E2E harness rather than local-only assumptions

### 4B-3 Branch-Ready Task List

1. Rework the Explorer admin screen so season summary, campaign summary, authoring, and accepted destinations follow a coherent card hierarchy aligned with the current WMV leaderboard surfaces.
2. Replace the plain add-destination form with a fast paste-validate-preview-add interaction using the existing segment-validation seam.
3. Extend accepted-destination cards to show richer segment details already known to the system, such as distance, grade, and location, plus Explorer-specific label context.
4. Keep campaign creation visually consistent with the updated card hierarchy without widening into broader management workflows.
5. Update slice-local tests and planning docs so the merged outcome clearly records 4B-3 completion and the next approved Explorer step.

### 4B-3 Implementation Brief

- Phase: 4B-3 Admin UX Refinement
- Readiness state: approved to implement now; no blocking planning questions remain for this slice
- Branch start point: commit the current planning-doc updates on `main`, then create a fresh feature branch from updated `main` before any product-code changes

Primary governing references:

- `docs/prds/wmv-explorer-destinations-phases.md`
- `docs/prds/wmv-explorer-readiness-checklist.md`
- `docs/prds/wmv-explorer-destinations-tech-spec.md` sections `5.3 Segment source model`, `6.2 Explorer query service`, `6.3 Explorer admin service`, and `8.2 Admin surface`

Goal:

- Turn the minimal Explorer admin setup screen into a more interactive, modern, card-first authoring experience that matches the existing WMV card language and makes repeated paste-and-add destination setup feel fast and obvious.

Required outcome:

- The Explorer admin screen keeps season and campaign framing at the top, but uses a clearer card hierarchy consistent with the leaderboard, weekly, season, and schedule surfaces.
- Destination authoring becomes a preview-first flow:
	- the admin pastes a Strava segment URL
	- the UI validates through the existing `segment.validate` seam
	- a preview card appears with segment metadata before persistence
	- the admin uses icon-first accept or reject controls with accessible labels
	- the optional Explorer display label is applied during that preview step
- Accepted destinations render as richer cards rather than a plain list.
- Each accepted destination card shows, when available:
	- Explorer display label or resolved destination name
	- distance
	- average grade
	- location text using city, state, and country
	- a clearly clickable link back to the original Strava segment source

Expected code surfaces:

- Frontend likely:
	- `src/components/ExplorerAdminPanel.tsx`
	- `src/components/ExplorerAdminPanel.css`
	- shared card or metadata display helpers only if reuse is actually cleaner than local duplication
- Backend only if needed for richer accepted-card data:
	- `server/src/services/ExplorerQueryService.ts`
	- `server/src/routers/explorerAdmin.ts`
	- `server/src/__tests__/trpc/explorerAdminRouter.test.ts`
- Tests likely:
	- `src/components/__tests__/ExplorerAdminPanel.test.tsx`
	- `e2e/tests/explorer-admin.authenticated.spec.ts`

Implementation constraints:

- Do not add persisted edit, remove, reorder, refresh, or search flows in this slice.
- Do not add public Explorer exposure.
- Do not convert links into generic button-styled actions when a normal link is clearer.
- Keep icon-first actions accessible with visible context and `aria-label` support where needed.
- Treat map plotting as deferred. Location text should be surfaced now, but real coordinate or geometry storage is not part of 4B-3.

Validation path:

- Frontend unit tests covering preview state, validation success and failure, accept, reject, and repeated add behavior
- Focused backend tests only if the Explorer admin read shape changes
- Targeted Playwright coverage for the admin paste-validate-preview-add flow and richer accepted-card rendering
- `npm run lint`
- `npm run typecheck`
- targeted build verification for the touched UI

Documentation expectations when 4B-3 lands:

- update `docs/prds/wmv-explorer-destinations-phases.md` to mark 4B-3 complete if the slice lands as approved
- update `docs/prds/wmv-explorer-worklog.md` and `docs/prds/wmv-explorer-readiness-checklist.md` to record the new next step
- update `docs/API.md` only if the Explorer admin read contract expands

Non-blockers to leave alone:

- true map rendering
- coordinate or geometry persistence
- persisted inline card editing
- Strava destination search
- refresh or backfill admin actions

## 4A Planning Inputs Closed

These decisions are now closed for the 4A implementation handoff.

1. Enforce one campaign per season in 4A. Prefer database protection plus service-layer validation.
2. Accept validated Strava segment URLs only in 4A.
3. Allow creation when URL parsing succeeds even if live metadata enrichment fails.
4. Defer refresh and backfill mutations to a later admin slice.

## Issue Candidates

- Implement Explorer admin backend setup
- Add admin-gated Explorer setup UI
- Refine Explorer admin destination authoring UX
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