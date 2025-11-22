/**
 * Tests for ScoringService
 * Verifies scoring calculation logic
 */

import Database from 'better-sqlite3';
import { calculateWeekScoring, calculateExpectedPoints, verifyLeaderboardScoring, getDisplayLeaderboard, getSeasonLeaderboard } from '../services/ScoringService';

describe('ScoringService', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory database
    db = new Database(':memory:');

    // Create schema
    db.exec(`
      CREATE TABLE season (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE week (
        id INTEGER PRIMARY KEY,
        season_id INTEGER NOT NULL,
        week_name TEXT NOT NULL,
        FOREIGN KEY (season_id) REFERENCES season(id)
      );

      CREATE TABLE participant (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE activity (
        id INTEGER PRIMARY KEY,
        week_id INTEGER NOT NULL,
        participant_id INTEGER NOT NULL,
        strava_activity_id INTEGER NOT NULL,
        total_time_seconds INTEGER,
        FOREIGN KEY (week_id) REFERENCES week(id),
        FOREIGN KEY (participant_id) REFERENCES participant(id)
      );

      CREATE TABLE result (
        id INTEGER PRIMARY KEY,
        week_id INTEGER NOT NULL,
        participant_id INTEGER NOT NULL,
        activity_id INTEGER,
        total_time_seconds INTEGER NOT NULL,
        rank INTEGER,
        base_points INTEGER,
        pr_bonus_points INTEGER DEFAULT 0,
        total_points INTEGER,
        FOREIGN KEY (week_id) REFERENCES week(id),
        FOREIGN KEY (participant_id) REFERENCES participant(id),
        FOREIGN KEY (activity_id) REFERENCES activity(id),
        UNIQUE(week_id, participant_id)
      );

      CREATE TABLE segment_effort (
        id INTEGER PRIMARY KEY,
        activity_id INTEGER NOT NULL,
        elapsed_seconds INTEGER NOT NULL,
        effort_index INTEGER,
        pr_achieved INTEGER DEFAULT 0,
        FOREIGN KEY (activity_id) REFERENCES activity(id)
      );

      CREATE TABLE webhook_event (
        id INTEGER PRIMARY KEY,
        event_type TEXT
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  describe('calculateWeekScoring', () => {
    it('should return empty results for week with no results', () => {
      const season = db.prepare('INSERT INTO season (name) VALUES (?)').run('Test Season');
      const week = db.prepare('INSERT INTO week (season_id, week_name) VALUES (?, ?)').run(season.lastInsertRowid, 'Week 1');

      const result = calculateWeekScoring(db, week.lastInsertRowid as number);

      expect(result.weekId).toBe(week.lastInsertRowid);
      expect(result.results).toHaveLength(0);
    });

    it('should calculate scoring for a single participant', () => {
      const season = db.prepare('INSERT INTO season (name) VALUES (?)').run('Test Season');
      const week = db.prepare('INSERT INTO week (season_id, week_name) VALUES (?, ?)').run(season.lastInsertRowid, 'Week 1');
      const participant = db.prepare('INSERT INTO participant (name) VALUES (?)').run('Alice');
      const activity = db.prepare('INSERT INTO activity (week_id, participant_id, strava_activity_id, total_time_seconds) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, participant.lastInsertRowid, 123, 1200);

      // Insert result
      db.prepare('INSERT INTO result (week_id, participant_id, activity_id, total_time_seconds, rank, base_points, pr_bonus_points, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(week.lastInsertRowid, participant.lastInsertRowid, activity.lastInsertRowid, 1200, 1, 1, 0, 1);

      const result = calculateWeekScoring(db, week.lastInsertRowid as number);

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        participantId: participant.lastInsertRowid,
        participantName: 'Alice',
        rank: 1,
        totalTimeSeconds: 1200,
        basePoints: 1,
        prBonusPoints: 0,
        totalPoints: 1
      });
    });

    it('should calculate scoring for multiple participants', () => {
      const season = db.prepare('INSERT INTO season (name) VALUES (?)').run('Test Season');
      const week = db.prepare('INSERT INTO week (season_id, week_name) VALUES (?, ?)').run(season.lastInsertRowid, 'Week 1');
      const p1 = db.prepare('INSERT INTO participant (name) VALUES (?)').run('Alice');
      const p2 = db.prepare('INSERT INTO participant (name) VALUES (?)').run('Bob');
      const p3 = db.prepare('INSERT INTO participant (name) VALUES (?)').run('Charlie');

      const a1 = db.prepare('INSERT INTO activity (week_id, participant_id, strava_activity_id, total_time_seconds) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, p1.lastInsertRowid, 111, 1200);
      const a2 = db.prepare('INSERT INTO activity (week_id, participant_id, strava_activity_id, total_time_seconds) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, p2.lastInsertRowid, 222, 1100);
      const a3 = db.prepare('INSERT INTO activity (week_id, participant_id, strava_activity_id, total_time_seconds) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, p3.lastInsertRowid, 333, 1300);

      // Insert results (fastest first: Bob=1100, Alice=1200, Charlie=1300)
      db.prepare('INSERT INTO result (week_id, participant_id, activity_id, total_time_seconds, rank, base_points, pr_bonus_points, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(week.lastInsertRowid, p2.lastInsertRowid, a2.lastInsertRowid, 1100, 1, 3, 0, 3);
      db.prepare('INSERT INTO result (week_id, participant_id, activity_id, total_time_seconds, rank, base_points, pr_bonus_points, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(week.lastInsertRowid, p1.lastInsertRowid, a1.lastInsertRowid, 1200, 2, 2, 0, 2);
      db.prepare('INSERT INTO result (week_id, participant_id, activity_id, total_time_seconds, rank, base_points, pr_bonus_points, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(week.lastInsertRowid, p3.lastInsertRowid, a3.lastInsertRowid, 1300, 3, 1, 0, 1);

      const result = calculateWeekScoring(db, week.lastInsertRowid as number);

      expect(result.results).toHaveLength(3);
      // Should be sorted by rank
      expect(result.results[0].participantName).toBe('Bob');
      expect(result.results[0].totalPoints).toBe(3);
      expect(result.results[1].participantName).toBe('Alice');
      expect(result.results[1].totalPoints).toBe(2);
      expect(result.results[2].participantName).toBe('Charlie');
      expect(result.results[2].totalPoints).toBe(1);
    });

    it('should include PR bonus in scoring', () => {
      const season = db.prepare('INSERT INTO season (name) VALUES (?)').run('Test Season');
      const week = db.prepare('INSERT INTO week (season_id, week_name) VALUES (?, ?)').run(season.lastInsertRowid, 'Week 1');
      const participant = db.prepare('INSERT INTO participant (name) VALUES (?)').run('Alice');
      const activity = db.prepare('INSERT INTO activity (week_id, participant_id, strava_activity_id, total_time_seconds) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, participant.lastInsertRowid, 123, 1200);

      // Add segment effort with PR
      db.prepare('INSERT INTO segment_effort (activity_id, elapsed_seconds, pr_achieved) VALUES (?, ?, ?)')
        .run(activity.lastInsertRowid, 600, 1);

      // Insert result with PR bonus
      db.prepare('INSERT INTO result (week_id, participant_id, activity_id, total_time_seconds, rank, base_points, pr_bonus_points, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(week.lastInsertRowid, participant.lastInsertRowid, activity.lastInsertRowid, 1200, 1, 1, 1, 2);

      const result = calculateWeekScoring(db, week.lastInsertRowid as number);

      expect(result.results[0]).toEqual({
        participantId: participant.lastInsertRowid,
        participantName: 'Alice',
        rank: 1,
        totalTimeSeconds: 1200,
        basePoints: 1,
        prBonusPoints: 1,
        totalPoints: 2
      });
    });
  });

  describe('calculateExpectedPoints', () => {
    it('should calculate expected points for different ranks', () => {
      // 4 participants total
      expect(calculateExpectedPoints(1, 4, false)).toBe(4); // 4-1+1 = 4
      expect(calculateExpectedPoints(2, 4, false)).toBe(3); // 4-2+1 = 3
      expect(calculateExpectedPoints(3, 4, false)).toBe(2); // 4-3+1 = 2
      expect(calculateExpectedPoints(4, 4, false)).toBe(1); // 4-4+1 = 1
    });

    it('should add PR bonus to expected points', () => {
      expect(calculateExpectedPoints(1, 4, true)).toBe(5); // 4 + 1 PR bonus
      expect(calculateExpectedPoints(2, 4, true)).toBe(4); // 3 + 1 PR bonus
    });

    it('should handle single participant', () => {
      expect(calculateExpectedPoints(1, 1, false)).toBe(1);
      expect(calculateExpectedPoints(1, 1, true)).toBe(2);
    });

    it('should handle large participant counts', () => {
      expect(calculateExpectedPoints(1, 100, false)).toBe(100);
      expect(calculateExpectedPoints(50, 100, false)).toBe(51);
      expect(calculateExpectedPoints(100, 100, false)).toBe(1);
    });
  });

  describe('verifyLeaderboardScoring', () => {
    it('should verify correct leaderboard scoring', () => {
      const season = db.prepare('INSERT INTO season (name) VALUES (?)').run('Test Season');
      const week = db.prepare('INSERT INTO week (season_id, week_name) VALUES (?, ?)').run(season.lastInsertRowid, 'Week 1');
      const p1 = db.prepare('INSERT INTO participant (name) VALUES (?)').run('Alice');
      const p2 = db.prepare('INSERT INTO participant (name) VALUES (?)').run('Bob');

      const a1 = db.prepare('INSERT INTO activity (week_id, participant_id, strava_activity_id, total_time_seconds) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, p1.lastInsertRowid, 111, 1100);
      const a2 = db.prepare('INSERT INTO activity (week_id, participant_id, strava_activity_id, total_time_seconds) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, p2.lastInsertRowid, 222, 1200);

      db.prepare('INSERT INTO result (week_id, participant_id, activity_id, total_time_seconds, rank, base_points, pr_bonus_points, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(week.lastInsertRowid, p1.lastInsertRowid, a1.lastInsertRowid, 1100, 1, 2, 0, 2);
      db.prepare('INSERT INTO result (week_id, participant_id, activity_id, total_time_seconds, rank, base_points, pr_bonus_points, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(week.lastInsertRowid, p2.lastInsertRowid, a2.lastInsertRowid, 1200, 2, 1, 0, 1);

      expect(() => {
        verifyLeaderboardScoring(db, week.lastInsertRowid as number, [
          { participantName: 'Alice', expectedRank: 1, expectedPoints: 2 },
          { participantName: 'Bob', expectedRank: 2, expectedPoints: 1 }
        ]);
      }).not.toThrow();
    });

    it('should throw on leaderboard size mismatch', () => {
      const season = db.prepare('INSERT INTO season (name) VALUES (?)').run('Test Season');
      const week = db.prepare('INSERT INTO week (season_id, week_name) VALUES (?, ?)').run(season.lastInsertRowid, 'Week 1');
      const p1 = db.prepare('INSERT INTO participant (name) VALUES (?)').run('Alice');
      const a1 = db.prepare('INSERT INTO activity (week_id, participant_id, strava_activity_id, total_time_seconds) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, p1.lastInsertRowid, 111, 1100);
      db.prepare('INSERT INTO result (week_id, participant_id, activity_id, total_time_seconds, rank, base_points, pr_bonus_points, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(week.lastInsertRowid, p1.lastInsertRowid, a1.lastInsertRowid, 1100, 1, 1, 0, 1);

      expect(() => {
        verifyLeaderboardScoring(db, week.lastInsertRowid as number, [
          { participantName: 'Alice', expectedRank: 1, expectedPoints: 1 },
          { participantName: 'Bob', expectedRank: 2, expectedPoints: 2 }
        ]);
      }).toThrow('Leaderboard size mismatch');
    });

    it('should throw on participant name mismatch', () => {
      const season = db.prepare('INSERT INTO season (name) VALUES (?)').run('Test Season');
      const week = db.prepare('INSERT INTO week (season_id, week_name) VALUES (?, ?)').run(season.lastInsertRowid, 'Week 1');
      const p1 = db.prepare('INSERT INTO participant (name) VALUES (?)').run('Alice');
      const a1 = db.prepare('INSERT INTO activity (week_id, participant_id, strava_activity_id, total_time_seconds) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, p1.lastInsertRowid, 111, 1100);
      db.prepare('INSERT INTO result (week_id, participant_id, activity_id, total_time_seconds, rank, base_points, pr_bonus_points, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(week.lastInsertRowid, p1.lastInsertRowid, a1.lastInsertRowid, 1100, 1, 1, 0, 1);

      expect(() => {
        verifyLeaderboardScoring(db, week.lastInsertRowid as number, [
          { participantName: 'Bob', expectedRank: 1, expectedPoints: 1 }
        ]);
      }).toThrow('Participant mismatch');
    });

    it('should throw on points mismatch', () => {
      const season = db.prepare('INSERT INTO season (name) VALUES (?)').run('Test Season');
      const week = db.prepare('INSERT INTO week (season_id, week_name) VALUES (?, ?)').run(season.lastInsertRowid, 'Week 1');
      const p1 = db.prepare('INSERT INTO participant (name) VALUES (?)').run('Alice');
      const a1 = db.prepare('INSERT INTO activity (week_id, participant_id, strava_activity_id, total_time_seconds) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, p1.lastInsertRowid, 111, 1100);
      db.prepare('INSERT INTO result (week_id, participant_id, activity_id, total_time_seconds, rank, base_points, pr_bonus_points, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(week.lastInsertRowid, p1.lastInsertRowid, a1.lastInsertRowid, 1100, 1, 1, 0, 1);

      expect(() => {
        verifyLeaderboardScoring(db, week.lastInsertRowid as number, [
          { participantName: 'Alice', expectedRank: 1, expectedPoints: 5 }
        ]);
      }).toThrow('Points mismatch');
    });

    it('should verify PR flag when specified', () => {
      const season = db.prepare('INSERT INTO season (name) VALUES (?)').run('Test Season');
      const week = db.prepare('INSERT INTO week (season_id, week_name) VALUES (?, ?)').run(season.lastInsertRowid, 'Week 1');
      const p1 = db.prepare('INSERT INTO participant (name) VALUES (?)').run('Alice');
      const a1 = db.prepare('INSERT INTO activity (week_id, participant_id, strava_activity_id, total_time_seconds) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, p1.lastInsertRowid, 111, 1100);
      db.prepare('INSERT INTO segment_effort (activity_id, elapsed_seconds, pr_achieved) VALUES (?, ?, ?)')
        .run(a1.lastInsertRowid, 600, 1);
      db.prepare('INSERT INTO result (week_id, participant_id, activity_id, total_time_seconds, rank, base_points, pr_bonus_points, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(week.lastInsertRowid, p1.lastInsertRowid, a1.lastInsertRowid, 1100, 1, 1, 1, 2);

      expect(() => {
        verifyLeaderboardScoring(db, week.lastInsertRowid as number, [
          { participantName: 'Alice', expectedRank: 1, expectedPoints: 2, expectedHasPR: true }
        ]);
      }).not.toThrow();
    });
  });

  describe('getDisplayLeaderboard', () => {
    it('should format leaderboard for display', () => {
      const season = db.prepare('INSERT INTO season (name) VALUES (?)').run('Test Season');
      const week = db.prepare('INSERT INTO week (season_id, week_name) VALUES (?, ?)').run(season.lastInsertRowid, 'Week 1');
      const p1 = db.prepare('INSERT INTO participant (name) VALUES (?)').run('Alice');
      const a1 = db.prepare('INSERT INTO activity (week_id, participant_id, strava_activity_id, total_time_seconds) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, p1.lastInsertRowid, 111, 1320); // 22 minutes

      db.prepare('INSERT INTO result (week_id, participant_id, activity_id, total_time_seconds, rank, base_points, pr_bonus_points, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(week.lastInsertRowid, p1.lastInsertRowid, a1.lastInsertRowid, 1320, 1, 1, 0, 1);

      const display = getDisplayLeaderboard(db, week.lastInsertRowid as number);

      expect(display).toHaveLength(1);
      expect(display[0]).toEqual({
        rank: 1,
        name: 'Alice',
        time: '22:00',
        points: 1
      });
    });

    it('should format time correctly with seconds', () => {
      const season = db.prepare('INSERT INTO season (name) VALUES (?)').run('Test Season');
      const week = db.prepare('INSERT INTO week (season_id, week_name) VALUES (?, ?)').run(season.lastInsertRowid, 'Week 1');
      const p1 = db.prepare('INSERT INTO participant (name) VALUES (?)').run('Alice');
      const a1 = db.prepare('INSERT INTO activity (week_id, participant_id, strava_activity_id, total_time_seconds) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, p1.lastInsertRowid, 111, 605); // 10 minutes 5 seconds

      db.prepare('INSERT INTO result (week_id, participant_id, activity_id, total_time_seconds, rank, base_points, pr_bonus_points, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(week.lastInsertRowid, p1.lastInsertRowid, a1.lastInsertRowid, 605, 1, 1, 0, 1);

      const display = getDisplayLeaderboard(db, week.lastInsertRowid as number);
      expect(display[0].time).toBe('10:05');
    });
  });

  describe('getSeasonLeaderboard', () => {
    it('should return empty leaderboard for season with no results', () => {
      const season = db.prepare('INSERT INTO season (name) VALUES (?)').run('Test Season');

      const leaderboard = getSeasonLeaderboard(db, season.lastInsertRowid as number);

      expect(leaderboard).toHaveLength(0);
    });

    it('should sum points across multiple weeks', () => {
      const season = db.prepare('INSERT INTO season (name) VALUES (?)').run('Test Season');
      const week1 = db.prepare('INSERT INTO week (season_id, week_name) VALUES (?, ?)').run(season.lastInsertRowid, 'Week 1');
      const week2 = db.prepare('INSERT INTO week (season_id, week_name) VALUES (?, ?)').run(season.lastInsertRowid, 'Week 2');
      const p1 = db.prepare('INSERT INTO participant (name) VALUES (?)').run('Alice');

      const a1 = db.prepare('INSERT INTO activity (week_id, participant_id, strava_activity_id, total_time_seconds) VALUES (?, ?, ?, ?)').run(week1.lastInsertRowid, p1.lastInsertRowid, 111, 1100);
      const a2 = db.prepare('INSERT INTO activity (week_id, participant_id, strava_activity_id, total_time_seconds) VALUES (?, ?, ?, ?)').run(week2.lastInsertRowid, p1.lastInsertRowid, 222, 1200);

      db.prepare('INSERT INTO result (week_id, participant_id, activity_id, total_time_seconds, rank, base_points, pr_bonus_points, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(week1.lastInsertRowid, p1.lastInsertRowid, a1.lastInsertRowid, 1100, 1, 3, 0, 3);
      db.prepare('INSERT INTO result (week_id, participant_id, activity_id, total_time_seconds, rank, base_points, pr_bonus_points, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(week2.lastInsertRowid, p1.lastInsertRowid, a2.lastInsertRowid, 1200, 1, 5, 1, 6);

      const leaderboard = getSeasonLeaderboard(db, season.lastInsertRowid as number);

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0]).toEqual({
        rank: 1,
        name: 'Alice',
        totalPoints: 9, // 3 + 6
        weeksCompleted: 2
      });
    });

    it('should rank multiple participants by total points', () => {
      const season = db.prepare('INSERT INTO season (name) VALUES (?)').run('Test Season');
      const week1 = db.prepare('INSERT INTO week (season_id, week_name) VALUES (?, ?)').run(season.lastInsertRowid, 'Week 1');
      const p1 = db.prepare('INSERT INTO participant (name) VALUES (?)').run('Alice');
      const p2 = db.prepare('INSERT INTO participant (name) VALUES (?)').run('Bob');

      const a1 = db.prepare('INSERT INTO activity (week_id, participant_id, strava_activity_id, total_time_seconds) VALUES (?, ?, ?, ?)').run(week1.lastInsertRowid, p1.lastInsertRowid, 111, 1100);
      const a2 = db.prepare('INSERT INTO activity (week_id, participant_id, strava_activity_id, total_time_seconds) VALUES (?, ?, ?, ?)').run(week1.lastInsertRowid, p2.lastInsertRowid, 222, 1200);

      db.prepare('INSERT INTO result (week_id, participant_id, activity_id, total_time_seconds, rank, base_points, pr_bonus_points, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(week1.lastInsertRowid, p1.lastInsertRowid, a1.lastInsertRowid, 1100, 1, 2, 0, 2);
      db.prepare('INSERT INTO result (week_id, participant_id, activity_id, total_time_seconds, rank, base_points, pr_bonus_points, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(week1.lastInsertRowid, p2.lastInsertRowid, a2.lastInsertRowid, 1200, 2, 1, 0, 1);

      const leaderboard = getSeasonLeaderboard(db, season.lastInsertRowid as number);

      expect(leaderboard).toHaveLength(2);
      expect(leaderboard[0].name).toBe('Alice');
      expect(leaderboard[0].totalPoints).toBe(2);
      expect(leaderboard[1].name).toBe('Bob');
      expect(leaderboard[1].totalPoints).toBe(1);
    });

    it('should handle participants with no results', () => {
      const season = db.prepare('INSERT INTO season (name) VALUES (?)').run('Test Season');
      const week1 = db.prepare('INSERT INTO week (season_id, week_name) VALUES (?, ?)').run(season.lastInsertRowid, 'Week 1');
      const p1 = db.prepare('INSERT INTO participant (name) VALUES (?)').run('Alice');
      db.prepare('INSERT INTO participant (name) VALUES (?)').run('Bob'); // No results

      const a1 = db.prepare('INSERT INTO activity (week_id, participant_id, strava_activity_id, total_time_seconds) VALUES (?, ?, ?, ?)').run(week1.lastInsertRowid, p1.lastInsertRowid, 111, 1100);
      db.prepare('INSERT INTO result (week_id, participant_id, activity_id, total_time_seconds, rank, base_points, pr_bonus_points, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(week1.lastInsertRowid, p1.lastInsertRowid, a1.lastInsertRowid, 1100, 1, 1, 0, 1);

      const leaderboard = getSeasonLeaderboard(db, season.lastInsertRowid as number);

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].name).toBe('Alice');
    });
  });
});
