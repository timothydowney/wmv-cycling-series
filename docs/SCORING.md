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

**Participation Bonus:** +1 point for competing

**PR Bonus:** +1 point if you set a personal record (PR) on the segment in your best activity

**Total Weekly Points = Base Points + Participation Bonus + PR Bonus**

## Key Architectural Detail

**Scores are computed fresh on every leaderboard request**, not stored in the database. This ensures that when participants delete their data, remaining participants' scores automatically recalculate correctly. No manual reconciliation needed.

Example: If 1st place deletes mid-season, 2nd place automatically becomes 1st with updated points—no stale data.

## Edge Cases

- Multiple activities on the same day: only the best single qualifying activity counts
- Activities spanning midnight: must fall within the configured time window for the week
- Insufficient laps: the activity does not qualify
- Ties: participants with identical total times share the same rank; points are computed based on rank list position
- User deletion: remaining participants' scores recalculate automatically

## Season Leaderboard

Season points = sum of all weekly points for that participant. Participants who don't complete a week get 0 points for that week (don't appear on that week's leaderboard).

## Implementation

Implementation details and edge-case handling are covered by backend tests. See [API Reference](./API.md) and [Database Design](./DATABASE_DESIGN.md) for implementation details.
