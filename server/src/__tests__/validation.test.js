const path = require('path');
const fs = require('fs');

// Mock strava-v3 library to prevent network calls
jest.mock('strava-v3', () => ({
  config: jest.fn(),
  client: jest.fn().mockImplementation(() => ({
    activities: { get: jest.fn() }
  })),
  oauth: {
    refreshToken: jest.fn(),
    getToken: jest.fn()
  }
}));

// Set test database path before requiring app
const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'validation-test.db');
process.env.DATABASE_PATH = TEST_DB_PATH;
process.env.NODE_ENV = 'test';

// Remove test database if it exists
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

const { validateActivityTimeWindow } = require('../index');

describe('Helper Functions', () => {

  describe('validateActivityTimeWindow', () => {
    const mockWeek = {
      id: 1,
      week_name: 'Test Week',
      date: '2025-11-19',
      start_time: '2025-11-19T00:00:00Z',
      end_time: '2025-11-19T22:00:00Z'
    };

    test('accepts activity at start time exactly', () => {
      const result = validateActivityTimeWindow('2025-11-19T00:00:00Z', mockWeek);
      expect(result.valid).toBe(true);
    });

    test('accepts activity at end time exactly', () => {
      const result = validateActivityTimeWindow('2025-11-19T22:00:00Z', mockWeek);
      expect(result.valid).toBe(true);
    });

    test('accepts activity in middle of window', () => {
      const result = validateActivityTimeWindow('2025-11-19T12:00:00Z', mockWeek);
      expect(result.valid).toBe(true);
    });

    test('rejects activity before start time', () => {
      const result = validateActivityTimeWindow('2025-11-18T23:59:59Z', mockWeek);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('must be completed between');
    });

    test('rejects activity after end time', () => {
      const result = validateActivityTimeWindow('2025-11-19T22:00:01Z', mockWeek);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('must be completed between');
    });

    test('error message includes all time information', () => {
      const result = validateActivityTimeWindow('2025-11-20T10:00:00Z', mockWeek);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('2025-11-19T00:00:00');
      expect(result.message).toContain('2025-11-19T22:00:00');
      expect(result.message).toContain('2025-11-20T10:00:00');
    });

    test('handles custom time window (6am-2pm)', () => {
      const customWeek = {
        ...mockWeek,
        start_time: '2025-11-19T06:00:00Z',
        end_time: '2025-11-19T14:00:00Z'
      };

      expect(validateActivityTimeWindow('2025-11-19T05:59:59Z', customWeek).valid).toBe(false);
      expect(validateActivityTimeWindow('2025-11-19T06:00:00Z', customWeek).valid).toBe(true);
      expect(validateActivityTimeWindow('2025-11-19T10:00:00Z', customWeek).valid).toBe(true);
      expect(validateActivityTimeWindow('2025-11-19T14:00:00Z', customWeek).valid).toBe(true);
      expect(validateActivityTimeWindow('2025-11-19T14:00:01Z', customWeek).valid).toBe(false);
    });

    test('handles different date formats', () => {
      // ISO 8601 with milliseconds
      const result1 = validateActivityTimeWindow('2025-11-19T12:00:00.000Z', mockWeek);
      expect(result1.valid).toBe(true);

      // ISO 8601 basic
      const result2 = validateActivityTimeWindow('2025-11-19T12:00:00Z', mockWeek);
      expect(result2.valid).toBe(true);
    });
  });

  afterAll(() => {
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });
});
