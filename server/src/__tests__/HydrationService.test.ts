import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HydrationService } from '../services/HydrationService';
import { setupTestDb } from './setupTestDb';
import { createSeason, createSegment, createWeek, createActivity, createSegmentEffort, createParticipant } from './testDataHelpers';
import * as stravaClient from '../stravaClient';
import { getValidAccessToken } from '../tokenManager';
import { segmentEffort, result } from '../db/schema';
import { eq } from 'drizzle-orm';

jest.mock('../stravaClient');
jest.mock('../tokenManager');

const mockedStravaClient = jest.mocked(stravaClient);
const mockedGetValidAccessToken = jest.mocked(getValidAccessToken);

describe('HydrationService', () => {
  let orm: any;
  let service: HydrationService;

  beforeEach(() => {
    const { orm: newOrm } = setupTestDb({ seed: false });
    orm = newOrm;
    service = new HydrationService(orm);
    jest.clearAllMocks();
  });

  describe('hydrateActivity', () => {
    it('should successfully hydrate an activity with performance metrics', async () => {
      // Setup data
      const stravaAthleteId = 'athlete1';
      createParticipant(orm, stravaAthleteId, 'Test Athlete');
      const seasonObj = createSeason(orm, 'Season 2025');
      createSegment(orm, 'seg123', 'Test Segment');
      const weekObj = createWeek(orm, { 
        seasonId: seasonObj.id, 
        stravaSegmentId: 'seg123', 
        requiredLaps: 2 
      });
      
      const activityObj = createActivity(orm, { 
        weekId: weekObj.id, 
        stravaAthleteId 
      });
      
      // Create 2 efforts in DB (missing metrics)
      createSegmentEffort(orm, { activityId: activityObj.id, stravaSegmentId: 'seg123', effortIndex: 0 });
      createSegmentEffort(orm, { activityId: activityObj.id, stravaSegmentId: 'seg123', effortIndex: 1 });

      // Create a result record
      orm.insert(result).values({
        week_id: weekObj.id,
        strava_athlete_id: stravaAthleteId,
        activity_id: activityObj.id,
        total_time_seconds: 1200,
        rank: 1,
        points: 10
      }).run();

      // Mock token - correct pattern: function returns token string
      mockedGetValidAccessToken.mockResolvedValue('fake_token');

      // Mock Strava response
      mockedStravaClient.getActivity.mockResolvedValue({
        id: activityObj.strava_activity_id,
        segment_efforts: [
          {
            id: 101,
            segment: { id: 'seg123' },
            elapsed_time: 600,
            average_watts: 250,
            average_heartrate: 150,
            max_heartrate: 170,
            average_cadence: 90,
            device_watts: true
          },
          {
            id: 102,
            segment: { id: 'seg123' },
            elapsed_time: 610,
            average_watts: 260,
            average_heartrate: 155,
            max_heartrate: 175,
            average_cadence: 92,
            device_watts: true
          }
        ]
      } as any);

      const res = await service.hydrateActivity(activityObj.id);

      expect(res.success).toBe(true);
      expect(res.updatedCount).toBe(2);

      // Verify DB updates
      const updatedEfforts = orm.select().from(segmentEffort).where(eq(segmentEffort.activity_id, activityObj.id)).all();
      expect(updatedEfforts[0].average_watts).toBe(250);
      expect(updatedEfforts[0].average_heartrate).toBe(150);
      expect(updatedEfforts[1].average_watts).toBe(260);
      expect(updatedEfforts[1].average_heartrate).toBe(155);
      
      // Verify result update
      const updatedResult = orm.select().from(result).where(eq(result.activity_id, activityObj.id)).get();
      expect(updatedResult.total_time_seconds).toBe(1210); // 600 + 610
    });

    it('should return failure if activity not found', async () => {
      const res = await service.hydrateActivity(999);
      expect(res.success).toBe(false);
      expect(res.message).toBe('Activity not found');
    });

    it('should return failure if token cannot be retrieved', async () => {
      const activityObj = createActivity(orm, { weekId: 1, stravaAthleteId: 'athlete1' });
      // Mock the function to throw an error instead of returning null
      mockedGetValidAccessToken.mockRejectedValue(new Error('Participant not connected to Strava'));

      const res = await service.hydrateActivity(activityObj.id);
      expect(res.success).toBe(false);
      expect(res.message).toBe('Could not get valid Strava access token');
    });

    it('should return failure if Strava fetch fails', async () => {
      const activityObj = createActivity(orm, { weekId: 1, stravaAthleteId: 'athlete1' });
      mockedGetValidAccessToken.mockResolvedValue('fake_token');
      mockedStravaClient.getActivity.mockResolvedValue(null as any);

      const res = await service.hydrateActivity(activityObj.id);
      expect(res.success).toBe(false);
      expect(res.message).toBe('Could not fetch activity details from Strava');
    });

    it('should return failure if no matching laps found', async () => {
      const stravaAthleteId = 'athlete1';
      const seasonObj = createSeason(orm, 'Season 2025');
      createSegment(orm, 'seg123', 'Test Segment');
      const weekObj = createWeek(orm, { seasonId: seasonObj.id, stravaSegmentId: 'seg123', requiredLaps: 2 });
      const activityObj = createActivity(orm, { weekId: weekObj.id, stravaAthleteId });

      mockedGetValidAccessToken.mockResolvedValue('fake_token');
      mockedStravaClient.getActivity.mockResolvedValue({
        id: activityObj.strava_activity_id,
        segment_efforts: [
          { id: 101, segment: { id: 'wrong_seg' }, elapsed_time: 600 }
        ]
      } as any);

      const res = await service.hydrateActivity(activityObj.id);
      expect(res.success).toBe(false);
      expect(res.message).toContain('Could not find 2 qualifying laps');
    });
  });

  describe('hydrateByStravaId', () => {
    it('should find activity by strava ID and hydrate it', async () => {
      const stravaAthleteId = 'athlete1';
      const stravaActivityId = 'strava_act_123';
      
      const seasonObj = createSeason(orm, 'Season 2025');
      createSegment(orm, 'seg123', 'Test Segment');
      const weekObj = createWeek(orm, { seasonId: seasonObj.id, stravaSegmentId: 'seg123' });
      const activityObj = createActivity(orm, { 
        weekId: weekObj.id, 
        stravaAthleteId,
        stravaActivityId
      });

      // Mock hydrateActivity to avoid full logic
      const hydrateSpy = jest.spyOn(service, 'hydrateActivity').mockResolvedValue({ success: true, updatedCount: 1 });

      const res = await service.hydrateByStravaId(stravaActivityId);

      expect(res.success).toBe(true);
      expect(hydrateSpy).toHaveBeenCalledWith(activityObj.id);
    });

    it('should return failure if activity not found by strava ID', async () => {
      const res = await service.hydrateByStravaId('non_existent');
      expect(res.success).toBe(false);
      expect(res.message).toBe('Activity not found in local database');
    });
  });

  describe('sweepAndHydrate', () => {
    it('should process activities missing metrics', async () => {
      // Setup 2 activities needing hydration
      const stravaAthleteId = 'athlete1';
      const seasonObj = createSeason(orm, 'Season 2025');
      createSegment(orm, 'seg123', 'Test Segment');
      const weekObj = createWeek(orm, { seasonId: seasonObj.id, stravaSegmentId: 'seg123' });
      
      const act1 = createActivity(orm, { weekId: weekObj.id, stravaAthleteId });
      createSegmentEffort(orm, { activityId: act1.id, stravaSegmentId: 'seg123' });
      
      const act2 = createActivity(orm, { weekId: weekObj.id, stravaAthleteId });
      createSegmentEffort(orm, { activityId: act2.id, stravaSegmentId: 'seg123' });

      // Mock hydrateActivity
      const hydrateSpy = jest.spyOn(service, 'hydrateActivity').mockResolvedValue({ success: true });
      
      // Mock setTimeout to avoid waiting
      jest.useFakeTimers();

      const promise = service.sweepAndHydrate(10);
      
      // Fast-forward timers for each activity
      await jest.runAllTimersAsync();
      
      const res = await promise;

      expect(res.processed).toBe(2);
      expect(res.successful).toBe(2);
      expect(hydrateSpy).toHaveBeenCalledTimes(2);
      
      jest.useRealTimers();
    });

    it('should return 0 if no activities need hydration', async () => {
      const res = await service.sweepAndHydrate(10);
      expect(res.processed).toBe(0);
      expect(res.successful).toBe(0);
    });
  });
});
