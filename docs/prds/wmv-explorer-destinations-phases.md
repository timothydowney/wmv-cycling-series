# WMV Explorer Destinations Implementation Phases

This document captures the current execution sequence for Explorer Destinations. It is intentionally narrower than the PRD and technical spec: it exists to turn the agreed direction into concrete follow-on work.

## Phase 0: Documentation Baseline

Goal: land the PRD, technical spec, phase outline, and ideas backlog in the repository so future implementation work has a stable source of truth.

Deliverables:

- Explorer PRD in `docs/prds`
- Explorer technical spec in `docs/prds`
- Explorer ideas backlog in `docs/prds`
- Follow-on issue creation for the first engineering phase

## Phase 1: Webhook Ingestion Refactor

Goal: refactor webhook processing into a thin orchestrator with delegated in-process handlers so Explorer can be added without further overloading the current processor.

Status: complete on the Phase 1 closure branch. The next Explorer PR should start Phase 2 preparation work rather than reopen the webhook seam.

Scope:

- Introduce the handler or matcher abstraction for ingested activity contexts
- Build a shared activity-ingestion context once per activity create or update event
- Run delegated handlers sequentially in-process
- Keep initial handler order explicit: chain wax first, then competition
- Preserve existing competition processing behavior
- Preserve existing chain wax behavior
- Establish a reusable seam for Explorer matching and later refresh paths

Out of scope:

- Explorer schema
- Explorer UI
- Explorer admin setup
- Forcing activity delete or athlete deauthorization into the same handler abstraction before the activity path is stable

## Phase 2: Campaign-First Model Correction

Goal: correct Explorer from a weekly-first design to a campaign-first model with campaign-owned date boundaries, and remove optional overlapping or nested campaign complexity from MVP planning.

Status: complete in the current planning set. Future work should build on the corrected model rather than reopen the weekly-first design unless product intent changes again.

Historical note: this planning correction was necessary because an earlier planning set and implementation branch had been built around the wrong weekly-first model.

Scope:

- Rewrite PRD, tech spec, worklog, and readiness checklist around a campaign-first Explorer model
- Return `Season` to competition-only semantics in Explorer planning
- Remove overlapping or nested campaign structures from MVP scope and record them as future optional work
- Lock the v1 no-overlap rule for Explorer campaigns
- Remove explicit `draft` / `active` / `archived` workflow from MVP unless later implementation proves it is necessary
- Define the smallest safe follow-on implementation slice against the corrected model

## Phase 3: Explorer Campaign Data Model And Matching

Goal: add Explorer campaign, destination, and match storage plus the shared matching service used by both webhooks and refresh actions.

Status: implemented on the merged backend slice, but on a now-superseded season-attached model. Follow-on Explorer work should treat this as a structural correction surface rather than as a finished long-term base.

Scope:

- Schema additions for the initial Explorer campaign model
- Explorer matching service
- Admin or service-level refresh path
- Idempotent storage rules

## Phase 4: Explorer Admin Setup

Goal: let admins create or manage Explorer campaigns without exposing Explorer to end users before release.

### Slice 4A: Admin Backend

Goal: add the minimal Explorer admin service and tRPC surface needed to create a campaign and add destinations safely.

Status: complete on the admin-backend slice, but implemented against the older season-attached campaign model. The next approved slice should correct that model before more Explorer UI expansion continues.

Scope:

- Explorer admin service and router surface for campaign creation and add-destination flow
- Initial campaign creation and add-destination flow, subject to the later campaign-first correction
- Strava segment URL parsing and validation for destination setup; do not expose raw segment-ID authoring in 4A
- Explorer-local source URL and cached metadata persistence needed for stable authoring and display
- Allow destination creation to proceed when URL parsing succeeds but live metadata enrichment is unavailable
- Add-destination behavior that works before or during the campaign without resetting prior progress
- Backend tests for auth, validation, campaign creation, destination creation, and in-season additions

Out of scope:

- Admin UI
- Public athlete-facing Explorer UI
- Public navigation to Explorer surfaces
- Reorder, remove, and edit flows unless one is required to keep the backend contract coherent
- Refresh or backfill mutations
- Release-note bookkeeping files

### Slice 4B-1: E2E Harness Hardening

Goal: make Explorer and existing Playwright coverage run against a portable, explicit, repeatable E2E harness before adding more admin UI surface.

Status: merged as the portable baseline for later Explorer UI work.

Scope:

- Keep one explicit backend E2E mode for test-only auth, startup validation, and safe boot wiring
- Replace accidental reliance on a contributor's local `wmv.db` with a deterministic E2E data source
- Prefer checked-in sanitized E2E fixture data or a committed generator over copying development data with live token rows
- Move outbound Strava differences behind explicit provider selection rather than scattering `isE2EMode()` short-circuits through general feature logic
- Keep existing Playwright coverage green while removing hard-coded localhost and seed-ID assumptions that prevent portability
- Update E2E docs and planning state so current reality matches the implemented harness

Out of scope:

- New athlete-facing Explorer UI
- Broad new admin UI beyond what is needed to prove the harness supports the landed backend contract
- Public navigation changes

Implementation notes:

- Prefer fixture-backed providers for segment metadata, profile imagery, club checks, or webhook enrichment where deterministic behavior is required in E2E.
- Do not treat backend E2E mode as a catch-all behavior switch. It should select explicit providers and enforce fail-fast boot rules, not silently bypass arbitrary application logic.

### Slice 4B-2: Admin UI (Admin-Gated)

Goal: expose the approved admin backend capabilities through an admin-only WMV surface once the E2E harness is portable enough to support repeatable regression coverage.

Status: merged as the minimal admin-gated setup surface. The next step should build a bounded admin UX refinement slice from updated `main` on a fresh branch rather than continue broadening 4B-2 opportunistically.

Scope:

- Admin-only route or section for Explorer campaign setup
- Create-campaign and add-destination flows using the approved 4A backend contract
- Targeted browser coverage for admin setup flows on top of the hardened E2E harness
- Keep all Explorer entry points hidden from non-admin users until there is an explicit release decision for the athlete-facing hub
- Initial campaign setup using the then-current backend contract
- Add-destination workflow that works before or during the campaign

Follow-on planning note:

- Treat richer admin guidance, stronger client-side segment validation, and broader card or component-system refinement as the next planning surface, not as open-ended scope creep inside 4B-2.

### Slice 4B-3: Campaign Decoupling And Unified Admin Shell

Goal: correct the shipped season-attached Explorer model by moving Explorer campaigns onto their own date boundaries, then reshape the admin surface into a more all-in-one leaderboard-style campaign editor before additional Explorer UI polish continues.

Status: merged on `main` as the corrected Explorer baseline. Follow-on admin work should treat this slice as complete and build the next refinement from updated `main` on a dedicated feature branch.

Scope:

- Move Explorer campaign boundaries from competition `Season` to campaign-owned start and end dates.
- Enforce the no-overlap Explorer campaign rule in v1 without adding a heavier publish-status model.
- Update matching, query, and admin creation flows so they operate on campaign dates rather than season selection.
- Rework the Explorer admin screen into a more all-in-one leaderboard-style campaign editor:
	- one expandable campaign card for campaign metadata and date selection
	- destination authoring inside the same Explorer admin surface rather than split competition-style admin links
	- reuse the documented leaderboard design system for hierarchy, chips, cards, and linked destination treatment
- Keep the existing preview-first paste-and-add destination flow, and continue deferring optional display-label overrides if they are not required for this correction slice.

Out of scope:

- Strava segment search or discovery workflows
- Persisted edit, remove, or reorder flows for already-added destinations unless one is required to keep the campaign editor coherent
- Refresh or backfill mutations unless one is required to keep the structural correction coherent
- Athlete-facing Explorer hub work
- Public Explorer navigation or release exposure
- Reporting alignment between Explorer campaigns and competition seasons

Validation:

- Backend tests for campaign date-boundary matching, no-overlap enforcement, and corrected admin creation or query flows
- Frontend unit tests for the unified Explorer admin campaign card, including date editing and preview-first destination authoring
- Targeted Playwright coverage for creating or editing a campaign with dates plus the destination preview-add flow
- Slice-normal `npm run lint`, `npm run typecheck`, and targeted build verification

Implementation note:

- Production Explorer data does not currently justify compatibility scaffolding. Migrations should prioritize boot safety and a clean model correction over preserving disposable Explorer campaign rows.
- True map plotting is not part of 4B-3. The current shared segment model carries location text fields, but a future map slice may still require coordinate or geometry storage if the product needs real map pins rather than text-only place context.

### Slice 4B-4: Admin Workflow Hierarchy And Destination Management

Goal: make the Explorer admin screen work primarily around the current or next campaign, demote campaign creation when a primary campaign already exists, and make destination management the dominant workflow.

Status: merged on `main` as the current Explorer admin baseline.

Scope:

- Promote the current active campaign, or the next upcoming campaign when none is active, to the primary working surface.
- Keep campaign creation prominent only when there is no current or upcoming campaign, and otherwise move it into a lower-priority planning section.
- Make destination authoring and destination-list review the main content area for the primary campaign.
- Collapse campaign metadata editing by default so date and naming edits remain available but secondary.
- Add a simple confirmed remove flow for already-added destinations.
- Allow a lightweight non-functional stub for future destination search if it helps reserve the interaction shape without implying Strava discovery support.

Out of scope:

- Real destination search or discovery across Strava or other Explorer campaigns
- Destination reorder flows
- Persisted inline editing for accepted destination cards
- Athlete-facing Explorer release work
- Map rendering or coordinate storage

Validation:

- Backend tests for any new destination-management mutation added for this slice
- Frontend unit tests covering current-or-next campaign promotion, secondary create placement, collapsed campaign details, and confirmed destination deletion
- Targeted Playwright coverage for the adjusted admin hierarchy and destination removal flow
- Slice-normal `npm run lint`, `npm run typecheck`, and targeted build verification

### Slice 4B-5: Segment Metadata Fidelity And Freshness

Goal: tighten the shared segment metadata model so Explorer admin cards can show stable destination details now and future map work can start from stored coordinates rather than from ad hoc Strava fetches.

Status: merged on `main` as the shared segment metadata baseline for later athlete-facing Explorer work.

Scope:

- Extend the shared `segment` storage path to persist Strava segment start and end coordinates when Strava returns them.
- Add a metadata freshness timestamp for shared segment rows so the app can tell when segment details were last refreshed.
- Keep Explorer destination reads DB-first and surface the metadata actually available in expanded admin details, including reliable destination added dates and segment metadata freshness when present.
- Treat Strava-owned metadata in the Explorer details panel as read-only; only WMV editorial overrides such as a destination name or description override should remain editable, and those overrides should stay distinct from the raw Strava values.
- Normalize the shared segment mapping and fixtures so the stored shape matches the Strava segment payload the app already fetches.
- Capture those shared segment fields for all segment uses, including competition and Explorer, rather than creating an Explorer-only storage path.
- Keep refresh strategy shared with the broader segment or athlete resync direction rather than introducing an Explorer-only Strava refresh workflow.

Out of scope:

- Explorer-specific refresh or backfill buttons
- Bespoke Strava caching rules just for Explorer
- Editing Strava-sourced metadata directly in Explorer admin
- Polyline or full geometry storage
- Map rendering
- Destination reorder or search behavior
- Athlete-facing Explorer hub work

Validation:

- Backend tests for shared segment metadata mapping and persistence, including coordinate and freshness fields
- Focused Explorer service or query tests covering the detail fields returned to admin reads
- Frontend unit tests for expanded destination detail rendering when added-at and metadata-freshness values are present or absent
- Slice-normal `npm run lint`, `npm run typecheck`, and targeted build verification

## Phase 5: Athlete Explorer Rollout

Goal: introduce the athlete-facing Explorer experience in deliberately small, progress-first slices after the admin flow and shared segment metadata baseline are stable.

### Slice 5A: Athlete Hub Read Surface

Goal: ship the smallest useful athlete Explorer page, still admin-gated, so logged-in athletes can understand the active campaign and their own completion state without opening map or social scope yet.

Status: merged on `main` as the first athlete-facing Explorer page.


Scope:
- Add a new Explorer page or route, still admin-gated for now, that can later become the public Explorer entry surface.
- Reuse the documented leaderboard design system for hierarchy, hero framing, chips, compact destination metadata, and empty-state rhythm instead of falling back to legacy admin styling.
- Show the active Explorer campaign with campaign title, date context, and a short rules summary.
- Show the logged-in athlete's progress summary for the active campaign, including completed destinations versus total destinations.
- Render a list-first destination experience that makes remaining versus completed destinations easy to scan without introducing rank-order semantics.
- Keep the page focused on current-athlete understanding first: what destinations exist, what has been completed, and what remains.
- Keep the route and data shape compatible with later ungated release, but do not add public navigation yet.

Out of scope:

- Map rendering, location permission prompts, proximity search, or map-provider selection
- Social-feed behavior, destination activity feed, or broader athlete-to-athlete visibility
- Rich browse or search behavior beyond the minimum list organization needed to keep the page understandable
- Public release exposure to non-admin users
- Ranking, leaderboard semantics, or competition-style ordering

Validation:

- Backend tests for active-campaign athlete progress and destination-list reads if new Explorer query surfaces are added
- Frontend unit tests for the athlete Explorer page, including progress summary, completed or remaining destination rendering, and empty states
- Targeted Playwright coverage for the admin-gated Explorer page if a new protected route is added
- Slice-normal `npm run lint`, `npm run typecheck`, and targeted build verification

Implementation note:

- Prefer a list-first page for 5A. The shared segment coordinates captured in 4B-5 enable later map planning, but they do not force map rendering into the first athlete-facing slice.

Landed outcome:

- the first athlete-facing Explorer page now exists as an admin-gated route on top of the campaign-first Explorer model
- active campaign framing, athlete progress summary, and list-first destination views are now established as the baseline athlete Explorer experience
- the shared leaderboard-inspired navigation and typography rules now explicitly cover this Explorer surface

### Slice 5B: Checklist And Browse Refinement

Goal: improve the athlete checklist experience once the 5A page exists and real campaign volume exposes where scanning or filtering starts to break down.

Status: merged on `main` as the first browse-refinement slice.

Scope:

- Preserve the merged 5A route, admin gate, and Hub versus Destinations structure.
- Refine list organization for larger destination sets inside the existing athlete page.
- Add lightweight search, filtering, or grouping only if it is the smallest clean way to improve scanning.
- Improve destination card detail hierarchy only where it helps longer lists remain understandable within the progress-first model.

Out of scope:

- Public release exposure to non-admin users
- Map rendering, map-provider selection, geolocation prompts, or proximity search
- Social-feed behavior or broader athlete-to-athlete visibility
- Reframing Explorer as a leaderboard or rank-ordered surface

Validation:

- Frontend unit tests for longer-list presentation, browse aids, and protected-route behavior in the merged athlete page
- Backend tests only if 5B adds or changes Explorer query procedures to support browse refinement
- Targeted Playwright only if the chosen browse interaction is meaningfully browser-dependent
- Slice-normal `npm run lint`, `npm run typecheck`, and targeted build verification

Landed outcome:

- the Destinations tab now supports local search and completion-state filtering on top of the merged athlete-facing Explorer page
- filtered counts and a dedicated filtered empty state now make larger destination sets easier to scan without a new backend contract
- the browse surface remains list-first, progress-first, and admin-gated while reserving map and social work for later phases

Ordering note:

- The current auth-access branch now tightens the default signed-out posture so logged-out users see one WMV sign-in or join shell instead of leaderboard or Explorer data. That cross-product slice remains outside Explorer phase numbering.

### Slice 5C: Pinned Destinations And Hub Prioritization

Goal: help logged-in athletes turn the merged browse surface into a lightweight planning tool by letting them pin destinations they want to visit and surfacing those pinned choices first on the Hub page.

Status: merged on `main` as the next bounded Explorer personalization slice after 5B.

Scope:

- Preserve the merged 5A/5B route, admin gate, search, and completion filters.
- Let the logged-in athlete pin and unpin destinations from the existing Destinations tab.
- Add athlete-specific persistence for pinned destinations only if it is required to keep the preference stable across sessions.
- Prioritize pinned remaining destinations on the Hub page without changing completion math or destination-match rules.
- Keep the non-pinned experience understandable when an athlete has not pinned anything yet.

Out of scope:

- Public release exposure to non-admin users
- Shared pin lists, social visibility, or athlete-to-athlete recommendation behavior
- Map rendering, map-provider selection, geolocation prompts, or proximity search
- Reframing Explorer as a leaderboard or rank-ordered surface
- Changing the default campaign ordering in the main Destinations browse list outside explicit pinned-priority surfaces

Validation:

- Frontend unit tests for pin and unpin interactions, empty and populated pinned states, and Hub prioritization behavior
- Backend tests for athlete-specific pin persistence or query shaping if the chosen implementation adds a new Explorer procedure or storage table
- Targeted Playwright only if the chosen pinning workflow is meaningfully browser-dependent
- Slice-normal `npm run lint`, `npm run typecheck`, and targeted build verification

Landed outcome:

- the Destinations tab now lets the current athlete pin and unpin destinations without turning the browse surface into a recommendation feed
- athlete-specific pin state now persists for the active campaign
- the Hub page now surfaces pinned remaining destinations first and explains the no-pins-yet state without changing completion math or default browse order

Ordering note:

- No later Explorer athlete rollout slice is approved yet; after the auth-access branch merges, return to planning before naming the next implementation slice.

### Slice 5D: Map Discovery

Goal: add map-based discovery only after the list-first athlete page exists and the map product questions are explicitly answered.

Candidate scope:

- Choose a map provider and document licensing, hosting, and mobile behavior tradeoffs
- Define how a destination should appear on the map, including whether the UI centers on a segment start point, end point, midpoint, or later geometry
- Add a clear relationship between the map and the destination list instead of forcing both into one overloaded first page

### Slice 5E: Social Visibility

Goal: add lightweight communal visibility only after the athlete's personal-progress experience is stable.

Candidate scope:

- Completers summary expansion beyond the minimum MVP treatment
- Recent completion activity or other social visibility patterns if they still fit the progress-first product intent
- Explicit guardrails to avoid drifting into a second race-style leaderboard
- Completers summary with all names

## Phase 6: Hardening And Follow-on Expansion

Goal: stabilize the Explorer feature and prepare later work.

Candidate items:

- Optional sub-campaigns or campaign templates
- Better admin search and validation tooling
- Explorer profile rollups
- Badges and themed campaigns
- Shared-segment mini-races