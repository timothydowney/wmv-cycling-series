/**
 * Activity Processor Tests
 * 
 * Tests for activity processing logic, independent of Strava API
 * These can be run without making actual API calls by mocking the stravaClient module
 * 
 * NOTE: This file consolidates tests for extractActivityId() and validateActivityTimeWindow()
 * that were previously in validation.test.js. Tests are now centralized with the module they test.
 */

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

  describe('extractActivityId', () => {
    test('extracts ID from full Strava URL', () => {
      const url = 'https://www.strava.com/activities/12345678';
      expect(activityProcessor.extractActivityId(url)).toBe('12345678');
    });

    test('extracts ID from Strava URL with trailing slash', () => {
      const url = 'https://www.strava.com/activities/12345678/';
      expect(activityProcessor.extractActivityId(url)).toBe('12345678');
    });

    test('extracts ID from www URL', () => {
      const url = 'www.strava.com/activities/12345678';
      expect(activityProcessor.extractActivityId(url)).toBe('12345678');
    });

    test('extracts ID from URL with query params', () => {
      const url = 'https://www.strava.com/activities/12345678?effort_id=99';
      expect(activityProcessor.extractActivityId(url)).toBe('12345678');
    });

    test('parses raw numeric ID', () => {
      expect(activityProcessor.extractActivityId('12345678')).toBe('12345678');
    });

    test('returns null for invalid format', () => {
      expect(activityProcessor.extractActivityId('invalid')).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(activityProcessor.extractActivityId('')).toBeNull();
    });

    test('returns null for null input', () => {
      expect(activityProcessor.extractActivityId(null)).toBeNull();
    });

    test('returns null for undefined input', () => {
      expect(activityProcessor.extractActivityId(undefined)).toBeNull();
    });

    test('handles various URL formats', () => {
      const urls = [
        'https://www.strava.com/activities/987654321',
        'http://strava.com/activities/111222333',
        'strava.com/activities/444555666',
        '777888999'
      ];
      const expected = ['987654321', '111222333', '444555666', '777888999'];
      urls.forEach((url, idx) => {
        expect(activityProcessor.extractActivityId(url)).toBe(expected[idx]);
      });
    });
  });

  describe('validateActivityTimeWindow', () => {
    const mockWeek = {
      id: 1,
      week_name: 'Test Week',
      date: '2025-11-19',
      start_time: '2025-11-19T00:00:00Z',
      end_time: '2025-11-19T22:00:00Z'
    };

    test('accepts activity at start time exactly', () => {
      const result = activityProcessor.validateActivityTimeWindow('2025-11-19T00:00:00Z', mockWeek);
      expect(result.valid).toBe(true);
    });

    test('accepts activity at end time exactly', () => {
      const result = activityProcessor.validateActivityTimeWindow('2025-11-19T22:00:00Z', mockWeek);
      expect(result.valid).toBe(true);
    });

    test('accepts activity in middle of window', () => {
      const result = activityProcessor.validateActivityTimeWindow('2025-11-19T12:00:00Z', mockWeek);
      expect(result.valid).toBe(true);
    });

    test('rejects activity before start time', () => {
      const result = activityProcessor.validateActivityTimeWindow('2025-11-18T23:59:59Z', mockWeek);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('before window start');
    });

    test('rejects activity after end time', () => {
      const result = activityProcessor.validateActivityTimeWindow('2025-11-19T22:00:01Z', mockWeek);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('after window end');
    });

    test('rejects activity far in future', () => {
      const result = activityProcessor.validateActivityTimeWindow('2025-11-20T10:00:00Z', mockWeek);
      expect(result.valid).toBe(false);
    });

    test('handles custom time window (6am-2pm)', () => {
      const customWeek = {
        ...mockWeek,
        start_time: '2025-11-19T06:00:00Z',
        end_time: '2025-11-19T14:00:00Z'
      };

      expect(activityProcessor.validateActivityTimeWindow('2025-11-19T05:59:59Z', customWeek).valid).toBe(false);
      expect(activityProcessor.validateActivityTimeWindow('2025-11-19T06:00:00Z', customWeek).valid).toBe(true);
      expect(activityProcessor.validateActivityTimeWindow('2025-11-19T10:00:00Z', customWeek).valid).toBe(true);
      expect(activityProcessor.validateActivityTimeWindow('2025-11-19T14:00:00Z', customWeek).valid).toBe(true);
      expect(activityProcessor.validateActivityTimeWindow('2025-11-19T14:00:01Z', customWeek).valid).toBe(false);
    });

    test('handles different date formats (with milliseconds)', () => {
      const result = activityProcessor.validateActivityTimeWindow('2025-11-19T12:00:00.000Z', mockWeek);
      expect(result.valid).toBe(true);
    });

    test('handles edge case: activity at 00:00:00.000Z boundary', () => {
      const result = activityProcessor.validateActivityTimeWindow('2025-11-19T00:00:00.000Z', mockWeek);
      expect(result.valid).toBe(true);
    });
  });

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
        { id: 1, start_date_local: '2025-10-27T12:00:00Z' }, // Before window
        { id: 2, start_date_local: '2025-10-28T12:00:00Z' }  // Within window
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
        start_time: '2025-10-28T00:00:00Z',
        end_time: '2025-10-28T22:00:00Z',
        strava_segment_id: 100,
        required_laps: 1
      };

      const activities = [
        { id: 1, start_date_local: '2025-10-28T12:00:00Z' },
        { id: 2, start_date_local: '2025-10-28T14:00:00Z' }
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
        start_time: '2025-10-28T00:00:00Z',
        end_time: '2025-10-28T22:00:00Z',
        strava_segment_id: 100,
        required_laps: 1
      };

      const activities = [
        { id: 1, start_date_local: '2025-10-28T12:00:00Z' }
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
        start_time: '2025-10-28T00:00:00Z',
        end_time: '2025-10-28T22:00:00Z',
        strava_segment_id: 100,
        required_laps: 3
      };

      const activities = [
        { id: 1, start_date_local: '2025-10-28T12:00:00Z' }
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
        start_time: '2025-10-28T00:00:00Z',
        end_time: '2025-10-28T22:00:00Z',
        strava_segment_id: 100,
        required_laps: 2
      };

      const activities = [
        { id: 1, start_date_local: '2025-10-28T12:00:00Z' },
        { id: 2, start_date_local: '2025-10-28T13:00:00Z' }
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
        start_time: '2025-10-28T00:00:00Z',
        end_time: '2025-10-28T22:00:00Z',
        strava_segment_id: 100,
        required_laps: 1
      };

      const activities = [
        { id: 1, start_date_local: '2025-10-28T12:00:00Z' }
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
  });
});
