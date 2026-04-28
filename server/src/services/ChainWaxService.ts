/**
 * Chain Wax Service
 *
 * Tracks chain waxing intervals for the shared Tacx Neo 2T trainer.
 * Combines Zwift virtual ride distances from Tim and Will to determine
 * when the chain needs re-waxing (every 800km).
 *
 * Also tracks wax puck lifespan (8 uses per puck).
 */

import type { AppDatabase } from '../db/types';
import { eq, isNull, desc, sql } from 'drizzle-orm';
import { chainWaxPeriod, chainWaxActivity, chainWaxPuck } from '../db/schema';
import * as stravaClient from '../stravaClient';
import { getValidAccessToken } from '../tokenManager';
import { getMany, getOne, exec } from '../db/asyncQuery';

// Athletes tracked for chain wax purposes (Tim and Will on shared trainer)
const TRACKED_ATHLETE_IDS = ['366880', '34221810'];

// Distance threshold in meters before chain needs re-waxing (800km)
const REWAX_THRESHOLD_METERS = 800_000;

// Maximum uses per wax puck
const MAX_PUCK_USES = 8;

export interface ChainWaxStatus {
  currentPeriod: {
    id: number;
    startedAt: number;
    totalDistanceMeters: number;
    thresholdMeters: number;
    percentage: number;
    colorZone: 'green' | 'yellow' | 'red';
  };
  puck: {
    id: number;
    waxCount: number;
    maxUses: number;
    isExpired: boolean;
  } | null;
  activityCount: number;
}

export interface WaxHistoryEntry {
  id: number;
  startedAt: number;
  endedAt: number;
  totalDistanceMeters: number;
  activityCount: number;
}

export class ChainWaxService {
  constructor(private db: AppDatabase) {}

  /**
   * Get the current chain wax status including period progress and puck state
   */
  async getCurrentStatus(): Promise<ChainWaxStatus> {
    const period = await this.getCurrentPeriod();
    const puck = await this.getCurrentPuck();

    const countRow = await getOne<{ count: number }>(
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(chainWaxActivity)
        .where(eq(chainWaxActivity.period_id, period.id))
    );
    const activityCount = countRow?.count ?? 0;

    const percentage = Math.min((period.total_distance_meters / REWAX_THRESHOLD_METERS) * 100, 100);

    let colorZone: 'green' | 'yellow' | 'red';
    if (period.total_distance_meters >= REWAX_THRESHOLD_METERS * 0.9) {
      colorZone = 'red';
    } else if (period.total_distance_meters >= REWAX_THRESHOLD_METERS * 0.75) {
      colorZone = 'yellow';
    } else {
      colorZone = 'green';
    }

    return {
      currentPeriod: {
        id: period.id,
        startedAt: period.started_at,
        totalDistanceMeters: period.total_distance_meters,
        thresholdMeters: REWAX_THRESHOLD_METERS,
        percentage,
        colorZone,
      },
      puck: puck ? {
        id: puck.id,
        waxCount: puck.wax_count,
        maxUses: MAX_PUCK_USES,
        isExpired: puck.wax_count >= MAX_PUCK_USES,
      } : null,
      activityCount,
    };
  }

  /**
   * Record a wax chain event: closes current period, opens new one, increments puck
   */
  async waxChain(waxedAt: number): Promise<void> {
    const currentPeriod = await this.getCurrentPeriod();
    const now = Math.floor(Date.now() / 1000);

    await this.db.transaction(async (tx) => {
      // Close current period
      await exec(
        tx.update(chainWaxPeriod)
          .set({ ended_at: waxedAt })
          .where(eq(chainWaxPeriod.id, currentPeriod.id))
      );

      // Create new period
      await exec(
        tx.insert(chainWaxPeriod)
          .values({
            started_at: waxedAt,
            total_distance_meters: 0,
            created_at: now,
          })
      );

      // Increment puck wax count
      const puck = await getOne<any>(
        tx
          .select()
          .from(chainWaxPuck)
          .where(eq(chainWaxPuck.is_current, true))
      );

      if (puck) {
        await exec(
          tx.update(chainWaxPuck)
            .set({ wax_count: puck.wax_count + 1 })
            .where(eq(chainWaxPuck.id, puck.id))
        );
      }
    });
  }

  /**
   * Start a new puck: retire current one and create fresh puck
   */
  async newPuck(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    await this.db.transaction(async (tx) => {
      // Retire current puck
      await exec(
        tx.update(chainWaxPuck)
          .set({ is_current: false })
          .where(eq(chainWaxPuck.is_current, true))
      );

      // Create fresh puck
      await exec(
        tx.insert(chainWaxPuck)
          .values({
            started_at: now,
            wax_count: 0,
            is_current: true,
            created_at: now,
          })
      );
    });
  }

  /**
   * Record a virtual ride activity for chain wax tracking.
   * Uses INSERT OR IGNORE for deduplication via UNIQUE constraint on strava_activity_id.
   * Returns true if a new activity was recorded, false if it was a duplicate.
   */
  async recordActivity(
    stravaActivityId: string,
    athleteId: string,
    distanceMeters: number,
    activityStartAt: number
  ): Promise<boolean> {
    const currentPeriod = await this.getCurrentPeriod();

    // Only count activities that started after the current wax period began
    if (activityStartAt < currentPeriod.started_at) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);

    const inserted = await getOne<{ id: number }>(
      this.db.insert(chainWaxActivity).values({
        period_id: currentPeriod.id,
        strava_activity_id: stravaActivityId,
        strava_athlete_id: athleteId,
        distance_meters: distanceMeters,
        activity_start_at: activityStartAt,
        created_at: now
      }).onConflictDoNothing().returning({ id: chainWaxActivity.id })
    );

    if (inserted) {
      await this.recalculatePeriodTotal(currentPeriod.id);
      return true;
    }

    return false;
  }

  /**
   * Remove an activity from chain wax tracking (e.g., when deleted from Strava)
   */
  async removeActivity(stravaActivityId: string): Promise<boolean> {
    const activityRecord = await getOne<{ id: number; period_id: number }>(
      this.db
        .select({ id: chainWaxActivity.id, period_id: chainWaxActivity.period_id })
        .from(chainWaxActivity)
        .where(eq(chainWaxActivity.strava_activity_id, stravaActivityId))
    );

    if (!activityRecord) return false;

    await exec(
      this.db.delete(chainWaxActivity)
        .where(eq(chainWaxActivity.id, activityRecord.id))
    );

    await this.recalculatePeriodTotal(activityRecord.period_id);
    return true;
  }

  /**
   * Resync: fetch activities from Strava for both tracked athletes
   * from the current period start until now. Handles dedup via UNIQUE constraint.
   */
  async resync(): Promise<{ activitiesFound: number; newActivitiesRecorded: number }> {
    const currentPeriod = await this.getCurrentPeriod();
    const now = Math.floor(Date.now() / 1000);
    let activitiesFound = 0;
    let newActivitiesRecorded = 0;

    for (const athleteId of TRACKED_ATHLETE_IDS) {
      let accessToken: string;
      try {
        accessToken = await getValidAccessToken(this.db, stravaClient, athleteId);
      } catch {
        console.log(`[ChainWax] Could not get token for athlete ${athleteId}, skipping resync for this athlete`);
        continue;
      }

      const activities = await stravaClient.listAthleteActivities(
        accessToken,
        currentPeriod.started_at,
        now,
        { includeAllEfforts: false }
      );

      for (const activity of activities) {
        if (activity.type !== 'VirtualRide') continue;

        activitiesFound++;

        const startAt = activity.start_date
          ? Math.floor(new Date(activity.start_date).getTime() / 1000)
          : now;

        const recorded = await this.recordActivity(
          String(activity.id),
          athleteId,
          activity.distance || 0,
          startAt
        );

        if (recorded) {
          newActivitiesRecorded++;
        }
      }
    }

    console.log(`[ChainWax] Resync complete: ${activitiesFound} virtual rides found, ${newActivitiesRecorded} new activities recorded`);
    return { activitiesFound, newActivitiesRecorded };
  }

  /**
   * Get history of completed wax periods
   */
  async getHistory(): Promise<WaxHistoryEntry[]> {
    const periods = await getMany<any>(
      this.db
        .select()
        .from(chainWaxPeriod)
        .where(sql`${chainWaxPeriod.ended_at} IS NOT NULL`)
        .orderBy(desc(chainWaxPeriod.started_at))
    );

    const result: WaxHistoryEntry[] = [];
    for (const period of periods) {
      const countRow = await getOne<{ count: number }>(
        this.db
          .select({ count: sql<number>`count(*)` })
          .from(chainWaxActivity)
          .where(eq(chainWaxActivity.period_id, period.id))
      );

      result.push({
        id: period.id,
        startedAt: period.started_at,
        endedAt: period.ended_at!,
        totalDistanceMeters: period.total_distance_meters,
        activityCount: countRow?.count ?? 0,
      });
    }
    return result;
  }

  /**
   * Check if an athlete ID is tracked for chain wax purposes
   */
  static isTrackedAthlete(athleteId: string): boolean {
    return TRACKED_ATHLETE_IDS.includes(athleteId);
  }

  /**
   * Get the current (active) wax period
   */
  private async getCurrentPeriod() {
    const period = await getOne<any>(
      this.db
        .select()
        .from(chainWaxPeriod)
        .where(isNull(chainWaxPeriod.ended_at))
        .orderBy(desc(chainWaxPeriod.started_at))
    );

    if (!period) {
      throw new Error('No active chain wax period found. Database may need initialization.');
    }

    return period;
  }

  /**
   * Get the current active puck
   */
  private async getCurrentPuck() {
    return await getOne<any>(
      this.db
        .select()
        .from(chainWaxPuck)
        .where(eq(chainWaxPuck.is_current, true))
    ) || null;
  }

  /**
   * Recalculate the cached total distance for a period from its activities
   */
  private async recalculatePeriodTotal(periodId: number): Promise<void> {
    const result = await getOne<{ total: number }>(
      this.db
        .select({ total: sql<number>`COALESCE(SUM(${chainWaxActivity.distance_meters}), 0)` })
        .from(chainWaxActivity)
        .where(eq(chainWaxActivity.period_id, periodId))
    );

    await exec(
      this.db.update(chainWaxPeriod)
        .set({ total_distance_meters: result?.total ?? 0 })
        .where(eq(chainWaxPeriod.id, periodId))
    );
  }
}
