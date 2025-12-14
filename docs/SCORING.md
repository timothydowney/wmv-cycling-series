# Scoring Rules

This series rewards participation and relative performance. Points are calculated per week and summed for the season leaderboard.

## Weekly Competition

- Complete the designated Strava segment the required number of times ("laps") within a single activity on the event day
- The best single qualifying activity for each participant counts
- Qualifying activity must contain at least the required number of segment efforts for that week's segment

## Time and Ranking

- Total time = sum of all segment efforts within the best qualifying activity
- Rank participants by total time (fastest to slowest)

## Points Formula

**Base Points:** Number of participants you beat that week
- Example (4 finishers):
  - 1st place beats 3 → 3 base points
  - 2nd place beats 2 → 2 base points
  - 3rd place beats 1 → 1 base point
  - 4th place beats 0 → 0 base points

**Participation Bonus:** +1 point for completing the event (awarded to every participant with a valid activity)

**PR Bonus:** +1 point if you achieved a personal record on any segment effort in your best activity
- **Important:** Maximum 1 PR bonus point per week, even if multiple segment efforts are PRs
- Example: If you complete 3 laps and improve on 2 of them, you still earn only 1 PR bonus point

**Weekly Multiplier:** Each week can have an optional multiplier (default: 1, range: 1-5 or any integer)
- Multiplier is applied to the final point total
- Example: A week with 2× multiplier doubles all points that week

**Total Weekly Points = (Base Points + Participation Bonus + PR Bonus) × Weekly Multiplier**

**Example Scenarios (4 participants, default 1× multiplier):**
- 1st place with PR: `(3 beaten + 1 participated + 1 PR) × 1 = 5 points`
- 2nd place no PR: `(2 beaten + 1 participated + 0 PR) × 1 = 3 points`
- 4th place (slowest): `(0 beaten + 1 participated + 0 PR) × 1 = 1 point`

**Example Scenarios (4 participants, 2× multiplier for special event):**
- 1st place with PR: `(3 beaten + 1 participated + 1 PR) × 2 = 10 points`
- 2nd place no PR: `(2 beaten + 1 participated + 0 PR) × 2 = 6 points`
- 4th place (slowest): `(0 beaten + 1 participated + 0 PR) × 2 = 2 points`

## Key Architectural Detail

**Scores are computed fresh on every leaderboard request**, not stored in the database. This ensures that when participants delete their data, remaining participants' scores automatically recalculate correctly. No manual reconciliation needed.

Example: If 1st place deletes mid-season, 2nd place automatically becomes 1st with updated points—no stale data.

## Edge Cases

- **Multiple activities on the same day:** Only the best single qualifying activity counts toward scoring
- **Activities spanning midnight:** Must fall within the configured time window for the week
- **Insufficient laps:** The activity does not qualify and participant gets 0 points (no participation bonus if invalid)
- **Ties:** Participants with identical total times share the same rank; points are computed based on final rank position
- **Multiple PRs in one activity:** If an activity has multiple laps that are PRs, only 1 PR bonus point (not per lap)
- **User deletion:** Remaining participants' scores recalculate automatically (scores computed on-read, not stored)

## Season Leaderboard

Season points = sum of all weekly points for that participant. Participants who don't complete a week get 0 points for that week (don't appear on that week's leaderboard).

## Implementation

Implementation details and edge-case handling are covered by backend tests. See [API Reference](./API.md) and [Database Design](./DATABASE_DESIGN.md) for implementation details.
