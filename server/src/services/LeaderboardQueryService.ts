/**
 * LeaderboardQueryService
 *
 * Provides query methods for leaderboard data without side effects.
 * Used in tests to verify database state and scoring correctness.
 * Diagnostics/test helper implemented with Drizzle (BetterSQLite3 driver).
 */
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { and, desc, eq, sql } from 'drizzle-orm';
import { activity, participant, result, segmentEffort, week, webhookEvent } from '../db/schema';

export interface ActivitySummary {
  activityId: number;
  stravaActivityId: string;
  weekId: number;
  participantId: string;
  participantName: string;
  totalTimeSeconds: number;
  segmentEffortCount: number;
  prCount: number;
}

export interface ResultSummary {
  resultId: number;
  weekId: number;
  participantId: string;
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
  participantId: string;
  participantName: string;
  activities: Array<{
    weekId: number;
    weekName: string;
    activityId: number;
    stravaActivityId: string;
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
  constructor(private db: BetterSQLite3Database) {}

  private getPrCount(activityId: number): number {
    const row = this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(segmentEffort)
      .where(and(eq(segmentEffort.activity_id, activityId), eq(segmentEffort.pr_achieved, 1)))
      .get();
    return row?.count ?? 0;
  }

  private getSegmentEffortSum(activityId: number): number | null {
    const row = this.db
      .select({ total: sql<number | null>`SUM(${segmentEffort.elapsed_seconds})` })
      .from(segmentEffort)
      .where(eq(segmentEffort.activity_id, activityId))
      .get();
    return row?.total ?? null;
  }

  private getResultTotalTimeByActivity(activityId: number): number | null {
    const row = this.db
      .select({ total: result.total_time_seconds })
      .from(result)
      .where(eq(result.activity_id, activityId))
      .limit(1)
      .get();
    return row?.total ?? null;
  }

  private getWeekResultTimes(weekId: number): number[] {
    return this.db
      .select({ total: result.total_time_seconds })
      .from(result)
      .where(eq(result.week_id, weekId))
      .orderBy(result.total_time_seconds)
      .all()
      .map((r) => r.total);
  }

  /**
   * Get complete leaderboard for a week with scoring details
   */
  getWeekLeaderboard(weekId: number): WeekLeaderboard {
    const weekRow = this.db
      .select({ id: week.id, week_name: week.week_name })
      .from(week)
      .where(eq(week.id, weekId))
      .get();

    if (!weekRow) {
      throw new Error(`Week ${weekId} not found`);
    }

    const baseRows = this.db
      .select({
        id: result.id,
        week_id: result.week_id,
        participant_id: result.strava_athlete_id,
        activity_id: result.activity_id,
        participant_name: participant.name,
        total_time_seconds: result.total_time_seconds,
        pr_count: sql<number>`(SELECT COUNT(*) FROM segment_effort WHERE segment_effort.activity_id = ${result.activity_id} AND segment_effort.pr_achieved = 1)`
      })
      .from(result)
      .leftJoin(participant, eq(participant.strava_athlete_id, result.strava_athlete_id))
      .where(eq(result.week_id, weekId))
      .orderBy(result.total_time_seconds, participant.name)
      .all();

    const n = baseRows.length;
    const results = baseRows.map((r, idx) => {
      const rank = idx + 1;
      const basePoints = (n - rank) + 1;
      const prBonus = (r.pr_count && r.pr_count > 0) ? 1 : 0;
      const totalPoints = basePoints + prBonus;
      return {
        id: r.id,
        week_id: r.week_id,
        participant_id: r.participant_id,
        participant_name: r.participant_name,
        total_time_seconds: r.total_time_seconds,
        rank,
        base_points: basePoints,
        pr_bonus_points: prBonus,
        total_points: totalPoints
      };
    });

    return {
      weekId,
      weekName: weekRow.week_name,
      results: results.map((r) => ({
        resultId: r.id,
        weekId: r.week_id,
        participantId: r.participant_id,
        participantName: r.participant_name ?? 'Unknown',
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
    const results = this.db
      .select({
        activityId: activity.id,
        stravaActivityId: activity.strava_activity_id,
        weekId: activity.week_id,
        participantId: activity.strava_athlete_id,
        participantName: participant.name,
        totalTimeSeconds: sql<number>`(SELECT SUM(elapsed_seconds) FROM segment_effort WHERE segment_effort.activity_id = ${activity.id})`,
        segmentEffortCount: sql<number>`(SELECT COUNT(*) FROM segment_effort WHERE segment_effort.activity_id = ${activity.id})`,
        prCount: sql<number>`(SELECT COUNT(*) FROM segment_effort WHERE segment_effort.activity_id = ${activity.id} AND segment_effort.pr_achieved = 1)`
      })
      .from(activity)
      .leftJoin(participant, eq(participant.strava_athlete_id, activity.strava_athlete_id))
      .where(eq(activity.week_id, weekId))
      .orderBy(activity.id)
      .all();

    return results.map((r) => ({
      activityId: r.activityId,
      stravaActivityId: r.stravaActivityId,
      weekId: r.weekId ?? 0,
      participantId: r.participantId,
      participantName: r.participantName ?? 'Unknown',
      totalTimeSeconds: r.totalTimeSeconds,
      segmentEffortCount: r.segmentEffortCount,
      prCount: r.prCount
    }));
  }

  /**
   * Get activity details for verification
   */
  getActivityDetails(activityId: number): {
    activity: typeof activity.$inferSelect;
    segmentEfforts: Array<typeof segmentEffort.$inferSelect>;
    result: typeof result.$inferSelect | null;
  } | null {
    const activityRow = this.db
      .select()
      .from(activity)
      .where(eq(activity.id, activityId))
      .get();

    if (!activityRow) {
      return null;
    }

    const segmentEfforts = this.db
      .select()
      .from(segmentEffort)
      .where(eq(segmentEffort.activity_id, activityId))
      .orderBy(segmentEffort.effort_index)
      .all();

    const resultRow = this.db
      .select()
      .from(result)
      .where(eq(result.activity_id, activityId))
      .limit(1)
      .get();

    return { activity: activityRow, segmentEfforts, result: resultRow ?? null };
  }

  /**
   * Get participant's activity history
   */
  getParticipantActivityHistory(
    participantId: string
  ): ParticipantActivityHistory {
    const participantRow = this.db
      .select({ id: participant.strava_athlete_id, name: participant.name })
      .from(participant)
      .where(eq(participant.strava_athlete_id, participantId))
      .get();

    if (!participantRow) {
      throw new Error(`Participant ${participantId} not found`);
    }

    const activitiesBase = this.db
      .select({
        weekId: week.id,
        weekName: week.week_name,
        activityId: activity.id,
        stravaActivityId: activity.strava_activity_id,
        totalTimeSeconds: sql<number | null>`(SELECT SUM(elapsed_seconds) FROM segment_effort WHERE segment_effort.activity_id = ${activity.id})`,
        segmentEfforts: sql<number | null>`(SELECT COUNT(*) FROM segment_effort WHERE segment_effort.activity_id = ${activity.id})`,
        prCount: sql<number | null>`(SELECT COUNT(*) FROM segment_effort WHERE segment_effort.activity_id = ${activity.id} AND segment_effort.pr_achieved = 1)`
      })
      .from(activity)
      .leftJoin(week, eq(activity.week_id, week.id))
      .where(eq(activity.strava_athlete_id, participantId))
      .orderBy(desc(week.id))
      .all();

    // Compute points per week: base points (beats + 1) + PR bonus
    const computePointsForWeek = (weekId: number | null, activityId: number, totalTimeSeconds: number | null): number => {
      if (!weekId) return 0;
      // If no segment efforts, fallback to result.total_time_seconds for this activity
      const effectiveTime = (totalTimeSeconds === null || totalTimeSeconds === 0)
        ? this.getResultTotalTimeByActivity(activityId) ?? 0
        : totalTimeSeconds;

      const rows = this.getWeekResultTimes(weekId);
      if (!rows || rows.length === 0) return 0;
      const n = rows.length;
      const rankIdx = rows.findIndex(r => r === effectiveTime);
      const rank = (rankIdx >= 0 ? rankIdx + 1 : n);
      const basePoints = (n - rank) + 1;
      const prCount = this.getPrCount(activityId);
      const prBonus = prCount > 0 ? 1 : 0;
      return basePoints + prBonus;
    };

    const activities = activitiesBase.map((a) => {
      const totalTime = (a.totalTimeSeconds === null || a.totalTimeSeconds === 0)
        ? this.getResultTotalTimeByActivity(a.activityId) ?? 0
        : a.totalTimeSeconds;
      const points = computePointsForWeek(a.weekId, a.activityId, totalTime);
      return {
        weekId: a.weekId ?? 0,
        weekName: a.weekName ?? 'Unknown',
        activityId: a.activityId,
        stravaActivityId: a.stravaActivityId,
        totalTimeSeconds: totalTime,
        segmentEfforts: a.segmentEfforts ?? 0,
        prCount: a.prCount ?? 0,
        points
      };
    });

    const totalPoints = activities.reduce((sum, a) => sum + (a.points || 0), 0);
    const weeksCompleted = activities.length;

    return {
      participantId,
      participantName: participantRow.name,
      activities,
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
    activity1: typeof activity.$inferSelect;
    activity2: typeof activity.$inferSelect;
    faster: 'activity1' | 'activity2' | 'equal';
    timeDifference: number;
  } {
    const details1 = this.getActivityDetails(activityId1);
    const details2 = this.getActivityDetails(activityId2);

    if (!details1 || !details2) {
      throw new Error('One or both activities not found');
    }

    const sumEfforts = (activityId: number) => {
      return this.getSegmentEffortSum(activityId);
    };

    const timeFromResult = (activityId: number) => {
      return this.getResultTotalTimeByActivity(activityId);
    };

    const t1 = sumEfforts(details1.activity.id) ?? timeFromResult(details1.activity.id) ?? 0;
    const t2 = sumEfforts(details2.activity.id) ?? timeFromResult(details2.activity.id) ?? 0;
    const diff = Math.abs(t1 - t2);

    return {
      activity1: details1.activity,
      activity2: details2.activity,
      faster: t1 < t2 ? 'activity1' : t1 > t2 ? 'activity2' : 'equal',
      timeDifference: diff
    };
  }

  /**
   * Verify idempotency: same webhook received twice produces same result
   */
  verifyIdempotency(
    weekId: number,
    participantId: string
  ): {
    resultId: number;
    totalTimeSeconds: number;
    totalPoints: number;
    prBonusPoints: number;
  } | null {
    const resRow = this.db
      .select({
        id: result.id,
        activity_id: result.activity_id,
        total_time_seconds: result.total_time_seconds
      })
      .from(result)
      .where(and(eq(result.week_id, weekId), eq(result.strava_athlete_id, participantId)))
      .limit(1)
      .get();

    if (!resRow) {
      return null;
    }

    // Compute points for the participant's result
    const rows = this.getWeekResultTimes(weekId);
    const n = rows.length;
    const rank = rows.findIndex((t) => t === resRow.total_time_seconds) + 1 || n;
    const basePoints = (n - rank) + 1;
    const prCount = resRow.activity_id
      ? this.getPrCount(resRow.activity_id)
      : 0;
    const prBonus = prCount > 0 ? 1 : 0;

    return {
      resultId: resRow.id,
      totalTimeSeconds: resRow.total_time_seconds,
      totalPoints: basePoints + prBonus,
      prBonusPoints: prBonus
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
    const countOf = <T>(table: T) =>
      this.db.select({ count: sql<number>`COUNT(*)` }).from(table as unknown as any).get()?.count ?? 0;

    return {
      participantCount: countOf(participant),
      weekCount: countOf(week),
      activityCount: countOf(activity),
      resultCount: countOf(result),
      segmentEffortCount: countOf(segmentEffort),
      webhookEventCount: countOf(webhookEvent)
    };
  }
}
