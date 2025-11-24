/**
 * Tests for ScoringService
 * Verifies scoring calculation logic using real production schema
 */

import Database from 'better-sqlite3';
import { SCHEMA } from '../schema';
import { calculateWeekScoring, calculateExpectedPoints, verifyLeaderboardScoring, getDisplayLeaderboard, getSeasonLeaderboard } from '../services/ScoringService';

describe('ScoringService', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory database
    db = new Database(':memory:');

    // Use the real production schema
    db.exec(SCHEMA);
  });

  afterEach(() => {
    db.close();
  });

  describe('calculateWeekScoring', () => {
    it('should return empty results for week with no results', () => {
      const season = db.prepare('INSERT INTO season (name, start_at, end_at) VALUES (?, ?, ?)').run('Test Season', 1000000, 2000000);
      const segment = db.prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)').run(1001, 'Test Segment');
      const week = db.prepare('INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?)').run(season.lastInsertRowid, 'Week 1', segment.lastInsertRowid, 1, 1000000, 1100000);

      const result = calculateWeekScoring(db, week.lastInsertRowid as number);

      expect(result.weekId).toBe(week.lastInsertRowid);
      expect(result.results).toHaveLength(0);
    });

    it('should calculate scoring for a single participant', () => {
      const season = db.prepare('INSERT INTO season (name, start_at, end_at) VALUES (?, ?, ?)').run('Test Season', 1000000, 2000000);
      const segment = db.prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)').run(1002, 'Test Segment');
      const week = db.prepare('INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?)').run(season.lastInsertRowid, 'Week 1', segment.lastInsertRowid, 1, 1000000, 1100000);
      
      // Insert participant with strava_athlete_id as PRIMARY KEY
      db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(12345, 'Alice');
      
      // Insert activity
      const activity = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, 12345, 123, 1050000);
      
      // Insert segment effort
      db.prepare('INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at, pr_achieved) VALUES (?, ?, ?, ?, ?, ?)')
        .run(activity.lastInsertRowid, segment.lastInsertRowid, 1, 1200, 1050000, 0);
      
      // Insert result
      db.prepare('INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (?, ?, ?, ?)')
        .run(week.lastInsertRowid, 12345, activity.lastInsertRowid, 1200);

      const result = calculateWeekScoring(db, week.lastInsertRowid as number);

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        participantId: 12345,
        participantName: 'Alice',
        rank: 1,
        totalTimeSeconds: 1200,
        basePoints: 1,
        prBonusPoints: 0,
        totalPoints: 1
      });
    });

    it('should calculate scoring for multiple participants', () => {
      const season = db.prepare('INSERT INTO season (name, start_at, end_at) VALUES (?, ?, ?)').run('Test Season', 1000000, 2000000);
      const segment = db.prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)').run(1003, 'Test Segment');
      const week = db.prepare('INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?)').run(season.lastInsertRowid, 'Week 1', segment.lastInsertRowid, 1, 1000000, 1100000);
      
      // Insert participants
      db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(12346, 'Alice');
      db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(12347, 'Bob');
      db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(12348, 'Charlie');

      // Insert activities
      const a1 = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, 12346, 111, 1050000);
      const a2 = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, 12347, 222, 1060000);
      const a3 = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, 12348, 333, 1070000);

      // Insert segment efforts
      db.prepare('INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at, pr_achieved) VALUES (?, ?, ?, ?, ?, ?)')
        .run(a1.lastInsertRowid, segment.lastInsertRowid, 1, 1200, 1050000, 0);
      db.prepare('INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at, pr_achieved) VALUES (?, ?, ?, ?, ?, ?)')
        .run(a2.lastInsertRowid, segment.lastInsertRowid, 1, 1100, 1060000, 0);
      db.prepare('INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at, pr_achieved) VALUES (?, ?, ?, ?, ?, ?)')
        .run(a3.lastInsertRowid, segment.lastInsertRowid, 1, 1300, 1070000, 0);

      // Insert results (fastest first: Bob=1100, Alice=1200, Charlie=1300)
      db.prepare('INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (?, ?, ?, ?)')
        .run(week.lastInsertRowid, 12346, a1.lastInsertRowid, 1200);
      db.prepare('INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (?, ?, ?, ?)')
        .run(week.lastInsertRowid, 12347, a2.lastInsertRowid, 1100);
      db.prepare('INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (?, ?, ?, ?)')
        .run(week.lastInsertRowid, 12348, a3.lastInsertRowid, 1300);

      const result = calculateWeekScoring(db, week.lastInsertRowid as number);

      expect(result.results).toHaveLength(3);
      // Should be sorted by rank (fastest first)
      expect(result.results[0].participantName).toBe('Bob');
      expect(result.results[0].totalPoints).toBe(3); // 3-1+1 = 3
      expect(result.results[1].participantName).toBe('Alice');
      expect(result.results[1].totalPoints).toBe(2); // 3-2+1 = 2
      expect(result.results[2].participantName).toBe('Charlie');
      expect(result.results[2].totalPoints).toBe(1); // 3-3+1 = 1
    });

    it('should include PR bonus in scoring', () => {
      const season = db.prepare('INSERT INTO season (name, start_at, end_at) VALUES (?, ?, ?)').run('Test Season', 1000000, 2000000);
      const segment = db.prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)').run(1004, 'Test Segment');
      const week = db.prepare('INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?)').run(season.lastInsertRowid, 'Week 1', segment.lastInsertRowid, 1, 1000000, 1100000);
      
      // Insert participant
      db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(12349, 'Alice');
      
      // Insert activity
      const activity = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, 12349, 123, 1050000);
      
      // Add segment effort with PR
      db.prepare('INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at, pr_achieved) VALUES (?, ?, ?, ?, ?, ?)')
        .run(activity.lastInsertRowid, segment.lastInsertRowid, 1, 600, 1050000, 1);

      // Insert result
      db.prepare('INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (?, ?, ?, ?)')
        .run(week.lastInsertRowid, 12349, activity.lastInsertRowid, 600);

      const result = calculateWeekScoring(db, week.lastInsertRowid as number);

      expect(result.results[0]).toEqual({
        participantId: 12349,
        participantName: 'Alice',
        rank: 1,
        totalTimeSeconds: 600,
        basePoints: 1,
        prBonusPoints: 1,
        totalPoints: 2 // 1 base + 1 PR bonus
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
      const season = db.prepare('INSERT INTO season (name, start_at, end_at) VALUES (?, ?, ?)').run('Test Season', 1000000, 2000000);
      const segment = db.prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)').run(1005, 'Test Segment');
      const week = db.prepare('INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?)').run(season.lastInsertRowid, 'Week 1', segment.lastInsertRowid, 1, 1000000, 1100000);
      
      // Insert participants
      db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(12350, 'Alice');
      db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(12351, 'Bob');

      // Insert activities
      const a1 = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, 12350, 111, 1050000);
      const a2 = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, 12351, 222, 1060000);

      // Insert segment efforts
      db.prepare('INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at, pr_achieved) VALUES (?, ?, ?, ?, ?, ?)')
        .run(a1.lastInsertRowid, segment.lastInsertRowid, 1, 1100, 1050000, 0);
      db.prepare('INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at, pr_achieved) VALUES (?, ?, ?, ?, ?, ?)')
        .run(a2.lastInsertRowid, segment.lastInsertRowid, 1, 1200, 1060000, 0);

      // Insert results
      db.prepare('INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (?, ?, ?, ?)')
        .run(week.lastInsertRowid, 12350, a1.lastInsertRowid, 1100);
      db.prepare('INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (?, ?, ?, ?)')
        .run(week.lastInsertRowid, 12351, a2.lastInsertRowid, 1200);

      expect(() => {
        verifyLeaderboardScoring(db, week.lastInsertRowid as number, [
          { participantName: 'Alice', expectedRank: 1, expectedPoints: 2 },
          { participantName: 'Bob', expectedRank: 2, expectedPoints: 1 }
        ]);
      }).not.toThrow();
    });

    it('should throw on leaderboard size mismatch', () => {
      const season = db.prepare('INSERT INTO season (name, start_at, end_at) VALUES (?, ?, ?)').run('Test Season', 1000000, 2000000);
      const segment = db.prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)').run(1006, 'Test Segment');
      const week = db.prepare('INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?)').run(season.lastInsertRowid, 'Week 1', segment.lastInsertRowid, 1, 1000000, 1100000);
      
      // Insert participant
      db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(12352, 'Alice');
      
      // Insert activity
      const a1 = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, 12352, 111, 1050000);
      
      // Insert segment effort
      db.prepare('INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at, pr_achieved) VALUES (?, ?, ?, ?, ?, ?)')
        .run(a1.lastInsertRowid, segment.lastInsertRowid, 1, 1100, 1050000, 0);
      
      // Insert result
      db.prepare('INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (?, ?, ?, ?)')
        .run(week.lastInsertRowid, 12352, a1.lastInsertRowid, 1100);

      expect(() => {
        verifyLeaderboardScoring(db, week.lastInsertRowid as number, [
          { participantName: 'Alice', expectedRank: 1, expectedPoints: 1 },
          { participantName: 'Bob', expectedRank: 2, expectedPoints: 2 }
        ]);
      }).toThrow('Leaderboard size mismatch');
    });

    it('should throw on participant name mismatch', () => {
      const season = db.prepare('INSERT INTO season (name, start_at, end_at) VALUES (?, ?, ?)').run('Test Season', 1000000, 2000000);
      const segment = db.prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)').run(1007, 'Test Segment');
      const week = db.prepare('INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?)').run(season.lastInsertRowid, 'Week 1', segment.lastInsertRowid, 1, 1000000, 1100000);
      
      // Insert participant
      db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(12353, 'Alice');
      
      // Insert activity
      const a1 = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, 12353, 111, 1050000);
      
      // Insert segment effort
      db.prepare('INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at, pr_achieved) VALUES (?, ?, ?, ?, ?, ?)')
        .run(a1.lastInsertRowid, segment.lastInsertRowid, 1, 1100, 1050000, 0);
      
      // Insert result
      db.prepare('INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (?, ?, ?, ?)')
        .run(week.lastInsertRowid, 12353, a1.lastInsertRowid, 1100);

      expect(() => {
        verifyLeaderboardScoring(db, week.lastInsertRowid as number, [
          { participantName: 'Bob', expectedRank: 1, expectedPoints: 1 }
        ]);
      }).toThrow('Participant mismatch');
    });

    it('should throw on points mismatch', () => {
      const season = db.prepare('INSERT INTO season (name, start_at, end_at) VALUES (?, ?, ?)').run('Test Season', 1000000, 2000000);
      const segment = db.prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)').run(1008, 'Test Segment');
      const week = db.prepare('INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?)').run(season.lastInsertRowid, 'Week 1', segment.lastInsertRowid, 1, 1000000, 1100000);
      
      // Insert participant
      db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(12354, 'Alice');
      
      // Insert activity
      const a1 = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, 12354, 111, 1050000);
      
      // Insert segment effort
      db.prepare('INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at, pr_achieved) VALUES (?, ?, ?, ?, ?, ?)')
        .run(a1.lastInsertRowid, segment.lastInsertRowid, 1, 1100, 1050000, 0);
      
      // Insert result
      db.prepare('INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (?, ?, ?, ?)')
        .run(week.lastInsertRowid, 12354, a1.lastInsertRowid, 1100);

      expect(() => {
        verifyLeaderboardScoring(db, week.lastInsertRowid as number, [
          { participantName: 'Alice', expectedRank: 1, expectedPoints: 5 }
        ]);
      }).toThrow('Points mismatch');
    });

    it('should verify PR flag when specified', () => {
      const season = db.prepare('INSERT INTO season (name, start_at, end_at) VALUES (?, ?, ?)').run('Test Season', 1000000, 2000000);
      const segment = db.prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)').run(1009, 'Test Segment');
      const week = db.prepare('INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?)').run(season.lastInsertRowid, 'Week 1', segment.lastInsertRowid, 1, 1000000, 1100000);
      
      // Insert participant
      db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(12355, 'Alice');
      
      // Insert activity
      const a1 = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, 12355, 111, 1050000);
      
      // Insert segment effort with PR
      db.prepare('INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at, pr_achieved) VALUES (?, ?, ?, ?, ?, ?)')
        .run(a1.lastInsertRowid, segment.lastInsertRowid, 1, 600, 1050000, 1);
      
      // Insert result
      db.prepare('INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (?, ?, ?, ?)')
        .run(week.lastInsertRowid, 12355, a1.lastInsertRowid, 600);

      expect(() => {
        verifyLeaderboardScoring(db, week.lastInsertRowid as number, [
          { participantName: 'Alice', expectedRank: 1, expectedPoints: 2, expectedHasPR: true }
        ]);
      }).not.toThrow();
    });
  });

  describe('getDisplayLeaderboard', () => {
    it('should format leaderboard for display', () => {
      const season = db.prepare('INSERT INTO season (name, start_at, end_at) VALUES (?, ?, ?)').run('Test Season', 1000000, 2000000);
      const segment = db.prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)').run(1010, 'Test Segment');
      const week = db.prepare('INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?)').run(season.lastInsertRowid, 'Week 1', segment.lastInsertRowid, 1, 1000000, 1100000);
      
      // Insert participant
      db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(12356, 'Alice');
      
      // Insert activity
      const activity = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, 12356, 123, 1050000);
      
      // Insert segment effort
      db.prepare('INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at, pr_achieved) VALUES (?, ?, ?, ?, ?, ?)')
        .run(activity.lastInsertRowid, segment.lastInsertRowid, 1, 1200, 1050000, 0);
      
      // Insert result
      db.prepare('INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (?, ?, ?, ?)')
        .run(week.lastInsertRowid, 12356, activity.lastInsertRowid, 1200);

      const leaderboard = getDisplayLeaderboard(db, week.lastInsertRowid as number);

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0]).toEqual({
        rank: 1,
        name: 'Alice',
        time: '20:00',
        points: 1
      });
    });

    it('should format time correctly with seconds', () => {
      const season = db.prepare('INSERT INTO season (name, start_at, end_at) VALUES (?, ?, ?)').run('Test Season', 1000000, 2000000);
      const segment = db.prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)').run(1011, 'Test Segment');
      const week = db.prepare('INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?)').run(season.lastInsertRowid, 'Week 1', segment.lastInsertRowid, 1, 1000000, 1100000);
      
      // Insert participant
      db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(12357, 'Alice');
      
      // Insert activity with odd seconds
      const activity = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (?, ?, ?, ?)').run(week.lastInsertRowid, 12357, 123, 1050000);
      
      // Insert segment effort
      db.prepare('INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at, pr_achieved) VALUES (?, ?, ?, ?, ?, ?)')
        .run(activity.lastInsertRowid, segment.lastInsertRowid, 1, 695, 1050000, 0); // 11:35
      
      // Insert result
      db.prepare('INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (?, ?, ?, ?)')
        .run(week.lastInsertRowid, 12357, activity.lastInsertRowid, 695);

      const leaderboard = getDisplayLeaderboard(db, week.lastInsertRowid as number);

      expect(leaderboard[0].time).toBe('11:35');
    });
  });

  describe('getSeasonLeaderboard', () => {
    it('should return empty leaderboard for season with no results', () => {
      const season = db.prepare('INSERT INTO season (name, start_at, end_at) VALUES (?, ?, ?)').run('Test Season', 1000000, 2000000);

      const leaderboard = getSeasonLeaderboard(db, season.lastInsertRowid as number);

      expect(leaderboard).toHaveLength(0);
    });

    it('should sum points across multiple weeks', () => {
      const season = db.prepare('INSERT INTO season (name, start_at, end_at) VALUES (?, ?, ?)').run('Test Season', 1000000, 2000000);
      const segment = db.prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)').run(1012, 'Test Segment');
      const week1 = db.prepare('INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?)').run(season.lastInsertRowid, 'Week 1', segment.lastInsertRowid, 1, 1000000, 1100000);
      const week2 = db.prepare('INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?)').run(season.lastInsertRowid, 'Week 2', segment.lastInsertRowid, 1, 1100000, 1200000);
      
      // Insert participant
      db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(12345, 'Alice');
      
      // Insert activities
      const a1 = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (?, ?, ?, ?)').run(week1.lastInsertRowid, 12345, 111, 1050000);
      const a2 = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (?, ?, ?, ?)').run(week2.lastInsertRowid, 12345, 222, 1150000);
      
      // Insert segment efforts for week 1 (no PR)
      db.prepare('INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at, pr_achieved) VALUES (?, ?, ?, ?, ?, ?)')
        .run(a1.lastInsertRowid, segment.lastInsertRowid, 1, 1100, 1050000, 0);
      
      // Insert result for week 1 (1 participant = 1 base point, no PR bonus = 1 total)
      db.prepare('INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (?, ?, ?, ?)')
        .run(week1.lastInsertRowid, 12345, a1.lastInsertRowid, 1100);
      
      // Insert segment efforts for week 2 (with PR)
      db.prepare('INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at, pr_achieved) VALUES (?, ?, ?, ?, ?, ?)')
        .run(a2.lastInsertRowid, segment.lastInsertRowid, 1, 1200, 1150000, 1);
      
      // Insert result for week 2 (1 participant = 1 base point, PR bonus = +1 = 2 total)
      db.prepare('INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (?, ?, ?, ?)')
        .run(week2.lastInsertRowid, 12345, a2.lastInsertRowid, 1200);

      const leaderboard = getSeasonLeaderboard(db, season.lastInsertRowid as number);

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0]).toEqual({
        rank: 1,
        name: 'Alice',
        totalPoints: 3, // 1 (week 1) + 2 (week 2 with PR bonus)
        weeksCompleted: 2
      });
    });

    it('should rank multiple participants by total points', () => {
      const season = db.prepare('INSERT INTO season (name, start_at, end_at) VALUES (?, ?, ?)').run('Test Season', 1000000, 2000000);
      const segment = db.prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)').run(1013, 'Test Segment');
      const week1 = db.prepare('INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?)').run(season.lastInsertRowid, 'Week 1', segment.lastInsertRowid, 1, 1000000, 1100000);
      
      // Insert participants
      db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(12346, 'Alice');
      db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(12347, 'Bob');
      
      // Insert activities
      const a1 = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (?, ?, ?, ?)').run(week1.lastInsertRowid, 12346, 111, 1050000);
      const a2 = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (?, ?, ?, ?)').run(week1.lastInsertRowid, 12347, 222, 1060000);
      
      // Insert segment efforts for Alice (faster time)
      db.prepare('INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at, pr_achieved) VALUES (?, ?, ?, ?, ?, ?)')
        .run(a1.lastInsertRowid, segment.lastInsertRowid, 1, 1100, 1050000, 0);
      
      // Insert segment efforts for Bob (slower time)
      db.prepare('INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at, pr_achieved) VALUES (?, ?, ?, ?, ?, ?)')
        .run(a2.lastInsertRowid, segment.lastInsertRowid, 1, 1200, 1060000, 0);
      
      // Insert results
      db.prepare('INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (?, ?, ?, ?)')
        .run(week1.lastInsertRowid, 12346, a1.lastInsertRowid, 1100);
      db.prepare('INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (?, ?, ?, ?)')
        .run(week1.lastInsertRowid, 12347, a2.lastInsertRowid, 1200);

      const leaderboard = getSeasonLeaderboard(db, season.lastInsertRowid as number);

      expect(leaderboard).toHaveLength(2);
      expect(leaderboard[0].name).toBe('Alice');
      expect(leaderboard[0].totalPoints).toBe(2); // 2 participants - rank 1 + 1 competing = 2
      expect(leaderboard[1].name).toBe('Bob');
      expect(leaderboard[1].totalPoints).toBe(1); // 2 participants - rank 2 + 1 competing = 1
    });

    it('should handle participants with no results', () => {
      const season = db.prepare('INSERT INTO season (name, start_at, end_at) VALUES (?, ?, ?)').run('Test Season', 1000000, 2000000);
      const segment = db.prepare('INSERT INTO segment (strava_segment_id, name) VALUES (?, ?)').run(1014, 'Test Segment');
      const week1 = db.prepare('INSERT INTO week (season_id, week_name, strava_segment_id, required_laps, start_at, end_at) VALUES (?, ?, ?, ?, ?, ?)').run(season.lastInsertRowid, 'Week 1', segment.lastInsertRowid, 1, 1000000, 1100000);
      
      // Insert participants
      db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(12348, 'Alice');
      db.prepare('INSERT INTO participant (strava_athlete_id, name) VALUES (?, ?)').run(12349, 'Bob'); // No results for Bob
      
      // Insert activity and result for Alice only
      const a1 = db.prepare('INSERT INTO activity (week_id, strava_athlete_id, strava_activity_id, start_at) VALUES (?, ?, ?, ?)').run(week1.lastInsertRowid, 12348, 111, 1050000);
      
      db.prepare('INSERT INTO segment_effort (activity_id, strava_segment_id, effort_index, elapsed_seconds, start_at, pr_achieved) VALUES (?, ?, ?, ?, ?, ?)')
        .run(a1.lastInsertRowid, segment.lastInsertRowid, 1, 1100, 1050000, 0);
      
      db.prepare('INSERT INTO result (week_id, strava_athlete_id, activity_id, total_time_seconds) VALUES (?, ?, ?, ?)')
        .run(week1.lastInsertRowid, 12348, a1.lastInsertRowid, 1100);

      const leaderboard = getSeasonLeaderboard(db, season.lastInsertRowid as number);

      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].name).toBe('Alice');
    });
  });
});
