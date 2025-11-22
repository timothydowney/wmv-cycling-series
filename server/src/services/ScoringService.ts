/**
 * ScoringService
 *
 * Provides scoring calculation logic that mirrors the actual leaderboard calculation.
 * Used in tests to verify that database results match expected scoring rules.
 *
 * Scoring formula:
 * - Base Points: (total_participants - rank) + 1
 *   - Awards 1 point for each participant you beat, plus 1 for competing
 * - PR Bonus: +1 if any segment effort has pr_achieved = 1
 * - Total: base_points + pr_bonus_points
 */

import { Database } from 'better-sqlite3';

export interface ScoringResult {
  participantId: number;
  participantName: string;
  rank: number;
  totalTimeSeconds: number;
  basePoints: number;
  prBonusPoints: number;
  totalPoints: number;
}

export interface LeaderboardResult {
  weekId: number;
  results: ScoringResult[];
}

/**
 * Calculate scoring for a week's leaderboard
 */
export function calculateWeekScoring(
  db: Database,
  weekId: number
): LeaderboardResult {
  // Get all results for the week, sorted by time
  const results = db
    .prepare(
      `
    SELECT 
      r.id,
      r.participant_id,
      p.name as participant_name,
      r.total_time_seconds,
      MAX(CASE WHEN se.pr_achieved = 1 THEN 1 ELSE 0 END) as pr_achieved
    FROM result r
    JOIN participant p ON r.participant_id = p.id
    LEFT JOIN activity a ON r.activity_id = a.id
    LEFT JOIN segment_effort se ON a.id = se.activity_id
    WHERE r.week_id = ?
    GROUP BY r.participant_id
    ORDER BY r.total_time_seconds ASC
    `
    )
    .all(weekId) as Array<{
    id: number;
    participant_id: number;
    participant_name: string;
    total_time_seconds: number;
    pr_achieved: number;
  }>;

  if (results.length === 0) {
    return { weekId, results: [] };
  }

  // Calculate scoring
  const totalParticipants = results.length;
  const scoredResults: ScoringResult[] = results.map((result, index) => {
    const rank = index + 1;
    const basePoints = totalParticipants - rank + 1;
    const prBonusPoints = result.pr_achieved ? 1 : 0;
    const totalPoints = basePoints + prBonusPoints;

    return {
      participantId: result.participant_id,
      participantName: result.participant_name,
      rank,
      totalTimeSeconds: result.total_time_seconds,
      basePoints,
      prBonusPoints,
      totalPoints
    };
  });

  return { weekId, results: scoredResults };
}

/**
 * Calculate expected points for a single participant given their rank
 * Useful for test assertions
 */
export function calculateExpectedPoints(
  rank: number,
  totalParticipants: number,
  hasPR: boolean = false
): number {
  const basePoints = totalParticipants - rank + 1;
  const prBonus = hasPR ? 1 : 0;
  return basePoints + prBonus;
}

/**
 * Verify that database results match expected scoring
 * Throws if mismatch found
 */
export function verifyLeaderboardScoring(
  db: Database,
  weekId: number,
  expectedScoring: Array<{
    participantName: string;
    expectedRank: number;
    expectedPoints: number;
    expectedHasPR?: boolean;
  }>
): void {
  const leaderboard = calculateWeekScoring(db, weekId);

  if (leaderboard.results.length !== expectedScoring.length) {
    throw new Error(
      `Leaderboard size mismatch: got ${leaderboard.results.length}, expected ${expectedScoring.length}`
    );
  }

  expectedScoring.forEach((expected, index) => {
    const actual = leaderboard.results[index];

    if (actual.participantName !== expected.participantName) {
      throw new Error(
        `Participant mismatch at rank ${index + 1}: got ${actual.participantName}, expected ${expected.participantName}`
      );
    }

    if (actual.rank !== expected.expectedRank) {
      throw new Error(
        `Rank mismatch for ${expected.participantName}: got ${actual.rank}, expected ${expected.expectedRank}`
      );
    }

    if (actual.totalPoints !== expected.expectedPoints) {
      throw new Error(
        `Points mismatch for ${expected.participantName}: got ${actual.totalPoints}, expected ${expected.expectedPoints}`
      );
    }

    if (expected.expectedHasPR !== undefined) {
      if ((actual.prBonusPoints === 1) !== expected.expectedHasPR) {
        throw new Error(
          `PR flag mismatch for ${expected.participantName}: got ${actual.prBonusPoints === 1}, expected ${expected.expectedHasPR}`
        );
      }
    }
  });
}

/**
 * Get leaderboard as would be displayed to users
 */
export function getDisplayLeaderboard(
  db: Database,
  weekId: number
): Array<{
  rank: number;
  name: string;
  time: string;
  points: number;
}> {
  const leaderboard = calculateWeekScoring(db, weekId);

  return leaderboard.results.map((result) => ({
    rank: result.rank,
    name: result.participantName,
    time: formatSeconds(result.totalTimeSeconds),
    points: result.totalPoints
  }));
}

/**
 * Format seconds as MM:SS
 */
function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get season totals
 */
export function getSeasonLeaderboard(
  db: Database,
  seasonId: number
): Array<{
  rank: number;
  name: string;
  totalPoints: number;
  weeksCompleted: number;
}> {
  const results = db
    .prepare(
      `
    SELECT 
      p.id,
      p.name,
      SUM(r.total_points) as total_points,
      COUNT(DISTINCT r.week_id) as weeks_completed
    FROM result r
    JOIN week w ON r.week_id = w.id
    JOIN participant p ON r.participant_id = p.id
    WHERE w.season_id = ?
    GROUP BY p.id
    ORDER BY total_points DESC
    `
    )
    .all(seasonId) as Array<{
    id: number;
    name: string;
    total_points: number;
    weeks_completed: number;
  }>;

  return results.map((result, index) => ({
    rank: index + 1,
    name: result.name,
    totalPoints: result.total_points || 0,
    weeksCompleted: result.weeks_completed || 0
  }));
}
