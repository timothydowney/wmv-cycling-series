# WMV Explorer Destinations Worklog

This worklog is the active operating log for Explorer. The readiness checklist is the gate. This file is where decisions, blockers, next slices, and issue candidates move over time.

## Current Focus

- Refine the merged Explorer admin shell so the current or next campaign becomes the clear primary working surface.
- Make destination authoring and destination review the dominant workflow, with campaign metadata editing present but de-emphasized.
- Keep any pre-release Explorer UI admin-gated until there is an explicit end-user release decision.
- Keep the next handoff and implementation brief aligned with the existing `segment.validate` preview seam plus the merged campaign-first model.

## Current Go State

- **Readiness:** Phase 1 Complete; Campaign-First Explorer Correction Landed; Phase 4A Admin Backend Complete; Phase 4B-1 E2E Harness Hardening Merged; Phase 4B-2 Minimal Admin UI Merged; Phase 4B-3 Campaign Decoupling And Unified Admin Shell Merged; Ready For Phase 4B-4 Admin Workflow Hierarchy And Destination Management
- **Immediate scope:** refine the admin hierarchy so current-or-next campaign work is primary and destination management no longer competes with always-prominent campaign creation
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
- MVP should instead be campaign-first, with campaign-owned date boundaries and optional sub-campaigns deferred.
- MVP does not currently justify explicit Explorer `draft` / `active` / `archived` workflow complexity; campaign dates and destination presence should control visibility unless later implementation proves otherwise.
- V1 athlete campaign summary is computed on read, with `ExplorerDestinationMatch` as the durable source of truth.
- V1 destination metadata uses a hybrid strategy: reuse shared segment data when present, while storing Explorer-local cached display metadata and source URL values for stable setup and rendering.
- If Explorer UI is touched before public release, it stays admin-only and does not add public navigation.
- `Season` should remain competition-only for Explorer planning and implementation purposes.
- V1 permits Explorer campaigns with their own date windows, but does not permit overlapping Explorer campaigns.
- 4A destination authoring accepts validated Strava segment URLs, not raw segment IDs.
- If URL parsing succeeds but live Strava metadata enrichment fails, destination creation still succeeds with stored segment ID and source URL.
- Refresh and backfill admin mutations are deferred out of 4A.
- 4B-3 should defer persisted inline editing for accepted destination cards and keep the slice focused on preview-add authoring plus richer read-only cards.
- Icon-first admin actions are the preferred interaction style going forward, provided they keep accessible labels.
- The first accepted-destination card metadata set for 4B-3 should surface distance, average grade, location text, and a clearly clickable source link back to Strava.
- After 4B-3, the Explorer admin screen should treat the current active campaign, or the next upcoming campaign when none is active, as the primary working surface.
- When a primary campaign exists, create-campaign controls should remain available but move below the main destination workflow.
- The first post-4B-3 destination-management refinement should allow one-click remove with a standard confirmation dialog instead of introducing a heavier custom workflow.
- A lightweight non-functional search stub is acceptable if it helps reserve UI space for later in-campaign destination filtering without implying Strava discovery support.

## Open Questions

| Question | Status | Blocks Implementation | Notes |
| --- | --- | --- | --- |
| Should Explorer be campaign-first or weekly-first in MVP? | Closed | Yes | Closed in favor of a campaign-first Explorer model with campaign-owned date boundaries. |
| Should optional nested campaign structures remain in MVP? | Closed | Yes | Closed in favor of removing them from MVP and deferring them to later planning. |
| Does MVP need an explicit Explorer status workflow such as `draft` or `archived`? | Closed For MVP | Yes | Closed in favor of no explicit status field unless later implementation proves it is needed. |
| Should athlete campaign summaries be computed on read or stored in a cached summary table for v1? | Closed For v1 | No | V1 uses computed-on-read summaries with `ExplorerDestinationMatch` as the durable source of truth. |
| Should Explorer reuse the existing segment table, store Explorer-local cached metadata, or do both? | Closed For v1 | No | V1 uses a hybrid strategy: shared segment reuse when present plus Explorer-local cached display metadata. |
| How should webhook regression protection be documented for the delegated-handler refactor? | Closed For Phase 1 | No | The preservation target now lives in this worklog and the handler seam is covered by focused webhook tests. |
| What is the exact E2E data strategy for Explorer flows? | Closed For 4B-1 | No | The baseline data source is the committed sanitized fixture at `server/data/wmv_e2e_fixture.db`, with deterministic backend Strava reads selected through explicit providers. |
| Should deleted source activities retract Explorer completions in v1? | Open | No | Safe to defer if behavior is documented. |
| Should pre-release Explorer UI remain admin-gated until launch approval? | Closed | No | Yes. Do not expose Explorer UI to non-admin users before a viable release decision. |
| Should Explorer depend on the competition `Season` model in v1? | Closed | Yes | No. `Season` returns to competition-only semantics and Explorer uses campaign-owned dates. |
| Should overlapping Explorer campaigns be allowed in v1? | Closed | Yes | No. Disallow overlap so active-campaign lookup stays deterministic without adding a heavier publish-status model. |
| Should 4A accept raw segment IDs as an admin authoring input? | Closed | No | No. Use validated Strava segment URLs only in the 4A backend contract. |
| What happens if URL parsing succeeds but live metadata enrichment fails? | Closed | No | Allow creation and preserve segment ID plus source URL for later repair. |
| Do refresh and backfill admin mutations belong in 4A? | Closed | No | No. Defer them to a later admin slice. |
| Should already-added Explorer destination cards support persisted inline editing in the first UX-refinement slice? | Closed For 4B-3 | No | No. Keep 4B-3 to preview-add flow plus richer read-only cards. |
| Does 4B-3 need true map-ready coordinate storage for accepted destination cards? | Open | No | No for 4B-3. Current location text plus source link are enough for this slice, but actual map rendering may require later schema or API expansion for coordinates or geometry. |

## Blockers

### Must Resolve Before Broad Implementation

1. Correct the primary Explorer model to campaign-first across the planning set.
2. Re-scope MVP so overlapping or nested campaign structures are explicitly deferred.
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
- Goal: establish the initial Explorer campaign backend model, matching flow, and read surface
- Why this matters: this backend slice is merged, but it now sits on the superseded season-attached model and should be treated as the correction surface for the next slice rather than as a finished long-term base

### Completed Admin Backend Slice

- Phase: Slice 4A
- Goal: add the minimal Explorer admin service and tRPC surface needed to create a campaign and add destinations safely
- Outcome:
	- `explorerAdmin.createCampaign` currently creates Explorer campaigns against the superseded season-attached model and is part of the next correction surface.
	- `explorerAdmin.addDestination` now accepts validated Strava segment URLs, persists source URL plus cached display metadata, and appends destinations in display order.
	- No-duplicate-segment-within-a-campaign protection is enforced in both service logic and the database.
	- Destination creation can proceed when URL parsing succeeds even if live metadata enrichment is temporarily unavailable.
	- Backend coverage now includes focused admin service and router tests for auth, validation, duplicate protection, metadata fallback, and in-campaign additions.

### Recommended Next PR

- Start from updated `main` on a dedicated implementation branch.
- Keep the next implementation PR scoped to the admin workflow hierarchy and destination-management slice:
	- promote the current active campaign, or the next upcoming campaign when none is active, to the main working surface
	- keep campaign creation prominent only when there is no current or upcoming campaign, and otherwise move it into a secondary planning area
	- make destination authoring and destination-list review the dominant content area
	- collapse campaign metadata editing by default so naming and date edits remain available but secondary
	- add a simple confirmed remove flow for already-added destinations
	- allow a lightweight non-functional search stub only if it helps reserve the interaction shape for later in-campaign filtering
- Validation path for the next PR:
	- focused backend tests for any new destination-management mutation added for this slice
	- frontend unit tests for current-or-next campaign promotion, secondary create placement, collapsed campaign details, and confirmed deletion
	- targeted Playwright for the adjusted admin hierarchy and destination removal flow
	- `npm run lint`, `npm run typecheck`, and targeted build verification
- Planning and documentation surfaces likely to change when 4B-4 lands:
	- `docs/prds/wmv-explorer-destinations-phases.md`
	- `docs/prds/wmv-explorer-worklog.md`
	- `docs/prds/wmv-explorer-readiness-checklist.md`
	- `ADMIN_GUIDE.md` or `docs-site/admin/*` only if the admin workflow changes require operator documentation

### 4B-3 Outcome

- Phase: 4B-3 Campaign Decoupling And Unified Admin Shell
- Status: merged on `main`
- Landed outcome:
	- Explorer campaigns now own their own start and end dates
	- Explorer no longer depends on competition `Season`
	- the v1 no-overlap rule is enforced
	- the admin surface now uses a unified campaign shell with preview-first destination authoring
	- accepted destinations render as richer cards with linked source context

### 4B-4 Implementation Handoff

- Slice: Phase 4B-4 only.
- Branch start point: updated `main`, then a dedicated feature branch before coding.
- Governing scope: refine the merged Explorer admin shell so the current active campaign, or the next upcoming campaign when none is active, becomes the clear primary workspace.
- UI rule: keep the existing WMV leaderboard card language, but make destination work visibly primary and keep campaign-planning controls secondary when a primary campaign already exists.
- Authoring and management recommendation:
	- keep the current-or-next campaign at the top of the workflow
	- keep preview-first Strava URL authoring inside that same campaign surface
	- move create-campaign controls to a lower-priority planning section when a primary campaign exists
	- collapse campaign metadata editing by default
	- allow simple confirmed destination removal
	- allow a lightweight non-functional search stub only if it helps reserve later filtering space without implying Strava discovery support
- Backend expectation:
	- keep the campaign-first data model unchanged
	- add only the narrow destination-management mutation support required for confirmed removal
	- avoid adding reorder, refresh, backfill, or true search mutations in this slice
- Existing Playwright impact:
	- preserve the admin-only route and navigation behavior
	- add or adjust browser coverage for the new hierarchy and destination removal flow
	- continue using the hardened E2E harness rather than local-only assumptions

### 4B-4 Branch-Ready Task List

1. Promote the current or next Explorer campaign to the primary admin working surface.
2. Demote create-campaign controls when a primary campaign already exists, while keeping them available for planning ahead.
3. Make destination authoring and destination review the dominant layout area.
4. Collapse campaign metadata editing by default and keep it secondary.
5. Add a confirmed destination remove flow and update tests plus planning docs to reflect the new next step.

### 4B-4 Implementation Brief

- Phase: 4B-4 Admin Workflow Hierarchy And Destination Management
- Readiness state: approved to implement now; no blocking planning questions remain for this slice
- Branch start point: updated `main`, then create a fresh feature branch before any product-code changes

Primary governing references:

- `docs/prds/wmv-explorer-destinations-phases.md`
- `docs/prds/wmv-explorer-readiness-checklist.md`
- `docs/prds/wmv-explorer-destinations-tech-spec.md` sections `6.2 Explorer query service`, `6.3 Explorer admin service`, and `8.2 Admin surface`

Goal:

- Refine the merged Explorer admin surface so campaign context is easier to scan and destination work is clearly the primary task.

Required outcome:

- The Explorer admin screen clearly promotes the current active campaign, or the next upcoming campaign when none is active.
- Campaign creation remains available but only receives top-of-screen prominence when there is no current or upcoming campaign.
- Destination authoring and accepted-destination review become the main content area for the primary campaign.
- Campaign metadata editing remains available but collapsed by default.
- Already-added destinations can be removed through a simple confirm-and-remove interaction.

Expected code surfaces:

- Frontend likely:
	- `src/components/ExplorerAdminPanel.tsx`
	- `src/components/ExplorerAdminPanel.css`
- Backend only as needed for destination removal:
	- `server/src/services/ExplorerAdminService.ts`
	- `server/src/routers/explorerAdmin.ts`
	- `server/src/__tests__/ExplorerAdminService.test.ts`
	- `server/src/__tests__/trpc/explorerAdminRouter.test.ts`
- Tests likely:
	- `src/components/__tests__/ExplorerAdminPanel.test.tsx`
	- `e2e/tests/explorer-admin.authenticated.spec.ts`

Implementation constraints:

- Do not reopen the campaign-first structural model.
- Do not add public Explorer exposure.
- Do not turn the search stub into real search or imply Strava discovery support.
- Do not add reorder, refresh, backfill, or persisted inline-editing flows in this slice.

Validation path:

- Frontend unit tests covering current-or-next campaign promotion, create-form placement, collapsed campaign details, and confirmed deletion
- Focused backend tests for destination-removal behavior and admin auth coverage
- Targeted Playwright coverage for the adjusted admin hierarchy and removal flow
- `npm run lint`
- `npm run typecheck`
- targeted build verification for the touched UI

Documentation expectations when 4B-4 lands:

- update `docs/prds/wmv-explorer-destinations-phases.md` if the slice lands as approved
- update `docs/prds/wmv-explorer-worklog.md` and `docs/prds/wmv-explorer-readiness-checklist.md` to record the next approved step
- update admin-facing documentation only if the changed workflow needs operator guidance

## 4A Planning Inputs Closed

These decisions are now closed for the 4A implementation handoff.

1. The earlier one-campaign-per-season rule is superseded by campaign-owned dates plus a no-overlap rule in v1.
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