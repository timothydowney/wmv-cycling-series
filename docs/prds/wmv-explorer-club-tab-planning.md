# WMV Explorer Destinations: Club Tab & Popularity Features

**Planning Status**: User decisions recorded; scope updated for new Club tab  
**Approved Phase**: 5E: Destination Popularity, First-Completer Recognition, and Club Tab  
**Sequence**: Lands before Phase 5F (Map Discovery)  
**Created**: May 19, 2026  

## Overview

This slice adds lightweight social context to the Explorer athlete experience by creating a new dedicated "Club" tab for community-focused campaign information. The Club tab surfaces destination popularity metrics, recognizes first completers, and provides space for club-wide engagement and motivation stats.

## Proposed Scope

### New Explorer Tab: Club

Add a new "Club" tab to the Explorer bottom navigation alongside "Hub" and "Destinations", creating a dedicated page for community-focused campaign information.

**Phase 5E Initial Release (5E-1 through 5E-2):**

The Club page displays:

1. **Top 5 Most Popular Destinations** (this campaign)  
   - Ranked by completion count (unique athletes who have completed)
   - Shows destination name, completion count, and first completer name
   - Full-width card layout with ample space available

2. **Most Recently Completed for First Time** (this campaign)  
   - The destination most recently completed by any athlete for their first completion
   - Shows destination name, first completer name, and approximate time (e.g., "2 hours ago")
   - Highlighted or featured card placement

3. **Bottom 5 Least Popular Destinations** (this campaign)  
   - Ranked by lowest completion count (0 completions first), emphasizing those never visited
   - Shows destination name, current completion count
   - Encourages discovery of under-explored destinations

**Phase 5E Follow-on (5E-3): Club Stats & Motivation**  
*Recorded as deferred but planned;* scope to be finalized during Phase 5E-2 review:
- Club-wide campaign completion percentage (e.g., "42% of all destinations completed by the club")
- Destinations completed vs. remaining (campaign-wide aggregate and visual progress)
- Recent completion activity feed or timeline
- Motivational messaging tied to club milestones
- Engagement metrics and copy to encourage participation
- (Additional stats TBD based on what drives engagement)

### First-Completer Badges on Destination Cards (Phase 5E-2)

On each destination card (both Hub and Destinations tabs):
- Display "First: [Athlete Name]" badge when destination has at least one completer
- Show in a visual accent location using `.week-header-chip` pattern with optional icon
- Badge appears regardless of card completion status or pin state
- Only display first completer name (not subsequent completers)
- Consistent styling across all locations where destination cards appear

### Behavior Rules

1. **Per-campaign scope**: All popularity metrics, first-completer recognition, and stats are scoped to the current active campaign only
2. **Deterministic first completer**: If two athletes complete the same destination in the same second (same Unix timestamp), use the alphabetically first athlete name as tiebreaker
3. **Cross-campaign history**: If an athlete completes a destination again in a future campaign, that does not change the recorded first completer from the original campaign
4. **Real-time updates**: Popularity counts and first-completer display update immediately when an athlete completes a destination
5. **Club tab visibility**: Club tab only displays when athlete is logged in and an active campaign exists (hidden for signed-out users)

## Critical Decisions Recorded

✅ **New dedicated Club tab** instead of bottom Hub panel — provides full-width space for current and future features  
✅ **Top 5 most popular** — confirmed limit  
✅ **Most-recently-completed entry** — featured as milestone highlight  
✅ **Least-popular sort** — 0 completions first (ascending), includes never-visited destinations  
✅ **First-completer copy** — "First: [Name]" (tight, consistent format)  
✅ **Phase sequencing** — Phase 5E for tab + popularity + badges; Phase 5E-3 for stats (deferred); Phase 5F for map discovery  
✅ **First-completer badges** — appear on all destination cards (Hub, Destinations, Club tabs)  

## Database Schema Changes

### New / Modified Tables

**`explorer_destination_match` table** (new columns):

```sql
-- Track first completer per destination per campaign
is_first_completer BOOLEAN NOT NULL DEFAULT FALSE

-- Store first completer snapshot for display and deletion safety
first_completer_athlete_id INT
first_completer_athlete_name VARCHAR(255)  -- snapshot of name at completion time
first_completer_at BIGINT  -- Unix timestamp of first completion for same-second tiebreaker
```

Rationale:  
- `is_first_completer`: Query filter to quickly identify first matches per (destination_id, campaign_id) pair
- `first_completer_athlete_id`, `first_completer_athlete_name`: Snapshot the name so deletion or profile changes don't break display
- `first_completer_at`: Deterministic tiebreaker if two athletes complete at same Unix second

**`explorer_destination` table** (new columns):

```sql
-- Denormalized completion count per destination per campaign for real-time accuracy
completion_count INT NOT NULL DEFAULT 0  -- Total unique athletes who have completed
```

Rationale:  
- Fast UI queries for "top 5 by count" and "bottom 5 by count"
- Avoids expensive JOIN + GROUP BY on every page load

### Queries to Add

Backend tRPC procedures:

1. **`explorer.getPopularDestinations({ campaignId, limit = 5 })`**  
   Returns: Array of { destination, completionCount, firstCompleterName }

2. **`explorer.getLeastPopularDestinations({ campaignId, limit = 5 })`**  
   Returns: Array of { destination, completionCount }

3. **`explorer.getMostRecentFirstCompletion({ campaignId })`**  
   Returns: { destination, firstCompleterName, completedAt }

4. **`explorer.getDestinationFirstCompleter({ campaignId, destinationId })`**  
   Returns: { athleteName, athleteId } or null

Frontend hooks will cache these queries and revalidate on completion.

## Design System Notes

Using [docs/LEADERBOARD_DESIGN_SYSTEM.md](./LEADERBOARD_DESIGN_SYSTEM.md):

- **Page layout**: Reuse `.app-content` container with standard 1280px max width and 16px gaps
- **Card shell**: Reuse `.leaderboard-card` for each destination listing
- **Typography**: Use `.wmv-purple` headings for "Most Popular", "Least Popular", "Recently Completed" sections
- **Chip pattern**: First-completer badge uses `.week-header-chip` with optional icon (e.g., 🏆 or ⭐)
- **Spacing**: Follow 4px–24px cadence; section spacing uses standard 16px gap
- **Color tokens**: Use `--wmv-orange` or `--wmv-orange-light` for first-completer badge accent
- **Responsive**: Full-width cards on mobile and desktop; responsive padding following standard App.css pattern

### First-Completer Badge Visual Treatment

Recommended pattern using existing chip:

```
[Destination Name] 🏆 First: Alice K.
Distance | Grade | Location | [Completion Status]
```

Or embedded in destination card metadata row.

### Club Tab Navigation

Update `ExplorerBottomNav.tsx` to include Club tab:
- Show 3-way toggle: Hub | Destinations | **Club** (new)
- Club tab available when logged-in and campaign active
- Use same navigation pattern as Hub/Destinations

## Implementation Approach

### Slice Phases

**Phase 5E-1**: Database schema + first-completer tracking  
- Add columns to `explorer_destination_match` and `explorer_destination`  
- Update completion handler to check and record first completer  
- Drizzle migration and test coverage  
- No UI changes in this phase

**Phase 5E-2**: Club tab UI + popularity views + first-completer badges  
- Implement tRPC queries for popular/least-popular/recent completions  
- Add Club tab to ExplorerBottomNav component  
- Create ClubPage component with three sections (popular, recent, least-popular)
- Add first-completer badges to ExplorerDestinationCard component  
- Tests for queries, tab navigation, and card rendering  
- E2E tests for Club tab flow

**Phase 5E-3 (Deferred)**: Club stats & motivational content  
- Add club-wide stats queries (campaign completion %, destinations remaining, etc.)
- Display stats with motivational copy and visual progress indicators
- Recent activity feed or completion timeline
- Design and finalize engagement messaging based on Phase 5E-2 review
- Tests for stats queries and motivational UI

### Testing Strategy

**Backend (Jest + in-memory DB)**:
- First-completer assignment logic (deterministic tiebreaker, per-campaign isolation)
- Completion count denormalization and updates
- Queries for popular, least-popular, and recent-first-completion lists
- Cross-campaign isolation (no carryover)

**Frontend (Vitest)**:
- Club tab rendering and navigation
- Card composition for destination listings
- Badge display on destination cards across all tabs (Hub, Destinations, Club)
- Responsive layout on mobile and desktop
- Empty state handling (zero completions)

**E2E (Playwright)**:
- Navigate to Club tab — verify tab displays and renders lists
- Complete a destination → verify first-completer badge appears on all cards
- Second athlete completes same destination → verify first-completer unchanged
- Popular/least-popular lists reflect current campaign state
- Lists update in real-time on new completion (if subscriptions available)

## Blockers & Non-Blockers

### Blocking This Slice

None identified. This is an enhancement to the merged 5A–5D baseline.

### Non-Blocking (Can Defer to Follow-up Phase)

- Club stats and motivational content (deferred to Phase 5E-3)
- Admin controls to override or reset first-completer recognition (defer to later admin slice)
- All-time popularity rankings across campaigns (defer to later slice)
- Social feed or broader athlete-to-athlete activity visibility (defer to Phase 5G or later)
- Leaderboard-style ranked competition (out of scope for Explorer MVP)
- Notifications or badges when athlete becomes first completer (defer to later work)
- Map discovery (moves to Phase 5F)

## Next Steps

1. ✅ Update [wmv-explorer-destinations-phases.md](./wmv-explorer-destinations-phases.md) to record Phase 5E with Club tab and Phase 5E-3 deferred
2. ✅ Update [wmv-explorer-worklog.md](./wmv-explorer-worklog.md) to reflect Club tab and new phase structure
3. ✅ Update [wmv-explorer-readiness-checklist.md](./wmv-explorer-readiness-checklist.md) with Phase 5E scope
4. Create dedicated feature branch `feat/explorer-5e-club-tab`
5. Implementation ready for Phase 5E-1, 5E-2 handoff to dev-agent

---

**Owner**: Planning  
**Status**: Decisions recorded; ready for implementation  
**Next Review**: After Phase 5E-2 completion, plan Phase 5E-3 stats scope  
