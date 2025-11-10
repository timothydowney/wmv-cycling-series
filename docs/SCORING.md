# Scoring rules

This series rewards participation and relative performance. Points are calculated per week and summed for the season leaderboard.

## Weekly competition

- Complete the designated Strava segment the required number of times ("laps") within a single activity on the event day
- The best single qualifying activity for each participant counts
- Qualifying activity contains at least the required number of segment efforts for that week’s segment

## Time and ranking

- Total time = sum of all segment efforts within the best qualifying activity
- Rank participants by total time (fastest to slowest)

## Points

- Base points = number of participants you beat that week
  - Example (4 finishers):
    - 1st place beats 3 → 3 base points
    - 2nd place beats 2 → 2 base points
    - 3rd place beats 1 → 1 base point
    - 4th place beats 0 → 0 base points
- Participation bonus = +1 point for competing
- PR bonus = +1 point if you set a personal record (PR) on the segment in your best activity

Total weekly points = base + participation + PR bonus

## Edge cases

- Multiple activities on the same day: only the best single qualifying activity counts
- Activities spanning midnight: must fall within the configured time window for the week
- Insufficient laps: the activity does not qualify
- Ties: participants with identical total times share rank; points are computed based on rank list

Implementation details and edge-case handling are covered by backend tests. See API and database docs for the exact fields.
