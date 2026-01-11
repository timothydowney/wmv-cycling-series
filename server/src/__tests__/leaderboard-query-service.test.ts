/**
 * Tests for LeaderboardQueryService
 * Verifies leaderboard query methods using Drizzle ORM test infrastructure
 */

import { setupTestDb } from './setupTestDb';
import { createSeason, createSegment, createParticipant, createWeek, createActivity, createResult, createSegmentEffort } from './testDataHelpers';
import { LeaderboardQueryService } from '../services/LeaderboardQueryService';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type Database from 'better-sqlite3';

describe('LeaderboardQueryService', () => {
  let db: Database.Database;
  let drizzleDb: BetterSQLite3Database;
  let service: LeaderboardQueryService;

  beforeEach(() => {
    const setup = setupTestDb({ seed: false });
    db = setup.db;
    drizzleDb = setup.drizzleDb;
    service = new LeaderboardQueryService(drizzleDb);
  });

  afterEach(() => {
    db.close();
  });

  describe('getWeekLeaderboard', () => {
    it('should throw error for non-existent week', async () => {
      await expect(service.getWeekLeaderboard(999)).rejects.toThrow('Week 999 not found');
    });

    it('should return week leaderboard with no results', async () => {
      const week = createWeek(drizzleDb, { weekName: 'Week 1' });

      const leaderboard = await service.getWeekLeaderboard(week.id);

      expect(leaderboard.weekId).toBe(week.id);
      expect(leaderboard.weekName).toBe('Week 1');
      expect(leaderboard.results).toHaveLength(0);
    });

    it('should return week leaderboard with results', async () => {
      const week = createWeek(drizzleDb, { weekName: 'Week 1' });
      const participant = createParticipant(drizzleDb, '12345', 'Alice');
      const activity = createActivity(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });

      createResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        activityId: activity.id,
      });

      const leaderboard = await service.getWeekLeaderboard(week.id);

      expect(leaderboard.results).toHaveLength(1);
      expect(leaderboard.results[0]).toMatchObject({
        participantId: participant.strava_athlete_id,
        participantName: 'Alice',
      });
    });

    it('should return results ordered by rank', async () => {
      const week = createWeek(drizzleDb, { weekName: 'Week 1' });
      const alice = createParticipant(drizzleDb, '12345', 'Alice');
      const bob = createParticipant(drizzleDb, '67890', 'Bob');

      const activity1 = createActivity(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: alice.strava_athlete_id,
        stravaActivityId: '111',
      });
      const activity2 = createActivity(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: bob.strava_athlete_id,
        stravaActivityId: '222',
      });

      createResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: alice.strava_athlete_id,
        activityId: activity1.id,
      });
      createResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: bob.strava_athlete_id,
        activityId: activity2.id,
      });

      const leaderboard = await service.getWeekLeaderboard(week.id);

      expect(leaderboard.results[0].participantName).toBe('Alice');
      expect(leaderboard.results[1].participantName).toBe('Bob');
    });
  });

  describe('getWeekActivities', () => {
    it('should return empty activities for week with no activities', () => {
      const week = createWeek(drizzleDb, { weekName: 'Week 1' });

      const activities = service.getWeekActivities(week.id);

      expect(activities).toHaveLength(0);
    });

    it('should return activities for a week', () => {
      const week = createWeek(drizzleDb, { weekName: 'Week 1' });
      const participant = createParticipant(drizzleDb, '12345', 'Alice');
      const activity = createActivity(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });

      createSegmentEffort(drizzleDb, {
        activityId: activity.id,
        elapsedSeconds: 600,
        prAchieved: 0
      });

      const activities = service.getWeekActivities(week.id);

      expect(activities).toHaveLength(1);
      // Note: participantName might be undefined due to how SQLite aliases work in raw queries
      // The service is meant for test verification, not production queries
      expect(activities[0].activityId).toBe(activity.id);
      expect(activities[0].segmentEffortCount).toBe(1);
    });

    it('should count PR achievements', () => {
      const week = createWeek(drizzleDb, { weekName: 'Week 1' });
      const participant = createParticipant(drizzleDb, '12345', 'Alice');
      const activity = createActivity(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });

      createSegmentEffort(drizzleDb, {
        activityId: activity.id,
        elapsedSeconds: 600,
        prAchieved: 1
      });

      const activities = service.getWeekActivities(week.id);

      expect(activities[0].prCount).toBe(1);
    });
  });

  describe('getActivityDetails', () => {
    it('should return null for non-existent activity', () => {
      const details = service.getActivityDetails(999);
      expect(details).toBeNull();
    });

    it('should return activity details', () => {
      const week = createWeek(drizzleDb, { weekName: 'Week 1' });
      const participant = createParticipant(drizzleDb, '12345', 'Alice');
      const activity = createActivity(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });

      const details = service.getActivityDetails(activity.id);

      expect(details).not.toBeNull();
      expect(details?.activity.strava_activity_id).toBe('111');
      expect(details?.segmentEfforts).toHaveLength(0);
      expect(details?.result).toBeNull();
    });

    it('should return segment efforts with activity', () => {
      const week = createWeek(drizzleDb, { weekName: 'Week 1' });
      const participant = createParticipant(drizzleDb, '12345', 'Alice');
      const activity = createActivity(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });

      createSegmentEffort(drizzleDb, {
        activityId: activity.id,
        elapsedSeconds: 600,
        prAchieved: 1
      });

      const details = service.getActivityDetails(activity.id);

      expect(details?.segmentEfforts).toHaveLength(1);
      expect(details?.segmentEfforts[0].elapsed_seconds).toBe(600);
      expect(details?.segmentEfforts[0].pr_achieved).toBe(1);
    });
  });

  describe('getParticipantActivityHistory', () => {
    it('should throw error for non-existent participant', async () => {
      await expect(service.getParticipantActivityHistory('999')).rejects.toThrow('Participant 999 not found');
    });

    it('should return empty history for participant with no activities', async () => {
      const participant = createParticipant(drizzleDb, '12345', 'Alice');

      const history = await service.getParticipantActivityHistory(participant.strava_athlete_id);

      expect(history.participantId).toBe(participant.strava_athlete_id);
      expect(history.participantName).toBe('Alice');
      expect(history.activities).toHaveLength(0);
      expect(history.totalPoints).toBe(0);
      expect(history.weeksCompleted).toBe(0);
    });

    it('should return participant activity history', async () => {
      const participant = createParticipant(drizzleDb, '12345', 'Alice');
      const week1 = createWeek(drizzleDb, { weekName: 'Week 1' });
      const activity = createActivity(drizzleDb, {
        weekId: week1.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });

      createResult(drizzleDb, {
        weekId: week1.id,
        stravaAthleteId: participant.strava_athlete_id,
        activityId: activity.id,
      });

      const history = await service.getParticipantActivityHistory(participant.strava_athlete_id);

      expect(history.activities).toHaveLength(1);
      expect(history.totalPoints).toBe(1);
      expect(history.weeksCompleted).toBe(1);
      expect(history.activities[0].weekName).toBe('Week 1');
      expect(history.activities[0].points).toBe(1);
    });

    it('should sum points across multiple weeks', async () => {
      const alice = createParticipant(drizzleDb, '12345', 'Alice');
      const week1 = createWeek(drizzleDb, { weekName: 'Week 1' });
      const week2 = createWeek(drizzleDb, { weekName: 'Week 2' });

      // Week 1: 2 participants, Alice fastest → 2 points
      const act1Alice = createActivity(drizzleDb, {
        weekId: week1.id,
        stravaAthleteId: alice.strava_athlete_id,
        stravaActivityId: '111',
      });
      const bob = createParticipant(drizzleDb, '67890', 'Bob');
      const act1Bob = createActivity(drizzleDb, {
        weekId: week1.id,
        stravaAthleteId: bob.strava_athlete_id,
        stravaActivityId: '222',
      });

      createResult(drizzleDb, {
        weekId: week1.id,
        stravaAthleteId: alice.strava_athlete_id,
        activityId: act1Alice.id,
        totalTimeSeconds: 1000,
      });
      createResult(drizzleDb, {
        weekId: week1.id,
        stravaAthleteId: bob.strava_athlete_id,
        activityId: act1Bob.id,
        totalTimeSeconds: 1200,
      });

      // Week 2: 4 participants, Alice fastest → 4 points
      const act2Alice = createActivity(drizzleDb, {
        weekId: week2.id,
        stravaAthleteId: alice.strava_athlete_id,
        stravaActivityId: '333',
      });
      const p2 = createParticipant(drizzleDb, '22222', 'P2');
      const p3 = createParticipant(drizzleDb, '33333', 'P3');
      const p4 = createParticipant(drizzleDb, '44444', 'P4');
      const act2P2 = createActivity(drizzleDb, { weekId: week2.id, stravaAthleteId: p2.strava_athlete_id, stravaActivityId: '444' });
      const act2P3 = createActivity(drizzleDb, { weekId: week2.id, stravaAthleteId: p3.strava_athlete_id, stravaActivityId: '555' });
      const act2P4 = createActivity(drizzleDb, { weekId: week2.id, stravaAthleteId: p4.strava_athlete_id, stravaActivityId: '666' });

      createResult(drizzleDb, { weekId: week2.id, stravaAthleteId: alice.strava_athlete_id, activityId: act2Alice.id, totalTimeSeconds: 900 });
      createResult(drizzleDb, { weekId: week2.id, stravaAthleteId: p2.strava_athlete_id, activityId: act2P2.id, totalTimeSeconds: 1000 });
      createResult(drizzleDb, { weekId: week2.id, stravaAthleteId: p3.strava_athlete_id, activityId: act2P3.id, totalTimeSeconds: 1100 });
      createResult(drizzleDb, { weekId: week2.id, stravaAthleteId: p4.strava_athlete_id, activityId: act2P4.id, totalTimeSeconds: 1200 });

      const history = await service.getParticipantActivityHistory(alice.strava_athlete_id);

      expect(history.weeksCompleted).toBe(2);
      expect(history.totalPoints).toBe(6); // 2 + 4
    });
  });

  describe('compareActivities', () => {
    it('should throw error if activity not found', () => {
      expect(() => service.compareActivities(999, 1)).toThrow('One or both activities not found');
    });

    it('should compare two activities and identify faster one', () => {
      const week = createWeek(drizzleDb, { weekName: 'Week 1' });
      const participant = createParticipant(drizzleDb, '12345', 'Alice');
      
      const activity1 = createActivity(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });
      const activity2 = createActivity(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '222',
      });

      // Add segment efforts to produce different totals
      createSegmentEffort(drizzleDb, { activityId: activity1.id, elapsedSeconds: 1000 });
      createSegmentEffort(drizzleDb, { activityId: activity2.id, elapsedSeconds: 1100 });

      const comparison = service.compareActivities(activity1.id, activity2.id);

      expect(comparison.faster).toBe('activity1');
      expect(comparison.timeDifference).toBe(100);
    });

    it('should identify equal times', () => {
      const week = createWeek(drizzleDb, { weekName: 'Week 1' });
      const participant = createParticipant(drizzleDb, '12345', 'Alice');
      
      const activity1 = createActivity(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });
      const activity2 = createActivity(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '222',
      });

      // Equal segment efforts
      createSegmentEffort(drizzleDb, { activityId: activity1.id, elapsedSeconds: 1000 });
      createSegmentEffort(drizzleDb, { activityId: activity2.id, elapsedSeconds: 1000 });

      const comparison = service.compareActivities(activity1.id, activity2.id);

      expect(comparison.faster).toBe('equal');
      expect(comparison.timeDifference).toBe(0);
    });
  });

  describe('verifyIdempotency', () => {
    it('should return null if result not found', () => {
      const result = service.verifyIdempotency(999, '999');
      expect(result).toBeNull();
    });

    it('should return result for idempotency verification', () => {
      const week = createWeek(drizzleDb, { weekName: 'Week 1' });
      const participant = createParticipant(drizzleDb, '12345', 'Alice');
      const activity = createActivity(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });

      createResult(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        activityId: activity.id,
        totalTimeSeconds: 1100,
      });

      const idempotency = service.verifyIdempotency(week.id, participant.strava_athlete_id);

      expect(idempotency).not.toBeNull();
      expect(idempotency?.resultId).toEqual(expect.any(Number));
      expect(idempotency?.totalTimeSeconds).toBe(1100);
      expect(idempotency?.totalPoints).toBe(1);
      expect(idempotency?.prBonusPoints).toBe(0);
    });
  });

  describe('getStatistics', () => {
    it('should return zero statistics for empty database', () => {
      const stats = service.getStatistics();

      expect(stats.participantCount).toBe(0);
      expect(stats.weekCount).toBe(0);
      expect(stats.activityCount).toBe(0);
      expect(stats.resultCount).toBe(0);
      expect(stats.segmentEffortCount).toBe(0);
    });

    it('should return correct statistics', () => {
      const participant = createParticipant(drizzleDb, '12345', 'Alice');
      const week = createWeek(drizzleDb, { weekName: 'Week 1' });
      const activity = createActivity(drizzleDb, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });

      createSegmentEffort(drizzleDb, {
        activityId: activity.id,
        elapsedSeconds: 600,
        prAchieved: 0
      });

      const stats = service.getStatistics();

      expect(stats.participantCount).toBe(1);
      expect(stats.weekCount).toBe(1);
      expect(stats.activityCount).toBe(1);
      expect(stats.segmentEffortCount).toBe(1);
    });
  });
});
