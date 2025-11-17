/**
 * Activity Processor Tests
 * 
 * Tests for activity processing logic, independent of Strava API
 * These can be run without making actual API calls by mocking the stravaClient module
 */

const { isoToUnix } = require('../dateUtils');
const activityProcessor = require('../activityProcessor');

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
      const result = await activityProcessor.findBestQualifyingActivity([], 123, 1, 'token');
      expect(result).toBeNull();
    });

    test('filters activities outside time window', async () => {
      const week = {
        start_time: '2025-10-28T00:00:00Z',
        end_time: '2025-10-28T22:00:00Z',
        strava_segment_id: 100,
        required_laps: 1
      };

      const activities = [
        { id: 1, start_date: '2025-10-27T12:00:00Z' }, // Before window
        { id: 2, start_date: '2025-10-28T12:00:00Z' }  // Within window
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
        strava_segment_id: 100,
        required_laps: 1
      };

      const activities = [
        { id: 1, start_date: '2025-10-28T12:00:00Z' },
        { id: 2, start_date: '2025-10-28T14:00:00Z' }
      ];

      stravaClient.getActivity.mockResolvedValue({
        id: 1,
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
        strava_segment_id: 100,
        required_laps: 1
      };

      const activities = [
        { id: 1, start_date: '2025-10-28T12:00:00Z' }
      ];

      stravaClient.getActivity.mockResolvedValue({
        id: 1,
        name: 'Test Activity',
        segment_efforts: [
          {
            segment: { id: 100 }, // Correct segment
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
      expect(result.id).toBe(1);
    });

    test('requires minimum number of laps', async () => {
      const week = {
        start_at: isoToUnix('2025-10-28T00:00:00Z'),
        end_at: isoToUnix('2025-10-28T22:00:00Z'),
        strava_segment_id: 100,
        required_laps: 3
      };

      const activities = [
        { id: 1, start_date: '2025-10-28T12:00:00Z' }
      ];

      stravaClient.getActivity.mockResolvedValue({
        id: 1,
        name: 'Test Activity',
        segment_efforts: [
          { segment: { id: 100 }, elapsed_time: 600 },
          { segment: { id: 100 }, elapsed_time: 620 }
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
        strava_segment_id: 100,
        required_laps: 2
      };

      const activities = [
        { id: 1, start_date: '2025-10-28T12:00:00Z' },
        { id: 2, start_date: '2025-10-28T13:00:00Z' }
      ];

      stravaClient.getActivity
        .mockResolvedValueOnce({
          id: 1,
          name: 'Slower Activity',
          segment_efforts: [
            { segment: { id: 100 }, elapsed_time: 600 },
            { segment: { id: 100 }, elapsed_time: 620 }
          ]
        })
        .mockResolvedValueOnce({
          id: 2,
          name: 'Faster Activity',
          segment_efforts: [
            { segment: { id: 100 }, elapsed_time: 580 },
            { segment: { id: 100 }, elapsed_time: 590 }
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
      expect(result.id).toBe(2); // Faster activity
    });

    test('handles API errors gracefully', async () => {
      const week = {
        start_at: isoToUnix('2025-10-28T00:00:00Z'),
        end_at: isoToUnix('2025-10-28T22:00:00Z'),
        strava_segment_id: 100,
        required_laps: 1
      };

      const activities = [
        { id: 1, start_date: '2025-10-28T12:00:00Z' }
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
        strava_segment_id: 100,
        required_laps: 1
      };

      const activities = [
        { id: 1, start_date: '2024-01-06T23:59:59Z' },  // Before window
        { id: 2, start_date: '2025-01-07T12:00:00Z' },  // Inside window
        { id: 3, start_date: '2025-01-07T22:00:01Z' },  // After window
        { id: 4, start_date: '2025-01-08T00:00:00Z' }   // Next day
      ];

      stravaClient.getActivity.mockResolvedValue({
        id: 2,
        name: 'Valid Activity',
        segment_efforts: [
          { segment: { id: 100 }, elapsed_time: 600 }
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
      expect(stravaClient.getActivity).toHaveBeenCalledWith(2, 'token');
      
      // Result should be from the only valid activity
      expect(result).not.toBeNull();
      expect(result.id).toBe(2);
    });

    test('handles week parameter omission gracefully (backward compatibility)', async () => {
      // If week not provided, should process all activities (old behavior)
      const activities = [
        { id: 1, start_date: '2025-10-28T12:00:00Z' }
      ];

      stravaClient.getActivity.mockResolvedValue({
        id: 1,
        name: 'Test Activity',
        segment_efforts: [
          { segment: { id: 100 }, elapsed_time: 600 }
        ]
      });

      const result = await activityProcessor.findBestQualifyingActivity(
        activities,
        100,  // targetSegmentId
        1,    // requiredLaps
        'token'
        // Note: week parameter omitted
      );

      // Should still work (backward compatibility)
      expect(result).not.toBeNull();
      expect(result.id).toBe(1);
    });
  });
});
