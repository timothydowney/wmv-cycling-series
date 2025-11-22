/**
 * LeaderboardQueryService
 *
 * Provides query methods for leaderboard data without side effects.
 * Used in tests to verify database state and scoring correctness.
 *
 * Also useful as a foundation for future API endpoints:
 * - GET /api/test/week/:id/leaderboard
 * - GET /api/test/season/:id/leaderboard
 * - GET /api/test/scoring-details/:weekId/:participantId
 */

import { Database } from 'better-sqlite3';
import { CountRow } from '../types/database';

export interface ActivitySummary {
  activityId: number;
  stravaActivityId: number;
  weekId: number;
  participantId: number;
  participantName: string;
  totalTimeSeconds: number;
  segmentEffortCount: number;
  prCount: number;
}

export interface ResultSummary {
  resultId: number;
  weekId: number;
  participantId: number;
  participantName: string;
  totalTimeSeconds: number;
  rank: number;
  basePoints: number;
  prBonusPoints: number;
  totalPoints: number;
}

export interface WeekLeaderboard {
  weekId: number;
  weekName: string;
  results: ResultSummary[];
}

export interface ParticipantActivityHistory {
  participantId: number;
  participantName: string;
  activities: Array<{
    weekId: number;
    weekName: string;
    activityId: number;
    stravaActivityId: number;
    totalTimeSeconds: number;
    segmentEfforts: number;
    prCount: number;
    points: number;
  }>;
  totalPoints: number;
  weeksCompleted: number;
}

/**
 * Service for querying leaderboard and activity data
 */
export class LeaderboardQueryService {
  constructor(private db: Database) {}

  /**
   * Get complete leaderboard for a week with scoring details
   */
  getWeekLeaderboard(weekId: number): WeekLeaderboard {
    const week = this.db
      .prepare('SELECT id, week_name FROM week WHERE id = ?')
      .get(weekId) as { id: number; week_name: string } | undefined;

    if (!week) {
      throw new Error(`Week ${weekId} not found`);
    }

    const results = this.db
      .prepare(
        `
      SELECT 
        r.id,
        r.week_id,
        r.participant_id,
        p.name as participant_name,
        r.total_time_seconds,
        r.rank,
        r.base_points,
        r.pr_bonus_points,
        r.total_points
      FROM result r
      JOIN participant p ON r.participant_id = p.id
      WHERE r.week_id = ?
      ORDER BY r.rank ASC
      `
      )
      .all(weekId) as Array<{
      id: number;
      week_id: number;
      participant_id: number;
      participant_name: string;
      total_time_seconds: number;
      rank: number;
      base_points: number;
      pr_bonus_points: number;
      total_points: number;
    }>;

    return {
      weekId,
      weekName: week.week_name,
      results: results.map((r) => ({
        resultId: r.id,
        weekId: r.week_id,
        participantId: r.participant_id,
        participantName: r.participant_name,
        totalTimeSeconds: r.total_time_seconds,
        rank: r.rank,
        basePoints: r.base_points,
        prBonusPoints: r.pr_bonus_points,
        totalPoints: r.total_points
      }))
    };
  }

  /**
   * Get all activities for a week
   */
  getWeekActivities(weekId: number): ActivitySummary[] {
    return this.db
      .prepare(
        `
      SELECT 
        a.id as activityId,
        a.strava_activity_id,
        a.week_id,
        a.participant_id,
        p.name as participant_name,
        (SELECT SUM(se.elapsed_seconds) FROM segment_effort se WHERE se.activity_id = a.id) as totalTimeSeconds,
        (SELECT COUNT(*) FROM segment_effort se WHERE se.activity_id = a.id) as segmentEffortCount,
        (SELECT COUNT(*) FROM segment_effort se WHERE se.activity_id = a.id AND se.pr_achieved = 1) as prCount
      FROM activity a
      JOIN participant p ON a.participant_id = p.id
      WHERE a.week_id = ?
      ORDER BY totalTimeSeconds ASC
      `
      )
      .all(weekId) as ActivitySummary[];
  }

  /**
   * Get activity details for verification
   */
  getActivityDetails(activityId: number): {
    activity: any;
    segmentEfforts: any[];
    result: any;
  } | null {
    const activity = this.db
      .prepare('SELECT * FROM activity WHERE id = ?')
      .get(activityId);

    if (!activity) {
      return null;
    }

    const segmentEfforts = this.db
      .prepare('SELECT * FROM segment_effort WHERE activity_id = ? ORDER BY effort_index ASC')
      .all(activityId);

    const result = this.db
      .prepare('SELECT * FROM result WHERE activity_id = ?')
      .get(activityId);

    return { activity, segmentEfforts, result };
  }

  /**
   * Get participant's activity history
   */
  getParticipantActivityHistory(
    participantId: number
  ): ParticipantActivityHistory {
    const participant = this.db
      .prepare('SELECT id, name FROM participant WHERE id = ?')
      .get(participantId) as { id: number; name: string } | undefined;

    if (!participant) {
      throw new Error(`Participant ${participantId} not found`);
    }

    const activities = this.db
      .prepare(
        `
      SELECT 
        w.id as weekId,
        w.week_name as weekName,
        a.id as activityId,
        a.strava_activity_id,
        (SELECT SUM(se.elapsed_seconds) FROM segment_effort se WHERE se.activity_id = a.id) as totalTimeSeconds,
        (SELECT COUNT(*) FROM segment_effort se WHERE se.activity_id = a.id) as segmentEfforts,
        (SELECT COUNT(*) FROM segment_effort se WHERE se.activity_id = a.id AND se.pr_achieved = 1) as prCount,
        r.total_points as points
      FROM activity a
      JOIN week w ON a.week_id = w.id
      LEFT JOIN result r ON a.id = r.activity_id
      WHERE a.participant_id = ?
      ORDER BY w.id DESC
      `
      )
      .all(participantId) as Array<{
      weekId: number;
      weekName: string;
      activityId: number;
      strava_activity_id: number;
      totalTimeSeconds: number;
      segmentEfforts: number;
      prCount: number;
      points: number;
    }>;

    const totalPoints = activities.reduce((sum, a) => sum + (a.points || 0), 0);
    const weeksCompleted = activities.length;

    return {
      participantId,
      participantName: participant.name,
      activities: activities.map((a) => ({
        weekId: a.weekId,
        weekName: a.weekName,
        activityId: a.activityId,
        stravaActivityId: a.strava_activity_id,
        totalTimeSeconds: a.totalTimeSeconds || 0,
        segmentEfforts: a.segmentEfforts || 0,
        prCount: a.prCount || 0,
        points: a.points || 0
      })),
      totalPoints,
      weeksCompleted
    };
  }

  /**
   * Get comparison between two activities
   */
  compareActivities(
    activityId1: number,
    activityId2: number
  ): {
    activity1: any;
    activity2: any;
    faster: 'activity1' | 'activity2' | 'equal';
    timeDifference: number;
  } {
    const details1 = this.getActivityDetails(activityId1);
    const details2 = this.getActivityDetails(activityId2);

    if (!details1 || !details2) {
      throw new Error('One or both activities not found');
    }

    const time1 = details1.activity.total_time_seconds;
    const time2 = details2.activity.total_time_seconds;
    const diff = Math.abs(time1 - time2);

    return {
      activity1: details1.activity,
      activity2: details2.activity,
      faster: time1 < time2 ? 'activity1' : time1 > time2 ? 'activity2' : 'equal',
      timeDifference: diff
    };
  }

  /**
   * Verify idempotency: same webhook received twice produces same result
   */
  verifyIdempotency(
    weekId: number,
    participantId: number
  ): {
    resultId: number;
    totalTimeSeconds: number;
    totalPoints: number;
    prBonusPoints: number;
  } | null {
    const result = this.db
      .prepare(
        'SELECT id, total_time_seconds, total_points, pr_bonus_points FROM result WHERE week_id = ? AND participant_id = ?'
      )
      .get(weekId, participantId) as {
      id: number;
      total_time_seconds: number;
      total_points: number;
      pr_bonus_points: number;
    } | undefined;

    if (!result) {
      return null;
    }

    return {
      resultId: result.id,
      totalTimeSeconds: result.total_time_seconds,
      totalPoints: result.total_points,
      prBonusPoints: result.pr_bonus_points
    };
  }

  /**
   * Get database statistics for debugging
   */
  getStatistics(): {
    participantCount: number;
    weekCount: number;
    activityCount: number;
    resultCount: number;
    segmentEffortCount: number;
    webhookEventCount: number;
    } {
    return {
      participantCount: (
        this.db.prepare('SELECT COUNT(*) as count FROM participant').get() as CountRow
      ).count,
      weekCount: (
        this.db.prepare('SELECT COUNT(*) as count FROM week').get() as CountRow
      ).count,
      activityCount: (
        this.db.prepare('SELECT COUNT(*) as count FROM activity').get() as CountRow
      ).count,
      resultCount: (
        this.db.prepare('SELECT COUNT(*) as count FROM result').get() as CountRow
      ).count,
      segmentEffortCount: (
        this.db.prepare('SELECT COUNT(*) as count FROM segment_effort').get() as CountRow
      ).count,
      webhookEventCount: (
        this.db.prepare('SELECT COUNT(*) as count FROM webhook_event').get() as CountRow
      ).count
    };
  }
}
