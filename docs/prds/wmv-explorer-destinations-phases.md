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
- Defer overlapping or nested campaign structures to later phases
- Lock a no-overlap rule for Explorer campaigns in MVP

Deliverables:

- Corrected Explorer PRD
- Corrected Explorer technical spec
- Corrected Explorer worklog with explicit decisions
- Corrected ideas backlog
- Follow-on phase outline aligned to corrected model

## Phase 3: Admin Backend Schema and Services

Goal: build the backend data model and services necessary for admin destination authoring and campaign management.

Status: complete on `main`. Phase 4 work should build on these services rather than re-implement them.

Scope:

- Explorer campaign model with campaign-owned date boundaries
- Explorer destination model with Strava segment URLs as admin input
- First-pass destination matching service for single-athlete flows
- Admin campaign and destination mutations
- Admin query patterns for campaign and destination lists
- Webhook handler registration seam for later Explorer matching integration
- Backend test coverage for services and resolvers

Deliverables:

- Database schema with `explorer_campaign` and `explorer_destination` tables
- Service layer for campaign and destination operations
- tRPC admin routers for campaign and destination management
- Comprehensive backend test coverage

## Phase 4: Admin Interface and Campaign Management

### Phase 4A: Admin Backend Complete (Merged)

Goal: build the backend services and data model for admin destination authoring.

Status: merged on `main`.

Scope:

- Campaign creation, listing, and basic properties
- Destination creation from Strava segment URLs
- Admin query endpoints for campaign and destination display
- Webhook integration point for future Explorer matching
- Backend test coverage

### Phase 4B: Admin UI Refinement (Merged Through 4B-5)

Multiple smaller slices to bring the admin UI forward while keeping individual PRs tight.

Status: all 4B slices merged on `main`.

#### Phase 4B-1: E2E Harness Hardening

- Separate E2E test environment configuration
- Sanitized E2E seed data committed to repository
- E2E test baseline for admin flows

#### Phase 4B-2: Minimal Admin UI

- Basic admin campaign and destination listing
- Admin route gating
- Admin campaign creation and basic operations

#### Phase 4B-3: Campaign Decoupling And Unified Admin Shell

- Unified admin shell replacing scattershot admin pages
- Campaign-first admin workflow
- Destination preview and add flow

#### Phase 4B-4: Admin Workflow Hierarchy And Destination Management

- Admin screen prioritization by active or next-upcoming campaign
- One-click remove with confirmation dialog
- Richer destination card display with metadata

#### Phase 4B-5: Segment Metadata Fidelity And Freshness

- Extend shared `segment` table with Strava start/end coordinates and metadata freshness timestamp
- Destination cards display distance, grade, location, and source link
- Backend service to fetch and refresh segment metadata from Strava

## Phase 5: Athlete-Facing Explorer Experience

### Phase 5A: Athlete Hub Read Surface (Merged)

Goal: build the first athlete-facing Explorer page showing campaign progress and list of destinations.

Status: merged on `main`.

Scope:

- Explorer athlete page at `/explorer` for logged-in users
- Active campaign display with progress bar and metadata
- Hub tab showing personal progress and destination browse
- Destinations tab showing full destination list
- Destination cards with metadata display
- Personal progress tracking (completed vs. remaining)
- Reuse leaderboard design system for styling
- Route gating so signed-out users do not see Explorer pages

### Phase 5B: Checklist And Browse Refinement (Merged)

Goal: refine the athlete-facing listing experience for larger destination sets.

Status: merged on `main`.

Scope:

- Lightweight destination search stub within Hub and Destinations views
- Improved checklist scanning for larger destination lists
- Destination completion status indicators
- Preserve the list-first design without introducing map or recommendation semantics

### Phase 5C: Pinned Destinations And Hub Prioritization (Merged)

Goal: enable athletes to pin personal favorites and prioritize them on the Hub.

Status: merged on `main`.

Scope:

- Pin button on destination cards (Destinations tab)
- Pinned destination prioritization on the Hub page
- Personal preference storage tied to athlete and campaign
- Preserve campaign order and completion semantics (pinning is read-only preference, not a ranking override)

### Phase 5D-0: Public Explorer Read Exposure (Merged)

Goal: expose the existing athlete-gated Explorer surface to all logged-in non-admin users.

Status: merged on `main` as the first public read exposure step.

Scope:

- keep the existing 5A through 5C Hub and Destinations experience intact
- expose `/explorer` and Explorer navigation to logged-in non-admin athletes
- keep `/explorer-admin` and all campaign-management mutations admin-only
- remove admin-preview copy from the athlete Explorer page
- preserve signed-out route behavior so non-authenticated users still see the WMV sign-in or join shell

Out of scope:

- map rendering, map-provider selection, geolocation prompts, or proximity search
- social-feed behavior or broader athlete-to-athlete visibility
- changes to completion math, campaign ordering semantics, or pin-priority rules
- public access for signed-out users

Validation:

- frontend unit tests for non-admin logged-in Explorer nav visibility and Explorer page rendering
- route-gating validation that signed-out users remain on the WMV sign-in or join shell
- slice-normal `npm run lint`, `npm run typecheck`, and targeted build verification

Landed outcome:

- `/explorer` is now visible to logged-in non-admin athletes
- Explorer management remains admin-only through `/explorer-admin`
- the athlete Explorer page no longer presents itself as an admin-only preview
- the signed-out WMV sign-in or join shell remains the default for unauthenticated users

Ordering note:

- With 5D-0 merged, the next approved slice is a narrow public-surface cleanup before new features land.

### Slice 5D-1: Public Explorer Surface Cleanup

Goal: remove pre-release and roadmap-oriented UI remnants from the logged-in public Explorer page so the shipped surface reflects the approved 5D-0 boundary.

Status: merged on `main` as the cleanup pass between public read exposure and later feature work.

Scope:

- remove any remaining admin-gated or preview-oriented language from the athlete Explorer read surface
- remove roadmap-style map and social teaser content from the Hub surface
- remove disabled map tab affordances that imply map behavior is available now
- keep the merged 5A through 5D-0 progress, browse, and pin behavior unchanged

Out of scope:

- map rendering, map-provider selection, geolocation prompts, or proximity search
- social-feed behavior or broader athlete-to-athlete visibility
- changes to completion math, campaign ordering semantics, or pin-priority rules
- public access for signed-out users

Validation:

- frontend unit tests for Explorer Hub rendering and navigation affordances after cleanup
- route-gating validation that signed-out users remain on the WMV sign-in or join shell
- slice-normal `npm run lint`, `npm run typecheck`, and targeted build verification

Landed outcome:

- the public Explorer Hub no longer surfaces roadmap-style map or social teaser copy
- Explorer bottom navigation now exposes only the shipped Hub and Destinations views
- the existing progress, browse, and pin behavior remains unchanged while map work stays deferred

Ordering note:

- With 5D-1 merged, Phase 5E launches destination popularity, first-completer recognition, and a dedicated Club tab before map discovery work begins.

### Phase 5E: Destination Popularity, First-Completer Recognition, and Club Tab

Goal: add lightweight social context to the athlete Explorer experience through a dedicated Club tab that surfaces destination popularity metrics, recognizes first completers, and provides space for club-wide engagement and motivation. Enable gentle gamification without overloading the list-first design.

Status: Approved for Phase 5E implementation, with 5E-3 (stats and motivation) recorded as deferred follow-on.

#### Phase 5E-1: Database Schema + First-Completer Tracking

- Add columns to `explorer_destination_match`: `is_first_completer`, `first_completer_athlete_id`, `first_completer_athlete_name`, `first_completer_at`
- Add columns to `explorer_destination`: `completion_count` (denormalized for fast queries)
- Update completion handler to check and record first completer with deterministic tiebreaker (timestamp, then alphabetical name)
- Drizzle migration and comprehensive test coverage

#### Phase 5E-2: Club Tab UI + Popularity Views + First-Completer Badges

Scope:

- Create new Club tab in Explorer bottom navigation alongside Hub and Destinations
- Implement backend tRPC queries: `getPopularDestinations`, `getLeastPopularDestinations`, `getMostRecentFirstCompletion`
- Build ClubPage component with three sections:
  - Top 5 most-popular destinations (by completion count with first completer name)
  - Most recently completed for first time (latest first-completer milestone with time)
  - Bottom 5 least-popular destinations (ascending by count, including 0 completions)
- Add "First: [Athlete Name]" badge to ExplorerDestinationCard component (used on Hub, Destinations, Club tabs)
- Per-campaign scope: all metrics isolated to active campaign
- Responsive design reusing leaderboard card patterns and chip styling
- Full test coverage: backend queries, frontend tab navigation, card rendering, E2E Club tab flow

Out of scope:

- Club stats and motivational content (defer to Phase 5E-3)
- Admin controls to override or reset first-completer recognition (defer to later admin slice)
- All-time popularity rankings across campaigns (defer to later slice)
- Map rendering, provider selection, or map discovery
- Social feed or broader athlete-to-athlete visibility
- Notifications or badges when athlete becomes first completer

Validation:

- Backend tests for first-completer assignment, completion count denormalization, and tiebreaker logic
- Backend tests for popularity and recent-completion queries
- Frontend tests for Club tab rendering and navigation
- Frontend tests for destination card badge display across all tabs
- E2E tests for Club tab flow, destination card rendering, and real-time updates
- Cross-campaign isolation verified

Landed outcome (target):

- Club tab displays in Explorer bottom navigation for logged-in athletes with active campaign
- Club page shows top popular, least popular, and most-recent-first-completion destinations
- Destination cards display "First: [Name]" badge consistently across Hub, Destinations, and Club tabs
- Popularity metrics update in real-time when athletes complete destinations
- All metrics remain scoped to the current active campaign

#### Phase 5E-3: Club Stats & Motivational Content (Deferred)

Goal: enhance the Club tab with club-wide engagement metrics and motivational messaging to drive participation and celebration.

Candidate scope:

- Club-wide campaign completion percentage (e.g., "42% of all destinations completed by the club")
- Visual progress indicators showing destinations completed vs. remaining (campaign-wide aggregate)
- Recent completion activity feed or timeline showing athlete names and destinations
- Motivational messaging tied to club milestones (e.g., "You've completed 10 destinations! Keep going!")
- Engagement copy and gamification elements to encourage continued participation
- Design and finalize which stats are most motivating based on Phase 5E-2 community feedback and usage patterns

Decision point: Phase 5E-3 scope to be finalized during Phase 5E-2 review before implementation begins.

Ordering note:

- With 5E-2 approved, map discovery and social expansion become Phase 5F and Phase 5G work.
- Phase 5E-3 (stats and motivation) is deferred pending Phase 5E-2 completion and community feedback.

### Slice 5F: Map Discovery

Goal: add map-based discovery only after the list-first athlete page exists, social context is established (first-completer recognition + Club stats), and the map product questions are explicitly answered.

Candidate scope:

- Choose a map provider and document licensing, hosting, and mobile behavior tradeoffs
- Define how a destination should appear on the map, including whether the UI centers on a segment start point, end point, midpoint, or later geometry
- Add a clear relationship between the map and the destination list instead of forcing both into one overloaded first page

### Slice 5G: Social Visibility

Goal: add expanded communal visibility only after the athlete's personal-progress experience is stable and social context (first-completer recognition, Club tab, and stats) is established.

Candidate scope:

- Completers summary expansion beyond the minimum MVP treatment
- Recent completion activity or other social visibility patterns if they still fit the progress-first product intent
- Explicit guardrails to avoid drifting into a second race-style leaderboard
- Completers summary with all names

## Phase 6: Hardening And Follow-on Expansion

Goal: stabilize the Explorer feature and prepare later work.

Candidate items:

- Refresh and backfill mutations for Explorer destinations
- Broader search or filtering capabilities across campaigns
- Badge systems or achievement recognition
- Expanded completers or social visibility patterns
- Long-term refresh cadence and data freshness strategy
