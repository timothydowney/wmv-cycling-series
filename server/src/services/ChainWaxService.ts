/**
 * Chain Wax Service
 *
 * Tracks chain waxing intervals for the shared Tacx Neo 2T trainer.
 * Combines Zwift virtual ride distances from Tim and Will to determine
 * when the chain needs re-waxing (every 800km).
 *
 * Also tracks wax puck lifespan (8 uses per puck).
 */

import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { eq, isNull, desc, sql } from 'drizzle-orm';
import { chainWaxPeriod, chainWaxActivity, chainWaxPuck } from '../db/schema';
import * as stravaClient from '../stravaClient';
import { getValidAccessToken } from '../tokenManager';

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
  constructor(private db: BetterSQLite3Database) {}

  /**
   * Get the current chain wax status including period progress and puck state
   */
  getCurrentStatus(): ChainWaxStatus {
    const period = this.getCurrentPeriod();
    const puck = this.getCurrentPuck();

    const activityCount = this.db
      .select({ count: sql<number>`count(*)` })
      .from(chainWaxActivity)
      .where(eq(chainWaxActivity.period_id, period.id))
      .get()!.count;

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
  waxChain(waxedAt: number): void {
    const currentPeriod = this.getCurrentPeriod();
    const now = Math.floor(Date.now() / 1000);

    this.db.transaction((tx) => {
      // Close current period
      tx.update(chainWaxPeriod)
        .set({ ended_at: waxedAt })
        .where(eq(chainWaxPeriod.id, currentPeriod.id))
        .run();

      // Create new period
      tx.insert(chainWaxPeriod)
        .values({
          started_at: waxedAt,
          total_distance_meters: 0,
          created_at: now,
        })
        .run();

      // Increment puck wax count
      const puck = tx
        .select()
        .from(chainWaxPuck)
        .where(eq(chainWaxPuck.is_current, true))
        .get();

      if (puck) {
        tx.update(chainWaxPuck)
          .set({ wax_count: puck.wax_count + 1 })
          .where(eq(chainWaxPuck.id, puck.id))
          .run();
      }
    });
  }

  /**
   * Start a new puck: retire current one and create fresh puck
   */
  newPuck(): void {
    const now = Math.floor(Date.now() / 1000);

    this.db.transaction((tx) => {
      // Retire current puck
      tx.update(chainWaxPuck)
        .set({ is_current: false })
        .where(eq(chainWaxPuck.is_current, true))
        .run();

      // Create fresh puck
      tx.insert(chainWaxPuck)
        .values({
          started_at: now,
          wax_count: 0,
          is_current: true,
          created_at: now,
        })
        .run();
    });
  }

  /**
   * Record a virtual ride activity for chain wax tracking.
   * Uses INSERT OR IGNORE for deduplication via UNIQUE constraint on strava_activity_id.
   * Returns true if a new activity was recorded, false if it was a duplicate.
   */
  recordActivity(
    stravaActivityId: string,
    athleteId: string,
    distanceMeters: number,
    activityStartAt: number
  ): boolean {
    const currentPeriod = this.getCurrentPeriod();

    // Only count activities that started after the current wax period began
    if (activityStartAt < currentPeriod.started_at) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);

    // Use a raw SQL INSERT OR IGNORE for dedup (Drizzle doesn't have onConflictDoNothing for SQLite easily)
    const result = this.db.run(sql`
      INSERT OR IGNORE INTO chain_wax_activity 
        (period_id, strava_activity_id, strava_athlete_id, distance_meters, activity_start_at, created_at)
      VALUES 
        (${currentPeriod.id}, ${stravaActivityId}, ${athleteId}, ${distanceMeters}, ${activityStartAt}, ${now})
    `);

    if (result.changes > 0) {
      this.recalculatePeriodTotal(currentPeriod.id);
      return true;
    }

    return false;
  }

  /**
   * Remove an activity from chain wax tracking (e.g., when deleted from Strava)
   */
  removeActivity(stravaActivityId: string): boolean {
    const activityRecord = this.db
      .select({ id: chainWaxActivity.id, period_id: chainWaxActivity.period_id })
      .from(chainWaxActivity)
      .where(eq(chainWaxActivity.strava_activity_id, stravaActivityId))
      .get();

    if (!activityRecord) return false;

    this.db.delete(chainWaxActivity)
      .where(eq(chainWaxActivity.id, activityRecord.id))
      .run();

    this.recalculatePeriodTotal(activityRecord.period_id);
    return true;
  }

  /**
   * Resync: fetch activities from Strava for both tracked athletes
   * from the current period start until now. Handles dedup via UNIQUE constraint.
   */
  async resync(): Promise<{ activitiesFound: number; newActivitiesRecorded: number }> {
    const currentPeriod = this.getCurrentPeriod();
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

        const recorded = this.recordActivity(
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
  getHistory(): WaxHistoryEntry[] {
    const periods = this.db
      .select()
      .from(chainWaxPeriod)
      .where(sql`${chainWaxPeriod.ended_at} IS NOT NULL`)
      .orderBy(desc(chainWaxPeriod.started_at))
      .all();

    return periods.map((period) => {
      const activityCount = this.db
        .select({ count: sql<number>`count(*)` })
        .from(chainWaxActivity)
        .where(eq(chainWaxActivity.period_id, period.id))
        .get()!.count;

      return {
        id: period.id,
        startedAt: period.started_at,
        endedAt: period.ended_at!,
        totalDistanceMeters: period.total_distance_meters,
        activityCount,
      };
    });
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
  private getCurrentPeriod() {
    const period = this.db
      .select()
      .from(chainWaxPeriod)
      .where(isNull(chainWaxPeriod.ended_at))
      .orderBy(desc(chainWaxPeriod.started_at))
      .get();

    if (!period) {
      throw new Error('No active chain wax period found. Database may need initialization.');
    }

    return period;
  }

  /**
   * Get the current active puck
   */
  private getCurrentPuck() {
    return this.db
      .select()
      .from(chainWaxPuck)
      .where(eq(chainWaxPuck.is_current, true))
      .get() || null;
  }

  /**
   * Recalculate the cached total distance for a period from its activities
   */
  private recalculatePeriodTotal(periodId: number): void {
    const result = this.db
      .select({ total: sql<number>`COALESCE(SUM(${chainWaxActivity.distance_meters}), 0)` })
      .from(chainWaxActivity)
      .where(eq(chainWaxActivity.period_id, periodId))
      .get();

    this.db.update(chainWaxPeriod)
      .set({ total_distance_meters: result?.total ?? 0 })
      .where(eq(chainWaxPeriod.id, periodId))
      .run();
  }
}
