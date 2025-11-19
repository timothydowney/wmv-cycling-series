// @ts-nocheck
/**
 * Activity Storage Tests
 * Tests for activity and segment effort persistence
 */

import { isoToUnix } from '../dateUtils';
import { storeActivityAndEfforts } from '../activityStorage';

describe('Activity Storage', () => {
  let mockDb;
  const testAthleteId = 12345678;
  const testWeekId = 1;
  const testSegmentId = 98765432;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database with chainable methods
    mockDb = {
      prepare: jest.fn()
    };
  });

  describe('storeActivityAndEfforts', () => {
    it('should store activity and segment efforts when no existing activity', () => {
      const mockSelectStatement = {
        get: jest.fn().mockReturnValue(null) // No existing activity
      };
      const mockInsertActivityStatement = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 100 })
      };
      const mockInsertSegmentEffortStatement = {
        run: jest.fn()
      };
      const mockInsertResultStatement = {
        run: jest.fn()
      };

      mockDb.prepare
        .mockReturnValueOnce(mockSelectStatement) // SELECT existing
        .mockReturnValueOnce(mockInsertActivityStatement) // INSERT activity
        .mockReturnValueOnce(mockInsertSegmentEffortStatement) // INSERT segment effort 1
        .mockReturnValueOnce(mockInsertSegmentEffortStatement) // INSERT segment effort 2
        .mockReturnValueOnce(mockInsertResultStatement); // INSERT result

      const activityData = {
        id: 9876543210,
        start_date: '2025-06-01T10:00:00Z',
        device_name: 'Garmin Edge 530',
        segmentEfforts: [
          {
            id: 1111111111,
            start_date: '2025-06-01T10:05:00Z',
            elapsed_time: 720,
            pr_rank: null
          },
          {
            id: 2222222222,
            start_date: '2025-06-01T10:07:00Z',
            elapsed_time: 710,
            pr_rank: 1 // PR achieved
          }
        ],
        totalTime: 1430
      };

      storeActivityAndEfforts(mockDb, testAthleteId, testWeekId, activityData, testSegmentId);

      // Verify activity was inserted with Unix timestamp
      expect(mockInsertActivityStatement.run).toHaveBeenCalledWith(
        testWeekId,
        testAthleteId,
        9876543210,
        isoToUnix('2025-06-01T10:00:00Z'),
        'Garmin Edge 530'
      );

      // Verify segment efforts were inserted with Unix timestamps
      expect(mockInsertSegmentEffortStatement.run).toHaveBeenCalledTimes(2);
      expect(mockInsertSegmentEffortStatement.run).toHaveBeenNthCalledWith(
        1,
        100,
        testSegmentId,
        '1111111111',
        0,
        720,
        isoToUnix('2025-06-01T10:05:00Z'),
        0 // No PR
      );
      expect(mockInsertSegmentEffortStatement.run).toHaveBeenNthCalledWith(
        2,
        100,
        testSegmentId,
        '2222222222',
        1,
        710,
        isoToUnix('2025-06-01T10:07:00Z'),
        1 // PR achieved
      );

      // Verify result was stored
      expect(mockInsertResultStatement.run).toHaveBeenCalledWith(
        testWeekId,
        testAthleteId,
        100,
        1430
      );
    });

    it('should delete existing activity and efforts before storing new ones', () => {
      const existingActivityId = 50;
      const mockSelectStatement = {
        get: jest.fn().mockReturnValue({ id: existingActivityId })
      };
      const mockDeleteResultStatement = { run: jest.fn() };
      const mockDeleteSegmentEffortStatement = { run: jest.fn() };
      const mockDeleteActivityStatement = { run: jest.fn() };
      const mockInsertActivityStatement = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 101 })
      };
      const mockInsertSegmentEffortStatement = { run: jest.fn() };
      const mockInsertResultStatement = { run: jest.fn() };

      mockDb.prepare
        .mockReturnValueOnce(mockSelectStatement) // SELECT existing
        .mockReturnValueOnce(mockDeleteResultStatement) // DELETE result
        .mockReturnValueOnce(mockDeleteSegmentEffortStatement) // DELETE segment efforts
        .mockReturnValueOnce(mockDeleteActivityStatement) // DELETE activity
        .mockReturnValueOnce(mockInsertActivityStatement) // INSERT activity
        .mockReturnValueOnce(mockInsertSegmentEffortStatement) // INSERT segment effort
        .mockReturnValueOnce(mockInsertResultStatement); // INSERT result

      const activityData = {
        id: 9876543211,
        start_date: '2025-06-01T11:00:00Z',
        device_name: null,
        segmentEfforts: [
          { id: 3333333333, start_date: '2025-06-01T11:05:00Z', elapsed_time: 650, pr_rank: null }
        ],
        totalTime: 650
      };

      storeActivityAndEfforts(mockDb, testAthleteId, testWeekId, activityData, testSegmentId);

      // Verify deletions happened in correct order
      expect(mockDeleteResultStatement.run).toHaveBeenCalledWith(existingActivityId);
      expect(mockDeleteSegmentEffortStatement.run).toHaveBeenCalledWith(existingActivityId);
      expect(mockDeleteActivityStatement.run).toHaveBeenCalledWith(existingActivityId);

      // Verify new activity was inserted with Unix timestamp
      expect(mockInsertActivityStatement.run).toHaveBeenCalledWith(
        testWeekId,
        testAthleteId,
        9876543211,
        isoToUnix('2025-06-01T11:00:00Z'),
        null
      );
    });

    it('should handle activity with no device name', () => {
      const mockSelectStatement = {
        get: jest.fn().mockReturnValue(null)
      };
      const mockInsertActivityStatement = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 102 })
      };
      const mockInsertSegmentEffortStatement = { run: jest.fn() };
      const mockInsertResultStatement = { run: jest.fn() };

      mockDb.prepare
        .mockReturnValueOnce(mockSelectStatement)
        .mockReturnValueOnce(mockInsertActivityStatement)
        .mockReturnValueOnce(mockInsertSegmentEffortStatement)
        .mockReturnValueOnce(mockInsertResultStatement);

      const activityData = {
        id: 9876543212,
        start_date: '2025-06-01T12:00:00Z',
        device_name: undefined, // No device name
        segmentEfforts: [
          { id: 4444444444, start_date: '2025-06-01T12:05:00Z', elapsed_time: 680, pr_rank: null }
        ],
        totalTime: 680
      };

      storeActivityAndEfforts(mockDb, testAthleteId, testWeekId, activityData, testSegmentId);

      // Should pass null for device_name when undefined and Unix timestamp
      expect(mockInsertActivityStatement.run).toHaveBeenCalledWith(
        testWeekId,
        testAthleteId,
        9876543212,
        isoToUnix('2025-06-01T12:00:00Z'),
        null
      );
    });

    it('should handle multiple segment efforts correctly', () => {
      const mockSelectStatement = {
        get: jest.fn().mockReturnValue(null)
      };
      const mockInsertActivityStatement = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 103 })
      };
      const mockInsertSegmentEffortStatement = { run: jest.fn() };
      const mockInsertResultStatement = { run: jest.fn() };

      mockDb.prepare
        .mockReturnValueOnce(mockSelectStatement)
        .mockReturnValueOnce(mockInsertActivityStatement)
        .mockReturnValueOnce(mockInsertSegmentEffortStatement)
        .mockReturnValueOnce(mockInsertSegmentEffortStatement)
        .mockReturnValueOnce(mockInsertSegmentEffortStatement)
        .mockReturnValueOnce(mockInsertResultStatement);

      const activityData = {
        id: 9876543213,
        start_date_local: '2025-06-01T13:00:00Z',
        device_name: 'Garmin Edge 1030+',
        segmentEfforts: [
          { id: 5555555555, start_date: '2025-06-01T13:05:00Z', elapsed_time: 600, pr_rank: 1 },
          { id: 6666666666, start_date: '2025-06-01T13:15:00Z', elapsed_time: 590, pr_rank: 2 },
          { id: 7777777777, start_date: '2025-06-01T13:25:00Z', elapsed_time: 595, pr_rank: null }
        ],
        totalTime: 1785
      };

      storeActivityAndEfforts(mockDb, testAthleteId, testWeekId, activityData, testSegmentId);

      // Should insert 3 segment efforts with correct indices and Unix timestamps
      expect(mockInsertSegmentEffortStatement.run).toHaveBeenCalledTimes(3);
      expect(mockInsertSegmentEffortStatement.run).toHaveBeenNthCalledWith(
        1,
        103,
        testSegmentId,
        '5555555555',
        0, // First effort
        600,
        isoToUnix('2025-06-01T13:05:00Z'),
        1
      );
      expect(mockInsertSegmentEffortStatement.run).toHaveBeenNthCalledWith(
        2,
        103,
        testSegmentId,
        '6666666666',
        1, // Second effort
        590,
        isoToUnix('2025-06-01T13:15:00Z'),
        1
      );
      expect(mockInsertSegmentEffortStatement.run).toHaveBeenNthCalledWith(
        3,
        103,
        testSegmentId,
        '7777777777',
        2, // Third effort
        595,
        isoToUnix('2025-06-01T13:25:00Z'),
        0
      );
    });

    it('should convert pr_rank to boolean correctly (truthy = 1, falsy = 0)', () => {
      const mockSelectStatement = {
        get: jest.fn().mockReturnValue(null)
      };
      const mockInsertActivityStatement = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 104 })
      };
      const mockInsertSegmentEffortStatement = { run: jest.fn() };
      const mockInsertResultStatement = { run: jest.fn() };

      mockDb.prepare
        .mockReturnValueOnce(mockSelectStatement)
        .mockReturnValueOnce(mockInsertActivityStatement)
        .mockReturnValueOnce(mockInsertSegmentEffortStatement)
        .mockReturnValueOnce(mockInsertSegmentEffortStatement)
        .mockReturnValueOnce(mockInsertSegmentEffortStatement)
        .mockReturnValueOnce(mockInsertResultStatement);

      const activityData = {
        id: 9876543214,
        start_date_local: '2025-06-01T14:00:00Z',
        device_name: null,
        segmentEfforts: [
          { id: 8888888888, start_date: '2025-06-01T14:05:00Z', elapsed_time: 700, pr_rank: 1 }, // pr_rank = 1 (truthy)
          { id: 9999999999, start_date: '2025-06-01T14:15:00Z', elapsed_time: 710, pr_rank: null }, // pr_rank = null (falsy)
          { id: 1010101010, start_date: '2025-06-01T14:25:00Z', elapsed_time: 705, pr_rank: 0 } // pr_rank = 0 (falsy)
        ],
        totalTime: 2115
      };

      storeActivityAndEfforts(mockDb, testAthleteId, testWeekId, activityData, testSegmentId);

      // Check pr_achieved conversion (pr_rank ? 1 : 0) with Unix timestamps
      expect(mockInsertSegmentEffortStatement.run).toHaveBeenNthCalledWith(
        1,
        104,
        testSegmentId,
        '8888888888',
        0,
        700,
        isoToUnix('2025-06-01T14:05:00Z'),
        1 // pr_rank = 1 → pr_achieved = 1
      );
      expect(mockInsertSegmentEffortStatement.run).toHaveBeenNthCalledWith(
        2,
        104,
        testSegmentId,
        '9999999999',
        1,
        710,
        isoToUnix('2025-06-01T14:15:00Z'),
        0 // pr_rank = null → pr_achieved = 0
      );
      expect(mockInsertSegmentEffortStatement.run).toHaveBeenNthCalledWith(
        3,
        104,
        testSegmentId,
        '1010101010',
        2,
        705,
        isoToUnix('2025-06-01T14:25:00Z'),
        0 // pr_rank = 0 → pr_achieved = 0
      );
    });

    it('should store result with correct total time', () => {
      const mockSelectStatement = {
        get: jest.fn().mockReturnValue(null)
      };
      const mockInsertActivityStatement = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 105 })
      };
      const mockInsertSegmentEffortStatement = { run: jest.fn() };
      const mockInsertResultStatement = { run: jest.fn() };

      mockDb.prepare
        .mockReturnValueOnce(mockSelectStatement)
        .mockReturnValueOnce(mockInsertActivityStatement)
        .mockReturnValueOnce(mockInsertSegmentEffortStatement)
        .mockReturnValueOnce(mockInsertResultStatement);

      const activityData = {
        id: 9876543215,
        device_name: 'Wahoo Elemnt',
        segmentEfforts: [
          { id: 1212121212, elapsed_time: 1420, pr_rank: null }
        ],
        totalTime: 1420
      };

      storeActivityAndEfforts(mockDb, testAthleteId, testWeekId, activityData, testSegmentId);

      // Verify result includes activity ID
      expect(mockInsertResultStatement.run).toHaveBeenCalledWith(
        testWeekId,
        testAthleteId,
        105,
        1420
      );
    });

    it('should use INSERT OR REPLACE for results', () => {
      const mockSelectStatement = {
        get: jest.fn().mockReturnValue(null)
      };
      const mockInsertActivityStatement = {
        run: jest.fn().mockReturnValue({ lastInsertRowid: 106 })
      };
      const mockInsertSegmentEffortStatement = { run: jest.fn() };
      const mockInsertResultStatement = { run: jest.fn() };

      mockDb.prepare
        .mockReturnValueOnce(mockSelectStatement)
        .mockReturnValueOnce(mockInsertActivityStatement)
        .mockReturnValueOnce(mockInsertSegmentEffortStatement)
        .mockReturnValueOnce(mockInsertResultStatement);

      const activityData = {
        id: 9876543216,
        device_name: null,
        segmentEfforts: [
          { id: 1313131313, elapsed_time: 750, pr_rank: null }
        ],
        totalTime: 750
      };

      storeActivityAndEfforts(mockDb, testAthleteId, testWeekId, activityData, testSegmentId);

      // Check that result insert uses INSERT OR REPLACE
      // With 1 segment effort, calls are: SELECT, INSERT activity, INSERT segment effort, INSERT result
      const resultInsertCall = mockDb.prepare.mock.calls[3][0];
      expect(resultInsertCall).toContain('INSERT OR REPLACE INTO result');
    });
  });
});
