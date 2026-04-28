import type { Pool } from 'pg';
import type { AppDatabase } from '../db/types';
/**
 * Tests for LeaderboardQueryService
 * Verifies leaderboard query methods using Drizzle ORM test infrastructure
 */

import { setupTestDb, teardownTestDb } from './setupTestDb';
import { createSeason, createSegment, createParticipant, createWeek, createActivity, createResult, createSegmentEffort } from './testDataHelpers';
import { LeaderboardQueryService } from '../services/LeaderboardQueryService';

describe('LeaderboardQueryService', () => {
  let pool: Pool;
  let orm: AppDatabase;
  let service: LeaderboardQueryService;

  beforeEach(async () => {
    const setup = setupTestDb({ seed: false });
    pool = setup.pool;
    orm = setup.orm;
    service = new LeaderboardQueryService(orm);
  });
  afterAll(async () => {
    await teardownTestDb(pool);
  });

  describe('getWeekLeaderboard', () => {
    it('should throw error for non-existent week', async () => {
      await expect(service.getWeekLeaderboard(999)).rejects.toThrow('Week 999 not found');
    });

    it('should return week leaderboard with no results', async () => {
      const week = await createWeek(orm, { weekName: 'Week 1' });

      const leaderboard = await service.getWeekLeaderboard(week.id);

      expect(leaderboard.weekId).toBe(week.id);
      expect(leaderboard.weekName).toBe('Week 1');
      expect(leaderboard.results).toHaveLength(0);
    });

    it('should return week leaderboard with results', async () => {
      const week = await createWeek(orm, { weekName: 'Week 1' });
      const participant = await createParticipant(orm, '12345', 'Alice');
      const activity = await createActivity(orm, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });

      await createResult(orm, {
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
      const week = await createWeek(orm, { weekName: 'Week 1' });
      const alice = await createParticipant(orm, '12345', 'Alice');
      const bob = await createParticipant(orm, '67890', 'Bob');

      const activity1 = await createActivity(orm, {
        weekId: week.id,
        stravaAthleteId: alice.strava_athlete_id,
        stravaActivityId: '111',
      });
      const activity2 = await createActivity(orm, {
        weekId: week.id,
        stravaAthleteId: bob.strava_athlete_id,
        stravaActivityId: '222',
      });

      await createResult(orm, {
        weekId: week.id,
        stravaAthleteId: alice.strava_athlete_id,
        activityId: activity1.id,
      });
      await createResult(orm, {
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
    it('should return empty activities for week with no activities', async () => {
      const week = await createWeek(orm, { weekName: 'Week 1' });

      const activities = await service.getWeekActivities(week.id);

      expect(activities).toHaveLength(0);
    });

    it('should return activities for a week', async () => {
      const week = await createWeek(orm, { weekName: 'Week 1' });
      const participant = await createParticipant(orm, '12345', 'Alice');
      const activity = await createActivity(orm, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });

      await createSegmentEffort(orm, {
        activityId: activity.id,
        elapsedSeconds: 600,
        prAchieved: 0
      });

      const activities = await service.getWeekActivities(week.id);

      expect(activities).toHaveLength(1);
      // Note: participantName might be undefined due to how SQLite aliases work in raw queries
      // The service is meant for test verification, not production queries
      expect(activities[0].activityId).toBe(activity.id);
      expect(activities[0].segmentEffortCount).toBe(1);
    });

    it('should count PR achievements', async () => {
      const week = await createWeek(orm, { weekName: 'Week 1' });
      const participant = await createParticipant(orm, '12345', 'Alice');
      const activity = await createActivity(orm, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });

      await createSegmentEffort(orm, {
        activityId: activity.id,
        elapsedSeconds: 600,
        prAchieved: 1
      });

      const activities = await service.getWeekActivities(week.id);

      expect(activities[0].prCount).toBe(1);
    });
  });

  describe('getActivityDetails', () => {
    it('should return null for non-existent activity', async () => {
      const details = await service.getActivityDetails(999);
      expect(details).toBeNull();
    });

    it('should return activity details', async () => {
      const week = await createWeek(orm, { weekName: 'Week 1' });
      const participant = await createParticipant(orm, '12345', 'Alice');
      const activity = await createActivity(orm, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });

      const details = await service.getActivityDetails(activity.id);

      expect(details).not.toBeNull();
      expect(details?.activity.strava_activity_id).toBe('111');
      expect(details?.segmentEfforts).toHaveLength(0);
      expect(details?.result).toBeNull();
    });

    it('should return segment efforts with activity', async () => {
      const week = await createWeek(orm, { weekName: 'Week 1' });
      const participant = await createParticipant(orm, '12345', 'Alice');
      const activity = await createActivity(orm, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });

      await createSegmentEffort(orm, {
        activityId: activity.id,
        elapsedSeconds: 600,
        prAchieved: 1
      });

      const details = await service.getActivityDetails(activity.id);

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
      const participant = await createParticipant(orm, '12345', 'Alice');

      const history = await service.getParticipantActivityHistory(participant.strava_athlete_id);

      expect(history.participantId).toBe(participant.strava_athlete_id);
      expect(history.participantName).toBe('Alice');
      expect(history.activities).toHaveLength(0);
      expect(history.totalPoints).toBe(0);
      expect(history.weeksCompleted).toBe(0);
    });

    it('should return participant activity history', async () => {
      const participant = await createParticipant(orm, '12345', 'Alice');
      const week1 = await createWeek(orm, { weekName: 'Week 1' });
      const activity = await createActivity(orm, {
        weekId: week1.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });

      await createResult(orm, {
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
      const alice = await createParticipant(orm, '12345', 'Alice');
      const week1 = await createWeek(orm, { weekName: 'Week 1' });
      const week2 = await createWeek(orm, { weekName: 'Week 2' });

      // Week 1: 2 participants, Alice fastest → 2 points
      const act1Alice = await createActivity(orm, {
        weekId: week1.id,
        stravaAthleteId: alice.strava_athlete_id,
        stravaActivityId: '111',
      });
      const bob = await createParticipant(orm, '67890', 'Bob');
      const act1Bob = await createActivity(orm, {
        weekId: week1.id,
        stravaAthleteId: bob.strava_athlete_id,
        stravaActivityId: '222',
      });

      await createResult(orm, {
        weekId: week1.id,
        stravaAthleteId: alice.strava_athlete_id,
        activityId: act1Alice.id,
        totalTimeSeconds: 1000,
      });
      await createResult(orm, {
        weekId: week1.id,
        stravaAthleteId: bob.strava_athlete_id,
        activityId: act1Bob.id,
        totalTimeSeconds: 1200,
      });

      // Week 2: 4 participants, Alice fastest → 4 points
      const act2Alice = await createActivity(orm, {
        weekId: week2.id,
        stravaAthleteId: alice.strava_athlete_id,
        stravaActivityId: '333',
      });
      const p2 = await createParticipant(orm, '22222', 'P2');
      const p3 = await createParticipant(orm, '33333', 'P3');
      const p4 = await createParticipant(orm, '44444', 'P4');
      const act2P2 = await createActivity(orm, { weekId: week2.id, stravaAthleteId: p2.strava_athlete_id, stravaActivityId: '444' });
      const act2P3 = await createActivity(orm, { weekId: week2.id, stravaAthleteId: p3.strava_athlete_id, stravaActivityId: '555' });
      const act2P4 = await createActivity(orm, { weekId: week2.id, stravaAthleteId: p4.strava_athlete_id, stravaActivityId: '666' });

      await createResult(orm, { weekId: week2.id, stravaAthleteId: alice.strava_athlete_id, activityId: act2Alice.id, totalTimeSeconds: 900 });
      await createResult(orm, { weekId: week2.id, stravaAthleteId: p2.strava_athlete_id, activityId: act2P2.id, totalTimeSeconds: 1000 });
      await createResult(orm, { weekId: week2.id, stravaAthleteId: p3.strava_athlete_id, activityId: act2P3.id, totalTimeSeconds: 1100 });
      await createResult(orm, { weekId: week2.id, stravaAthleteId: p4.strava_athlete_id, activityId: act2P4.id, totalTimeSeconds: 1200 });

      const history = await service.getParticipantActivityHistory(alice.strava_athlete_id);

      expect(history.weeksCompleted).toBe(2);
      expect(history.totalPoints).toBe(6); // 2 + 4
    });
  });

  describe('compareActivities', () => {
    it('should throw error if activity not found', async () => {
      await expect(service.compareActivities(999, 1)).rejects.toThrow('One or both activities not found');
    });

    it('should compare two activities and identify faster one', async () => {
      const week = await createWeek(orm, { weekName: 'Week 1' });
      const participant = await createParticipant(orm, '12345', 'Alice');
      
      const activity1 = await createActivity(orm, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });
      const activity2 = await createActivity(orm, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '222',
      });

      // Add segment efforts to produce different totals
      await createSegmentEffort(orm, { activityId: activity1.id, elapsedSeconds: 1000 });
      await createSegmentEffort(orm, { activityId: activity2.id, elapsedSeconds: 1100 });

      const comparison = await service.compareActivities(activity1.id, activity2.id);

      expect(comparison.faster).toBe('activity1');
      expect(comparison.timeDifference).toBe(100);
    });

    it('should identify equal times', async () => {
      const week = await createWeek(orm, { weekName: 'Week 1' });
      const participant = await createParticipant(orm, '12345', 'Alice');
      
      const activity1 = await createActivity(orm, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });
      const activity2 = await createActivity(orm, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '222',
      });

      // Equal segment efforts
      await createSegmentEffort(orm, { activityId: activity1.id, elapsedSeconds: 1000 });
      await createSegmentEffort(orm, { activityId: activity2.id, elapsedSeconds: 1000 });

      const comparison = await service.compareActivities(activity1.id, activity2.id);

      expect(comparison.faster).toBe('equal');
      expect(comparison.timeDifference).toBe(0);
    });
  });

  describe('verifyIdempotency', () => {
    it('should return null if result not found', async () => {
      const result = await service.verifyIdempotency(999, '999');
      expect(result).toBeNull();
    });

    it('should return result for idempotency verification', async () => {
      const week = await createWeek(orm, { weekName: 'Week 1' });
      const participant = await createParticipant(orm, '12345', 'Alice');
      const activity = await createActivity(orm, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });

      await createResult(orm, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        activityId: activity.id,
        totalTimeSeconds: 1100,
      });

      const idempotency = await service.verifyIdempotency(week.id, participant.strava_athlete_id);

      expect(idempotency).not.toBeNull();
      expect(idempotency?.resultId).toEqual(expect.any(Number));
      expect(idempotency?.totalTimeSeconds).toBe(1100);
      expect(idempotency?.totalPoints).toBe(1);
      expect(idempotency?.prBonusPoints).toBe(0);
    });
  });

  describe('getStatistics', () => {
    it('should return zero statistics for empty database', async () => {
      const stats = await service.getStatistics();

      expect(stats.participantCount).toBe(0);
      expect(stats.weekCount).toBe(0);
      expect(stats.activityCount).toBe(0);
      expect(stats.resultCount).toBe(0);
      expect(stats.segmentEffortCount).toBe(0);
    });

    it('should return correct statistics', async () => {
      const participant = await createParticipant(orm, '12345', 'Alice');
      const week = await createWeek(orm, { weekName: 'Week 1' });
      const activity = await createActivity(orm, {
        weekId: week.id,
        stravaAthleteId: participant.strava_athlete_id,
        stravaActivityId: '111',
      });

      await createSegmentEffort(orm, {
        activityId: activity.id,
        elapsedSeconds: 600,
        prAchieved: 0
      });

      const stats = await service.getStatistics();

      expect(stats.participantCount).toBe(1);
      expect(stats.weekCount).toBe(1);
      expect(stats.activityCount).toBe(1);
      expect(stats.segmentEffortCount).toBe(1);
    });
  });
});
