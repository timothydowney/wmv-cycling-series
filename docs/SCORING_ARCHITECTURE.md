# Scoring Architecture Analysis

## Current Model: Hybrid Approach

The WMV app uses a **hybrid scoring model**:

### What Gets Stored
- **Result table** stores: `points`, `pr_bonus_points`, `rank` for each week after batch fetch
- Data is persisted to enable audit trails and historical records
- Used for reference but NOT as the source of truth

### What Gets Computed Dynamically
- **Week leaderboards** (`GET /weeks/:id/leaderboard`): Computed on-read from `activity` and `segment_effort` tables
- **Season standings** (`GET /season/leaderboard`): Computed on-read by summing weekly scores
- Scores recalculated fresh every time to ensure accuracy

## Scoring Formula

```
Base Points = (Total Participants - Your Rank) + 1
  ├─ If 4 participants: 1st gets (4-1)+1=4, 2nd gets (4-2)+1=3, etc.
  └─ Everyone who competes gets at least 1 point (even last place)

PR Bonus = 1 point if you achieved a personal record on ANY segment effort
  └─ Bonus is per-week, not per-lap (one PR bonus per week max)

Total Points = Base Points + PR Bonus
  └─ Example: 3 base points + 1 PR = "3 + 1" displayed in UI
```

## Architecture Comparison

### Current: Computed on Read ✅

**How it works:**
```
User requests leaderboard
  ↓
Query activity table (source of truth)
  ↓
Recompute ranking & points fresh
  ↓
Return computed leaderboard
```

**Pros:**
- ✅ **Always correct:** If a user deletes their data, everyone else's scores adjust automatically
- ✅ **No stale data:** Scores never out-of-sync with activities
- ✅ **No migrations:** Can change scoring formula without re-computing history
- ✅ **Deletion-safe:** Per-week scores recalculate when participants are removed
- ✅ **Audit trail:** Result table can track what scores were at any point in time
- ✅ **GDPR compliant:** Full audit trail of scoring decisions

**Cons:**
- ❌ **Slower reads:** Query has multiple JOINs, but negligible at <100 participants
- ❌ **Not cached:** Could add Redis cache layer if needed (not worth it yet)

### Alternative: Store-Only Approach

**How it would work:**
```
Admin triggers fetch
  ↓
Compute rankings & points
  ↓
Store to result table
  ↓
User requests leaderboard
  ↓
Return stored results directly
```

**Pros:**
- ✅ Faster reads (simple SELECT, no JOINs)
- ✅ Better for huge datasets (10k+ participants)

**Cons:**
- ❌ **Data integrity problem:** If user deletes their data, other people's scores don't update
  - Example: User A beats User B by 1 second. User A deletes. User B should move up 1 ranking. Doesn't happen.
- ❌ **Scoring changes require re-computation:** Can't update formula without recalculating history
- ❌ **Stale data:** Scores locked at fetch time, don't reflect data state
- ❌ **Deletion complexity:** Must cascade-update all affected scores when user deletes
- ❌ **GDPR risk:** Hard to prove scores are accurate after deletion

### Hybrid Alternative: Cache Results (Not Implemented)

**How it would work:**
```
Admin triggers fetch
  ↓
Compute rankings & points (same as current)
  ↓
Store to result table AND Redis cache (TTL: 1 hour)
  ↓
User requests leaderboard
  ↓
Check cache → if hit, return; if miss, compute fresh
```

**Pros:**
- ✅ Same correctness as current approach
- ✅ Faster typical-case reads (cache hit)
- ✅ Handles deletions correctly (cache invalidated)

**Cons:**
- ❌ Adds infrastructure complexity (Redis)
- ❌ Cache invalidation bugs possible
- ❌ Not needed at current scale (<100 participants)

## Current Implementation Details

### Storage (Result Table)
```sql
CREATE TABLE result (
  id INTEGER PRIMARY KEY,
  week_id INTEGER,           -- Which week
  strava_athlete_id INTEGER, -- Which participant
  activity_id INTEGER,       -- Which activity (for audit trail)
  total_time_seconds INTEGER,-- Stored for reference
  rank INTEGER,              -- Stored for reference
  points INTEGER,            -- Stored (not used for display)
  pr_bonus_points INTEGER,   -- Stored (not used for display)
  created_at TEXT,           -- Audit trail
  updated_at TEXT
);
```

**Purpose of storage:**
- Audit trail: Can see what scores were calculated
- Historical reference: Administrators can review decisions
- Migration support: Can trace data changes over time

### Computation (On Read)

**Week leaderboard query** (lines 877-889):
```javascript
SELECT 
  a.id, a.strava_athlete_id, p.name,
  SUM(se.elapsed_seconds) as total_time_seconds,
  MAX(se.pr_achieved) as achieved_pr
FROM activity a
JOIN segment_effort se
JOIN participant p
WHERE a.week_id = ? AND a.validation_status = 'valid' AND se.strava_segment_id = ?
GROUP BY a.id, a.strava_athlete_id
ORDER BY total_time_seconds ASC
```

Then scores are computed in JavaScript:
```javascript
const rank = index + 1;
const basePoints = (totalParticipants - rank) + 1;
const prBonus = activity.achieved_pr ? 1 : 0;
const totalPoints = basePoints + prBonus;
```

**Season leaderboard computation** (lines 995-1019):
- Loops through all weeks
- Computes weekly scores for each participant
- Sums to get season total
- Returns sorted by total_points DESC

## Deletion Safety Analysis

### When a participant requests data deletion:

**Current approach (Compute on Read):**
1. Delete all activity/segment_effort records for that participant
2. Next leaderboard request triggers fresh computation
3. All other participants' scores automatically adjust
4. Result table outdated but irrelevant (not used for display)

✅ **Safe:** Deletion is atomic, scoreboard immediately reflects change

**If using Store-Only:**
1. Delete all activity records for that participant
2. Must also update result table for ALL other participants in that week
3. Risk: If process crashes mid-update, scores become inconsistent
4. Expensive: O(n²) operation if multiple people delete

❌ **Risky:** Requires complex cascade logic

## Performance Implications

### Current Model

**Week leaderboard query time:**
- 1 week-join (index on week_id)
- 1 activity-join (small table at 100 participants)
- 1 segment_effort group (medium table at 500 efforts/week)
- ~1-5ms for 100 participants, single week

**Season leaderboard computation:**
- Loops: 52 weeks × 100 participants = 5,200 iterations
- Each iteration: 1 query + JavaScript computation
- Typical: 50-200ms depending on cache
- Acceptable for <1000 participants

### At Different Scales

| Participants | Weeks | Query Time | Recommendation |
|---|---|---|---|
| <100 | <52 | <50ms | ✅ Current approach perfect |
| 100-1000 | <52 | 50-200ms | ✅ Still fine, maybe add 1-hour cache |
| 1000-10k | <52 | 200-1000ms | ⚠️ Consider caching layer or storage approach |
| 10k+ | <52 | 1s+ | ❌ Need store-only + denormalization |

**WMV is at <100 participants. Current approach is optimal.**

## Recommendations

### Keep Current Approach Because:
1. ✅ Deletion safety is critical for GDPR compliance
2. ✅ Scores are always correct
3. ✅ No performance concerns at current scale
4. ✅ Simplest mental model (source of truth = activities table)
5. ✅ Audit trail built-in

### If You Ever Need to Optimize:
1. **First:** Add 1-hour Redis cache (minimal code change)
2. **Then:** Measure actual performance (might not be needed)
3. **If needed:** Switch to caching strategy with cache invalidation on delete
4. **Last resort:** Switch to store-only approach (only for 10k+ participants)

### Result Table Usage:
- **Keep storing:** Good for audit trail and can add admin reporting
- **Don't use for display:** Always compute scores on read
- **Consider adding:** `reason` column to track why score is what it is (for debugging)

## Scoring Formula Flexibility

One advantage of compute-on-read: **scoring formula can change easily**

### Current formula:
```
Points = (Total Participants - Rank) + 1 + PR Bonus
```

### Alternative formulas possible:
- **Exponential:** Could reward first place more (1st: 4x, 2nd: 2x, 3rd: 1x)
- **Fixed scale:** Could be points = 100/rank (1st: 100, 2nd: 50, 3rd: 33, etc.)
- **Variable PR bonus:** Could be rank-dependent (1st place PR = 5 bonus, last place = 1 bonus)

**With compute-on-read:** Change the formula in one function, all leaderboards update automatically.
**With store-only:** Must re-fetch and recalculate history. Much harder.

## Conclusion

**Current model is excellent for WMV:**
- ✅ Simple: activities table = source of truth
- ✅ Correct: deletion-safe and always accurate
- ✅ Flexible: scoring formula can evolve
- ✅ Performant: fast enough for current scale
- ✅ Compliant: GDPR deletion is clean and auditable

No changes recommended unless scale grows significantly (>1000 participants).
