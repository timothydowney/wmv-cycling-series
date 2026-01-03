/**
 * MockStravaClient
 *
 * Provides configurable mock responses for Strava API calls.
 * Used in integration tests to simulate various Strava scenarios without network calls.
 *
 * Allows tests to:
 * - Return realistic activity data with customizable fields
 * - Simulate PR achievements
 * - Simulate API errors (404, rate limits, network failures)
 * - Track which methods were called (for assertions)
 */

import { type Activity as StravaActivity } from '../stravaClient';

export type MockScenario = 'success' | 'notFound' | 'rateLimit' | 'networkError';

/**
 * MockStravaClient with configurable scenarios
 */
export class MockStravaClient {
  private scenario: MockScenario = 'success';
  private customActivities: Map<number, StravaActivity> = new Map();
  private callLog: Array<{ method: string; args: any[] }> = [];

  /**
   * Set the current scenario for API responses
   */
  setScenario(scenario: MockScenario): void {
    this.scenario = scenario;
  }

  /**
   * Configure a custom activity to be returned
   */
  setActivity(activityId: number, activity: Partial<StravaActivity>): void {
    const defaultActivity = this.createDefaultActivity(activityId);
    this.customActivities.set(activityId, { ...defaultActivity, ...activity } as StravaActivity);
  }

  /**
   * Get activity from Strava API
   * Simulates: GET /api/v3/activities/{id}
   */
  async getActivity(
    accessToken: string,
    activityId: number,
    includeAllEfforts: boolean = true
  ): Promise<StravaActivity> {
    this.callLog.push({
      method: 'getActivity',
      args: [accessToken, activityId, includeAllEfforts]
    });

    if (this.scenario === 'notFound') {
      throw new Error('404: Activity not found');
    }
    if (this.scenario === 'rateLimit') {
      throw new Error('429: Rate limit exceeded');
    }
    if (this.scenario === 'networkError') {
      throw new Error('Network error: ECONNREFUSED');
    }

    // Return custom activity if configured, otherwise default
    if (this.customActivities.has(activityId)) {
      return this.customActivities.get(activityId)!;
    }

    return this.createDefaultActivity(activityId);
  }

  /**
   * Get athlete activities
   * Simulates: GET /api/v3/athlete/activities
   */
  async getAthleteActivities(
    accessToken: string,
    before?: number,
    after?: number,
    perPage: number = 30
  ): Promise<StravaActivity[]> {
    this.callLog.push({
      method: 'getAthleteActivities',
      args: [accessToken, before, after, perPage]
    });

    if (this.scenario === 'networkError') {
      throw new Error('Network error: ECONNREFUSED');
    }

    // Return activities that match the time filter
    const activities: StravaActivity[] = [];
    this.customActivities.forEach((activity) => {
      const activityTime = Math.floor(new Date(activity.start_date).getTime() / 1000);
      const afterTime = after || 0;
      const beforeTime = before || Math.floor(Date.now() / 1000);

      if (activityTime >= afterTime && activityTime <= beforeTime) {
        activities.push(activity);
      }
    });

    return activities;
  }

  /**
   * Get call log (for test assertions)
   */
  getCallLog(): Array<{ method: string; args: any[] }> {
    return this.callLog;
  }

  /**
   * Clear call log
   */
  clearCallLog(): void {
    this.callLog = [];
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.scenario = 'success';
    this.customActivities.clear();
    this.callLog = [];
  }

  /**
   * Create a default activity with given ID
   * Provides realistic defaults for testing
   */
  private createDefaultActivity(activityId: number): StravaActivity {
    const now = new Date();
    const startDate = new Date(now.getTime() - 1000 * 60 * 30); // 30 minutes ago

    return {
      id: activityId,
      name: `Test Activity ${activityId}`,
      start_date: startDate.toISOString(),
      start_date_local: startDate.toISOString().replace('Z', ''),
      distance: 5000,
      moving_time: 1200,
      elapsed_time: 1200,
      total_elevation_gain: 100,
      sport_type: 'Ride',
      segment_efforts: [
        {
          id: String(activityId * 100 + 1),
          name: 'Segment 1',
          segment: {
            id: 12345678,
            name: 'Test Segment',
            distance: 2500,
            average_grade: 5.2
          },
          start_date: startDate.toISOString(),
          start_date_local: startDate.toISOString().replace('Z', ''),
          elapsed_time: 600,
          moving_time: 580
        }
      ],
      athlete: { id: 12345 }
    } as any;
  }
}

/**
 * Factory to create preset activity configurations for common test scenarios
 */
export const ActivityScenarios = {
  /**
   * Fast activity with PR achievement
   */
  withPR(activityId: number, segmentId: number, elapsedTime: number = 580): StravaActivity {
    const now = new Date();
    const startDate = new Date(now.getTime() - 1000 * 60 * 30);

    return {
      id: activityId,
      name: `Fast Activity ${activityId}`,
      start_date: startDate.toISOString(),
      start_date_local: startDate.toISOString().replace('Z', ''),
      distance: 5000,
      moving_time: 1200,
      elapsed_time: 1200,
      total_elevation_gain: 100,
      sport_type: 'Ride',
      segment_efforts: [
        {
          id: String(activityId * 100 + 1),
          name: 'Segment Effort',
          segment: {
            id: segmentId,
            name: 'Test Segment',
            distance: 2500,
            average_grade: 5.2
          },
          start_date: startDate.toISOString(),
          start_date_local: startDate.toISOString().replace('Z', ''),
          elapsed_time: elapsedTime,
          moving_time: elapsedTime - 20,
          pr_rank: 1 // Indicates PR achieved
        }
      ],
      athlete: { id: 12345 }
    } as any;
  },

  /**
   * Slow activity without PR
   */
  withoutPR(
    activityId: number,
    segmentId: number,
    elapsedTime: number = 750
  ): StravaActivity {
    const now = new Date();
    const startDate = new Date(now.getTime() - 1000 * 60 * 30);

    return {
      id: activityId,
      name: `Slow Activity ${activityId}`,
      start_date: startDate.toISOString(),
      start_date_local: startDate.toISOString().replace('Z', ''),
      distance: 5000,
      moving_time: 1200,
      elapsed_time: 1200,
      total_elevation_gain: 100,
      sport_type: 'Ride',
      segment_efforts: [
        {
          id: String(activityId * 100 + 1),
          name: 'Segment Effort',
          segment: {
            id: segmentId,
            name: 'Test Segment',
            distance: 2500,
            average_grade: 5.2
          },
          start_date: startDate.toISOString(),
          start_date_local: startDate.toISOString().replace('Z', ''),
          elapsed_time: elapsedTime,
          moving_time: elapsedTime - 20
        }
      ],
      athlete: { id: 12345 }
    } as any;
  },

  /**
   * Activity with multiple segment efforts (laps)
   */
  withMultipleLaps(
    activityId: number,
    segmentId: number,
    lapCount: number,
    timesPerLap: number[] = []
  ): StravaActivity {
    const now = new Date();
    const startDate = new Date(now.getTime() - 1000 * 60 * 30);
    const defaultTimes = Array(lapCount).fill(600);
    const times = timesPerLap.length === lapCount ? timesPerLap : defaultTimes;

    return {
      id: activityId,
      name: `Multi-lap Activity ${activityId}`,
      start_date: startDate.toISOString(),
      start_date_local: startDate.toISOString().replace('Z', ''),
      distance: 5000 * lapCount,
      moving_time: times.reduce((a, b) => a + b, 0),
      elapsed_time: times.reduce((a, b) => a + b, 0),
      total_elevation_gain: 100 * lapCount,
      sport_type: 'Ride',
      segment_efforts: times.map((time, index) => ({
        id: String(activityId * 100 + index + 1),
        name: `Lap ${index + 1}`,
        segment: {
          id: segmentId,
          name: 'Test Segment',
          distance: 2500,
          average_grade: 5.2
        },
        start_date: new Date(startDate.getTime() + index * time * 1000)
          .toISOString(),
        start_date_local: new Date(startDate.getTime() + index * time * 1000)
          .toISOString()
          .replace('Z', ''),
        elapsed_time: time,
        moving_time: time - 20,
        pr_rank: index === 0 ? 1 : undefined // Only first lap is PR
      })),
      athlete: { id: 12345 }
    } as any;
  }
};
