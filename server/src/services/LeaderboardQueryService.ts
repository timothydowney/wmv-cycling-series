/**
 * LeaderboardQueryService
 *
 * Provides query methods for leaderboard data without side effects.
 * Used in tests to verify database state and scoring correctness.
 * Diagnostics/test helper implemented with Drizzle (BetterSQLite3 driver).
 */
import type { AppDatabase } from '../db/types';
import { and, desc, eq, sql } from 'drizzle-orm';
import { activity, participant, result, segmentEffort, week, webhookEvent } from '../db/schema';
import { getMany, getOne } from '../db/asyncQuery';
import { ScoringService } from './ScoringService';

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
  constructor(private db: AppDatabase) {}

  private async getPrCount(activityId: number): Promise<number> {
    const row = await getOne<{ count: number }>(
      this.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(segmentEffort)
        .where(and(eq(segmentEffort.activity_id, activityId), eq(segmentEffort.pr_achieved, 1)))
    );
    return row?.count ?? 0;
  }

  private async getSegmentEffortSum(activityId: number): Promise<number | null> {
    const row = await getOne<{ total: number | null }>(
      this.db
        .select({ total: sql<number | null>`SUM(${segmentEffort.elapsed_seconds})` })
        .from(segmentEffort)
        .where(eq(segmentEffort.activity_id, activityId))
    );
    return row?.total ?? null;
  }

  private async getResultTotalTimeByActivity(activityId: number): Promise<number | null> {
    const row = await getOne<{ total: number }>(
      this.db
        .select({ total: result.total_time_seconds })
        .from(result)
        .where(eq(result.activity_id, activityId))
        .limit(1)
    );
    return row?.total ?? null;
  }

  private async getWeekResultTimes(weekId: number): Promise<number[]> {
    const rows = await getMany<{ total: number }>(
      this.db
        .select({ total: result.total_time_seconds })
        .from(result)
        .where(eq(result.week_id, weekId))
        .orderBy(result.total_time_seconds)
    );
    return rows.map((r) => r.total);
  }

  /**
   * Get complete leaderboard for a week with scoring details
   */
  async getWeekLeaderboard(weekId: number): Promise<WeekLeaderboard> {
    const weekRow = await getOne<{ id: number; week_name: string }>(
      this.db
        .select({ id: week.id, week_name: week.week_name })
        .from(week)
        .where(eq(week.id, weekId))
    );

    if (!weekRow) {
      throw new Error(`Week ${weekId} not found`);
    }

    const scoringService = new ScoringService(this.db);
    const scoringRes = await scoringService.calculateWeekScoring(weekId);

    return {
      weekId,
      weekName: weekRow.week_name,
      results: scoringRes.results.map((r: any) => ({
        resultId: 0, // Not available from service, but not critical for summary
        weekId: weekId,
        participantId: r.participantId,
        participantName: r.participantName,
        totalTimeSeconds: r.totalTimeSeconds,
        rank: r.rank,
        basePoints: r.basePoints,
        prBonusPoints: r.prBonus,
        totalPoints: r.totalPoints
      }))
    };
  }

  async getWeekActivities(weekId: number): Promise<ActivitySummary[]> {
    const activities = await getMany<{
      activityId: number;
      stravaActivityId: string;
      weekId: number | null;
      participantId: string;
      participantName: string | null;
    }>(
      this.db
        .select({
          activityId: activity.id,
          stravaActivityId: activity.strava_activity_id,
          weekId: activity.week_id,
          participantId: activity.strava_athlete_id,
          participantName: participant.name,
        })
        .from(activity)
        .leftJoin(participant, eq(participant.strava_athlete_id, activity.strava_athlete_id))
        .where(eq(activity.week_id, weekId))
        .orderBy(activity.id)
    );

    return await Promise.all(
      activities.map(async (a) => {
        const totalFromEfforts = await this.getSegmentEffortSum(a.activityId);
        const totalTimeSeconds = totalFromEfforts ?? (await this.getResultTotalTimeByActivity(a.activityId)) ?? 0;

        const effortCountRow = await getOne<{ count: number }>(
          this.db
            .select({ count: sql<number>`COUNT(*)` })
            .from(segmentEffort)
            .where(eq(segmentEffort.activity_id, a.activityId))
        );

        const prCount = await this.getPrCount(a.activityId);

        return {
          activityId: a.activityId,
          stravaActivityId: a.stravaActivityId,
          weekId: a.weekId ?? 0,
          participantId: a.participantId,
          participantName: a.participantName ?? 'Unknown',
          totalTimeSeconds,
          segmentEffortCount: effortCountRow?.count ?? 0,
          prCount,
        };
      })
    );
  }

  /**
   * Get activity details for verification
   */
  async getActivityDetails(activityId: number): Promise<{
    activity: typeof activity.$inferSelect;
    segmentEfforts: Array<typeof segmentEffort.$inferSelect>;
    result: typeof result.$inferSelect | null;
  } | null> {
    const activityRow = await getOne<typeof activity.$inferSelect>(
      this.db
        .select()
        .from(activity)
        .where(eq(activity.id, activityId))
    );

    if (!activityRow) {
      return null;
    }

    const segmentEfforts = await getMany<typeof segmentEffort.$inferSelect>(
      this.db
        .select()
        .from(segmentEffort)
        .where(eq(segmentEffort.activity_id, activityId))
        .orderBy(segmentEffort.effort_index)
    );

    const resultRow = await getOne<typeof result.$inferSelect>(
      this.db
        .select()
        .from(result)
        .where(eq(result.activity_id, activityId))
        .limit(1)
    );

    return { activity: activityRow, segmentEfforts, result: resultRow ?? null };
  }

  /**
   * Get participant's activity history
   */
  async getParticipantActivityHistory(
    participantId: string
  ): Promise<ParticipantActivityHistory> {
    const participantRow = await getOne<{ id: string; name: string }>(
      this.db
        .select({ id: participant.strava_athlete_id, name: participant.name })
        .from(participant)
        .where(eq(participant.strava_athlete_id, participantId))
    );

    if (!participantRow) {
      throw new Error(`Participant ${participantId} not found`);
    }

    const activitiesBase = await getMany<{
      weekId: number | null;
      weekName: string | null;
      activityId: number;
      stravaActivityId: string;
    }>(
      this.db
        .select({
          weekId: week.id,
          weekName: week.week_name,
          activityId: activity.id,
          stravaActivityId: activity.strava_activity_id,
        })
        .from(activity)
        .leftJoin(week, eq(activity.week_id, week.id))
        .where(eq(activity.strava_athlete_id, participantId))
        .orderBy(desc(week.id))
    );

    const scoringService = new ScoringService(this.db);

    const activities = await Promise.all(activitiesBase.map(async (a) => {
      const totalFromEfforts = await this.getSegmentEffortSum(a.activityId);
      const totalTime = (totalFromEfforts === null || totalFromEfforts === 0)
        ? (await this.getResultTotalTimeByActivity(a.activityId) ?? 0)
        : totalFromEfforts;

      const effortCountRow = await getOne<{ count: number }>(
        this.db
          .select({ count: sql<number>`COUNT(*)` })
          .from(segmentEffort)
          .where(eq(segmentEffort.activity_id, a.activityId))
      );

      const prCount = await this.getPrCount(a.activityId);
      
      let points = 0;
      if (a.weekId) {
        const scoring = await scoringService.calculateWeekScoring(a.weekId);
        const myResult = scoring.results.find((r: any) => r.participantId === participantId);
        points = myResult?.totalPoints ?? 0;
      }

      return {
        weekId: a.weekId ?? 0,
        weekName: a.weekName ?? 'Unknown',
        activityId: a.activityId,
        stravaActivityId: a.stravaActivityId,
        totalTimeSeconds: totalTime,
        segmentEfforts: effortCountRow?.count ?? 0,
        prCount,
        points
      };
    }));

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
  async compareActivities(
    activityId1: number,
    activityId2: number
  ): Promise<{
    activity1: typeof activity.$inferSelect;
    activity2: typeof activity.$inferSelect;
    faster: 'activity1' | 'activity2' | 'equal';
    timeDifference: number;
  }> {
    const details1 = await this.getActivityDetails(activityId1);
    const details2 = await this.getActivityDetails(activityId2);

    if (!details1 || !details2) {
      throw new Error('One or both activities not found');
    }

    const sumEfforts = async (activityId: number) => {
      return await this.getSegmentEffortSum(activityId);
    };

    const timeFromResult = async (activityId: number) => {
      return await this.getResultTotalTimeByActivity(activityId);
    };

    const t1 = await sumEfforts(details1.activity.id) ?? await timeFromResult(details1.activity.id) ?? 0;
    const t2 = await sumEfforts(details2.activity.id) ?? await timeFromResult(details2.activity.id) ?? 0;
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
  async verifyIdempotency(
    weekId: number,
    participantId: string
  ): Promise<{
    resultId: number;
    totalTimeSeconds: number;
    totalPoints: number;
    prBonusPoints: number;
  } | null> {
    const resRow = await getOne<{ id: number; activity_id: number | null; total_time_seconds: number }>(
      this.db
        .select({
          id: result.id,
          activity_id: result.activity_id,
          total_time_seconds: result.total_time_seconds
        })
        .from(result)
        .where(and(eq(result.week_id, weekId), eq(result.strava_athlete_id, participantId)))
        .limit(1)
    );

    if (!resRow) {
      return null;
    }

    // Compute points for the participant's result
    const rows = await this.getWeekResultTimes(weekId);
    const n = rows.length;
    const rank = rows.findIndex((t) => t === resRow.total_time_seconds) + 1 || n;
    const basePoints = (n - rank) + 1;
    const prCount = resRow.activity_id
      ? await this.getPrCount(resRow.activity_id)
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
  async getStatistics(): Promise<{
    participantCount: number;
    weekCount: number;
    activityCount: number;
    resultCount: number;
    segmentEffortCount: number;
    webhookEventCount: number;
    }> {
    const countOf = async <T>(table: T) => {
      const row = await getOne<{ count: number }>(
        this.db.select({ count: sql<number>`COUNT(*)` }).from(table as unknown as any)
      );
      return row?.count ?? 0;
    };

    return {
      participantCount: await countOf(participant),
      weekCount: await countOf(week),
      activityCount: await countOf(activity),
      resultCount: await countOf(result),
      segmentEffortCount: await countOf(segmentEffort),
      webhookEventCount: await countOf(webhookEvent)
    };
  }
}
