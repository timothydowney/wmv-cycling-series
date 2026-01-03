// @ts-nocheck
/**
 * Activity Processor Tests
 * 
 * Tests for activity processing logic, independent of Strava API
 * These can be run without making actual API calls by mocking the stravaClient module
 */

import { isoToUnix } from '../dateUtils';
import * as activityProcessor from '../activityProcessor';

// Mock stravaClient to avoid API calls
jest.mock('../stravaClient', () => ({
  getActivity: jest.fn(),
  listAthleteActivities: jest.fn()
}));

const stravaClient = require('../stravaClient');

describe('Activity Processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // NOTE: extractActivityId tests removed - function was deprecated and is no longer exported
  // This was only used for manual activity submission which has been replaced by admin batch fetch

  describe('findBestQualifyingActivity', () => {
    test('returns null for empty activity list', async () => {
      const result = await activityProcessor.findBestQualifyingActivity([], '123', 1, 'token');
      expect(result).toBeNull();
    });

    test('filters activities outside time window', async () => {
      const week = {
        start_time: '2025-10-28T00:00:00Z',
        end_time: '2025-10-28T22:00:00Z',
        strava_segment_id: '100',
        required_laps: 1
      };

      const activities = [
        { id: '1', start_date: '2025-10-27T12:00:00Z' }, // Before window
        { id: '2', start_date: '2025-10-28T12:00:00Z' }  // Within window
      ];

      stravaClient.getActivity.mockResolvedValue(null);

      const result = await activityProcessor.findBestQualifyingActivity(
        activities,
        week.strava_segment_id,
        week.required_laps,
        'token',
        week
      );

      // Should not attempt to fetch activity outside window
      expect(result).toBeNull();
    });

    test('calls stravaClient.getActivity for each valid activity', async () => {
      const week = {
        start_at: isoToUnix('2025-10-28T00:00:00Z'),
        end_at: isoToUnix('2025-10-28T22:00:00Z'),
        strava_segment_id: '100',
        required_laps: 1
      };

      const activities = [
        { id: '1', start_date: '2025-10-28T12:00:00Z' },
        { id: '2', start_date: '2025-10-28T14:00:00Z' }
      ];

      stravaClient.getActivity.mockResolvedValue({
        id: '1',
        name: 'Test Activity',
        segment_efforts: []
      });

      await activityProcessor.findBestQualifyingActivity(
        activities,
        week.strava_segment_id,
        week.required_laps,
        'token',
        week
      );

      // Should call getActivity for activities in time window
      expect(stravaClient.getActivity).toHaveBeenCalled();
    });

    test('selects activity with required segment', async () => {
      const week = {
        start_at: isoToUnix('2025-10-28T00:00:00Z'),
        end_at: isoToUnix('2025-10-28T22:00:00Z'),
        strava_segment_id: '100',
        required_laps: 1
      };

      const activities = [
        { id: '1', start_date: '2025-10-28T12:00:00Z' }
      ];

      stravaClient.getActivity.mockResolvedValue({
        id: '1',
        name: 'Test Activity',
        segment_efforts: [
          {
            segment: { id: '100' }, // Correct segment
            elapsed_time: 600
          }
        ]
      });

      const result = await activityProcessor.findBestQualifyingActivity(
        activities,
        week.strava_segment_id,
        week.required_laps,
        'token',
        week
      );

      expect(result).not.toBeNull();
      expect(result.id).toBe('1');
    });

    test('requires minimum number of laps', async () => {
      const week = {
        start_at: isoToUnix('2025-10-28T00:00:00Z'),
        end_at: isoToUnix('2025-10-28T22:00:00Z'),
        strava_segment_id: '100',
        required_laps: 3
      };

      const activities = [
        { id: '1', start_date: '2025-10-28T12:00:00Z' }
      ];

      stravaClient.getActivity.mockResolvedValue({
        id: '1',
        name: 'Test Activity',
        segment_efforts: [
          { segment: { id: '100' }, elapsed_time: 600 },
          { segment: { id: '100' }, elapsed_time: 620 }
          // Only 2 efforts, but 3 required
        ]
      });

      const result = await activityProcessor.findBestQualifyingActivity(
        activities,
        week.strava_segment_id,
        week.required_laps,
        'token',
        week
      );

      expect(result).toBeNull();
    });

    test('selects fastest qualifying activity', async () => {
      const week = {
        start_at: isoToUnix('2025-10-28T00:00:00Z'),
        end_at: isoToUnix('2025-10-28T22:00:00Z'),
        strava_segment_id: '100',
        required_laps: 2
      };

      const activities = [
        { id: '1', start_date: '2025-10-28T12:00:00Z' },
        { id: '2', start_date: '2025-10-28T13:00:00Z' }
      ];

      stravaClient.getActivity
        .mockResolvedValueOnce({
          id: '1',
          name: 'Slower Activity',
          segment_efforts: [
            { segment: { id: '100' }, elapsed_time: 600 },
            { segment: { id: '100' }, elapsed_time: 620 }
          ]
        })
        .mockResolvedValueOnce({
          id: '2',
          name: 'Faster Activity',
          segment_efforts: [
            { segment: { id: '100' }, elapsed_time: 580 },
            { segment: { id: '100' }, elapsed_time: 590 }
          ]
        });

      const result = await activityProcessor.findBestQualifyingActivity(
        activities,
        week.strava_segment_id,
        week.required_laps,
        'token',
        week
      );

      expect(result).not.toBeNull();
      expect(result.id).toBe('2'); // Faster activity
    });

    test('finds best consecutive window when more than required laps', async () => {
      // CRITICAL TEST: Ensures we select best CONSECUTIVE window, not best individual efforts
      const week = {
        start_at: isoToUnix('2025-10-28T00:00:00Z'),
        end_at: isoToUnix('2025-10-28T22:00:00Z'),
        strava_segment_id: '100',
        required_laps: 2
      };

      const activities = [
        { id: '1', start_date: '2025-10-28T12:00:00Z' }
      ];

      // 5 efforts total: [600, 650, 580, 640, 620]
      // Windows: [600+650=1250], [650+580=1230], [580+640=1220], [640+620=1260]
      // Best window: [580+640=1220] at index 2
      // Old algorithm (taking fastest 2): would take [580, 600] = 1180 (WRONG - not consecutive)
      // New algorithm: should take [580, 640] = 1220 (CORRECT - consecutive window)
      stravaClient.getActivity.mockResolvedValue({
        id: '1',
        name: 'Multiple Attempts Activity',
        segment_efforts: [
          { segment: { id: '100' }, elapsed_time: 600 },  // Warmup
          { segment: { id: '100' }, elapsed_time: 650 },  // Slower
          { segment: { id: '100' }, elapsed_time: 580 },  // Fast
          { segment: { id: '100' }, elapsed_time: 640 },  // Med
          { segment: { id: '100' }, elapsed_time: 620 }   // Cooldown
        ]
      });

      const result = await activityProcessor.findBestQualifyingActivity(
        activities,
        week.strava_segment_id,
        week.required_laps,
        'token',
        week
      );

      expect(result).not.toBeNull();
      // Total time should be from consecutive window [580, 640]
      expect(result.totalTime).toBe(1220);
      expect(result.segmentEfforts.length).toBe(2);
      // Should contain the efforts with times 580 and 640
      const times = result.segmentEfforts.map(e => e.elapsed_time).sort((a, b) => a - b);
      expect(times).toEqual([580, 640]);
    });

    test('correctly evaluates all consecutive windows and selects best', async () => {
      // Test with 4 possible windows when requiring 2 laps
      const week = {
        start_at: isoToUnix('2025-10-28T00:00:00Z'),
        end_at: isoToUnix('2025-10-28T22:00:00Z'),
        strava_segment_id: '100',
        required_laps: 2
      };

      const activities = [
        { id: '1', start_date: '2025-10-28T12:00:00Z' }
      ];

      // Efforts: [400, 500, 450, 550]
      // Windows: [400+500=900], [500+450=950], [450+550=1000]
      // Best: [400+500=900]
      stravaClient.getActivity.mockResolvedValue({
        id: '1',
        name: 'Test Activity',
        segment_efforts: [
          { segment: { id: '100' }, elapsed_time: 400 },
          { segment: { id: '100' }, elapsed_time: 500 },
          { segment: { id: '100' }, elapsed_time: 450 },
          { segment: { id: '100' }, elapsed_time: 550 }
        ]
      });

      const result = await activityProcessor.findBestQualifyingActivity(
        activities,
        week.strava_segment_id,
        week.required_laps,
        'token',
        week
      );

      expect(result).not.toBeNull();
      expect(result.totalTime).toBe(900); // First window is fastest
      expect(result.segmentEfforts[0].elapsed_time).toBe(400);
      expect(result.segmentEfforts[1].elapsed_time).toBe(500);
    });

    test('handles exact number of laps with no selection needed', async () => {
      // When exactly required_laps are found, use them all in order
      const week = {
        start_at: isoToUnix('2025-10-28T00:00:00Z'),
        end_at: isoToUnix('2025-10-28T22:00:00Z'),
        strava_segment_id: '100',
        required_laps: 2
      };

      const activities = [
        { id: '1', start_date: '2025-10-28T12:00:00Z' }
      ];

      stravaClient.getActivity.mockResolvedValue({
        id: '1',
        name: 'Exact Match',
        segment_efforts: [
          { segment: { id: '100' }, elapsed_time: 580 },
          { segment: { id: '100' }, elapsed_time: 590 }
        ]
      });

      const result = await activityProcessor.findBestQualifyingActivity(
        activities,
        week.strava_segment_id,
        week.required_laps,
        'token',
        week
      );

      expect(result).not.toBeNull();
      expect(result.totalTime).toBe(1170); // 580 + 590
      expect(result.segmentEfforts.length).toBe(2);
    });

    test('handles three-lap window selection correctly', async () => {
      // Test with 3 required laps from 5 total efforts
      const week = {
        start_at: isoToUnix('2025-10-28T00:00:00Z'),
        end_at: isoToUnix('2025-10-28T22:00:00Z'),
        strava_segment_id: '100',
        required_laps: 3
      };

      const activities = [
        { id: '1', start_date: '2025-10-28T12:00:00Z' }
      ];

      // Efforts: [400, 350, 380, 420, 390]
      // Windows: [400+350+380=1130], [350+380+420=1150], [380+420+390=1190]
      // Best: [400+350+380=1130]
      stravaClient.getActivity.mockResolvedValue({
        id: '1',
        name: 'Test Activity',
        segment_efforts: [
          { segment: { id: '100' }, elapsed_time: 400 },
          { segment: { id: '100' }, elapsed_time: 350 },
          { segment: { id: '100' }, elapsed_time: 380 },
          { segment: { id: '100' }, elapsed_time: 420 },
          { segment: { id: '100' }, elapsed_time: 390 }
        ]
      });

      const result = await activityProcessor.findBestQualifyingActivity(
        activities,
        week.strava_segment_id,
        week.required_laps,
        'token',
        week
      );

      expect(result).not.toBeNull();
      expect(result.totalTime).toBe(1130);
      expect(result.segmentEfforts.length).toBe(3);
      const times = result.segmentEfforts.map(e => e.elapsed_time);
      expect(times).toEqual([400, 350, 380]);
    });

    test('handles API errors gracefully', async () => {
      const week = {
        start_at: isoToUnix('2025-10-28T00:00:00Z'),
        end_at: isoToUnix('2025-10-28T22:00:00Z'),
        strava_segment_id: '100',
        required_laps: 1
      };

      const activities = [
        { id: '1', start_date: '2025-10-28T12:00:00Z' }
      ];

      stravaClient.getActivity.mockRejectedValue(new Error('API Error'));

      const result = await activityProcessor.findBestQualifyingActivity(
        activities,
        week.strava_segment_id,
        week.required_laps,
        'token',
        week
      );

      // Should handle error gracefully
      expect(result).toBeNull();
    });

    test('filters out activities outside time window (timezone edge case)', async () => {
      // CRITICAL TEST: Ensures we don't process activities outside week's time window
      // This catches the prod vs dev timezone mismatch issue
      
      const week = {
        start_at: isoToUnix('2025-01-07T00:00:00Z'),
        end_at: isoToUnix('2025-01-07T22:00:00Z'),
        strava_segment_id: '100',
        required_laps: 1
      };

      const activities = [
        { id: '1', start_date: '2024-01-06T23:59:59Z' },  // Before window
        { id: '2', start_date: '2025-01-07T12:00:00Z' },  // Inside window
        { id: '3', start_date: '2025-01-07T22:00:01Z' },  // After window
        { id: '4', start_date: '2025-01-08T00:00:00Z' }   // Next day
      ];

      stravaClient.getActivity.mockResolvedValue({
        id: '2',
        name: 'Valid Activity',
        segment_efforts: [
          { segment: { id: '100' }, elapsed_time: 600 }
        ]
      });

      const result = await activityProcessor.findBestQualifyingActivity(
        activities,
        week.strava_segment_id,
        week.required_laps,
        'token',
        week
      );

      // Should only call getActivity once (for activity #2, the only one in window)
      expect(stravaClient.getActivity).toHaveBeenCalledTimes(1);
      expect(stravaClient.getActivity).toHaveBeenCalledWith('2', 'token');
      
      // Result should be from the only valid activity
      expect(result).not.toBeNull();
      expect(result.id).toBe('2');
    });

    test('handles week parameter omission gracefully (backward compatibility)', async () => {
      // If week not provided, should process all activities (old behavior)
      const activities = [
        { id: '1', start_date: '2025-10-28T12:00:00Z' }
      ];

      stravaClient.getActivity.mockResolvedValue({
        id: '1',
        name: 'Test Activity',
        segment_efforts: [
          { segment: { id: '100' }, elapsed_time: 600 }
        ]
      });

      const result = await activityProcessor.findBestQualifyingActivity(
        activities,
        '100',  // targetSegmentId
        1,    // requiredLaps
        'token'
        // Note: week parameter omitted
      );

      // Should still work (backward compatibility)
      expect(result).not.toBeNull();
      expect(result.id).toBe('1');
    });
  });
});
